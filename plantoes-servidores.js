/* ═══════════════════════════ DESEMPENHO DOS PLANTÕES — SERVIDORES (INDIVIDUAL) ═══════════════════════════
   Visão "Servidores" do Desempenho dos Plantões: o trabalho de cada servidor no período, SEM NOTA e
   sem ranking (decisão da gerência em 13/10/2026 — funções diferentes: monitoramento × instalação),
   sempre comparado com a média da própria equipe. Clique no nome → ficha com a evolução por plantão.
   • Equipe: a da Secretaria (folha de ponto) quando o nome casa; senão, a equipe em que mais trabalhou.
   • Só Gerência e Administração (a sub-aba já é restrita; os dados cme_plantao_* também).
   Depende do index (_plDia, _plDiasDe, _plDataBR, PLANTAO_CORES, pl_servidor) e de plantoes-resumo.js.
   Emojis só por \u{...}. Prefixo _pls. */

let _plsEquipe = '';
const _PLS_EQUIPES = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO'];

function _plsNorm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
// nome do AKILES → servidor da Secretaria (nome igual, ou mesmo 1º e último nome)
function _plsServidorSecretaria(nomeAk) {
  let lista = [];
  try { const s = carregarStore('secretaria', null); lista = (s && Array.isArray(s.servidores)) ? s.servidores : []; } catch (e) { return null; }
  const a = _plsNorm(nomeAk); if (!a) return null;
  const pa = a.split(' ');
  return lista.find(s => _plsNorm(s.nome) === a)
    || lista.find(s => { const pb = _plsNorm(s.nome).split(' '); return pb.length > 1 && pa.length > 1 && pb[0] === pa[0] && pb[pb.length - 1] === pa[pa.length - 1]; })
    || null;
}
function _plsMediana(v) { if (!v.length) return null; const s = v.slice().sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); }

// soma tudo de cada servidor no período (só plantões completos)
function _plsAgregar(d, nd) {
  const lim = _isoLocal(new Date(Date.now() - nd * 864e5));
  const dias = Object.keys(d.turnos || {}).concat(Object.keys(d.expediente || {})).filter((x, i, a) => a.indexOf(x) === i).filter(dd => dd >= lim).sort();
  const ag = {};
  const novo = op => ag[op] = ag[op] || { op, plantoes: [], porEq: {}, n: 0, pop: 0, popOk: 0, vd: 0, vdP: 0, vdDec: 0, vdDecOk: 0, vdDecMeds: [], meds: [], conf: 0, nconf: 0, inst: 0, desinst: 0, sms: 0, registro: 0, sens: 0 };
  dias.forEach(dd => {
    const x = _plDia(d, dd); if (x.parcial) return;
    const pend = {}; ((x.vd && x.vd.pendencias) || []).forEach(p => { if (p.op) pend[p.op] = (pend[p.op] || 0) + 1; });
    const ops = new Set(Object.keys(x.servidores || {}).concat(Object.keys(x.porOp || {})));
    ops.forEach(op => {
      const sv = (x.servidores || {})[op] || {}, o = (x.porOp || {})[op] || {};
      const algo = sv.n || Object.values(o).some(n => n); if (!algo) return;
      const a = novo(op);
      a.plantoes.push({ dia: dd, eq: x.equipe, n: sv.n || 0, pct: sv.pop ? Math.round(sv.popOk / sv.pop * 100) : null, med: sv.med, vd: sv.vd || 0, vdP: pend[op] || 0, vdDec: sv.vdDec || 0, vdDecOk: sv.vdDecOk || 0,
        inst: (o.instalacao || 0) + (o.desinstalacao || 0), conf: (o.confirmadas || 0) + (o.naoConfirmadas || 0), sens: x.sens.filter(s => s.op === op).length });
      a.porEq[x.equipe] = (a.porEq[x.equipe] || 0) + 1;
      a.n += sv.n || 0; a.pop += sv.pop || 0; a.popOk += sv.popOk || 0; a.vd += sv.vd || 0; a.vdP += pend[op] || 0; if (sv.med != null) a.meds.push(sv.med);
      a.vdDec += sv.vdDec || 0; a.vdDecOk += sv.vdDecOk || 0; if (sv.vdDecMed != null) a.vdDecMeds.push(sv.vdDecMed);
      a.conf += o.confirmadas || 0; a.nconf += o.naoConfirmadas || 0; a.inst += o.instalacao || 0; a.desinst += o.desinstalacao || 0; a.sms += (o.sms || 0) + (o.alerta || 0); a.registro += o.registro || 0;
      a.sens += x.sens.filter(s => s.op === op).length;
    });
  });
  return Object.values(ag).map(a => {
    const nomeAk = ((d.operadores || {})[a.op] || {}).nome || ('operador ' + a.op), sec = _plsServidorSecretaria(nomeAk);
    const eqMais = Object.entries(a.porEq).sort((x, y) => y[1] - x[1])[0];
    // equipe = SÓ a da folha de ponto (Secretaria). Quem não está na folha fica "fora da lista" (não chuta).
    const equipe = sec && sec.equipe ? sec.equipe : '';
    const funcao = a.n === 0 && a.inst + a.desinst ? 'Instalação' : (a.inst + a.desinst) > a.n ? 'Instalação e monitoramento' : 'Monitoramento';
    const proprios = a.plantoes.filter(p => !equipe || equipe === 'EXPEDIENTE' || p.eq === equipe).length;
    return Object.assign(a, { nome: sec ? sec.nome : nomeAk, secId: sec ? sec.id : null, equipe, equipeRobo: eqMais ? eqMais[0] : '', funcao,
      nPl: proprios || a.plantoes.length, nOutros: a.plantoes.length - proprios, pct: a.pop ? Math.round(a.popOk / a.pop * 100) : null, med: _plsMediana(a.meds), vdDecMed: _plsMediana(a.vdDecMeds) });
  });
}
function _plsMediaEquipe(lista, eq) {
  const xs = lista.filter(l => l.equipe === eq && l.n > 0);
  const pop = xs.reduce((s, l) => s + l.pop, 0), ok = xs.reduce((s, l) => s + l.popOk, 0);
  return { pct: pop ? Math.round(ok / pop * 100) : null, med: _plsMediana(xs.map(l => l.med).filter(v => v != null)), nPorPl: xs.length ? xs.reduce((s, l) => s + l.n / Math.max(1, l.nPl), 0) / xs.length : null };
}
// comparação com a equipe em palavras
function _plsComp(v, ref, maiorMelhor, fmt) {
  if (v == null || ref == null) return '';
  const dif = v - ref, igual = Math.abs(dif) <= (maiorMelhor === 'pct' ? 3 : Math.max(5, ref * 0.15));
  if (igual) return '<div style="font-size:12px;color:var(--idv-sec)">igual à equipe (' + fmt(ref) + ')</div>';
  const bom = maiorMelhor === 'menor' ? dif < 0 : dif > 0;
  return '<div style="font-size:12px;color:' + (bom ? 'var(--idv-ok)' : 'var(--idv-cr)') + '">' + (dif > 0 ? '\u{2191}' : '\u{2193}') + ' equipe: ' + fmt(ref) + '</div>';
}

function _plsRender(d, nd) {
  const box = document.getElementById('pls-corpo'); if (!box) return;
  const todos = _plsAgregar(d, nd);
  const medias = {}; _PLS_EQUIPES.forEach(eq => medias[eq] = _plsMediaEquipe(todos, eq));
  const ordem = _PLS_EQUIPES.concat(['EXPEDIENTE', '']);
  const lista = todos.filter(l => !_plsEquipe || (_plsEquipe === '-' ? !l.equipe : l.equipe === _plsEquipe))
    .sort((a, b) => ordem.indexOf(a.equipe) - ordem.indexOf(b.equipe) || b.n - a.n);
  const chip = (v, r) => '<button type="button" class="idv-chip' + (v === _plsEquipe ? ' ativo' : '') + '" onclick="_plsEquipe=\'' + v + '\';pl_renderizar()"'
    + (v === _plsEquipe ? '' : ' style="color:' + (PLANTAO_CORES[v] || 'var(--idv-texto)') + '"') + '>' + r + '</button>';
  const th = h => '<th>' + h + '</th>';
  const td = (v, s) => '<td style="vertical-align:top;' + (s || '') + '">' + v + '</td>';
  box.innerHTML = '<div style="font-size:14px;color:var(--idv-sec);margin-bottom:8px">Trabalho de cada servidor nos últimos ' + nd + ' dias, comparado com a média da própria equipe. <b>Sem nota e sem ranking</b>: as funções são diferentes (monitoramento × instalação). Clique no nome para ver a ficha.</div>'
    + '<div class="idv-chips" style="margin-bottom:12px">' + chip('', 'Todas as equipes') + _PLS_EQUIPES.concat(['EXPEDIENTE']).map(eq => chip(eq, eq === 'EXPEDIENTE' ? 'Expediente' : eq)).join('') + (todos.some(l => !l.equipe) ? chip('-', 'Fora da folha de ponto') : '') + '</div>'
    + '<div class="table-scroll"><table class="data-table idv-tabela"><thead><tr>'
    + ['Servidor', 'Equipe', 'Plantões', 'Atendeu primeiro', 'No prazo', 'Tempo típico', 'Violência doméstica', 'Violações avaliadas', 'Instal. / desinst.', 'Ações sensíveis'].map(th).join('') + '</tr></thead><tbody>'
    + (lista.length ? lista.map((l, i) => { const m = medias[l.equipe] || {}, porPl = l.nPl ? l.n / l.nPl : 0;
      const novoGrupo = i === 0 || lista[i - 1].equipe !== l.equipe, qtd = lista.filter(x => x.equipe === l.equipe).length;
      const cab = !novoGrupo ? '' : '<tr><td colspan="10" style="padding:12px 14px 4px;border-bottom:2px solid ' + (PLANTAO_CORES[l.equipe] || 'var(--idv-borda)') + '">'
        + '<b style="font-size:15px;font-weight:600;color:' + (PLANTAO_CORES[l.equipe] || 'var(--idv-texto)') + '">' + (l.equipe === 'EXPEDIENTE' ? 'Expediente' : l.equipe ? 'Plantão ' + l.equipe : 'Fora da folha de ponto') + '</b>'
        + ' <span style="color:var(--idv-sec);font-size:13px">' + qtd + ' servidor(es)' + (l.equipe ? '' : ' — o nome não confere com a lista de servidores da Secretaria; confira o cadastro') + '</span></td></tr>';
      return cab + '<tr>'
        + td('<a href="#" onclick="pl_fichaServidor(\'' + l.op + '\');return false" style="color:var(--idv-in);font-weight:600">' + esc(l.nome) + '</a><div class="idv-mini">' + l.funcao + '</div>')
        + td(l.equipe ? '<b style="font-weight:600;color:' + (PLANTAO_CORES[l.equipe] || 'var(--idv-sec)') + '">' + esc(l.equipe) + '</b>' : '<span style="color:var(--idv-sec)">— <span style="font-size:12px">(AKILES: ' + esc(l.equipeRobo || '?') + ')</span></span>')
        + td(l.nPl + (l.nOutros ? '<div style="font-size:12px;color:var(--idv-sec)">+' + l.nOutros + ' em outra equipe</div>' : ''), 'font-variant-numeric:tabular-nums')
        + td('<b style="font-weight:600">' + l.n + '</b> <span style="color:var(--idv-sec);font-size:12px">(' + (Math.round(porPl * 10) / 10).toString().replace('.', ',') + ' por plantão)</span>' + _plsComp(porPl, m.nPorPl, 'maior', v => (Math.round(v * 10) / 10).toString().replace('.', ',')))
        + td(l.pct != null ? '<b style="font-weight:600;color:' + _plrCorBarra(l.pct / 100) + '">' + l.pct + '%</b>' + _plsComp(l.pct, m.pct, 'pct', v => v + '%') : '—')
        + td(l.med != null ? _plrMin(l.med) + _plsComp(l.med, m.med, 'menor', _plrMin) : '—')
        + td(l.vdDec ? '<b style="font-weight:600">' + l.vdDec + '</b> decidida(s) · <b style="font-weight:600;color:' + _plrCorBarra(l.vdDecOk / l.vdDec) + '">' + Math.round(l.vdDecOk / l.vdDec * 100) + '% no prazo</b>' + (l.vdDecMed != null ? '<div style="font-size:12px;color:var(--idv-sec)">tempo típico até decidir: ' + _plrMin(l.vdDecMed) + '</div>' : '') : l.vd ? l.vd + ' atendida(s)' : '—')
        + (l.vdP ? '<div style="font-size:12px;color:var(--idv-cr)">' + l.vdP + ' com pendência</div>' : '')
        + td(l.conf + l.nconf ? l.conf + ' \u{2714} · ' + l.nconf + ' \u{2718}' : '—', 'font-variant-numeric:tabular-nums')
        + td(l.inst + l.desinst ? l.inst + ' / ' + l.desinst : '—', 'font-variant-numeric:tabular-nums')
        + td(l.sens || '—', 'font-variant-numeric:tabular-nums') + '</tr>'; }).join('')
      : '<tr><td colspan="10" class="idv-vazio">Nenhum servidor com trabalho no período.</td></tr>')
    + '</tbody></table></div>'
    + '<div style="font-size:12px;color:var(--idv-sec);margin-top:8px">Atendeu primeiro = ocorrências em que foi o 1º operador a agir. No prazo = dessas, quantas dentro do prazo do POP. Tempo típico = mediana do tempo até a 1ª ação. Equipe = a da folha de ponto (Secretaria). Quem começa antes da troca das 08h ou fica depois (até 2 h) conta no plantão da PRÓPRIA equipe; "+N em outra equipe" = plantões de outra equipe em que agiu (apoio).</div>';
}

// ── Ficha do servidor: evolução plantão a plantão ─────────────────────────────
function pl_fichaServidor(op) {
  const d = _plDados(); if (!d) return;
  const nd = +(document.getElementById('pl-periodo')?.value || 30);
  const todos = _plsAgregar(d, nd), l = todos.find(x => x.op === op); if (!l) return;
  const m = _plsMediaEquipe(todos, l.equipe), porPl = l.nPl ? l.n / l.nPl : 0, num = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
  const frases = [
    'Trabalhou em <b>' + l.nPl + '</b> plantão(ões) nos últimos ' + nd + ' dias' + (l.equipe ? ', equipe <b style="color:' + (PLANTAO_CORES[l.equipe] || 'var(--idv-texto)') + '">' + esc(l.equipe) + '</b> (folha de ponto)' : ' <span style="color:var(--idv-at)">(não está na folha de ponto da Secretaria)</span>')
      + (l.nOutros ? ', e agiu em mais <b>' + l.nOutros + '</b> plantão(ões) de outra equipe (apoio)' : '') + '. Função principal: ' + l.funcao.toLowerCase() + '.',
    'Foi o primeiro a agir em <b>' + l.n + '</b> ocorrências (' + num(porPl) + ' por plantão' + (m.nPorPl != null ? '; média da equipe: ' + num(m.nPorPl) : '') + ').',
    l.pct != null ? 'Respondeu <b>dentro do prazo do POP em ' + l.pct + '%</b> das vezes' + (m.pct != null ? ' (equipe: ' + m.pct + '%)' : '') + (l.med != null ? '; tempo típico de ' + _plrMin(l.med) + (m.med != null ? ' (equipe: ' + _plrMin(m.med) + ')' : '') : '') + '.' : 'Não deu a 1ª resposta em ocorrências com prazo no período.',
    l.vdDec ? 'Decidiu (confirmou ou não confirmou) <b>' + l.vdDec + '</b> violação(ões) de violência doméstica, <b>' + Math.round(l.vdDecOk / l.vdDec * 100) + '% dentro do prazo do POP</b>' + (l.vdDecMed != null ? ' (tempo típico: ' + _plrMin(l.vdDecMed) + ')' : '') + (l.vdP ? '; <b style="color:var(--idv-cr)">' + l.vdP + ' com pendência</b>' : '') + '.'
      : l.vd ? 'Atendeu <b>' + l.vd + '</b> caso(s) de violência doméstica' + (l.vdP ? ', <b style="color:var(--idv-cr)">' + l.vdP + ' com pendência</b>' : ', todos em dia') + '.' : '',
    (l.conf + l.nconf ? 'Avaliou ' + (l.conf + l.nconf) + ' violação(ões): ' + l.conf + ' confirmada(s) e ' + l.nconf + ' não confirmada(s). ' : '') + (l.inst + l.desinst ? 'Fez ' + l.inst + ' instalação(ões) e ' + l.desinst + ' desinstalação(ões). ' : '') + (l.registro ? 'Salvou ' + l.registro + ' registro(s) no perfil de monitorados. ' : '') + (l.sms ? l.sms + ' SMS/alertas enviados.' : ''),
    l.sens ? 'Fez <b>' + l.sens + '</b> ação(ões) sensível(is) (reabertura, zona, cadastro, desvínculo) — veja em cada plantão.' : '',
  ].filter(Boolean);
  const td = (v, s) => '<td style="' + (s || '') + '">' + v + '</td>';
  const html = '<div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:8px"><b style="font-size:20px;font-weight:600">' + esc(l.nome) + '</b><span style="color:var(--idv-sec);font-size:14px">' + l.funcao + '</span>'
    + (l.secId ? '<a href="#" onclick="document.getElementById(\'pl-modal\').remove();mudarAba(\'secretaria\');sec_abrirPerfil(\'' + l.secId + '\');return false" style="font-size:13px;font-weight:600;color:var(--idv-in)">abrir perfil na Secretaria</a>' : '') + '</div>'
    + '<ul style="margin:0 0 16px 18px;padding:0;font-size:14px;line-height:1.6">' + frases.map(t => '<li>' + t + '</li>').join('') + '</ul>'
    + '<div style="font-size:16px;font-weight:600;margin-bottom:6px">Plantão a plantão <span style="font-weight:400;font-size:12px;color:var(--idv-sec)">— clique na data para ver cada ocorrência que ele atendeu</span></div>'
    + '<div class="table-scroll"><table class="data-table idv-tabela"><thead><tr>'
    + ['Plantão', 'Equipe', 'Atendeu primeiro', 'No prazo', 'Tempo típico', 'VD', 'Violações avaliadas', 'Instal./desinst.', 'Sensíveis'].map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>'
    + l.plantoes.slice().reverse().map(p => '<tr>'
      + td('<a href="#" onclick="pl_servidor(\'' + p.eq + '\', \'' + p.dia + '\', \'' + op + '\');return false" class="idv-data" style="color:var(--idv-in);font-weight:600">' + _plDataBR(p.dia) + '</a>')
      + td('<span style="color:' + (PLANTAO_CORES[p.eq] || 'var(--idv-sec)') + ';font-weight:600">' + esc(p.eq) + '</span>') + td(p.n, 'font-variant-numeric:tabular-nums')
      + td(p.pct != null ? '<b style="font-weight:600;color:' + _plrCorBarra(p.pct / 100) + '">' + p.pct + '%</b>' : '—') + td(p.med != null ? _plrMin(p.med) : '—')
      + td(p.vdDec ? p.vdDec + ' decid. · ' + Math.round(p.vdDecOk / p.vdDec * 100) + '% no prazo' + (p.vdP ? ' <span style="color:var(--idv-cr)">(' + p.vdP + ' pend.)</span>' : '') : p.vd ? p.vd + (p.vdP ? ' <span style="color:var(--idv-cr)">(' + p.vdP + ' pend.)</span>' : '') : '—') + td(p.conf || '—', 'font-variant-numeric:tabular-nums') + td(p.inst || '—', 'font-variant-numeric:tabular-nums') + td(p.sens || '—', 'font-variant-numeric:tabular-nums') + '</tr>').join('')
    + '</tbody></table></div><div style="font-size:12px;color:var(--idv-sec);margin-top:8px">Fonte: auditoria do AKILES (só leitura). Sem nota: os números servem para conversar com o servidor, comparando com a própria equipe.</div>';
  let ov = document.getElementById('pl-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'pl-modal'; ov.style.cssText = 'position:fixed;inset:0;background:rgba(31,35,40,.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:24px 12px;overflow:auto'; ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); }); document.body.appendChild(ov); }
  ov.innerHTML = '<div style="background:var(--idv-cartao);border:1px solid var(--idv-borda);border-radius:6px;max-width:980px;width:100%;padding:16px 20px;box-shadow:0 8px 24px rgba(31,35,40,.18)"><div style="display:flex;justify-content:flex-end"><button type="button" class="idv-btn mini" onclick="document.getElementById(\'pl-modal\').remove()">Fechar \u{2715}</button></div>' + html + '</div>';
}
