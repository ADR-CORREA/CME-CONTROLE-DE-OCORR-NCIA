/* ══ CRIAR USUÁRIOS EM LOTE (admin) — 12/11/2026 ═══════════════════════════════
   Caixa de texto com um nome completo por linha → PRÉVIA (nome → login) → cria todos numa
   única gravação (salvarUsuarios). Cada um entra com primeiroLogin:true e define a própria
   senha no 1º acesso. A senha provisória é digitada pelo admin; nada fixo no código.
   Login = primeiro + último nome, minúsculo e sem acento ("Lana Vanessa Magalhães de Souza" → lanasouza).
   Não cria login que já existe nem login que se repete no lote (o admin cria esses à mão).
   Prefixo ul_ ; usa do index.html: getUsuarios, salvarUsuarios, hashSenhaPBKDF2, validarForcaSenha,
   _usuariosProntos, _recarregarUsuariosAdmin, _mostrarToast, addLog, esc, renderizarUsers. */

const UL_LIMITE = 60;           // pedido: ~15 por vez; teto para não travar a tela com PBKDF2
const UL_SITUACAO = {
  novo:     { rotulo: 'Será criado',                     cls: 'ok', linha: 'row-ok' },
  criado:   { rotulo: 'Criado',                          cls: 'ok', linha: 'row-ok' },
  existe:   { rotulo: 'Login já existe',                 cls: 'cr', linha: 'row-vencido' },
  repetido: { rotulo: 'Login repetido no lote',          cls: 'at', linha: 'row-atencao' },
  invalido: { rotulo: 'Nome sem letras',                 cls: 'cr', linha: 'row-vencido' },
};

function ul_semAcento(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function ul_limparNome(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
// primeiro + último nome (nome de uma palavra só vale ele mesmo)
function ul_loginDe(nome) {
  const p = ul_limparNome(nome).split(' ').filter(Boolean);
  if (!p.length) return '';
  return ul_semAcento(p[0]) + (p.length > 1 ? ul_semAcento(p[p.length - 1]) : '');
}

// texto → [{ nome, login, situacao }]. Login repetido no lote: TODAS as linhas ficam "repetido" e nenhuma é criada
// (não há como saber qual das pessoas fica com o login). Não altera os argumentos.
function ul_planejar(texto, existentes) {
  const jaTem = new Set((existentes || []).map(u => String((u && u.usuario) || '').toLowerCase()));
  const itens = String(texto == null ? '' : texto).split(/\r?\n/).map(ul_limparNome).filter(Boolean)
    .map(nome => ({ nome, login: ul_loginDe(nome) }));
  const vezes = new Map();
  itens.forEach(i => { if (i.login) vezes.set(i.login, (vezes.get(i.login) || 0) + 1); });
  return itens.map(i => Object.assign({}, i, {
    situacao: !i.login ? 'invalido' : jaTem.has(i.login) ? 'existe' : vezes.get(i.login) > 1 ? 'repetido' : 'novo',
  }));
}

// monta os registros novos (hash PBKDF2 próprio, com salt próprio, para cada um). Não toca em nada existente.
async function ul_montarUsuarios(itens, cfg) {
  const out = [];
  for (const i of itens) {
    const { hash, salt } = await hashSenhaPBKDF2(cfg.senha);
    const u = { usuario: i.login, senha: hash, senhaSalt: salt, senhaVersao: 3, nome: i.nome, cargo: cfg.cargo || '', nivel: cfg.nivel, primeiroLogin: true };
    if (cfg.lotacao) u.lotacao = cfg.lotacao;
    out.push(u);
  }
  return out;
}

/* ── banco: lista fresca de usuários (a trava _usuariosProntos já garante a carga; aqui relê antes de decidir) ── */
async function ul_listaFresca() {
  if (!window._db) return getUsuarios();
  if (!_sessionUser || !_sessionHash) return null;
  try {
    const r = await window._db.rpc('cme_get_usuarios', { p_username: _sessionUser, p_hash: _sessionHash });
    return !r.error && Array.isArray(r.data) ? r.data : null;
  } catch (e) { return null; }
}

/* ── tela ── */
let _ulOcupado = false;
let _ulCfg = null; // { texto, nivel, lotacao, cargo } — a senha NÃO fica guardada: é lida do campo na hora de criar

function ul_iniciar() {
  const sel = document.getElementById('ul-nivel'), base = document.getElementById('new-role');
  if (sel && base) { sel.innerHTML = base.innerHTML; sel.value = 'plantao'; }
}
function ul_msg(texto, tipo) {
  const el = document.getElementById('ul-msg'); if (!el) return;
  el.className = tipo ? 'sys-alert ' + tipo : ''; el.textContent = texto || '';
}
function ul_lerForm() {
  const v = id => (document.getElementById(id) || {}).value || '';
  return { texto: v('ul-nomes'), nivel: v('ul-nivel'), lotacao: v('ul-lotacao').trim().slice(0, 40), cargo: v('ul-cargo').trim(), senha: v('ul-senha') };
}
function ul_fechar() { if (!_ulOcupado) fecharModal('modal-usuarios-lote'); }

function _ulTabela(plano) {
  const linhas = plano.map(i => {
    const s = UL_SITUACAO[i.situacao];
    return '<tr class="' + s.linha + '"><td>' + esc(i.nome) + '</td><td class="idv-mono">' + esc(i.login || '—') + '</td>' +
      '<td><span class="idv-etq ' + s.cls + '">' + s.rotulo + '</span></td></tr>';
  }).join('');
  return '<div class="table-scroll"><table class="data-table idv-tabela"><thead><tr><th>Nome</th><th>Login</th><th>Situação</th></tr></thead><tbody>' + linhas + '</tbody></table></div>';
}
function _ulResumo(plano, cfg) {
  const n = k => plano.filter(i => i.situacao === k).length, novos = n('novo'), pulados = plano.length - novos;
  const lot = cfg.lotacao ? ' · lotação <b>' + esc(cfg.lotacao) + '</b>' : '';
  return '<div class="idv-faixa ' + (novos ? 'ok' : 'cr') + '" style="margin-bottom:10px"><span><b>' + novos + '</b> para criar' +
    (pulados ? ' · <b>' + pulados + '</b> não será(ão) criado(s)' : '') + ' · nível <b>' + esc((typeof _NIVEL_NOME !== 'undefined' && _NIVEL_NOME[cfg.nivel]) || cfg.nivel) + '</b>' + lot +
    '. Todos entram pedindo a troca da senha no 1º acesso.</span></div>';
}

async function ul_previa() {
  if (_ulOcupado) return;
  const f = ul_lerForm();
  if (!_usuariosProntos()) { ul_msg('\u{23F3} A lista de usuários ainda está carregando do servidor. Aguarde alguns segundos e tente de novo.', 'error'); _recarregarUsuariosAdmin(); return; }
  const linhas = f.texto.split(/\r?\n/).map(ul_limparNome).filter(Boolean);
  if (!linhas.length) { ul_msg('Digite os nomes, um por linha.', 'error'); return; }
  if (linhas.length > UL_LIMITE) { ul_msg('Máximo de ' + UL_LIMITE + ' nomes por vez.', 'error'); return; }
  if (!f.nivel) { ul_msg('Escolha o nível de acesso.', 'error'); return; }
  const erroSenha = validarForcaSenha(f.senha);
  if (erroSenha) { ul_msg('Senha provisória: ' + erroSenha, 'error'); return; }
  ul_msg('Conferindo a lista no servidor…', '');
  const lista = await ul_listaFresca();
  if (!lista) { ul_msg('Não consegui ler a lista de usuários do servidor. Nada foi feito — tente de novo.', 'error'); return; }
  ul_msg('', '');
  _ulCfg = { texto: f.texto, nivel: f.nivel, lotacao: f.lotacao, cargo: f.cargo };
  const plano = ul_planejar(f.texto, lista), novos = plano.filter(i => i.situacao === 'novo').length;
  document.getElementById('ul-previa').innerHTML = _ulResumo(plano, _ulCfg) + _ulTabela(plano);
  const bt = document.getElementById('ul-criar');
  bt.style.display = ''; document.getElementById('ul-cancelar').textContent = 'Cancelar';
  bt.disabled = !novos; bt.textContent = novos ? 'Criar ' + novos + (novos === 1 ? ' usuário' : ' usuários') : 'Nada a criar';
  abrirModal('modal-usuarios-lote');
}

async function ul_criar() {
  if (_ulOcupado || !_ulCfg) return;
  const senha = (document.getElementById('ul-senha') || {}).value || '';
  const erroSenha = validarForcaSenha(senha);
  if (erroSenha) { _mostrarToast('Senha provisória: ' + erroSenha, 'erro'); return; }
  if (!_usuariosProntos()) { _mostrarToast('\u{23F3} A lista de usuários ainda está carregando do servidor. Tente de novo em instantes.', 'erro'); return; }
  _ulOcupado = true;
  const bt = document.getElementById('ul-criar'), cancelar = document.getElementById('ul-cancelar'), corpo = document.getElementById('ul-previa');
  bt.disabled = true; cancelar.disabled = true;
  const cfg = Object.assign({}, _ulCfg, { senha });
  let antes = null;
  try {
    // relê a lista agora (outro admin pode ter criado alguém desde a prévia) e refaz o plano: nunca sobrescreve nem duplica
    bt.textContent = 'Conferindo…';
    const fresca = await ul_listaFresca();
    if (!fresca) { corpo.insertAdjacentHTML('afterbegin', '<div class="sys-alert error">Não consegui ler a lista do servidor. Nada foi criado — tente de novo.</div>'); return; }
    antes = getUsuarios();
    const plano = ul_planejar(cfg.texto, fresca), novos = plano.filter(i => i.situacao === 'novo');
    if (!novos.length) { corpo.innerHTML = _ulResumo(plano, cfg) + _ulTabela(plano); bt.textContent = 'Nada a criar'; return; }
    const criados = [];
    for (let k = 0; k < novos.length; k++) {
      bt.textContent = 'Preparando ' + (k + 1) + ' de ' + novos.length + '…';
      criados.push(...await ul_montarUsuarios([novos[k]], cfg));
    }
    bt.textContent = 'Gravando…';
    const todos = fresca.concat(criados);            // UMA gravação com a lista inteira (nunca uma por usuário)
    const ok = await salvarUsuarios(todos);
    let confirmados = [];
    if (ok) {
      const depois = await ul_listaFresca();
      const porLogin = new Map((depois || []).map(u => [String(u.usuario || '').toLowerCase(), u]));
      confirmados = criados.filter(u => { const x = porLogin.get(u.usuario); return x && x.primeiroLogin === true; });
    }
    if (!ok || confirmados.length !== criados.length) {
      _cache['usuarios'] = antes;
      _recarregarUsuariosAdmin();
      corpo.insertAdjacentHTML('afterbegin', '<div class="sys-alert error">' + (ok ? 'O servidor não confirmou todos os usuários. Confira a lista antes de repetir.' : 'Não foi possível gravar. Nada foi criado.') + '</div>');
      return;
    }
    addLog('Criou ' + criados.length + ' usuário(s) em lote (' + (usuarioAtual && usuarioAtual.nome || '?') + '): ' + criados.map(u => u.usuario).join(', ') + (cfg.lotacao ? ' — lotação ' + cfg.lotacao : ''));
    _ulCfg = null;
    ['ul-nomes', 'ul-senha', 'ul-lotacao', 'ul-cargo'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    ul_msg('', '');
    renderizarUsers();
    const pulados = plano.length - criados.length;
    corpo.innerHTML = '<div class="idv-faixa ok" style="margin-bottom:10px"><span><b>' + criados.length + '</b> usuário(s) criado(s) e conferido(s) no servidor' +
      (pulados ? ' · <b>' + pulados + '</b> não criado(s)' : '') + '. Passe a senha provisória a cada um; no 1º acesso o sistema pede a troca.</span></div>' + _ulTabela(plano.map(i => i.situacao === 'novo' ? Object.assign({}, i, { situacao: 'criado' }) : i));
    bt.style.display = 'none'; cancelar.textContent = 'Fechar';
    _mostrarToast('\u{2705} ' + criados.length + ' usuário(s) criado(s).', 'sucesso');
  } catch (e) {
    console.error('[CME] criar em lote:', e);
    if (antes) _cache['usuarios'] = antes;
    corpo.insertAdjacentHTML('afterbegin', '<div class="sys-alert error">Erro: ' + esc(e && e.message || String(e)) + '. Confira a lista de usuários antes de repetir.</div>');
  } finally {
    _ulOcupado = false; cancelar.disabled = false;
    if (bt.style.display !== 'none' && bt.textContent !== 'Nada a criar') { bt.disabled = false; bt.textContent = 'Tentar de novo'; }
  }
}

ul_iniciar();
