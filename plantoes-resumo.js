/* ═══════════════════════════ DESEMPENHO DOS PLANTÕES — RESUMO SIMPLES ═══════════════════════════
   Em vez de dezenas de números: uma NOTA de 0 a 10 por plantão (com cor), 4 indicadores em
   português claro e uma frase dizendo quem foi melhor e quem precisa de atenção.
   Os números completos (cartões e tabela de sempre) ficam atrás de "Ver todos os números".
   Usa a média do período escolhido em "Comparar" (calculada em pl_renderizar → lin).
   Emojis só por \u{...}. Prefixo _plr (não colidir com o index). */

// Nota revista em 16/10/2026 — FOCO EM VIOLÊNCIA DOMÉSTICA (pedido da gerência, com os dados de 01–14/10):
//  • VD decidida no prazo do POP: do início da violação até o servidor marcar confirmada (6) ou não confirmada (7);
//  • VD sem decisão: ninguém confirmou nem negou (o sistema arquivou ou ficou aberta);
//  • restabelecidas fora do limite: abertas às 04h (foto das 04h05) + as que se restabeleceram depois e ficaram na troca;
//  • agiu no prazo do POP (todas as ocorrências), com peso menor.
//  Saíram da nota: tempo parado (subjetivo), repasse e registro no perfil (continua em "Para cobrar").
const _PLR_VDSEM_ZERO = 10;   // VD sem decisão por plantão que zeram o indicador
const _PLR_REST_ZERO = 20;    // restabelecidas fora do limite por plantão que zeram o indicador
const _PLR_IND = [
  { k: 'vdPrazo', rot: 'VD decidida no prazo', peso: 0.4, dica: 'violações de violência doméstica confirmadas ou não confirmadas dentro do prazo do POP (1h exclusão/botão/proximidade, 12h inclusão, 24h pulseira/bateria), contando do início da violação' },
  { k: 'vdSem', rot: 'VD sem decisão', peso: 0.2, dica: 'violações de VD que ninguém confirmou nem negou (o sistema arquivou sozinho ou ficou aberta); ' + _PLR_VDSEM_ZERO + ' por plantão zeram' },
  { k: 'rest', rot: 'Restabelecidas fora do limite', peso: 0.25, dica: 'já restabelecidas e ainda abertas às 04h da madrugada (limite) + as que se restabeleceram depois das 04h e ficaram abertas na troca das 08h; ' + _PLR_REST_ZERO + ' por plantão zeram' },
  { k: 'pop', rot: 'Agiu no prazo (todas)', peso: 0.15, dica: '1ª ação do operador dentro do prazo do POP, em todas as ocorrências com prazo' },
];
let _plrVerTudo = false, _plrVisao = 'equipes';

function _plrMin(m) { m = Math.round(m); if (m < 60) return m + ' min'; const h = Math.floor(m / 60), r = m % 60; return h + 'h' + (r ? ' ' + String(r).padStart(2, '0') + 'min' : ''); }
function _plrClamp(v) { return Math.max(0, Math.min(1, v)); }
function _plrMedianaDe(v) { if (!v || !v.length) return null; const s = v.slice().sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); }
// valores de 0 a 1 (1 = ótimo) e o texto de cada indicador
// l: médias do período (pl_renderizar → lin) ou UM plantão (l.unico = true)
function _plrIndicadores(l) {
  const por = l.unico ? '' : ' por plantão';
  const num = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
  const decMed = _plrMedianaDe(l.vdDecMeds), sem = l.vdDias ? l.vdSem / l.vdDias : null, rest = l.restLimDias ? l.restLimN / l.restLimDias : null;
  return {
    vdPrazo: l.vdDias && l.vdMedViol ? { s: l.vdDecOk / l.vdMedViol, txt: Math.round(l.vdDecOk / l.vdMedViol * 100) + '%',
      det: (decMed != null ? 'tempo típico até decidir: ' + _plrMin(decMed) : '') } : null,
    vdSem: sem != null ? { s: _plrClamp(1 - sem / _PLR_VDSEM_ZERO), txt: sem ? num(sem) + por : 'nenhuma' } : null,
    rest: rest != null ? { s: _plrClamp(1 - rest / _PLR_REST_ZERO), txt: rest ? num(rest) + por : 'nenhuma',
      det: l.restLimSo08 ? (l.unico ? 'sem a foto das 04h: medido só na troca' : l.restLimSo08 + ' plantão(ões) medido(s) só na troca') : '' } : null,
    pop: l.pop != null ? { s: l.pop / 100, txt: l.pop + '%' } : null,
  };
}
function _plrNota(ind) {
  let soma = 0, pesos = 0;
  _PLR_IND.forEach(i => { if (ind[i.k]) { soma += ind[i.k].s * i.peso; pesos += i.peso; } });
  return pesos ? Math.round(soma / pesos * 100) / 10 : null;
}
function _plrFaixa(nota) {
  // cores do guia (identidade.css); cls = sufixo da etiqueta idv-etq
  if (nota == null) return { rot: 'Sem dados', cor: 'var(--idv-sec)', fundo: '#eaeef2', cls: 'ne' };
  if (nota >= 8) return { rot: 'Bom', cor: 'var(--idv-ok)', fundo: 'var(--idv-ok-f)', cls: 'ok' };
  if (nota >= 6) return { rot: 'Regular', cor: 'var(--idv-at)', fundo: 'var(--idv-at-f)', cls: 'at' };
  return { rot: 'Precisa melhorar', cor: 'var(--idv-cr)', fundo: 'var(--idv-cr-f)', cls: 'cr' };
}
function _plrCorBarra(s) { return s >= 0.8 ? 'var(--idv-ok)' : s >= 0.6 ? 'var(--idv-at)' : 'var(--idv-cr)'; }
const _PLR_FRASE = {
  vdPrazo: x => 'demorou para confirmar ou não confirmar as violações de violência doméstica (só ' + x.txt + ' no prazo do POP' + (x.det ? '; ' + x.det : '') + ')',
  vdSem: x => 'deixou violações de violência doméstica sem decisão (' + x.txt + ')',
  rest: x => 'deixou restabelecidas abertas depois do limite das 04h (' + x.txt + ')',
  pop: x => 'demorou para dar a 1ª resposta (só ' + x.txt + ' no prazo do POP)',
};
function _plrPior(ind) {
  return _PLR_IND.filter(i => ind[i.k]).sort((a, b) => ind[a.k].s - ind[b.k].s)[0] || null;
}

function _plrRender(d, lin, nd) {
  const cards = document.getElementById('pl-cards'), comp = document.getElementById('pl-comparativo'); if (!cards) return;
  let box = document.getElementById('pl-resumo');
  if (!box) { box = document.createElement('div'); box.id = 'pl-resumo'; cards.parentNode.insertBefore(box, cards); }
  const eqs = lin.filter(l => l.n).map(l => { const ind = _plrIndicadores(l); return Object.assign({}, l, { ind, nota: _plrNota(ind) }); })
    .sort((a, b) => (b.nota ?? -1) - (a.nota ?? -1));
  cards.style.display = comp.style.display = _plrVerTudo && _plrVisao === 'equipes' ? '' : 'none';
  if (!eqs.length) { box.innerHTML = ''; return; }
  const aba = (k, r) => '<button type="button" class="idv-chip' + (k === _plrVisao ? ' ativo' : '') + '" onclick="_plrVisao=\'' + k + '\';pl_renderizar()">' + r + '</button>';
  const abas = '<div class="idv-chips" style="margin-bottom:12px">' + aba('equipes', '\u{1F6E1}\u{FE0F} Equipes') + aba('servidores', '\u{1F464} Servidores (individual)') + '</div>';
  if (_plrVisao === 'servidores' && typeof _plsRender === 'function') { box.innerHTML = abas + _plrHtmlStatusTroca(d) + '<div id="pls-corpo"></div>'; _plsRender(d, nd); return; }
  const melhor = eqs[0], pior = eqs[eqs.length - 1], piorInd = _plrPior(pior.ind);
  const nome = eq => '<b style="color:' + (PLANTAO_CORES[eq] || 'var(--idv-in)') + '">' + eq + '</b>';
  const fmtNota = n => n == null ? '—' : n.toFixed(1).replace('.', ',');
  const frase = 'Nos últimos ' + nd + ' dias, o melhor plantão foi ' + nome(melhor.eq) + ' (nota ' + fmtNota(melhor.nota) + ').'
    + (eqs.length > 1 && piorInd && pior.ind[piorInd.k].s < 0.8 ? ' Precisa de mais atenção: ' + nome(pior.eq) + ', que ' + _PLR_FRASE[piorInd.k](pior.ind[piorInd.k]) + '.' : '');
  box.innerHTML = abas + '<div class="idv-faixa" style="display:block;line-height:1.5;margin-bottom:12px">' + frase + '</div>'
    + _plrHtmlStatusTroca(d)
    + (_plrVerTudo ? _plrHtmlPassivo(d) : '')
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">'
    + eqs.map((l, i) => _plrCartao(l, i + 1, fmtNota)).join('') + '</div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px">'
    + '<div style="font-size:12px;color:var(--idv-sec)">Nota de 0 a 10 = violência doméstica decidida (confirmada ou não confirmada) no prazo do POP (40%) + VD sem decisão (20%; ' + _PLR_VDSEM_ZERO + ' por plantão zeram) + restabelecidas fora do limite das 04h (25%; ' + _PLR_REST_ZERO + ' por plantão zeram) + agiu no prazo do POP em todas as ocorrências (15%). A hora da decisão é medida desde 01/10/2026; a foto das 04h começa no plantão de 16/10/2026 (antes, vale a da troca das 08h). Clique num plantão para ver o detalhe.</div>'
    + '<button class="btn-secondary btn-sm" onclick="_plrVerTudo=!_plrVerTudo;pl_renderizar()">' + (_plrVerTudo ? 'Esconder os números' : '\u{1F4CA} Ver todos os números') + '</button></div>';
}
function _plrCartao(l, pos, fmtNota) {
  const f = _plrFaixa(l.nota), cor = PLANTAO_CORES[l.eq] || 'var(--idv-in)', pior = _plrPior(l.ind);
  const barra = i => {
    const x = l.ind[i.k];
    if (!x) return '';
    return '<div title="' + esc(i.dica) + '" style="margin-top:8px"><div style="display:flex;justify-content:space-between;gap:8px;font-size:13px"><span style="color:var(--idv-sec)">' + i.rot + '</span><b class="idv-data" style="font-weight:600;color:' + _plrCorBarra(x.s) + '">' + esc(x.txt) + '</b></div>'
      + '<div style="height:6px;background:var(--idv-zebra);border-radius:2px;overflow:hidden;margin-top:2px"><div style="height:100%;width:' + Math.round(x.s * 100) + '%;background:' + _plrCorBarra(x.s) + '"></div></div>'
      + (x.det ? '<div style="font-size:12px;color:var(--idv-sec);margin-top:1px">' + esc(x.det) + '</div>' : '') + '</div>';
  };
  return '<div onclick="pl_detalhe(\'' + l.eq + '\')" title="Ver o detalhe do último plantão" style="cursor:pointer;border:1px solid var(--idv-borda);border-top:3px solid ' + cor + ';border-radius:6px;padding:12px 16px;background:var(--idv-cartao)">'
    + '<div style="display:flex;justify-content:space-between;align-items:baseline"><span class="idv-data" style="font-size:13px;color:var(--idv-sec)">' + pos + 'º</span><span style="font-size:12px;color:var(--idv-sec)">' + l.n + ' plantão(ões)</span></div>'
    + '<div style="font-weight:600;font-size:16px;color:' + cor + '">' + l.eq + '</div>'
    + '<div style="display:flex;align-items:center;gap:8px;margin:4px 0 2px"><span class="idv-data" style="font-size:28px;font-weight:600;color:' + f.cor + ';line-height:1">' + fmtNota(l.nota) + '</span>'
    + '<span class="idv-etq ' + f.cls + '">' + f.rot + '</span></div>'
    + _PLR_IND.map(barra).join('')
    + '<div style="font-size:13px;margin-top:8px;color:' + (pior && l.ind[pior.k].s < 0.8 ? 'var(--idv-at)' : 'var(--idv-ok)') + '">'
    + (pior && l.ind[pior.k].s < 0.8 ? 'A melhorar: ' + pior.rot.replace(/^(?!VD)./, c => c.toLowerCase()) : 'Tudo dentro do esperado') + '</div></div>';
}

// Passivo: restabelecidas abertas de qualquer data (ninguém arquivou) — tem que diminuir
function _plrMaisDias(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function _plrHtmlPassivo(d) {
  const ps = ((d && d.restabelecidas) || {}).passivo || []; if (!ps.length) return '';
  const p = ps[ps.length - 1], ref = _plrMaisDias(p.dia, -7), antes = ps.find(x => x.dia >= ref && x.dia < p.dia) || null;
  const dif = antes ? p.total - antes.total : null;
  return '<div class="idv-faixa at" style="display:block;font-size:14px;line-height:1.5;margin-bottom:12px">'
    + '\u{1F4E6} <b style="font-weight:600">Passivo no AKILES:</b> <b class="idv-data" style="font-weight:600;color:var(--idv-at)">' + p.total + '</b> ocorrências já restabelecidas continuam abertas'
    + ' <span style="color:var(--idv-sec)">(' + p.mais30 + ' há mais de 30 dias · ' + p.ate30 + ' de 7 a 30 dias · ' + (p.ate7 + p.ate1) + ' da última semana; ' + p.nuncaPegas + ' nunca foram pegas por operador)</span>.'
    + (dif != null ? ' <b style="font-weight:600;color:' + (dif > 0 ? 'var(--idv-cr)' : 'var(--idv-ok)') + '">' + (dif > 0 ? '\u{2191} ' + dif + ' a mais' : dif < 0 ? '\u{2193} ' + (-dif) + ' a menos' : 'Igual') + '</b> desde ' + antes.dia.slice(8, 10) + '/' + antes.dia.slice(5, 7) + '.' : '')
    + ' <span style="color:var(--idv-sec)">Precisam ser arquivadas.</span></div>';
}
// Detalhe do plantão: quais restabelecidas ele deixou abertas na troca
function _plrHtmlRestDetalhe(x) {
  const r = x && x.restDeixadas;
  if (!r) return '<div class="idv-faixa" style="display:block;font-size:13px;color:var(--idv-sec);margin-bottom:12px">\u{21AA} Restabelecidas deixadas: não medido neste plantão (a contagem começou em 14/10/2026 e só é feita quando o robô roda até 4 h depois da troca).</div>';
  const cor = r.n ? 'var(--idv-at)' : 'var(--idv-ok)';
  return '<div class="idv-faixa ' + (r.n ? 'at' : 'ok') + '" style="display:block;margin-bottom:12px">'
    + '<div style="font-weight:600;font-size:14px;color:' + cor + ';margin-bottom:4px">\u{21AA} Restabelecidas deixadas para o próximo plantão: ' + (r.n || 'nenhuma') + '</div>'
    + '<div style="font-size:12px;color:var(--idv-sec);margin-bottom:6px">Ocorrências que começaram neste plantão, já com andamento "Restabelecido", e que ainda estavam abertas na troca (conferido às ' + new Date(r.medidoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '). As "em andamento" podem passar e não contam.</div>'
    + (r.lista && r.lista.length ? '<div class="table-scroll" style="max-height:260px;overflow-y:auto"><table class="data-table idv-tabela"><thead><tr>'
      + ['Início', 'Ocorrência', 'Registro', 'Tipo', 'Estado', 'Criticidade'].map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>'
      + r.lista.map(o => '<tr><td class="idv-data" style="white-space:nowrap">' + new Date(o.d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</td>'
        + '<td class="idv-mono">' + esc(o.id) + '</td><td class="idv-mono">' + esc(o.reg || '') + '</td><td>' + esc(o.t) + '</td>'
        + '<td style="color:' + (o.est === 'Aberto' ? 'var(--idv-cr)' : 'var(--idv-at)') + '">' + esc(o.est) + (o.est === 'Aberto' ? ' (ninguém pegou)' : '') + '</td><td>' + esc(o.c) + '</td></tr>').join('')
      + '</tbody></table></div>' : '') + '</div>';
}
// A análise tem que acontecer em TODA troca (08h). Mostra se a de hoje foi feita — e avisa quando não.
function _plrHtmlStatusTroca(d) {
  const agora = new Date(), troca = new Date(agora); troca.setHours(8, 0, 0, 0);
  if (agora < troca) troca.setDate(troca.getDate() - 1);
  const ger = new Date(d && d.geradoEm), dm = x => x.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), hm = x => x.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (!isNaN(ger) && ger >= troca) return '<div style="font-size:13px;color:var(--idv-ok);margin:-6px 0 12px">\u{2705} Troca de ' + dm(troca) + ' às 08h analisada (' + dm(ger) + ' às ' + hm(ger) + ').</div>';
  return '<div class="idv-faixa cr" style="display:block;font-size:14px;line-height:1.5;margin-bottom:12px">'
    + '\u{26A0}\u{FE0F} <b style="font-weight:600">A troca de ' + dm(troca) + ' às 08h ainda não foi analisada.</b> Última análise: ' + (isNaN(ger) ? '—' : dm(ger) + ' às ' + hm(ger)) + '. '
    + '<span style="color:var(--idv-sec)">O robô tenta das 08h10 às 11h50 no computador que está de vez. Se nenhum estiver ligado, a análise fica para o dia seguinte (os números do plantão são recuperados; as restabelecidas deixadas na troca, não).</span></div>';
}
