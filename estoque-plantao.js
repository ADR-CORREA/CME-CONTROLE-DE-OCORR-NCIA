/* ═══════════════════════════ ESTOQUE DO PLANTÃO — regras e dados ═══════════════════════════
   Pedido de 20/10/2026: o plantão passa a ter um estoque PRÓPRIO, um só para as 5 equipes (ALFA a ECHO),
   com as mesmas funções do setor de Estoque. A obrigação do plantão é lançar, na hora, tudo que entra e sai.
   • Store "estoque_plantao" (chave cme_estoque_plantao). ⚠️ NÃO usar nome que comece com "plantao_":
     no banco, cme_plantao_* só abre para gerência/admin (seguranca-banco/6-plantoes-gerencia.sql).
   • Mesma estrutura do store "estoque" do setor: itens (saldo), registros/seriais (uma linha por nº de série
     ou IMEI), movimentacoes. A mais: transferencias entre setor e plantão.
   • Saída do setor para o plantão vira transferência "a receber": sai do saldo do setor na hora e só entra
     no saldo do plantão quando o plantonista confere e clica em Receber (ou volta ao setor, se recusar).
     O plantão devolve ao setor do mesmo jeito (Envio ao setor → o setor recebe ou recusa).
   • Toda gravação relê o banco antes (dois computadores ao mesmo tempo não se apagam).
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

// unidades (nº de série / IMEI) que estão neste estoque: registros (formato novo) + seriais (formato antigo)
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
    const lbl = op.item === 'Dispositivo DPP' ? 'IMEI' : 'nº de série';
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
function ep_decidir(d, id, status, por, motivo) {
  const t = d.transferencias.find(x => x.id === id);
  if (!t) return { erro: 'Essa transferência não existe mais. Atualize a tela.' };
  if (t.status !== 'pendente') return { erro: 'Essa transferência já foi ' + (t.status === 'recebida' ? 'recebida' : 'recusada') + (t.decididoPor ? ' por ' + t.decididoPor : '') + '.' };
  t.status = status; t.decididoPor = por || ''; t.decididoEm = new Date().toISOString(); t.motivoDecisao = motivo || '';
  return { t };
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

// onde está uma unidade (nº de série / IMEI): plantão, setor, a caminho, ou o último destino conhecido
function ep_onde(id, setor, plantao, comSerialLista) {
  id = String(id || '').trim(); if (!id) return null;
  const tem = (d, item) => ep_unidades(d, item).some(u => u.id === id);
  for (const item of comSerialLista) {
    if (tem(plantao, item)) return { onde: 'plantao', item, texto: 'No estoque do Plantão' };
    if (tem(setor, item)) return { onde: 'setor', item, texto: 'No setor de Estoque' };
  }
  const t = (plantao.transferencias || []).find(x => x.status === 'pendente' && (x.unidades || []).some(u => u.id === id));
  if (t) return { onde: 'caminho', item: t.item, texto: t.sentido === EP_SETOR_PARA_PLANTAO ? 'A caminho do Plantão (aguarda o plantonista receber)' : 'A caminho do setor de Estoque (aguarda o setor receber)' };
  const ult = [...(plantao.movimentacoes || []), ...(setor.movimentacoes || [])].filter(m => (m.seriais || []).includes(id)).sort((a, b) => (b.ts || '').localeCompare(a.ts || ''))[0];
  if (!ult) return null;
  const quando = new Date(ult.ts).toLocaleDateString('pt-BR');
  if (ult.tipo === 'Saída') return { onde: 'fora', item: ult.item, texto: 'Saiu em ' + quando + (ult.monitorado ? ' para ' + ult.monitorado : '') + (ult.motivo ? ' (' + ult.motivo + ')' : '') };
  if (ult.tipo === 'Baixa') return { onde: 'baixa', item: ult.item, texto: 'Baixa em ' + quando + (ult.motivo ? ' — ' + ult.motivo : '') };
  return { onde: 'fora', item: ult.item, texto: 'Última movimentação: ' + ult.tipo + ' em ' + quando };
}

if (typeof module !== 'undefined') module.exports = { ep_normalizar, ep_unidades, ep_aplicar, ep_mov, ep_registrarMov, ep_novaTransf, ep_decidir, ep_pendentes, ep_opDaTransf, ep_porEstado, ep_onde, ep_chave, EP_SETOR_PARA_PLANTAO, EP_PLANTAO_PARA_SETOR };

/* ───────────────────────── leitura e gravação no banco ───────────────────────── */
function ep_get() { return ep_normalizar(carregarStore(EP_STORE, null), EST_PADRAO.itens); }
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
  if (erro) { _cache[chave] = anterior; _mostrarToast('\u{26A0}\u{FE0F} Erro ao salvar no banco: ' + (erro.message || erro) + ' — nada foi salvo.', 'erro'); return false; }
  return true;
}
// fila: duas gravações do mesmo computador nunca leem a mesma base (a 2ª apagaria a 1ª)
let _epFila = Promise.resolve();
function _epNaFila(fn) { const p = _epFila.then(fn, fn); _epFila = p.catch(() => {}); return p; }
// lê o estoque do plantão direto do banco, aplica fn (false = desiste, 'ja' = nada a fazer, { erro } = avisa) e grava
function _epMutar(fn) {
  return _epNaFila(async () => {
    let base;
    try { base = await _epLerFresco(EP_STORE); } catch (e) { _mostrarToast('Sem conexão com o banco — nada foi salvo. Tente de novo.', 'erro'); return false; }
    const d = ep_normalizar(base, EST_PADRAO.itens), r = fn(d);
    if (r === false) return false;
    if (r === 'ja') return true;
    if (r && r.erro) { alert(r.erro); return false; }
    return _epGravar(EP_STORE, d);
  });
}
// o mesmo para o estoque do SETOR (store "estoque"): só ACRESCENTA movimentação, então a proteção anti-perda não se aplica
function _epMutarSetor(fn) {
  return _epNaFila(async () => {
    let base;
    try { base = await _epLerFresco('estoque'); } catch (e) { _mostrarToast('Sem conexão com o banco — nada foi salvo. Tente de novo.', 'erro'); return false; }
    if (!base) { alert('Os dados do estoque do setor ainda não carregaram. Recarregue a página (F5) e tente de novo.'); return false; }
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
    const d = ep_normalizar(await _epLerFresco(EP_STORE), EST_PADRAO.itens), x = d.transferencias.find(y => y.id === t.id);
    return !!x && x.status === t.status && x.decididoEm === t.decididoEm;
  } catch (e) { return false; }
}
// lança no SETOR a parte de uma transferência (plantão recusou o envio / setor recebeu a devolução). Idempotente:
// se o setor já tem a movimentação dessa transferência, não lança de novo.
function _epConcluirNoSetor(t, motivo) {
  return _epMutarSetor(est => {
    if ((est.movimentacoes || []).some(m => m.transferenciaId === t.id)) return 'ja';
    const ap = ep_aplicar(est, ep_opDaTransf(t), _epSerial(t.item)); if (ap.erro) return ap;
    est.movimentacoes.unshift(ep_mov('Devolução', ep_opDaTransf(t), ap.unidades, { responsavel: _epQuem(), motivo, obs: t.obs || '', transferenciaId: t.id }));
    if (est.movimentacoes.length > 500) est.movimentacoes = est.movimentacoes.slice(0, 500);
  });
}
function _epMotivoSetor(t) {
  return t.sentido === EP_SETOR_PARA_PLANTAO ? 'Recusado pelo plantão: ' + (t.motivoDecisao || '')
    : 'Devolvido pelo plantão' + (t.motivo ? ': ' + t.motivo : '') + ' (enviado por ' + (t.enviadoPor || '?') + ')';
}
// transferências decididas cuja parte do setor não foi lançada (rede caiu no meio) e Saídas do setor que não chegaram ao plantão
const _EP_JANELA_CONCILIA_MS = 7 * 864e5, _EP_ESPERA_CONCILIA_MS = 60000;
function ep_pendenciasSetor() {
  const p = ep_get(), s = getEstoque(), agora = Date.now();
  const recente = iso => { const t = Date.parse(iso || ''); return t && agora - t < _EP_JANELA_CONCILIA_MS && agora - t > _EP_ESPERA_CONCILIA_MS; };
  const noSetor = new Set((s.movimentacoes || []).map(m => m.transferenciaId).filter(Boolean));
  const transf = p.transferencias.filter(t => ((t.sentido === EP_SETOR_PARA_PLANTAO && t.status === 'recusada') || (t.sentido === EP_PLANTAO_PARA_SETOR && t.status === 'recebida'))
    && recente(t.decididoEm) && !noSetor.has(t.id));
  const avisadas = new Set(p.transferencias.map(t => t.movSetorId).filter(Boolean));
  const saidas = (s.movimentacoes || []).filter(m => m.tipo === 'Saída' && m.destino === 'Estoque do Plantão' && recente(m.ts) && !avisadas.has(m.id));
  return { transf, saidas };
}
async function ep_concluirPendencia(id) {
  if (!podeAlterarEstoque() && !ep_podeMover()) return;
  const t = ep_get().transferencias.find(x => x.id === id); if (!t) return;
  if (await _epConcluirNoSetor(t, _epMotivoSetor(t))) { addLog('Estoque: transferência concluída no setor — ' + _epDesc(t) + ' (' + _epQuem() + ')'); _mostrarToast('\u{2705} Lançado no setor de Estoque.', 'ok'); }
  try { renderizarEstoque(); } catch (e) {}
}
async function ep_reenviarSaida(movId) {
  if (!podeAlterarEstoque()) return;
  const m = (getEstoque().movimentacoes || []).find(x => x.id === movId); if (!m) return;
  await ep_enviarDoSetor(m, m.unidades || (m.seriais || []).map(id => ({ id, estado: m.estado || '' })));
}
function _epQuem() { return (usuarioAtual && usuarioAtual.nome) || ''; }
function _epEquipeHoje() { try { return getPlantaoParaData(_diaPlantao()); } catch (e) { return ''; } }
function _epDesc(t) { return t.item + (t.tamanho ? ' ' + t.tamanho : '') + ' ×' + t.quantidade + ((t.unidades || []).length ? ' (' + t.unidades.map(u => u.id).join(', ') + ')' : ''); }

/* ── Setor → Plantão: chamada pelo salvarMovEstoque do index depois da Saída com destino "Estoque do Plantão" ── */
async function ep_enviarDoSetor(mov, unidades) {
  const ok = await _epMutar(d => {
    if (d.transferencias.some(x => x.movSetorId === mov.id)) return 'ja'; // já avisado (reenvio)
    ep_novaTransf(d, { sentido: EP_SETOR_PARA_PLANTAO, categoria: mov.categoria, item: mov.item, tamanho: mov.tamanho || '', quantidade: mov.quantidade,
      estado: mov.estado || '', unidades: unidades || [], enviadoPor: mov.responsavel || _epQuem(), equipe: mov.plantao || '', plantonista: mov.plantonista || '',
      obs: mov.obs || '', movSetorId: mov.id });
  });
  if (ok) { _mostrarToast('\u{1F4E6} Enviado ao Plantão — fica "a receber" até o plantonista conferir.', 'ok'); addLog('Estoque → Plantão (a receber): ' + _epDesc(mov) + ' (' + _epQuem() + ')'); }
  else alert('ATENÇÃO: a Saída foi registrada no setor, mas não consegui avisar o estoque do Plantão agora.\n\n' + _epDesc(mov) + '\n\nEm 1 minuto ela aparece no painel do setor com o botão "Reenviar ao Plantão".');
  ep_renderizar();
}

/* ── Plantão recebe / recusa o que veio do setor ── */
async function ep_receberDoSetor(id) {
  if (!ep_podeMover()) return;
  let t = null;
  const ok = await _epMutar(d => {
    const r = ep_decidir(d, id, 'recebida', _epQuem()); if (r.erro) return r;
    t = r.t;
    const ap = ep_aplicar(d, ep_opDaTransf(t), _epSerial(t.item)); if (ap.erro) return ap;
    ep_registrarMov(d, ep_mov(EP_TIPO.recebimento, ep_opDaTransf(t), ap.unidades, { responsavel: _epQuem(), plantonista: _epQuem(), equipe: _epEquipeHoje(),
      motivo: 'Recebido do setor de Estoque (enviado por ' + (t.enviadoPor || '?') + ')', obs: t.obs || '', transferenciaId: t.id }));
  });
  if (!ok) return;
  if (!(await _epDecisaoFicou(t))) { alert('Outro computador decidiu essa transferência no mesmo instante. Atualize a tela e confira.'); ep_renderizar(); return; }
  addLog('Plantão RECEBEU do setor: ' + _epDesc(t) + ' (' + _epQuem() + ')');
  _mostrarToast('\u{2705} Recebido no estoque do Plantão.', 'ok');
  ep_renderizar(); try { _dashEstoqueDisp(); } catch (e) {}
}
async function ep_recusarDoSetor(id, motivo) {
  if (!ep_podeMover()) return;
  let t = null;
  const ok = await _epMutar(d => { const r = ep_decidir(d, id, 'recusada', _epQuem(), motivo); if (r.erro) return r; t = r.t; });
  if (!ok) return;
  if (!(await _epDecisaoFicou(t))) { alert('Outro computador decidiu essa transferência no mesmo instante. Atualize a tela e confira.'); ep_renderizar(); return; }
  addLog('Plantão RECUSOU o que veio do setor: ' + _epDesc(t) + ' — ' + motivo + ' (' + _epQuem() + ')');
  // a mercadoria volta para o setor
  if (!(await _epConcluirNoSetor(t, _epMotivoSetor(t)))) alert('A recusa foi registrada, mas não consegui devolver ao saldo do setor agora. Ela aparece no painel do setor com o botão "Concluir".');
  else _mostrarToast('Recusado — o item voltou para o setor de Estoque.', 'ok');
  ep_renderizar(); try { renderizarEstoque(); } catch (e) {}
}

/* ── Setor recebe / recusa o que o plantão devolveu ── */
async function ep_setorReceber(id) {
  if (!podeAlterarEstoque()) return;
  let t = null;
  const ok = await _epMutar(d => { const r = ep_decidir(d, id, 'recebida', _epQuem()); if (r.erro) return r; t = r.t; });
  if (!ok) return;
  if (!(await _epDecisaoFicou(t))) { alert('Outro computador decidiu essa transferência no mesmo instante. Atualize a tela e confira.'); try { renderizarEstoque(); } catch (e) {} return; }
  addLog('Setor de Estoque RECEBEU do plantão: ' + _epDesc(t) + ' (' + _epQuem() + ')');
  if (!(await _epConcluirNoSetor(t, _epMotivoSetor(t)))) alert('O recebimento foi registrado, mas não consegui somar no saldo do setor agora. Ele aparece no painel do setor com o botão "Concluir".');
  else _mostrarToast('\u{2705} Recebido no setor de Estoque.', 'ok');
  try { renderizarEstoque(); } catch (e) {}
}
async function ep_setorRecusar(id, motivo) {
  if (!podeAlterarEstoque()) return;
  let t = null;
  const ok = await _epMutar(d => {
    const r = ep_decidir(d, id, 'recusada', _epQuem(), motivo); if (r.erro) return r;
    t = r.t;
    const ap = ep_aplicar(d, ep_opDaTransf(t), _epSerial(t.item)); if (ap.erro) return ap;
    ep_registrarMov(d, ep_mov(EP_TIPO.devolucao, ep_opDaTransf(t), ap.unidades, { responsavel: _epQuem(), motivo: 'Recusado pelo setor de Estoque: ' + motivo, transferenciaId: t.id }));
  });
  if (!ok) return;
  if (!(await _epDecisaoFicou(t))) { alert('Outro computador decidiu essa transferência no mesmo instante. Atualize a tela e confira.'); try { renderizarEstoque(); } catch (e) {} return; }
  addLog('Setor de Estoque RECUSOU o que veio do plantão: ' + _epDesc(t) + ' — ' + motivo + ' (' + _epQuem() + ')');
  _mostrarToast('Recusado — o item voltou para o estoque do Plantão.', 'ok');
  try { renderizarEstoque(); } catch (e) {}
}

/* ── Movimentação do plantão (Entrada, Saída, Devolução, Baixa, Envio ao setor) ── */
async function ep_salvarMov(tipo, op, extra) {
  if (!ep_podeMover()) { alert('Sem permissão para mexer no estoque do Plantão.'); return false; }
  const soma = tipo === 'entrada' || tipo === 'devolucao';
  const opF = Object.assign({}, op, { soma });
  // inventário/entrada: uma unidade que ainda está no setor não pode aparecer nos dois estoques
  if (tipo === 'entrada' && _epSerial(op.item)) {
    const doSetor = new Set(ep_unidades(getEstoque(), op.item).map(u => u.id)), dup = (op.unidades || []).find(u => doSetor.has(String(u.id || '').trim()));
    if (dup) { alert('O ' + (op.item === 'Dispositivo DPP' ? 'IMEI' : 'nº de série') + ' "' + dup.id + '" ainda está no estoque do SETOR. Peça ao setor a Saída para o Plantão e receba por "A receber".'); return false; }
  }
  let mov = null;
  const ok = await _epMutar(d => {
    const ap = ep_aplicar(d, opF, _epSerial(op.item)); if (ap.erro) return ap;
    mov = ep_mov(EP_TIPO[tipo], opF, ap.unidades, Object.assign({ responsavel: _epQuem(), plantonista: _epQuem(), equipe: _epEquipeHoje() }, extra || {}));
    if (tipo === 'envio') {
      const t = ep_novaTransf(d, { sentido: EP_PLANTAO_PARA_SETOR, categoria: op.categoria, item: op.item, tamanho: op.tamanho || '', quantidade: mov.quantidade, estado: op.estado || '',
        unidades: ap.unidades, enviadoPor: _epQuem(), equipe: mov.equipe, motivo: (extra && extra.motivo) || '', obs: (extra && extra.obs) || '' });
      mov.transferenciaId = t.id;
    }
    ep_registrarMov(d, mov);
  });
  if (!ok) return false;
  addLog('Estoque do Plantão — ' + mov.tipo + ': ' + mov.item + (mov.tamanho ? ' ' + mov.tamanho : '') + ' ×' + mov.quantidade + (mov.monitorado ? ' — ' + mov.monitorado : '') + ' (' + _epQuem() + ', ' + (mov.equipe || '') + ')');
  return true;
}

// resumo para o Dashboard: módulos e DPP no setor, no plantão e a caminho
function ep_resumo() {
  const p = ep_get(), s = getEstoque(), M = 'Módulo eletrônico de monitoração', D = 'Dispositivo DPP';
  const caminho = (sentido, item) => ep_pendentes(p, sentido).filter(t => t.item === item).reduce((n, t) => n + (parseInt(t.quantidade, 10) || 0), 0);
  return {
    setor: { mod: s.itens[M] || 0, dpp: s.itens[D] || 0 },
    plantao: { mod: p.itens[M] || 0, dpp: p.itens[D] || 0 },
    aReceberPlantao: ep_pendentes(p, EP_SETOR_PARA_PLANTAO).length,
    aReceberSetor: ep_pendentes(p, EP_PLANTAO_PARA_SETOR).length,
    caminhoPlantao: { mod: caminho(EP_SETOR_PARA_PLANTAO, M), dpp: caminho(EP_SETOR_PARA_PLANTAO, D) },
  };
}

/* ── Permissões ── */
function ep_podeMover() { return !!usuarioAtual && ['plantao', 'admin', 'gerencia'].includes(usuarioAtual.nivel); }
function ep_podeVer() { return !!usuarioAtual && ['plantao', 'estoque', 'admin', 'gerencia'].includes(usuarioAtual.nivel); }
