/* ═══════════════════════════ DESEMPENHO DOS PLANTÕES — RELATO DO PLANTÃO ═══════════════════════════
   Ao abrir um plantão: em vez de números soltos, um RELATO das 24 h em frases, o que precisa ser
   cobrado (com o nº das ocorrências), quem trabalhou e um gráfico por hora com os períodos parados.
   Os números técnicos de antes continuam embaixo, em "Ver todos os números do plantão".
   Depende do index (_plDia, _plDataBR, PLANTAO_CORES, pl_servidor, _plEhExpediente) e de
   plantoes-resumo.js (_plrIndicadores, _plrNota, _plrFaixa, _plrMin, _PLR_IND).
   Emojis só por \u{...}. Prefixo _pld. */

function _pldHora(iso) { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function _pldNomeOp(d, op) { const n = ((d.operadores || {})[op] || {}).nome || ('operador ' + op); return n.split(' ').filter(Boolean).slice(0, 3).join(' '); }
// nota de UM plantão, com os mesmos indicadores do resumo
function _pldIndicadoresDia(x) {
  return _plrIndicadores({ unico: true, n: 1, pop: x.pctPop, buracoMin: (x.buracos && x.buracos.totalMin) || 0,
    vdViol: (x.vd && x.vd.violacoes) || 0, vdPend: (x.vd && x.vd.pendencias.length) || 0, repasse: x.repasse != null ? x.repasse : null,
    restN: (x.restDeixadas && x.restDeixadas.n) || 0, restMed: x.restDeixadas ? 1 : 0 });
}
function _pldChegadas(x, b) {
  const ph = x.porHora || []; let n = 0;
  for (let h = new Date(b.ini); h < new Date(b.fim); h = new Date(h.getTime() + 36e5)) n += ph[h.getHours()] || 0;
  return n;
}

function _pldRelato(d, x, eq, dia, dias) {
  const cor = PLANTAO_CORES[eq] || '#1d4ed8', ind = _pldIndicadoresDia(x), nota = _plrNota(ind), f = _plrFaixa(nota);
  const amanha = (() => { const t = new Date(dia + 'T12:00:00'); t.setDate(t.getDate() + 1); return t.toISOString().slice(0, 10); })();
  const b = x.buracos || { n: 0, lista: [] }, v = x.vd, r = x.restDeixadas;
  const frases = [];
  if (x.recebidas != null) frases.push('Recebeu <b>' + x.recebidas + '</b> ocorrências: <b>' + (x.humanas ?? '—') + '</b> precisavam de operador e ' + (x.automaticas ?? '—') + ' o próprio sistema resolveu.');
  if (x.pctPop != null) frases.push('A 1ª resposta saiu <b>dentro do prazo do POP em ' + x.pctPop + '%</b> das vezes (' + x.pop.noPrazo + ' de ' + x.pop.avaliadas + ')' + (x.resp != null ? '; o tempo típico de resposta foi de <b>' + _plrMin(x.resp) + '</b>' : '') + '.');
  if (x.repasse != null) frases.push('Deixou para o próximo plantão <b>' + x.repasse + '</b> ocorrência(s) sem nenhuma ação' + (r ? ' e <b>' + r.n + '</b> já restabelecida(s) ainda aberta(s)' : ' (as restabelecidas não foram medidas nesta troca)') + '.');
  frases.push(b.n ? 'Ficou <b>sem nenhuma ação de operador</b> ' + b.lista.map(p => 'das ' + _pldHora(p.ini) + ' às ' + _pldHora(p.fim) + ' (' + _plrMin(p.min) + ', com ' + _pldChegadas(x, p) + ' ocorrências chegando)').join('; ') + '.'
    : 'Não houve período de 1 hora ou mais sem ação de operador.');
  if (v) frases.push('Violência doméstica: <b>' + v.violacoes + '</b> violação(ões)' + (v.pendencias.length ? ', <b style="color:#b91c1c">' + v.pendencias.length + ' com pendência</b> (' + [v.semAcao && v.semAcao + ' sem ação', v.foraPrazo && v.foraPrazo + ' fora do prazo', v.semRegistro && v.semRegistro + ' confirmada(s) sem registro no perfil'].filter(Boolean).join(', ') + ')' : ', todas em dia') + '.');
  const ops = x.ops.filter(op => (x.servidores[op] || {}).n || Object.values(x.porOp[op] || {}).some(n => n));
  const top = ops.slice().sort((a, c) => ((x.servidores[c] || {}).n || 0) - ((x.servidores[a] || {}).n || 0))[0];
  frases.push('Trabalharam <b>' + ops.length + '</b> servidor(es)' + (top && (x.servidores[top] || {}).n ? '; quem mais atendeu foi <b>' + esc(_pldNomeOp(d, top)) + '</b> (' + x.servidores[top].n + ')' : '') + '. Violações avaliadas: ' + x.tot.confirmadas + ' confirmada(s) e ' + x.tot.naoConfirmadas + ' não confirmada(s). Instalações: ' + x.tot.instalacao + ' · desinstalações: ' + x.tot.desinstalacao + '.');
  if (x.sens.length) { const mad = x.sens.filter(s => new Date(s.ts).getHours() < 6).length; frases.push('Ações sensíveis (reabertura, zona, cadastro, desvínculo): ' + x.sens.length + (mad ? ', <b style="color:#b91c1c">' + mad + ' de madrugada</b>' : '') + '.'); }

  const cartao = i => { const y = ind[i.k]; if (!y) return ''; const c = _plrCorBarra(y.s);
    return '<div title="' + esc(i.dica) + '" style="flex:1 1 150px;border:1px solid #e2e8f0;border-left:3px solid ' + c + ';border-radius:4px;padding:6px 10px"><div style="font-size:.72rem;color:#64748b">' + i.rot + '</div><div style="font-weight:700;color:' + c + '">' + esc(y.txt) + '</div></div>'; };
  return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px"><b style="font-size:1.15rem;color:' + cor + '">' + eq + '</b>'
    + '<select onchange="pl_detalhe(\'' + eq + '\', this.value)" style="padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px">' + dias.map(dd => '<option value="' + dd + '"' + (dd === dia ? ' selected' : '') + '>Plantão de ' + _plDataBR(dd) + (_plDia(d, dd).parcial ? ' (em andamento)' : '') + '</option>').join('') + '</select>'
    + '<span style="font-size:.8rem;color:#64748b">08h de ' + _plDataBR(dia) + ' às 08h de ' + _plDataBR(amanha) + '</span><div style="flex:1"></div>'
    + '<span style="font-size:1.8rem;font-weight:700;color:' + f.cor + ';line-height:1">' + (nota == null ? '—' : nota.toFixed(1).replace('.', ',')) + '</span>'
    + '<span style="font-size:.72rem;font-weight:600;text-transform:uppercase;padding:2px 7px;border-radius:3px;border-left:2px solid ' + f.cor + ';background:' + f.fundo + ';color:' + f.cor + '">' + f.rot + '</span></div>'
    + (x.parcial ? '<div style="font-size:.8rem;color:#b45309;margin-bottom:8px">\u{23F3} Plantão em andamento — números parciais.</div>' : '')
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' + _PLR_IND.map(cartao).join('') + '</div>'
    + '<div style="font-weight:700;margin-bottom:4px">\u{1F4DD} O que aconteceu nas 24 horas</div>'
    + '<ul style="margin:0 0 14px 18px;padding:0;font-size:.88rem;line-height:1.6">' + frases.map(t => '<li>' + t + '</li>').join('') + '</ul>'
    + _pldCobrar(d, x)
    + _pldGraficoHora(x)
    + _pldQuemTrabalhou(d, x, eq, dia, ops);
}

// ── O que cobrar (com o nº da ocorrência) ─────────────────────────────────────
function _pldCobrar(d, x) {
  const v = x.vd, r = x.restDeixadas, itens = [];
  const ROT = { SISTEMA: 'arquivada só pelo sistema', SEM_ACAO: 'sem ação', FORA_PRAZO: 'fora do prazo', SEM_REGISTRO: 'sem registro no perfil' };
  if (v && v.pendencias.length) {
    const ordem = p => (p.fl.includes('SEM_ACAO') || p.fl.includes('SISTEMA')) ? 0 : p.fl.includes('FORA_PRAZO') ? 1 : 2;
    const lst = v.pendencias.slice().sort((a, b) => ordem(a) - ordem(b) || (a.d < b.d ? -1 : 1));
    itens.push('<div style="margin-bottom:8px"><b style="color:#6d28d9">Violência doméstica com pendência (' + lst.length + ')</b>'
      + '<div style="font-size:.8rem;line-height:1.6;margin-top:2px">' + lst.slice(0, 12).map(p => '<span style="display:inline-block;margin:0 10px 2px 0"><span style="font-family:var(--font-mono)">#' + esc(p.id) + '</span> '
        + esc((p.nome || '').split(' ').slice(0, 2).join(' ')) + ' <span style="color:#b91c1c">' + p.fl.map(k => ROT[k] || k).join(' + ') + '</span>' + (p.op ? ' <span style="color:#64748b">(' + esc(_pldNomeOp(d, p.op)) + ')</span>' : '') + '</span>').join('')
      + (lst.length > 12 ? '<span style="color:#64748b">… e mais ' + (lst.length - 12) + ' em "Ver todos os números".</span>' : '') + '</div></div>');
  }
  if (r && r.n) itens.push('<div style="margin-bottom:8px"><b style="color:#c2410c">Restabelecidas deixadas abertas (' + r.n + ')</b><div style="font-size:.8rem;line-height:1.6;margin-top:2px">'
    + r.lista.slice(0, 20).map(o => '<span style="display:inline-block;margin:0 10px 2px 0"><span style="font-family:var(--font-mono)">#' + esc(o.id) + '</span> ' + esc(o.t.split(' ').slice(0, 4).join(' ')) + (o.est === 'Aberto' ? ' <span style="color:#b91c1c">(ninguém pegou)</span>' : '') + '</span>').join('') + '</div></div>');
  if (x.repasse) itens.push('<div style="margin-bottom:8px"><b style="color:#b45309">Sem nenhuma ação até a troca: ' + x.repasse + '</b> <span style="font-size:.78rem;color:#64748b">(ocorrências que precisavam de operador e ninguém mexeu até as 08h)</span></div>');
  if (!itens.length) return '<div style="border:1px solid #bbf7d0;border-left:4px solid #16a34a;border-radius:6px;padding:8px 12px;margin-bottom:14px;font-size:.88rem;color:#15803d">\u{2705} Nada pendente para cobrar deste plantão.</div>';
  return '<div style="border:1px solid #fed7aa;border-left:4px solid #ea580c;border-radius:6px;padding:8px 12px;margin-bottom:14px"><div style="font-weight:700;margin-bottom:6px">\u{1F4CC} Para cobrar</div>' + itens.join('') + '</div>';
}

// ── Gráfico por hora: chegadas, com os períodos parados em vermelho ──────────
function _pldGraficoHora(x) {
  const ph = x.porHora; if (!ph) return '';
  const ordem = Array.from({ length: 24 }, (_, i) => (i + 8) % 24), mx = Math.max(1, ...ph), b = (x.buracos && x.buracos.lista) || [];
  const parada = h => b.some(p => { for (let t = new Date(p.ini); t < new Date(p.fim); t = new Date(t.getTime() + 36e5)) if (t.getHours() === h) return true; return false; });
  return '<div style="margin-bottom:14px"><div style="font-weight:700;margin-bottom:4px">\u{1F552} Ocorrências que chegaram, hora a hora <span style="font-weight:400;font-size:.75rem;color:#64748b">— em vermelho, horas com período sem nenhuma ação</span></div>'
    + '<div style="display:flex;align-items:flex-end;gap:2px;height:70px">' + ordem.map(h => '<div title="' + String(h).padStart(2, '0') + 'h: ' + ph[h] + ' ocorrência(s)' + (parada(h) ? ' — período parado' : '') + '" style="flex:1;height:' + Math.max(2, Math.round(ph[h] / mx * 100)) + '%;background:' + (parada(h) ? '#dc2626' : '#93c5fd') + ';border-radius:2px 2px 0 0"></div>').join('') + '</div>'
    + '<div style="display:flex;gap:2px;font-size:.62rem;color:#94a3b8">' + ordem.map(h => '<div style="flex:1;text-align:center">' + (h % 3 === 2 ? String(h).padStart(2, '0') : '') + '</div>').join('') + '</div></div>';
}

// ── Quem trabalhou (versão simples; a tabela completa fica nos números) ──────
function _pldQuemTrabalhou(d, x, eq, dia, ops) {
  if (!ops.length) return '';
  const pend = {}; ((x.vd && x.vd.pendencias) || []).forEach(p => { if (p.op) pend[p.op] = (pend[p.op] || 0) + 1; });
  const lin = ops.map(op => { const sv = x.servidores[op] || {}, o = x.porOp[op] || {};
    return { op, n: sv.n || 0, pct: sv.pop ? Math.round(sv.popOk / sv.pop * 100) : null, med: sv.med, vd: sv.vd || 0, vdP: pend[op] || 0, inst: (o.instalacao || 0) + (o.desinstalacao || 0), conf: (o.confirmadas || 0) + (o.naoConfirmadas || 0) }; })
    .map(l => { const sec = typeof _plsServidorSecretaria === 'function' ? _plsServidorSecretaria(((d.operadores || {})[l.op] || {}).nome) : null; return Object.assign(l, { eqFolha: sec && sec.equipe ? sec.equipe : '' }); })
    .sort((a, b) => ((a.eqFolha && a.eqFolha !== eq) - (b.eqFolha && b.eqFolha !== eq)) || b.n - a.n || b.inst - a.inst);
  const tot = lin.reduce((s, l) => s + l.n, 0) || 1;
  const td = (v, s) => '<td style="padding:5px 6px;' + (s || '') + '">' + v + '</td>';
  return '<div style="font-weight:700;margin-bottom:4px">\u{1F465} Quem trabalhou <span style="font-weight:400;font-size:.75rem;color:#64748b">— clique no nome para ver cada ocorrência que ele atendeu</span></div>'
    + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.82rem"><thead><tr style="color:#64748b;text-align:left">'
    + ['Servidor', 'Atendeu primeiro', 'No prazo', 'Tempo típico', 'Violência doméstica', 'Violações avaliadas', 'Instal. / desinst.'].map(h => '<th style="padding:4px 6px;font-weight:600">' + h + '</th>').join('') + '</tr></thead><tbody>'
    + lin.map(l => '<tr style="border-top:1px solid #f1f5f9">'
      + td('<a href="#" onclick="pl_servidor(\'' + eq + '\', \'' + dia + '\', \'' + l.op + '\');return false" style="color:#1d4ed8;font-weight:600">' + esc(_pldNomeOp(d, l.op)) + '</a>'
        + (l.eqFolha && l.eqFolha !== eq ? '<div style="font-size:.7rem;color:#b45309">de outra equipe: ' + esc(l.eqFolha === 'EXPEDIENTE' ? 'Expediente' : l.eqFolha) + ' (apoio ou antes/depois da troca)</div>' : ''))
      + td('<div style="display:flex;align-items:center;gap:6px"><b style="min-width:26px">' + l.n + '</b><div style="flex:1;min-width:60px;height:6px;background:#f1f5f9;border-radius:2px"><div style="height:100%;width:' + Math.round(l.n / tot * 100) + '%;background:#3b82f6;border-radius:2px"></div></div></div>')
      + td(l.pct != null ? '<b style="color:' + _plrCorBarra(l.pct / 100) + '">' + l.pct + '%</b>' : '—')
      + td(l.med != null ? _plrMin(l.med) : '—', 'font-family:var(--font-mono)')
      + td(l.vd ? l.vd + ' atendida(s)' + (l.vdP ? ' · <span style="color:#b91c1c">' + l.vdP + ' com pendência</span>' : '') : '—')
      + td(l.conf || '—', 'font-family:var(--font-mono)') + td(l.inst || '—', 'font-family:var(--font-mono)') + '</tr>').join('')
    + '</tbody></table></div>';
}
