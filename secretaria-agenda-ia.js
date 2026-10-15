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
async function _secTextoDoArquivo(file) {
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
  const pdfjs = await _secCarregarPdfJs(), buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf.slice(0) }).promise, partes = [];
  for (let p = 1; p <= Math.min(pdf.numPages, 6); p++) partes.push((await (await pdf.getPage(p)).getTextContent()).items.map(i => i.str).join(' '));
  const media = partes.reduce((s, t) => s + t.trim().length, 0) / Math.max(1, partes.length);
  if (media >= 40) return partes.join('\n');
  // PDF escaneado: OCR das imagens das páginas (até 2)
  const jpegs = _comExtrairJpegsPdf(new Uint8Array(buf)), ocr = [];
  for (let i = 0; i < Math.min(2, jpegs.length); i++) { const c = await _comJpegParaCanvas(jpegs[i], 1600); if (c) ocr.push(await _comOcrCanvas(c)); }
  return ocr.join('\n\n') || partes.join('\n');
}

// bloco do modal: anexar + status da IA (+ anexos que o compromisso já tem)
function _secAgHtmlAnexo(x) {
  const ja = (x && x.arquivos) || [];
  return '<div style="border:1px dashed #93c5fd;background:#f8fbff;border-radius:6px;padding:8px 10px;margin-bottom:10px">'
    + '<div style="font-weight:600;font-size:.86rem">\u{1F4CE} Anexar documento (opcional)</div>'
    + '<div style="font-size:.75rem;color:#64748b">Pedido do PRODOC, ofício, memorando… em PDF, foto ou Word. A IA lê e preenche o assunto e os detalhes — confira antes de salvar.</div>'
    + (ja.length ? '<div style="font-size:.8rem;margin-top:4px">' + ja.map(a => '<a href="#" onclick="sec_abrirDoc(\'' + encodeURIComponent(a.key) + '\',\'' + esc(a.nome).replace(/'/g, '') + '\');return false">\u{1F4CE} ' + esc(a.nome) + '</a>').join('<br>') + '</div>' : '')
    + '<input type="file" id="sec-ag-files" multiple accept="' + _SEC_AG_ACEITA + '" onchange="sec_agIaLer(this)" style="margin-top:6px;width:100%">'
    + '<div id="sec-ag-ia" style="font-size:.8rem;margin-top:4px"></div></div>';
}
function _secAgIaStatus(txt, cor) { const el = document.getElementById('sec-ag-ia'); if (el) el.innerHTML = '<span style="color:' + (cor || '#475569') + '">' + txt + '</span>'; }

async function sec_agIaLer(input) {
  const files = [...(input.files || [])]; if (!files.length) return;
  const grande = files.find(f => f.size > 15 * 1024 * 1024); if (grande) { _secAgIaStatus(esc(grande.name) + ': maior que 15 MB.', '#b91c1c'); return; }
  _secAgIaStatus('\u{23F3} Lendo o documento…');
  let texto = '';
  try { for (const f of files) texto += '\n\n=== ' + f.name + ' ===\n' + await _secTextoDoArquivo(f); }
  catch (e) { console.warn('[Agenda] leitura do anexo:', e); }
  if (texto.replace(/===[^\n]*===/g, '').replace(/\s/g, '').length < 30) { _secAgIaStatus('Não consegui ler o texto do documento — preencha à mão. O arquivo será anexado mesmo assim.', '#b45309'); return; }
  _secAgIaStatus('\u{1F916} A IA está lendo e resumindo…');
  let r;
  try { r = await r2_api('POST', '/sec/resumir', { 'Content-Type': 'application/json' }, JSON.stringify({ texto: texto.slice(0, 9000), nome: files.map(f => f.name).join(', ').slice(0, 120) })); }
  catch (e) { _secAgIaStatus('A IA não respondeu (' + esc(e.message || e) + '). Preencha à mão — o arquivo será anexado mesmo assim.', '#b91c1c'); return; }
  const tit = document.getElementById('sec-ag-titulo'), desc = document.getElementById('sec-ag-desc'), data = document.getElementById('sec-ag-data');
  const feitos = [];
  if (r.assunto && tit) { tit.value = r.assunto; feitos.push('assunto'); }
  if (r.detalhes && desc) { desc.value = desc.value.trim() ? desc.value.trim() + '\n\n' + r.detalhes : r.detalhes; feitos.push('detalhes'); }
  if (r.prazo && data && r.prazo >= _secHoje()) { data.value = r.prazo; feitos.push('data (prazo ' + _secBR(r.prazo) + ')'); }
  _secAgIaStatus(feitos.length ? '\u{2705} A IA preencheu: ' + feitos.join(', ') + '. Confira antes de salvar.' : 'A IA não achou informação suficiente — preencha à mão.', feitos.length ? '#15803d' : '#b45309');
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
