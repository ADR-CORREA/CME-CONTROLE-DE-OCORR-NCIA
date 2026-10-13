/* ═══════════════════════════ DESEMPENHO DOS PLANTÕES — RESUMO SIMPLES ═══════════════════════════
   Em vez de dezenas de números: uma NOTA de 0 a 10 por plantão (com cor), 4 indicadores em
   português claro e uma frase dizendo quem foi melhor e quem precisa de atenção.
   Os números completos (cartões e tabela de sempre) ficam atrás de "Ver todos os números".
   Usa a média do período escolhido em "Comparar" (calculada em pl_renderizar → lin).
   Emojis só por \u{...}. Prefixo _plr (não colidir com o index). */

// Nota revista em 13/10/2026 com os dados reais de 15 plantões:
//  • saiu "ocorrências resolvidas" (85–97% em todos; conta o que o plantão seguinte e o sistema arquivaram);
//  • entrou "deixou para o próximo plantão" = sem nenhuma ação até as 08h (repasse) + restabelecidas abertas;
//  • VD inclui o registro no perfil (obrigatório na VD, menos descarregamento de bateria — decisão da gerência).
const _PLR_PARADO_ZERO = 180; // minutos parado por plantão que zeram o indicador "tempo parado"
const _PLR_DEIXOU_ZERO = 40;  // ocorrências deixadas para o próximo plantão (sem ação + restabelecidas) que zeram o indicador
const _PLR_IND = [
  { k: 'pop', rot: 'Agiu no prazo', peso: 0.35, dica: '1ª ação do operador dentro do prazo do POP' },
  { k: 'deixou', rot: 'Deixou para o próximo plantão', peso: 0.25, dica: 'ocorrências sem nenhuma ação até as 08h + ocorrências já restabelecidas ainda abertas na troca (as "em andamento" podem passar)' },
  { k: 'vd', rot: 'Violência doméstica em dia', peso: 0.2, dica: 'violações de VD sem pendência: atendida, dentro do prazo do POP e (se confirmada) registrada no perfil' },
  { k: 'parado', rot: 'Tempo parado', peso: 0.2, dica: 'períodos de 1h ou mais sem nenhuma ação de operador, com ocorrências chegando' },
];
let _plrVerTudo = false, _plrVisao = 'equipes';

function _plrMin(m) { m = Math.round(m); if (m < 60) return m + ' min'; const h = Math.floor(m / 60), r = m % 60; return h + 'h' + (r ? ' ' + String(r).padStart(2, '0') + 'min' : ''); }
function _plrClamp(v) { return Math.max(0, Math.min(1, v)); }
// valores de 0 a 1 (1 = ótimo) e o texto de cada indicador
// l: médias do período (pl_renderizar → lin) ou UM plantão (l.unico = true)
function _plrIndicadores(l) {
  const parado = l.n ? l.buracoMin / l.n : null, por = l.unico ? '' : ' por plantão';
  const rest = l.restMed ? l.restN / l.restMed : null, deixou = l.repasse != null ? l.repasse + (rest || 0) : null;
  const num = v => (Math.round(v * 10) / 10).toString().replace('.', ',');
  return {
    pop: l.pop != null ? { s: l.pop / 100, txt: l.pop + '%' } : null,
    deixou: deixou != null ? { s: _plrClamp(1 - deixou / _PLR_DEIXOU_ZERO), txt: deixou ? num(deixou) + por : 'nenhuma',
      det: num(l.repasse) + ' sem ação' + (rest != null ? ' + ' + num(rest) + ' restabelecida(s)' : '') } : null,
    vd: l.vdViol ? { s: _plrClamp(1 - l.vdPend / l.vdViol), txt: Math.round((1 - l.vdPend / l.vdViol) * 100) + '% em dia' } : null,
    parado: parado != null ? { s: _plrClamp(1 - parado / _PLR_PARADO_ZERO), txt: parado ? _plrMin(parado) + por : 'nenhum' } : null,
  };
}
function _plrNota(ind) {
  let soma = 0, pesos = 0;
  _PLR_IND.forEach(i => { if (ind[i.k]) { soma += ind[i.k].s * i.peso; pesos += i.peso; } });
  return pesos ? Math.round(soma / pesos * 100) / 10 : null;
}
function _plrFaixa(nota) {
  if (nota == null) return { rot: 'Sem dados', cor: '#94a3b8', fundo: '#f8fafc' };
  if (nota >= 8) return { rot: 'Bom', cor: '#15803d', fundo: '#f0fdf4' };
  if (nota >= 6) return { rot: 'Regular', cor: '#b45309', fundo: '#fffbeb' };
  return { rot: 'Precisa melhorar', cor: '#b91c1c', fundo: '#fef2f2' };
}
function _plrCorBarra(s) { return s >= 0.8 ? '#16a34a' : s >= 0.6 ? '#d97706' : '#dc2626'; }
const _PLR_FRASE = {
  pop: x => 'demorou para dar a 1ª resposta (só ' + x.txt + ' no prazo do POP)',
  parado: x => 'ficou tempo sem nenhuma ação (' + x.txt + ')',
  vd: x => 'deixou casos de violência doméstica com pendência (só ' + x.txt + ')',
  deixou: x => 'empurrou ocorrências para o próximo plantão (' + x.txt + ': ' + x.det + ')',
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
  const aba = (k, r) => '<button type="button" onclick="_plrVisao=\'' + k + '\';pl_renderizar()" style="padding:6px 16px;border:1px solid #cbd5e1;cursor:pointer;font-size:.85rem;font-weight:600;'
    + (k === _plrVisao ? 'background:#1e3a8a;color:#fff;border-color:#1e3a8a' : 'background:#fff;color:#334155') + (k === 'equipes' ? ';border-radius:4px 0 0 4px' : ';border-radius:0 4px 4px 0;margin-left:-1px') + '">' + r + '</button>';
  const abas = '<div style="display:flex;margin-bottom:12px">' + aba('equipes', '\u{1F6E1}\u{FE0F} Equipes') + aba('servidores', '\u{1F464} Servidores (individual)') + '</div>';
  if (_plrVisao === 'servidores' && typeof _plsRender === 'function') { box.innerHTML = abas + _plrHtmlStatusTroca(d) + '<div id="pls-corpo"></div>'; _plsRender(d, nd); return; }
  const melhor = eqs[0], pior = eqs[eqs.length - 1], piorInd = _plrPior(pior.ind);
  const nome = eq => '<b style="color:' + (PLANTAO_CORES[eq] || '#1d4ed8') + '">' + eq + '</b>';
  const fmtNota = n => n == null ? '—' : n.toFixed(1).replace('.', ',');
  const frase = 'Nos últimos ' + nd + ' dias, o melhor plantão foi ' + nome(melhor.eq) + ' (nota ' + fmtNota(melhor.nota) + ').'
    + (eqs.length > 1 && piorInd && pior.ind[piorInd.k].s < 0.8 ? ' Precisa de mais atenção: ' + nome(pior.eq) + ', que ' + _PLR_FRASE[piorInd.k](pior.ind[piorInd.k]) + '.' : '');
  box.innerHTML = abas + '<div style="font-size:.95rem;line-height:1.5;padding:10px 14px;background:#f8fafc;border-left:4px solid #2563eb;border-radius:4px;margin-bottom:12px">' + frase + '</div>'
    + _plrHtmlStatusTroca(d)
    + _plrHtmlPassivo(d)
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">'
    + eqs.map((l, i) => _plrCartao(l, i + 1, fmtNota)).join('') + '</div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px">'
    + '<div style="font-size:.72rem;color:#94a3b8">Nota de 0 a 10 = agiu no prazo do POP (35%) + deixou para o próximo plantão (25%; ' + _PLR_DEIXOU_ZERO + ' por plantão zera; restabelecidas contam desde 13/10/2026) + violência doméstica em dia (20%; inclui registro no perfil, menos descarregamento) + tempo parado (20%; ' + _plrMin(_PLR_PARADO_ZERO) + ' por plantão zera). Clique num plantão para ver o relato das 24 h.</div>'
    + '<button class="btn-secondary" style="font-size:.8rem" onclick="_plrVerTudo=!_plrVerTudo;pl_renderizar()">' + (_plrVerTudo ? 'Esconder os números' : '\u{1F4CA} Ver todos os números') + '</button></div>';
}
function _plrCartao(l, pos, fmtNota) {
  const f = _plrFaixa(l.nota), cor = PLANTAO_CORES[l.eq] || '#1d4ed8', pior = _plrPior(l.ind);
  const barra = i => {
    const x = l.ind[i.k];
    if (!x) return '';
    return '<div title="' + esc(i.dica) + '" style="margin-top:6px"><div style="display:flex;justify-content:space-between;font-size:.76rem"><span style="color:#475569">' + i.rot + '</span><b style="color:' + _plrCorBarra(x.s) + '">' + esc(x.txt) + '</b></div>'
      + '<div style="height:6px;background:#f1f5f9;border-radius:2px;overflow:hidden;margin-top:2px"><div style="height:100%;width:' + Math.round(x.s * 100) + '%;background:' + _plrCorBarra(x.s) + '"></div></div></div>';
  };
  return '<div onclick="pl_detalhe(\'' + l.eq + '\')" title="Ver o detalhe do último plantão" style="cursor:pointer;border:1px solid #e2e8f0;border-top:4px solid ' + cor + ';border-radius:8px;padding:10px 12px;background:#fff">'
    + '<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:.78rem;color:#94a3b8">' + pos + 'º</span><span style="font-size:.72rem;color:#94a3b8">' + l.n + ' plantão(ões)</span></div>'
    + '<div style="font-weight:700;font-size:1.05rem;color:' + cor + '">' + l.eq + '</div>'
    + '<div style="display:flex;align-items:baseline;gap:8px;margin:4px 0 2px"><span style="font-size:2rem;font-weight:700;color:' + f.cor + ';line-height:1">' + fmtNota(l.nota) + '</span>'
    + '<span style="font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;padding:2px 7px;border-radius:3px;border-left:2px solid ' + f.cor + ';background:' + f.fundo + ';color:' + f.cor + '">' + f.rot + '</span></div>'
    + _PLR_IND.map(barra).join('')
    + '<div style="font-size:.74rem;margin-top:8px;color:' + (pior && l.ind[pior.k].s < 0.8 ? '#b45309' : '#15803d') + '">'
    + (pior && l.ind[pior.k].s < 0.8 ? 'A melhorar: ' + pior.rot.toLowerCase() : 'Tudo dentro do esperado') + '</div></div>';
}

// Passivo: restabelecidas abertas de qualquer data (ninguém arquivou) — tem que diminuir
function _plrMaisDias(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function _plrHtmlPassivo(d) {
  const ps = ((d && d.restabelecidas) || {}).passivo || []; if (!ps.length) return '';
  const p = ps[ps.length - 1], ref = _plrMaisDias(p.dia, -7), antes = ps.find(x => x.dia >= ref && x.dia < p.dia) || null;
  const dif = antes ? p.total - antes.total : null;
  return '<div style="font-size:.85rem;line-height:1.5;padding:8px 14px;background:#fff7ed;border-left:4px solid #ea580c;border-radius:4px;margin-bottom:12px">'
    + '\u{1F4E6} <b>Passivo no AKILES:</b> <b style="color:#c2410c">' + p.total + '</b> ocorrências já restabelecidas continuam abertas'
    + ' <span style="color:#64748b">(' + p.mais30 + ' há mais de 30 dias · ' + p.ate30 + ' de 7 a 30 dias · ' + (p.ate7 + p.ate1) + ' da última semana; ' + p.nuncaPegas + ' nunca foram pegas por operador)</span>.'
    + (dif != null ? ' <b style="color:' + (dif > 0 ? '#b91c1c' : '#15803d') + '">' + (dif > 0 ? '\u{2191} ' + dif + ' a mais' : dif < 0 ? '\u{2193} ' + (-dif) + ' a menos' : 'Igual') + '</b> desde ' + antes.dia.slice(8, 10) + '/' + antes.dia.slice(5, 7) + '.' : '')
    + ' <span style="color:#64748b">Precisam ser arquivadas.</span></div>';
}
// Detalhe do plantão: quais restabelecidas ele deixou abertas na troca
function _plrHtmlRestDetalhe(x) {
  const r = x && x.restDeixadas;
  if (!r) return '<div style="border:1px solid #e2e8f0;border-left:4px solid #94a3b8;border-radius:6px;padding:8px 10px;margin-bottom:12px;font-size:.78rem;color:#64748b">\u{21AA} Restabelecidas deixadas: não medido neste plantão (a contagem começou em 14/10/2026 e só é feita quando o robô roda até 4 h depois da troca).</div>';
  const cor = r.n ? '#c2410c' : '#15803d';
  return '<div style="border:1px solid #fed7aa;border-left:4px solid ' + cor + ';border-radius:6px;padding:8px 10px;margin-bottom:12px">'
    + '<div style="font-weight:700;font-size:.85rem;color:' + cor + ';margin-bottom:4px">\u{21AA} Restabelecidas deixadas para o próximo plantão: ' + (r.n || 'nenhuma') + '</div>'
    + '<div style="font-size:.72rem;color:#64748b;margin-bottom:6px">Ocorrências que começaram neste plantão, já com andamento "Restabelecido", e que ainda estavam abertas na troca (conferido às ' + new Date(r.medidoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '). As "em andamento" podem passar e não contam.</div>'
    + (r.lista && r.lista.length ? '<div style="max-height:260px;overflow-y:auto"><table style="width:100%;border-collapse:collapse;font-size:.75rem"><thead><tr>'
      + ['Início', 'Ocorrência', 'Registro', 'Tipo', 'Estado', 'Criticidade'].map(h => '<th style="text-align:left;padding:4px 6px;color:#64748b;font-weight:600">' + h + '</th>').join('') + '</tr></thead><tbody>'
      + r.lista.map(o => '<tr style="border-top:1px solid #f1f5f9"><td style="padding:4px 6px;font-family:var(--font-mono)">' + new Date(o.d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + '</td>'
        + '<td style="padding:4px 6px;font-family:var(--font-mono)">' + esc(o.id) + '</td><td style="padding:4px 6px;font-family:var(--font-mono)">' + esc(o.reg || '') + '</td><td style="padding:4px 6px">' + esc(o.t) + '</td>'
        + '<td style="padding:4px 6px;color:' + (o.est === 'Aberto' ? '#b91c1c' : '#b45309') + '">' + esc(o.est) + (o.est === 'Aberto' ? ' (ninguém pegou)' : '') + '</td><td style="padding:4px 6px">' + esc(o.c) + '</td></tr>').join('')
      + '</tbody></table></div>' : '') + '</div>';
}
// A análise tem que acontecer em TODA troca (08h). Mostra se a de hoje foi feita — e avisa quando não.
function _plrHtmlStatusTroca(d) {
  const agora = new Date(), troca = new Date(agora); troca.setHours(8, 0, 0, 0);
  if (agora < troca) troca.setDate(troca.getDate() - 1);
  const ger = new Date(d && d.geradoEm), dm = x => x.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), hm = x => x.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (!isNaN(ger) && ger >= troca) return '<div style="font-size:.78rem;color:#15803d;margin:-6px 0 10px">\u{2705} Troca de ' + dm(troca) + ' às 08h analisada (' + dm(ger) + ' às ' + hm(ger) + ').</div>';
  return '<div style="font-size:.85rem;line-height:1.5;padding:8px 14px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;margin-bottom:12px">'
    + '\u{26A0}\u{FE0F} <b>A troca de ' + dm(troca) + ' às 08h ainda não foi analisada.</b> Última análise: ' + (isNaN(ger) ? '—' : dm(ger) + ' às ' + hm(ger)) + '. '
    + '<span style="color:#64748b">O robô tenta das 08h10 às 11h50 no computador que está de vez. Se nenhum estiver ligado, a análise fica para o dia seguinte (os números do plantão são recuperados; as restabelecidas deixadas na troca, não).</span></div>';
}
