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
  const bt = (txt, on, cor) => '<button type="button" class="idv-btn mini" onclick="' + on + '"' + (cor ? ' style="color:' + cor + ';border-color:' + cor + '"' : '') + '>' + txt + '</button>';
  const linha = (cor, txt, botoes) => '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 10px;border-left:3px solid ' + cor + ';background:var(--idv-cartao);border-bottom:1px solid var(--idv-linha)">'
    + '<div style="font-size:14px;min-width:0">' + txt + '</div><div style="display:flex;gap:4px;flex-wrap:wrap">' + botoes + '</div></div>';
  const itens = [];
  // faltas pendentes
  const faltas = d.faltas.filter(f => f.status === 'pendente').sort((a, b) => a.data.localeCompare(b.data));
  faltas.slice(0, _SEC_AT_MAX).forEach(f => itens.push(linha('var(--idv-at)', 'Falta de <b>' + esc(_secNomeServ(f.servidorId, d)) + '</b> em ' + _secBRc(f.data) + ' — sem pagamento nem atestado',
    bt('Pagou', 'sec_falPagar(\'' + f.id + '\')', 'var(--idv-in)') + bt('\u{1F4CE} Atestado', 'sec_falAtestado(\'' + f.id + '\')', 'var(--idv-ok)'))));
  if (faltas.length > _SEC_AT_MAX) itens.push(linha('var(--idv-at)', '+ ' + (faltas.length - _SEC_AT_MAX) + ' falta(s) pendente(s)', bt('Ver todas', '_secFalFiltro=\'pendente\';sec_mudarAba(\'faltas\')')));
  // compromissos atrasados
  const atras = d.compromissos.filter(c => !c.concluido && c.data < hoje);
  if (atras.length) itens.push(linha('var(--idv-cr)', '<b>' + atras.length + '</b> compromisso(s) atrasado(s): ' + atras.slice(0, 3).map(c => esc(c.titulo)).join(' · ') + (atras.length > 3 ? '…' : ''), bt('Abrir agenda', 'sec_mudarAba(\'agenda\')')));
  // férias/licenças sem portaria
  // em ordem de início (as que já estão em curso primeiro); as que não cabem viram uma linha com os nomes (21/10: o RONALDO sumia da lista)
  const semPort = (typeof _secSemPortaria === 'function' ? _secSemPortaria(d) : []).slice().sort((x, y) => String(x.inicio).localeCompare(String(y.inicio)));
  semPort.slice(0, _SEC_AT_MAX).forEach(a => itens.push(linha('var(--idv-cr)', esc(a.tipo) + ' de <b>' + esc(_secNomeServ(a.servidorId, d)) + '</b> (' + _secBRc(a.inicio) + ' a ' + _secBRc(a.fim || a.inicio) + ') — sem portaria anexada',
    bt('Anexar portaria', '_secPerfilId=\'' + a.servidorId + '\';_secPerfilAba=\'afastamentos\';sec_render()'))));
  if (semPort.length > _SEC_AT_MAX) { const outros = semPort.slice(_SEC_AT_MAX).map(a => esc(_secNomeServ(a.servidorId, d).split(' ')[0]));
    itens.push(linha('var(--idv-cr)', '+ <b>' + outros.length + '</b> férias/licença(s) sem portaria: ' + outros.slice(0, 10).join(', ') + (outros.length > 10 ? '…' : ''), bt('Ver todas', 'sec_mudarAba(\'ferias\')'))); }
  // fechamento do mês
  const fechar = _secAtMesAFechar(hoje);
  if (fechar) itens.push(linha('var(--idv-in)', 'Fechamento de <b style="text-transform:capitalize">' + esc(_secEscMesTxt(fechar)) + '</b>: folhas de ponto e escalas', bt('\u{1F4E6} Fechar o mês', 'sec_fecharMes(\'' + fechar + '\')', 'var(--idv-in)')));

  const atalho = (txt, on) => '<button type="button" class="idv-btn mini" onclick="' + on + '">' + txt + '</button>';
  return '<div class="idv-bloco' + (itens.length ? '' : ' destaque') + '" style="margin-bottom:12px">'
    + '<div class="idv-bloco-cab" style="flex-wrap:wrap">'
    + '<div>' + (itens.length ? '\u{1F514} Precisa da sua atenção <span class="idv-data" style="font-weight:400;color:var(--idv-sec)">(' + itens.length + ')</span>' : '\u{2705} Tudo em dia') + '</div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap">' + atalho('+ Falta', 'sec_falNova()') + atalho('+ Apoio', 'sec_novoApoio()') + atalho('+ Folga', 'sec_novaFolga()')
    + atalho('+ Documento', 'sec_arqNovo()') + atalho('+ Compromisso', 'sec_agNovo(\'' + hoje + '\')') + '</div></div>'
    + (itens.length ? '<div style="display:flex;flex-direction:column">' + itens.join('') + '</div>' : '<div class="idv-bloco-corpo" style="font-size:14px;color:var(--idv-sec)">Nenhuma falta pendente, nada atrasado e todas as férias com portaria.</div>')
    + '</div>';
}
