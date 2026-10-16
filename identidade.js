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
