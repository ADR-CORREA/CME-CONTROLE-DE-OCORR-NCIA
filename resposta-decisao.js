/* ═══════════ RESPOSTA A DECISÃO JUDICIAL (27/10/2026) — Relatório › "Resposta a decisão" ═══════════
   1) O servidor joga o PDF do ofício/decisão. 2) O sistema lê (pdf.js; OCR se for imagem) e tira: monitorado,
   processo, período, ofício de origem, destinatário e os ITENS perguntados. 3) Levanta tudo de uma vez:
   pasta do monitorado no CME (termos de guarda → série e data de cada tornozeleira), tratativas e ocorrências do
   CME, e o AKILES pelo robô (pedido "E_": ficha, ocorrências do período, Registros, telemetria de cada desligamento).
   4) Monta a minuta por item (tabela + texto editável). 5) "Gerar PDF" reserva o número na central, registra o
   ofício em "Consultar Ofícios" e abre a janela de impressão (padrão ABNT da CME). AKILES SÓ LEITURA.
   Emojis só por \u{...}. Prefixo rd_ / _rd. */

const _rd = { texto: '', campos: null, dados: null, blocos: null, status: '' };
const _RD_PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const _RD_TIPOS = [
  ['equipamento', /substitu|troc|equipamento anterior|equipamentos? (?:anterior|posterior)|identifica[çc][ãa]o d[oa]s? equipamento|tornozeleira utilizada/i],
  ['registros', /reclama|inspe[çc]|manuten|defeito|falha de funcionamento|problema de carregamento|registros? de defeito/i],
  ['bateria', /desligamento|bateria|falha do equipamento|fundamentos t[ée]cnicos|descarga/i],
  ['ocorrencias', /viola[çc]|ocorr[êe]ncia|descumpr|zona de (?:inclus|exclus)|relat[óo]rio de monitora/i],
  ['situacao', /situa[çc][ãa]o|est[áa] (?:sendo )?monitorad|comunica|localiza|endere[çc]o|ativ[oa]|in[íi]cio|t[ée]rmino/i],
];
const _RD_NAO_CME = /^(?:mantenho|juntad|publicad|dispensa|d[êe]-se|intime|vista ao|ap[óo]s,|voltem|ci[êe]ncia ao|expe[çc]a-se|cumpra-se)/i;

function rd_norm(s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function rd_set(msg, erro) { _rd.status = msg; const el = document.getElementById('rd-status'); if (el) { el.textContent = msg; el.style.color = erro ? 'var(--idv-cr)' : 'var(--idv-sec)'; } }
function rd_dataBR(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(iso || ''); }
function rd_dataISO(br) { const m = String(br || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? m[3] + '-' + m[2] + '-' + m[1] : ''; }
function rd_dt(s) { const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{2,4})(?:[ T](\d{2}):(\d{2}))?/); if (!m) return null; const a = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return new Date(a, +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)); }
const _RD_EXT = { um: 1, primeiro: 1, dois: 2, tres: 3, três: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30 };
const _RD_MES = { janeiro: 1, fevereiro: 2, marco: 3, março: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };
// "aos vinte e quatro dias do mês de Setembro de 2026" → "24/09/2026"
function rd_dataExtenso(t) {
  const m = String(t || '').match(/aos?\s+([a-zê\s]+?)\s+dias?\s+do\s+m[êe]s\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i); if (!m) return '';
  let d = 0; m[1].toLowerCase().split(/\s+e\s+|\s+/).forEach(w => { d += _RD_EXT[w] || 0; });
  const mes = _RD_MES[m[2].toLowerCase()]; if (!d || !mes) return '';
  return String(d).padStart(2, '0') + '/' + String(mes).padStart(2, '0') + '/' + m[3];
}

/* ── 1. ler o documento ─────────────────────────────────────────── */
async function rd_pdfTexto(buf, ocrSePreciso) {
  await _carregarScriptSE(_RD_PDFJS, 'pdfjsLib');
  try { pdfjsLib.GlobalWorkerOptions.workerSrc = _RD_PDFJS.replace('pdf.min.js', 'pdf.worker.min.js'); } catch (e) {}
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise; let txt = '';
  for (let p = 1; p <= Math.min(pdf.numPages, 30); p++) { const pg = await pdf.getPage(p); const c = await pg.getTextContent(); txt += '\n' + c.items.map(x => x.str).join(' '); }
  if (txt.replace(/\s/g, '').length < 80 && ocrSePreciso && typeof _comOcrCanvas === 'function') {
    txt = '';
    for (let p = 1; p <= Math.min(pdf.numPages, 4); p++) {
      const pg = await pdf.getPage(p), vp = pg.getViewport({ scale: 1.6 }), cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
      await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      const t = await _comOcrCanvas(cv); txt += '\n' + (typeof t === 'string' ? t : (t && t.texto) || '');
    }
  }
  return txt.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}
async function rd_ler(input) {
  const f = input.files && input.files[0]; if (!f) return;
  try {
    rd_set('Lendo ' + f.name + '…');
    const buf = await f.arrayBuffer(); let txt = '';
    if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') txt = await rd_pdfTexto(buf, true);
    else if (/^image\//.test(f.type) && typeof _comOcrCanvas === 'function') {
      const img = new Image(); img.src = URL.createObjectURL(f); await new Promise(r => { img.onload = r; });
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; cv.getContext('2d').drawImage(img, 0, 0);
      const t = await _comOcrCanvas(cv); txt = typeof t === 'string' ? t : (t && t.texto) || '';
    } else txt = await f.text();
    _rd.texto = txt; _rd.campos = rd_extrair(txt); _rd.dados = null; _rd.blocos = null;
    rd_set('Documento lido (' + txt.length + ' caracteres). Confira os campos e os itens antes de levantar.');
    rd_render();
  } catch (e) { rd_set('Não consegui ler o documento: ' + (e.message || e), true); }
  input.value = '';
}
function rd_extrair(t) {
  const T = t.replace(/\s+/g, ' ');
  const c = { nome: '', processo: '', ini: '', fim: '', origem: '', orgao: '', destinatario: '', assunto: '', prazo: '', itens: [] };
  const cnj = T.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/); if (cnj) c.processo = cnj[0];
  const nomePat = [/PPL\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{8,70}?)(?=\s*(?:\(|,|\.|Senhor|Solicit|RG|CPF|Sem mais|referente|$))/, /Executad[oa]\(s\):\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{8,70}?)\s*\(/, /(?:reeducand[oa]|apenad[oa]|monitorad[oa](?:\(a\))?|acusad[oa])\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{8,70}?)(?=\s*[,.(;]|\s+(?:RG|CPF|assistid|nos autos))/];
  for (const p of nomePat) { const m = T.match(p); if (m) { c.nome = m[1].replace(/\s+/g, ' ').trim(); break; } }
  const per = [...T.matchAll(/(\d{2}\/\d{2}\/\d{4})\s*(?:a|à|até|ao?)\s*(\d{2}\/\d{2}\/\d{4})/g)].find(m => rd_dt(m[1]) && rd_dt(m[2]) && rd_dt(m[1]) < rd_dt(m[2]));
  if (per) { c.ini = rd_dataISO(per[1]); c.fim = rd_dataISO(per[2]); }
  const of = T.match(/OF[ÍI]CIO\s+N[ºo°.]?\s*([\d][\d.\/-]*\d)\s*([A-ZÁ-Ú][A-ZÁ-Ú\s\-\/]{2,40}?)(?=\s(?:Macap|Em |De |Ao |A\(o\)|Assunto|$))/i);
  if (of) { c.origem = 'Ofício nº ' + of[1] + ' ' + of[2].trim(); c.orgao = of[2].trim(); }
  const vara = T.match(/\d+ª\s+VARA[^.,\n]{0,60}?(?=\s+(?:DECIS|Autos|Processo|Classe|Executad|Autoridade)|[.,\n]|$)/i); const nucleo = T.match(/N[ÚU]CLEO\s+[A-ZÁ-Ú]+(?:\s*-\s*[A-ZÁ-Ú]+)?/);
  c.destinatario = nucleo ? nucleo[0].trim() + ' / IAPEN' : (vara ? vara[0].trim() : (c.orgao || ''));
  if (vara) c.vara = vara[0].trim();
  const pz = T.match(/prazo de (\d+) \(?\w*\)? ?dias/i); if (pz) c.prazo = pz[1] + ' dias';
  c.assunto = (c.origem ? 'Resposta ao ' + c.origem : 'Resposta a decisão judicial') + (c.nome ? ' – ' + c.nome : '') + (c.processo ? ' – Processo nº ' + c.processo : '');
  // itens: o trecho "para que … informe:" / "Oficie-se" e os números "1-", "2-" …
  let sec = T; const k = T.search(/(?:Oficie-se|para que[^.]{0,80}informe|preste as informa|informe, com os registros|esclare[çc]a)/i); if (k >= 0) sec = T.slice(k);
  const re = /(?:^|\s)(\d{1,2})\s*[-–)\.]\s*(?=[A-ZÁ-Úa-zá-ú])/g; const pos = []; let m;
  while ((m = re.exec(sec))) { const n = +m[1]; if (!pos.length || n === pos[pos.length - 1].n + 1) pos.push({ n, i: m.index + m[0].length }); if (pos.length >= 15) break; }
  pos.forEach((p, i) => { let txt = sec.slice(p.i, i + 1 < pos.length ? pos[i + 1].i - String(pos[i + 1].n).length - 3 : p.i + 600).trim(); txt = txt.replace(/\s*(?:Documento assinado|Validação em|SEEU - Processo).*$/i, '').trim(); if (txt.length > 500) txt = txt.slice(0, 500) + '…';
    const tipo = (_RD_TIPOS.find(([, rx]) => rx.test(txt)) || ['geral'])[0]; c.itens.push({ n: p.n, texto: txt, tipo, responder: !_RD_NAO_CME.test(txt) && tipo !== 'geral' || (!_RD_NAO_CME.test(txt) && /informe|indic|esclare|se é poss|se houve|quais/i.test(txt)) }); });
  return c;
}

/* ── 2. levantar ────────────────────────────────────────────────── */
function rd_lerCampos() {
  const v = id => (document.getElementById(id) || {}).value || '';
  const c = _rd.campos || rd_extrair('');
  c.nome = v('rd-nome').trim().toUpperCase(); c.processo = v('rd-processo').trim(); c.ini = v('rd-ini'); c.fim = v('rd-fim'); c.origem = v('rd-origem').trim(); c.destinatario = v('rd-dest').trim(); c.assunto = v('rd-assunto').trim();
  c.itens.forEach((it, i) => { const t = document.getElementById('rd-it-' + i), ck = document.getElementById('rd-ck-' + i), tp = document.getElementById('rd-tp-' + i); if (t) it.texto = t.value.trim(); if (ck) it.responder = ck.checked; if (tp) it.tipo = tp.value; });
  _rd.campos = c; return c;
}
async function rd_levantar() {
  const c = rd_lerCampos();
  if (!c.nome) { rd_set('Informe o nome do monitorado.', true); return; }
  if (!c.ini || !c.fim) { rd_set('Informe o período (início e fim).', true); return; }
  const dados = { pasta: [], termos: [], tratativas: [], ocCme: [], akiles: null, erros: [] };
  _rd.dados = dados; _rd.blocos = null; rd_render();
  const prog = m => rd_set('Levantando… ' + m);
  // pasta do CME + termos de guarda (série/data) — em paralelo com o robô
  const pPasta = (async () => {
    try {
      const r = await r2_api('GET', '/list?monitorado=' + encodeURIComponent(c.nome)); dados.pasta = r.arquivos || [];
      const termos = dados.pasta.filter(a => /termo|troca|guarda/i.test(a.nome) && /\.pdf$/i.test(a.nome) || /termo de guarda|troca de tnz/i.test(a.nome));
      for (const a of termos.slice(0, 12)) {
        try { const rr = await r2_api('GET', '/download?key=' + encodeURIComponent(a.key)); const buf = await rr.arrayBuffer(); const txt = await rd_pdfTexto(buf, true);
          const serie = (txt.replace(/\s+/g, ' ').match(/n[ºo°]\s*de\s*s[ée]rie\s*0*(\d{4,})/i) || [])[1] || ''; const data = rd_dataExtenso(txt) || ((txt.match(/\d{2}\/\d{2}\/\d{4}/g) || []).pop() || '');
          dados.termos.push({ arquivo: a.nome, serie, data, iso: rd_dataISO(data) }); } catch (e) { dados.erros.push('termo ' + a.nome + ': ' + e.message); }
      }
      dados.termos.sort((x, y) => (x.iso || '').localeCompare(y.iso || ''));
    } catch (e) { dados.erros.push('pasta: ' + e.message); }
  })();
  // tratativas e ocorrências do CME
  try { const n = rd_norm(c.nome); const sc = (getSemCom().monitorados || []).find(m => rd_norm(m.nome) === n); dados.tratativas = ((sc && sc.tratativas) || []).filter(t => { const d = String(t.data || t.ts || '').slice(0, 10); return d >= c.ini && d <= c.fim; });
    dados.ocCme = getOcorrencias().filter(o => rd_norm(o.monitorado) === n && String(o.dataAlerta || '').slice(0, 10) >= c.ini && String(o.dataAlerta || '').slice(0, 10) <= c.fim); } catch (e) { dados.erros.push('CME: ' + e.message); }
  // AKILES pelo robô
  const pRobo = (async () => {
    try { const id = 'E_' + _mpB64url(JSON.stringify({ nome: c.nome, ini: c.ini, fim: c.fim })); const r = await _mpRoboPedido([id], (f, t, fila) => prog(fila ? 'robô na fila…' : 'robô lendo o AKILES (ficha, registros e telemetria)…')); dados.akiles = r[id] || null; if (!dados.akiles) dados.erros.push('o robô não devolveu o levantamento'); else if (!dados.akiles.encontrado) dados.erros.push('AKILES: ' + (dados.akiles.erro || 'não encontrado')); }
    catch (e) { dados.erros.push('robô: ' + e.message); }
  })();
  await Promise.all([pPasta, pRobo]);
  try { auditar({ modulo: 'Relatório', action: 'resposta_decisao_levantar', alvo: c.nome, detalhe: (c.processo || '') + ' · ' + c.ini + ' a ' + c.fim }); } catch (e) {}
  rd_set(dados.erros.length ? 'Levantamento concluído com avisos: ' + dados.erros.join(' · ') : 'Levantamento concluído. Monte a minuta.', dados.erros.length > 0);
  rd_montar();
}

/* ── 3. montar a minuta por item ────────────────────────────────── */
function rd_tab(cab, linhas, cls) { return '<table class="rd-t' + (cls ? ' ' + cls : '') + '"><thead><tr>' + cab.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' + (linhas.length ? linhas.map(l => '<tr>' + l.map(x => '<td>' + x + '</td>').join('') + '</tr>').join('') : '<tr><td colspan="' + cab.length + '" style="text-align:center">— sem registros —</td></tr>') + '</tbody></table>'; }
function rd_ext(v) { return ({ 0: 'zero', 1: 'uma', 2: 'duas', 3: 'três', 4: 'quatro', 5: 'cinco', 6: 'seis', 7: 'sete', 8: 'oito', 9: 'nove', 10: 'dez' })[v] || String(v); }
function rd_pct(v) { return v == null ? '—' : v + '%'; }
function rd_montar() {
  const c = _rd.campos, d = _rd.dados; if (!c || !d) return;
  const ak = d.akiles && d.akiles.encontrado ? d.akiles : null, f = ak ? ak.ficha : null, per = rd_dataBR(c.ini) + ' a ' + rd_dataBR(c.fim);
  const blocos = [];
  // cadeia de equipamentos: termos (série + data) + registros do AKILES que falam de substituição
  const cadeia = d.termos.filter(t => t.serie).map(t => ({ data: t.data, iso: t.iso, serie: t.serie, fonte: 'Termo de Guarda e Responsabilidade de ' + t.data }));
  const regsEq = ak ? [].concat(ak.registros.antes, ak.registros.periodo, ak.registros.depois).filter(r => r.equipamento) : [];
  // registro de substituição/troca: casa com o termo pela série ou pela data (±3 dias) e dá o MOTIVO; sem termo, entra na cadeia mesmo assim
  const dias = (a, b) => Math.abs(new Date(a) - new Date(b)) / 864e5;
  regsEq.filter(r => /SUBSTITUI|TROCA D[OEA]\s*(?:EQUIPAMENTO|TORNOZELEIRA|DISPOSITIVO)|TROCADO|TROCOU/i.test(r.texto)).forEach(r => {
    const m = r.texto.match(/DISPOSITIVO\s*N[ºo°.]?\s*0*(\d{4,})\s*PELO(?:\s*DE)?\s*N[ºo°.]?\s*0*(\d{4,})/i), iso = rd_dataISO(r.data);
    const mot = (r.texto.match(/(?:EM RAZ[ÃA]O D[EAO]|DEVIDO(?:\s+A(?=\s))?|POR APRESENTAR|MOTIVO:?)\s*(.{5,300}?)(?:\.|$)/i) || [])[1] || '';
    let t = m ? cadeia.find(x => String(x.serie).replace(/^0+/, '') === m[2].replace(/^0+/, '')) : null;
    if (!t && iso) t = cadeia.find(x => x.iso && dias(x.iso, iso) <= 3);
    if (t) { if (m) t.anterior = m[1]; if (mot && !t.motivo) t.motivo = mot; t.fonte += '; Registro do AKILES de ' + r.data.slice(0, 16); }
    else cadeia.push({ data: r.data.slice(0, 10), iso, serie: m ? m[2] : '(ver termo de guarda)', anterior: m ? m[1] : '', motivo: mot, fonte: 'Registro do AKILES de ' + r.data.slice(0, 16) });
  });
  cadeia.sort((x, y) => (x.iso || '').localeCompare(y.iso || '')); cadeia.forEach((t, i) => { if (!t.anterior && i > 0) t.anterior = cadeia[i - 1].serie; });
  const noPer = cadeia.filter(t => t.iso >= c.ini && t.iso <= c.fim), antesPer = cadeia.filter(t => t.iso < c.ini), depoisPer = cadeia.filter(t => t.iso > c.fim);
  const emUso = antesPer.length ? antesPer[antesPer.length - 1] : null;
  c.itens.forEach(it => {
    if (!it.responder) return;
    const b = { n: it.n, pergunta: it.texto, tipo: it.tipo, html: '', texto: '' };
    if (it.tipo === 'equipamento') {
      b.html = rd_tab(['Data', 'Equipamento anterior', 'Equipamento instalado', 'Motivo / fonte'], cadeia.map(t => [esc(t.data), esc(t.anterior ? String(t.anterior).padStart(13, '0') : '—'), '<b>' + esc(String(t.serie).padStart(13, '0')) + '</b>', esc((t.motivo ? t.motivo + ' (' : 'Instalação/substituição (') + t.fonte + ')')]));
      b.texto = noPer.length
        ? 'No período de ' + per + ' houve ' + rd_ext(noPer.length) + ' (' + noPer.length + ') substituição(ões) de equipamento: ' + noPer.map(t => 'em ' + t.data + ', do nº de série ' + (t.anterior || '—') + ' para o nº ' + t.serie + (t.motivo ? ', motivo: ' + t.motivo.toLowerCase() : '')).join('; ') + '. O histórico completo dos equipamentos vinculados consta da tabela acima.'
        : 'No período de ' + per + ' o(a) monitorado(a) utilizou um único equipamento' + (emUso ? ', a tornozeleira eletrônica de nº de série ' + String(emUso.serie).padStart(13, '0') + ', instalada em ' + emUso.data : '') + ', não havendo substituição de equipamento dentro do período.' + (depoisPer.length ? ' Registra-se que houve substituição posterior ao período, em ' + depoisPer.map(t => t.data + ' (nº ' + t.serie + (t.motivo ? ' – ' + t.motivo.toLowerCase() : '') + ')').join(', ') + '.' : '') + ' O histórico completo dos equipamentos vinculados consta da tabela acima.';
    } else if (it.tipo === 'registros') {
      const regs = ak ? ak.registros.periodo : [], eq = regs.filter(r => r.equipamento);
      b.html = rd_tab(['Data', 'Tipo', 'Registro', 'Operador'], regs.map(r => [esc(r.data.slice(0, 16)), esc(r.tipo), esc(r.texto), esc(r.operador)])) + (d.tratativas.length ? '<div class="rd-leg">Tratativas registradas no sistema da CME no período</div>' + rd_tab(['Data', 'Servidor', 'Descrição'], d.tratativas.map(t => [esc(String(t.data || t.ts || '').slice(0, 16)), esc(t.servidor || t.usuario || ''), esc(t.descricao || t.texto || '')])) : '');
      b.texto = 'Foram pesquisados os Registros do Sistema AKILES vinculados ao(à) monitorado(a), as tratativas do sistema interno da CME e os documentos de sua pasta. ' + (eq.length ? 'No período constam ' + rd_ext(eq.length) + ' (' + eq.length + ') registro(s) relacionado(s) ao equipamento (reclamação, inspeção, manutenção ou defeito), destacados na tabela acima: ' + eq.map(r => r.data.slice(0, 10) + ' – ' + r.texto.slice(0, 160)).join('; ') + '.' : 'No período de ' + per + ' não consta nenhuma reclamação do(a) monitorado(a) sobre defeito, falha de funcionamento ou problema de carregamento do equipamento, nem inspeção ou manutenção realizada. Os registros existentes no período constam da tabela acima.') + (ak ? ' Registros posteriores ao período relacionados ao equipamento: ' + (ak.registros.depois.filter(r => r.equipamento).map(r => r.data.slice(0, 10) + ' – ' + r.texto.slice(0, 160)).join('; ') || 'nenhum') + '.' : '');
    } else if (it.tipo === 'bateria') {
      const B = ak ? ak.bateria : [], n = B.length;
      const cls = a => a.classe === 'abrupta' ? 'Queda abrupta — a apurar' : a.classe === 'sem' ? 'Sem telemetria suficiente' : 'Descarga progressiva';
      b.html = rd_tab(['Nº', 'Id AKILES', 'Desligamento', 'Restabelecimento', 'Horas sem carga', 'Carga 24 h antes', 'Carga 6 h antes', 'Carga 1 h antes', 'Última leitura', 'Recarregou nas 24 h antes', 'Após restabelecer (1ª → pico)', 'Classificação'],
        B.map((a, i) => [i + 1, esc(a.idOc), esc(a.inicio), esc(a.fim), a.horasSemCarga != null ? a.horasSemCarga : '—', rd_pct(a.pct24h), rd_pct(a.pct6h), rd_pct(a.pct1h), rd_pct(a.ultimaPct), a.carregouAntes24h ? 'Sim' : 'Não', a.primeiraDepoisPct != null ? rd_pct(a.primeiraDepoisPct) + ' → ' + rd_pct(a.picoDepois) : '—', esc(cls(a))]), 'rd-t3');
      const prog = B.filter(a => a.classe === 'progressiva').length, abr = B.filter(a => a.classe === 'abrupta').length, sem = B.filter(a => a.classe === 'sem').length;
      const picos = B.map(a => a.picoAntes).filter(Boolean), taxas = B.filter(a => a.pct6h != null && a.pct1h != null && a.pct6h > a.pct1h).map(a => (a.pct6h - a.pct1h) / 5);
      const ult = B.map(a => a.ultimaPct).filter(v => v != null), rec50 = B.filter(a => (a.picoDepois || 0) >= 50).length, rec80 = B.filter(a => (a.picoDepois || 0) >= 80).length;
      const f1 = v => String(Math.round(v * 10) / 10).replace('.', ',');
      b.texto = n ? 'No período de ' + per + ' constam ' + rd_ext(n) + ' (' + n + ') ocorrência(s) de "Dispositivo desligado por falta de carga na bateria". Para cada uma foi examinada a telemetria do equipamento registrada no Sistema AKILES (tensão e percentual da bateria a cada comunicação). Critério técnico: descarga progressiva (carga cai de forma contínua até o mínimo e, após a recarga, volta a subir) é compatível com ausência de recarga pelo(a) usuário(a); queda abrupta (desliga com carga ≥ 25% ou não volta a carregar) pode indicar falha do equipamento. Resultado: ' + rd_ext(prog) + ' (' + prog + ') com descarga progressiva, ' + rd_ext(abr) + ' (' + abr + ') com queda abrupta e ' + rd_ext(sem) + ' (' + sem + ') sem telemetria suficiente.'
        + (ult.length ? ' A última leitura antes de cada desligamento foi de ' + Math.min(...ult) + '% a ' + Math.max(...ult) + '%.' : '') + (taxas.length ? ' A velocidade de descarga entre a 6ª e a 1ª hora anteriores foi de ' + f1(Math.min(...taxas)) + ' a ' + f1(Math.max(...taxas)) + ' pontos percentuais por hora (média ' + f1(taxas.reduce((s, x) => s + x, 0) / taxas.length) + '), uniforme, correspondente ao consumo normal do equipamento.' : '') + (picos.length ? ' Nas 24 horas anteriores a carga máxima atingida variou de ' + Math.min(...picos) + '% a ' + Math.max(...picos) + '% (média ' + Math.round(picos.reduce((s, x) => s + x, 0) / picos.length) + '%), indicando recargas parciais.' : '') + ' Após o restabelecimento, a bateria ultrapassou 50% em ' + rec50 + ' e 80% em ' + rec80 + ' ocorrência(s), demonstrando que o equipamento aceitava carga normalmente quando conectado ao carregador.'
        + (abr || sem ? ' As ocorrências classificadas como queda abrupta ou sem telemetria suficiente são as que podem guardar relação com falha do equipamento e estão apontadas na tabela.' : ' Assim, não é possível relacionar nenhuma das ocorrências de desligamento do período a falha do equipamento.') + ' Ressalva-se que a CME não dispõe de laudo técnico do fabricante; caso o Juízo entenda necessário, o equipamento poderá ser encaminhado à empresa contratada para perícia.'
        : 'No período de ' + per + ' não consta ocorrência de desligamento por falta de carga na bateria no Sistema AKILES.';
    } else if (it.tipo === 'ocorrencias') {
      const O = ak ? ak.ocorrencias : [], pt = ak ? ak.porTipo : {};
      b.html = rd_tab(['Tipo de ocorrência', 'Quantidade'], Object.entries(pt).map(([t, q]) => [esc(t), q])) + rd_tab(['Id AKILES', 'Tipo', 'Início', 'Fim', 'Duração', 'Situação', 'Atendimento'], O.map(o => [esc(o.idOc), esc(o.tipo), esc(o.inicio), esc(o.fim), esc(o.duracao), esc(o.situacao), esc(o.atendimento)]), 'rd-t3');
      b.texto = 'No período de ' + per + ' o Sistema AKILES registra ' + rd_ext(O.length) + ' (' + O.length + ') ocorrência(s)' + (O.length ? ': ' + Object.entries(pt).map(([t, q]) => q + ' de "' + t + '"').join(', ') : '') + '. O detalhamento consta da tabela acima.';
    } else if (it.tipo === 'situacao') {
      const s = f && f.situacaoAkiles || {};
      b.html = f ? rd_tab(['Campo', 'Informação'], [['Nome', esc(f.nome)], ['Registro no AKILES', esc(f.registro)], ['Situação do cadastro', esc(f.situacaoCadastro || '')], ['Grupo', esc(f.grupo || '')], ['Tipo', esc(f.tipoMonitorado || '')], ['Início da monitoração', esc(f.inicioMonitoracao || '')], ['Término previsto', esc(f.terminoMonitoracao || '')], ['Processos', esc((f.processos || []).map(p => p.processo + ' (' + p.status + ')').join('; '))], ['Última comunicação', esc(s.ultimaComunicacao ? new Date(s.ultimaComunicacao).toLocaleString('pt-BR') : '')], ['Situação atual', esc(s.situacao || '')], ['Bateria (agora)', esc(s.bateria != null ? s.bateria + '%' : '')]]) : '';
      b.texto = f ? 'Conforme o Sistema AKILES, o(a) monitorado(a) ' + f.nome + ' (registro ' + f.registro + ') encontra-se com cadastro ' + String(f.situacaoCadastro || '').toLowerCase() + ', grupo "' + (f.grupo || '') + '", monitoração iniciada em ' + (f.inicioMonitoracao || '—') + '. Situação do equipamento nesta data: ' + (s.situacao || 'não lida') + (s.ultimaComunicacao ? ', última comunicação em ' + new Date(s.ultimaComunicacao).toLocaleString('pt-BR') : '') + '.' : 'Monitorado(a) não localizado(a) no Sistema AKILES.';
    } else { b.html = ''; b.texto = '(Descrever a resposta a este item com base nos dados levantados.)'; }
    blocos.push(b);
  });
  _rd.blocos = blocos; rd_render();
}

/* ── 4. documento (ABNT da CME) ─────────────────────────────────── */
function rd_lerTextos() { (_rd.blocos || []).forEach((b, i) => { const t = document.getElementById('rd-tx-' + i); if (t) b.texto = t.value; }); }
function rd_html(numero) {
  const c = _rd.campos, hoje = new Date();
  const cmeSrc = window._CME_LOGO_B64 ? 'data:image/png;base64,' + window._CME_LOGO_B64 : '', iapenSrc = window._IAPEN_LOGO_B64 ? 'data:image/png;base64,' + window._IAPEN_LOGO_B64 : '';
  const u = usuarioAtual || {}, ass = (typeof _IMPRIMIR_ASSINATURA_NOS_DOCS !== 'undefined' && _IMPRIMIR_ASSINATURA_NOS_DOCS && typeof _assinaturaDoLogado === 'function') ? _assinaturaDoLogado() : '';
  const data = hoje.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const corpo = (_rd.blocos || []).map(b => '<div class="sub">' + esc(b.n + '. ' + b.pergunta) + '</div>' + b.html + '<p>' + esc(b.texto).replace(/\n+/g, '</p><p>') + '</p>').join('');
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Ofício ' + esc(numero || '') + ' — ' + esc(c.nome) + '</title><style>'
    + '@page{size:A4 portrait;margin:3cm 2cm 2.3cm 3cm;@bottom-center{content:"Central de Monitoramento Eletrônico – CME · Av. Machado de Assis, 372 – Centro – CEP 68900-066, Macapá-AP · cme.iapen.ap@gmail.com · (96) 98415-2844 · Página " counter(page) " de " counter(pages);font-family:"Times New Roman",serif;font-size:8pt;color:#000;border-top:1px solid #000}}'
    + 'body{font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.5;color:#000;margin:0}.cab{display:flex;align-items:center;justify-content:space-between;gap:8px}.cab img{width:72px;height:72px;object-fit:contain}.cab .t{flex:1;text-align:center;line-height:1.25}.t1{font-size:10.5pt;font-weight:bold}.t2{font-size:8.5pt}.t3{font-size:11pt;font-weight:bold;margin-top:3px}hr{border:0;border-top:2px solid #000;margin:8px 0 14px}p{margin:0 0 10px;text-align:justify}.dir{text-align:right}'
    + 'table{width:100%;border-collapse:collapse;font-size:9pt;line-height:1.25;margin:6px 0 14px}th,td{border:1px solid #000;padding:3px 5px;vertical-align:middle}th{background:#e6e6e6;font-weight:bold;text-align:center}tr{page-break-inside:avoid}thead{display:table-header-group}table.rd-t3{font-size:7.6pt}table.rd-t3 th{font-size:7.2pt;padding:2px}table.rd-t3 td{padding:2px 3px;text-align:center}.rd-leg{font-size:10pt;font-weight:bold;margin:12px 0 2px}.sub{font-weight:bold;font-size:12pt;margin:16px 0 6px}.ass{text-align:center;margin-top:36px;line-height:1.3;page-break-inside:avoid}'
    + '</style></head><body><div class="cab">' + (cmeSrc ? '<img src="' + cmeSrc + '" alt="CME">' : '') + '<div class="t"><div class="t1">GOVERNO DO ESTADO DO AMAPÁ</div><div class="t2">SECRETARIA DE ESTADO DE JUSTIÇA E SEGURANÇA PÚBLICA</div><div class="t2">INSTITUTO DE ADMINISTRAÇÃO PENITENCIÁRIA DO AMAPÁ</div><div class="t3">CENTRAL DE MONITORAMENTO ELETRÔNICO – CME</div></div>' + (iapenSrc ? '<img src="' + iapenSrc + '" alt="IAPEN">' : '') + '</div><hr>'
    + '<p><b>Ofício nº ' + esc(numero || '____/' + hoje.getFullYear()) + ' – CME/IAPEN</b></p><p class="dir">Macapá-AP, ' + esc(data) + '.</p>'
    + '<p>' + esc(c.destinatario || '').replace(/\n/g, '<br>') + (c.processo ? '<br>Para juntada aos autos do Processo nº ' + esc(c.processo) + (c.vara ? ' – ' + esc(c.vara) : '') : '') + '</p>'
    + '<p><b>Assunto:</b> ' + esc(c.assunto) + '</p><p>Senhor(a),</p>'
    + '<p>Cumprimentando-o(a) cordialmente, em atenção ao ' + esc(c.origem || 'expediente em referência') + ', a Central de Monitoramento Eletrônico – CME/IAPEN presta, com base nos registros do Sistema AKILES AP e dos documentos arquivados na pasta do(a) monitorado(a) <b>' + esc(c.nome) + '</b>' + (c.processo ? ' (Processo nº ' + esc(c.processo) + ')' : '') + ', as informações solicitadas, referentes ao período de ' + esc(rd_dataBR(c.ini)) + ' a ' + esc(rd_dataBR(c.fim)) + '.</p>'
    + corpo
    + '<p>As informações acima foram extraídas do Sistema AKILES AP (ficha, registros, ocorrências e telemetria) e da pasta do(a) monitorado(a) em ' + esc(data) + '. Esta Central permanece à disposição para os esclarecimentos que se fizerem necessários.</p><p>Atenciosamente,</p>'
    + '<div class="ass">' + (ass ? '<img src="' + ass + '" style="max-height:80px;max-width:220px;display:block;margin:0 auto 2px">' : '') + '<b>' + esc(String(u.nome || '').toUpperCase()) + '</b><br>' + esc(u.cargo || '') + (u.decreto ? '<br>' + esc(u.decreto) : '') + '<br>Central de Monitoramento Eletrônico – CME/IAPEN</div></body></html>';
}
function rd_previa() { rd_lerCampos(); rd_lerTextos(); const w = window.open('', '_blank'); if (!w) { _mostrarToast('Libere o pop-up para ver a prévia.', 'erro'); return; } w.document.write(rd_html('')); w.document.close(); }
async function rd_gerar() {
  rd_lerCampos(); rd_lerTextos(); const c = _rd.campos; if (!(_rd.blocos || []).length) { rd_set('Monte a minuta antes de gerar.', true); return; }
  const ano = new Date().getFullYear(); let numero = 0;
  try {
    try { const { data, error } = await _dbLerChave('cme_oficios'); if (!error && data && data.value && Array.isArray(data.value.registros)) _cache['oficios'] = data.value; } catch (e) {}
    const r = await r2_api('POST', '/oficio/reservar', { 'Content-Type': 'application/json' }, JSON.stringify({ ano, minimo: com_proximoNumero(ano), sessao: typeof _comSessaoId !== 'undefined' ? _comSessaoId : '' }));
    numero = parseInt(r && r.numero); if (!numero) throw new Error((r && r.error) || 'resposta inválida');
  } catch (e) { alert('Não consegui reservar o número na central de números (' + (e.message || e) + ').\n\nO ofício NÃO foi gerado, para não repetir número.'); return; }
  const num = numero + '/' + ano, u = usuarioAtual || {};
  await com_registrarOficio({ numero, ano, data: new Date().toISOString().slice(0, 10), monitorado: c.nome, processo: c.processo, destinatario: c.destinatario, comarca: '', vara: c.vara || '', modelo: 'resposta-decisao', assunto: c.assunto, signatario: String(u.nome || '').toUpperCase(), cargo: u.cargo || '', decreto: u.decreto || '', signatarioUsuario: u.usuario || '', geradoPor: u.nome || '?', geradoEm: new Date().toISOString(), campos: { itens: _rd.blocos.map(b => ({ n: b.n, pergunta: b.pergunta, texto: b.texto })) } });
  try { auditar({ modulo: 'Relatório', action: 'resposta_decisao_gerar', alvo: c.nome, detalhe: 'Ofício ' + num + ' · ' + (c.processo || '') }); } catch (e) {}
  const html = rd_html(num), w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 800); }
  else _entregarDoc(new Blob([html], { type: 'text/html' }), 'Oficio ' + numero + '-' + ano + ' ' + c.nome + '.html');
  rd_set('Ofício nº ' + num + ' gerado e registrado em Consultar Ofícios. Imprima em PDF e anexe na pasta do(a) monitorado(a).');
  _mostrarToast('Ofício nº ' + num + ' gerado e registrado.', 'sucesso');
}

/* ── tela ───────────────────────────────────────────────────────── */
function rd_render() {
  const el = document.getElementById('rel-panel-resposta'); if (!el) return;
  const c = _rd.campos, d = _rd.dados, B = _rd.blocos;
  const campo = (lbl, html) => '<div class="form-field"><label>' + lbl + '</label>' + html + '</div>';
  const inp = (id, v, ph, type) => '<input type="' + (type || 'text') + '" id="' + id + '" value="' + esc(v || '') + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + '>';
  let h = '<div class="idv-barra" style="margin-top:12px"><div class="idv-achado">Jogue o ofício ou a decisão (PDF ou foto); o sistema lê o pedido, levanta no AKILES e na pasta e monta a minuta.</div><div class="idv-acoes"><label class="idv-btn criar" style="cursor:pointer">Ler documento<input type="file" accept=".pdf,image/*" style="display:none" onchange="rd_ler(this)"></label></div></div>'
    + '<div id="rd-status" class="idv-mini" style="margin:6px 0 12px">' + esc(_rd.status) + '</div>';
  if (c) {
    h += '<div class="idv-bloco"><div class="idv-bloco-cab"><span>O que foi pedido</span></div><div class="idv-bloco-corpo"><div class="form-grid">'
      + campo('Monitorado(a)', inp('rd-nome', c.nome, 'NOME COMPLETO', 'text')) + campo('Processo', inp('rd-processo', c.processo)) + campo('Período — início', inp('rd-ini', c.ini, '', 'date')) + campo('Período — fim', inp('rd-fim', c.fim, '', 'date'))
      + campo('Expediente de origem', inp('rd-origem', c.origem)) + campo('Destinatário', inp('rd-dest', c.destinatario)) + '</div>' + campo('Assunto', inp('rd-assunto', c.assunto))
      + '<div class="idv-secao" style="margin:12px 0 4px">Itens a responder</div>'
      + (c.itens.length ? c.itens.map((it, i) => '<div style="display:flex;gap:8px;align-items:flex-start;margin:4px 0"><input type="checkbox" id="rd-ck-' + i + '"' + (it.responder ? ' checked' : '') + ' title="Responder este item"><b style="width:24px">' + it.n + '.</b><textarea id="rd-it-' + i + '" rows="2" style="flex:1">' + esc(it.texto) + '</textarea><select id="rd-tp-' + i + '" class="idv-select" title="Como responder">' + [['equipamento', 'Equipamento / troca'], ['registros', 'Reclamações / inspeções'], ['bateria', 'Desligamentos × falha'], ['ocorrencias', 'Ocorrências do período'], ['situacao', 'Situação do monitoramento'], ['geral', 'Texto livre']].map(([v, r]) => '<option value="' + v + '"' + (it.tipo === v ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></div>').join('') : '<div class="idv-vazio">Nenhum item numerado encontrado — acrescente à mão.</div>')
      + '<div class="idv-acoes" style="margin-top:8px"><button type="button" class="idv-btn" onclick="rd_addItem()">+ Item</button><button type="button" class="idv-btn criar" onclick="rd_levantar()">Levantar no AKILES e na pasta</button></div></div></div>';
  }
  if (d) {
    const ak = d.akiles && d.akiles.encontrado ? d.akiles : null;
    h += '<div class="idv-bloco" style="margin-top:12px"><div class="idv-bloco-cab"><span>Levantado</span></div><div class="idv-bloco-corpo idv-mini">'
      + 'Pasta: ' + d.pasta.length + ' arquivo(s), ' + d.termos.length + ' termo(s) de guarda lido(s)' + (d.termos.length ? ' (' + d.termos.map(t => (t.serie || '?') + ' em ' + (t.data || '?')).join('; ') + ')' : '') + ' · CME: ' + d.tratativas.length + ' tratativa(s), ' + d.ocCme.length + ' ocorrência(s)'
      + ' · AKILES: ' + (ak ? ak.ocorrencias.length + ' ocorrência(s) no período, registros ' + ak.registros.antes.length + '/' + ak.registros.periodo.length + '/' + ak.registros.depois.length + ' (antes/período/depois), telemetria de ' + ak.bateria.length + ' desligamento(s)' : (d.akiles === null ? 'aguardando/sem resposta' : 'não encontrado'))
      + (d.erros.length ? '<div style="color:var(--idv-cr);margin-top:4px">Avisos: ' + esc(d.erros.join(' · ')) + '</div>' : '') + '</div></div>';
  }
  if (B) {
    h += '<div class="idv-bloco" style="margin-top:12px"><div class="idv-bloco-cab"><span>Minuta da resposta — confira e ajuste o texto de cada item</span></div><div class="idv-bloco-corpo">'
      + B.map((b, i) => '<div class="idv-secao" style="margin:10px 0 4px">' + esc(b.n + '. ' + b.pergunta) + '</div><div class="table-scroll" style="max-height:260px">' + b.html + '</div><textarea id="rd-tx-' + i + '" rows="6" style="width:100%;margin-top:6px">' + esc(b.texto) + '</textarea>').join('')
      + '<div class="idv-acoes" style="margin-top:10px"><button type="button" class="idv-btn" onclick="rd_montar()">Remontar textos</button><button type="button" class="idv-btn" onclick="rd_previa()">Prévia</button><button type="button" class="idv-btn criar" onclick="rd_gerar()">Gerar PDF (reserva o nº do ofício)</button></div></div></div>';
  }
  el.innerHTML = h;
}
function rd_addItem() { rd_lerCampos(); const c = _rd.campos; c.itens.push({ n: c.itens.length + 1, texto: '', tipo: 'geral', responder: true }); rd_render(); }
