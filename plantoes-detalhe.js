/* ═══════════════════════════ DESEMPENHO DOS PLANTÕES — DETALHE DO PLANTÃO ═══════════════════════════
   Ao abrir um plantão (enxugado em 16/10/2026, foco em VIOLÊNCIA DOMÉSTICA):
   nota + 4 indicadores · bloco de VD (decisão no prazo, tempo até decidir, sem decisão) · "Para cobrar"
   (só VD e restabelecidas fora do limite das 04h) · "Quem trabalhou" pela VD que cada servidor decidiu.
   O relato das 24 h, o gráfico hora a hora e os números técnicos ficam em "Outros números do plantão" (_pldOutros).
   Depende do index (_plDia, _plDataBR, PLANTAO_CORES, pl_servidor) e de
   plantoes-resumo.js (_plrIndicadores, _plrNota, _plrFaixa, _plrMin, _plrCorBarra, _PLR_IND).
   Emojis só por \u{...}. Prefixo _pld. */

function _pldHora(iso) { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function _pldNomeOp(d, op) { const n = ((d.operadores || {})[op] || {}).nome || ('operador ' + op); return n.split(' ').filter(Boolean).slice(0, 3).join(' '); }
// nota de UM plantão, com os mesmos indicadores do resumo
function _pldIndicadoresDia(x) {
  const v = x.vd, r = x.restLimite, mede = !!(v && v.medeDecisao);
  return _plrIndicadores({ unico: true, n: 1, pop: x.pctPop,
    vdDias: mede ? 1 : 0, vdMedViol: mede ? v.violacoes : 0, vdDecOk: mede ? v.decNoPrazo || 0 : 0, vdSem: mede ? v.semDecisao || 0 : 0,
    vdDecMeds: mede && v.decMedMin != null ? [v.decMedMin] : [],
    restLimN: r ? r.n : 0, restLimDias: r ? 1 : 0, restLimSo08: r && r.so08 ? 1 : 0 });
}
function _pldChegadas(x, b) {
  const ph = x.porHora || []; let n = 0;
  for (let h = new Date(b.ini); h < new Date(b.fim); h = new Date(h.getTime() + 36e5)) n += ph[h.getHours()] || 0;
  return n;
}
// servidores do plantão + quem só decidiu VD (pode não ter sido o 1º a agir)
function _pldOpsComTrabalho(x) {
  const sv = x.servidores || {}, ops = x.ops.slice();
  Object.keys(sv).forEach(op => { if (!ops.includes(op) && (sv[op].vdDec || sv[op].n)) ops.push(op); });
  return ops.filter(op => (sv[op] || {}).n || (sv[op] || {}).vdDec || Object.values(x.porOp[op] || {}).some(n => n));
}

function _pldRelato(d, x, eq, dia, dias) {
  const cor = PLANTAO_CORES[eq] || '#1d4ed8', ind = _pldIndicadoresDia(x), nota = _plrNota(ind), f = _plrFaixa(nota);
  const amanha = (() => { const t = new Date(dia + 'T12:00:00'); t.setDate(t.getDate() + 1); return t.toISOString().slice(0, 10); })();
  const cartao = i => { const y = ind[i.k]; if (!y) return ''; const c = _plrCorBarra(y.s);
    return '<div title="' + esc(i.dica) + '" style="flex:1 1 150px;border:1px solid #e2e8f0;border-left:3px solid ' + c + ';border-radius:4px;padding:6px 10px"><div style="font-size:.72rem;color:#64748b">' + i.rot + '</div><div style="font-weight:700;color:' + c + '">' + esc(y.txt) + '</div>'
      + (y.det ? '<div style="font-size:.68rem;color:#94a3b8">' + esc(y.det) + '</div>' : '') + '</div>'; };
  return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px"><b style="font-size:1.15rem;color:' + cor + '">' + eq + '</b>'
    + '<select onchange="pl_detalhe(\'' + eq + '\', this.value)" style="padding:4px 6px;border:1px solid #cbd5e1;border-radius:6px">' + dias.map(dd => '<option value="' + dd + '"' + (dd === dia ? ' selected' : '') + '>Plantão de ' + _plDataBR(dd) + (_plDia(d, dd).parcial ? ' (em andamento)' : '') + '</option>').join('') + '</select>'
    + '<span style="font-size:.8rem;color:#64748b">08h de ' + _plDataBR(dia) + ' às 08h de ' + _plDataBR(amanha) + '</span><div style="flex:1"></div>'
    + '<span style="font-size:1.8rem;font-weight:700;color:' + f.cor + ';line-height:1">' + (nota == null ? '—' : nota.toFixed(1).replace('.', ',')) + '</span>'
    + '<span style="font-size:.72rem;font-weight:600;text-transform:uppercase;padding:2px 7px;border-radius:3px;border-left:2px solid ' + f.cor + ';background:' + f.fundo + ';color:' + f.cor + '">' + f.rot + '</span></div>'
    + (x.parcial ? '<div style="font-size:.8rem;color:#b45309;margin-bottom:8px">\u{23F3} Plantão em andamento — números parciais.</div>' : '')
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">' + _PLR_IND.map(cartao).join('') + '</div>'
    + _pldVD(x)
    + _pldCobrar(d, x)
    + _pldQuemTrabalhou(d, x, eq, dia, _pldOpsComTrabalho(x));
}

// ── Violência doméstica: o destaque do plantão ───────────────────────────────
function _pldVD(x) {
  const v = x.vd;
  if (!v || !v.violacoes) return '<div id="pld-vd" style="border:1px solid #ddd6fe;border-left:4px solid #7c3aed;border-radius:6px;padding:8px 12px;margin-bottom:14px;font-size:.88rem;color:#64748b">\u{1F6E1}\u{FE0F} Nenhuma violação de violência doméstica com prazo no POP neste plantão.</div>';
  const pct = v.medeDecisao ? Math.round((v.decNoPrazo || 0) / v.violacoes * 100) : null;
  const frases = ['<b>' + v.violacoes + '</b> violação(ões) de violência doméstica: <b>' + v.confirmadas + '</b> confirmada(s) e <b>' + (v.naoConfirmadas != null ? v.naoConfirmadas : '—') + '</b> não confirmada(s).'];
  if (v.medeDecisao) {
    frases.push('Decididas (confirmada ou não confirmada) <b style="color:' + _plrCorBarra(pct / 100) + '">dentro do prazo do POP: ' + (v.decNoPrazo || 0) + ' de ' + v.violacoes + ' (' + pct + '%)</b>'
      + (v.decMedMin != null ? '; o tempo típico até decidir foi de <b>' + _plrMin(v.decMedMin) + '</b>' : '') + '.');
    frases.push(v.semDecisao ? '<b style="color:#b91c1c">' + v.semDecisao + ' ficaram sem decisão</b> (ninguém confirmou nem negou).' : 'Nenhuma ficou sem decisão.');
  } else frases.push('<span style="color:#64748b">A hora da decisão não foi medida neste plantão (o robô passou a guardá-la em 16/10/2026, relendo os 15 dias anteriores).</span>');
  return '<div id="pld-vd" style="border:1px solid #ddd6fe;border-left:4px solid #7c3aed;border-radius:6px;padding:8px 12px;margin-bottom:14px">'
    + '<div style="font-weight:700;color:#6d28d9;margin-bottom:4px">\u{1F6E1}\u{FE0F} Violência doméstica</div>'
    + '<ul style="margin:0 0 0 18px;padding:0;font-size:.88rem;line-height:1.6">' + frases.map(t => '<li>' + t + '</li>').join('') + '</ul>'
    + '<div style="font-size:.7rem;color:#94a3b8;margin-top:4px">Prazo do POP para VD: 1h zona de exclusão, botão e proximidade · 12h zona de inclusão · 24h pulseira e bateria. Conta do início da violação até o servidor marcar "6. violação confirmada" ou "7. violação não confirmada".</div></div>';
}

// ── O que cobrar (com o nº da ocorrência) — só VD e restabelecidas ───────────
function _pldCobrar(d, x) {
  const v = x.vd, r = x.restLimite, itens = [];
  const pend = (v && v.pendencias) || [], tem = (p, re) => p.fl.some(k => re.test(k));
  const nomeCurto = p => esc((p.nome || '').split(' ').slice(0, 2).join(' '));
  const quem = p => p.op ? ' <span style="color:#64748b">(' + esc(_pldNomeOp(d, p.op)) + ')</span>' : '';
  const grupo = (tit, cor, lst, fmt) => !lst.length ? '' : '<div style="margin-bottom:8px"><b style="color:' + cor + '">' + tit + ' (' + lst.length + ')</b>'
    + '<div style="font-size:.8rem;line-height:1.6;margin-top:2px">' + lst.slice(0, 15).map(p => '<span style="display:inline-block;margin:0 12px 2px 0"><span style="font-family:var(--font-mono)">#' + esc(p.id) + '</span> ' + fmt(p) + '</span>').join('')
    + (lst.length > 15 ? '<span style="color:#64748b">… e mais ' + (lst.length - 15) + ' em "Outros números do plantão".</span>' : '') + '</div></div>';
  itens.push(grupo('VD sem decisão — ninguém confirmou nem negou', '#b91c1c', pend.filter(p => tem(p, /SEM_DECISAO|SISTEMA|SEM_ACAO/)),
    p => nomeCurto(p) + ' <span style="color:#64748b">' + esc(String(p.t || '').split(' ').slice(0, 4).join(' ')) + '</span>'));
  itens.push(grupo('VD decidida fora do prazo', '#c2410c', pend.filter(p => tem(p, /FORA_PRAZO/)),
    p => nomeCurto(p) + ' <span style="color:#b91c1c">' + (p.min != null ? _plrMin(p.min) : '—') + '</span> <span style="color:#94a3b8">(prazo ' + p.sla + 'h)</span>' + quem(p)));
  if (r && r.n) itens.push('<div style="margin-bottom:8px"><b style="color:#c2410c">Restabelecidas fora do limite (' + r.n + ')</b>'
    + (r.so08 ? ' <span style="font-size:.75rem;color:#64748b">— sem a foto das 04h: medido só na troca das 08h</span>' : '')
    + '<div style="font-size:.8rem;line-height:1.6;margin-top:2px">' + (r.lista || []).slice(0, 20).map(o => '<span style="display:inline-block;margin:0 12px 2px 0"><span style="font-family:var(--font-mono)">#' + esc(o.id) + '</span> ' + esc(String(o.t || '').split(' ').slice(0, 4).join(' '))
      + ' <span style="color:#94a3b8">' + (o.h04 ? 'aberta às 04h' : 'aberta na troca') + '</span>' + (o.est === 'Aberto' ? ' <span style="color:#b91c1c">(ninguém pegou)</span>' : '') + '</span>').join('')
    + (r.n > 20 ? '<span style="color:#64748b">… e mais ' + (r.n - 20) + '.</span>' : '') + '</div></div>');
  itens.push(grupo('VD confirmada sem registro no perfil', '#a16207', pend.filter(p => tem(p, /SEM_REGISTRO/)), p => nomeCurto(p) + quem(p)));
  const html = itens.filter(Boolean).join('');
  if (!html) return '<div style="border:1px solid #bbf7d0;border-left:4px solid #16a34a;border-radius:6px;padding:8px 12px;margin-bottom:14px;font-size:.88rem;color:#15803d">\u{2705} Nada pendente para cobrar deste plantão.</div>';
  return '<div style="border:1px solid #fed7aa;border-left:4px solid #ea580c;border-radius:6px;padding:8px 12px;margin-bottom:14px"><div style="font-weight:700;margin-bottom:6px">\u{1F4CC} Para cobrar</div>' + html + '</div>';
}

// ── Quem trabalhou: a VD que cada servidor decidiu ───────────────────────────
function _pldQuemTrabalhou(d, x, eq, dia, ops) {
  if (!ops.length) return '';
  const pend = {}; ((x.vd && x.vd.pendencias) || []).forEach(p => { if (p.op) pend[p.op] = (pend[p.op] || 0) + 1; });
  const lin = ops.map(op => { const sv = x.servidores[op] || {};
    return { op, n: sv.n || 0, dec: sv.vdDec || 0, ok: sv.vdDecOk || 0, med: sv.vdDecMed, vdP: pend[op] || 0 }; })
    .map(l => { const sec = typeof _plsServidorSecretaria === 'function' ? _plsServidorSecretaria(((d.operadores || {})[l.op] || {}).nome) : null; return Object.assign(l, { eqFolha: sec && sec.equipe ? sec.equipe : '' }); })
    .sort((a, b) => ((a.eqFolha && a.eqFolha !== eq) - (b.eqFolha && b.eqFolha !== eq)) || b.dec - a.dec || b.n - a.n);
  const td = (v, s) => '<td style="padding:5px 6px;' + (s || '') + '">' + v + '</td>';
  return '<div style="font-weight:700;margin-bottom:4px">\u{1F465} Quem trabalhou <span style="font-weight:400;font-size:.75rem;color:#64748b">— clique no nome para ver cada ocorrência que ele atendeu</span></div>'
    + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.82rem"><thead><tr style="color:#64748b;text-align:left">'
    + ['Servidor', 'VD que decidiu', 'No prazo', 'Tempo típico até decidir', 'VD com pendência', 'Atendeu (total)'].map(h => '<th style="padding:4px 6px;font-weight:600">' + h + '</th>').join('') + '</tr></thead><tbody>'
    + lin.map(l => '<tr style="border-top:1px solid #f1f5f9">'
      + td('<a href="#" onclick="pl_servidor(\'' + eq + '\', \'' + dia + '\', \'' + l.op + '\');return false" style="color:#1d4ed8;font-weight:600">' + esc(_pldNomeOp(d, l.op)) + '</a>'
        + (l.eqFolha && l.eqFolha !== eq ? '<div style="font-size:.7rem;color:#b45309">de outra equipe: ' + esc(l.eqFolha === 'EXPEDIENTE' ? 'Expediente' : l.eqFolha) + ' (apoio ou antes/depois da troca)</div>' : ''))
      + td(l.dec ? '<b>' + l.dec + '</b>' : '—', 'font-family:var(--font-mono)')
      + td(l.dec ? '<b style="color:' + _plrCorBarra(l.ok / l.dec) + '">' + Math.round(l.ok / l.dec * 100) + '%</b> <span style="color:#94a3b8;font-size:.75rem">(' + l.ok + ')</span>' : '—')
      + td(l.med != null ? _plrMin(l.med) : '—', 'font-family:var(--font-mono)')
      + td(l.vdP ? '<span style="color:#b91c1c;font-weight:600">' + l.vdP + '</span>' : '—', 'font-family:var(--font-mono)')
      + td(l.n || '—', 'font-family:var(--font-mono)') + '</tr>').join('')
    + '</tbody></table></div>';
}

// ── Recolhido em "Outros números do plantão": relato das 24 h + gráfico por hora ──
function _pldOutros(d, x) {
  const b = x.buracos || { n: 0, lista: [] }, ops = _pldOpsComTrabalho(x), frases = [];
  if (x.recebidas != null) frases.push('Recebeu <b>' + x.recebidas + '</b> ocorrências: <b>' + (x.humanas ?? '—') + '</b> precisavam de operador e ' + (x.automaticas ?? '—') + ' o próprio sistema resolveu.');
  if (x.pctPop != null) frases.push('A 1ª resposta saiu dentro do prazo do POP em <b>' + x.pctPop + '%</b> das vezes (' + x.pop.noPrazo + ' de ' + x.pop.avaliadas + ')' + (x.resp != null ? '; tempo típico de resposta: ' + _plrMin(x.resp) : '') + '.');
  if (x.repasse != null) frases.push('Deixou para o próximo plantão <b>' + x.repasse + '</b> ocorrência(s) sem nenhuma ação de operador.');
  frases.push(b.n ? 'Tempo sem nenhuma ação de operador: ' + b.lista.map(p => 'das ' + _pldHora(p.ini) + ' às ' + _pldHora(p.fim) + ' (' + _plrMin(p.min) + ', com ' + _pldChegadas(x, p) + ' ocorrências chegando)').join('; ') + '.'
    : 'Não houve período de 1 hora ou mais sem ação de operador.');
  frases.push('Trabalharam <b>' + ops.length + '</b> servidor(es). Violações avaliadas: ' + x.tot.confirmadas + ' confirmada(s) e ' + x.tot.naoConfirmadas + ' não confirmada(s). Instalações: ' + x.tot.instalacao + ' · desinstalações: ' + x.tot.desinstalacao + '.');
  if (x.sens.length) { const mad = x.sens.filter(s => new Date(s.ts).getHours() < 6).length; frases.push('Ações sensíveis (reabertura, zona, cadastro, desvínculo): ' + x.sens.length + (mad ? ', ' + mad + ' de madrugada' : '') + '.'); }
  return '<div style="font-weight:700;margin-bottom:4px">\u{1F4DD} O que aconteceu nas 24 horas</div>'
    + '<ul style="margin:0 0 14px 18px;padding:0;font-size:.85rem;line-height:1.6">' + frases.map(t => '<li>' + t + '</li>').join('') + '</ul>'
    + _pldGraficoHora(x);
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
