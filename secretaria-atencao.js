/* ═══════════════════════════ SECRETARIA — HOJE: "PRECISA DA SUA ATENÇÃO" + ATALHOS ═══════════════════════════
   Pedido de 14/10/2026 (uso diário mais simples): no topo do painel Hoje,
   • atalhos para as tarefas do dia a dia (+ Falta, + Apoio, + Folga, + Documento, + Compromisso);
   • uma lista única do que está pendente, cada item com o botão que resolve:
     faltas sem pagamento/atestado, compromissos atrasados, férias/licenças sem portaria e, do dia 25 até o
     dia 5, o fechamento do mês (folhas de ponto + escalas).
   Depende de secretaria*.js. Emojis só por \u{...}. Prefixo _secAt / sec_at. */

const _SEC_AT_MAX = 5; // itens mostrados de cada tipo (o resto vira "ver todas")

// mês a fechar: do dia 25 em diante é o mês atual; até o dia 5 ainda é o mês anterior
function _secAtMesAFechar(hoje) {
  const dia = +hoje.slice(8, 10);
  return dia >= 25 ? hoje.slice(0, 7) : dia <= 5 ? _secEscMaisMes(hoje.slice(0, 7), -1) : '';
}

function _secCartaoAtencao() {
  const d = _secDados(), hoje = _secHoje();
  const bt = (txt, on, cor) => '<button type="button" onclick="' + on + '" style="padding:3px 9px;border-radius:4px;cursor:pointer;font-size:.76rem;font-weight:600;border:1px solid ' + (cor || '#cbd5e1') + ';background:#fff;color:' + (cor || '#334155') + ';white-space:nowrap">' + txt + '</button>';
  const linha = (cor, txt, botoes) => '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 8px;border-left:3px solid ' + cor + ';background:#fff;border-radius:3px;margin-top:5px">'
    + '<div style="font-size:.85rem;min-width:0">' + txt + '</div><div style="display:flex;gap:4px;flex-wrap:wrap">' + botoes + '</div></div>';
  const itens = [];
  // faltas pendentes
  const faltas = d.faltas.filter(f => f.status === 'pendente').sort((a, b) => a.data.localeCompare(b.data));
  faltas.slice(0, _SEC_AT_MAX).forEach(f => itens.push(linha('#b45309', 'Falta de <b>' + esc(_secNomeServ(f.servidorId, d)) + '</b> em ' + _secBRc(f.data) + ' — sem pagamento nem atestado',
    bt('Pagou', 'sec_falPagar(\'' + f.id + '\')', '#1d4ed8') + bt('\u{1F4CE} Atestado', 'sec_falAtestado(\'' + f.id + '\')', '#15803d'))));
  if (faltas.length > _SEC_AT_MAX) itens.push(linha('#b45309', '+ ' + (faltas.length - _SEC_AT_MAX) + ' falta(s) pendente(s)', bt('Ver todas', '_secFalFiltro=\'pendente\';sec_mudarAba(\'faltas\')')));
  // compromissos atrasados
  const atras = d.compromissos.filter(c => !c.concluido && c.data < hoje);
  if (atras.length) itens.push(linha('#e11d48', '<b>' + atras.length + '</b> compromisso(s) atrasado(s): ' + atras.slice(0, 3).map(c => esc(c.titulo)).join(' · ') + (atras.length > 3 ? '…' : ''), bt('Abrir agenda', 'sec_mudarAba(\'agenda\')')));
  // férias/licenças sem portaria
  const semPort = typeof _secSemPortaria === 'function' ? _secSemPortaria(d) : [];
  semPort.slice(0, _SEC_AT_MAX).forEach(a => itens.push(linha('#dc2626', esc(a.tipo) + ' de <b>' + esc(_secNomeServ(a.servidorId, d)) + '</b> (' + _secBRc(a.inicio) + ' a ' + _secBRc(a.fim || a.inicio) + ') — sem portaria anexada',
    bt('Anexar portaria', '_secPerfilId=\'' + a.servidorId + '\';_secPerfilAba=\'afastamentos\';sec_render()'))));
  // fechamento do mês
  const fechar = _secAtMesAFechar(hoje);
  if (fechar) itens.push(linha('#2563eb', 'Fechamento de <b style="text-transform:capitalize">' + esc(_secEscMesTxt(fechar)) + '</b>: folhas de ponto e escalas', bt('\u{1F4E6} Fechar o mês', 'sec_fecharMes(\'' + fechar + '\')', '#2563eb')));

  const atalho = (txt, on) => '<button type="button" onclick="' + on + '" style="padding:6px 12px;border-radius:6px;cursor:pointer;font-size:.84rem;font-weight:600;border:1px solid #cbd5e1;background:#fff;color:#0f172a">' + txt + '</button>';
  return '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ' + (itens.length ? '#b45309' : '#16a34a') + ';border-radius:6px;padding:10px 12px;margin-bottom:12px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">'
    + '<div style="font-weight:700;font-size:1rem">' + (itens.length ? '\u{1F514} Precisa da sua atenção <span style="font-weight:400;font-size:.8rem;color:#64748b">(' + itens.length + ')</span>' : '\u{2705} Tudo em dia') + '</div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap">' + atalho('+ Falta', 'sec_falNova()') + atalho('+ Apoio', 'sec_novoApoio()') + atalho('+ Folga', 'sec_novaFolga()')
    + atalho('+ Documento', 'sec_arqNovo()') + atalho('+ Compromisso', 'sec_agNovo(\'' + hoje + '\')') + '</div></div>'
    + (itens.length ? itens.join('') : '<div style="font-size:.84rem;color:#64748b;margin-top:4px">Nenhuma falta pendente, nada atrasado e todas as férias com portaria.</div>')
    + '</div>';
}
