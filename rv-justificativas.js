/* ═══════════════════ GERADOR DE VIOLAÇÕES — CRUZAMENTO COM AS JUSTIFICATIVAS DO CME ═══════════════════
   Pedido de 16/10/2026: ao gerar o relatório de violações (Gerador, planilha ou automático pela ocorrência),
   cruzar cada violação com as justificativas que já existem no CME e avisar o servidor no ato.
   • Onde procura: a pasta do monitorado em Arquivos (R2) — toda a subpasta "Justificativa" + atestados, declarações,
     autorizações, termos de troca e de audiência das outras subpastas (menos Relatório e Recibos) — e os
     atendimentos de "Justificativa" da Triagem.
   • A data vem do NOME do arquivo (o upload da pasta Justificativa grava "[DD-MM-AAAA] ...") e, quando o nome não
     tem data, do TEXTO do documento (pdf.js; escaneado → OCR local, com nota de qualidade). Sem IA: só datas e horas.
   • "Compatível" = o documento cobre o dia da violação (e o horário, se o texto tiver) → sai do relatório por padrão.
     "Possível" = dia vizinho, horário que não bate, documento sem data enviado logo depois, atendimento na Triagem
     → o relatório NÃO sai até o servidor decidir. Toda decisão vai para o registro de atividades.
   Só LÊ as pastas (nada é gravado nelas). Depende de rv_* (index.html), r2_api, _secCarregarPdfJs, _comOcrCanvas.
   Emojis só por \u{...}. Prefixo rvj_ / _rvj. */

/* ───────────────────────── funções puras (testadas em scratchpad/teste_rvj.js) ───────────────────────── */
const _RVJ_MESES = { JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6, JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12 };
const _RVJ_MAX_DIAS_INTERVALO = 62;  // "02 A 12-04-2026": intervalos maiores que isso são descartados (leitura errada)
const _RVJ_TOL_MIN = 60;             // tolerância entre o horário do documento e o da violação
const _RVJ_HORA_SOLTA_MIN = 120;     // "atendido às 14:30" cobre de 12:30 a 16:30
const _RVJ_DIAS_ENTREGA = 5;         // documento sem data enviado / atendimento até 5 dias depois da violação = possível

function _rvjNorm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(); }
function _rvjZ(n) { return String(n).padStart(2, '0'); }
function _rvjIso(a, m, d) { return a + '-' + _rvjZ(m) + '-' + _rvjZ(d); }
function _rvjAno(a) { a = +a; return a < 100 ? 2000 + a : a; }
function _rvjValida(d, m, a) {
  if (a < 2015 || a > 2035 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(a, m, 0).getDate();
}
function _rvjSomaDias(iso, n) { const [a, m, d] = iso.split('-').map(Number); const t = new Date(a, m - 1, d + n); return _rvjIso(t.getFullYear(), t.getMonth() + 1, t.getDate()); }
function _rvjDifDias(a, b) { const p = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); }; return Math.round((p(b) - p(a)) / 864e5); }

// Datas (dias, ISO) e horários (minutos do dia) citados num texto. Não usa hora do NOME (no WhatsApp é a hora da foto).
// Entende 12/03/2026, 12.03.26, 12-03-2026, [12-03-2026], "12 de março de 2026", "02 A 12-04-2026", "27-09 A 15-10-2025",
// "19 E 20/10/23". Ignora pedaços de número de processo (0001234-56.2023.8.03.0001).
function rvj_datasDoTexto(texto, op) {
  op = op || {};
  let s = _rvjNorm(texto).replace(/\u00BA|\u00AA/g, '')
    .replace(/\bAT\s+\d{1,2}[.:]\d{2}(?:[.:]\d{2})?/g, ' '); // "WhatsApp Image ... at 14.05.26" é hora, não data
  const dias = new Set(), horas = [];
  const add = (d, m, a) => { if (_rvjValida(d, m, a)) { dias.add(_rvjIso(a, m, d)); return true; } return false; };
  // 0) ISO: 2026-03-12
  s = s.replace(/(?<![\d.\/-])(\d{4})-(\d{2})-(\d{2})(?![\d])/g, (tudo, a, m, d) => add(+d, +m, +a) ? ' ' : tudo);
  const ND = '(?<![\\d.\\/-])', FIM = '(?![\\d]|[.\\/-]\\d)';
  // 1) intervalos e listas: "02 A 12-04-2026", "27-09 A 15-10-2025", "19 E 20/10/23"
  const reInt = new RegExp(ND + '(\\d{1,2})(?:[.\\/-](\\d{1,2}))?\\s*(A|ATE|AO|E)\\s*(\\d{1,2})[.\\/-](\\d{1,2})[.\\/-](\\d{2,4})' + FIM, 'g');
  s = s.replace(reInt, (tudo, d1, m1, sep, d2, m2, a) => {
    const ano = _rvjAno(a), mes1 = m1 ? +m1 : +m2;
    if (!_rvjValida(+d1, mes1, ano) || !_rvjValida(+d2, +m2, ano)) return tudo;
    const ini = _rvjIso(ano, mes1, +d1), fim = _rvjIso(ano, +m2, +d2);
    if (sep === 'E') { dias.add(ini); dias.add(fim); return ' '; }
    const n = _rvjDifDias(ini, fim);
    if (n < 0 || n > _RVJ_MAX_DIAS_INTERVALO) return tudo;
    for (let i = 0; i <= n; i++) dias.add(_rvjSomaDias(ini, i));
    return ' ';
  });
  // 2) por extenso: "12 de março de 2026"
  s = s.replace(/(?<!\d)(\d{1,2})\s*(?:O\s*)?DE\s+(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s+(?:DE\s+)?(\d{4})(?!\d)/g,
    (tudo, d, mes, a) => add(+d, _RVJ_MESES[mes], +a) ? ' ' : tudo);
  // 3) numérica: 12/03/2026, 12.03.26, 12-03-2026
  s = s.replace(new RegExp(ND + '(\\d{1,2})\\s?[.\\/-]\\s?(\\d{1,2})\\s?[.\\/-]\\s?(\\d{4}|\\d{2})' + FIM, 'g'),
    (tudo, d, m, a) => add(+d, +m, _rvjAno(a)) ? ' ' : tudo);
  if (op.horas) {
    const T = '(\\d{1,2})\\s*(?::|H(?![A-Z]))\\s*(\\d{2})?\\s*(?:MIN|H)?(?![A-Z])';
    const min = (h, m) => (+h <= 23 && +(m || 0) <= 59) ? +h * 60 + +(m || 0) : null;
    s = s.replace(new RegExp('(?<![\\d:])' + T + '\\s*(?:AS|ATE|A|-|\u2013)\\s*' + T + '(?![\\d])', 'g'), (tudo, h1, m1, h2, m2) => {
      const a = min(h1, m1), b = min(h2, m2);
      if (a == null || b == null || b <= a) return tudo;
      horas.push([a, b]); return ' ';
    });
    s.replace(new RegExp('(?<![\\d:])' + T + '(?![\\d])', 'g'), (tudo, h, m) => {
      const a = min(h, m); if (a != null) horas.push([Math.max(0, a - _RVJ_HORA_SOLTA_MIN), Math.min(1440, a + _RVJ_HORA_SOLTA_MIN)]);
      return tudo;
    });
  }
  return { dias: [...dias].sort(), horas };
}

// Datas cobertas pelo NOME do arquivo. "15.02.26 - JUSTIFICATIVA REF 15.02.26": a data antes de "REF" é a da entrega,
// a de depois é a do fato — vale só a de depois.
function rvj_datasDoNome(nome) {
  const s = _rvjNorm(nome).replace(/\.[A-Z0-9]{2,5}$/, '');
  const ref = s.search(/\bREF(ERENTE)?\b\.?/);
  const alvo = ref >= 0 && rvj_datasDoTexto(s.slice(ref)).dias.length ? s.slice(ref) : s;
  return rvj_datasDoTexto(alvo).dias;
}

// Que tipo de documento é, pelo nome e pela subpasta. null = não serve como justificativa.
const _RVJ_TIPOS = [
  ['troca',        /\bTROCA\b|SUBSTITUICAO DE (DISPOSITIVO|TORNOZELEIRA|EQUIPAMENTO)/],
  ['continua',     /DECLARAC?A?O?\w*\s+(DE\s+)?(TRABALHO|EMPREGO|MATRICULA|ESCOLAR|VINCULO|FREQUENCIA ESCOLAR)|AUTORIZ\w*\s+(PROVISORIA|(DE\s+|PARA\s+)?TRABALH|(DE\s+|PARA\s+)?ESTUD)|CONTRATO DE TRABALHO|CARTEIRA DE TRABALHO/],
  ['atestado',     /ATESTAD|LAUDO|INTERNAC|HOSPITAL|\bUBS\b|\bUPA\b|CONSULTA|EXAME|RECEITU|MEDIC|ODONTO/],
  ['audiencia',    /AUDIENCIA|COMPARECIMENTO|FORUM|INTIMAC|PERICIA|DELEGACIA|DEPOIMENTO/],
  ['autorizacao',  /AUTORIZ|DESLOCAMENTO|VIAGEM|COMUNICAC\w* (PREVIA|DE (VIAGEM|DESLOC|SAIDA))/],
  ['declaracao',   /DECLARA/],
  ['justificativa', /JUSTIFIC|FOLHA DE PONTO/],
];
const _RVJ_ROTULO = { troca: 'termo de troca', continua: 'autorização/declaração contínua', atestado: 'atestado/documento médico',
  audiencia: 'comparecimento/audiência', autorizacao: 'autorização/comunicação de deslocamento', declaracao: 'declaração', justificativa: 'justificativa' };
function rvj_classificarDoc(nome, pasta) {
  const p = _rvjNorm(pasta);
  if (/RELATORIO|RECIBO/.test(p)) return null;
  const n = _rvjNorm(nome);
  const t = (_RVJ_TIPOS.find(([, re]) => re.test(n)) || [])[0] || null;
  if (/JUSTIFICATIVA/.test(p)) return t || 'justificativa';
  return t;
}
// termo de troca explica bateria/sem comunicação/rompimento, não saída de zona
function _rvjServePara(tipoDoc, tipoViol) { return tipoDoc === 'troca' ? !/zona/i.test(tipoViol || '') : tipoDoc !== 'continua'; }

function _rvjParseBR(s) {
  const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)) : null;
}
function _rvjDurMin(s) {
  s = String(s || '');
  const g = re => +((s.match(re) || [0, 0])[1]);
  return g(/(\d+)\s*d/) * 1440 + g(/(\d+)\s*h/) * 60 + g(/(\d+)\s*min/);
}
// Período da violação: início → fim (Data Final, ou início + duração). null se a data não pôde ser lida.
function rvj_periodoViolacao(v) {
  const ini = _rvjParseBR(v.ocorreu); if (!ini) return null;
  let fim = _rvjParseBR(v.fim);
  if (!fim || fim < ini) fim = new Date(ini.getTime() + Math.max(1, _rvjDurMin(v.duracao)) * 60000);
  const isoDe = d => _rvjIso(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const diaIni = isoDe(ini), diaFim = isoDe(fim), dias = [];
  for (let i = 0, n = Math.min(_rvjDifDias(diaIni, diaFim), 31); i <= n; i++) dias.push(_rvjSomaDias(diaIni, i));
  return { ini, fim, dias, diaIni, diaFim, minIni: ini.getHours() * 60 + ini.getMinutes(), minFim: fim.getHours() * 60 + fim.getMinutes() };
}

// Uma violação × um documento/registro.
// ev = { tipoDoc, dias:[iso], horas:[[a,b]], fonte:'nome'|'texto'|'entrega', entrega:iso|null, qualidade:n|null }
// → { nivel:'compativel'|'possivel', motivo } ou null
function rvj_casar(v, ev) {
  if (!_rvjServePara(ev.tipoDoc, v.tipo)) return null;
  const p = rvj_periodoViolacao(v); if (!p) return null;
  const fmt = iso => iso.split('-').reverse().join('/');
  if (ev.fonte !== 'entrega' && ev.dias.length) {
    const comuns = ev.dias.filter(d => p.dias.includes(d));
    if (comuns.length) {
      const leituraFraca = ev.fonte === 'texto' && typeof ev.qualidade === 'number' && ev.qualidade < 75;
      if (ev.horas && ev.horas.length) {
        const bate = comuns.some(d => {
          const ini = d === p.diaIni ? p.minIni : 0, fim = d === p.diaFim ? p.minFim : 1440;
          return ev.horas.some(([a, b]) => a - _RVJ_TOL_MIN <= fim && b + _RVJ_TOL_MIN >= ini);
        });
        if (!bate) return { nivel: 'possivel', motivo: 'o documento é do mesmo dia (' + fmt(comuns[0]) + '), mas o horário dele não bate com o da violação' };
      }
      if (leituraFraca) return { nivel: 'possivel', motivo: 'a data ' + fmt(comuns[0]) + ' foi lida no texto com dificuldade (qualidade ' + ev.qualidade + '%)' };
      if (ev.fraco) return { nivel: 'possivel', motivo: 'data ' + fmt(comuns[0]) + ', mas ' + ev.fraco };
      if (p.fim - p.ini > 864e5 && comuns.length < p.dias.length) return { nivel: 'possivel', motivo: 'a violação durou ' + p.dias.length + ' dias e o documento cobre só ' + comuns.length + ' (' + fmt(comuns[0]) + ')' };
      return { nivel: 'compativel', motivo: 'o documento cobre o dia da violação (' + fmt(comuns[0]) + ')' + (ev.fonte === 'texto' ? ' — data lida no texto' : '') };
    }
    const viz = ev.dias.find(d => p.dias.some(x => Math.abs(_rvjDifDias(x, d)) === 1));
    if (viz) return { nivel: 'possivel', motivo: 'o documento é do dia ' + (_rvjDifDias(p.diaIni, viz) < 0 ? 'anterior' : 'seguinte') + ' (' + fmt(viz) + ')' };
    return null;
  }
  if (ev.entrega) {
    const n = _rvjDifDias(p.diaIni, ev.entrega);
    if (n >= 0 && n <= _RVJ_DIAS_ENTREGA) return { nivel: 'possivel', motivo: 'sem data do fato; registrado/enviado em ' + fmt(ev.entrega) + ', ' + (n ? n + ' dia(s) depois da violação' : 'no mesmo dia da violação') };
  }
  return null;
}

// Nome parecido (pasta "JORGE ALCINO" × AKILES "JORGE ALCINDO"): parcela de palavras que batem (igual ou 1 letra de diferença).
function _rvjLev1(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 4) return false;
  let i = 0, j = 0, dif = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++dif > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return dif + (a.length - i) + (b.length - j) <= 1;
}
function rvj_semelhancaNome(a, b) {
  const ta = _rvjNorm(a).split(/[^A-Z0-9]+/).filter(Boolean), tb = _rvjNorm(b).split(/[^A-Z0-9]+/).filter(Boolean);
  if (!ta.length || !tb.length || ta[0] !== tb[0]) return 0;
  const usados = new Set(); let ok = 0;
  ta.forEach(x => { const k = tb.findIndex((y, i) => !usados.has(i) && _rvjLev1(x, y)); if (k >= 0) { usados.add(k); ok++; } });
  return ok / Math.max(ta.length, tb.length);
}

if (typeof module !== 'undefined') module.exports = { rvj_datasDoTexto, rvj_datasDoNome, rvj_classificarDoc, rvj_periodoViolacao, rvj_casar, rvj_semelhancaNome };

/* ───────────────────────── busca no CME (pastas + Triagem) ───────────────────────── */
let _rvj_decisoes = {};     // { idOc: { acao:'retirar'|'manter', motivo } } — lembradas enquanto a página estiver aberta
let _rvj_textoCache = {};   // { key: { dias, horas, qualidade } } — a key do R2 muda a cada envio; leitura com erro não fica guardada
let _rvj_parar = false, _rvj_rodada = 0;
const _RVJ_PRAZO_MS = 30000, _RVJ_PRAZO_LEITURA_MS = 120000;
// nenhuma chamada pode prender a tela para sempre
function _rvjComPrazo(prom, ms, oque) { let t; return Promise.race([prom, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(oque + ' demorou demais')), ms); })]).finally(() => clearTimeout(t)); }
// OCR um de cada vez: a nota de qualidade (_comOcrUltimaConfianca) é global
let _rvjFilaOcr = Promise.resolve();
const _RVJ_LER_POR_MONITORADO = 4, _RVJ_LER_TOTAL = 16;  // leitura de conteúdo (lenta): só os sem data no nome

// pasta lida de novo a cada geração (a justificativa pode ter acabado de ser enviada); cache só dentro da rodada
async function _rvjPasta(nome, cache) {
  if (cache[nome]) return cache[nome];
  const out = { nomePasta: nome, arquivos: [], erro: '' };
  const api = path => _rvjComPrazo(r2_api('GET', path), _RVJ_PRAZO_MS, 'a pasta');
  try {
    out.arquivos = (await api('/list?monitorado=' + encodeURIComponent(nome))).arquivos || [];
    if (!out.arquivos.length) {
      // a pasta pode estar com o nome um pouco diferente do AKILES
      const primeiro = _rvjNorm(nome).split(/\s+/)[0];
      const lista = (await api('/monitorados?busca=' + encodeURIComponent(primeiro) + '&limite=500')).monitorados || [];
      const notas = lista.map(m => [m.nome, rvj_semelhancaNome(nome, m.nome)]).filter(x => x[1] >= 0.8).sort((a, b) => b[1] - a[1]);
      if (notas.length && (notas.length === 1 || notas[0][1] > notas[1][1])) {
        out.nomePasta = notas[0][0];
        out.arquivos = (await api('/list?monitorado=' + encodeURIComponent(out.nomePasta))).arquivos || [];
      }
    }
  } catch (e) { out.erro = e.message || String(e); }
  cache[nome] = out;
  return out;
}

// texto de um arquivo da pasta (só as primeiras páginas) → datas e horários. Mesma leitura da Agenda/Comunicação.
async function _rvjLerConteudo(arq) {
  if (_rvj_textoCache[arq.key]) return _rvj_textoCache[arq.key];
  const r = { dias: [], horas: [], qualidade: null, ocrSemNota: false, erro: '' };
  try { await _rvjComPrazo(_rvjLer(arq, r), _RVJ_PRAZO_LEITURA_MS, 'a leitura'); } catch (e) { r.erro = e.message || String(e); }
  if (!r.erro) _rvj_textoCache[arq.key] = r;
  return r;
}
async function _rvjLer(arq, r) {
  {
    const blob = await (await _rvjComPrazo(r2_api('GET', '/download?key=' + encodeURIComponent(arq.key)), _RVJ_PRAZO_MS, 'o download')).blob();
    const ext = String(arq.nome || arq.key).split('.').pop().toLowerCase(), notas = [];
    // a nota é lida logo depois de CADA OCR, com os OCRs em fila; sem nota (caiu no modelo de visão) = leitura fraca
    const ocr = canvas => (_rvjFilaOcr = _rvjFilaOcr.catch(() => {}).then(async () => {
      if (!canvas) return '';
      const t = await _comOcrCanvas(canvas);
      if (typeof _comOcrUltimaConfianca === 'number') notas.push(_comOcrUltimaConfianca); else r.ocrSemNota = true;
      return t;
    }));
    let texto = '';
    if (ext === 'pdf') {
      const pdfjs = await _secCarregarPdfJs(), buf = await blob.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: buf.slice(0) }).promise, jpegs = _secJpegsEmOrdem(new Uint8Array(buf));
      for (let p = 1, ocrs = 0; p <= Math.min(pdf.numPages, 3); p++) {
        const page = await pdf.getPage(p), txt = (await page.getTextContent()).items.map(i => i.str).join(' ');
        if (txt.replace(/\s/g, '').length >= 40) { texto += '\n' + txt; continue; }
        if (ocrs++ >= 2) break;
        const jpg = jpegs.length === pdf.numPages ? jpegs[p - 1] : null;
        texto += '\n' + await ocr(jpg ? await _comJpegParaCanvas(jpg, 2000) : await _secRenderPagina(page));
      }
    } else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      const bmp = await createImageBitmap(blob), c = _comBitmapParaCanvas(bmp, 1600); if (bmp.close) bmp.close();
      texto = await ocr(c);
    } else if (ext === 'docx') {
      await _carregarScriptSE('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js', 'mammoth');
      texto = ((await mammoth.extractRawText({ arrayBuffer: await blob.arrayBuffer() })) || {}).value || '';
    } else if (ext === 'txt') texto = await blob.text();
    else r.erro = 'formato não lido';
    const d = rvj_datasDoTexto(texto, { horas: true });
    r.dias = d.dias; r.horas = d.horas; r.qualidade = notas.length ? Math.min(...notas) : null;
    if (!r.erro && !texto.trim()) r.erro = 'não deu para ler o texto';
  }
}

function _rvjIsoDeTs(s) { const d = s ? new Date(s) : null; return d && !isNaN(d) ? _rvjIso(d.getFullYear(), d.getMonth() + 1, d.getDate()) : null; }

// evidências de UM monitorado: documentos da pasta + atendimentos de Justificativa da Triagem
async function _rvjEvidencias(grupo, orcamento, progresso) {
  const nome = grupo[0].nome, pasta = await _rvjPasta(nome, orcamento.pastas), avisos = [], evs = [], continuas = [];
  if (pasta.erro) avisos.push('não consegui abrir a pasta de ' + nome + ' (' + pasta.erro + ') — confira à mão');
  else if (!pasta.arquivos.length) avisos.push(nome + ': nenhuma pasta com esse nome em Arquivos');
  else if (pasta.nomePasta !== nome) avisos.push(nome + ': conferida a pasta "' + pasta.nomePasta + '" (nome parecido)');
  grupo.filter(v => !rvj_periodoViolacao(v)).forEach(v => avisos.push(nome + ': a violação ' + (v.idOc || '') + ' tem data ilegível ("' + (v.ocorreu || '') + '") — não deu para cruzar, confira à mão'));
  const periodos = grupo.map(rvj_periodoViolacao).filter(Boolean);
  const ini = periodos.length ? periodos.map(p => p.diaIni).sort()[0] : null, fim = periodos.length ? periodos.map(p => p.diaFim).sort().pop() : null;
  const semData = [];
  const vistos = new Set(); // a pasta pode ter o mesmo arquivo enviado várias vezes (visto na prática: 5 cópias)
  pasta.arquivos.forEach(a => {
    if (!a.nome || a.nome === '.keep') return; // marcador de pasta criada
    const chave = _rvjNorm(a.pasta) + '|' + _rvjNorm(a.nome);
    if (vistos.has(chave)) return; vistos.add(chave);
    const tipoDoc = rvj_classificarDoc(a.nome, a.pasta); if (!tipoDoc) return;
    const base = { origem: 'pasta', key: a.key, nome: a.nome, pasta: a.pasta, tipoDoc, entrega: _rvjIsoDeTs(a.enviado),
      fraco: /PROCESSO/.test(_rvjNorm(a.pasta)) ? 'é peça da pasta Processo (pode ser só a data da intimação/ata)' : '' };
    const dias = rvj_datasDoNome(a.nome);
    if (dias.length) { evs.push(Object.assign(base, { dias, horas: [], fonte: 'nome' })); return; }
    if (tipoDoc === 'continua') { continuas.push(a); return; }
    semData.push(base);
  });
  // sem data no nome: lê o conteúdo dos mais próximos do período (a leitura é lenta), o resto fica pela data de envio
  const perto = b => (b.entrega && ini) ? Math.min(Math.abs(_rvjDifDias(ini, b.entrega)), Math.abs(_rvjDifDias(fim, b.entrega))) : 999;
  semData.sort((a, b) => perto(a) - perto(b));
  let lidos = 0;
  for (const b of semData) {
    const caberia = lidos < _RVJ_LER_POR_MONITORADO && perto(b) <= 45;
    if (caberia && (_rvj_parar || orcamento.n <= 0)) orcamento.naoLidos++;
    if (caberia && !_rvj_parar && orcamento.n > 0) {
      lidos++; orcamento.n--;
      if (progresso) progresso('lendo "' + b.nome + '" de ' + nome);
      const t = await _rvjLerConteudo({ key: b.key, nome: b.nome });
      if (t.erro) avisos.push('"' + b.nome + '" (' + nome + '): ' + t.erro + ' — confira à mão');
      if (t.dias.length) { evs.push(Object.assign(b, { dias: t.dias, horas: t.horas, fonte: 'texto', qualidade: t.qualidade, fraco: b.fraco || (t.ocrSemNota ? 'foi lida por OCR sem nota de qualidade' : '') })); continue; }
    }
    evs.push(Object.assign(b, { dias: [], horas: [], fonte: 'entrega' }));
  }
  // Triagem: atendimentos de Justificativa do mesmo monitorado
  const atend = (typeof getTriagem === 'function' ? (getTriagem().atendimentos || []) : [])
    .filter(x => x.tipo === 'Justificativa' && rvj_semelhancaNome(nome, x.nome) >= 0.8);
  atend.forEach(x => {
    const d = rvj_datasDoTexto(x.obs || '', { horas: true });
    evs.push({ origem: 'triagem', nome: 'Atendimento de Justificativa na Triagem (' + String(x.data || '').split('-').reverse().join('/') + ')',
      obs: x.obs || '', tipoDoc: 'justificativa', dias: d.dias, horas: d.horas, fonte: d.dias.length ? 'texto' : 'entrega', entrega: x.data || null });
  });
  return { nome, avisos, evs, continuas };
}

// resultado por violação: [{ v, achados:[{ev, nivel, motivo}], nivel }]
function _rvjCruzarGrupo(grupo, base) {
  return grupo.map(v => {
    const achados = base.evs.map(ev => { const r = rvj_casar(v, ev); return r ? Object.assign({ ev }, r) : null; }).filter(Boolean)
      .sort((a, b) => (a.nivel === 'compativel' ? 0 : 1) - (b.nivel === 'compativel' ? 0 : 1));
    return { v, achados, nivel: achados.length ? achados[0].nivel : null };
  }).filter(x => x.achados.length);
}

/* ───────────────────────── tela: antes de gerar ───────────────────────── */
// Chamada por rv_gerarSelecionados: cruza, mostra o que achou e só então gera (com as violações retiradas fora).
async function rvj_antesDeGerar(modo, selecionados) {
  if (!(typeof _r2Pronto === 'function' && _r2Pronto())) {
    if (!confirm('Sem conexão com Arquivos: não dá para cruzar as violações com as justificativas da pasta do monitorado.\n\nGerar o relatório mesmo assim, sem o cruzamento?')) return;
    addLog('Relatório de violações gerado SEM o cruzamento de justificativas (sem conexão com Arquivos) (' + (usuarioAtual?.nome || '') + ')', { action: 'rv-justificativa', modulo: 'Relatório' });
    return rv_gerarSelecionados(modo, selecionados);
  }
  _rvj_parar = false;
  const rodada = ++_rvj_rodada, ov = _rvjOverlay();
  const prog = msg => { const el = document.getElementById('rvj-prog'); if (el) el.textContent = msg; };
  ov.innerHTML = '<div style="background:var(--idv-cartao);border:1px solid var(--idv-borda);border-radius:8px;max-width:460px;width:100%;padding:18px 20px;box-shadow:0 8px 24px rgba(31,35,40,.18);font-size:14px;color:var(--idv-texto)">'
    + '<div style="font-weight:600;font-size:16px;color:var(--idv-texto);margin-bottom:6px">\u{1F4CE} Conferindo justificativas no CME…</div>'
    + '<div id="rvj-prog" style="color:var(--idv-sec);min-height:2.4em">Abrindo as pastas dos monitorados…</div>'
    + '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px"><button type="button" id="rvj-cancelar" class="idv-btn mini">Cancelar</button><button type="button" id="rvj-parar" class="idv-btn mini">Pular a leitura dos documentos</button></div></div>';
  document.getElementById('rvj-cancelar').onclick = () => { _rvj_rodada++; _rvj_parar = true; ov.remove(); _mostrarToast('Geração cancelada — nenhum relatório foi gerado.'); };
  document.getElementById('rvj-parar').onclick = () => { _rvj_parar = true; prog('Pulando a leitura dos documentos — conferindo só os nomes e as datas de envio…'); };
  const orcamento = { n: _RVJ_LER_TOTAL, naoLidos: 0, pastas: {} }, res = [];
  let feitos = 0;
  const fila = selecionados.map((g, i) => ({ g, i }));
  const trabalhar = async () => {
    for (let it; (it = fila.shift());) {
      const base = await _rvjEvidencias(it.g, orcamento, m => prog((feitos + 1) + '/' + selecionados.length + ' — ' + m + '…'));
      res[it.i] = { grupo: it.g, base, itens: _rvjCruzarGrupo(it.g, base) };
      prog(++feitos + '/' + selecionados.length + ' monitorado(s) conferido(s)…');
    }
  };
  try {
    await Promise.all([0, 1, 2].map(trabalhar));
    if (rodada !== _rvj_rodada) return; // cancelada
    return _rvjFinalizar(ov, modo, selecionados, res, orcamento);
  } catch (e) {
    if (rodada !== _rvj_rodada) return;
    ov.remove(); console.error('[CME] cruzamento de justificativas:', e);
    if (!confirm('Não consegui terminar o cruzamento com as justificativas (' + (e.message || e) + ').\n\nGerar o relatório mesmo assim, sem o cruzamento?')) return;
    addLog('Relatório de violações gerado SEM o cruzamento de justificativas (erro: ' + (e.message || e) + ') (' + (usuarioAtual?.nome || '') + ')', { action: 'rv-justificativa', modulo: 'Relatório' });
    return rv_gerarSelecionados(modo, selecionados);
  }
}
function _rvjFinalizar(ov, modo, selecionados, res, orcamento) {
  const comAchado = res.filter(r => r.itens.length), avisos = res.flatMap(r => r.base.avisos);
  if (orcamento.naoLidos) avisos.push(orcamento.naoLidos + ' documento(s) sem data no nome não foram lidos (' + (_rvj_parar ? 'leitura pulada' : 'limite de ' + _RVJ_LER_TOTAL + ' leituras por relatório') + ') — entraram só pela data de envio');
  if (!comAchado.length && !avisos.length) {
    ov.remove();
    _mostrarToast('\u{2705} Cruzamento feito: nenhuma justificativa no CME para estas violações.', 'sucesso');
    return rv_gerarSelecionados(modo, selecionados);
  }
  _rvjMostrarDecisao(ov, modo, res, avisos);
}

function _rvjOverlay() {
  let ov = document.getElementById('rvj-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'rvj-modal'; ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9990;display:flex;align-items:center;justify-content:center;padding:16px'; document.body.appendChild(ov); }
  return ov;
}

function _rvjHtmlAchado(a) {
  const ev = a.ev, fmt = iso => iso.split('-').reverse().join('/');
  const onde = ev.origem === 'triagem' ? 'Triagem' : 'pasta ' + esc(ev.pasta || '');
  const datas = ev.dias.length ? (ev.dias.length > 3 ? fmt(ev.dias[0]) + ' a ' + fmt(ev.dias[ev.dias.length - 1]) : ev.dias.map(fmt).join(', ')) : '';
  const titulo = ev.key
    ? '<a href="#" onclick="r2_visualizarArquivo(\'' + _jsq(ev.key) + '\',\'' + _jsq(ev.nome) + '\');return false" style="color:var(--idv-in);font-weight:600">' + esc(ev.nome) + '</a>'
    : '<b>' + esc(ev.nome) + '</b>' + (ev.obs ? ' — <i>' + esc(String(ev.obs).slice(0, 160)) + '</i>' : '');
  return '<li style="margin:2px 0">' + (a.nivel === 'compativel' ? '\u{1F7E5}' : '\u{1F7E8}') + ' ' + titulo
    + ' <span style="color:var(--idv-sec)">(' + onde + ' · ' + esc(_RVJ_ROTULO[ev.tipoDoc] || ev.tipoDoc) + (datas ? ' · ' + datas : '') + ')</span>'
    + '<div style="color:var(--idv-sec);font-size:12px">' + esc(a.motivo) + '</div></li>';
}

function _rvjMostrarDecisao(ov, modo, res, avisos) {
  const itens = []; // cada violação da tela, na ordem — o data-k do bloco aponta para cá
  const blocos = res.filter(r => r.itens.length).map(r => {
    const g0 = r.grupo[0];
    const linhas = r.itens.map(it => {
      const k = itens.push(Object.assign({ nome: g0.nome }, it)) - 1;
      const id = String(it.v.idOc || ''), dec = (id && _rvj_decisoes[id]) || (it.nivel === 'compativel' ? { acao: 'retirar', motivo: '' } : null);
      const forte = it.nivel === 'compativel';
      return '<div class="rvj-item" data-k="' + k + '" data-nivel="' + it.nivel + '" style="border:1px solid var(--idv-borda);border-left:3px solid ' + (forte ? 'var(--idv-cr)' : 'var(--idv-at)') + ';background:var(--idv-cartao);border-radius:6px;padding:8px 12px;margin:6px 0">'
        + '<div style="font-weight:600;color:' + (forte ? 'var(--idv-cr)' : 'var(--idv-at)') + '">' + (forte ? '\u{26D4} Possui justificativa compatível na pasta — não enviar' : '\u{26A0}\u{FE0F} Possível justificativa — decida antes de enviar') + '</div>'
        + '<div style="font-size:13px;color:var(--idv-texto);margin:2px 0">' + esc(it.v.tipo) + ' · ID <span class="idv-mono">' + esc(id) + '</span> · <span class="idv-data">' + esc(it.v.ocorreu) + '</span>' + (it.v.duracao ? ' · ' + esc(it.v.duracao) : '') + '</div>'
        + '<ul style="margin:4px 0 6px 0;padding-left:16px;list-style:none;font-size:13px">' + it.achados.slice(0, 4).map(_rvjHtmlAchado).join('') + (it.achados.length > 4 ? '<li style="color:var(--idv-sec)">… e mais ' + (it.achados.length - 4) + '</li>' : '') + '</ul>'
        + '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;font-size:13px">'
        + '<label style="cursor:pointer"><input type="radio" name="rvj-' + k + '" value="retirar"' + (dec && dec.acao === 'retirar' ? ' checked' : '') + ' onchange="_rvjAtualizar()"> Retirar do relatório</label>'
        + '<label style="cursor:pointer"><input type="radio" name="rvj-' + k + '" value="manter"' + (dec && dec.acao === 'manter' ? ' checked' : '') + ' onchange="_rvjAtualizar()"> Manter (a justificativa não se aplica)</label>'
        + '<input type="text" class="rvj-motivo" placeholder="Por que manter? (obrigatório)" value="' + esc(dec && dec.motivo || '') + '" oninput="_rvjAtualizar()" style="flex:1;min-width:180px;padding:4px 8px;border:1px solid var(--idv-borda);border-radius:6px;font-size:13px;display:' + (dec && dec.acao === 'manter' ? '' : 'none') + '">'
        + '</div></div>';
    }).join('');
    return '<div style="margin-bottom:12px"><div class="idv-nome">' + esc(g0.nome) + ' <span class="idv-mono" style="color:var(--idv-sec);font-weight:400;font-size:12px">' + esc(g0.processo) + '</span></div>' + linhas + '</div>';
  }).join('');
  const continuas = res.filter(r => r.base.continuas.length);
  const htmlAvisos = (avisos.length || continuas.length) ? '<div style="border:1px solid var(--idv-borda);background:var(--idv-fundo);border-left:3px solid var(--idv-sec);border-radius:6px;padding:8px 12px;margin-top:6px;font-size:13px;color:var(--idv-texto)">'
    + '<div style="font-weight:600;margin-bottom:2px">\u{2139}\u{FE0F} Confira também</div><ul style="margin:0;padding-left:18px">'
    + avisos.map(a => '<li>' + esc(a) + '</li>').join('')
    + continuas.map(r => '<li>' + esc(r.grupo[0].nome) + ' tem autorização/declaração contínua (trabalho, estudo) na pasta: '
      + r.base.continuas.slice(0, 3).map(a => '<a href="#" onclick="r2_visualizarArquivo(\'' + _jsq(a.key) + '\',\'' + _jsq(a.nome) + '\');return false" style="color:var(--idv-in)">' + esc(a.nome) + '</a>').join(', ')
      + ' — veja se o horário dela cobre alguma violação.</li>').join('')
    + '</ul></div>' : '';
  ov.innerHTML = '<div style="background:var(--idv-cartao);border:1px solid var(--idv-borda);border-radius:8px;max-width:760px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 8px 24px rgba(31,35,40,.18);font-size:14px;color:var(--idv-texto)">'
    + '<div style="padding:14px 18px 10px;border-bottom:1px solid var(--idv-borda)"><div style="font-weight:600;font-size:16px;color:var(--idv-texto)">\u{1F4CE} Cruzamento com as justificativas do CME</div>'
    + '<div style="color:var(--idv-sec);font-size:13px;margin-top:2px">Conferimos as pastas dos monitorados em Arquivos e os atendimentos de Justificativa da Triagem. Violação com justificativa não vai ao Judiciário sem a sua decisão: as <b>compatíveis</b> já estão marcadas para sair; as <b>possíveis</b> precisam que você escolha.</div></div>'
    + '<div style="padding:8px 18px;overflow-y:auto;flex:1">' + (blocos || '<div style="color:var(--idv-ok);font-weight:600;margin:6px 0">\u{2705} Nenhuma justificativa encontrada para estas violações.</div>') + htmlAvisos + '</div>'
    + '<div style="padding:10px 18px;border-top:1px solid var(--idv-linha);display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap">'
    + '<span id="rvj-contagem" style="flex:1;font-size:13px;color:var(--idv-sec)"></span>'
    + '<button type="button" class="idv-btn mini" onclick="document.getElementById(\'rvj-modal\').remove()">Cancelar</button>'
    + '<button type="button" id="rvj-ok" class="idv-btn mini criar">Gerar relatório</button></div></div>';
  document.getElementById('rvj-ok').onclick = () => _rvjConfirmar(modo, res, itens);
  _rvjAtualizar();
}

function _rvjLerDecisoes() {
  return [...document.querySelectorAll('#rvj-modal .rvj-item')].map(el => {
    const r = el.querySelector('input[type=radio]:checked'), m = el.querySelector('.rvj-motivo');
    if (m) m.style.display = r && r.value === 'manter' ? '' : 'none';
    return { k: +el.dataset.k, nivel: el.dataset.nivel, acao: r ? r.value : null, motivo: m ? m.value.trim() : '' };
  });
}
function _rvjAtualizar() {
  const ds = _rvjLerDecisoes(), pend = ds.filter(d => !d.acao || (d.acao === 'manter' && !d.motivo)).length;
  const sai = ds.filter(d => d.acao === 'retirar').length, fica = ds.filter(d => d.acao === 'manter' && d.motivo).length;
  const c = document.getElementById('rvj-contagem'), ok = document.getElementById('rvj-ok');
  if (c) c.textContent = sai + ' a retirar · ' + fica + ' mantida(s)' + (pend ? ' · ' + pend + ' sem decisão' : '');
  if (ok) { ok.disabled = !!pend; ok.style.opacity = pend ? '.5' : ''; ok.style.cursor = pend ? 'not-allowed' : 'pointer'; ok.title = pend ? 'Decida todas as violações (e diga por que manter) antes de gerar' : ''; }
}

function _rvjConfirmar(modo, res, itens) {
  const ds = _rvjLerDecisoes();
  if (ds.some(d => !d.acao || (d.acao === 'manter' && !d.motivo))) { _mostrarToast('Decida todas as violações antes de gerar.', 'erro'); return; }
  const retirar = new Set(), quem = usuarioAtual?.nome || '', frases = [];
  ds.forEach(d => {
    const it = itens[d.k], id = String(it.v.idOc || '');
    if (d.acao === 'retirar') retirar.add(it.v);
    if (id) _rvj_decisoes[id] = { acao: d.acao, motivo: d.motivo };
    const frase = (d.acao === 'retirar' ? 'RETIROU' : 'MANTEVE') + ' a violação ' + (id || it.v.ocorreu) + ' de ' + it.nome + ' — ' + (d.nivel === 'compativel' ? 'justificativa compatível' : 'possível justificativa') + ': ' + it.achados[0].ev.nome + (d.acao === 'manter' ? ' — motivo: ' + d.motivo : '');
    frases.push(frase);
    // cada decisão vai separada para a auditoria (D1)
    if (typeof auditar === 'function') auditar({ action: 'rv-justificativa', modulo: 'Relatório', alvo: 'Violação ' + (id || it.v.ocorreu), monitorado: it.nome, detalhe: frase });
  });
  // UMA linha só no registro de atividades: duas gravações seguidas do addLog se apagam (lê → acrescenta → grava)
  if (frases.length && typeof addLog === 'function') addLog('Relatório de violações (cruzamento de justificativas): ' + frases.join(' | ') + ' (' + quem + ')', { action: 'rv-justificativa-resumo', modulo: 'Relatório' });
  const grupos = res.map(r => r.grupo.filter(v => !retirar.has(v)));
  const vazios = res.filter((r, i) => !grupos[i].length).map(r => r.grupo[0].nome);
  document.getElementById('rvj-modal').remove();
  if (vazios.length) _mostrarToast('Sem violações a enviar (todas retiradas): ' + vazios.join(', ') + '. Esse(s) relatório(s) não foi(ram) gerado(s).', 'sucesso');
  const restantes = grupos.filter(g => g.length);
  if (restantes.length) rv_gerarSelecionados(modo, restantes);
}
