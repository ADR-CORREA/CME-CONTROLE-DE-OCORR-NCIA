/* ═══════════════════════════ ESTOQUE DO PLANTÃO — tela ═══════════════════════════
   Aba própria "Estoque Plantão" (plantão, gerência e admin) + quadro de transferências dentro da aba Estoque do CME.
   Regras e gravação em estoque-plantao.js. Mesmas funções do setor: Entrada (inventário), Saída (instalação/entrega),
   Devolução, Baixa, Envio ao setor, Receber/Recusar do setor, mínimos, alertas, histórico, detalhe, consulta,
   excluir movimentação (admin). SEM "Zerar contagem" (pedido dele: alguém poderia apagar tudo). Emojis só por \u{...}. Prefixo ep_ / _ep. */

const _EP_CAT = { 'Módulo eletrônico de monitoração': 'Tornozeleira', 'Cinta': 'Tornozeleira', 'Trava': 'Tornozeleira', 'Carregador da tornozeleira': 'Tornozeleira', 'Dispositivo DPP': 'DPP — Dispositivo de Proteção Pessoal' };
const _EP_MOTIVOS = {
  entrada:   ['Inventário inicial (já estava na sala do plantão)'],
  saida:     ['Instalação no monitorado', 'Entrega de DPP à vítima', 'Troca de equipamento', 'Outro'],
  devolucao: ['Retirada do monitorado (desinstalação)', 'Troca de equipamento', 'Outro'],
  envio:     ['Defeito / manutenção', 'Sobra — devolver ao setor', 'Outro'],
  baixa:     ['Outro'],
};
const _EP_TITULO = { entrada: '\u{2B06} Inventário inicial do Plantão', saida: '\u{2B07} Saída — instalação / entrega', devolucao: '\u{21A9} Devolução ao plantão (retirado do monitorado)', baixa: '\u{2715} Baixa (defeito, perda, dano)', envio: '\u{1F4E6} Enviar ao setor de Estoque' };
const _EP_BADGE = { 'Entrada': 'ok', 'Recebimento': 'ok', 'Saída': 'cr', 'Devolução': 'at', 'Baixa': 'at', 'Envio ao setor': 'at' };
const _EP_ETQ = { ok: 'ok', baixo: 'at', zero: 'cr' }; // estStatusCls → cor da etiqueta do guia

function _epMin(d, chave) {
  const m = (d.configuracoes.minimos || {})[chave];
  return m !== undefined ? m : 0;
}
// o plantão não guarda as 14 medidas de cinta: a medida só entra na tela e nos alertas quando tem saldo ou mínimo
function _epControla(d, chave) { return !chave.startsWith('Cinta_') || (d.itens[chave] || 0) > 0 || _epMin(d, chave) > 0; }
function _epBtn(txt, js, cls, title) { return '<button type="button" class="' + (cls || 'btn-secondary') + '" onclick="' + js + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + txt + '</button>'; }

function ep_renderizar() {
  _epRenderSetorPendentes(); // quadro de transferências dentro da aba Estoque (CME)
  if (!ep_podeVer()) return;
  const el = document.getElementById('est-panel-plantao'); if (!el || !document.getElementById('panel-estplantao')?.classList.contains('active')) return;
  const d = ep_get(), it = d.itens, pode = ep_podeMover(), admin = usuarioAtual && usuarioAtual.nivel === 'admin';
  const M = 'Módulo eletrônico de monitoração', D = 'Dispositivo DPP';
  const cinta = EST_TAMANHOS.reduce((s, t) => s + (it['Cinta_' + t] || 0), 0);
  const pe = ep_porEstado(d, EST_PADRAO.itens, ITENS_COM_SERIAL);
  let baixo = 0, zero = 0;
  Object.keys(EST_PADRAO.itens).filter(k => _epControla(d, k)).forEach(k => { const s = estStatusCls(it[k] || 0, _epMin(d, k)); if (s === 'zero') zero++; else if (s === 'baixo') baixo++; });
  const total = Object.keys(EST_PADRAO.itens).reduce((s, k) => s + (it[k] || 0), 0);
  const kpi = (n, l, cls, dica) => '<div class="idv-kpi' + (cls ? ' ' + cls : '') + '"' + (dica ? ' title="' + esc(dica) + '"' : '') + '><div class="idv-num">' + n + '</div><div class="idv-rot">' + l + '</div></div>';
  const equipe = _epEquipeHoje();
  const html = [];
  html.push('<div class="idv-cab"><div><h1>\u{1F6E1}\u{FE0F} Estoque do Plantão</h1>'
    + '<div class="idv-sub">Um estoque só para as equipes ALFA a ECHO, separado do Estoque do CME. Lance na hora tudo que entra e sai. Equipe de hoje: <b>' + esc(equipe || '—') + '</b></div></div>'
    + '<div class="idv-acoes">' + _epBtn('\u{1F504} Atualizar', 'ep_renderizar()', '', 'Recarrega a tela com os números mais recentes')
    + (typeof ep_abrirPassagem === 'function' ? _epBtn('\u{1F5A8}\u{FE0F} Passagem de serviço', 'ep_abrirPassagem()', '', 'Folha da troca de plantão para imprimir: material, viaturas e as assinaturas de quem passa e de quem recebe') : '')
    + (pode && !d.inventarioEncerradoEm ? _epBtn('\u{2B06} Inventário inicial', "ep_abrirMov('entrada')", 'btn-primary', 'Cadastra o que o plantão já tem na sala (só no começo)') + _epBtn('\u{2714} Encerrar inventário', 'ep_encerrarInventario()', '', 'Termina o cadastro inicial; depois disso, item novo só chega pelo Estoque do CME') : '')
    + (pode ? _epBtn('\u{2B07} Saída', "ep_abrirMov('saida')", '', 'Instalação de tornozeleira ou entrega de equipamento ao monitorado')
      + _epBtn('\u{21A9} Devolução', "ep_abrirMov('devolucao')", '', 'Equipamento retirado do monitorado que volta para o plantão')
      + _epBtn('\u{1F4E6} Enviar ao Estoque', "ep_abrirMov('envio')", '', 'Manda o item para o setor de Estoque do CME (conserto, troca ou devolução); o Estoque precisa receber')
      + _epBtn('\u{2715} Baixa', "ep_abrirMov('baixa')", 'btn-danger', 'Item perdido, quebrado ou inutilizado que sai de vez do estoque')
      + _epBtn('\u{2699}\u{FE0F} Mínimos', 'ep_abrirMinimos()', '', 'Quantidade mínima de cada item; abaixo disso aparece o alerta de estoque baixo') : '')
    + (admin && d.inventarioEncerradoEm ? _epBtn('Reabrir inventário', 'ep_reabrirInventario()', 'btn-secondary', 'Libera de novo o cadastro de inventário pelo plantão') : '')
    + (ep_podeCadastrar() ? _epBtn('\u{2795} Cadastrar dispositivos', 'ep_abrirCadastro()', 'btn-primary', 'Gerência e admin: cadastra módulo ou DPP novo direto no estoque do plantão, digitando o nº de série ou IMEI') : '')
    + '</div></div>');
  if (!pode) html.push('<div class="idv-faixa at" style="margin-bottom:12px"><span>\u{1F512} <strong>Modo visualização:</strong> só o plantão lança movimentações aqui.' + (ep_podeCadastrar() ? ' A gerência pode cadastrar dispositivos novos pelo botão "Cadastrar dispositivos".' : '') + '</span></div>');
  // 1º momento: o plantão cadastra o que já tem; depois, tudo novo vem do Estoque do CME
  html.push(d.inventarioEncerradoEm
    ? '<div style="font-size:13px;color:var(--idv-sec);margin-bottom:12px">\u{2714} Inventário inicial encerrado em <span class="idv-data">' + new Date(d.inventarioEncerradoEm).toLocaleString('pt-BR') + '</span>' + (d.inventarioEncerradoPor ? ' por ' + esc(d.inventarioEncerradoPor) : '') + '. Item novo chega pelo Estoque do CME, em "A receber", ou pelo cadastro de dispositivos (gerência e admin).</div>'
    : '<div class="idv-faixa" style="border-color:var(--idv-in);background:var(--idv-in-f);margin-bottom:12px"><span>\u{1F4CB} <strong>Primeiro passo — inventário inicial:</strong> cadastre em "Inventário inicial" tudo que o plantão já tem na sala (com o IMEI/nº de série de cada DPP e módulo). Quando terminar, clique em <b>Encerrar inventário</b>. Depois disso, item novo só entra pelo que o Estoque do CME enviar ("A receber").</span></div>');
  if (d.recontagemEm) html.push('<div class="idv-faixa" style="border-color:var(--idv-in);background:var(--idv-in-f);margin-bottom:12px"><span>\u{1F9EE} <strong>Recontagem em <span class="idv-data">' + new Date(d.recontagemEm).toLocaleString('pt-BR') + '</span>:</strong> o saldo conta só o que foi lançado a partir dessa data.</span></div>');
  html.push(_epHtmlPendencias('plantao', pode));
  html.push('<div class="idv-kpis" style="margin-bottom:16px">' + kpi(it[M] || 0, 'Módulo Eletrônico', '', 'Tornozeleiras (o aparelho) na sala do plantão')
    + kpi(cinta, 'Cintas (total)', '', 'Cintas de todos os tamanhos somadas') + kpi(it['Trava'] || 0, 'Pares de travas', '', 'Pares de travas para fechar a cinta na instalação')
    + kpi(it['Carregador da tornozeleira'] || 0, 'Carregadores Tornozeleira', '', 'Carregadores da tornozeleira disponíveis')
    + kpi(it[D] || 0, 'Dispositivos DPP', '', 'Aparelhos de botão do pânico para a vítima (DPP)')
    + kpi(pe.novo[M] || 0, 'Tornozeleiras Novas', '', 'Tornozeleiras que nunca foram usadas')
    + kpi(pe.reutilizado[M] || 0, 'Tornozeleiras Reutilizadas', '', 'Tornozeleiras que já foram usadas e voltaram para o estoque')
    + kpi(total, 'Total Geral', '', 'Soma de todos os itens do estoque do plantão')
    + kpi(baixo, 'Estoque Baixo', 'at', 'Itens abaixo da quantidade mínima definida em Mínimos') + kpi(zero, 'Sem Estoque', 'cr', 'Itens que acabaram (quantidade zero)') + '</div>');
  html.push(_epHtmlTabelas(d, pe));
  html.push('<div class="idv-secao">\u{1F50D} Onde está? (nº de série, IMEI, monitorado, plantonista)</div>'
    + '<input type="text" id="ep-busca" placeholder="Digite o IMEI, nº de série, nome do monitorado..." oninput="ep_consultar(this.value)" style="width:100%;max-width:560px;height:38px;padding:0 12px;border:1px solid var(--idv-borda);border-radius:6px;font-size:14px;background:var(--idv-cartao);color:var(--idv-texto)">'
    + '<div id="ep-busca-res" style="margin-top:8px"></div>');
  html.push(_epHtmlHistorico(d, admin));
  const busca = document.getElementById('ep-busca'), valor = busca ? busca.value : '';
  el.innerHTML = html.join('');
  if (valor) { const b = document.getElementById('ep-busca'); b.value = valor; ep_consultar(valor); }
}

function _epHtmlUnid(t) { return (t.unidades || []).length ? '<div class="idv-mono" style="font-size:12px;margin-top:2px">' + t.unidades.map(u => esc(u.id) + (u.temCarregador ? ' \u{1F50B}' : '') + (u.temChip ? ' \u{1F4F6}' : '')).join(' · ') + '</div>' : ''; }
function _epHtmlTransf(t, botoes, nota) {
  return '<div style="border:1px solid var(--idv-borda);border-left:3px solid var(--idv-at);background:var(--idv-cartao);border-radius:6px;padding:8px 12px;margin:6px 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
    + '<div style="flex:1;min-width:220px"><b>' + esc(t.item) + (t.tamanho ? ' ' + esc(t.tamanho) : '') + ' \u{00D7}' + esc(t.quantidade) + '</b>' + (t.estado ? ' <span style="color:var(--idv-sec)">(' + esc(t.estado) + ')</span>' : '')
    + _epHtmlUnid(t)
    + '<div style="font-size:12px;color:var(--idv-sec)">Enviado por ' + esc(t.enviadoPor || '—') + ' em <span class="idv-data">' + new Date(t.enviadoEm || t.ts).toLocaleString('pt-BR') + '</span>' + (t.equipe ? ' · equipe ' + esc(t.equipe) : '') + (t.plantonista ? ' · para ' + esc(t.plantonista) : '') + (t.motivo ? ' · ' + esc(t.motivo) : '') + (t.obs ? ' · ' + esc(t.obs) : '') + '</div>'
    + (t.status === 'recusada' ? '<div style="font-size:12px;color:var(--idv-cr)">Recusado por ' + esc(t.decididoPor || '—') + (t.motivoDecisao ? ': ' + esc(t.motivoDecisao) : '') + '</div>' : '')
    + (nota ? '<div style="font-size:12px;color:var(--idv-cr)">' + nota + '</div>' : '') + '</div>'
    + botoes + '</div>';
}
// pendências de UM lado ('plantao' no painel do plantão, 'setor' dentro da aba Estoque do CME)
function _epHtmlPendencias(lado, pode) {
  const p = ep_pendenciasDe(lado), outro = lado === 'plantao' ? 'Estoque do CME' : 'Plantão';
  const b = (txt, js, cls) => pode ? _epBtn(txt, js, cls) : '';
  const sec = (tit, lista, botoes, cor) => lista.length ? '<div class="idv-secao"' + (cor ? ' style="color:' + cor + '"' : '') + '>' + tit + ' (' + lista.length + ')</div>' + lista.map(botoes).join('') : '';
  return sec('\u{1F4E5} A receber do ' + outro + ' — confira os números e clique em Receber', p.aReceber,
      t => _epHtmlTransf(t, b('\u{2705} Receber', "ep_receberTransf('" + _jsq(t.id) + "')", 'btn-primary') + b('Recusar', "ep_perguntarRecusa('" + _jsq(t.id) + "')")))
    + sec('\u{21A9} Recusado pelo ' + outro + ' — receba de volta no seu estoque', p.receberDeVolta,
      t => _epHtmlTransf(t, b('\u{21A9} Receber de volta', "ep_receberDeVolta('" + _jsq(t.id) + "')", 'btn-primary')), 'var(--idv-at)')
    + sec('\u{26A0}\u{FE0F} Transferências pela metade — conclua para o saldo ficar certo', p.concluir,
      t => _epHtmlTransf(t, b('Concluir (lançar no meu estoque)', "ep_concluirPendencia('" + _jsq(t.id) + "')", 'btn-primary'), 'A transferência foi marcada, mas o lançamento no estoque não chegou ao banco.'), 'var(--idv-cr)')
    + sec('\u{26A0}\u{FE0F} Saiu do seu estoque e não chegou ao ' + outro, p.reenviar,
      m => _epHtmlTransf({ item: m.item, tamanho: m.tamanho, quantidade: m.quantidade, estado: m.estado, unidades: m.unidades || (m.seriais || []).map(id => ({ id })), enviadoPor: m.responsavel, ts: m.ts, equipe: m.plantao || m.equipe, plantonista: m.plantonista },
        b('Reenviar ao ' + outro, "ep_reenviar('" + lado + "','" + _jsq(m.id) + "')", 'btn-primary')), 'var(--idv-cr)')
    + sec('\u{1F69A} Enviado ao ' + outro + ' — aguardando receber', p.aguardando, t => _epHtmlTransf(t, ''))
    + sec('\u{23F3} Você recusou — aguardando o ' + outro + ' receber de volta', p.recuseiAguardando, t => _epHtmlTransf(t, ''));
}
/* Aba Estoque do CME › sub-aba "Estoque do Plantão" (pedido de 22/10/2026): o setor VÊ o estoque do plantão,
   sem nenhum botão de alterar. Relê do banco ao abrir (o cache pode estar velho); sem conexão, mostra o que tem. */
async function ep_renderizarVisaoCme() {
  const el = document.getElementById('est-panel-plantao-ver'); if (!el) return;
  el.innerHTML = '<div class="idv-vazio">Carregando o estoque do Plantão...</div>';
  let base = null, aoVivo = true;
  try { base = await _epLerFresco(EP_STORE); } catch (e) { aoVivo = false; base = carregarStore(EP_STORE, null); }
  const d = ep_normalizar(base, EST_PADRAO.itens), it = d.itens, pe = ep_porEstado(d, EST_PADRAO.itens, ITENS_COM_SERIAL);
  const M = 'Módulo eletrônico de monitoração', D = 'Dispositivo DPP';
  const cinta = EST_TAMANHOS.reduce((s, t) => s + (it['Cinta_' + t] || 0), 0);
  const total = Object.keys(EST_PADRAO.itens).reduce((s, k) => s + (it[k] || 0), 0);
  const aCaminho = ep_pendentes(ep_getTransf(), EP_SETOR_PARA_PLANTAO);
  const kpi = (n, l, leg) => '<div class="idv-kpi"><span class="idv-num">' + n + '</span><span class="idv-rot">' + l + '</span>' + (leg ? '<span class="idv-leg">' + leg + '</span>' : '') + '</div>';
  const ult = d.movimentacoes[0];
  el.innerHTML = '<div class="idv-faixa" style="margin:12px 0"><span>\u{1F441}\u{FE0F} <strong>Somente visualização:</strong> o que está hoje na sala do Plantão. Quem lança é o próprio Plantão.'
      + (ult ? ' Último lançamento em <span class="idv-data">' + new Date(ult.ts).toLocaleString('pt-BR') + '</span>' + (ult.responsavel ? ' por ' + esc(ult.responsavel) : '') + '.' : ' Nenhum lançamento ainda.')
      + (aoVivo ? '' : ' <b>Sem conexão com o banco agora — números do último carregamento.</b>') + '</span>'
      + _epBtn('\u{1F504} Atualizar', 'ep_renderizarVisaoCme()', '', 'Busca os números mais recentes do Plantão') + '</div>'
    + (aCaminho.length ? '<div style="font-size:13px;color:var(--idv-sec);margin-bottom:8px">\u{1F69A} ' + aCaminho.length + ' envio(s) do CME ainda não recebido(s) pelo Plantão — não entram nos números abaixo.</div>' : '')
    + '<div class="idv-kpis" style="margin-bottom:16px">' + kpi(it[M] || 0, 'Módulo eletrônico', 'novas <b class="idv-mono">' + (pe.novo[M] || 0) + '</b> · reutilizadas <b class="idv-mono">' + (pe.reutilizado[M] || 0) + '</b>')
    + kpi(cinta, 'Cintas (total)') + kpi(it['Trava'] || 0, 'Pares de travas') + kpi(it['Carregador da tornozeleira'] || 0, 'Carregadores')
    + kpi(it[D] || 0, 'Dispositivos DPP') + kpi(total, 'Total geral', 'todas as peças') + '</div>'
    + _epHtmlTabelas(d, pe);
}

// dentro da aba Estoque do CME: as transferências (o estoque do plantão em si fica na sub-aba "Estoque do Plantão", só leitura)
function _epRenderSetorPendentes() {
  const el = document.getElementById('ep-setor-pendentes'); if (!el) return;
  el.innerHTML = ep_podeVerCme() ? _epHtmlPendencias('setor', podeAlterarEstoque()) : '';
}
function ep_perguntarRecusa(id) {
  const motivo = (prompt('Por que recusar? (ex.: número de série não confere, item com defeito)') || '').trim();
  if (motivo) ep_decidirTransf(id, 'recusada', motivo);
}

function _epHtmlTabelas(d, pe) {
  const it = d.itens, linhaSer = (item, colunas) => {
    const us = ep_unidades(d, item); if (!us.length) return '';
    const grupo = (lbl, cor, lista) => lista.length ? '<span style="color:' + cor + '">' + lbl + ' (' + lista.length + '):</strong> ' + lista.map(u => esc(u.id) + (u.temCarregador ? ' \u{1F50B}' : '') + (u.temChip ? ' \u{1F4F6}' : '')).join(' · ') + '</span>' : '';
    const partes = [grupo('\u{1F4E6} <strong>Novos', 'var(--idv-ok)', us.filter(u => u.estado === 'Novo')), grupo('\u{1F504} <strong>Reutilizados', 'var(--idv-at)', us.filter(u => u.estado === 'Reutilizado')), grupo('\u{1F4CB} <strong>Sem estado', 'var(--idv-sec)', us.filter(u => u.estado !== 'Novo' && u.estado !== 'Reutilizado'))].filter(Boolean);
    return '<tr style="background:var(--idv-fundo)"><td colspan="' + colunas + '" style="font-size:12px;padding:4px 14px;line-height:1.8">' + partes.join('<br>') + '</td></tr>';
  };
  const ne = (k, v) => v > 0 ? '<span style="color:' + (k === 'n' ? 'var(--idv-ok)' : 'var(--idv-at)') + ';font-weight:600">' + (k === 'n' ? '\u{1F4E6} ' : '\u{1F504} ') + v + '</span>' : '<span style="color:var(--idv-sec)">—</span>';
  const linha = (item, tam, chave) => {
    const q = it[chave] || 0, min = _epMin(d, chave), cls = estStatusCls(q, min);
    return '<tr' + (q <= min ? ' style="box-shadow:inset 3px 0 0 var(--idv-cr)"' : '') + '><td>' + esc(item) + '</td><td>' + (tam ? esc(tam) : '<span style="color:var(--idv-sec)">—</span>') + '</td><td style="text-align:center"><strong>' + q + '</strong></td>'
      + '<td style="text-align:center">' + ne('n', pe.novo[chave] || 0) + '</td><td style="text-align:center">' + ne('r', pe.reutilizado[chave] || 0) + '</td><td style="text-align:center">' + min + '</td><td><span class="idv-etq ' + _EP_ETQ[cls] + '">' + estStatusLabel(cls) + '</span></td></tr>';
  };
  const torn = ['Módulo eletrônico de monitoração', 'Trava', 'Carregador da tornozeleira'].map(i => linha(i, '', i) + (ITENS_COM_SERIAL.includes(i) ? linhaSer(i, 7) : '')).join('')
    + (EST_TAMANHOS.filter(t => _epControla(d, 'Cinta_' + t)).map(t => linha('Cinta', t, 'Cinta_' + t)).join('')
      || '<tr><td>Cinta</td><td colspan="6" style="color:var(--idv-sec);font-size:13px">Nenhuma cinta no plantão (as medidas aparecem quando entram ou quando têm mínimo).</td></tr>');
  const D = 'Dispositivo DPP', us = ep_unidades(d, D);
  const qd = it[D] || 0, mind = _epMin(d, D), clsd = estStatusCls(qd, mind);
  const dpp = '<tr' + (qd <= mind ? ' style="box-shadow:inset 3px 0 0 var(--idv-cr)"' : '') + '><td>' + D + '</td><td style="text-align:center"><strong>' + qd + '</strong></td><td style="text-align:center">' + ne('n', pe.novo[D] || 0) + '</td><td style="text-align:center">' + ne('r', pe.reutilizado[D] || 0) + '</td>'
    + '<td style="text-align:center">' + mind + '</td><td><span class="idv-etq ' + _EP_ETQ[clsd] + '">' + estStatusLabel(clsd) + '</span></td><td style="text-align:center">' + (us.filter(u => u.temCarregador).length || '—') + '</td><td style="text-align:center">' + (us.filter(u => u.temChip).length || '—') + '</td></tr>' + linhaSer(D, 8);
  return '<div class="idv-secao">Tornozeleira Eletrônica</div><div class="table-scroll"><table class="data-table idv-tabela"><thead><tr><th>Item</th><th>Tamanho</th><th style="text-align:center">Total</th><th style="text-align:center">\u{1F4E6} Novos</th><th style="text-align:center">\u{1F504} Reutilizados</th><th style="text-align:center">Mínimo</th><th>Status</th></tr></thead><tbody>' + torn + '</tbody></table></div>'
    + '<div class="idv-secao">DPP — Dispositivo de Proteção Pessoal</div><div class="table-scroll"><table class="data-table idv-tabela"><thead><tr><th>Item</th><th style="text-align:center">Total</th><th style="text-align:center">\u{1F4E6} Novos</th><th style="text-align:center">\u{1F504} Reutilizados</th><th style="text-align:center">Mínimo</th><th>Status</th><th style="text-align:center">Com Carregador</th><th style="text-align:center">Com Chip</th></tr></thead><tbody>' + dpp + '</tbody></table></div>';
}

function _epHtmlHistorico(d, admin) {
  const movs = d.movimentacoes.slice(0, 300);
  const corpo = movs.length ? movs.map(m => {
    const antes = d.recontagemEm && (m.ts || '') < d.recontagemEm;
    return '<tr' + (antes ? ' style="background:var(--idv-fundo);color:var(--idv-sec)" title="Anterior à recontagem — não entra no saldo"' : '') + '><td class="idv-data" style="white-space:nowrap;font-size:13px">' + new Date(m.ts).toLocaleString('pt-BR') + '</td>'
      + '<td><span class="idv-etq ' + (_EP_BADGE[m.tipo] || 'ne') + '">' + esc(m.tipo) + '</span></td><td>' + esc(m.item) + '</td><td>' + esc(m.tamanho || '—') + '</td><td style="text-align:center">' + esc(m.quantidade) + '</td>'
      + '<td class="idv-mono" style="font-size:12px">' + esc((m.seriais || []).join(', ') || '—') + '</td><td>' + esc(m.equipe || '—') + '</td><td>' + esc(m.plantonista || m.responsavel || '—') + '</td>'
      + '<td>' + esc(m.monitorado || '—') + '</td><td>' + esc(m.motivo || '—') + '</td><td>' + esc(m.obs || '—') + '</td>'
      + '<td style="white-space:nowrap">' + _epBtn('\u{1F441}', "ep_verMov('" + _jsq(m.id) + "')", 'btn-sm') + (admin ? _epBtn('\u{1F5D1}', "ep_excluirMov('" + _jsq(m.id) + "')", 'btn-sm btn-danger') : '') + '</td></tr>';
  }).join('') : '<tr><td colspan="12" class="idv-vazio">Nenhuma movimentação no estoque do Plantão ainda. Comece pelo inventário: botão "Entrada" → "Inventário inicial".</td></tr>';
  return '<div class="idv-secao" style="margin-top:28px">Histórico do Plantão</div><div class="table-scroll"><table class="data-table idv-tabela"><thead><tr>'
    + '<th>Data/Hora</th><th>Tipo</th><th>Item</th><th>Tam.</th><th>Qtd</th><th>Série/IMEI</th><th>Equipe</th><th>Plantonista</th><th>Monitorado</th><th>Motivo</th><th>Obs.</th><th>Ações</th></tr></thead><tbody>' + corpo + '</tbody></table></div>';
}

/* ── consulta: onde está a unidade + movimentações que citam o termo ── */
function ep_consultar(valor) {
  const el = document.getElementById('ep-busca-res'); if (!el) return;
  const q = String(valor || '').trim(); if (q.length < 2) { el.innerHTML = ''; return; }
  const p = ep_get(), s = getEstoque(), ql = q.toLowerCase();
  const onde = ep_onde(q, ep_podeVerCme() ? s : null, p, ITENS_COM_SERIAL, ep_getTransf());
  const movs = p.movimentacoes.filter(m => [m.tipo, m.item, m.tamanho, m.monitorado, m.processo, m.motivo, m.obs, m.equipe, m.plantonista, m.responsavel, ...(m.seriais || [])].some(v => String(v || '').toLowerCase().includes(ql))).slice(0, 50);
  let h = onde ? '<div class="idv-faixa" style="border-color:var(--idv-in);background:var(--idv-in-f);margin-bottom:8px"><span><b class="idv-mono">' + esc(q) + '</b> — ' + esc(onde.item) + ': <b>' + esc(onde.texto) + '</b></span></div>' : '';
  h += movs.length ? '<div style="font-size:13px;color:var(--idv-sec);margin-bottom:4px">' + movs.length + ' movimentação(ões) do plantão com "' + esc(q) + '":</div>' + movs.map(m => '<div onclick="ep_verMov(\'' + _jsq(m.id) + '\')" style="cursor:pointer;display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--idv-linha);font-size:13px"><span class="idv-etq ' + (_EP_BADGE[m.tipo] || 'ne') + '">' + esc(m.tipo) + '</span><span class="idv-data">' + new Date(m.ts).toLocaleString('pt-BR') + '</span><span>' + esc(m.item) + ' \u{00D7}' + esc(m.quantidade) + '</span><span style="color:var(--idv-sec)">' + esc(m.monitorado || m.motivo || '') + '</span><span style="margin-left:auto;color:var(--idv-in);font-weight:600">\u{1F441} detalhe</span></div>').join('')
    : (onde ? '' : '<div style="color:var(--idv-sec);padding:8px 0">Nada encontrado para "' + esc(q) + '".</div>');
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

/* ── inventário inicial: aberto até o plantão encerrar; depois, item novo só pelo Estoque do CME ── */
async function ep_encerrarInventario() {
  if (!ep_podeMover()) return;
  const d = ep_get(), n = Object.values(d.itens).reduce((s, v) => s + (v || 0), 0);
  if (!confirm('ENCERRAR O INVENTÁRIO INICIAL DO PLANTÃO\n\nForam cadastrados ' + n + ' item(ns).\nDepois de encerrar, o plantão não usa mais a "Entrada": item novo chega pelo Estoque do CME ("A receber").\n\nConfirma que já cadastrou tudo o que existe na sala?')) return;
  const ok = await _epMutar(x => { if (x.inventarioEncerradoEm) return 'ja'; x.inventarioEncerradoEm = new Date().toISOString(); x.inventarioEncerradoPor = _epQuem(); });
  if (ok) { addLog('Estoque do Plantão: inventário inicial ENCERRADO com ' + n + ' item(ns) (' + _epQuem() + ')'); _mostrarToast('\u{2714} Inventário encerrado. Daqui em diante o material vem do Estoque do CME.', 'ok'); }
  ep_renderizar();
}
async function ep_reabrirInventario() {
  if (!usuarioAtual || usuarioAtual.nivel !== 'admin') return;
  if (!confirm('Reabrir o inventário do plantão?\n\nO plantão volta a poder cadastrar pela "Inventário inicial" até encerrar de novo.')) return;
  if (await _epMutar(x => { x.inventarioEncerradoEm = null; x.inventarioEncerradoPor = ''; })) addLog('Estoque do Plantão: inventário REABERTO (' + _epQuem() + ')');
  ep_renderizar();
}

/* ── mínimos do plantão ── */
function _epModal(titulo, corpo, rodape) {
  let ov = document.getElementById('ep-modal');
  if (!ov) { ov = document.createElement('div'); ov.className = 'modal-overlay'; ov.id = 'ep-modal'; document.body.appendChild(ov); }
  ov.innerHTML = '<div class="modal-box"><div class="modal-header"><h3>' + titulo + '</h3><button class="modal-close" onclick="fecharModal(\'ep-modal\')">\u{2715}</button></div>'
    + '<div class="modal-body" id="ep-modal-corpo">' + corpo + '</div><div class="modal-footer">' + rodape + '</div></div>';
  ov.classList.add('open');
}
function _epPodeMinimos() { return ep_podeMover(); }
function ep_abrirMinimos() {
  if (!_epPodeMinimos()) return;
  const d = ep_get(), linhas = Object.keys(EST_PADRAO.itens).map(k => '<div style="font-size:14px">' + esc(k.replace('Cinta_', 'Cinta ')) + '</div><input type="number" min="0" class="ep-min" data-chave="' + esc(k) + '" value="' + _epMin(d, k) + '" style="padding:5px 8px;border:1px solid var(--idv-borda);border-radius:6px;width:100%;font-size:14px">').join('');
  _epModal('\u{2699}\u{FE0F} Mínimos do estoque do Plantão', '<p style="color:var(--idv-sec);font-size:14px;margin-bottom:12px">Quando o saldo do plantão ficar igual ou abaixo do mínimo, a linha fica vermelha.</p><div style="display:grid;grid-template-columns:1fr 120px;gap:8px 16px;align-items:center">' + linhas + '</div>',
    _epBtn('Cancelar', "fecharModal('ep-modal')") + _epBtn('Salvar', 'ep_salvarMinimos()', 'btn-primary'));
}
async function ep_salvarMinimos() {
  if (!_epPodeMinimos()) return;
  const mins = {}; document.querySelectorAll('.ep-min').forEach(i => { mins[i.dataset.chave] = Math.max(0, parseInt(i.value, 10) || 0); });
  if (await _epMutar(d => { d.configuracoes.minimos = mins; })) { fecharModal('ep-modal'); ep_renderizar(); _mostrarToast('\u{2705} Mínimos do plantão salvos.', 'ok'); }
}

/* ── formulário de movimentação ── */
let _epForm = null; // { tipo }
// Saída: kit de instalação (módulo + cinta + trava + carregador) para um monitorado só, gravado de uma vez (pedido de 21/10)
const _EP_KIT = '__kit', _EP_MOD = 'Módulo eletrônico de monitoração', _EP_CARR = 'Carregador da tornozeleira';
function ep_abrirMov(tipo) {
  if (!ep_podeMover()) { alert('Sem permissão.'); return; }
  _epForm = { tipo };
  const soma = tipo === 'entrada' || tipo === 'devolucao';
  const cats = Object.keys(EST_TIPOS).map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
  const motivos = _EP_MOTIVOS[tipo].map(m => '<option>' + esc(m) + '</option>').join('');
  const campo = (lbl, html, id) => '<div class="form-field"' + (id ? ' id="' + id + '"' : '') + '><label>' + lbl + '</label>' + html + '</div>';
  const corpo = '<div style="font-size:13px;color:var(--idv-sec);margin-bottom:8px">Plantonista: <b>' + esc(_epQuem()) + '</b> · equipe <b>' + esc(_epEquipeHoje() || '—') + '</b> · <span class="idv-data">' + new Date().toLocaleString('pt-BR') + '</span></div>'
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
  // instalação nova é o caso comum da Saída: já abre no kit (dá para trocar para um item só)
  if (tipo === 'saida') { document.getElementById('ep-f-cat').value = 'Tornozeleira'; _epAtualizarTipos(); document.getElementById('ep-f-item').value = _EP_KIT; }
  _epAtualizarForm(); _epAtualizarMotivo();
}
function _epAtualizarTipos() {
  const cat = document.getElementById('ep-f-cat').value, tipos = cat ? (EST_TIPOS[cat] || []) : [];
  const kit = _epForm.tipo === 'saida' && cat === 'Tornozeleira' ? '<option value="' + _EP_KIT + '">Kit de instalação (módulo + cinta + trava + carregador)</option>' : '';
  document.getElementById('ep-f-item').innerHTML = '<option value="">Selecione...</option>' + kit + tipos.map(t => '<option value="' + esc(t) + '">' + esc(t) + '</option>').join('');
  _epAtualizarForm();
}
// lista de unidades com busca pelo nº: "60499" acha "60499-1"; Enter marca quando sobra uma só
function _epSoDig(s) { return String(s || '').toLowerCase().replace(/[^0-9a-z]/g, ''); }
function _epHtmlListaUnid(us, tipoInput, cls, lbl) {
  if (!us.length) return '<p style="color:var(--idv-at);font-size:13px">\u{26A0}\u{FE0F} Nenhuma unidade deste item no estoque do Plantão.</p>';
  return '<input type="search" class="ep-busca" placeholder="Buscar ' + lbl + '..." autocomplete="off" oninput="_epFiltrarUnid(this)" onkeydown="if(event.key===\'Enter\'){event.preventDefault();_epFiltrarUnid(this,true)}"'
    + ' style="width:100%;padding:6px 10px;border:1px solid var(--idv-borda);border-radius:6px;font-family:var(--idv-mono);font-size:14px;margin:4px 0 6px">'
    + '<div class="ep-lista" style="max-height:240px;overflow:auto;border:1px solid var(--idv-linha);border-radius:6px;padding:4px 8px">'
    + us.map(u => '<label class="ep-u-lin" data-busca="' + _epSoDig(u.id) + '" style="display:flex;gap:8px;align-items:center;padding:3px 0;font-size:14px;cursor:pointer"><input type="' + tipoInput + '" class="' + cls + '"' + (tipoInput === 'radio' ? ' name="' + cls + '"' : '') + ' value="' + esc(u.id) + '"><span class="idv-mono">' + esc(u.id) + '</span>'
      + (u.estado ? ' <span style="font-size:12px;color:var(--idv-sec)">' + esc(u.estado) + '</span>' : '') + (u.temCarregador ? ' \u{1F50B}' : '') + (u.temChip ? ' \u{1F4F6}' : '') + '</label>').join('')
    + '</div><div class="ep-busca-nada" style="display:none;color:var(--idv-at);font-size:13px;margin-top:4px">Nenhum nº encontrado com esse número.</div>';
}
function _epFiltrarUnid(inp, marcar) {
  const q = _epSoDig(inp.value), lista = inp.nextElementSibling, achou = [];
  lista.querySelectorAll('.ep-u-lin').forEach(l => {
    const bate = !!q && l.dataset.busca.includes(q); if (bate) achou.push(l);
    l.style.display = !q || bate || l.querySelector('input').checked ? 'flex' : 'none'; // o já marcado nunca some
  });
  lista.nextElementSibling.style.display = q && !achou.length ? '' : 'none';
  if (marcar && achou.length === 1) { achou[0].querySelector('input').checked = true; inp.value = ''; _epFiltrarUnid(inp); }
}
function _epHtmlKit() {
  const d = ep_get(), saldo = k => d.itens[k] || 0, mods = ep_unidades(d, _EP_MOD);
  const tams = EST_TAMANHOS.filter(t => saldo('Cinta_' + t) > 0), cinza = 'font-size:13px;color:var(--idv-sec)';
  const linha = (id, rot, resto) => '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:8px 0 4px;border-top:1px solid var(--idv-linha)">'
    + '<label style="display:flex;gap:8px;align-items:center;min-width:130px;font-weight:600;font-size:14px;cursor:pointer"><input type="checkbox" id="' + id + '" checked> ' + rot + '</label>' + resto + '</div>';
  const qtd = (id, k, unid) => '<input type="number" id="' + id + '" min="1" value="1" style="width:80px;padding:5px 8px;border:1px solid var(--idv-borda);border-radius:6px;font-size:14px"><span style="' + cinza + '">' + saldo(k) + (unid ? ' ' + unid : '') + ' no plantão</span>';
  return '<div class="form-section-title" style="margin-top:8px">Kit de instalação — desmarque o que não vai para este monitorado</div>'
    + linha('ep-k-usa-mod', 'Módulo', '<span style="' + cinza + '">marque o nº de série (' + mods.length + ' no plantão)</span>')
    + _epHtmlListaUnid(mods, 'radio', 'ep-k-mod', 'nº de série')
    + linha('ep-k-usa-cinta', 'Cinta', tams.length
      ? '<select id="ep-k-tam" style="padding:5px 8px;border:1px solid var(--idv-borda);border-radius:6px;font-size:14px"><option value="">Tamanho...</option>' + tams.map(t => '<option value="' + t + '">' + t + ' (' + saldo('Cinta_' + t) + ' no plantão)</option>').join('') + '</select>'
      : '<span style="color:var(--idv-at);font-size:13px">Nenhuma cinta no plantão</span>')
    + linha('ep-k-usa-trava', 'Pares de travas', qtd('ep-k-qtd-trava', 'Trava', 'pares'))
    + linha('ep-k-usa-carr', 'Carregador', qtd('ep-k-qtd-carr', _EP_CARR));
}
// monta as saídas do kit (uma por item marcado); null = avisou e parou
function _epOpsKit(v) {
  const marcado = id => !!(document.getElementById(id) || {}).checked, ops = [], cat = 'Tornozeleira';
  if (marcado('ep-k-usa-mod')) {
    const r = document.querySelector('#ep-unidades .ep-k-mod:checked');
    if (!r) { alert('Marque o nº de série do módulo (ou desmarque "Módulo").'); return null; }
    ops.push({ categoria: cat, item: _EP_MOD, tamanho: '', estado: '', seriais: [r.value], qtd: 1 });
  }
  if (marcado('ep-k-usa-cinta')) {
    if (!v('ep-k-tam')) { alert('Escolha o tamanho da cinta (ou desmarque "Cinta").'); return null; }
    ops.push({ categoria: cat, item: 'Cinta', tamanho: v('ep-k-tam'), estado: '', qtd: 1 });
  }
  for (const [usa, campo, item, rot] of [['ep-k-usa-trava', 'ep-k-qtd-trava', 'Trava', 'Pares de travas'], ['ep-k-usa-carr', 'ep-k-qtd-carr', _EP_CARR, 'Carregador']]) {
    if (!marcado(usa)) continue;
    if (!(parseInt(v(campo), 10) >= 1)) { alert('Informe a quantidade de ' + rot + ' (mínimo 1) ou desmarque.'); return null; }
    ops.push({ categoria: cat, item, tamanho: '', estado: '', qtd: v(campo) });
  }
  if (!ops.length) { alert('Marque ao menos um item do kit.'); return null; }
  return ops;
}
function _epAtualizarMotivo() {
  const sel = document.getElementById('ep-f-motsel'), row = document.getElementById('ep-row-mottxt');
  if (row) row.style.display = !sel || sel.value === 'Outro' ? '' : 'none';
}
function _epAtualizarForm() {
  const item = (document.getElementById('ep-f-item') || {}).value || '', soma = _epForm.tipo === 'entrada' || _epForm.tipo === 'devolucao';
  document.getElementById('ep-row-tam').style.display = item === 'Cinta' ? '' : 'none';
  // saída de item com nº de série: a quantidade é o número de unidades marcadas
  document.getElementById('ep-row-qtd').style.display = (ITENS_COM_SERIAL.includes(item) && !soma) || item === _EP_KIT ? 'none' : '';
  const rEst = document.getElementById('ep-row-estado'); if (rEst && _epForm.tipo === 'envio') rEst.style.display = ITENS_COM_SERIAL.includes(item) ? 'none' : '';
  _epAtualizarUnidades();
}
function _epAtualizarUnidades() {
  const box = document.getElementById('ep-unidades'); if (!box) return;
  const item = document.getElementById('ep-f-item').value, soma = _epForm.tipo === 'entrada' || _epForm.tipo === 'devolucao';
  if (item === _EP_KIT) { box.innerHTML = _epHtmlKit(); return; }
  if (!ITENS_COM_SERIAL.includes(item)) { box.innerHTML = ''; return; }
  const dpp = item === 'Dispositivo DPP', lbl = dpp ? 'IMEI' : 'Nº de série';
  if (soma) {
    const n = Math.min(50, parseInt(document.getElementById('ep-f-qtd').value, 10) || 0);
    const ja = [...box.querySelectorAll('.ep-u-id')].map(i => i.value);
    box.innerHTML = n ? '<div class="form-section-title" style="margin-top:8px">' + lbl + ' de cada unidade</div>' + Array.from({ length: n }, (_, i) => '<div class="ep-u" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap"><span style="min-width:22px;font-weight:600;color:var(--idv-sec)">' + (i + 1) + '.</span>'
      + '<input type="text" class="ep-u-id" placeholder="' + lbl + ' ' + (i + 1) + '" value="' + esc(ja[i] || '') + '" style="flex:1;min-width:160px;padding:6px 10px;border:1px solid var(--idv-borda);border-radius:6px;font-family:var(--idv-mono);font-size:14px">'
      + (dpp ? '<label style="font-size:13px;white-space:nowrap"><input type="checkbox" class="ep-u-car"> \u{1F50B} Carregador</label><label style="font-size:13px;white-space:nowrap"><input type="checkbox" class="ep-u-chip"> \u{1F4F6} Chip</label>' : '') + '</div>').join('') : '';
    return;
  }
  const us = ep_unidades(ep_get(), item);
  box.innerHTML = '<div class="form-section-title" style="margin-top:8px">Marque o ' + lbl + ' de cada unidade que sai (' + us.length + ' no plantão)</div>'
    + _epHtmlListaUnid(us, 'checkbox', 'ep-u-sel', lbl);
}
async function ep_confirmarMov() {
  const tipo = _epForm && _epForm.tipo; if (!tipo) return;
  const v = id => ((document.getElementById(id) || {}).value || '').trim();
  const item = v('ep-f-item'), soma = tipo === 'entrada' || tipo === 'devolucao', serial = ITENS_COM_SERIAL.includes(item);
  if (!v('ep-f-cat')) return alert('Selecione a categoria.');
  if (!item) return alert('Selecione o tipo de item.');
  const kit = item === _EP_KIT, ops = kit ? _epOpsKit(v) : null;
  if (kit && !ops) return;
  let op = null;
  if (!kit) {
    if (item === 'Cinta' && !v('ep-f-tam')) return alert('Selecione o tamanho da cinta.');
    const pedeEstado = soma || (tipo === 'envio' && !serial);
    op = { categoria: v('ep-f-cat'), item, tamanho: item === 'Cinta' ? v('ep-f-tam') : '', estado: pedeEstado ? v('ep-f-estado') : '' };
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
  }
  const sel = v('ep-f-motsel'), txt = v('ep-f-mottxt');
  const motivo = tipo === 'baixa' ? txt : sel === 'Outro' ? txt : sel + (txt ? ' — ' + txt : '');
  if (!motivo) return alert('Informe o motivo.');
  const mon = v('ep-f-mon');
  if ((tipo === 'saida' || tipo === 'devolucao') && !mon) return alert('Informe o monitorado.');
  const extra = { motivo, monitorado: mon, processo: v('ep-f-proc'), obs: v('ep-f-obs') };
  const ok = kit ? await ep_salvarKit(ops, extra) : await ep_salvarMov(tipo, op, extra);
  if (!ok) return;
  fecharModal('ep-modal');
  _mostrarToast(kit ? '\u{2713} Saída do kit registrada para ' + mon + ': ' + ops.map(o => o.item === _EP_MOD ? 'módulo ' + o.seriais[0] : o.item === 'Cinta' ? 'cinta ' + o.tamanho : (o.item === 'Trava' ? 'pares de travas' : 'carregador') + ' ×' + o.qtd).join(', ') + '.'
    : '\u{2713} ' + EP_TIPO[tipo] + ' registrada no estoque do Plantão.' + (tipo === 'envio' ? ' Fica "a receber" no Estoque do CME.' : ''), 'ok');
  ep_renderizar(); try { _dashEstoqueDisp(); } catch (e) {}
}

/* ── cadastro manual de dispositivos (gerência e admin, 26/10/2026): digita ou cola a lista de nº de série/IMEI,
   cada número é conferido na hora e a lista entra de uma vez. Regras em ep_cadastrarDispositivos. ── */
const _EP_MOTIVOS_CAD = ['Dispositivo novo recebido do fornecedor', 'Acerto de inventário (estava na sala e não foi lançado)', 'Outro'];
function ep_abrirCadastro() {
  if (!ep_podeCadastrar()) { alert('Só a gerência e o administrador cadastram dispositivos.'); return; }
  const campo = (lbl, html, id) => '<div class="form-field"' + (id ? ' id="' + id + '"' : '') + '><label>' + lbl + '</label>' + html + '</div>';
  const corpo = '<div style="font-size:13px;color:var(--idv-sec);margin-bottom:8px">Cadastrado por <b>' + esc(_epQuem()) + '</b> · <span class="idv-data">' + new Date().toLocaleString('pt-BR') + '</span> · entra direto no estoque do Plantão</div>'
    + '<div class="form-grid">' + campo('Dispositivo *', '<select id="ep-c-item" onchange="_epPreviaCadastro()"><option value="' + esc(_EP_MOD) + '">Módulo eletrônico (tornozeleira)</option><option value="Dispositivo DPP">Dispositivo DPP (botão do pânico)</option></select>')
    + campo('Estado *', '<select id="ep-c-estado"><option>Novo</option><option>Reutilizado</option></select>') + '</div>'
    + campo('<span id="ep-c-rot">Nº de série</span> — um por linha (pode colar uma lista) *', '<textarea id="ep-c-ids" rows="6" oninput="_epPreviaCadastro()" placeholder="63316-4&#10;63625-8" style="width:100%;padding:8px 10px;border:1px solid var(--idv-borda);border-radius:6px;font-family:var(--idv-mono);font-size:14px;resize:vertical"></textarea>')
    + '<div id="ep-c-dpp" style="display:none;gap:16px;margin:4px 0 8px;font-size:14px"><label><input type="checkbox" id="ep-c-car"> \u{1F50B} Todos vêm com carregador</label><label><input type="checkbox" id="ep-c-chip"> \u{1F4F6} Todos vêm com chip</label></div>'
    + '<div id="ep-c-previa" style="margin:4px 0 12px"></div>'
    + '<div class="form-grid">' + campo('Motivo *', '<select id="ep-c-motsel" onchange="document.getElementById(\'ep-c-row-mottxt\').style.display=this.value===\'Outro\'?\'\':\'none\'">' + _EP_MOTIVOS_CAD.map(m => '<option>' + esc(m) + '</option>').join('') + '</select>')
    + campo('Qual motivo? *', '<input type="text" id="ep-c-mottxt" placeholder="Descreva">', 'ep-c-row-mottxt') + '</div>'
    + '<div class="form-grid">' + campo('Observação', '<input type="text" id="ep-c-obs" placeholder="Opcional (ex.: nº da nota, lote, quem entregou)">') + '</div>';
  _epModal('\u{2795} Cadastrar dispositivos no estoque do Plantão', corpo, _epBtn('Cancelar', "fecharModal('ep-modal')") + '<button type="button" class="btn-primary" id="ep-c-ok" onclick="ep_confirmarCadastro()" disabled>Cadastrar</button>');
  document.getElementById('ep-c-row-mottxt').style.display = 'none';
  _epPreviaCadastro();
  document.getElementById('ep-c-ids').focus();
}
function _epPreviaCadastro() {
  const item = document.getElementById('ep-c-item').value, dpp = item === 'Dispositivo DPP', lbl = dpp ? 'IMEI' : 'Nº de série';
  document.getElementById('ep-c-rot').textContent = lbl;
  document.getElementById('ep-c-ids').placeholder = dpp ? '356938035643809\n356938035643817' : '63316-4\n63625-8';
  document.getElementById('ep-c-dpp').style.display = dpp ? 'flex' : 'none';
  const res = ep_conferirCadastro(ep_lerListaIds(document.getElementById('ep-c-ids').value), item, ep_get(), getEstoque(), ep_getTransf());
  const bons = res.filter(r => !r.problema).length, ruins = res.length - bons;
  const btn = document.getElementById('ep-c-ok');
  btn.disabled = !res.length || ruins > 0;
  btn.style.opacity = btn.disabled ? '.45' : ''; btn.style.cursor = btn.disabled ? 'default' : ''; // o site não tem estilo de botão desabilitado
  btn.textContent = res.length && !ruins ? 'Cadastrar ' + bons + ' ' + (bons === 1 ? 'dispositivo' : 'dispositivos') : 'Cadastrar';
  document.getElementById('ep-c-previa').innerHTML = !res.length ? ''
    : '<div style="font-size:13px;margin-bottom:4px">' + (ruins ? '<span style="color:var(--idv-cr);font-weight:600">' + ruins + ' com problema — corrija ou apague para liberar o cadastro.</span> ' : '') + '<span style="color:var(--idv-sec)">' + bons + ' pronto(s) para entrar.</span></div>'
      + '<div style="max-height:200px;overflow:auto;border:1px solid var(--idv-linha);border-radius:6px;padding:4px 8px">'
      + res.map(r => '<div style="display:flex;gap:8px;align-items:baseline;padding:3px 0;font-size:13px;' + (r.problema ? 'box-shadow:inset 3px 0 0 var(--idv-cr);padding-left:8px' : r.aviso ? 'box-shadow:inset 3px 0 0 var(--idv-at);padding-left:8px' : '') + '">'
        + '<span class="idv-mono" style="min-width:150px">' + esc(r.id) + '</span>'
        + (r.problema ? '<span style="color:var(--idv-cr)">\u{2715} ' + esc(r.problema) + '</span>' : r.aviso ? '<span style="color:var(--idv-at)">\u{26A0}\u{FE0F} ' + esc(r.aviso) + ' — confira</span>' : '<span style="color:var(--idv-ok)">\u{2713} novo</span>') + '</div>').join('')
      + '</div>';
}
async function ep_confirmarCadastro() {
  const v = id => ((document.getElementById(id) || {}).value || '').trim();
  const item = v('ep-c-item'), estado = v('ep-c-estado'), ids = ep_lerListaIds(v('ep-c-ids'));
  const car = !!document.getElementById('ep-c-car').checked, chip = !!document.getElementById('ep-c-chip').checked, dpp = item === 'Dispositivo DPP';
  const sel = v('ep-c-motsel'), motivo = sel === 'Outro' ? v('ep-c-mottxt') : sel;
  if (!motivo) return alert('Descreva o motivo.');
  const btn = document.getElementById('ep-c-ok'); btn.disabled = true; btn.textContent = 'Gravando...';
  const op = { categoria: _EP_CAT[item], item, tamanho: '', estado, unidades: ids.map(id => ({ id, estado, temCarregador: dpp && car, temChip: dpp && chip })) };
  const ok = await ep_cadastrarDispositivos(op, { motivo: 'Cadastro manual — ' + motivo, obs: v('ep-c-obs') });
  if (!ok) { _epPreviaCadastro(); return; }
  fecharModal('ep-modal');
  _mostrarToast('\u{2713} ' + ids.length + ' ' + (dpp ? 'DPP' : 'módulo(s)') + ' cadastrado(s) no estoque do Plantão.', 'ok');
  ep_renderizar(); try { _dashEstoqueDisp(); } catch (e) {}
}
