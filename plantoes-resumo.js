/* ═══════════════════════════ DESEMPENHO DOS PLANTÕES — RESUMO SIMPLES ═══════════════════════════
   Em vez de dezenas de números: uma NOTA de 0 a 10 por plantão (com cor), 4 indicadores em
   português claro e uma frase dizendo quem foi melhor e quem precisa de atenção.
   Os números completos (cartões e tabela de sempre) ficam atrás de "Ver todos os números".
   Usa a média do período escolhido em "Comparar" (calculada em pl_renderizar → lin).
   Emojis só por \u{...}. Prefixo _plr (não colidir com o index). */

const _PLR_PARADO_ZERO = 180; // minutos parado por plantão que zeram o indicador "tempo parado"
const _PLR_IND = [
  { k: 'pop', rot: 'Agiu no prazo', peso: 0.4, dica: '1ª ação do operador dentro do prazo do POP' },
  { k: 'trat', rot: 'Ocorrências resolvidas', peso: 0.2, dica: 'ocorrências arquivadas no AKILES' },
  { k: 'parado', rot: 'Tempo parado', peso: 0.2, dica: 'períodos de 1h ou mais sem nenhuma ação de operador' },
  { k: 'vd', rot: 'Violência doméstica em dia', peso: 0.2, dica: 'violações de VD sem pendência (ação, prazo do POP e registro no perfil)' },
];
let _plrVerTudo = false;

function _plrMin(m) { m = Math.round(m); if (m < 60) return m + ' min'; const h = Math.floor(m / 60), r = m % 60; return h + 'h' + (r ? ' ' + String(r).padStart(2, '0') + 'min' : ''); }
function _plrClamp(v) { return Math.max(0, Math.min(1, v)); }
// valores de 0 a 1 (1 = ótimo) e o texto de cada indicador
function _plrIndicadores(l) {
  const parado = l.n ? l.buracoMin / l.n : null;
  return {
    pop: l.pop != null ? { s: l.pop / 100, txt: l.pop + '%' } : null,
    trat: l.pct != null ? { s: l.pct / 100, txt: l.pct + '%' } : null,
    parado: parado != null ? { s: _plrClamp(1 - parado / _PLR_PARADO_ZERO), txt: parado ? _plrMin(parado) + ' por plantão' : 'nenhum' } : null,
    vd: l.vdViol ? { s: _plrClamp(1 - l.vdPend / l.vdViol), txt: Math.round((1 - l.vdPend / l.vdViol) * 100) + '% em dia' } : null,
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
  trat: x => 'deixou ocorrências sem resolver (' + x.txt + ' resolvidas)',
  parado: x => 'ficou tempo sem nenhuma ação (' + x.txt + ')',
  vd: x => 'deixou casos de violência doméstica com pendência (só ' + x.txt + ')',
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
  cards.style.display = comp.style.display = _plrVerTudo ? '' : 'none';
  if (!eqs.length) { box.innerHTML = ''; return; }
  const melhor = eqs[0], pior = eqs[eqs.length - 1], piorInd = _plrPior(pior.ind);
  const nome = eq => '<b style="color:' + (PLANTAO_CORES[eq] || '#1d4ed8') + '">' + eq + '</b>';
  const fmtNota = n => n == null ? '—' : n.toFixed(1).replace('.', ',');
  const frase = 'Nos últimos ' + nd + ' dias, o melhor plantão foi ' + nome(melhor.eq) + ' (nota ' + fmtNota(melhor.nota) + ').'
    + (eqs.length > 1 && piorInd && pior.ind[piorInd.k].s < 0.8 ? ' Precisa de mais atenção: ' + nome(pior.eq) + ', que ' + _PLR_FRASE[piorInd.k](pior.ind[piorInd.k]) + '.' : '');
  box.innerHTML = '<div style="font-size:.95rem;line-height:1.5;padding:10px 14px;background:#f8fafc;border-left:4px solid #2563eb;border-radius:4px;margin-bottom:12px">' + frase + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">'
    + eqs.map((l, i) => _plrCartao(l, i + 1, fmtNota)).join('') + '</div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px">'
    + '<div style="font-size:.72rem;color:#94a3b8">Nota de 0 a 10 = prazo do POP (40%) + ocorrências resolvidas (20%) + tempo parado (20%; ' + _plrMin(_PLR_PARADO_ZERO) + ' parado por plantão zera) + violência doméstica em dia (20%). Clique num plantão para ver o detalhe.</div>'
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
