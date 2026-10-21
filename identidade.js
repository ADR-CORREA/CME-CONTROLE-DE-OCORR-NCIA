/* ═══════════════════════════ IDENTIDADE VISUAL DO CME — funções comuns ═══════════════════════════
   Par do identidade.css (guia de 16/10/2026). Prefixo idv. Emojis só por \u{...}. */

// situação da ocorrência (texto com emoji de calcStatus) → etiqueta do guia, sem emoji
const _IDV_SIT = {
  '\u{1F534} VENCIDO': ['cr', 'Vencido'], '\u{1F7E0} VENCENDO': ['at', 'Vencendo'], '\u{1F7E1} ATENÇÃO': ['at', 'Atenção'],
  '\u{1F7E2} NO PRAZO': ['ok', 'No prazo'], '\u{2705} COMUNICADO': ['in', 'Comunicado'], '\u{2705} RESTABELECIDA': ['ok', 'Restabelecida'],
};
function idv_sit(status) { return _IDV_SIT[status] || ['ne', String(status || '—').replace(/^[^\wÀ-ú]+\s*/u, '') || '—']; }
function idv_etiqueta(status) { const [c, r] = idv_sit(status); return '<span class="idv-etq ' + c + '">' + r + '</span>'; }

/* Menu flutuante ("⋯" da linha ou "Mais ▾"): itens = [[rótulo, códigoOnclick, perigo?], …] ou 'hr' para separar.
   O código vem SEMPRE de dentro do sistema (índices numéricos), nunca de texto digitado. */
function idv_menu(ev, itens) {
  ev.stopPropagation();
  idv_fecharMenu();
  const btn = ev.currentTarget, r = btn.getBoundingClientRect();
  const m = document.createElement('div');
  m.className = 'idv-menu'; m.id = 'idv-menu-aberto'; m.setAttribute('role', 'menu');
  m.innerHTML = itens.map(it => it === 'hr' ? '<hr>' : '<button type="button" role="menuitem"' + (it[2] ? ' class="perigo"' : '') + ' onclick="idv_fecharMenu();' + it[1] + '">' + it[0] + '</button>').join('');
  document.body.appendChild(m);
  const w = m.offsetWidth, h = m.offsetHeight;
  m.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px';
  m.style.top = (r.bottom + 4 + h > innerHeight ? Math.max(8, r.top - h - 4) : r.bottom + 4) + 'px';
  const primeiro = m.querySelector('button'); if (primeiro) primeiro.focus();
}
function idv_fecharMenu() { const m = document.getElementById('idv-menu-aberto'); if (m) m.remove(); }
document.addEventListener('click', e => { if (!e.target.closest('#idv-menu-aberto')) idv_fecharMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') idv_fecharMenu(); });
window.addEventListener('scroll', idv_fecharMenu, true);
// detalhe embaixo da etiqueta: "VENCIDO há 7d 0h" → "venceu há 7d 0h" (a etiqueta já diz "Vencido")
function idv_prazoTxt(pr) { return String(pr || '').replace(/^VENCIDO há/i, 'venceu há'); }

/* Menu lateral (20/10/2026, decisão 5 do novo visual): recolhe para só ícones; a escolha fica guardada neste computador.
   Sem escolha guardada: recolhido em tela abaixo de 1440 px (notebook), aberto nas maiores. Até 900 px vira gaveta. */
const _IDV_MENU_CHAVE = 'cme_menu_lateral';
function _idvMenuEstreito() { return window.innerWidth <= 900; }
function _idvMenuAplicar() {
  let pref = null; try { pref = localStorage.getItem(_IDV_MENU_CHAVE); } catch (e) {}
  const recolher = pref ? pref === 'recolhido' : window.innerWidth < 1440;
  document.body.classList.toggle('menu-recolhido', recolher);
  const b = document.getElementById('btn-menu'), aberto = _idvMenuEstreito() ? document.body.classList.contains('menu-aberto-movel') : !recolher;
  if (b) { b.setAttribute('aria-expanded', aberto ? 'true' : 'false'); b.setAttribute('aria-label', aberto ? 'Recolher o menu' : 'Abrir o menu'); }
  // no modo recolhido o nome da aba aparece ao passar o mouse
  document.querySelectorAll('#cme-menu .nav-tab').forEach(t => { if (!t.title) t.title = (t.textContent || '').trim(); });
}
function idv_alternarMenu() {
  if (_idvMenuEstreito()) { document.body.classList.toggle('menu-aberto-movel'); _idvMenuAplicar(); return; }
  const recolher = !document.body.classList.contains('menu-recolhido');
  try { localStorage.setItem(_IDV_MENU_CHAVE, recolher ? 'recolhido' : 'aberto'); } catch (e) {}
  _idvMenuAplicar();
}
// na gaveta (tela estreita), escolher uma aba fecha a gaveta
document.addEventListener('click', e => {
  if (!document.body.classList.contains('menu-aberto-movel')) return;
  if (e.target.closest('#cme-menu .nav-tab') || (!e.target.closest('#cme-menu') && !e.target.closest('#btn-menu'))) { document.body.classList.remove('menu-aberto-movel'); _idvMenuAplicar(); }
});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _idvMenuAplicar); else _idvMenuAplicar();

/* Linha do achado (20/10/2026, novo visual): embaixo do título da tela, o fato que pede ação, com o número em vermelho.
   Ex.: "6 vencidas — a mais antiga venceu há 3d 2h (Rompimento / Integridade, plantão ALFA) · 9 perto de vencer · 47 ativas".
   Recebe as ocorrências ativas (sem as arquivadas); usa calcStatus/getSLA/calcPrazoRestante do index.html. */
function idv_achadoOcorrencias(ocs) {
  const agora = Date.now(), ativas = (ocs || []).filter(o => !o.arquivadaPorComunicacao);
  let perto = 0; const venc = [];
  ativas.forEach(o => {
    const c = idv_sit(calcStatus(o.dataAlerta, o.tipo, o.medida, o.prodoc, o.restabelecidaEm))[0];
    if (c === 'cr') { const sla = getSLA(o.tipo, o.medida); venc.push({ o, estouro: (agora - new Date(o.dataAlerta)) / 3600000 - (sla ? sla.h : 0) }); }
    else if (c === 'at') perto++;
  });
  const pl = (n, s, p) => n + ' ' + (n === 1 ? s : p);
  const resto = '<span class="idv-sec">' + (perto ? ' · ' + pl(perto, 'perto de vencer', 'perto de vencer') : '') + ' · ' + pl(ativas.length, 'ativa', 'ativas') + '</span>';
  if (!venc.length) return '<span>Nenhuma vencida</span>' + resto;
  venc.sort((a, b) => b.estouro - a.estouro);
  const v = venc[0].o, ha = String(calcPrazoRestante(v.dataAlerta, v.tipo, v.medida)).replace(/^VENCIDO há\s*/i, '');
  const det = [v.tipo, v.plantao ? 'plantão ' + v.plantao : '', v.prodoc === 'SIM' ? '' : 'sem PRODOC'].filter(Boolean).map(x => esc(String(x))).join(', ');
  return '<b class="cr">' + pl(venc.length, 'vencida', 'vencidas') + '</b> — a mais antiga venceu há <b class="cr idv-data">' + esc(ha) + '</b>'
    + (det ? ' <span class="idv-sec">(' + det + ')</span>' : '') + resto;
}
