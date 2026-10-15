/* ═══════════════════════════ SECRETARIA (apoio direto à Gerência) ═══════════════════════════
   Servidores (qualificação + anexos), Ficha de Apoio e Dispensas (igual à ficha de papel),
   Folgas combinadas com a chefia e Auditoria.
   • Dados: chave cme_secretaria — o banco só entrega a administrador, gerência e secretaria.
   • Arquivos: Worker /sec/* (área _secretaria/, auditada; apagar move para a lixeira).
   • Cada gravação relê a versão do banco antes (não sobrescreve o que outra pessoa salvou).
   Emojis só por \u{...} (emoji cru some no parse deste projeto). */

const _SEC_NIVEIS = ['admin', 'gerencia', 'secretaria'];
const _SEC_EQUIPES = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'EXPEDIENTE'];
const _SEC_DIREITOS = [6, 12, 24];
// Escala geral: posto do plantonista e turno do expediente
const _SEC_POSTOS = { '1': 'Posto 1 — instalação, inspeção e zona', '2': 'Posto 2 — ocorrências, endereço, drive e livro' };
const _SEC_TURNOS = { M: 'Manhã', T: 'Tarde' };
// Apoio do administrativo aos sábados (1 por mês): uns fazem só na CME, outros alternam o mês entre PEF e CME
const _SEC_APOIO_REGIME = { CME: 'Só na CME (1 sábado no mês)', ROD: 'Rodízio: 1 sábado por mês, alternando PEF e CME a cada mês', NAO: 'Não tira apoio de sábado' };
// Rodízio mensal dos postos (pedido de 14/10/2026): o posto gravado no cadastro é o do MÊS-BASE (config.postoBase,
// padrão outubro/2026 — a escala geral importada); a cada mês seguinte troca sozinho 1 ↔ 2.
const _SEC_POSTO_BASE = '2026-10';
function _secMesesEntre(a, b) { return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)); }
// posto no mês pedido a partir do posto do mês-base (e vice-versa: a troca é o próprio inverso)
function _secPostoNoMes(posto, mes, d) {
  if (posto !== '1' && posto !== '2') return posto || '';
  const base = (((d || _secDados()).config) || {}).postoBase || _SEC_POSTO_BASE;
  return Math.abs(_secMesesEntre(base, mes || _secHoje().slice(0, 7))) % 2 ? (posto === '1' ? '2' : '1') : posto;
}
function _secRotuloEscala(s) { const p = s && _secPostoNoMes(s.posto); return p && _SEC_POSTOS[p] ? 'Posto ' + p : s && s.turno && _SEC_TURNOS[s.turno] ? _SEC_TURNOS[s.turno] : ''; }
let _secAba = 'hoje', _secPerfilId = null, _secPerfilAba = 'ficha', _secModeloId = null;

_STORES_PROTEGIDAS.secretaria = v => (v && Array.isArray(v.servidores))
  ? v.servidores.length + (v.apoios || []).length + (v.folgas || []).length + (v.afastamentos || []).length + (v.compromissos || []).length + (v.documentos || []).length + (v.escalaSabado || []).length + Object.keys(v.escalaServico || {}).length + (v.faltas || []).length + Object.keys(v.escalaServApoio || {}).length : -1;

function _secPode() { return !!(usuarioAtual && _SEC_NIVEIS.includes(usuarioAtual.nivel)); }
function _secNormal(d) {
  d = (d && typeof d === 'object') ? d : {};
  const arr = k => Array.isArray(d[k]) ? d[k] : [];
  return { servidores: arr('servidores'), apoios: arr('apoios'), folgas: arr('folgas'), lixeira: arr('lixeira'),
    afastamentos: arr('afastamentos'), compromissos: arr('compromissos'), documentos: arr('documentos'), escalaSabado: arr('escalaSabado'),
    escalaServico: (d.escalaServico && typeof d.escalaServico === 'object' && !Array.isArray(d.escalaServico)) ? d.escalaServico : {}, // { 'AAAA-MM': { linhas, guardadoEm } }
    escalaServApoio: (d.escalaServApoio && typeof d.escalaServApoio === 'object' && !Array.isArray(d.escalaServApoio)) ? d.escalaServApoio : {}, // { 'AAAA-MM': { 'AAAA-MM-DD': 'texto' } } quadro fixo da escala de serviço
    faltas: arr('faltas'),
    modelos: Array.isArray(d.modelos) ? d.modelos : null,                       // null = ainda usa os modelos padrão
    config: (d.config && typeof d.config === 'object') ? d.config : {} };
}
function _secDados() { return _secNormal(carregarStore('secretaria', null)); }
function _secId(p) { return p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function _secBR(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
function _secHoje() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function _secServ(id, dados) { return (dados || _secDados()).servidores.find(s => s.id === id) || null; }
function _secNomeServ(id, dados) { const s = _secServ(id, dados); return s ? s.nome : '(servidor removido)'; }
function _secVal(id) { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; }
function _secCpfValido(c) {
  c = String(c || '').replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  const dv = n => { let s = 0; for (let i = 0; i < n; i++) s += +c[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +c[9] && dv(10) === +c[10];
}
function _secCpfFmt(c) { c = String(c || '').replace(/\D/g, ''); return c.length === 11 ? c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : c; }

// Lê a versão atual do banco, aplica a mudança e grava (evita perder o que outro computador salvou).
// FILA (achado no teste com os dados reais em 14/10/2026): o salvarStore não espera a gravação terminar, então duas
// gravações seguidas (as automáticas ao abrir a Secretaria, ou dois cliques rápidos) liam o banco ANTES da anterior
// terminar e a última apagava a outra. Agora cada gravação espera a anterior terminar de gravar.
let _secFilaGravacao = Promise.resolve();
function _secMutar(fn, audit) {
  const p = _secFilaGravacao.then(() => _secMutarAgora(fn, audit));
  _secFilaGravacao = p.catch(() => false);
  return p;
}
async function _secMutarAgora(fn, audit) {
  let base = _secDados(), lidoDoBanco = false;
  try {
    const r = await _dbLerChave('cme_secretaria');
    if (r.error) throw r.error;
    if (r.data && r.data.value) { base = _secNormal(r.data.value); lidoDoBanco = true; }
  } catch (e) { _mostrarToast('Sem conexão com o banco — nada foi salvo. Tente de novo.', 'erro'); return false; }
  const novo = JSON.parse(JSON.stringify(base));
  if (fn(novo) === false) return false;
  if (!(await _secGravarBanco(novo, lidoDoBanco ? base : null))) return false;
  if (audit) auditar(Object.assign({ modulo: 'Secretaria' }, audit));
  return true;
}
// grava e ESPERA terminar; mesma proteção anti-perda do salvarStore (bloqueia gravação que apagaria muitos registros)
async function _secGravarBanco(novo, base) {
  if (!window._db) { salvarStore('secretaria', novo); return true; } // sem banco (ambiente de teste)
  const contar = _STORES_PROTEGIDAS.secretaria, nNovo = contar(novo), nBase = base ? contar(base) : -1;
  if (nBase >= 3 && nNovo >= 0) {
    const perda = nBase - nNovo;
    if (nNovo <= 1 || (perda > 3 && perda / nBase > 0.4)) {
      _mostrarToast('\u{1F6E1}\u{FE0F} Proteção anti-perda: bloqueei uma gravação que apagaria ' + perda + ' de ' + nBase + ' registros da Secretaria. Recarregue a página (F5) e tente de novo.', 'erro');
      return false;
    }
  }
  try {
    const { error } = await _dbGravar('cme_secretaria', novo);
    if (error) throw error;
  } catch (e) { _mostrarToast('\u{26A0}\u{FE0F} Erro ao salvar no banco: ' + (e.message || e) + '. Tente de novo.', 'erro'); return false; }
  _cache.secretaria = novo;
  return true;
}
// Excluir nunca apaga: guarda o item na lixeira interna, com quem e quando.
function _secParaLixeira(d, tipo, item) {
  d.lixeira.push({ tipo, item, por: usuarioAtual ? usuarioAtual.nome : '', em: new Date().toISOString() });
  if (d.lixeira.length > 500) d.lixeira = d.lixeira.slice(-500);
}

// ── Saldo de dispensas ────────────────────────────────────────────────────────
function _secApoiosDe(id, dados) { return (dados || _secDados()).apoios.filter(a => a.servidorId === id).sort((a, b) => String(a.data).localeCompare(String(b.data))); }
function _secSaldo(id, dados) {
  const ap = _secApoiosDe(id, dados), pend = ap.filter(a => !a.dispensa);
  return { apoios: ap.length, usufruidas: ap.length - pend.length, pendentes: pend.length, horasPendentes: pend.reduce((s, a) => s + (+a.horas || 0), 0) };
}

// ── Modal genérico (mesmas classes dos modais do CME) ─────────────────────────
function _secModal(titulo, corpo, botoes, largura) {
  let ov = document.getElementById('sec-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'sec-modal'; ov.className = 'modal-overlay'; document.body.appendChild(ov); }
  ov.innerHTML = '<div class="modal-box" style="max-width:' + (largura || 620) + 'px"><div class="modal-header"><h3>' + titulo + '</h3>'
    + '<button class="modal-close" onclick="_secFecharModal()">\u{2715}</button></div><div class="modal-body">' + corpo + '</div>'
    + '<div style="display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid var(--borda,#e2e8f0)">'
    + '<button class="btn-secondary" onclick="_secFecharModal()">Cancelar</button>' + (botoes || '') + '</div></div>';
  ov.classList.add('open');
}
function _secFecharModal() { const ov = document.getElementById('sec-modal'); if (ov) ov.classList.remove('open'); }
function _secCampo(id, rotulo, valor, extra) {
  return '<div class="form-field"><label>' + rotulo + '</label><input id="' + id + '" value="' + esc(valor || '') + '" ' + (extra || '') + '></div>';
}
function _secChips(nome, opcoes, atual) {
  return '<div style="display:flex;gap:6px;flex-wrap:wrap">' + opcoes.map(o => {
    const v = Array.isArray(o) ? o[0] : o, r = Array.isArray(o) ? o[1] : o;
    return '<button type="button" class="chip' + (String(v) === String(atual) ? ' active' : '') + '" data-grupo="' + nome + '" data-valor="' + esc(String(v)) + '" onclick="_secChip(this)" '
      + 'style="padding:6px 14px;border-radius:4px;border:1px solid #cbd5e1;background:' + (String(v) === String(atual) ? '#dbeafe' : '#fff') + ';cursor:pointer;font-weight:600">' + esc(r) + '</button>';
  }).join('') + '</div><input type="hidden" id="' + nome + '" value="' + esc(String(atual == null ? '' : atual)) + '">';
}
function _secChip(btn) {
  const g = btn.dataset.grupo;
  document.querySelectorAll('[data-grupo="' + g + '"]').forEach(b => { b.classList.remove('active'); b.style.background = '#fff'; });
  btn.classList.add('active'); btn.style.background = '#dbeafe';
  document.getElementById(g).value = btn.dataset.valor;
}

// ── Estrutura da aba ──────────────────────────────────────────────────────────
// Menu em 4 grupos (pedido de 14/10/2026: mais simples para o uso diário); a Auditoria fica num ícone discreto.
const _SEC_GRUPOS = [
  ['hoje', '\u{1F3E0} Hoje', [['hoje', 'Hoje']]],
  ['docs', '\u{1F4C5} Agenda e Documentos', [['agenda', '\u{1F4C5} Agenda'], ['despachos', '\u{1F4E8} Despachos PRODOC'], ['arquivo', '\u{1F5C4}\u{FE0F} Arquivo']]],
  ['pessoal', '\u{1F465} Pessoal', [['servidores', '\u{1F464} Servidores'], ['faltas', '\u{1F4DD} Faltas e Folha de Ponto'], ['ferias', '\u{1F3D6}\u{FE0F} Férias e Licenças'], ['apoios', '\u{23F1}\u{FE0F} Apoios e Dispensas'], ['folgas', '\u{1F91D} Folgas combinadas']]],
  ['escalas', '\u{1F4C6} Escalas', [['escalas', '\u{1F4CB} Apoio de sábado'], ['escserv', '\u{1F6E1}\u{FE0F} Escala de serviço (24x96)']]],
];
const _secUltimaDoGrupo = {};
function _secGrupoDe(aba) { const g = _SEC_GRUPOS.find(x => x[2].some(a => a[0] === aba)); return g ? g[0] : ''; }
function sec_inicializar() {
  const root = document.getElementById('sec-root');
  if (!root) return;
  if (!_secPode()) { root.innerHTML = '<div style="padding:40px;text-align:center;color:#64748b">Acesso restrito à Secretaria e à Gerência.</div>'; return; }
  root.innerHTML = '<div class="dash-header" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><div><div class="dash-title">\u{1F5C2}\u{FE0F} Secretaria</div>'
    + '<div class="dash-update">Servidores, apoios e dispensas, folgas e documentos — acesso restrito à Secretaria e à Gerência</div></div>'
    + '<div style="display:flex;gap:6px;align-items:center"><input id="sec-busca" list="sec-busca-lista" placeholder="\u{1F50E} Buscar servidor pelo nome…" onchange="sec_buscaAbrir(this.value)" style="min-width:250px;padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px"><datalist id="sec-busca-lista"></datalist>'
    + '<button type="button" id="sec-stab-auditoria" title="Auditoria — quem fez o quê na Secretaria" onclick="sec_mudarAba(\'auditoria\')" style="padding:6px 9px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;cursor:pointer">\u{1F50D}</button></div></div>'
    + '<div id="sec-menu"></div><div id="sec-hoje"></div><div id="sec-conteudo" style="padding-top:12px"></div>';
  sec_render();
}
function _secRenderMenu() {
  const m = document.getElementById('sec-menu'); if (!m) return;
  const g = _secGrupoDe(_secAba), grupo = _SEC_GRUPOS.find(x => x[0] === g);
  m.innerHTML = '<div class="sub-tabs">' + _SEC_GRUPOS.map(([k, r]) => '<div class="sub-tab' + (k === g ? ' active' : '') + '" id="sec-grp-' + k + '" onclick="sec_mudarGrupo(\'' + k + '\')">' + r + '</div>').join('') + '</div>'
    + (grupo && grupo[2].length > 1 ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' + grupo[2].map(([k, r]) => '<button type="button" id="sec-stab-' + k + '" onclick="sec_mudarAba(\'' + k + '\')" style="padding:5px 12px;border-radius:4px;cursor:pointer;font-size:.84rem;'
      + (k === _secAba ? 'border:1px solid #2563eb;background:#eff6ff;color:#1d4ed8;font-weight:700;box-shadow:inset 2px 0 0 #2563eb' : 'border:1px solid #cbd5e1;background:#fff;color:#475569') + '">' + r + '</button>').join('') + '</div>' : '');
  const aud = document.getElementById('sec-stab-auditoria'); if (aud) aud.style.background = _secAba === 'auditoria' ? '#eff6ff' : '#fff';
  const lst = document.getElementById('sec-busca-lista');
  if (lst) lst.innerHTML = _secDados().servidores.filter(s => (s.situacao || 'ativo') === 'ativo').map(s => s.nome).sort().map(n => '<option value="' + esc(n) + '">').join('');
}
function sec_mudarGrupo(g) { const grupo = _SEC_GRUPOS.find(x => x[0] === g); if (grupo) sec_mudarAba(_secUltimaDoGrupo[g] || grupo[2][0][0]); }
function sec_mudarAba(aba) {
  _secAba = aba; _secPerfilId = null;
  const g = _secGrupoDe(aba); if (g) _secUltimaDoGrupo[g] = aba;
  sec_render();
}
// busca rápida: escolher o nome abre o perfil do servidor
function sec_buscaAbrir(nome) {
  const el = document.getElementById('sec-busca'), alvo = String(nome || '').trim().toUpperCase(); if (!alvo) return;
  const d = _secDados(), s = d.servidores.find(x => x.nome === alvo) || d.servidores.filter(x => x.nome.includes(alvo)).sort((a, b) => a.nome.length - b.nome.length)[0];
  if (!s) { _mostrarToast('Servidor não encontrado: ' + nome, 'erro'); return; }
  if (el) el.value = '';
  sec_abrirPerfil(s.id);
}
function sec_render() {
  _secRenderMenu();
  if (typeof _secRenderHoje === 'function') _secRenderHoje();
  if (_secPerfilId) return sec_renderPerfil();
  ({ hoje: sec_renderHojeDash, agenda: sec_renderAgenda, despachos: sec_renderDespachos, arquivo: sec_renderArquivo, servidores: sec_renderServidores, ferias: sec_renderFerias, escalas: sec_renderEscalas, escserv: sec_renderEscServ, faltas: sec_renderFaltas, apoios: sec_renderApoios, folgas: sec_renderFolgas, auditoria: sec_renderAuditoria })[_secAba]();
}

// ── Servidores ────────────────────────────────────────────────────────────────
function sec_renderServidores() {
  const c = document.getElementById('sec-conteudo'); if (!c) return;
  const d = _secDados();
  const busca = (document.getElementById('sec-f-busca')?.value || '').toLowerCase().trim();
  const fEq = document.getElementById('sec-f-equipe')?.value || '';
  const fSit = document.getElementById('sec-f-sit')?.value ?? 'ativo';
  let lista = d.servidores.slice().sort((a, b) => a.nome.localeCompare(b.nome));
  if (busca) lista = lista.filter(s => [s.nome, s.matricula, s.cpf, s.cargo].join(' ').toLowerCase().includes(busca));
  if (fEq) lista = lista.filter(s => s.equipe === fEq);
  if (fSit) lista = lista.filter(s => (s.situacao || 'ativo') === fSit);
  const ativos = d.servidores.filter(s => (s.situacao || 'ativo') === 'ativo');
  const horasPend = ativos.reduce((t, s) => t + _secSaldo(s.id, d).horasPendentes, 0);
  c.innerHTML = '<div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:12px">'
    + '<div class="kpi-card" style="border-left:4px solid #0d9488"><div class="kpi-value">' + ativos.length + '</div><div class="kpi-label">Servidores ativos</div></div>'
    + '<div class="kpi-card" style="border-left:4px solid #d97706"><div class="kpi-value">' + horasPend + 'h</div><div class="kpi-label">Dispensas a usufruir</div></div>'
    + '<div class="kpi-card" style="border-left:4px solid #2563eb"><div class="kpi-value">' + d.apoios.filter(a => String(a.data).slice(0, 7) === _secHoje().slice(0, 7)).length + '</div><div class="kpi-label">Apoios neste mês</div></div></div>'
    + '<div class="table-toolbar" style="flex-wrap:wrap;gap:8px">'
    + '<input id="sec-f-busca" placeholder="Buscar nome, matrícula, CPF ou cargo" value="' + esc(busca) + '" oninput="sec_renderServidores()" style="flex:1;min-width:220px;padding:6px 10px">'
    + '<select id="sec-f-equipe" onchange="sec_renderServidores()"><option value="">Todas as equipes</option>' + _SEC_EQUIPES.map(e => '<option' + (e === fEq ? ' selected' : '') + '>' + e + '</option>').join('') + '</select>'
    + '<select id="sec-f-sit" onchange="sec_renderServidores()"><option value="ativo"' + (fSit === 'ativo' ? ' selected' : '') + '>Ativos</option><option value="inativo"' + (fSit === 'inativo' ? ' selected' : '') + '>Inativos</option><option value=""' + (fSit === '' ? ' selected' : '') + '>Todos</option></select>'
    + '<button class="btn-secondary" onclick="sec_baixarModeloServidores()">Baixar planilha modelo</button>'
    + '<label class="btn-secondary" style="cursor:pointer">Importar planilha<input type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="sec_importarServidores(this)"></label>'
    + '<label class="btn-secondary" style="cursor:pointer" title="PDFs mensais do SIGRH (plantão e expediente): atualiza guarnições, férias e licenças">Importar folhas de ponto (PDF)<input type="file" accept=".pdf" multiple style="display:none" onchange="sec_importarPonto(this)"></label>'
    + '<button class="btn-primary" onclick="sec_editarServidor()">+ Novo servidor</button></div>'
    + '<div class="table-scroll"><table class="data-table"><thead><tr><th>Nome</th><th>Cargo</th><th>Matrícula</th><th>Equipe</th><th>Telefone</th><th>Hoje</th><th>Dispensas a usufruir</th><th></th></tr></thead><tbody>'
    + (lista.length ? lista.map(s => {
      const sd = _secSaldo(s.id, d);
      return '<tr style="cursor:pointer" onclick="sec_abrirPerfil(\'' + s.id + '\')"><td><strong>' + esc(s.nome) + '</strong></td><td>' + esc(s.cargo || '—') + '</td>'
        + '<td style="font-family:var(--font-mono)">' + esc(s.matricula || '—') + '</td><td>' + esc(s.equipe || '—') + '</td><td>' + esc(s.telefone || '—') + '</td><td>' + _secSeloForaHoje(s.id, d) + '</td>'
        + '<td>' + (sd.pendentes ? '<b style="color:#b45309">' + sd.horasPendentes + 'h</b> (' + sd.pendentes + ' apoio' + (sd.pendentes > 1 ? 's' : '') + ')' : '—') + '</td>'
        + '<td><button class="btn-sm btn-outline">Abrir perfil</button></td></tr>';
    }).join('') : '<tr><td colspan="8" style="text-align:center;padding:28px;color:#888">' + (d.servidores.length ? 'Nenhum servidor com esse filtro.' : 'Nenhum servidor cadastrado. Clique em "+ Novo servidor".') + '</td></tr>')
    + '</tbody></table></div>';
  const b = document.getElementById('sec-f-busca'); if (b && busca) { b.focus(); b.setSelectionRange(busca.length, busca.length); }
}

function sec_editarServidor(id) {
  const s = id ? (_secServ(id) || {}) : {};
  const sel = (idc, rot, ops, v) => '<div class="form-field"><label>' + rot + '</label><select id="' + idc + '"><option value="">—</option>' + ops.map(o => '<option' + (o === v ? ' selected' : '') + '>' + o + '</option>').join('') + '</select></div>';
  const selV = (idc, rot, mapa, v) => '<div class="form-field"><label>' + rot + '</label><select id="' + idc + '"><option value="">—</option>' + Object.entries(mapa).map(([k, r]) => '<option value="' + k + '"' + (k === v ? ' selected' : '') + '>' + esc(r) + '</option>').join('') + '</select></div>';
  _secModal(id ? 'Editar servidor' : 'Novo servidor',
    '<div class="form-section"><div class="form-section-title">Identificação</div><div class="form-grid">'
    + _secCampo('sec-s-nome', 'Nome completo *', s.nome) + _secCampo('sec-s-matricula', 'Matrícula *', s.matricula)
    + _secCampo('sec-s-cpf', 'CPF', _secCpfFmt(s.cpf), 'inputmode="numeric" maxlength="14" oninput="this.value=_secCpfMascara(this.value)"') + _secCampo('sec-s-rg', 'RG', s.rg)
    + _secCampo('sec-s-nasc', 'Nascimento', s.nascimento, 'type="date"') + _secCampo('sec-s-cargo', 'Cargo', s.cargo, 'list="sec-cargos" placeholder="Ex.: Policial Penal, Educadora Social N/S"')
    + _secCampo('sec-s-formacao', 'Formação', s.formacao, 'placeholder="Ex.: Direito"') + _secCampo('sec-s-admissao', 'Admissão / lotação na CME', s.admissao, 'type="date"')
    + sel('sec-s-equipe', 'Equipe', _SEC_EQUIPES, s.equipe) + _secCampo('sec-s-setor', 'Setor', s.setor, 'placeholder="Ex.: Plantão, Jurídico, Secretaria"')
    + selV('sec-s-posto', 'Posto (plantão) — neste mês; troca sozinho todo mês', _SEC_POSTOS, _secPostoNoMes(s.posto)) + selV('sec-s-turno', 'Turno (expediente)', _SEC_TURNOS, s.turno)
    + selV('sec-s-apoio', 'Apoio de sábado (vazio = regra padrão)', _SEC_APOIO_REGIME, s.apoioSabado)
    + '</div></div><div class="form-section"><div class="form-section-title">Contato</div><div class="form-grid">'
    + _secCampo('sec-s-tel', 'Telefone', s.telefone, 'inputmode="tel"') + _secCampo('sec-s-email', 'E-mail', s.email, 'type="email"')
    + _secCampo('sec-s-end', 'Endereço', s.endereco) + _secCampo('sec-s-emerg', 'Contato de emergência (nome e telefone)', s.emergencia)
    + '</div></div><div class="form-section"><div class="form-section-title">Situação</div><div class="form-grid">'
    + sel('sec-s-sit', 'Situação', ['ativo', 'inativo'], s.situacao || 'ativo')
    + '<div class="form-field" style="grid-column:1/-1"><label>Observações</label><textarea id="sec-s-obs" rows="2">' + esc(s.obs || '') + '</textarea></div></div></div>'
    + '<datalist id="sec-cargos"><option>Policial Penal</option><option>Educadora Social N/S</option><option>Educador Social N/S</option><option>Assistente Social</option><option>Psicólogo(a)</option><option>Agente Administrativo</option></datalist>',
    '<button class="btn-primary" onclick="sec_salvarServidor(\'' + (id || '') + '\')">Salvar</button>', 760);
}
async function sec_salvarServidor(id) {
  const v = {
    nome: _secVal('sec-s-nome').toUpperCase(), matricula: _secVal('sec-s-matricula'), cpf: _secVal('sec-s-cpf').replace(/\D/g, ''), rg: _secVal('sec-s-rg'),
    nascimento: _secVal('sec-s-nasc'), cargo: _secVal('sec-s-cargo'), formacao: _secVal('sec-s-formacao'), admissao: _secVal('sec-s-admissao'),
    equipe: _secVal('sec-s-equipe'), setor: _secVal('sec-s-setor'), posto: _secPostoNoMes(_secVal('sec-s-posto')), turno: _secVal('sec-s-turno'), apoioSabado: _secVal('sec-s-apoio'), telefone: _secVal('sec-s-tel'), email: _secVal('sec-s-email'),
    endereco: _secVal('sec-s-end'), emergencia: _secVal('sec-s-emerg'), situacao: _secVal('sec-s-sit') || 'ativo', obs: _secVal('sec-s-obs'),
  };
  if (v.nome.length < 5) { _mostrarToast('Informe o nome completo.', 'erro'); return; }
  if (!v.matricula) { _mostrarToast('Informe a matrícula.', 'erro'); return; }
  if (v.cpf && !_secCpfValido(v.cpf)) { _mostrarToast('CPF inválido — confira os números.', 'erro'); return; }
  const dup = _secDados().servidores.find(s => s.id !== id && ((v.cpf && s.cpf === v.cpf) || s.matricula === v.matricula));
  if (dup) { _mostrarToast('Já existe servidor com essa matrícula ou CPF: ' + dup.nome, 'erro'); return; }
  const agora = new Date().toISOString(), por = usuarioAtual ? usuarioAtual.nome : '';
  let novoId = id;
  const ok = await _secMutar(d => {
    if (id) {
      const s = d.servidores.find(x => x.id === id); if (!s) return false;
      const trocouEquipe = v.equipe && s.equipe && v.equipe !== s.equipe;
      Object.assign(s, v, { atualizadoEm: agora, atualizadoPor: por });
      if (trocouEquipe) s.equipeFixa = true; // correção da gerência: a importação da folha de ponto não desfaz
    }
    else { novoId = _secId('srv'); d.servidores.push(Object.assign({ id: novoId, criadoEm: agora, criadoPor: por }, v)); }
  }, { action: id ? 'sec_servidor_editar' : 'sec_servidor_criar', alvo: v.nome, detalhe: 'Matrícula ' + v.matricula });
  if (!ok) return;
  _secFecharModal(); _mostrarToast('Servidor salvo.', 'sucesso');
  if (!id) { _secPerfilId = novoId; _secPerfilAba = 'qualificacao'; }
  sec_render();
}

// ── Perfil do servidor ────────────────────────────────────────────────────────
function sec_abrirPerfil(id) { _secPerfilId = id; _secPerfilAba = 'ficha'; sec_render(); auditar({ modulo: 'Secretaria', action: 'sec_perfil_abrir', alvo: _secNomeServ(id) }); }
function sec_perfilAba(a) { _secPerfilAba = a; sec_renderPerfil(); }
function sec_renderPerfil() {
  const c = document.getElementById('sec-conteudo'); if (!c) return;
  const d = _secDados(), s = _secServ(_secPerfilId, d);
  if (!s) { _secPerfilId = null; return sec_render(); }
  const sd = _secSaldo(s.id, d);
  const abas = [['ficha', 'Ficha de apoio e dispensas'], ['afastamentos', 'Férias e licenças'], ['folgas', 'Folgas combinadas'], ['faltas', 'Faltas'], ['documentos', 'Documentos'], ['qualificacao', 'Qualificação']];
  c.innerHTML = '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">'
    + '<button class="btn-secondary" onclick="_secPerfilId=null;sec_render()">\u{2190} Voltar</button>'
    + '<div style="flex:1"><div style="font-size:1.15rem;font-weight:700">' + esc(s.nome) + '</div>'
    + '<div style="color:#64748b;font-size:.85rem">' + esc([s.cargo, s.formacao && '(' + s.formacao + ')', s.matricula && 'Matrícula ' + s.matricula, s.equipe].filter(Boolean).join(' · ')) + ' ' + _secSeloForaHoje(s.id, d) + '</div></div>'
    + '<div style="background:#fffbeb;border-left:4px solid #d97706;padding:6px 12px;border-radius:4px"><b>' + sd.horasPendentes + 'h</b> de dispensa a usufruir<div style="font-size:.75rem;color:#64748b">' + sd.apoios + ' apoio(s) · ' + sd.usufruidas + ' usufruída(s)</div></div></div>'
    + '<div class="sub-tabs">' + abas.map(([k, r]) => '<div class="sub-tab' + (k === _secPerfilAba ? ' active' : '') + '" onclick="sec_perfilAba(\'' + k + '\')">' + r + '</div>').join('') + '</div>'
    + '<div id="sec-perfil-corpo" style="padding-top:12px"></div>';
  const corpo = document.getElementById('sec-perfil-corpo');
  if (_secPerfilAba === 'qualificacao') corpo.innerHTML = _secHtmlQualificacao(s);
  else if (_secPerfilAba === 'ficha') corpo.innerHTML = _secHtmlFicha(s, d);
  else if (_secPerfilAba === 'folgas') corpo.innerHTML = _secHtmlFolgas(d.folgas.filter(f => f.servidorId === s.id), false, s.id);
  else if (_secPerfilAba === 'documentos') {
    corpo.innerHTML = _secHtmlArquivoDoServidor(s.id, d) + '<div id="sec-docs-pessoais"></div>';
    sec_renderDocs(document.getElementById('sec-docs-pessoais'), 'servidores/' + s.id, s.nome);
  }
  else if (_secPerfilAba === 'afastamentos') corpo.innerHTML = _secHtmlAfastamentosServidor(s, d);
  else if (_secPerfilAba === 'faltas') corpo.innerHTML = typeof _secHtmlFaltasDoServidor === 'function' ? _secHtmlFaltasDoServidor(s, d) : '';
}
function _secHtmlQualificacao(s) {
  const linha = (r, v) => '<tr><th style="width:230px;background:#f8fafc;text-align:left">' + r + '</th><td>' + (v ? esc(v) : '<span style="color:#94a3b8">—</span>') + '</td></tr>';
  return '<div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="btn-primary" onclick="sec_editarServidor(\'' + s.id + '\')">Editar dados</button></div>'
    + '<table class="data-table"><tbody>' + linha('Nome', s.nome) + linha('Matrícula', s.matricula) + linha('CPF', _secCpfFmt(s.cpf)) + linha('RG', s.rg)
    + linha('Nascimento', _secBR(s.nascimento)) + linha('Cargo', s.cargo) + linha('Formação', s.formacao) + linha('Admissão / lotação', _secBR(s.admissao))
    + (s.posto ? linha('Posto (plantão) neste mês', (_SEC_POSTOS[_secPostoNoMes(s.posto)] || s.posto) + ' · troca 1↔2 todo mês') : '') + (s.turno ? linha('Turno (expediente)', _SEC_TURNOS[s.turno] || s.turno) : '')
    + (s.apoioSabado ? linha('Apoio de sábado', _SEC_APOIO_REGIME[s.apoioSabado] || s.apoioSabado) : '')
    + linha('Equipe', s.equipe) + linha('Setor', s.setor) + linha('Telefone', s.telefone) + linha('E-mail', s.email) + linha('Endereço', s.endereco)
    + linha('Contato de emergência', s.emergencia) + linha('Situação', s.situacao || 'ativo') + linha('Observações', s.obs)
    + linha('Cadastrado', [s.criadoPor, s.criadoEm && new Date(s.criadoEm).toLocaleString('pt-BR')].filter(Boolean).join(' em ')) + '</tbody></table>';
}

// ── Ficha de Apoio e Dispensas (igual à ficha de papel) ──────────────────────
function _secTurnoTxt(t) { return ({ diurno: 'Diurna', noturno: 'Noturna', integral: 'Integral' })[t] || t || ''; }
function _secHtmlFicha(s, d) {
  const ap = _secApoiosDe(s.id, d);
  return '<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:8px;flex-wrap:wrap">'
    + '<button class="btn-secondary" onclick="sec_imprimirFicha(\'' + s.id + '\')">\u{1F5A8}\u{FE0F} Imprimir ficha</button>'
    + (ap.some(a => !a.dispensa) ? '<button class="btn-secondary" onclick="sec_lancarDispensaProxima(\'' + s.id + '\')">Lançar dispensa</button>' : '')
    + '<button class="btn-primary" onclick="sec_novoApoio(\'' + s.id + '\')">+ Registrar apoio</button></div>'
    + '<div class="table-scroll"><table class="data-table"><thead><tr><th>Data do apoio</th><th>Ação</th><th>Direito</th><th>Data da dispensa</th><th>Turno</th><th>Lançado por</th><th></th></tr></thead><tbody>'
    + (ap.length ? ap.map(a => _secLinhaApoio(a, false)).join('') : '<tr><td colspan="7" style="text-align:center;padding:24px;color:#888">Nenhum apoio registrado.</td></tr>')
    + '</tbody></table></div>';
}
function _secLinhaApoio(a, comNome, dados) {
  const disp = a.dispensa;
  return '<tr' + (disp ? '' : ' style="background:#fffbeb"') + '>' + (comNome ? '<td><a href="#" onclick="sec_abrirPerfil(\'' + a.servidorId + '\');return false"><strong>' + esc(_secNomeServ(a.servidorId, dados)) + '</strong></a></td>' : '')
    + '<td style="font-family:var(--font-mono)">' + _secBR(a.data) + '</td><td>' + esc(a.acao) + '</td><td><b>' + a.horas + 'h</b></td>'
    + '<td style="font-family:var(--font-mono)">' + (disp ? _secBR(disp.data) : '<span style="color:#b45309;font-weight:600">a usufruir</span>') + '</td>'
    + '<td>' + (disp ? _secTurnoTxt(disp.turno) : '') + '</td>'
    + '<td style="font-size:.8rem;color:#64748b">' + esc(disp ? disp.por : a.criadoPor || '') + '</td>'
    + '<td style="white-space:nowrap">' + (disp
      ? '<button class="btn-sm btn-outline" title="Desfazer o lançamento da dispensa" onclick="sec_desfazerDispensa(\'' + a.id + '\')">Desfazer</button>'
      : '<button class="btn-sm btn-primary" onclick="sec_lancarDispensa(\'' + a.id + '\')">Lançar dispensa</button> '
        + '<button class="btn-sm btn-outline" style="color:#b91c1c" onclick="sec_excluirApoio(\'' + a.id + '\')">Excluir</button>') + '</td></tr>';
}

function sec_novoApoio(servidorId) {
  const d = _secDados();
  const ativos = d.servidores.filter(s => (s.situacao || 'ativo') === 'ativo' || s.id === servidorId).sort((a, b) => a.nome.localeCompare(b.nome));
  if (!ativos.length) { _mostrarToast('Cadastre os servidores antes.', 'erro'); return; }
  const acoes = [...new Set(d.apoios.map(a => a.acao).filter(Boolean))].slice(-40);
  _secModal('Registrar apoio prestado',
    '<div class="form-field"><label>Servidor(es) — marque todos que prestaram o apoio</label>'
    + '<div style="max-height:180px;overflow:auto;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px">'
    + ativos.map(s => '<label style="display:flex;gap:8px;align-items:center;padding:3px 0;font-weight:400"><input type="checkbox" class="sec-ap-serv" value="' + s.id + '"' + (s.id === servidorId ? ' checked' : '') + '> ' + esc(s.nome) + ' <span style="color:#94a3b8;font-size:.8rem">' + esc(s.equipe || '') + '</span></label>').join('')
    + '</div></div><div class="form-grid">'
    + _secCampo('sec-ap-ini', 'Data do apoio (ou 1º dia)', _secHoje(), 'type="date"') + _secCampo('sec-ap-fim', 'Último dia (se for mais de um dia)', '', 'type="date"')
    + '</div>' + _secCampo('sec-ap-acao', 'Ação / evento', '', 'list="sec-ap-acoes" placeholder="Ex.: Apoio EXPO 2026 – OCB, 7 de Setembro"')
    + '<datalist id="sec-ap-acoes">' + acoes.map(a => '<option>' + esc(a) + '</option>').join('') + '</datalist>'
    + '<div class="form-field"><label>Cada dia de apoio dá direito a</label>' + _secChips('sec-ap-horas', _SEC_DIREITOS.map(h => [h, h + ' horas']), 12) + '</div>'
    + '<div class="form-field"><label>Observação</label><input id="sec-ap-obs"></div>'
    + '<div style="font-size:.8rem;color:#64748b">É criada uma linha na ficha de cada servidor para cada dia de apoio, como na ficha de papel.</div>',
    '<button class="btn-primary" onclick="sec_salvarApoio()">Registrar</button>', 640);
}
async function sec_salvarApoio() {
  const servs = [...document.querySelectorAll('.sec-ap-serv:checked')].map(i => i.value);
  const ini = _secVal('sec-ap-ini'), fim = _secVal('sec-ap-fim') || ini, acao = _secVal('sec-ap-acao'), horas = +_secVal('sec-ap-horas');
  if (!servs.length) { _mostrarToast('Marque ao menos um servidor.', 'erro'); return; }
  if (!ini || fim < ini) { _mostrarToast('Confira as datas.', 'erro'); return; }
  if (!acao) { _mostrarToast('Descreva a ação / evento.', 'erro'); return; }
  if (!_SEC_DIREITOS.includes(horas)) { _mostrarToast('Escolha 6, 12 ou 24 horas.', 'erro'); return; }
  const dias = []; for (let t = new Date(ini + 'T12:00:00'); t <= new Date(fim + 'T12:00:00'); t = new Date(t.getTime() + 864e5)) dias.push(t.toISOString().slice(0, 10));
  if (dias.length > 31) { _mostrarToast('Período longo demais (máx. 31 dias por lançamento).', 'erro'); return; }
  const agora = new Date().toISOString(), por = usuarioAtual ? usuarioAtual.nome : '', obs = _secVal('sec-ap-obs');
  let criados = 0, repetidos = 0;
  const ok = await _secMutar(d => {
    servs.forEach(sid => dias.forEach(dia => {
      if (d.apoios.some(a => a.servidorId === sid && a.data === dia && a.acao.toLowerCase() === acao.toLowerCase())) { repetidos++; return; }
      d.apoios.push({ id: _secId('apo'), servidorId: sid, data: dia, acao, horas, obs, criadoPor: por, criadoEm: agora, dispensa: null }); criados++;
    }));
  }, { action: 'sec_apoio_registrar', alvo: acao, detalhe: servs.length + ' servidor(es) · ' + dias.length + ' dia(s) · ' + horas + 'h cada' });
  if (!ok) return;
  _secFecharModal();
  _mostrarToast(criados + ' apoio(s) registrado(s)' + (repetidos ? ' · ' + repetidos + ' já existia(m)' : '') + '.', 'sucesso');
  sec_render();
}
function sec_lancarDispensa(apoioId) {
  const a = _secDados().apoios.find(x => x.id === apoioId); if (!a) return;
  const turnos = a.horas >= 24 ? [['integral', 'Integral (24h)']] : [['diurno', a.horas + 'h diurna'], ['noturno', a.horas + 'h noturna']];
  _secModal('Lançar dispensa',
    '<div style="background:#f8fafc;border-radius:6px;padding:8px 12px;margin-bottom:10px"><b>' + esc(_secNomeServ(a.servidorId)) + '</b><br>'
    + 'Apoio de ' + _secBR(a.data) + ' — ' + esc(a.acao) + ' · direito a <b>' + a.horas + 'h</b></div>'
    + _secCampo('sec-di-data', 'Data da dispensa', _secHoje(), 'type="date"')
    + '<div class="form-field"><label>Turno</label>' + _secChips('sec-di-turno', turnos, turnos[0][0]) + '</div>'
    + '<div class="form-field"><label>Observação</label><input id="sec-di-obs"></div>',
    '<button class="btn-primary" onclick="sec_salvarDispensa(\'' + apoioId + '\')">Lançar</button>', 520);
}
async function sec_salvarDispensa(apoioId) {
  const data = _secVal('sec-di-data'), turno = _secVal('sec-di-turno');
  if (!data || !turno) { _mostrarToast('Informe a data e o turno.', 'erro'); return; }
  let alvo = '';
  const ok = await _secMutar(d => {
    const a = d.apoios.find(x => x.id === apoioId); if (!a) return false;
    if (a.dispensa) { _mostrarToast('Essa dispensa já foi lançada por ' + a.dispensa.por + '.', 'erro'); return false; }
    a.dispensa = { data, turno, obs: _secVal('sec-di-obs'), por: usuarioAtual ? usuarioAtual.nome : '', em: new Date().toISOString() };
    alvo = _secNomeServ(a.servidorId, d) + ' — apoio de ' + _secBR(a.data);
  });
  if (!ok) return;
  auditar({ modulo: 'Secretaria', action: 'sec_dispensa_lancar', alvo, detalhe: 'Dispensa em ' + _secBR(data) + ' (' + _secTurnoTxt(turno) + ')' });
  _secFecharModal(); _mostrarToast('Dispensa lançada.', 'sucesso'); sec_render();
}
async function sec_desfazerDispensa(apoioId) {
  if (!confirm('Desfazer o lançamento desta dispensa? O apoio volta a ficar "a usufruir".')) return;
  let alvo = '';
  const ok = await _secMutar(d => {
    const a = d.apoios.find(x => x.id === apoioId); if (!a || !a.dispensa) return false;
    _secParaLixeira(d, 'dispensa', Object.assign({ apoioId }, a.dispensa));
    alvo = _secNomeServ(a.servidorId, d) + ' — dispensa de ' + _secBR(a.dispensa.data); a.dispensa = null;
  });
  if (ok) { auditar({ modulo: 'Secretaria', action: 'sec_dispensa_desfazer', alvo }); sec_render(); }
}
async function sec_excluirApoio(apoioId) {
  if (!confirm('Excluir este apoio da ficha? (fica guardado na lixeira da Secretaria)')) return;
  let alvo = '';
  const ok = await _secMutar(d => {
    const i = d.apoios.findIndex(x => x.id === apoioId); if (i < 0) return false;
    if (d.apoios[i].dispensa) { _mostrarToast('Desfaça a dispensa antes de excluir o apoio.', 'erro'); return false; }
    alvo = _secNomeServ(d.apoios[i].servidorId, d) + ' — ' + _secBR(d.apoios[i].data) + ' ' + d.apoios[i].acao;
    _secParaLixeira(d, 'apoio', d.apoios[i]); d.apoios.splice(i, 1);
  });
  if (ok) { auditar({ modulo: 'Secretaria', action: 'sec_apoio_excluir', alvo }); sec_render(); }
}

// Ficha para imprimir e colher as assinaturas (mesmo layout da ficha de papel)
function sec_imprimirFicha(id) {
  const d = _secDados(), s = _secServ(id, d); if (!s) return;
  const ap = _secApoiosDe(id, d), linhas = Math.max(22, ap.length + 4);
  const td = 'border:1px solid #000;padding:5px 6px;font-size:11pt;height:22px';
  const marca = (a, t) => a.dispensa && (a.dispensa.turno === t || (t === 'diurno' && a.dispensa.turno === 'integral')) ? 'X' + (a.horas !== 12 ? ' (' + a.horas + 'h)' : '') : '';
  let corpo = '';
  for (let i = 0; i < linhas; i++) {
    const a = ap[i];
    corpo += '<tr><td style="' + td + '">' + (a ? _secBR(a.data) : '___/___/___') + '</td><td style="' + td + '">' + (a ? esc(a.acao) + (a.horas !== 12 ? ' — ' + a.horas + 'h' : '') : '') + '</td>'
      + '<td style="' + td + '">' + (a && a.dispensa ? _secBR(a.dispensa.data) : '___/___/___') + '</td><td style="' + td + ';text-align:center">' + (a ? marca(a, 'diurno') : '') + '</td>'
      + '<td style="' + td + ';text-align:center">' + (a ? marca(a, 'noturno') : '') + '</td><td style="' + td + '"></td><td style="' + td + '"></td></tr>';
  }
  const th = 'border:1px solid #000;padding:5px;font-size:10pt;background:#eee';
  const cab = esc(String(s.cargo || '').toUpperCase()) + ': ' + esc(s.nome) + (s.formacao ? ' (' + esc(s.formacao.toUpperCase()) + ')' : '');
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>Ficha - ' + esc(s.nome) + '</title>'
    + '<style>@page{size:A4;margin:14mm}body{font-family:Arial,Helvetica,sans-serif;color:#000}table{border-collapse:collapse;width:100%}@media print{.np{display:none}}</style></head><body>'
    + '<div class="np" style="text-align:right;margin-bottom:8px"><button onclick="print()" style="padding:6px 14px">Imprimir</button></div>'
    + '<div style="text-align:center;font-weight:bold;font-size:13pt">FICHA INDIVIDUAL DO SERVIDOR<br>CENTRAL DE MONITORAMENTO ELETRÔNICO – CME</div>'
    + '<div style="margin:10px 0 2px;font-weight:bold;font-size:11pt">' + cab + '</div><div style="margin-bottom:6px;font-weight:bold;font-size:11pt">MATRÍCULA: <span style="font-weight:normal">' + esc(s.matricula || '') + '</span></div>'
    + '<table><thead><tr><th colspan="7" style="' + th + '">CONTROLE DE APOIO E DISPENSAS</th></tr><tr>'
    + ['DATA DO APOIO', 'AÇÃO', 'DATA DA DISPENSA', '12H DIURNAS', '12H NOTURNAS', 'ASS. SERVIDOR', 'ASS. CME'].map(h => '<th style="' + th + '">' + h + '</th>').join('')
    + '</tr></thead><tbody>' + corpo + '</tbody></table>'
    + '<div style="font-size:8pt;color:#555;margin-top:6px">Emitida pelo sistema CME em ' + new Date().toLocaleString('pt-BR') + ' por ' + esc(usuarioAtual ? usuarioAtual.nome : '') + '.</div></body></html>';
  _entregarDoc(new Blob([html], { type: 'text/html' }), 'Ficha ' + s.nome + '.html');
  auditar({ modulo: 'Secretaria', action: 'sec_ficha_imprimir', alvo: s.nome });
}

// ── Aba geral: Apoios e Dispensas ─────────────────────────────────────────────
function sec_renderApoios() {
  const c = document.getElementById('sec-conteudo'); if (!c) return;
  const d = _secDados();
  const fMes = document.getElementById('sec-a-mes')?.value ?? _secHoje().slice(0, 7);
  const fServ = document.getElementById('sec-a-serv')?.value || '';
  const fSit = document.getElementById('sec-a-sit')?.value || '';
  let lista = d.apoios.slice().sort((a, b) => String(b.data).localeCompare(String(a.data)));
  if (fMes) lista = lista.filter(a => String(a.data).slice(0, 7) === fMes || (a.dispensa && String(a.dispensa.data).slice(0, 7) === fMes));
  if (fServ) lista = lista.filter(a => a.servidorId === fServ);
  if (fSit === 'pendente') lista = lista.filter(a => !a.dispensa);
  if (fSit === 'usufruida') lista = lista.filter(a => a.dispensa);
  const pend = d.apoios.filter(a => !a.dispensa);
  const servs = d.servidores.slice().sort((a, b) => a.nome.localeCompare(b.nome));
  c.innerHTML = '<div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:12px">'
    + '<div class="kpi-card" style="border-left:4px solid #2563eb"><div class="kpi-value">' + d.apoios.filter(a => String(a.data).slice(0, 7) === _secHoje().slice(0, 7)).length + '</div><div class="kpi-label">Apoios neste mês</div></div>'
    + '<div class="kpi-card" style="border-left:4px solid #d97706"><div class="kpi-value">' + pend.reduce((t, a) => t + (+a.horas || 0), 0) + 'h</div><div class="kpi-label">A usufruir (' + pend.length + ' apoios)</div></div>'
    + '<div class="kpi-card" style="border-left:4px solid #16a34a"><div class="kpi-value">' + d.apoios.filter(a => a.dispensa && String(a.dispensa.data).slice(0, 7) === _secHoje().slice(0, 7)).length + '</div><div class="kpi-label">Dispensas usufruídas no mês</div></div></div>'
    + '<div class="table-toolbar" style="flex-wrap:wrap;gap:8px">'
    + '<label style="font-size:.85rem">Mês <input type="month" id="sec-a-mes" value="' + esc(fMes) + '" onchange="sec_renderApoios()"></label>'
    + '<select id="sec-a-serv" onchange="sec_renderApoios()"><option value="">Todos os servidores</option>' + servs.map(s => '<option value="' + s.id + '"' + (s.id === fServ ? ' selected' : '') + '>' + esc(s.nome) + '</option>').join('') + '</select>'
    + '<select id="sec-a-sit" onchange="sec_renderApoios()"><option value="">Todas</option><option value="pendente"' + (fSit === 'pendente' ? ' selected' : '') + '>A usufruir</option><option value="usufruida"' + (fSit === 'usufruida' ? ' selected' : '') + '>Usufruídas</option></select>'
    + '<button class="btn-secondary" onclick="document.getElementById(\'sec-a-mes\').value=\'\';sec_renderApoios()">Todos os meses</button>'
    + '<span style="flex:1"></span><button class="btn-primary" onclick="sec_novoApoio()">+ Registrar apoio</button></div>'
    + '<div class="table-scroll"><table class="data-table"><thead><tr><th>Servidor</th><th>Data do apoio</th><th>Ação</th><th>Direito</th><th>Data da dispensa</th><th>Turno</th><th>Lançado por</th><th></th></tr></thead><tbody>'
    + (lista.length ? lista.map(a => _secLinhaApoio(a, true, d)).join('') : '<tr><td colspan="8" style="text-align:center;padding:24px;color:#888">Nenhum apoio com esse filtro.</td></tr>')
    + '</tbody></table></div>';
}

// ── Folgas combinadas com a chefia ────────────────────────────────────────────
function _secHtmlFolgas(lista, comNome, servidorId) {
  const d = _secDados();
  lista = lista.slice().sort((a, b) => String(b.data).localeCompare(String(a.data)));
  return '<div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="btn-primary" onclick="sec_novaFolga(\'' + (servidorId || '') + '\')">+ Folga combinada</button></div>'
    + '<div class="table-scroll"><table class="data-table"><thead><tr>' + (comNome ? '<th>Servidor</th>' : '') + '<th>Data</th><th>Até</th><th>Combinado / motivo</th><th>Autorizado por</th><th>Lançado por</th><th></th></tr></thead><tbody>'
    + (lista.length ? lista.map(f => '<tr>' + (comNome ? '<td><a href="#" onclick="sec_abrirPerfil(\'' + f.servidorId + '\');return false"><strong>' + esc(_secNomeServ(f.servidorId, d)) + '</strong></a></td>' : '')
      + '<td style="font-family:var(--font-mono)">' + _secBR(f.data) + '</td><td style="font-family:var(--font-mono)">' + (f.ate && f.ate !== f.data ? _secBR(f.ate) : '—') + '</td>'
      + '<td>' + esc(f.descricao) + '</td><td>' + esc(f.autorizadoPor || '') + '</td><td style="font-size:.8rem;color:#64748b">' + esc(f.criadoPor || '') + '</td>'
      + '<td><button class="btn-sm btn-outline" style="color:#b91c1c" onclick="sec_excluirFolga(\'' + f.id + '\')">Excluir</button></td></tr>').join('')
      : '<tr><td colspan="' + (comNome ? 7 : 6) + '" style="text-align:center;padding:24px;color:#888">Nenhuma folga combinada registrada.</td></tr>')
    + '</tbody></table></div>';
}
function sec_renderFolgas() {
  const c = document.getElementById('sec-conteudo'); if (!c) return;
  const d = _secDados(), fMes = document.getElementById('sec-fo-mes')?.value ?? '';
  let lista = d.folgas;
  if (fMes) lista = lista.filter(f => String(f.data).slice(0, 7) === fMes || String(f.ate || '').slice(0, 7) === fMes);
  c.innerHTML = '<div class="table-toolbar"><label style="font-size:.85rem">Mês <input type="month" id="sec-fo-mes" value="' + esc(fMes) + '" onchange="sec_renderFolgas()"></label></div>'
    + _secHtmlFolgas(lista, true, '');
}
function sec_novaFolga(servidorId) {
  const d = _secDados(), servs = d.servidores.filter(s => (s.situacao || 'ativo') === 'ativo' || s.id === servidorId).sort((a, b) => a.nome.localeCompare(b.nome));
  if (!servs.length) { _mostrarToast('Cadastre os servidores antes.', 'erro'); return; }
  _secModal('Folga combinada com a chefia',
    '<div class="form-field"><label>Servidor</label><select id="sec-fo-serv">' + servs.map(s => '<option value="' + s.id + '"' + (s.id === servidorId ? ' selected' : '') + '>' + esc(s.nome) + '</option>').join('') + '</select></div>'
    + '<div class="form-grid">' + _secCampo('sec-fo-data', 'Data', _secHoje(), 'type="date"') + _secCampo('sec-fo-ate', 'Até (se for mais de um dia)', '', 'type="date"') + '</div>'
    + _secCampo('sec-fo-desc', 'O que foi combinado', '', 'placeholder="Ex.: folga em troca do apoio ao plantão de 12/10"')
    + _secCampo('sec-fo-aut', 'Autorizado por', usuarioAtual ? usuarioAtual.nome : ''),
    '<button class="btn-primary" onclick="sec_salvarFolga()">Registrar</button>', 560);
}
async function sec_salvarFolga() {
  const f = { servidorId: _secVal('sec-fo-serv'), data: _secVal('sec-fo-data'), ate: _secVal('sec-fo-ate'), descricao: _secVal('sec-fo-desc'), autorizadoPor: _secVal('sec-fo-aut') };
  if (!f.servidorId || !f.data) { _mostrarToast('Informe o servidor e a data.', 'erro'); return; }
  if (f.ate && f.ate < f.data) { _mostrarToast('A data final é anterior à inicial.', 'erro'); return; }
  if (!f.descricao) { _mostrarToast('Descreva o que foi combinado.', 'erro'); return; }
  const ok = await _secMutar(d => { d.folgas.push(Object.assign({ id: _secId('fol'), criadoPor: usuarioAtual ? usuarioAtual.nome : '', criadoEm: new Date().toISOString() }, f)); },
    { action: 'sec_folga_registrar', alvo: _secNomeServ(f.servidorId), detalhe: _secBR(f.data) + (f.ate ? ' a ' + _secBR(f.ate) : '') + ' · ' + f.descricao });
  if (ok) { _secFecharModal(); _mostrarToast('Folga registrada.', 'sucesso'); sec_render(); }
}
async function sec_excluirFolga(id) {
  if (!confirm('Excluir esta folga combinada? (fica guardada na lixeira da Secretaria)')) return;
  let alvo = '';
  const ok = await _secMutar(d => {
    const i = d.folgas.findIndex(x => x.id === id); if (i < 0) return false;
    alvo = _secNomeServ(d.folgas[i].servidorId, d) + ' — ' + _secBR(d.folgas[i].data);
    _secParaLixeira(d, 'folga', d.folgas[i]); d.folgas.splice(i, 1);
  });
  if (ok) { auditar({ modulo: 'Secretaria', action: 'sec_folga_excluir', alvo }); sec_render(); }
}

// ── Documentos (Worker /sec/*) ────────────────────────────────────────────────
async function sec_renderDocs(el, pasta, referencia) {
  el.innerHTML = '<div class="table-toolbar" style="flex-wrap:wrap;gap:8px"><input id="sec-doc-desc" placeholder="Descrição (ex.: Portaria de férias 2026, RG, comprovante de residência)" style="flex:1;min-width:240px;padding:6px 10px">'
    + '<label class="btn-primary" style="cursor:pointer">+ Anexar arquivo<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.odt,.txt" style="display:none" onchange="sec_enviarDocs(this,\'' + pasta + '\',\'' + _jsq(referencia) + '\')"></label></div>'
    + '<div id="sec-doc-lista" style="color:#64748b;padding:12px">Carregando…</div>';
  try {
    const r = await r2_api('GET', '/sec/list?pasta=' + encodeURIComponent(pasta));
    const arq = (r.arquivos || []).sort((a, b) => String(b.enviadoEm).localeCompare(String(a.enviadoEm)));
    const box = document.getElementById('sec-doc-lista'); if (!box) return;
    box.style.padding = '0';
    box.innerHTML = '<div class="table-scroll"><table class="data-table"><thead><tr><th>Arquivo</th><th>Descrição</th><th>Enviado</th><th>Por</th><th></th></tr></thead><tbody>'
      + (arq.length ? arq.map(a => '<tr><td><a href="#" onclick="sec_abrirDoc(\'' + encodeURIComponent(a.key) + '\',\'' + _jsq(a.nome) + '\');return false"><strong>' + esc(a.nome) + '</strong></a>'
        + ' <span style="color:#94a3b8;font-size:.75rem">' + Math.max(1, Math.round((a.tamanho || 0) / 1024)) + ' KB</span></td><td>' + esc(a.descricao || '') + '</td>'
        + '<td style="font-family:var(--font-mono);font-size:.8rem">' + (a.enviadoEm ? new Date(a.enviadoEm).toLocaleString('pt-BR') : '') + '</td><td style="font-size:.8rem">' + esc(a.enviadoPor || '') + '</td>'
        + '<td><button class="btn-sm btn-outline" style="color:#b91c1c" onclick="sec_apagarDoc(\'' + encodeURIComponent(a.key) + '\',\'' + pasta + '\',\'' + _jsq(referencia) + '\')">Apagar</button></td></tr>').join('')
        : '<tr><td colspan="5" style="text-align:center;padding:24px;color:#888">Nenhum documento anexado.</td></tr>') + '</tbody></table></div>';
  } catch (e) {
    const box = document.getElementById('sec-doc-lista');
    if (box) box.textContent = 'Não consegui abrir os documentos: ' + (e.message || e) + '. Se acabou de ser liberado o acesso, saia e entre de novo no sistema.';
  }
}
function _secLerArquivo(f) { return new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => erro(r.error); r.readAsDataURL(f); }); }
async function sec_enviarDocs(input, pasta, referencia) {
  const arquivos = [...(input.files || [])]; input.value = '';
  const desc = _secVal('sec-doc-desc');
  let ok = 0;
  for (const f of arquivos) {
    if (f.size > 15 * 1024 * 1024) { _mostrarToast(f.name + ': maior que 15 MB.', 'erro'); continue; }
    try {
      _mostrarToast('Enviando ' + f.name + '…');
      await r2_api('POST', '/sec/upload', { 'Content-Type': 'application/json' }, JSON.stringify({ pasta, nome: f.name, conteudo: await _secLerArquivo(f), descricao: desc, referencia }));
      ok++;
    } catch (e) { _mostrarToast(f.name + ': ' + (e.message || e), 'erro'); }
  }
  if (ok) _mostrarToast(ok + ' arquivo(s) anexado(s).', 'sucesso');
  sec_renderPerfil();
}
async function sec_abrirDoc(keyEnc, nome) {
  try {
    const res = await r2_api('GET', '/sec/download?key=' + keyEnc);
    _entregarDoc(await res.blob(), nome);
  } catch (e) { _mostrarToast('Não consegui abrir: ' + (e.message || e), 'erro'); }
}
async function sec_apagarDoc(keyEnc, pasta, referencia) {
  if (!confirm('Apagar este documento? (ele vai para a lixeira da Secretaria e pode ser recuperado pelo administrador)')) return;
  try {
    await r2_api('POST', '/sec/delete', { 'Content-Type': 'application/json' }, JSON.stringify({ key: decodeURIComponent(keyEnc) }));
    _mostrarToast('Documento movido para a lixeira.', 'sucesso');
  } catch (e) { _mostrarToast('Não consegui apagar: ' + (e.message || e), 'erro'); }
  sec_renderPerfil();
}

// ── Auditoria (só administrador, gerência e secretaria) ──────────────────────
const _SEC_ACOES = {
  sec_servidor_criar: 'Cadastrou servidor', sec_servidor_editar: 'Editou servidor', sec_perfil_abrir: 'Abriu perfil',
  sec_apoio_registrar: 'Registrou apoio', sec_apoio_excluir: 'Excluiu apoio', sec_dispensa_lancar: 'Lançou dispensa', sec_dispensa_desfazer: 'Desfez dispensa',
  sec_folga_registrar: 'Registrou folga combinada', sec_folga_excluir: 'Excluiu folga combinada', sec_ficha_imprimir: 'Imprimiu ficha',
  sec_enviar: 'Anexou documento', sec_abrir: 'Abriu documento', sec_apagar: 'Apagou documento (lixeira)',
};
async function sec_renderAuditoria() {
  const c = document.getElementById('sec-conteudo'); if (!c) return;
  c.innerHTML = '<div style="color:#64748b;padding:12px">Carregando auditoria…</div>';
  try {
    const r = await r2_api('GET', '/sec/audit?limit=500');
    const linhas = r.audit || [];
    c.innerHTML = '<div style="font-size:.85rem;color:#64748b;margin-bottom:8px">Últimos 500 registros da Secretaria — visível só para Administração, Gerência e Secretaria.</div>'
      + '<div class="table-scroll"><table class="data-table"><thead><tr><th>Data e hora</th><th>Usuário</th><th>Ação</th><th>Sobre</th><th>Detalhe</th></tr></thead><tbody>'
      + (linhas.length ? linhas.map(a => '<tr><td style="font-family:var(--font-mono);font-size:.8rem;white-space:nowrap">' + new Date(a.ts).toLocaleString('pt-BR') + '</td>'
        + '<td>' + esc(a.usuario || '') + '</td><td>' + esc(_SEC_ACOES[a.action] || a.action) + '</td><td>' + esc(a.alvo || '') + '</td><td style="font-size:.82rem">' + esc(a.detalhe || '') + '</td></tr>').join('')
        : '<tr><td colspan="5" style="text-align:center;padding:24px;color:#888">Nenhum registro ainda.</td></tr>') + '</tbody></table></div>';
  } catch (e) { c.innerHTML = '<div style="color:#b91c1c;padding:12px">Não consegui carregar a auditoria: ' + esc(e.message || String(e)) + '</div>'; }
}

/* ═══════════ DESPACHOS PRODOC (modelo "Texto para responder documentos do PJEDOC – TUCUJURISDOC") ═══════════
   Marcações nos modelos:  {{NOME}} {{OFICIO}} {{ORGAO}} {{PROJETO}} {{UNIDADE}} {{DATA_...}} (vira campo de data)
   {{GERENTE}} vem da configuração · {{G:o monitorado|a monitorada}} troca pelo gênero escolhido · **texto** = negrito. */
const _SEC_ORDEM = 'Com os cordiais cumprimentos, de ordem do gerente da Central de Monitoramento Eletrônico - CME, {{GERENTE}}, ';
const _SEC_MODELOS_PADRAO = [
  { id: 'p01', destino: 'Relatório', titulo: 'Solicita relatório', assunto: 'SOLICITA RELATÓRIO - {{NOME}}',
    texto: _SEC_ORDEM + 'encaminho a decisão judicial sobre {{G:o monitorado|a monitorada}} {{NOME}}, para conhecimento e providências quanto à elaboração de relatório de monitoramento.' },
  { id: 'p02', destino: 'Jurídico', titulo: 'Decisão judicial — retirada de tornozeleira', assunto: 'DECISÃO JUDICIAL - {{NOME}}',
    texto: _SEC_ORDEM + 'encaminho a decisão judicial sobre {{NOME}}, para conhecimento e providências quanto à retirada de tornozeleira.' },
  { id: 'p03', destino: 'Psicossocial', titulo: 'Disponibilização de DPP', assunto: 'DISPONIBILIZAÇÃO DE DPP - {{NOME}}',
    texto: _SEC_ORDEM + 'encaminho a decisão judicial sobre {{NOME}}, para conhecimento e providências quanto à disponibilização de dispositivo **“Botão do Pânico”**.' },
  { id: 'p04', destino: 'Psicossocial', titulo: 'Devolução de DPP', assunto: 'DEVOLUÇÃO DE DPP - {{NOME}}',
    texto: _SEC_ORDEM + 'encaminho a decisão judicial sobre {{NOME}}, para conhecimento e providências quanto à devolução de dispositivo “Botão do Pânico”.' },
  { id: 'p05', destino: 'Plantão', titulo: 'Instalação TNZ — comparecimento espontâneo', assunto: 'INSTALAÇÃO TNZ - {{NOME}} - COMPARECIMENTO ESPONTÂNEO',
    texto: _SEC_ORDEM + 'encaminho a decisão judicial sobre {{NOME}}, que deverá **comparecer espontaneamente** à CME para instalação de tornozeleira eletrônica.' },
  { id: 'p06', destino: 'Plantão', titulo: 'Instalação TNZ — preso(a) em unidade (UFAE)', assunto: 'INSTALAÇÃO TNZ - {{NOME}} – {{UNIDADE}}',
    texto: _SEC_ORDEM + 'encaminho a decisão administrativa da **UFAE** sobre instalação de tornozeleira {{G:no apenado|na apenada}} {{NOME}}, que se encontra {{G:recluso|reclusa}} {{G:no|na}} **{{UNIDADE}}**, para conhecimento e providências.' },
  { id: 'p07', destino: 'Plantão', titulo: 'Atualizar no AKILES — justificativa (ofício)', assunto: 'ATUALIZAR NO AKILES - JUSTIFICATIVA - OFÍCIO Nº {{OFICIO}} - {{ORGAO}}',
    texto: _SEC_ORDEM + 'encaminho o OFÍCIO Nº {{OFICIO}} - {{ORGAO}}, do projeto “{{PROJETO}}”, para que seja realizada a **justificativa** dos apenados no sistema Akiles.' },
  { id: 'p08', destino: 'Plantão', titulo: 'Atualizar no AKILES — desligamento do reeducando', assunto: 'ATUALIZAR NO AKILES - DESLIGAMENTO {{G:DO REEDUCANDO|DA REEDUCANDA}} - {{NOME}}',
    texto: _SEC_ORDEM + 'encaminho o OFÍCIO Nº {{OFICIO}} - {{ORGAO}}, sobre o **desligamento {{G:do monitorado|da monitorada}}** {{NOME}} no {{PROJETO}}, para que seja realizada a atualização das informações no sistema Akiles.' },
  { id: 'p09', destino: 'Plantão', titulo: 'Atualizar no AKILES — inclusão do reeducando', assunto: 'ATUALIZAR NO AKILES – INCLUSÃO {{G:DO REEDUCANDO|DA REEDUCANDA}} - {{NOME}}',
    texto: _SEC_ORDEM + 'encaminho o OFÍCIO Nº {{OFICIO}} - {{ORGAO}}, sobre a inclusão {{G:do reeducando|da reeducanda}} {{NOME}} no **{{PROJETO}}**, para atualização das informações no sistema Akiles.' },
  { id: 'p10', destino: 'Comunicação Processual', titulo: 'Comunicar informações sobre monitorado(a)', assunto: 'COMUNICAR INFORMAÇÕES SOBRE {{G:MONITORADO|MONITORADA}} - {{NOME}}',
    texto: _SEC_ORDEM + 'encaminho as informações sobre {{G:o apenado|a apenada}} {{NOME}}, para que ocorra a **comunicação nos autos do processo**.' },
  { id: 'p11', destino: 'Comunicação Processual', titulo: 'Comunicar descumprimento', assunto: 'COMUNICAR DESCUMPRIMENTO - {{NOME}}',
    texto: _SEC_ORDEM + 'encaminho as informações sobre {{G:o monitorado|a monitorada}} {{NOME}}, para que o **descumprimento** seja comunicado nos autos do processo.' },
  { id: 'p12', destino: 'Comunicação Processual', titulo: 'Não comparecimento — vítima não buscou o DPP', assunto: 'COMUNICAR NÃO COMPARECIMENTO - {{NOME}}',
    texto: _SEC_ORDEM + 'encaminho a decisão judicial sobre {{NOME}}, para que seja comunicado nos autos do processo a impossibilidade de cumprimento, pois a vítima **não compareceu** à CME para recebimento do dispositivo "botão do pânico".' },
  { id: 'p13', destino: 'Comunicação Processual', titulo: 'Impossibilidade — sem monitoração e vítima não compareceu', assunto: 'IMPOSSIBILIDADE DE CUMPRIMENTO - {{NOME}}',
    texto: _SEC_ORDEM + 'encaminho a decisão judicial sobre {{NOME}}, para que seja comunicado nos autos do processo a impossibilidade de cumprimento, pois o requerido **não esteve sob monitoração eletrônica** e a vítima não compareceu à CME para recebimento do dispositivo "botão do pânico".' },
  { id: 'p14', destino: 'Comunicação Processual', titulo: 'Impossibilidade — tornozeleira já retirada', assunto: 'IMPOSSIBILIDADE DE CUMPRIMENTO - {{NOME}}',
    texto: _SEC_ORDEM + 'encaminho a decisão judicial sobre {{NOME}}, para que seja comunicado nos autos do processo que a retirada de tornozeleira ocorreu dia {{DATA_RETIRADA}} conforme decisão judicial, e a devida comunicação também já foi realizada em {{DATA_COMUNICACAO}}.' },
];
const _SEC_ROTULOS = { NOME: 'Nome do(a) monitorado(a)', OFICIO: 'Nº do ofício (ex.: 253/2025)', ORGAO: 'Órgão (ex.: CCEP, PREFEITURA DE SANTANA)',
  PROJETO: 'Projeto (ex.: Liberdade e Cidadania)', UNIDADE: 'Unidade (ex.: PRÉDIO ANEXO, PENITENCIÁRIA FEMININA)',
  DATA_RETIRADA: 'Data da retirada', DATA_COMUNICACAO: 'Data da comunicação' };
const _SEC_GERENTE_PADRAO = 'Everton Nunes Costa';

function _secModelos(d) { return (d || _secDados()).modelos || _SEC_MODELOS_PADRAO; }
function _secGerente(d) { return ((d || _secDados()).config || {}).gerente || _SEC_GERENTE_PADRAO; }
function _secCamposDe(m) {
  const set = new Set();
  String(m.assunto + ' ' + m.texto).replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_, k) => { if (k !== 'GERENTE') set.add(k); return ''; });
  return [...set];
}
function _secRotulo(k) { return _SEC_ROTULOS[k] || (k.charAt(0) + k.slice(1).toLowerCase()).replace(/_/g, ' '); }
function _secUsaGenero(m) { return /\{\{G:/.test(m.assunto + m.texto); }
// Preenche o modelo. html=true devolve com <b> e HTML escapado; senão texto puro.
function _secPreencher(tpl, vals, genero, gerente, html) {
  let s = String(tpl || '').replace(/\{\{G:([^|}]*)\|([^}]*)\}\}/g, (_, m, f) => genero === 'F' ? f : m);
  s = s.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (_, k) => k === 'GERENTE' ? gerente : (vals[k] || '[' + k + ']'));
  return html ? esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>') : s.replace(/\*\*(.+?)\*\*/g, '$1');
}

function sec_renderDespachos() {
  const c = document.getElementById('sec-conteudo'); if (!c) return;
  const d = _secDados(), mods = _secModelos(d);
  if (!_secModeloId || !mods.some(m => m.id === _secModeloId)) _secModeloId = mods[0] && mods[0].id;
  const busca = (document.getElementById('sec-dp-busca')?.value || '').toLowerCase().trim();
  const grupos = {};
  mods.filter(m => !busca || (m.destino + ' ' + m.titulo + ' ' + m.assunto).toLowerCase().includes(busca)).forEach(m => { (grupos[m.destino] = grupos[m.destino] || []).push(m); });
  c.innerHTML = '<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start">'
    + '<div style="flex:0 1 300px;min-width:240px"><input id="sec-dp-busca" placeholder="Buscar modelo" value="' + esc(busca) + '" oninput="sec_renderDespachos()" style="width:100%;padding:6px 10px;margin-bottom:8px">'
    + Object.keys(grupos).map(g => '<div style="font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin:10px 0 4px">PRODOC para ' + esc(g) + '</div>'
      + grupos[g].map(m => '<div onclick="_secModeloId=\'' + m.id + '\';sec_renderDespachos()" style="cursor:pointer;padding:7px 10px;border-radius:4px;margin-bottom:3px;font-size:.88rem;'
        + (m.id === _secModeloId ? 'background:#dbeafe;border-left:3px solid #2563eb;font-weight:600' : 'background:#f8fafc;border-left:3px solid transparent') + '">' + esc(m.titulo) + '</div>').join('')).join('')
    + '<div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap"><button class="btn-primary" onclick="sec_editarModelo()">+ Novo modelo</button>'
    + '<button class="btn-secondary" onclick="sec_configGerente()">Gerente: ' + esc(_secGerente(d)) + '</button></div></div>'
    + '<div id="sec-dp-form" style="flex:1 1 440px;min-width:0"></div></div>';
  const b = document.getElementById('sec-dp-busca'); if (b && busca) { b.focus(); b.setSelectionRange(busca.length, busca.length); }
  _secRenderFormDespacho();
}
function _secNomesConhecidos() {
  const nomes = new Set();
  try { (getSemCom().monitorados || []).forEach(m => m.nome && nomes.add(m.nome)); } catch (e) {}
  try { (getOcorrencias() || []).forEach(o => o.monitorado && nomes.add(String(o.monitorado).trim())); } catch (e) {}
  return [...nomes].sort().slice(0, 3000);
}
function _secRenderFormDespacho() {
  const box = document.getElementById('sec-dp-form'); if (!box) return;
  const m = _secModelos().find(x => x.id === _secModeloId);
  if (!m) { box.innerHTML = '<div style="color:#888;padding:20px">Nenhum modelo.</div>'; return; }
  const campos = _secCamposDe(m);
  box.innerHTML = '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:14px 16px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><div><div style="font-size:.75rem;color:#64748b">PRODOC PARA ' + esc(String(m.destino).toUpperCase()) + '</div>'
    + '<div style="font-weight:700;font-size:1.02rem">' + esc(m.titulo) + '</div></div>'
    + '<div style="display:flex;gap:6px"><button class="btn-sm btn-outline" onclick="sec_editarModelo(\'' + m.id + '\')">Editar modelo</button>'
    + '<button class="btn-sm btn-outline" style="color:#b91c1c" onclick="sec_excluirModelo(\'' + m.id + '\')">Excluir</button></div></div>'
    + '<div class="form-grid" style="margin-top:10px">'
    + campos.map(k => /^DATA/.test(k)
      ? _secCampo('sec-dp-' + k, _secRotulo(k), '', 'type="date" oninput="_secPrevDespacho()"')
      : _secCampo('sec-dp-' + k, _secRotulo(k), '', (k === 'NOME' ? 'list="sec-dp-nomes" ' : '') + 'oninput="_secPrevDespacho()" style="text-transform:uppercase"')).join('')
    + '</div>' + (campos.includes('NOME') ? '<datalist id="sec-dp-nomes">' + _secNomesConhecidos().map(n => '<option>' + esc(n) + '</option>').join('') + '</datalist>' : '')
    + (_secUsaGenero(m) ? '<div class="form-field"><label>Gênero</label>' + _secChips('sec-dp-genero', [['M', 'Masculino'], ['F', 'Feminino']], 'M') + '</div>' : '')
    + '<div style="margin-top:12px;font-size:.75rem;font-weight:700;color:#64748b">ASSUNTO</div>'
    + '<div id="sec-dp-prev-assunto" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:8px 10px;font-weight:600"></div>'
    + '<div style="margin-top:10px;font-size:.75rem;font-weight:700;color:#64748b">TEXTO</div>'
    + '<div id="sec-dp-prev-texto" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:10px 12px;line-height:1.55;text-align:justify"></div>'
    + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap">'
    + '<button class="btn-secondary" onclick="sec_copiarDespacho(\'assunto\')">Copiar assunto</button>'
    + '<button class="btn-primary" onclick="sec_copiarDespacho(\'texto\')">Copiar texto</button></div></div>';
  document.querySelectorAll('[data-grupo="sec-dp-genero"]').forEach(btn => btn.addEventListener('click', () => setTimeout(_secPrevDespacho, 0)));
  _secPrevDespacho();
}
function _secValoresDespacho(m) {
  const vals = {};
  _secCamposDe(m).forEach(k => { const v = _secVal('sec-dp-' + k); vals[k] = /^DATA/.test(k) ? _secBR(v) : v.toUpperCase(); });
  return vals;
}
function _secPrevDespacho() {
  const m = _secModelos().find(x => x.id === _secModeloId); if (!m) return;
  const vals = _secValoresDespacho(m), g = _secVal('sec-dp-genero') || 'M', ger = _secGerente();
  const a = document.getElementById('sec-dp-prev-assunto'), t = document.getElementById('sec-dp-prev-texto');
  if (a) a.innerHTML = 'ASSUNTO: ' + _secPreencher(m.assunto, vals, g, ger, true);
  if (t) t.innerHTML = _secPreencher(m.texto, vals, g, ger, true);
}
async function sec_copiarDespacho(qual) {
  const m = _secModelos().find(x => x.id === _secModeloId); if (!m) return;
  const vals = _secValoresDespacho(m);
  const falta = Object.keys(vals).filter(k => !vals[k]);
  if (falta.length) { _mostrarToast('Preencha: ' + falta.map(_secRotulo).join(', '), 'erro'); return; }
  const g = _secVal('sec-dp-genero') || 'M', ger = _secGerente(), tpl = qual === 'assunto' ? m.assunto : m.texto;
  const puro = _secPreencher(tpl, vals, g, ger, false), html = _secPreencher(tpl, vals, g, ger, true);
  try {
    if (window.ClipboardItem && qual === 'texto') await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([puro], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) })]);
    else await navigator.clipboard.writeText(puro);
    _mostrarToast((qual === 'assunto' ? 'Assunto' : 'Texto') + ' copiado — cole no PRODOC (Ctrl+V).', 'sucesso');
  } catch (e) { _mostrarToast('Não consegui copiar automaticamente — selecione o texto e use Ctrl+C.', 'erro'); }
  if (qual === 'texto') auditar({ modulo: 'Secretaria', action: 'sec_despacho_copiar', alvo: _secPreencher(m.assunto, vals, g, ger, false), detalhe: 'PRODOC para ' + m.destino });
}

// ── Criar / editar modelos ────────────────────────────────────────────────────
function sec_editarModelo(id) {
  const m = id ? (_secModelos().find(x => x.id === id) || {}) : { destino: '', titulo: '', assunto: '', texto: _SEC_ORDEM + 'encaminho ' };
  const destinos = [...new Set(_secModelos().map(x => x.destino))];
  _secModal(id ? 'Editar modelo' : 'Novo modelo de despacho',
    '<div class="form-grid">' + _secCampo('sec-md-destino', 'PRODOC para (setor)', m.destino, 'list="sec-md-destinos"') + _secCampo('sec-md-titulo', 'Nome do modelo (aparece na lista)', m.titulo) + '</div>'
    + '<datalist id="sec-md-destinos">' + destinos.map(x => '<option>' + esc(x) + '</option>').join('') + '</datalist>'
    + _secCampo('sec-md-assunto', 'Assunto', m.assunto, 'placeholder="Ex.: SOLICITA RELATÓRIO - {{NOME}}"')
    + '<div class="form-field"><label>Texto</label><textarea id="sec-md-texto" rows="7">' + esc(m.texto || '') + '</textarea></div>'
    + '<div style="font-size:.8rem;color:#475569;background:#f8fafc;border-radius:6px;padding:8px 10px;line-height:1.6">'
    + '<b>Campos:</b> escreva entre chaves duplas e o sistema cria o campo para preencher — <code>{{NOME}}</code>, <code>{{OFICIO}}</code>, <code>{{ORGAO}}</code>, <code>{{PROJETO}}</code>, <code>{{UNIDADE}}</code> ou qualquer outro nome em MAIÚSCULAS. '
    + 'Nomes começando com <code>DATA</code> viram campo de data. <code>{{GERENTE}}</code> entra sozinho.<br>'
    + '<b>Gênero:</b> <code>{{G:o monitorado|a monitorada}}</code> troca conforme o botão Masculino/Feminino. <b>Negrito:</b> <code>**texto**</code>.</div>',
    '<button class="btn-primary" onclick="sec_salvarModelo(\'' + (id || '') + '\')">Salvar modelo</button>', 760);
}
async function sec_salvarModelo(id) {
  const v = { destino: _secVal('sec-md-destino'), titulo: _secVal('sec-md-titulo'), assunto: _secVal('sec-md-assunto'), texto: _secVal('sec-md-texto') };
  if (!v.destino || !v.titulo || !v.assunto || !v.texto) { _mostrarToast('Preencha setor, nome, assunto e texto.', 'erro'); return; }
  const tudo = v.assunto + v.texto;
  if (tudo.split('{{').length !== tudo.split('}}').length) { _mostrarToast('Confira as chaves {{ }}: há uma aberta sem fechar.', 'erro'); return; }
  let novoId = id;
  const ok = await _secMutar(d => {
    if (!d.modelos) d.modelos = JSON.parse(JSON.stringify(_SEC_MODELOS_PADRAO));
    if (id) { const m = d.modelos.find(x => x.id === id); if (!m) return false; Object.assign(m, v, { editadoPor: usuarioAtual ? usuarioAtual.nome : '', editadoEm: new Date().toISOString() }); }
    else { novoId = _secId('mod'); d.modelos.push(Object.assign({ id: novoId, criadoPor: usuarioAtual ? usuarioAtual.nome : '', criadoEm: new Date().toISOString() }, v)); }
  }, { action: id ? 'sec_modelo_editar' : 'sec_modelo_criar', alvo: v.titulo, detalhe: 'PRODOC para ' + v.destino });
  if (!ok) return;
  _secModeloId = novoId; _secFecharModal(); _mostrarToast('Modelo salvo.', 'sucesso'); sec_renderDespachos();
}
async function sec_excluirModelo(id) {
  const m = _secModelos().find(x => x.id === id); if (!m) return;
  if (!confirm('Excluir o modelo "' + m.titulo + '"? (fica guardado na lixeira da Secretaria)')) return;
  const ok = await _secMutar(d => {
    if (!d.modelos) d.modelos = JSON.parse(JSON.stringify(_SEC_MODELOS_PADRAO));
    const i = d.modelos.findIndex(x => x.id === id); if (i < 0) return false;
    _secParaLixeira(d, 'modelo', d.modelos[i]); d.modelos.splice(i, 1);
  }, { action: 'sec_modelo_excluir', alvo: m.titulo });
  if (ok) { _secModeloId = null; sec_renderDespachos(); }
}
function sec_configGerente() {
  _secModal('Nome do gerente nos despachos', _secCampo('sec-cfg-gerente', 'Gerente da CME (entra em {{GERENTE}})', _secGerente()),
    '<button class="btn-primary" onclick="sec_salvarGerente()">Salvar</button>', 480);
}
async function sec_salvarGerente() {
  const g = _secVal('sec-cfg-gerente'); if (g.length < 5) { _mostrarToast('Informe o nome do gerente.', 'erro'); return; }
  const ok = await _secMutar(d => { d.config = Object.assign({}, d.config, { gerente: g }); }, { action: 'sec_config_gerente', alvo: g });
  if (ok) { _secFecharModal(); sec_renderDespachos(); }
}
Object.assign(_SEC_ACOES, { sec_despacho_copiar: 'Copiou despacho PRODOC', sec_modelo_criar: 'Criou modelo', sec_modelo_editar: 'Editou modelo',
  sec_modelo_excluir: 'Excluiu modelo', sec_config_gerente: 'Alterou o nome do gerente' });
