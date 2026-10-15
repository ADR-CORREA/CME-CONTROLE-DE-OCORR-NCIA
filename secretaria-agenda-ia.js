/* ═══════════════════════════ SECRETARIA — AGENDA: ANEXO + LEITURA PELA IA ═══════════════════════════
   Pedido de 14/10/2026: no "Novo compromisso", anexar o documento (pedido do PRODOC, ofício, memorando…);
   a IA lê e já preenche "O que precisa ser feito" e "Detalhes" (e a data, se o documento tiver prazo).
   • O texto é tirado NO NAVEGADOR: PDF com texto (pdf.js), PDF escaneado/foto (OCR local — mesmas funções da
     Comunicação: _comExtrairJpegsPdf/_comJpegParaCanvas/_comOcrCanvas), Word .docx (mammoth) e .txt.
   • O resumo vem do Worker: POST /sec/resumir (só admin/gerência/secretaria; Workers AI, llama 3.1 8B).
   • O arquivo fica guardado no compromisso (Worker /sec, pasta agenda/AAAA-MM) e abre pela lista.
   Depende de secretaria*.js e das funções de OCR do index.html. Emojis só por \u{...}. Prefixo _secAgIa / sec_agIa. */

const _SEC_AG_ACEITA = '.pdf,.jpg,.jpeg,.png,.webp,.docx,.txt';

// texto de um arquivo (PDF, imagem, Word, txt) — vazio se não conseguir ler
async function _secTextoDoArquivo(file, onProgresso) {
  const ext = String(file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'txt') return await file.text();
  if (ext === 'docx') {
    await _carregarScriptSE('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js', 'mammoth');
    return ((await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })) || {}).value || '';
  }
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    const bmp = await createImageBitmap(file), c = _comBitmapParaCanvas(bmp, 1600); if (bmp.close) bmp.close();
    return await _comOcrCanvas(c);
  }
  if (ext !== 'pdf') return '';
  // PDF: página por página, NA ORDEM. Página com texto → usa o texto; página escaneada (sem texto) → OCR.
  // (antes: só as 2 maiores imagens do arquivo, fora de ordem, e o OCR podia travar para sempre)
  const pdfjs = await _secCarregarPdfJs(), buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf.slice(0) }).promise, total = Math.min(pdf.numPages, _SEC_IA_MAX_PAGS);
  const jpegs = _secJpegsEmOrdem(new Uint8Array(buf)), paginas = [], partes = [];
  for (let p = 1; p <= total; p++) {
    const page = await pdf.getPage(p);
    const txt = (await page.getTextContent()).items.map(i => i.str).join(' ').trim();
    paginas.push({ page, txt, escaneada: txt.replace(/\s/g, '').length < 40 });
  }
  // imagem de cada página escaneada: 1 JPEG por página do PDF, ou 1 JPEG por página ESCANEADA (PDF misto), na ordem
  const escaneadas = paginas.filter(x => x.escaneada).length;
  const porEscaneada = jpegs.length === escaneadas && jpegs.length !== pdf.numPages;
  let k = 0;
  for (let p = 1; p <= paginas.length; p++) {
    const { page, txt, escaneada } = paginas[p - 1];
    if (!escaneada) { partes.push(txt); continue; }
    if (onProgresso) onProgresso('\u{1F50D} Lendo página ' + p + ' de ' + total + ' (escaneada)…');
    const jpg = jpegs.length === pdf.numPages ? jpegs[p - 1] : porEscaneada ? jpegs[k++] : null;
    let canvas = jpg ? await _comJpegParaCanvas(jpg, 2000) : null;
    if (!canvas) canvas = await _secRenderPagina(page);
    const ocr = canvas ? await _comOcrCanvas(canvas) : '';
    if (!ocr.trim()) _secIaPagsIlegiveis.push(p);
    partes.push(ocr || txt);
    if (partes.join('\n').length > 12000) break; // já há texto de sobra para a IA
  }
  if (pdf.numPages > total) _secIaPagsIlegiveis.push('as páginas depois da ' + total + ' não foram lidas (limite de ' + total + ')');
  return partes.map((t, i) => '[Página ' + (i + 1) + ']\n' + t).join('\n\n');
}
// páginas que a leitura não conseguiu ler — aparecem como aviso para a pessoa conferir à mão
let _secIaPagsIlegiveis = [];
const _SEC_IA_MAX_PAGS = 10;
// JPEGs embutidos (scan do celular/CamScanner) NA ORDEM do arquivo — cada página escaneada é uma imagem grande
function _secJpegsEmOrdem(u) {
  const out = [];
  for (let i = 0; i < u.length - 3; i++) {
    if (u[i] === 0xFF && u[i + 1] === 0xD8 && u[i + 2] === 0xFF) {
      for (let j = i + 3; j < u.length - 1; j++) if (u[j] === 0xFF && u[j + 1] === 0xD9) { const seg = u.slice(i, j + 2); if (seg.length > 20000) out.push(seg); i = j + 1; break; }
    }
  }
  return out;
}
// página do PDF desenhada em imagem (escaneado que não é JPEG), com limite de tempo para nunca travar
async function _secRenderPagina(page) {
  try {
    const vp = page.getViewport({ scale: 2 }), c = document.createElement('canvas');
    c.width = vp.width; c.height = vp.height;
    const task = page.render({ canvasContext: c.getContext('2d'), viewport: vp });
    await Promise.race([task.promise, new Promise((_, rej) => setTimeout(() => { try { task.cancel(); } catch (e) {} rej(new Error('render')); }, 40000))]);
    return c;
  } catch (e) { return null; }
}

// bloco do modal: anexar + status da IA (+ anexos que o compromisso já tem)
function _secAgHtmlAnexo(x) {
  const ja = (x && x.arquivos) || [];
  return '<div style="border:1px dashed #93c5fd;background:#f8fbff;border-radius:6px;padding:8px 10px;margin-bottom:10px">'
    + '<div style="font-weight:600;font-size:.86rem">\u{1F4CE} Anexar documento (opcional)</div>'
    + '<div style="font-size:.75rem;color:#64748b">Pedido do PRODOC, ofício, memorando… em PDF, foto ou Word. A IA lê e preenche o assunto e os detalhes — confira antes de salvar.</div>'
    + (ja.length ? '<div style="font-size:.8rem;margin-top:4px">' + ja.map(a => '<a href="#" onclick="sec_abrirDoc(\'' + encodeURIComponent(a.key) + '\',\'' + _jsq(a.nome) + '\');return false">\u{1F4CE} ' + esc(a.nome) + '</a>').join('<br>') + '</div>' : '')
    + '<input type="file" id="sec-ag-files" multiple accept="' + _SEC_AG_ACEITA + '" onchange="sec_agIaLer(this)" style="margin-top:6px;width:100%">'
    + '<div id="sec-ag-ia" style="font-size:.8rem;margin-top:4px"></div></div>';
}
function _secAgIaStatus(txt, cor) { const el = document.getElementById('sec-ag-ia'); if (el) el.innerHTML = '<span style="color:' + (cor || '#475569') + '">' + txt + '</span>'; }

async function sec_agIaLer(input) {
  const files = [...(input.files || [])]; if (!files.length) return;
  const grande = files.find(f => f.size > 15 * 1024 * 1024); if (grande) { _secAgIaStatus(esc(grande.name) + ': maior que 15 MB.', '#b91c1c'); return; }
  _secAgIaStatus('\u{23F3} Lendo o documento…');
  let texto = ''; _secIaPagsIlegiveis = [];
  try { for (const f of files) texto += '\n\n=== ' + f.name + ' ===\n' + await _secTextoDoArquivo(f, m => _secAgIaStatus(m)); }
  catch (e) { console.warn('[Agenda] leitura do anexo:', e); }
  if (texto.replace(/===[^\n]*===/g, '').replace(/\s/g, '').length < 30) { _secAgIaStatus('Não consegui ler o texto do documento — preencha à mão. O arquivo será anexado mesmo assim.', '#b45309'); return; }
  _secAgIaStatus('\u{1F916} A IA está lendo e resumindo…');
  let r;
  try { r = await r2_api('POST', '/sec/resumir', { 'Content-Type': 'application/json' }, JSON.stringify(Object.assign({ texto: texto.slice(0, 14000), nome: files.map(f => f.name).join(', ').slice(0, 120) }, window.__secIaModelo ? { modelo: window.__secIaModelo } : {}))); }
  catch (e) { _secAgIaStatus('A IA não respondeu (' + esc(e.message || e) + '). Preencha à mão — o arquivo será anexado mesmo assim.', '#b91c1c'); return; }
  const tit = document.getElementById('sec-ag-titulo'), desc = document.getElementById('sec-ag-desc'), data = document.getElementById('sec-ag-data');
  const feitos = [];
  if (r.assunto && tit) { tit.value = r.assunto; feitos.push('assunto'); }
  if (r.detalhes && desc) { desc.value = desc.value.trim() ? desc.value.trim() + '\n\n' + r.detalhes : r.detalhes; feitos.push('detalhes'); }
  if (r.prazo && data && r.prazo >= _secHoje()) { data.value = r.prazo; feitos.push('data (prazo ' + _secBR(r.prazo) + ')'); }
  const resp = document.getElementById('sec-ag-resp');
  if (r.responsavel && resp && !resp.value.trim()) { resp.value = r.responsavel; feitos.push('responsável'); }
  // categoria: com prazo → "Prazo / Ofício"; senão "PRODOC / Documento" (se essas categorias existirem)
  const cats = [...document.querySelectorAll('[data-grupo="sec-ag-cat"]')];
  const cat = cats.find(b => (r.prazo || r.urgente ? /prazo/i : /prodoc|documento/i).test(b.dataset.valor || ''));
  if (cat) _secAgEscolherCat(cat);
  r.avisos = _secIaPagsIlegiveis.map(p => typeof p === 'number' ? 'a página ' + p + ' não pôde ser lida — confira-a no documento' : p).concat(r.avisos || []);
  const avisos = (r.avisos || []).length ? '<div style="color:#b45309;margin-top:3px">\u{26A0}\u{FE0F} Conferir: ' + r.avisos.map(esc).join(' · ') + '</div>' : '';
  const urg = r.urgente ? '<div style="color:#b91c1c;font-weight:700;margin-top:3px">\u{1F6A8} O documento fala em URGÊNCIA.</div>' : '';
  const el = document.getElementById('sec-ag-ia');
  if (el) el.innerHTML = '<span style="color:' + (feitos.length ? '#15803d' : '#b45309') + '">' + (feitos.length ? '\u{2705} A IA preencheu: ' + feitos.join(', ') + '. Confira antes de salvar.' : 'A IA não achou informação suficiente — preencha à mão.') + '</span>' + urg + avisos;
  window.__secIaUltima = r; // (para conferência/testes)
}

// envia os arquivos escolhidos no modal (chamado pelo sec_agSalvar); devolve [{key,nome,tamanho}]
async function _secAgEnviarAnexos(files, v) {
  const enviados = [];
  for (const f of files) {
    _mostrarToast('Enviando ' + f.name + '…');
    const r = await r2_api('POST', '/sec/upload', { 'Content-Type': 'application/json' }, JSON.stringify({ pasta: 'agenda/' + v.data.slice(0, 7), nome: f.name, conteudo: await _secLerArquivo(f), descricao: ('Agenda — ' + v.titulo).slice(0, 300), referencia: _secBR(v.data) }));
    enviados.push({ key: r.key, nome: f.name, tamanho: f.size });
  }
  return enviados;
}

// ── Arquivo geral: a IA preenche a ficha do documento (tipo, número, data, origem, assunto) e marca os servidores citados ──
function _secIaNorm(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
async function sec_arqIaLer(input) {
  const st = (txt, cor) => { const el = document.getElementById('sec-arq-ia'); if (el) el.innerHTML = '<span style="color:' + (cor || '#475569') + '">' + txt + '</span>'; };
  const files = [...(input.files || [])]; if (!files.length) return;
  st('\u{23F3} Lendo o documento…');
  let texto = '';
  try { for (const f of files) texto += '\n\n' + await _secTextoDoArquivo(f); } catch (e) { console.warn('[Arquivo] leitura:', e); }
  if (texto.replace(/\s/g, '').length < 30) { st('Não consegui ler o texto — preencha à mão. O arquivo será anexado mesmo assim.', '#b45309'); return; }
  st('\u{1F916} A IA está lendo o documento…');
  let r;
  try { r = await r2_api('POST', '/sec/resumir', { 'Content-Type': 'application/json' }, JSON.stringify({ texto: texto.slice(0, 9000), nome: files.map(f => f.name).join(', ').slice(0, 120), modo: 'arquivo' })); }
  catch (e) { st('A IA não respondeu (' + esc(e.message || e) + ') — preencha à mão.', '#b91c1c'); return; }
  const feitos = [], campo = (id, v, rot) => { const el = document.getElementById(id); if (el && v && !el.value.trim()) { el.value = v; feitos.push(rot); } };
  const chip = r.tipo && document.querySelector('[data-grupo="sec-arq-tipo"][data-valor="' + r.tipo.replace(/"/g, '') + '"]');
  if (chip) { _secChip(chip); feitos.push('tipo'); }
  campo('sec-arq-num', r.numero, 'número'); campo('sec-arq-assunto', r.assunto, 'assunto'); campo('sec-arq-origem', r.origem, 'origem');
  const dt = document.getElementById('sec-arq-data'); if (dt && r.data) { dt.value = r.data; feitos.push('data'); }
  // servidores citados: nome completo ou primeiro + último nome no texto
  const tn = ' ' + _secIaNorm(texto) + ' ';
  let marcados = 0;
  document.querySelectorAll('#sec-arq-servs input[type=checkbox]').forEach(cb => {
    const s = _secServ(cb.value); if (!s || cb.checked) return;
    const p = _secIaNorm(s.nome).split(' ');
    if (tn.includes(' ' + p.join(' ') + ' ') || (p.length > 2 && tn.includes(' ' + p[0] + ' ' + p[p.length - 1] + ' '))) { cb.checked = true; marcados++; }
  });
  if (marcados) feitos.push(marcados + ' servidor(es) citado(s)');
  st(feitos.length ? '\u{2705} A IA preencheu: ' + feitos.join(', ') + '. Confira antes de salvar.' : 'A IA não achou informação suficiente — preencha à mão.', feitos.length ? '#15803d' : '#b45309');
}
