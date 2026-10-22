/* ═══ Conferência pelo HORÁRIO da decisão judicial (prefixo rvch_) ══════════════════
   Pedido do Adriano (22/10/2026): toda saída de zona de INCLUSÃO é conferida contra o horário
   de recolhimento que a decisão judicial da pasta fixa. Regra da CME: SÁBADO conta como
   DOMINGO (recolhimento integral); se a decisão não citar o sábado, a conferência avisa.
   Leitura do texto: a mesma do cruzamento de justificativas (_rvjPasta / _rvjLerConteudo:
   texto do PDF ou OCR local, sem IA). As funções puras são testadas em node. */

const RVCH_DECISAO = /DECIS|ALVAR|SENTEN|ACORDAO|MEDIDAS? PROTETIVA|\bMPU\b|TERMO DE AUDI|MANDADO|DESPACHO|PRORROGA|PROGRESS|REGRESS|CONCESS|HARMONIZ|DOMICILIAR|^\d{6,}\.PDF$/;
const RVCH_FORA = /RECIBO|OFICIO|OFCIO|RELATORIO|COMPROVANTE|DECLARA|ATESTADO|JUSTIFICATIVA|\bRG\b|CNH|CTPS|FOTO|^\[TERMO-/;
const RVCH_MAX_DOCS = 4;   // decisões lidas por monitorado (mais recentes primeiro)

function _rvchNorm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[\u{300}-\u{36f}]/gu, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
const _RVCH_MESES = { JANEIRO: 1, FEVEREIRO: 2, MARCO: 3, ABRIL: 4, MAIO: 5, JUNHO: 6, JULHO: 7, AGOSTO: 8, SETEMBRO: 9, OUTUBRO: 10, NOVEMBRO: 11, DEZEMBRO: 12 };

/* Lê do texto da decisão o regime de recolhimento. Devolve null se não achar nada. */
function rvch_regraDoTexto(texto) {
  const T = _rvchNorm(texto);
  if (!T) return null;
  // trechos da condição de recolhimento: um em volta de CADA menção (no PDF do SEEU a condição
  // pode vir depois de tabelas intercaladas no meio do texto)
  const janelas = [];
  for (const m of T.matchAll(/RECOLH|PERMANECER EM (SUA )?RESIDENCIA|PERIODO INTEGRAL|TEMPO INTEGRAL/g)) janelas.push(T.slice(Math.max(0, m.index - 60), m.index + 420));
  if (!janelas.length) return null;
  const trecho = janelas.join(' … ');
  const r = { integral: false, noturno: null, domingosFeriados: false, sabado: false, sabadoCitado: /SABADO/.test(trecho), trecho: '' };
  // "período integral" / "em tempo integral" / "recolhimento integral" (NÃO "integralmente aos domingos")
  if (/RECOLHER-SE[^.;]{0,80}(PERIODO|TEMPO) INTEGRAL|RECOLHIMENTO (DOMICILIAR )?(EM PERIODO |EM TEMPO )?INTEGRAL(?!MENTE)(?! (AOS|NOS|EM) )|PRISAO DOMICILIAR (EM )?(PERIODO|TEMPO) INTEGRAL/.test(trecho)) r.integral = true;
  const m = trecho.match(/(?:ENTRE|DAS?)\s*(\d{1,2})\s*(?:[:H]\s*(\d{2}))?\s*(?:H(?:ORAS?)?|MIN)?\s*(?:E|AS|A|ATE)\s*(?:AS\s*)?(\d{1,2})\s*(?:[:H]\s*(\d{2}))?\s*H/);
  if (m) {
    const a = +m[1] * 60 + +(m[2] || 0), b = +m[3] * 60 + +(m[4] || 0);
    if (a <= 1440 && b <= 1440 && a !== b) r.noturno = { de: a, ate: b };
  }
  if (/INTEGRAL(MENTE)?[^.;]{0,40}DOMINGOS|DOMINGOS E FERIADOS|DOMINGOS, FERIADOS|FINAIS? DE SEMANA|FINS? DE SEMANA|SABADOS,? DOMINGOS/.test(trecho)) r.domingosFeriados = true;
  if (/SABADO/.test(trecho) && (r.domingosFeriados || /INTEGRAL/.test(trecho))) r.sabado = true;
  if (/FINAIS? DE SEMANA|FINS? DE SEMANA/.test(trecho)) { r.sabado = true; r.sabadoCitado = true; }
  if (!r.integral && !r.noturno && !r.domingosFeriados) return null;
  r.trecho = trecho.slice(0, 260);
  return r;
}

// Data da decisão: assinatura digital "em dd/mm/aaaa" ou "Macapá, 3 de novembro de 2025"
function rvch_dataDoTexto(texto) {
  const T = _rvchNorm(texto);
  let m = T.match(/ASSINADO DIGITALMENTE[^0-9]{0,120}EM (\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return m[3] + '-' + m[2] + '-' + m[1];
  m = T.match(/\b(\d{1,2}) DE (JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO) DE (\d{4})/);
  if (m) return m[3] + '-' + String(_RVCH_MESES[m[2]]).padStart(2, '0') + '-' + String(+m[1]).padStart(2, '0');
  return null;
}
function rvch_prazoDias(texto) { const m = _rvchNorm(texto).match(/PELO PRAZO DE (\d{1,4})\s*\(?/); return m ? +m[1] : null; }

function _rvchDescrever(r) {
  if (r.integral) return 'recolhimento em período integral';
  const hh = x => String(Math.floor(x / 60)).padStart(2, '0') + 'h' + (x % 60 ? String(x % 60).padStart(2, '0') : '');
  const p = [];
  if (r.noturno) p.push('recolhimento das ' + hh(r.noturno.de) + ' às ' + hh(r.noturno.ate) + ' nos dias úteis');
  if (r.domingosFeriados) p.push('integral aos ' + (r.sabadoCitado ? 'sábados, ' : '') + 'domingos e feriados');
  return p.join(' e ');
}

// O monitorado era obrigado a estar em casa nesse instante? (regra da CME: sábado = domingo)
function rvch_emRecolhimento(d, r) {
  if (r.integral) return true;
  const fer = typeof rvc_feriados === 'function' ? rvc_feriados(d.getFullYear())[d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()] : null;
  const dow = d.getDay(), fimSemana = dow === 0 || dow === 6;
  if ((fimSemana || fer) && r.domingosFeriados) return true;
  if (r.noturno) {
    const t = d.getHours() * 60 + d.getMinutes(), { de, ate } = r.noturno;
    return de > ate ? (t >= de || t < ate) : (t >= de && t < ate);
  }
  return false;
}

/* Confere UMA violação de zona de inclusão contra as decisões lidas da pasta.
   decs = [{ nome, data:'AAAA-MM-DD'|null, prazo:dias|null, regra }] (só as que têm regra). */
function rvch_conferir(v, decs) {
  const ini = typeof rvc_data === 'function' ? rvc_data(v.ocorreu) : null;
  if (!ini || !decs || !decs.length) return [];
  const durMin = typeof rvc_duracaoMin === 'function' ? rvc_duracaoMin(v.duracao) : null;
  const fimD = (typeof rvc_data === 'function' && rvc_data(v.fim)) || (durMin != null ? new Date(ini.getTime() + durMin * 60000) : ini);
  const isoV = ini.getFullYear() + '-' + String(ini.getMonth() + 1).padStart(2, '0') + '-' + String(ini.getDate()).padStart(2, '0');
  // decisão em vigor: a mais recente com data até o dia da violação (sem data = a mais recente lida)
  const ord = decs.slice().sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
  const dec = ord.find(d => d.data && d.data <= isoV) || ord[0];
  const out = [], fmt = iso => iso ? iso.split('-').reverse().join('/') : '';
  const fonte = '"' + dec.nome + '"' + (dec.data ? ' (' + fmt(dec.data) + ')' : '');
  // passa o período em passos de 5 min (no máximo 3 dias) e conta o que caiu no horário de recolhimento
  const fim = new Date(Math.min(fimD.getTime(), ini.getTime() + 3 * 864e5));
  let dentro = 0, total = 0, primeira = null;
  for (let t = ini.getTime(); t <= fim.getTime(); t += 300000) { total++; const d = new Date(t); if (rvch_emRecolhimento(d, dec.regra)) { dentro++; if (!primeira) primeira = d; } }
  const hm = d => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  const regraTxt = _rvchDescrever(dec.regra);
  if (!dentro) out.push({ nivel: 'trava', codigo: 'horario-fora', texto: 'Pela decisão ' + fonte + ' (' + regraTxt + '), nesse dia e horário ele NÃO era obrigado a estar em casa — a saída não é violação pela decisão. Confira a agenda da zona no AKILES.' });
  else if (dentro < total) out.push({ nivel: 'aviso', codigo: 'horario-parcial', texto: 'Só parte da saída cai no horário de recolhimento da decisão ' + fonte + ' (' + regraTxt + '): a obrigação começa às ' + hm(primeira) + '.' });
  else out.push({ nivel: 'ok', codigo: 'horario-ok', texto: 'Horário confere com a decisão ' + fonte + ': ' + regraTxt + '.' });
  const dow = ini.getDay();
  if (dow === 6 && !dec.regra.integral && !dec.regra.sabadoCitado) out.push({ nivel: 'aviso', codigo: 'sabado-nao-citado', texto: 'A decisão não cita o sábado; pela regra da CME o sábado conta como domingo (recolhimento integral).' });
  if (dec.data && dec.prazo) {
    const venc = new Date(dec.data + 'T00:00:00'); venc.setDate(venc.getDate() + dec.prazo);
    if (ini > venc) out.push({ nivel: 'aviso', codigo: 'decisao-vencida', texto: 'A decisão ' + fonte + ' valia por ' + dec.prazo + ' dias (até ' + venc.toLocaleDateString('pt-BR') + '); não há decisão mais nova na pasta — confira a prorrogação.' });
  }
  return out;
}

if (typeof module !== 'undefined' && module.exports) module.exports = { rvch_regraDoTexto, rvch_dataDoTexto, rvch_prazoDias, rvch_emRecolhimento, rvch_conferir };

/* ───────── leitura das decisões da pasta (navegador) ───────── */
// Para cada grupo com violação de zona de inclusão: lista a pasta, lê as decisões (mais recentes primeiro)
// e devolve { nomeDoMonitorado: { decs: [...], avisos: [...] } }.
async function rvch_lerDecisoes(grupos, progresso) {
  const out = {}, cache = {};
  if (typeof _rvjPasta !== 'function' || typeof _rvjLerConteudo !== 'function') return out;
  for (const g of grupos) {
    if (!g.some(v => /INCLUS/.test(_rvchNorm(v.tipo)))) continue;
    const nome = g[0].nome, r = out[nome] = { decs: [], avisos: [] };
    if (progresso) progresso('Lendo as decisões judiciais de ' + nome + '…');
    const pasta = await _rvjPasta(nome, cache);
    if (pasta.erro) { r.avisos.push('Não consegui abrir a pasta para conferir o horário da decisão (' + pasta.erro + ').'); continue; }
    const vistos = new Set();
    const cands = (pasta.arquivos || []).filter(a => {
      const n = _rvchNorm(String(a.nome || '').replace(/^\[DECISAO-[^\]]*\]\s*/i, 'DECISAO '));
      if (!RVCH_DECISAO.test(n) || RVCH_FORA.test(n) || /\.KEEP$/.test(n)) return false;
      const k = a.nome + '|' + a.tamanho; if (vistos.has(k)) return false; vistos.add(k); return true;
    }).sort((a, b) => String(b.enviado || '').localeCompare(String(a.enviado || ''))).slice(0, RVCH_MAX_DOCS);
    if (!cands.length) { r.avisos.push('Sem decisão judicial na pasta para conferir o horário de recolhimento.'); continue; }
    for (const a of cands) {
      const lido = await _rvjLerConteudo(a);
      const regra = lido && lido.texto ? rvch_regraDoTexto(lido.texto) : null;
      if (regra) r.decs.push({ nome: String(a.nome).replace(/^\[[^\]]+\]\s*/, ''), data: rvch_dataDoTexto(lido.texto), prazo: rvch_prazoDias(lido.texto), regra, qualidade: lido.qualidade });
    }
    if (!r.decs.length) r.avisos.push('Não consegui ler o horário de recolhimento nas decisões da pasta (' + cands.map(a => a.nome).slice(0, 2).join(', ') + ') — confira à mão.');
  }
  return out;
}
