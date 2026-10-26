/* ═══════════════════════════ ESTOQUE DO PLANTÃO — regras e dados ═══════════════════════════
   Pedido de 20/10/2026: o plantão passa a ter um estoque PRÓPRIO, um só para as 5 equipes (ALFA a ECHO),
   com as mesmas funções do setor de Estoque. A obrigação do plantão é lançar, na hora, tudo que entra e sai.
   • Store "estoque_plantao" (chave cme_estoque_plantao). ⚠️ NÃO usar nome que comece com "plantao_":
     no banco, cme_plantao_* só abre para gerência/admin (seguranca-banco/6-plantoes-gerencia.sql).
   • Mesma estrutura do store "estoque" do setor: itens (saldo), registros/seriais (uma linha por nº de série
     ou nº de estoque do DPP), movimentacoes. Aba própria "Estoque Plantão" (plantão, gerência e admin).
   • Cada lado só vê e altera o PRÓPRIO estoque (pedido dele, 20/10): o plantão não vê nem mexe no do CME e o CME
     não vê nem mexe no do plantão; admin e gerência veem os dois; o Dashboard mostra o resumo dos dois a todos.
   • Transferências num registro neutro "estoque_transferencias": Saída do setor para o plantão fica "a receber";
     o plantonista confere e Recebe (lança no Plantão) ou Recusa (o setor clica "Receber de volta" e lança no CME).
     O plantão devolve ao setor do mesmo jeito (Envio ao setor).
   • Toda gravação relê o banco, espera a confirmação e vai em fila; o que ficar pela metade aparece com "Concluir".
   Depende das constantes do Estoque no index.html (EST_PADRAO, ITENS_COM_SERIAL, EST_TIPOS...).
   A tela fica em estoque-plantao-tela.js. Emojis só por \u{...}. Prefixo ep_ / _ep / EP_. */

const EP_STORE = 'estoque_plantao';
const EP_TIPO = { entrada: 'Entrada', saida: 'Saída', devolucao: 'Devolução', baixa: 'Baixa', envio: 'Envio ao setor', recebimento: 'Recebimento' };
const EP_SOMA = ['Entrada', 'Devolução', 'Recebimento'];  // tipos que entram no saldo
const EP_LIMITE_MOV = 1000, EP_LIMITE_TRANSF = 400;
const EP_SETOR_PARA_PLANTAO = 'setor-plantao', EP_PLANTAO_PARA_SETOR = 'plantao-setor';

/* ───────────────────────── funções puras (testadas em scratchpad/teste_ep.js) ───────────────────────── */
function _epCopia(x) { return JSON.parse(JSON.stringify(x)); }
function _epId(prefixo) { return prefixo + Date.now() + '-' + Math.random().toString(36).slice(2, 7); }
function _epIdUnid(r) { return (r && (r.imei || r.serial)) || ''; }
function ep_chave(item, tamanho) { return item === 'Cinta' ? 'Cinta_' + tamanho : item; }

// cópia normalizada (nunca devolve o objeto do cache)
function ep_normalizar(d, itensPadrao) {
  const x = d ? _epCopia(d) : {};
  x.itens = Object.assign({}, itensPadrao, x.itens || {});
  x.seriais = x.seriais || {};
  x.registros = x.registros || {};
  x.movimentacoes = x.movimentacoes || [];
  x.transferencias = x.transferencias || [];
  x.configuracoes = x.configuracoes || {};
  x.configuracoes.minimos = x.configuracoes.minimos || {};
  return x;
}

// unidades (nº de série / nº de estoque) que estão neste estoque: registros (formato novo) + seriais (formato antigo)
function ep_unidades(d, item) {
  const mapa = {};
  ((d.seriais || {})[item] || []).forEach(id => { mapa[id] = { id, estado: '', temCarregador: false, temChip: false }; });
  ((d.registros || {})[item] || []).forEach(r => { const id = _epIdUnid(r); if (id) mapa[id] = { id, estado: r.estado || '', temCarregador: !!r.temCarregador, temChip: !!r.temChip }; });
  return Object.values(mapa);
}

/* Aplica uma entrada ou saída num estoque (setor OU plantão — a estrutura é a mesma).
   op = { soma, item, tamanho, qtd, estado, unidades:[{id,estado,temCarregador,temChip}] (quando soma), seriais:[id] (quando tira) }
   Valida TUDO antes de mexer. Devolve { erro } ou { unidades } (as unidades que entraram ou saíram). */
function ep_aplicar(d, op, comSerial) {
  const chave = ep_chave(op.item, op.tamanho);
  if (!(chave in d.itens)) return { erro: 'Item desconhecido: ' + chave + '.' };
  const qtd = parseInt(op.qtd, 10) || 0;
  if (qtd < 1) return { erro: 'Informe uma quantidade válida (mínimo 1).' };
  const saldo = d.itens[chave] || 0;
  if (!op.soma && qtd > saldo) return { erro: 'Saldo insuficiente: há ' + saldo + ' unidade(s) de ' + chave.replace('_', ' ') + '.' };
  let unidades = [];
  if (comSerial) {
    const lbl = op.item === 'Dispositivo DPP' ? 'nº de estoque' : 'nº de série';
    const ja = ep_unidades(d, op.item), jaIds = new Set(ja.map(u => u.id));
    if (op.soma) {
      unidades = (op.unidades || []).map(u => Object.assign({}, u, { id: String(u.id || '').trim() })).filter(u => u.id);
      if (unidades.length !== qtd) return { erro: 'Informe o ' + lbl + ' de cada unidade (' + qtd + ').' };
      if (new Set(unidades.map(u => u.id)).size !== unidades.length) return { erro: 'Há ' + lbl + ' repetido na lista.' };
      const repetido = unidades.find(u => jaIds.has(u.id));
      if (repetido) return { erro: 'O ' + lbl + ' "' + repetido.id + '" já está neste estoque.' };
    } else {
      const ids = (op.seriais || []).map(s => String(s || '').trim()).filter(Boolean);
      if (ids.length !== qtd) return { erro: 'Escolha o ' + lbl + ' de cada unidade (' + qtd + ').' };
      if (new Set(ids).size !== ids.length) return { erro: 'Há ' + lbl + ' repetido na lista.' };
      const falta = ids.find(id => !jaIds.has(id));
      if (falta) return { erro: 'O ' + lbl + ' "' + falta + '" não está neste estoque.' };
      unidades = ids.map(id => ja.find(u => u.id === id));
    }
  }
  // validado: agora sim altera
  d.itens[chave] = saldo + (op.soma ? qtd : -qtd);
  if (comSerial) {
    const regs = d.registros[op.item] = d.registros[op.item] || [];
    const sers = d.seriais[op.item] = d.seriais[op.item] || [];
    if (op.soma) {
      unidades.forEach(u => {
        const reg = { estado: u.estado || op.estado || '', entradaEm: new Date().toISOString() };
        if (op.item === 'Dispositivo DPP') { reg.imei = u.id; reg.temCarregador = !!u.temCarregador; reg.temChip = !!u.temChip; } else reg.serial = u.id;
        regs.push(reg); if (!sers.includes(u.id)) sers.push(u.id);
      });
    } else {
      const sai = new Set(unidades.map(u => u.id));
      d.registros[op.item] = regs.filter(r => !sai.has(_epIdUnid(r)));
      d.seriais[op.item] = sers.filter(s => !sai.has(s));
    }
  }
  return { unidades };
}

function ep_mov(tipo, op, unidades, extra) {
  return Object.assign({
    id: _epId(''), ts: new Date().toISOString(), tipo, categoria: op.categoria || '', item: op.item, tamanho: op.tamanho || '',
    quantidade: parseInt(op.qtd, 10) || 0, estado: op.estado || '', seriais: (unidades || []).map(u => u.id),
  }, extra || {});
}
function ep_registrarMov(d, mov) {
  d.movimentacoes.unshift(mov);
  if (d.movimentacoes.length > EP_LIMITE_MOV) d.movimentacoes = d.movimentacoes.slice(0, EP_LIMITE_MOV);
}

// transferências: guardadas no store do plantão (as duas direções)
function ep_novaTransf(d, t) {
  const nova = Object.assign({ id: _epId('tr-'), status: 'pendente', enviadoEm: new Date().toISOString() }, t);
  d.transferencias.unshift(nova);
  if (d.transferencias.length > EP_LIMITE_TRANSF) {
    // nunca descarta uma pendente
    const pend = d.transferencias.filter(x => x.status === 'pendente'), resto = d.transferencias.filter(x => x.status !== 'pendente');
    d.transferencias = pend.concat(resto.slice(0, Math.max(0, EP_LIMITE_TRANSF - pend.length)))
      .sort((a, b) => (b.enviadoEm || '').localeCompare(a.enviadoEm || ''));
  }
  return nova;
}
// estados: pendente → recebida (quem recebeu lança no SEU estoque) | recusada → devolvida (quem enviou lança de volta no SEU)
const _EP_PALAVRA = { recebida: 'recebida', recusada: 'recusada', devolvida: 'recebida de volta', pendente: 'deixada pendente' };
function ep_decidir(d, id, status, por, motivo, de) {
  const t = d.transferencias.find(x => x.id === id);
  if (!t) return { erro: 'Essa transferência não existe mais. Atualize a tela.' };
  if (t.status !== (de || 'pendente')) return { erro: 'Essa transferência já foi ' + (_EP_PALAVRA[t.status] || t.status) + (t.decididoPor ? ' por ' + t.decididoPor : '') + '. Atualize a tela.' };
  if (status === 'devolvida') { t.devolvidaPor = por || ''; t.devolvidaEm = new Date().toISOString(); }
  else { t.decididoPor = por || ''; t.decididoEm = new Date().toISOString(); t.motivoDecisao = motivo || ''; }
  t.status = status;
  return { t };
}
// qual lado lança no próprio estoque, e quando: recebida → destino; devolvida → origem
function ep_ladoQueLanca(t) {
  const destino = t.sentido === EP_SETOR_PARA_PLANTAO ? 'plantao' : 'setor', origem = destino === 'plantao' ? 'setor' : 'plantao';
  return t.status === 'recebida' ? destino : t.status === 'devolvida' ? origem : null;
}
function ep_pendentes(d, sentido) { return (d.transferencias || []).filter(t => t.status === 'pendente' && t.sentido === sentido); }
// a operação "soma" que devolve a mercadoria de uma transferência
function ep_opDaTransf(t) { return { soma: true, categoria: t.categoria, item: t.item, tamanho: t.tamanho, qtd: t.quantidade, estado: t.estado, unidades: t.unidades || [] }; }

// novos × reutilizados por item (a tela mostra as duas colunas, igual ao setor)
function ep_porEstado(d, itensPadrao, comSerialLista) {
  const novo = {}, reut = {};
  Object.keys(itensPadrao).forEach(k => { novo[k] = 0; reut[k] = 0; });
  const corte = d.recontagemEm || '';
  // a lista é gravada do mais novo p/ o mais velho: inverte e ordena (sort estável desempata pela ordem gravada)
  [...(d.movimentacoes || [])].reverse().filter(m => !corte || (m.ts || '') >= corte).sort((a, b) => (a.ts || '').localeCompare(b.ts || '')).forEach(m => {
    if (comSerialLista.includes(m.item)) return;
    const k = ep_chave(m.item, m.tamanho); if (!(k in novo)) return;
    const q = parseInt(m.quantidade, 10) || 0, soma = EP_SOMA.includes(m.tipo);
    const alvo = m.estado === 'Reutilizado' ? reut : m.estado === 'Novo' ? novo : (novo[k] >= reut[k] ? novo : reut);
    alvo[k] = Math.max(0, alvo[k] + (soma ? q : -q));
  });
  comSerialLista.forEach(item => {
    const us = ep_unidades(d, item);
    novo[item] = us.filter(u => u.estado === 'Novo').length; reut[item] = us.filter(u => u.estado === 'Reutilizado').length;
  });
  return { novo, reutilizado: reut };
}

// onde está uma unidade (nº de série / nº de estoque): plantão, setor, a caminho, ou o último destino conhecido
// setor = null quando quem consulta não pode ver o estoque do CME (plantonista)
function ep_onde(id, setor, plantao, comSerialLista, transf) {
  id = String(id || '').trim(); if (!id) return null;
  const tem = (d, item) => !!d && ep_unidades(d, item).some(u => u.id === id);
  for (const item of comSerialLista) {
    if (tem(plantao, item)) return { onde: 'plantao', item, texto: 'No estoque do Plantão' };
    if (tem(setor, item)) return { onde: 'setor', item, texto: 'No setor de Estoque' };
  }
  const t = ((transf || {}).transferencias || []).find(x => (x.status === 'pendente' || x.status === 'recusada') && (x.unidades || []).some(u => u.id === id));
  if (t) return { onde: 'caminho', item: t.item, texto: t.status === 'recusada' ? 'Recusado — aguardando quem enviou receber de volta'
    : t.sentido === EP_SETOR_PARA_PLANTAO ? 'A caminho do Plantão (aguarda o plantonista receber)' : 'A caminho do setor de Estoque (aguarda o setor receber)' };
  const ult = [...(plantao.movimentacoes || []), ...((setor && setor.movimentacoes) || [])].filter(m => (m.seriais || []).includes(id)).sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))[0];
  if (!ult) return null;
  const quando = new Date(ult.ts).toLocaleDateString('pt-BR');
  if (ult.tipo === 'Saída') return { onde: 'fora', item: ult.item, texto: 'Saiu em ' + quando + (ult.monitorado ? ' para ' + ult.monitorado : '') + (ult.motivo ? ' (' + ult.motivo + ')' : '') };
  if (ult.tipo === 'Baixa') return { onde: 'baixa', item: ult.item, texto: 'Baixa em ' + quando + (ult.motivo ? ' — ' + ult.motivo : '') };
  return { onde: 'fora', item: ult.item, texto: 'Última movimentação: ' + ult.tipo + ' em ' + quando };
}

if (typeof module !== 'undefined') module.exports = { ep_normalizar, ep_unidades, ep_aplicar, ep_mov, ep_registrarMov, ep_novaTransf, ep_decidir, ep_ladoQueLanca, ep_pendentes, ep_opDaTransf, ep_porEstado, ep_onde, ep_chave, EP_SETOR_PARA_PLANTAO, EP_PLANTAO_PARA_SETOR };

/* ───────────────────────── leitura e gravação no banco ─────────────────────────
   Regra (20/10/2026): cada lado só ALTERA o próprio estoque. O plantão nunca grava no estoque do CME e o setor
   nunca grava no estoque do Plantão. As transferências ficam num registro neutro ("estoque_transferencias"):
   quem recebe lança no próprio estoque; se recusar, quem enviou clica "Receber de volta" e lança no seu. */
const EP_STORE_TR = 'estoque_transferencias';
function ep_get() { return ep_normalizar(carregarStore(EP_STORE, null), EST_PADRAO.itens); }
function ep_getTransf() { const d = carregarStore(EP_STORE_TR, null); return { transferencias: _epCopia((d && d.transferencias) || []) }; }
function _epSerial(item) { return ITENS_COM_SERIAL.includes(item); }
async function _epLerFresco(chave) {
  if (!window._db) return carregarStore(chave, null);
  const r = await _dbLerChave('cme_' + chave);
  if (r.error) throw r.error;
  return r.data ? r.data.value : null;
}
// grava ESPERANDO o banco confirmar (o salvarStore do index não espera). Erro → desfaz o cache e devolve false.
async function _epGravar(chave, valor) {
  const anterior = _cache[chave];
  _cache[chave] = valor;
  if (!window._db || typeof _dbGravar !== 'function') { salvarStore(chave, valor); return true; }
  let erro = null;
  try { erro = (await _dbGravar('cme_' + chave, valor)).error; } catch (e) { erro = e; }
  if (erro) {
    _cache[chave] = anterior;
    _mostrarToast(typeof _dbEstourouTempo === 'function' && _dbEstourouTempo(erro)
      ? '\u{26A0}\u{FE0F} O banco demorou demais para responder (tentei 3 vezes) — nada foi salvo. Aguarde alguns segundos e faça de novo.'
      : '\u{26A0}\u{FE0F} Erro ao salvar no banco: ' + (erro.message || erro) + ' — nada foi salvo.', 'erro');
    return false;
  }
  return true;
}
// fila: duas gravações do mesmo computador nunca leem a mesma base (a 2ª apagaria a 1ª)
let _epFila = Promise.resolve();
function _epNaFila(fn) { const p = _epFila.then(fn, fn); _epFila = p.catch(() => {}); return p; }
// relê do banco, aplica fn (false = desiste, 'ja' = nada a fazer, { erro } = avisa) e grava
function _epMutarStore(chave, normalizar, fn) {
  return _epNaFila(async () => {
    let base;
    try { base = await _epLerFresco(chave); } catch (e) { _mostrarToast('Sem conexão com o banco — nada foi salvo. Tente de novo.', 'erro'); return false; }
    const d = normalizar(base), r = fn(d);
    if (r === false) return false;
    if (r === 'ja') return true;
    if (r && r.erro) { alert(r.erro); return false; }
    return _epGravar(chave, d);
  });
}
// estoque do PLANTÃO — só o plantão (e o admin) chama; o cadastro manual passa a própria permissão (gerência e admin)
function _epMutar(fn, pode) {
  if (!(pode === undefined ? ep_podeMover() : pode)) { alert('Sem permissão para alterar o estoque do Plantão.'); return Promise.resolve(false); }
  return _epMutarStore(EP_STORE, b => ep_normalizar(b, EST_PADRAO.itens), fn);
}
// registro de transferências (neutro: não é estoque de ninguém)
function _epMutarTransf(fn) { return _epMutarStore(EP_STORE_TR, b => ({ transferencias: _epCopia((b && b.transferencias) || []) }), fn); }
// estoque do SETOR — só o setor (e o admin) chama; só ACRESCENTA movimentação
function _epMutarSetor(fn) {
  if (!podeAlterarEstoque()) { alert('Sem permissão para alterar o estoque do CME.'); return Promise.resolve(false); }
  return _epNaFila(async () => {
    let base;
    try { base = await _epLerFresco('estoque'); } catch (e) { _mostrarToast('Sem conexão com o banco — nada foi salvo. Tente de novo.', 'erro'); return false; }
    if (!base) { alert('Os dados do estoque ainda não carregaram. Recarregue a página (F5) e tente de novo.'); return false; }
    const anterior = _cache.estoque;
    _cache.estoque = _epCopia(base);
    const est = getEstoque(), r = fn(est);
    if (r === 'ja') { _cache.estoque = base; return true; }
    if (r === false || (r && r.erro)) { _cache.estoque = anterior; if (r && r.erro) alert(r.erro); return false; }
    _recalcularItensPorEstado(est);
    const ok = await _epGravar('estoque', est);
    if (!ok) _cache.estoque = anterior;
    return ok;
  });
}
// depois de gravar a decisão, confere no banco se ela ficou (outro computador pode ter decidido no mesmo instante)
async function _epDecisaoFicou(t) {
  try {
    const b = await _epLerFresco(EP_STORE_TR), x = ((b && b.transferencias) || []).find(y => y.id === t.id);
    return !!x && x.status === t.status && (x.decididoEm || '') === (t.decididoEm || '') && (x.devolvidaEm || '') === (t.devolvidaEm || '');
  } catch (e) { return false; }
}
function _epQuem() { return (usuarioAtual && usuarioAtual.nome) || ''; }
function _epEquipeHoje() { try { return getPlantaoParaData(_diaPlantao()); } catch (e) { return ''; } }
function _epDesc(t) { return t.item + (t.tamanho ? ' ' + t.tamanho : '') + ' ×' + t.quantidade + ((t.unidades || []).length ? ' (' + t.unidades.map(u => u.id).join(', ') + ')' : ''); }

/* ── lançar a parte de uma transferência no PRÓPRIO estoque (idempotente pelo transferenciaId) ── */
function _epMotivoLanc(t) {
  if (t.status === 'recebida') return t.sentido === EP_SETOR_PARA_PLANTAO ? 'Recebido do setor de Estoque (enviado por ' + (t.enviadoPor || '?') + ')'
    : 'Devolvido pelo plantão' + (t.motivo ? ': ' + t.motivo : '') + ' (enviado por ' + (t.enviadoPor || '?') + ')';
  return (t.sentido === EP_SETOR_PARA_PLANTAO ? 'Recusado pelo plantão' : 'Recusado pelo setor de Estoque') + (t.motivoDecisao ? ': ' + t.motivoDecisao : '') + ' — recebido de volta';
}
function _epLancarNoPlantao(t) {
  return _epMutar(d => {
    if (d.movimentacoes.some(m => m.transferenciaId === t.id)) return 'ja';
    const op = ep_opDaTransf(t), ap = ep_aplicar(d, op, _epSerial(t.item)); if (ap.erro) return ap;
    ep_registrarMov(d, ep_mov(t.status === 'recebida' ? EP_TIPO.recebimento : EP_TIPO.devolucao, op, ap.unidades,
      { responsavel: _epQuem(), plantonista: _epQuem(), equipe: _epEquipeHoje(), motivo: _epMotivoLanc(t), obs: t.obs || '', transferenciaId: t.id }));
  });
}
function _epLancarNoSetor(t) {
  return _epMutarSetor(est => {
    if ((est.movimentacoes || []).some(m => m.transferenciaId === t.id)) return 'ja';
    const op = ep_opDaTransf(t), ap = ep_aplicar(est, op, _epSerial(t.item)); if (ap.erro) return ap;
    est.movimentacoes.unshift(ep_mov('Devolução', op, ap.unidades, { responsavel: _epQuem(), motivo: _epMotivoLanc(t), obs: t.obs || '', transferenciaId: t.id }));
    if (est.movimentacoes.length > 500) est.movimentacoes = est.movimentacoes.slice(0, 500);
  });
}
function _epLancar(t) { return ep_ladoQueLanca(t) === 'plantao' ? _epLancarNoPlantao(t) : _epLancarNoSetor(t); }
function _epPodeLado(lado) { return lado === 'plantao' ? ep_podeMover() : podeAlterarEstoque(); }
function _epRender() { try { ep_renderizar(); } catch (e) {} try { renderizarEstoque(); } catch (e) {} try { _dashEstoqueDisp(); } catch (e) {} }

/* ── decidir uma transferência: recebida / recusada (quem recebe) ou devolvida (quem enviou, depois da recusa) ── */
async function ep_decidirTransf(id, status, motivo) {
  const t0 = ep_getTransf().transferencias.find(x => x.id === id); if (!t0) { _epRender(); return; }
  const destino = t0.sentido === EP_SETOR_PARA_PLANTAO ? 'plantao' : 'setor', origem = destino === 'plantao' ? 'setor' : 'plantao';
  const lado = status === 'devolvida' ? origem : destino;
  if (!_epPodeLado(lado)) { alert('Sem permissão.'); return; }
  let t = null;
  const ok = await _epMutarTransf(d => { const r = ep_decidir(d, id, status, _epQuem(), motivo, status === 'devolvida' ? 'recusada' : 'pendente'); if (r.erro) return r; t = r.t; });
  if (!ok) { _epRender(); return; }
  if (!(await _epDecisaoFicou(t))) { alert('Outro computador decidiu essa transferência no mesmo instante. Atualize a tela e confira.'); _epRender(); return; }
  const lugar = lado === 'plantao' ? 'Plantão' : 'setor de Estoque';
  addLog('Estoque — transferência ' + (_EP_PALAVRA[status] || status).toUpperCase() + ' pelo ' + lugar + ': ' + _epDesc(t) + (motivo ? ' — ' + motivo : '') + ' (' + _epQuem() + ')');
  if (status === 'recusada') _mostrarToast('Recusado — quem enviou vai ver "Recusado — receber de volta".', 'ok');
  else if (await _epLancar(t)) _mostrarToast('\u{2705} Lançado no estoque do ' + lugar + '.', 'ok');
  else alert('A transferência foi marcada, mas não consegui lançar no estoque do ' + lugar + ' agora. Ela aparece como "pela metade" com o botão "Concluir".');
  _epRender();
}
function ep_receberTransf(id) { return ep_decidirTransf(id, 'recebida'); }
function ep_receberDeVolta(id) { return ep_decidirTransf(id, 'devolvida'); }
async function ep_concluirPendencia(id) {
  const t = ep_getTransf().transferencias.find(x => x.id === id); if (!t) return;
  if (!_epPodeLado(ep_ladoQueLanca(t))) return;
  if (await _epLancar(t)) { addLog('Estoque: transferência concluída — ' + _epDesc(t) + ' (' + _epQuem() + ')'); _mostrarToast('\u{2705} Lançado.', 'ok'); }
  _epRender();
}

/* ── criar a transferência (depois de tirar do próprio estoque) — idempotente pelo id da movimentação de origem ── */
async function _epCriarTransf(sentido, mov, unidades) {
  return _epMutarTransf(d => {
    if (d.transferencias.some(x => x.movOrigemId === mov.id)) return 'ja';
    ep_novaTransf(d, { sentido, categoria: mov.categoria, item: mov.item, tamanho: mov.tamanho || '', quantidade: mov.quantidade, estado: mov.estado || '',
      unidades: unidades || [], enviadoPor: mov.responsavel || _epQuem(), equipe: mov.plantao || mov.equipe || '', plantonista: mov.plantonista || '',
      motivo: sentido === EP_PLANTAO_PARA_SETOR ? (mov.motivo || '') : '', obs: mov.obs || '', movOrigemId: mov.id });
  });
}
// Setor → Plantão: chamada pelo salvarMovEstoque do index depois da Saída com destino "Estoque do Plantão"
async function ep_enviarDoSetor(mov, unidades) {
  if (await _epCriarTransf(EP_SETOR_PARA_PLANTAO, mov, unidades)) { _mostrarToast('\u{1F4E6} Enviado ao Plantão — fica "a receber" até o plantonista conferir.', 'ok'); addLog('Estoque → Plantão (a receber): ' + _epDesc(mov) + ' (' + _epQuem() + ')'); }
  else alert('ATENÇÃO: a Saída foi registrada no estoque do CME, mas não consegui avisar o Plantão agora.\n\n' + _epDesc(mov) + '\n\nEm 1 minuto ela aparece no painel do Estoque com o botão "Reenviar ao Plantão".');
  _epRender();
}
// reenvio de uma saída/envio que não virou transferência (rede caiu entre as duas gravações)
async function ep_reenviar(lado, movId) {
  if (!_epPodeLado(lado)) return;
  const lista = lado === 'setor' ? (getEstoque().movimentacoes || []) : ep_get().movimentacoes, m = lista.find(x => x.id === movId); if (!m) return;
  const un = m.unidades || (m.seriais || []).map(id => ({ id, estado: m.estado || '' }));
  if (await _epCriarTransf(lado === 'setor' ? EP_SETOR_PARA_PLANTAO : EP_PLANTAO_PARA_SETOR, m, un)) { addLog('Estoque: transferência reenviada — ' + _epDesc(m) + ' (' + _epQuem() + ')'); _mostrarToast('\u{2705} Reenviado.', 'ok'); }
  _epRender();
}

/* ── pendências de um lado: o que ele precisa fazer ── */
const _EP_JANELA_CONCILIA_MS = 7 * 864e5, _EP_ESPERA_CONCILIA_MS = 60000;
function ep_pendenciasDe(lado) {
  const tr = ep_getTransf().transferencias, agora = Date.now();
  const recente = iso => { const x = Date.parse(iso || ''); return x && agora - x < _EP_JANELA_CONCILIA_MS && agora - x > _EP_ESPERA_CONCILIA_MS; };
  const meuSentidoEntrada = lado === 'plantao' ? EP_SETOR_PARA_PLANTAO : EP_PLANTAO_PARA_SETOR, meuSentidoSaida = lado === 'plantao' ? EP_PLANTAO_PARA_SETOR : EP_SETOR_PARA_PLANTAO;
  const movs = lado === 'plantao' ? ep_get().movimentacoes : (getEstoque().movimentacoes || []);
  const lancadas = new Set(movs.map(m => m.transferenciaId).filter(Boolean)), viraram = new Set(tr.map(t => t.movOrigemId).filter(Boolean));
  return {
    aReceber: tr.filter(t => t.status === 'pendente' && t.sentido === meuSentidoEntrada),
    aguardando: tr.filter(t => t.status === 'pendente' && t.sentido === meuSentidoSaida),
    receberDeVolta: tr.filter(t => t.status === 'recusada' && t.sentido === meuSentidoSaida),
    recuseiAguardando: tr.filter(t => t.status === 'recusada' && t.sentido === meuSentidoEntrada),
    concluir: tr.filter(t => ep_ladoQueLanca(t) === lado && recente(t.devolvidaEm || t.decididoEm) && !lancadas.has(t.id)),
    reenviar: movs.filter(m => (lado === 'setor' ? m.tipo === 'Saída' && m.destino === 'Estoque do Plantão' : m.tipo === EP_TIPO.envio) && recente(m.ts) && !viraram.has(m.id)),
  };
}

/* ── Movimentação do plantão (Entrada, Saída, Devolução, Baixa, Envio ao setor) — só no estoque do Plantão ── */
async function ep_salvarMov(tipo, op, extra) {
  if (!ep_podeMover()) { alert('Sem permissão para mexer no estoque do Plantão.'); return false; }
  const soma = tipo === 'entrada' || tipo === 'devolucao';
  const opF = Object.assign({}, op, { soma });
  // inventário/entrada: uma unidade que está no CME (ou a caminho) não pode aparecer nos dois estoques
  if (tipo === 'entrada' && _epSerial(op.item)) {
    const noCme = new Set(ep_unidades(getEstoque(), op.item).map(u => u.id));
    ep_getTransf().transferencias.filter(t => t.status === 'pendente' || t.status === 'recusada').forEach(t => (t.unidades || []).forEach(u => noCme.add(u.id)));
    const dup = (op.unidades || []).find(u => noCme.has(String(u.id || '').trim()));
    if (dup) { alert('O ' + (op.item === 'Dispositivo DPP' ? 'nº de estoque' : 'nº de série') + ' "' + dup.id + '" está registrado no estoque do CME (ou a caminho). Peça ao Estoque a Saída para o Plantão e receba por "A receber".'); return false; }
  }
  let mov = null;
  const ok = await _epMutar(d => {
    // depois do inventário inicial, item novo só entra pelo que vem do Estoque do CME ("A receber")
    if (tipo === 'entrada' && d.inventarioEncerradoEm) return { erro: 'O inventário inicial do plantão já foi encerrado. Item novo chega pelo Estoque do CME, em "A receber".' };
    const ap = ep_aplicar(d, opF, _epSerial(op.item)); if (ap.erro) return ap;
    mov = ep_mov(EP_TIPO[tipo], opF, ap.unidades, Object.assign({ responsavel: _epQuem(), plantonista: _epQuem(), equipe: _epEquipeHoje() }, extra || {}));
    if (tipo === 'envio') mov.unidades = ap.unidades; // para o "Reenviar ao setor" se o aviso falhar
    ep_registrarMov(d, mov);
  });
  if (!ok) return false;
  addLog('Estoque do Plantão — ' + mov.tipo + ': ' + mov.item + (mov.tamanho ? ' ' + mov.tamanho : '') + ' ×' + mov.quantidade + (mov.monitorado ? ' — ' + mov.monitorado : '') + ' (' + _epQuem() + ', ' + (mov.equipe || '') + ')');
  if (tipo === 'envio' && !(await _epCriarTransf(EP_PLANTAO_PARA_SETOR, mov, mov.unidades)))
    alert('Saiu do estoque do Plantão, mas não consegui avisar o Estoque do CME agora. Em 1 minuto aparece o botão "Reenviar ao setor" no painel do Plantão.');
  return true;
}

/* ── Saída do kit de instalação: vários itens para o mesmo monitorado numa gravação só.
   Tudo ou nada: se faltar saldo de um item, nenhum sai. Uma movimentação por item, ligadas pelo kitId. ── */
async function ep_salvarKit(ops, extra) {
  if (!ep_podeMover()) { alert('Sem permissão para mexer no estoque do Plantão.'); return false; }
  const kitId = _epId('kit-'), movs = [];
  const ok = await _epMutar(d => {
    movs.length = 0;
    for (const op of ops) {
      const opF = Object.assign({}, op, { soma: false });
      const ap = ep_aplicar(d, opF, _epSerial(op.item)); if (ap.erro) return ap;
      movs.push(ep_mov(EP_TIPO.saida, opF, ap.unidades, Object.assign({ responsavel: _epQuem(), plantonista: _epQuem(), equipe: _epEquipeHoje(), kitId }, extra || {})));
    }
    movs.slice().reverse().forEach(m => ep_registrarMov(d, m)); // o 1º item (módulo) fica no topo do histórico
  });
  if (!ok) return false;
  addLog('Estoque do Plantão — Saída (kit): ' + movs.map(m => m.item + (m.tamanho ? ' ' + m.tamanho : '') + ' ×' + m.quantidade + (m.seriais.length ? ' (' + m.seriais.join(', ') + ')' : '')).join('; ')
    + ' — ' + ((extra || {}).monitorado || '') + ' (' + _epQuem() + ', ' + _epEquipeHoje() + ')');
  return true;
}

/* ── Cadastro manual de dispositivo (pedido de 26/10/2026): só gerência e admin. Módulo ou DPP entra direto no saldo
   do plantão, mesmo com o inventário encerrado. Cada nº de série/nº de estoque é conferido antes: não pode repetir na lista nem
   estar no plantão, no CME ou a caminho. A comparação ignora traço e espaço ("633164" = "63316-4"). ── */
function _epNormId(s) { return String(s || '').toLowerCase().replace(/[^0-9a-z]/g, ''); }
function ep_lerListaIds(texto) { return String(texto || '').split(/[\s,;]+/).map(s => s.trim()).filter(Boolean); }
function ep_formatoEstranho(id, item) {
  return item === 'Dispositivo DPP' ? false : !/^\d{5,6}-\d$/.test(id); // DPP é pelo nº de estoque (26/10/2026): sem formato fixo
}
// devolve [{ id, problema, aviso }]: problema impede o cadastro; aviso (formato diferente do usual) não impede
function ep_conferirCadastro(ids, item, plantao, setor, transf) {
  const onde = new Map();
  ep_unidades(plantao, item).forEach(u => onde.set(_epNormId(u.id), 'já está no estoque do Plantão (' + u.id + ')'));
  if (setor) ep_unidades(setor, item).forEach(u => onde.set(_epNormId(u.id), 'está no estoque do CME (' + u.id + ')'));
  ((transf && transf.transferencias) || []).filter(t => (t.status === 'pendente' || t.status === 'recusada') && t.item === item)
    .forEach(t => (t.unidades || []).forEach(u => onde.set(_epNormId(u.id), 'está a caminho entre o CME e o Plantão (' + u.id + ')')));
  const vistos = new Set();
  return ids.map(id => {
    const n = _epNormId(id);
    const problema = !n ? 'número inválido' : vistos.has(n) ? 'repetido na lista' : onde.get(n) || '';
    vistos.add(n);
    return { id, problema, aviso: !problema && ep_formatoEstranho(id, item) ? 'formato diferente do usual (ex.: 63316-4)' : '' };
  });
}
// op = { categoria, item, estado, unidades:[{ id, estado, temCarregador, temChip }] }
async function ep_cadastrarDispositivos(op, extra) {
  if (!ep_podeCadastrar()) { alert('Só a gerência e o administrador cadastram dispositivos.'); return false; }
  if (!_epSerial(op.item)) { alert('O cadastro manual é só para módulo e DPP (itens com nº de série ou nº de estoque).'); return false; }
  const ids = (op.unidades || []).map(u => u.id);
  if (!ids.length) { alert('Digite ao menos um nº de série ou nº de estoque.'); return false; }
  const ruim = ep_conferirCadastro(ids, op.item, ep_get(), getEstoque(), ep_getTransf()).find(r => r.problema);
  if (ruim) { alert('"' + ruim.id + '": ' + ruim.problema + '. Nada foi cadastrado.'); return false; }
  let mov = null;
  const ok = await _epMutar(d => {
    // relido do banco: confere de novo o que está no plantão (outro computador pode ter lançado no mesmo instante)
    const r = ep_conferirCadastro(ids, op.item, d, null, null).find(x => x.problema);
    if (r) return { erro: '"' + r.id + '": ' + r.problema + '. Nada foi cadastrado.' };
    const opF = Object.assign({}, op, { soma: true, qtd: ids.length });
    const ap = ep_aplicar(d, opF, true); if (ap.erro) return ap;
    mov = ep_mov(EP_TIPO.entrada, opF, ap.unidades, Object.assign({ responsavel: _epQuem(), cadastroManual: true }, extra || {}));
    ep_registrarMov(d, mov);
  }, ep_podeCadastrar());
  if (!ok) return false;
  addLog('Estoque do Plantão — ' + (mov.motivo || 'Cadastro manual') + ': ' + mov.item + ' ×' + mov.quantidade + ' (' + mov.seriais.join(', ') + ') (' + _epQuem() + ')');
  return true;
}

// resumo para o Dashboard (todos veem): módulos e DPP no CME e no plantão + o que está a caminho
function ep_resumo() {
  const p = ep_get(), s = getEstoque(), tr = ep_getTransf(), M = 'Módulo eletrônico de monitoração', D = 'Dispositivo DPP';
  return {
    setor: { mod: s.itens[M] || 0, dpp: s.itens[D] || 0 },
    plantao: { mod: p.itens[M] || 0, dpp: p.itens[D] || 0 },
    aReceberPlantao: ep_pendentes(tr, EP_SETOR_PARA_PLANTAO).length,
    aReceberSetor: ep_pendentes(tr, EP_PLANTAO_PARA_SETOR).length,
  };
}

/* ── Permissões: cada lado altera só o seu; admin e gerência veem os dois ── */
function ep_podeMover() { return !!usuarioAtual && ['plantao', 'admin'].includes(usuarioAtual.nivel); }
function ep_podeVer() { return !!usuarioAtual && ['plantao', 'admin', 'gerencia'].includes(usuarioAtual.nivel); }
function ep_podeVerCme() { return !!usuarioAtual && usuarioAtual.nivel !== 'plantao'; }
function ep_podeCadastrar() { return !!usuarioAtual && ['admin', 'gerencia'].includes(usuarioAtual.nivel); }
