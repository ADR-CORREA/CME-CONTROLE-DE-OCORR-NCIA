/* ═══════════════════════════ ESTOQUE DO PLANTÃO — tela ═══════════════════════════
   Sub-aba "Plantão" dentro da aba Estoque (o nível plantão vê só ela) + quadro "a receber" no painel do setor.
   Regras e gravação em estoque-plantao.js. Mesmas funções do setor: Entrada (inventário), Saída (instalação/entrega),
   Devolução, Baixa, Envio ao setor, Receber/Recusar do setor, mínimos, alertas, histórico, detalhe, consulta,
   zerar contagem (admin) e excluir movimentação (admin). Emojis só por \u{...}. Prefixo ep_ / _ep. */

const _EP_CAT = { 'Módulo eletrônico de monitoração': 'Tornozeleira', 'Cinta': 'Tornozeleira', 'Trava': 'Tornozeleira', 'Carregador da tornozeleira': 'Tornozeleira', 'Dispositivo DPP': 'DPP — Dispositivo de Proteção Pessoal' };
const _EP_MOTIVOS = {
  entrada:   ['Inventário inicial (já estava na sala do plantão)', 'Outro'],
  saida:     ['Instalação no monitorado', 'Entrega de DPP à vítima', 'Troca de equipamento', 'Outro'],
  devolucao: ['Retirada do monitorado (desinstalação)', 'Troca de equipamento', 'Outro'],
  envio:     ['Defeito / manutenção', 'Sobra — devolver ao setor', 'Outro'],
  baixa:     ['Outro'],
};
const _EP_TITULO = { entrada: '\u{2B06} Entrada no estoque do Plantão', saida: '\u{2B07} Saída — instalação / entrega', devolucao: '\u{21A9} Devolução ao plantão (retirado do monitorado)', baixa: '\u{2715} Baixa (defeito, perda, dano)', envio: '\u{1F4E6} Enviar ao setor de Estoque' };
const _EP_BADGE = { 'Entrada': 'badge-ok', 'Recebimento': 'badge-ok', 'Saída': 'badge-vencido', 'Devolução': 'badge-atencao', 'Baixa': 'badge-vencendo', 'Envio ao setor': 'badge-vencendo' };

function _epMin(d, chave) {
  const m = (d.configuracoes.minimos || {})[chave];
  return m !== undefined ? m : 0;
}
// o plantão não guarda as 14 medidas de cinta: a medida só entra na tela e nos alertas quando tem saldo ou mínimo
function _epControla(d, chave) { return !chave.startsWith('Cinta_') || (d.itens[chave] || 0) > 0 || _epMin(d, chave) > 0; }
function _epBtn(txt, js, cls, title) { return '<button type="button" class="' + (cls || 'btn-secondary') + '" onclick="' + js + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + txt + '</button>'; }

/* ── acesso: o nível plantão vê só a sub-aba Plantão ── */
function ep_ajustarAcesso() {
  const tab = document.getElementById('est-stab-plantao'); if (!tab) return;
  tab.style.display = ep_podeVer() ? '' : 'none';
  const soPlantao = usuarioAtual && usuarioAtual.nivel === 'plantao';
  ['est-stab-estoque', 'est-stab-consultar'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = soPlantao ? 'none' : ''; });
  const painel = document.getElementById('est-panel-plantao');
  if (soPlantao && painel && painel.style.display !== 'block' && typeof mudarSubAbaEstoque === 'function') mudarSubAbaEstoque('plantao');
}

function ep_renderizar() {
  if (!ep_podeVer()) return;
  ep_ajustarAcesso();
  _epRenderSetorPendentes();
  const el = document.getElementById('est-panel-plantao'); if (!el || el.style.display !== 'block') return;
  const d = ep_get(), it = d.itens, pode = ep_podeMover(), admin = usuarioAtual && usuarioAtual.nivel === 'admin';
  const M = 'Módulo eletrônico de monitoração', D = 'Dispositivo DPP';
  const cinta = EST_TAMANHOS.reduce((s, t) => s + (it['Cinta_' + t] || 0), 0);
  const pe = ep_porEstado(d, EST_PADRAO.itens, ITENS_COM_SERIAL);
  let baixo = 0, zero = 0;
  Object.keys(EST_PADRAO.itens).filter(k => _epControla(d, k)).forEach(k => { const s = estStatusCls(it[k] || 0, _epMin(d, k)); if (s === 'zero') zero++; else if (s === 'baixo') baixo++; });
  const total = Object.keys(EST_PADRAO.itens).reduce((s, k) => s + (it[k] || 0), 0);
  const kpi = (n, l, cls) => '<div class="est-kpi' + (cls ? ' ' + cls : '') + '"><div class="est-kpi-num">' + n + '</div><div class="est-kpi-label">' + l + '</div></div>';
  const equipe = _epEquipeHoje();
  const html = [];
  html.push('<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin:14px 0 8px">'
    + '<div><div style="font-weight:700;font-size:1rem">\u{1F6E1}\u{FE0F} Estoque do Plantão</div><div style="font-size:.8rem;color:#64748b">Um estoque só para as equipes ALFA a ECHO. Lance na hora tudo que entra e sai. Equipe de hoje: <b>' + esc(equipe || '—') + '</b></div></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
    + (pode ? _epBtn('\u{2B06} Entrada', "ep_abrirMov('entrada')", 'btn-primary') + _epBtn('\u{2B07} Saída', "ep_abrirMov('saida')") + _epBtn('\u{21A9} Devolução', "ep_abrirMov('devolucao')")
      + _epBtn('\u{1F4E6} Enviar ao setor', "ep_abrirMov('envio')") + _epBtn('\u{2715} Baixa', "ep_abrirMov('baixa')", 'btn-danger') : '')
    + (pode || (usuarioAtual && usuarioAtual.nivel === 'estoque') ? _epBtn('\u{2699}\u{FE0F} Mínimos', 'ep_abrirMinimos()') : '')
    + (admin ? _epBtn('\u{1F9EE} Zerar contagem', 'ep_zerarContagem()', 'btn-danger', 'Zera os saldos e os números de série do plantão. O histórico é mantido.') : '')
    + '</div></div>');
  if (!pode) html.push('<div class="est-aviso-perm">\u{1F512} <strong>Modo visualização:</strong> só o plantão (e a gerência/administração) lança movimentações aqui.</div>');
  if (d.recontagemEm) html.push('<div class="est-alerta-box" style="background:#eef4ff;border-color:#b6cdf7;color:#1a4fa3">\u{1F9EE} <strong>Recontagem em ' + new Date(d.recontagemEm).toLocaleString('pt-BR') + ':</strong> o saldo conta só o que foi lançado a partir dessa data.</div>');
  html.push(_epHtmlAReceber(d, pode));
  html.push('<div class="est-kpi-grid">' + kpi(it[M] || 0, 'Módulo Eletrônico') + kpi(cinta, 'Cintas (total)') + kpi(it['Trava'] || 0, 'Travas') + kpi(it['Carregador da tornozeleira'] || 0, 'Carregadores Tornozeleira')
    + kpi(it[D] || 0, 'Dispositivos DPP') + kpi(pe.novo[M] || 0, 'Tornozeleiras Novas') + kpi(pe.reutilizado[M] || 0, 'Tornozeleiras Reutilizadas') + kpi(total, 'Total Geral')
    + kpi(baixo, 'Estoque Baixo', 'alerta') + kpi(zero, 'Sem Estoque', 'perigo') + '</div>');
  html.push(_epHtmlTabelas(d, pe));
  html.push('<div class="est-section-title" style="margin-top:22px">\u{1F50D} Onde está? (nº de série, IMEI, monitorado, plantonista)</div>'
    + '<input type="text" id="ep-busca" placeholder="Digite o IMEI, nº de série, nome do monitorado..." oninput="ep_consultar(this.value)" style="width:100%;max-width:560px;padding:8px 12px;border:1px solid #ccc;border-radius:6px">'
    + '<div id="ep-busca-res" style="margin-top:8px"></div>');
  html.push(_epHtmlHistorico(d, admin));
  const busca = document.getElementById('ep-busca'), valor = busca ? busca.value : '';
  el.innerHTML = html.join('');
  if (valor) { const b = document.getElementById('ep-busca'); b.value = valor; ep_consultar(valor); }
}

function _epHtmlUnid(t) { return (t.unidades || []).length ? '<div style="font-family:ui-monospace,Consolas,monospace;font-size:.78rem;margin-top:2px">' + t.unidades.map(u => esc(u.id) + (u.temCarregador ? ' \u{1F50B}' : '') + (u.temChip ? ' \u{1F4F6}' : '')).join(' · ') + '</div>' : ''; }
function _epHtmlTransf(t, botoes) {
  return '<div style="border:1px solid #fcd34d;border-left:4px solid #d97706;background:#fffbeb;border-radius:6px;padding:8px 10px;margin:6px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
    + '<div style="flex:1;min-width:220px"><b>' + esc(t.item) + (t.tamanho ? ' ' + esc(t.tamanho) : '') + ' \u{00D7}' + esc(t.quantidade) + '</b>' + (t.estado ? ' <span style="color:#64748b">(' + esc(t.estado) + ')</span>' : '')
    + _epHtmlUnid(t)
    + '<div style="font-size:.76rem;color:#64748b">Enviado por ' + esc(t.enviadoPor || '—') + ' em ' + new Date(t.enviadoEm).toLocaleString('pt-BR') + (t.equipe ? ' · equipe ' + esc(t.equipe) : '') + (t.plantonista ? ' · para ' + esc(t.plantonista) : '') + (t.motivo ? ' · ' + esc(t.motivo) : '') + (t.obs ? ' · ' + esc(t.obs) : '') + '</div></div>'
    + botoes + '</div>';
}
function _epHtmlAReceber(d, pode) {
  const rec = ep_pendentes(d, EP_SETOR_PARA_PLANTAO), env = ep_pendentes(d, EP_PLANTAO_PARA_SETOR);
  let h = '';
  if (rec.length) h += '<div class="est-section-title">\u{1F4E5} A receber do setor de Estoque (' + rec.length + ') — confira os números e clique em Receber</div>'
    + rec.map(t => _epHtmlTransf(t, pode ? _epBtn('\u{2705} Receber', "ep_receberDoSetor('" + _jsq(t.id) + "')", 'btn-primary') + _epBtn('Recusar', "ep_perguntarRecusa('" + _jsq(t.id) + "','plantao')") : '')).join('');
  if (env.length) h += '<div class="est-section-title">\u{1F4E4} Enviados ao setor — aguardando o setor receber (' + env.length + ')</div>' + env.map(t => _epHtmlTransf(t, '')).join('');
  return h;
}
// no painel do SETOR: o que o plantão devolveu (a receber) e o que o setor mandou e o plantão ainda não recebeu
function _epRenderSetorPendentes() {
  const el = document.getElementById('ep-setor-pendentes'); if (!el) return;
  const d = ep_get(), rec = ep_pendentes(d, EP_PLANTAO_PARA_SETOR), env = ep_pendentes(d, EP_SETOR_PARA_PLANTAO), pode = podeAlterarEstoque();
  let h = '';
  if (rec.length) h += '<div class="est-section-title">\u{1F4E5} Devolvido pelo Plantão — a receber (' + rec.length + ')</div>'
    + rec.map(t => _epHtmlTransf(t, pode ? _epBtn('\u{2705} Receber', "ep_setorReceber('" + _jsq(t.id) + "')", 'btn-primary') + _epBtn('Recusar', "ep_perguntarRecusa('" + _jsq(t.id) + "','setor')") : '')).join('');
  if (env.length) h += '<div class="est-section-title">\u{1F69A} Enviado ao Plantão — aguardando o plantonista receber (' + env.length + ')</div>' + env.map(t => _epHtmlTransf(t, '')).join('');
  // transferências que ficaram pela metade (rede caiu entre as duas gravações)
  const pend = ep_pendenciasSetor();
  if (pend.transf.length || pend.saidas.length) h += '<div class="est-section-title" style="color:#b91c1c">\u{26A0}\u{FE0F} Transferências pela metade — conclua para o saldo ficar certo</div>'
    + pend.transf.map(t => _epHtmlTransf(t, pode ? _epBtn('Concluir (lançar no setor)', "ep_concluirPendencia('" + _jsq(t.id) + "')", 'btn-primary') : '')).join('')
    + pend.saidas.map(m => _epHtmlTransf({ item: m.item, tamanho: m.tamanho, quantidade: m.quantidade, estado: m.estado, unidades: m.unidades || (m.seriais || []).map(id => ({ id })), enviadoPor: m.responsavel, enviadoEm: m.ts, equipe: m.plantao, plantonista: m.plantonista, motivo: 'Saída do setor que não chegou ao Plantão' },
      pode ? _epBtn('Reenviar ao Plantão', "ep_reenviarSaida('" + _jsq(m.id) + "')", 'btn-primary') : '')).join('');
  el.innerHTML = h;
}
function ep_perguntarRecusa(id, quem) {
  const motivo = (prompt('Por que recusar? (ex.: número de série não confere, item com defeito)') || '').trim();
  if (!motivo) return;
  if (quem === 'plantao') ep_recusarDoSetor(id, motivo); else ep_setorRecusar(id, motivo);
}

function _epHtmlTabelas(d, pe) {
  const it = d.itens, linhaSer = (item, colunas) => {
    const us = ep_unidades(d, item); if (!us.length) return '';
    const grupo = (lbl, cor, lista) => lista.length ? '<span style="color:' + cor + '">' + lbl + ' (' + lista.length + '):</strong> ' + lista.map(u => esc(u.id) + (u.temCarregador ? ' \u{1F50B}' : '') + (u.temChip ? ' \u{1F4F6}' : '')).join(' · ') + '</span>' : '';
    const partes = [grupo('\u{1F4E6} <strong>Novos', '#1a7f37', us.filter(u => u.estado === 'Novo')), grupo('\u{1F504} <strong>Reutilizados', '#b45309', us.filter(u => u.estado === 'Reutilizado')), grupo('\u{1F4CB} <strong>Sem estado', '#888', us.filter(u => u.estado !== 'Novo' && u.estado !== 'Reutilizado'))].filter(Boolean);
    return '<tr style="background:#f8f9ff"><td colspan="' + colunas + '" style="font-size:.78rem;padding:4px 12px;line-height:1.8">' + partes.join('<br>') + '</td></tr>';
  };
  const ne = (k, v) => v > 0 ? '<span style="color:' + (k === 'n' ? '#1a7f37' : '#b45309') + ';font-weight:600">' + (k === 'n' ? '\u{1F4E6} ' : '\u{1F504} ') + v + '</span>' : '<span style="color:#aaa">—</span>';
  const linha = (item, tam, chave) => {
    const q = it[chave] || 0, min = _epMin(d, chave), cls = estStatusCls(q, min);
    return '<tr' + (q <= min ? ' style="background:#ffeaea"' : '') + '><td>' + esc(item) + '</td><td>' + (tam ? esc(tam) : '<span style="color:var(--cz2)">—</span>') + '</td><td style="text-align:center"><strong>' + q + '</strong></td>'
      + '<td style="text-align:center">' + ne('n', pe.novo[chave] || 0) + '</td><td style="text-align:center">' + ne('r', pe.reutilizado[chave] || 0) + '</td><td style="text-align:center">' + min + '</td><td><span class="est-badge ' + cls + '">' + estStatusLabel(cls) + '</span></td></tr>';
  };
  const torn = ['Módulo eletrônico de monitoração', 'Trava', 'Carregador da tornozeleira'].map(i => linha(i, '', i) + (ITENS_COM_SERIAL.includes(i) ? linhaSer(i, 7) : '')).join('')
    + (EST_TAMANHOS.filter(t => _epControla(d, 'Cinta_' + t)).map(t => linha('Cinta', t, 'Cinta_' + t)).join('')
      || '<tr><td>Cinta</td><td colspan="6" style="color:#64748b;font-size:.8rem">Nenhuma cinta no plantão (as medidas aparecem quando entram ou quando têm mínimo).</td></tr>');
  const D = 'Dispositivo DPP', us = ep_unidades(d, D);
  const qd = it[D] || 0, mind = _epMin(d, D), clsd = estStatusCls(qd, mind);
  const dpp = '<tr' + (qd <= mind ? ' style="background:#ffeaea"' : '') + '><td>' + D + '</td><td style="text-align:center"><strong>' + qd + '</strong></td><td style="text-align:center">' + ne('n', pe.novo[D] || 0) + '</td><td style="text-align:center">' + ne('r', pe.reutilizado[D] || 0) + '</td>'
    + '<td style="text-align:center">' + mind + '</td><td><span class="est-badge ' + clsd + '">' + estStatusLabel(clsd) + '</span></td><td style="text-align:center">' + (us.filter(u => u.temCarregador).length || '—') + '</td><td style="text-align:center">' + (us.filter(u => u.temChip).length || '—') + '</td></tr>' + linhaSer(D, 8);
  return '<div class="est-section-title">Tornozeleira Eletrônica</div><div class="table-wrapper"><table class="data-table"><thead><tr><th>Item</th><th>Tamanho</th><th style="text-align:center">Total</th><th style="text-align:center">\u{1F4E6} Novos</th><th style="text-align:center">\u{1F504} Reutilizados</th><th style="text-align:center">Mínimo</th><th>Status</th></tr></thead><tbody>' + torn + '</tbody></table></div>'
    + '<div class="est-section-title">DPP — Dispositivo de Proteção Pessoal</div><div class="table-wrapper"><table class="data-table"><thead><tr><th>Item</th><th style="text-align:center">Total</th><th style="text-align:center">\u{1F4E6} Novos</th><th style="text-align:center">\u{1F504} Reutilizados</th><th style="text-align:center">Mínimo</th><th>Status</th><th style="text-align:center">Com Carregador</th><th style="text-align:center">Com Chip</th></tr></thead><tbody>' + dpp + '</tbody></table></div>';
}

function _epHtmlHistorico(d, admin) {
  const movs = d.movimentacoes.slice(0, 300);
  const corpo = movs.length ? movs.map(m => {
    const antes = d.recontagemEm && (m.ts || '') < d.recontagemEm;
    return '<tr' + (antes ? ' style="background:#fafafa;color:#8b949e" title="Anterior à recontagem — não entra no saldo"' : '') + '><td style="white-space:nowrap;font-size:.8rem">' + new Date(m.ts).toLocaleString('pt-BR') + '</td>'
      + '<td><span class="badge ' + (_EP_BADGE[m.tipo] || '') + '">' + esc(m.tipo) + '</span></td><td>' + esc(m.item) + '</td><td>' + esc(m.tamanho || '—') + '</td><td style="text-align:center">' + esc(m.quantidade) + '</td>'
      + '<td style="font-family:ui-monospace,Consolas,monospace;font-size:.76rem">' + esc((m.seriais || []).join(', ') || '—') + '</td><td>' + esc(m.equipe || '—') + '</td><td>' + esc(m.plantonista || m.responsavel || '—') + '</td>'
      + '<td>' + esc(m.monitorado || '—') + '</td><td>' + esc(m.motivo || '—') + '</td><td>' + esc(m.obs || '—') + '</td>'
      + '<td style="white-space:nowrap">' + _epBtn('\u{1F441}', "ep_verMov('" + _jsq(m.id) + "')", 'btn-sm') + (admin ? _epBtn('\u{1F5D1}', "ep_excluirMov('" + _jsq(m.id) + "')", 'btn-sm btn-danger') : '') + '</td></tr>';
  }).join('') : '<tr><td colspan="12" style="text-align:center;padding:24px;color:var(--cz2)">Nenhuma movimentação no estoque do Plantão ainda. Comece pelo inventário: botão "Entrada" → "Inventário inicial".</td></tr>';
  return '<div class="est-section-title" style="margin-top:26px">Histórico do Plantão</div><div class="table-wrapper" style="overflow-x:auto"><table class="data-table"><thead><tr>'
    + '<th>Data/Hora</th><th>Tipo</th><th>Item</th><th>Tam.</th><th>Qtd</th><th>Série/IMEI</th><th>Equipe</th><th>Plantonista</th><th>Monitorado</th><th>Motivo</th><th>Obs.</th><th>Ações</th></tr></thead><tbody>' + corpo + '</tbody></table></div>';
}

/* ── consulta: onde está a unidade + movimentações que citam o termo ── */
function ep_consultar(valor) {
  const el = document.getElementById('ep-busca-res'); if (!el) return;
  const q = String(valor || '').trim(); if (q.length < 2) { el.innerHTML = ''; return; }
  const p = ep_get(), s = getEstoque(), ql = q.toLowerCase();
  const onde = ep_onde(q, s, p, ITENS_COM_SERIAL);
  const movs = p.movimentacoes.filter(m => [m.tipo, m.item, m.tamanho, m.monitorado, m.processo, m.motivo, m.obs, m.equipe, m.plantonista, m.responsavel, ...(m.seriais || [])].some(v => String(v || '').toLowerCase().includes(ql))).slice(0, 50);
  let h = onde ? '<div style="border:1px solid #bfdbfe;background:#eff6ff;border-radius:6px;padding:8px 10px;margin-bottom:8px"><b style="font-family:ui-monospace,Consolas,monospace">' + esc(q) + '</b> — ' + esc(onde.item) + ': <b>' + esc(onde.texto) + '</b></div>' : '';
  h += movs.length ? '<div style="font-size:.8rem;color:#475569;margin-bottom:4px">' + movs.length + ' movimentação(ões) do plantão com "' + esc(q) + '":</div>' + movs.map(m => '<div onclick="ep_verMov(\'' + _jsq(m.id) + '\')" style="cursor:pointer;display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid #f1f5f9;font-size:.82rem"><span class="badge ' + (_EP_BADGE[m.tipo] || '') + '">' + esc(m.tipo) + '</span><span>' + new Date(m.ts).toLocaleString('pt-BR') + '</span><span>' + esc(m.item) + ' \u{00D7}' + esc(m.quantidade) + '</span><span style="color:#64748b">' + esc(m.monitorado || m.motivo || '') + '</span><span style="margin-left:auto;color:#1a4fa3">\u{1F441} detalhe</span></div>').join('')
    : (onde ? '' : '<div style="color:#888;padding:8px 0">Nada encontrado para "' + esc(q) + '".</div>');
  el.innerHTML = h;
}

function ep_verMov(id) {
  const m = ep_get().movimentacoes.find(x => x.id === id); if (!m) return;
  const html = _vsec('Item', _vf('Tipo', m.tipo) + _vf('Item', m.item) + (m.tamanho ? _vf('Tamanho', m.tamanho) : '') + _vf('Quantidade', m.quantidade) + _vf('Estado', m.estado || '—'))
    + _vsec('Quem e quando', _vf('Data/Hora', new Date(m.ts).toLocaleString('pt-BR')) + _vf('Plantonista', m.plantonista || m.responsavel || '—') + _vf('Equipe', m.equipe || '—') + _vf('Motivo', m.motivo || '—'))
    + (m.monitorado ? _vsec('Monitorado', _vf('Nome', m.monitorado) + (m.processo ? _vf('Processo', m.processo) : '')) : '')
    + ((m.seriais || []).length ? _vsec('Nº de série / IMEI', _vf('', m.seriais.join(' · '))) : '')
    + (m.obs ? _vsec('Observações', _vta('', m.obs)) : '');
  _abrirViewer('Estoque do Plantão — ' + esc(m.tipo) + ' de ' + esc(m.item), html, null);
}
async function ep_excluirMov(id) {
  if (!usuarioAtual || usuarioAtual.nivel !== 'admin') return;
  if (!confirm('Excluir esta movimentação do histórico do Plantão?\n\nO saldo NÃO é desfeito (igual ao setor de Estoque).')) return;
  if (await _epMutar(d => { d.movimentacoes = d.movimentacoes.filter(m => m.id !== id); })) { addLog('Estoque do Plantão: movimentação excluída (' + _epQuem() + ')'); ep_renderizar(); }
}
async function ep_zerarContagem() {
  if (!usuarioAtual || usuarioAtual.nivel !== 'admin') return;
  if (!confirm('ZERAR A CONTAGEM DO ESTOQUE DO PLANTÃO\n\nApaga saldos e números de série/IMEI do plantão. O histórico e as transferências pendentes ficam.\nDepois o plantão refaz o inventário pela Entrada.\n\nConfirma?')) return;
  if (prompt('Para confirmar, digite ZERAR:') !== 'ZERAR') return;
  const ok = await _epMutar(d => {
    salvarStore('estoque_plantao_backup', { em: new Date().toISOString(), por: _epQuem(), dados: JSON.parse(JSON.stringify(d)) });
    Object.keys(d.itens).forEach(k => { d.itens[k] = 0; });
    d.seriais = {}; d.registros = {}; d.recontagemEm = new Date().toISOString();
  });
  if (ok) { addLog('Estoque do Plantão: contagem zerada para recontagem (' + _epQuem() + ')'); ep_renderizar(); try { _dashEstoqueDisp(); } catch (e) {} }
}

/* ── mínimos do plantão ── */
function _epModal(titulo, corpo, rodape) {
  let ov = document.getElementById('ep-modal');
  if (!ov) { ov = document.createElement('div'); ov.className = 'modal-overlay'; ov.id = 'ep-modal'; document.body.appendChild(ov); }
  ov.innerHTML = '<div class="modal-box"><div class="modal-header"><h3>' + titulo + '</h3><button class="modal-close" onclick="fecharModal(\'ep-modal\')">\u{2715}</button></div>'
    + '<div class="modal-body" id="ep-modal-corpo">' + corpo + '</div><div class="modal-footer">' + rodape + '</div></div>';
  ov.classList.add('open');
}
function _epPodeMinimos() { return ep_podeMover() || (usuarioAtual && usuarioAtual.nivel === 'estoque'); }
function ep_abrirMinimos() {
  if (!_epPodeMinimos()) return;
  const d = ep_get(), linhas = Object.keys(EST_PADRAO.itens).map(k => '<div style="font-size:.88rem">' + esc(k.replace('Cinta_', 'Cinta ')) + '</div><input type="number" min="0" class="ep-min" data-chave="' + esc(k) + '" value="' + _epMin(d, k) + '" style="padding:5px 8px;border:1px solid #ccc;border-radius:6px;width:100%">').join('');
  _epModal('\u{2699}\u{FE0F} Mínimos do estoque do Plantão', '<p style="color:#555;font-size:.87rem;margin-bottom:12px">Quando o saldo do plantão ficar igual ou abaixo do mínimo, a linha fica vermelha.</p><div style="display:grid;grid-template-columns:1fr 120px;gap:8px 16px;align-items:center">' + linhas + '</div>',
    _epBtn('Cancelar', "fecharModal('ep-modal')") + _epBtn('Salvar', 'ep_salvarMinimos()', 'btn-primary'));
}
async function ep_salvarMinimos() {
  if (!_epPodeMinimos()) return;
  const mins = {}; document.querySelectorAll('.ep-min').forEach(i => { mins[i.dataset.chave] = Math.max(0, parseInt(i.value, 10) || 0); });
  if (await _epMutar(d => { d.configuracoes.minimos = mins; })) { fecharModal('ep-modal'); ep_renderizar(); _mostrarToast('\u{2705} Mínimos do plantão salvos.', 'ok'); }
}

/* ── formulário de movimentação ── */
let _epForm = null; // { tipo }
function ep_abrirMov(tipo) {
  if (!ep_podeMover()) { alert('Sem permissão.'); return; }
  _epForm = { tipo };
  const soma = tipo === 'entrada' || tipo === 'devolucao';
  const cats = Object.keys(EST_TIPOS).map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
  const motivos = _EP_MOTIVOS[tipo].map(m => '<option>' + esc(m) + '</option>').join('');
  const campo = (lbl, html, id) => '<div class="form-field"' + (id ? ' id="' + id + '"' : '') + '><label>' + lbl + '</label>' + html + '</div>';
  const corpo = '<div style="font-size:.8rem;color:#475569;margin-bottom:8px">Plantonista: <b>' + esc(_epQuem()) + '</b> · equipe <b>' + esc(_epEquipeHoje() || '—') + '</b> · ' + new Date().toLocaleString('pt-BR') + '</div>'
    + '<div class="form-grid">' + campo('Categoria *', '<select id="ep-f-cat" onchange="_epAtualizarTipos()"><option value="">Selecione...</option>' + cats + '</select>')
    + campo('Tipo de Item *', '<select id="ep-f-item" onchange="_epAtualizarForm()"><option value="">Selecione a categoria...</option></select>') + '</div>'
    + '<div class="form-grid">' + campo('Tamanho da Cinta *', '<select id="ep-f-tam"><option value="">Selecione...</option>' + EST_TAMANHOS.map(t => '<option>' + t + '</option>').join('') + '</select>', 'ep-row-tam')
    + campo('Quantidade *', '<input type="number" id="ep-f-qtd" min="1" placeholder="0" oninput="_epAtualizarUnidades()">', 'ep-row-qtd')
    // o envio leva o estado (Novo/Reutilizado) para o setor; nos itens com nº de série ele vem da própria unidade
    + (soma || tipo === 'envio' ? campo('Estado do Item *', '<select id="ep-f-estado"><option value="">Selecione...</option><option>Novo</option><option>Reutilizado</option></select>', 'ep-row-estado') : '') + '</div>'
    + '<div id="ep-unidades"></div>'
    + (tipo === 'saida' || tipo === 'devolucao' ? '<div class="form-grid">' + campo(tipo === 'saida' ? 'Monitorado (quem recebeu) *' : 'Monitorado (de quem foi retirado) *', '<input type="text" id="ep-f-mon" placeholder="Nome do monitorado">') + campo('Processo', '<input type="text" id="ep-f-proc" placeholder="Opcional">') + '</div>' : '')
    + '<div class="form-grid">' + (tipo === 'baixa' ? '' : campo('Motivo *', '<select id="ep-f-motsel" onchange="_epAtualizarMotivo()">' + motivos + '</select>'))
    + campo(tipo === 'baixa' ? 'Motivo da baixa *' : 'Descreva', '<input type="text" id="ep-f-mottxt" placeholder="' + (tipo === 'baixa' ? 'Defeito, perda, dano...' : 'Qual motivo?') + '">', 'ep-row-mottxt') + '</div>'
    + '<div class="form-grid">' + campo('Observação', '<input type="text" id="ep-f-obs" placeholder="Opcional">') + '</div>';
  _epModal(_EP_TITULO[tipo], corpo, _epBtn('Cancelar', "fecharModal('ep-modal')") + _epBtn('Registrar', 'ep_confirmarMov()', tipo === 'baixa' ? 'btn-danger' : 'btn-primary'));
  _epAtualizarForm(); _epAtualizarMotivo();
}
function _epAtualizarTipos() {
  const cat = document.getElementById('ep-f-cat').value, tipos = cat ? (EST_TIPOS[cat] || []) : [];
  document.getElementById('ep-f-item').innerHTML = '<option value="">Selecione...</option>' + tipos.map(t => '<option value="' + esc(t) + '">' + esc(t) + '</option>').join('');
  _epAtualizarForm();
}
function _epAtualizarMotivo() {
  const sel = document.getElementById('ep-f-motsel'), row = document.getElementById('ep-row-mottxt');
  if (row) row.style.display = !sel || sel.value === 'Outro' ? '' : 'none';
}
function _epAtualizarForm() {
  const item = (document.getElementById('ep-f-item') || {}).value || '', soma = _epForm.tipo === 'entrada' || _epForm.tipo === 'devolucao';
  document.getElementById('ep-row-tam').style.display = item === 'Cinta' ? '' : 'none';
  // saída de item com nº de série: a quantidade é o número de unidades marcadas
  document.getElementById('ep-row-qtd').style.display = ITENS_COM_SERIAL.includes(item) && !soma ? 'none' : '';
  const rEst = document.getElementById('ep-row-estado'); if (rEst && _epForm.tipo === 'envio') rEst.style.display = ITENS_COM_SERIAL.includes(item) ? 'none' : '';
  _epAtualizarUnidades();
}
function _epAtualizarUnidades() {
  const box = document.getElementById('ep-unidades'); if (!box) return;
  const item = document.getElementById('ep-f-item').value, soma = _epForm.tipo === 'entrada' || _epForm.tipo === 'devolucao';
  if (!ITENS_COM_SERIAL.includes(item)) { box.innerHTML = ''; return; }
  const dpp = item === 'Dispositivo DPP', lbl = dpp ? 'IMEI' : 'Nº de série';
  if (soma) {
    const n = Math.min(50, parseInt(document.getElementById('ep-f-qtd').value, 10) || 0);
    const ja = [...box.querySelectorAll('.ep-u-id')].map(i => i.value);
    box.innerHTML = n ? '<div class="form-section-title" style="margin-top:8px">' + lbl + ' de cada unidade</div>' + Array.from({ length: n }, (_, i) => '<div class="ep-u" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap"><span style="min-width:22px;font-weight:600;color:#555">' + (i + 1) + '.</span>'
      + '<input type="text" class="ep-u-id" placeholder="' + lbl + ' ' + (i + 1) + '" value="' + esc(ja[i] || '') + '" style="flex:1;min-width:160px;padding:6px 10px;border:1px solid #ccc;border-radius:6px;font-family:ui-monospace,Consolas,monospace">'
      + (dpp ? '<label style="font-size:.85rem;white-space:nowrap"><input type="checkbox" class="ep-u-car"> \u{1F50B} Carregador</label><label style="font-size:.85rem;white-space:nowrap"><input type="checkbox" class="ep-u-chip"> \u{1F4F6} Chip</label>' : '') + '</div>').join('') : '';
    return;
  }
  const us = ep_unidades(ep_get(), item);
  box.innerHTML = '<div class="form-section-title" style="margin-top:8px">Marque o ' + lbl + ' de cada unidade que sai (' + us.length + ' no plantão)</div>'
    + (us.length ? us.map(u => '<label style="display:flex;gap:8px;align-items:center;padding:3px 0;font-size:.88rem;cursor:pointer"><input type="checkbox" class="ep-u-sel" value="' + esc(u.id) + '"><code>' + esc(u.id) + '</code>'
      + (u.estado ? ' <span style="font-size:.75rem;color:#64748b">' + esc(u.estado) + '</span>' : '') + (u.temCarregador ? ' \u{1F50B}' : '') + (u.temChip ? ' \u{1F4F6}' : '') + '</label>').join('')
      : '<p style="color:#b45309;font-size:.85rem">\u{26A0}\u{FE0F} Nenhuma unidade deste item no estoque do Plantão.</p>');
}
async function ep_confirmarMov() {
  const tipo = _epForm && _epForm.tipo; if (!tipo) return;
  const v = id => ((document.getElementById(id) || {}).value || '').trim();
  const item = v('ep-f-item'), soma = tipo === 'entrada' || tipo === 'devolucao', serial = ITENS_COM_SERIAL.includes(item);
  if (!v('ep-f-cat')) return alert('Selecione a categoria.');
  if (!item) return alert('Selecione o tipo de item.');
  if (item === 'Cinta' && !v('ep-f-tam')) return alert('Selecione o tamanho da cinta.');
  const pedeEstado = soma || (tipo === 'envio' && !serial);
  const op = { categoria: v('ep-f-cat'), item, tamanho: item === 'Cinta' ? v('ep-f-tam') : '', estado: pedeEstado ? v('ep-f-estado') : '' };
  if (pedeEstado && !op.estado) return alert('Selecione o Estado do Item (Novo ou Reutilizado).');
  if (serial && soma) {
    op.unidades = [...document.querySelectorAll('#ep-unidades .ep-u')].map(r => ({ id: r.querySelector('.ep-u-id').value.trim(), estado: op.estado,
      temCarregador: !!(r.querySelector('.ep-u-car') || {}).checked, temChip: !!(r.querySelector('.ep-u-chip') || {}).checked }));
    op.qtd = v('ep-f-qtd');
  } else if (serial) {
    op.seriais = [...document.querySelectorAll('#ep-unidades .ep-u-sel:checked')].map(c => c.value);
    op.qtd = op.seriais.length;
    if (!op.qtd) return alert('Marque ao menos uma unidade.');
  } else op.qtd = v('ep-f-qtd');
  if (!(parseInt(op.qtd, 10) >= 1)) return alert('Informe uma quantidade válida (mínimo 1).');
  const sel = v('ep-f-motsel'), txt = v('ep-f-mottxt');
  const motivo = tipo === 'baixa' ? txt : sel === 'Outro' ? txt : sel + (txt ? ' — ' + txt : '');
  if (!motivo) return alert('Informe o motivo.');
  const mon = v('ep-f-mon');
  if ((tipo === 'saida' || tipo === 'devolucao') && !mon) return alert('Informe o monitorado.');
  const ok = await ep_salvarMov(tipo, op, { motivo, monitorado: mon, processo: v('ep-f-proc'), obs: v('ep-f-obs') });
  if (!ok) return;
  fecharModal('ep-modal');
  _mostrarToast('\u{2713} ' + EP_TIPO[tipo] + ' registrada no estoque do Plantão.' + (tipo === 'envio' ? ' Fica "a receber" no setor.' : ''), 'ok');
  ep_renderizar(); try { _dashEstoqueDisp(); } catch (e) {}
}
