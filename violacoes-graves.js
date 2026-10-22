/* ═══════════════════════════ GERÊNCIA — VIOLAÇÕES GRAVES DO PLANTÃO ═══════════════════════════
   As violações mais graves de cada plantão (08h às 08h): proximidade do agressor com a vítima,
   zona de exclusão, botão de segurança, rompimento da pulseira e bloqueio por metal — com a decisão
   do operador (6 confirmada / 7 não confirmada), quem decidiu e se foi no prazo do POP.
   Atualizado pelo robô todo dia de manhã, 08h10 (atualizar-plantoes.js → plantoes-akiles.js, só leitura
   no AKILES); vem dentro de cme_plantao_auto (turnos[dia].graves.lista; o banco só entrega à gerência
   e ao administrador). Últimos 7 plantões. Só leitura. Emojis só por \u{...}. Prefixo _vgr. */

let _vgrDia = '', _vgrTipo = '', _vgrSoProblema = false;

const _VGR_TIPOS = [
  { k: 'prox', rot: 'Proximidade com a vítima', re: /proximidade com dispositivo de seguran/i },
  { k: 'botao', rot: 'Botão de segurança', re: /Bot[ãa]o de seguran/i },
  { k: 'excl', rot: 'Zona de exclusão', re: /^Zona de Exclus/i },
  { k: 'romp', rot: 'Rompimento da pulseira', re: /integridade da pulseira/i },
  { k: 'metal', rot: 'Bloqueio por metal', re: /Bloqueio de dispositivo por metal/i },
];

function _vgrDados() { return carregarStore('plantao_auto', null); }
function _vgrTipoDe(o) { return _VGR_TIPOS.find(t => t.re.test(o.t)) || { k: 'outro', rot: o.t }; }
function _vgrBR(dia) { const m = String(dia || '').match(/^\d{4}-(\d{2})-(\d{2})/); return m ? m[2] + '/' + m[1] : '—'; }
function _vgrHora(iso) { const d = iso ? new Date(iso) : null; return d && !isNaN(d) ? d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '—'; }
function _vgrTempo(min) { if (min == null) return '—'; if (min < 60) return min + ' min'; const h = Math.floor(min / 60), m = min % 60; return h + ' h' + (m ? ' ' + String(m).padStart(2, '0') : ''); }
function _vgrNomeOp(d, op) { if (!op) return ''; const n = ((d.operadores || {})[op] || {}).nome || ('operador ' + op); return n.split(' ').filter(Boolean).slice(0, 3).join(' '); }
// problema de tratamento: ninguém decidiu, ou decidiu fora do prazo do POP
function _vgrSemDecisao(o) { return o.dec !== '6' && o.dec !== '7'; }
function _vgrForaPrazo(o) { return !_vgrSemDecisao(o) && o.sla != null && o.min != null && o.min > o.sla * 60; }
function _vgrProblema(o) { return _vgrSemDecisao(o) || _vgrForaPrazo(o); }

// plantões com a lista (o plantão em andamento na hora da coleta fica de fora: está pela metade)
function _vgrPlantoes(d) {
  const atual = (d.plantaoAtual || {}).dia;
  return Object.entries(d.turnos || {}).filter(([dia, t]) => dia !== atual && t.graves && Array.isArray(t.graves.lista))
    .sort((a, b) => b[0].localeCompare(a[0])).map(([dia, t]) => ({ dia, equipe: t.equipe || '', lista: t.graves.lista }));
}

function vgr_render() {
  const box = document.getElementById('vgr-corpo'); if (!box) return;
  if (!['admin', 'gerencia'].includes(usuarioAtual?.nivel)) { box.innerHTML = '<div class="idv-vazio">Acesso restrito à Gerência.</div>'; return; }
  const d = _vgrDados(), pls = d ? _vgrPlantoes(d) : [];
  if (!pls.length) { box.innerHTML = '<div class="idv-vazio">Aguardando a 1ª coleta do robô (todo dia às 08h10, junto com a análise da troca de plantão).</div>'; return; }
  if (!pls.some(p => p.dia === _vgrDia)) _vgrDia = pls[0].dia;
  const pl = pls.find(p => p.dia === _vgrDia), lista = pl.lista;
  const semDec = lista.filter(_vgrSemDecisao).length, fora = lista.filter(_vgrForaPrazo).length, conf = lista.filter(o => o.dec === '6').length;
  const prox = lista.filter(o => _vgrTipoDe(o).k === 'prox').length;
  const achado = lista.length
    ? '<b class="idv-data" style="color:var(--idv-cr);font-size:20px;font-weight:600">' + lista.length + '</b> violações graves no plantão de ' + _vgrBR(pl.dia) + (pl.equipe ? ' (' + esc(pl.equipe) + ')' : '')
      + ' — <b>' + conf + '</b> confirmada(s)' + (prox ? ', <b style="color:var(--idv-cr)">' + prox + '</b> de proximidade do agressor com a vítima' : '') + '.'
      + (semDec || fora ? '<div style="margin-top:4px">' + (semDec ? '<b style="color:var(--idv-cr)">' + semDec + '</b> sem decisão do operador (6 ou 7)' : '') + (semDec && fora ? ' · ' : '')
        + (fora ? '<b style="color:var(--idv-cr)">' + fora + '</b> decidida(s) fora do prazo do POP' : '') + '.</div>' : '<div style="margin-top:4px">Todas decididas dentro do prazo do POP.</div>')
    : 'Nenhuma violação grave no plantão de ' + _vgrBR(pl.dia) + '.';
  const chipsPl = pls.map(p => '<button type="button" class="idv-chip' + (p.dia === _vgrDia ? ' ativo' : '') + '" onclick="_vgrDia=\'' + p.dia + '\';vgr_render()">'
    + _vgrBR(p.dia) + (p.equipe ? ' ' + esc(p.equipe) : '') + ' <span class="idv-n">' + p.lista.length + '</span></button>').join('');
  const cont = {}; lista.forEach(o => { const k = _vgrTipoDe(o).k; cont[k] = (cont[k] || 0) + 1; });
  const chipsTipo = '<button type="button" class="idv-chip' + (!_vgrTipo ? ' ativo' : '') + '" onclick="_vgrTipo=\'\';vgr_render()">Todas <span class="idv-n">' + lista.length + '</span></button>'
    + _VGR_TIPOS.filter(t => cont[t.k]).map(t => '<button type="button" class="idv-chip' + (_vgrTipo === t.k ? ' ativo' : '') + '" onclick="_vgrTipo=\'' + t.k + '\';vgr_render()">' + t.rot + ' <span class="idv-n">' + cont[t.k] + '</span></button>').join('')
    + '<button type="button" class="idv-chip' + (_vgrSoProblema ? ' ativo' : '') + '" onclick="_vgrSoProblema=!_vgrSoProblema;vgr_render()">Só sem decisão ou fora do prazo <span class="idv-n">' + (semDec + fora) + '</span></button>';
  box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
    + '<div style="font-size:13px;color:var(--idv-sec)">Atualizado em <span class="idv-data">' + new Date(d.geradoEm).toLocaleString('pt-BR') + '</span> · refeito todo dia de manhã (08h10), com o plantão que acabou de sair (08h às 08h) · consulta só de leitura no AKILES</div>'
    + '<button type="button" class="idv-btn mini" onclick="vgr_exportar()">Exportar Excel</button></div>'
    + '<div class="idv-chips" style="margin-bottom:10px">' + chipsPl + '</div>'
    + '<div class="idv-faixa ' + (semDec || fora ? 'cr' : 'ok') + '" style="display:block;line-height:1.5;margin-bottom:12px">' + achado + '</div>'
    + (lista.length ? '<div class="idv-chips" style="margin-bottom:10px">' + chipsTipo + '</div>' + _vgrTabela(d, _vgrFiltrar(lista)) : '');
}

function _vgrFiltrar(lista) { return lista.filter(o => (!_vgrTipo || _vgrTipoDe(o).k === _vgrTipo) && (!_vgrSoProblema || _vgrProblema(o))); }

function _vgrDecisao(o) {
  if (o.dec === '6') return '<span class="idv-etq cr">Confirmada</span>';
  if (o.dec === '7') return '<span class="idv-etq ne">Não confirmada</span>';
  return '<span class="idv-etq at">Sem decisão</span>' + (o.auto ? '<div class="idv-mini">arquivada pelo sistema, sem ação de operador</div>' : '');
}

function _vgrTabela(d, lista) {
  if (!lista.length) return '<div class="idv-vazio">Nenhuma violação com esse filtro.</div>';
  const td = (v, s) => '<td style="' + (s || '') + '">' + v + '</td>';
  return '<div class="table-scroll"><table class="data-table idv-tabela"><thead><tr><th>Início</th><th>Monitorado</th><th>Violação</th><th>Decisão</th><th>Quem decidiu · em quanto tempo</th><th>No AKILES</th></tr></thead><tbody>'
    + lista.map(o => {
      const faixa = _vgrProblema(o) ? 'box-shadow:inset 3px 0 0 var(--idv-cr);' : '';
      const op = _vgrNomeOp(d, o.op), prazo = o.sla != null ? 'prazo do POP ' + _vgrTempo(o.sla * 60) : '';
      const tempo = o.min != null ? '<span class="idv-data"' + (_vgrForaPrazo(o) ? ' style="color:var(--idv-cr);font-weight:600"' : '') + '>' + _vgrTempo(o.min) + '</span>' : '';
      return '<tr>' + td('<span class="idv-data">' + _vgrHora(o.d) + '</span>', faixa + 'white-space:nowrap')
        + td('<div class="idv-nome">' + esc(o.nome || 'Nome não lido nesta coleta') + '</div><div class="idv-mini">' + (o.reg ? 'registro <span class="idv-mono">' + esc(o.reg) + '</span> · ' : '') + (o.vd ? 'violência doméstica' : 'cautelar') + '</div>', 'min-width:200px')
        + td(esc(_vgrTipoDe(o).rot) + '<div class="idv-mini">ocorrência <span class="idv-mono">' + esc(o.id) + '</span></div>')
        + td(_vgrDecisao(o))
        + td((op ? (_vgrSemDecisao(o) ? '1ª ação: ' : '') + esc(op) : '—') + '<div class="idv-mini">' + (tempo ? tempo + (prazo ? ' · ' + prazo : '') : prazo) + (_vgrForaPrazo(o) ? ' · <b style="color:var(--idv-cr)">fora do prazo</b>' : '') + '</div>')
        + td(esc(o.st || '—')) + '</tr>';
    }).join('') + '</tbody></table></div>';
}

function vgr_exportar() {
  const d = _vgrDados(); if (!d) return;
  const pl = _vgrPlantoes(d).find(p => p.dia === _vgrDia); if (!pl) return;
  const rows = _vgrFiltrar(pl.lista).map(o => ({ 'Início': _vgrHora(o.d), 'Monitorado': o.nome || '', 'Registro': o.reg || '', 'Medida': o.vd ? 'Violência doméstica' : 'Cautelar',
    'Violação': _vgrTipoDe(o).rot, 'Ocorrência': o.id, 'Decisão': o.dec === '6' ? 'Confirmada' : o.dec === '7' ? 'Não confirmada' : 'Sem decisão',
    'Quem decidiu': _vgrNomeOp(d, o.op), 'Tempo': _vgrTempo(o.min), 'Prazo do POP': o.sla != null ? _vgrTempo(o.sla * 60) : '', 'Fora do prazo': _vgrForaPrazo(o) ? 'sim' : '', 'Situação no AKILES': o.st || '' }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Violações graves');
  XLSX.writeFile(wb, 'Violacoes_graves_plantao_' + pl.dia + '.xlsx');
  try { auditar({ modulo: 'Gerência', action: 'vgr_exportar', alvo: rows.length + ' violação(ões) · plantão ' + pl.dia }); } catch (e) {}
}
