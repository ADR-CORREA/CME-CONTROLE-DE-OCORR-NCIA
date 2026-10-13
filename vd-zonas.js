/* ═══════════════════════════ GERÊNCIA — VD SEM ZONA DE EXCLUSÃO ═══════════════════════════
   Monitorados de violência doméstica com tornozeleira ativa que NÃO têm zona de exclusão cadastrada
   no AKILES, com o servidor que fez a instalação. Atualizado todo dia de manhã pelo robô
   (atualizar-plantoes.js → vd-zonas-akiles.js, só leitura no AKILES), junto com a análise da troca
   de plantão; vem dentro de cme_plantao_auto (o banco só entrega à gerência e ao administrador).
   Só leitura. Emojis só por \u{...}. Prefixo _vdz. */

let _vdzBusca = '', _vdzInst = '', _vdzSit = '';

function _vdzDados() { const d = carregarStore('plantao_auto', null); return d && d.vdSemExclusao ? d.vdSemExclusao : null; }
function _vdzBR(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : '—'; }
function _vdzInstalador(x) { return x.instNome || (x.inst ? 'operador nº ' + x.inst : 'não informado'); }
function _vdzNorm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function _vdzFiltrar(lista) {
  const q = _vdzNorm(_vdzBusca).trim();
  return lista.filter(x => (!_vdzInst || _vdzInstalador(x) === _vdzInst) && (!_vdzSit || (_vdzSit === 'nenhuma' ? !x.zonas : x.zonas > 0))
    && (!q || _vdzNorm(x.nome + ' ' + x.reg + ' ' + (x.comarca || '') + ' ' + _vdzInstalador(x)).includes(q)));
}

function vdz_render() {
  const box = document.getElementById('vdz-corpo'); if (!box) return;
  if (!['admin', 'gerencia'].includes(usuarioAtual?.nivel)) { box.innerHTML = '<div style="padding:30px;text-align:center;color:#64748b">Acesso restrito à Gerência.</div>'; return; }
  const r = _vdzDados();
  if (!r) { box.innerHTML = '<div style="padding:30px;text-align:center;color:#64748b">Aguardando a 1ª coleta do robô (todo dia às 08h10, junto com a análise da troca de plantão).</div>'; return; }
  const lista = r.lista || [], nenhuma = lista.filter(x => !x.zonas).length, soInc = lista.length - nenhuma;
  const hoje = String(r.geradoEm).slice(0, 10), novos = lista.filter(x => x.semZonaDesde === hoje && x.semZonaDesde !== (lista.reduce((m, y) => y.semZonaDesde < m ? y.semZonaDesde : m, hoje))).length;
  const porInst = {}; lista.forEach(x => { const k = _vdzInstalador(x); porInst[k] = (porInst[k] || 0) + 1; });
  const ranking = Object.entries(porInst).sort((a, b) => b[1] - a[1]);
  const pct = r.totalVd ? Math.round(lista.length / r.totalVd * 100) : 0;
  box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
    + '<div style="font-size:.8rem;color:#64748b">Atualizado em ' + new Date(r.geradoEm).toLocaleString('pt-BR') + ' · todo dia de manhã (junto com a análise da troca de plantão) · consulta só de leitura no AKILES</div>'
    + '<button class="btn-secondary" onclick="vdz_exportar()">\u{1F4E5} Exportar Excel</button></div>'
    + '<div style="font-size:1rem;line-height:1.5;padding:12px 16px;background:#fef2f2;border-left:4px solid #dc2626;border-radius:4px;margin-bottom:12px">'
    + '<b style="color:#b91c1c;font-size:1.3rem">' + lista.length + '</b> de ' + r.totalVd + ' monitorados de violência doméstica com tornozeleira (<b>' + pct + '%</b>) estão <b>sem zona de exclusão</b> cadastrada no AKILES: '
    + '<b>' + nenhuma + '</b> sem nenhuma zona e <b>' + soInc + '</b> só com zona de inclusão.'
    + (novos ? ' <b style="color:#b91c1c">' + novos + ' entraram na lista hoje.</b>' : '')
    + (r.falhas ? '<div style="font-size:.78rem;color:#b45309;margin-top:4px">\u{26A0}\u{FE0F} ' + r.falhas + ' monitorado(s) não puderam ser conferidos nesta coleta.</div>' : '') + '</div>'
    + '<div style="font-weight:700;margin-bottom:4px">Por servidor que fez a instalação <span style="font-weight:400;font-size:.75rem;color:#64748b">— clique para filtrar</span></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + ranking.map(([k, n]) => '<button type="button" onclick="_vdzInst=' + (_vdzInst === k ? '\'\'' : '\'' + esc(k).replace(/'/g, '') + '\'') + ';vdz_render()" style="padding:4px 10px;border-radius:4px;cursor:pointer;font-size:.8rem;border:1px solid '
      + (_vdzInst === k ? '#dc2626;background:#fee2e2;font-weight:600;box-shadow:inset 2px 0 0 #dc2626' : '#cbd5e1;background:#fff') + '">' + esc(k) + ' <b style="color:#b91c1c">' + n + '</b></button>').join('') + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><input id="vdz-busca" value="' + esc(_vdzBusca) + '" oninput="_vdzBusca=this.value;_vdzRenderTabela()" placeholder="Buscar por nome, registro, comarca ou servidor…" style="flex:1;min-width:240px;padding:7px 10px">'
    + '<select onchange="_vdzSit=this.value;_vdzRenderTabela()" style="padding:6px 8px"><option value="">Todas as situações</option><option value="nenhuma"' + (_vdzSit === 'nenhuma' ? ' selected' : '') + '>Sem nenhuma zona</option><option value="inclusao"' + (_vdzSit === 'inclusao' ? ' selected' : '') + '>Só zona de inclusão</option></select></div>'
    + '<div id="vdz-tabela"></div>';
  _vdzRenderTabela();
}
function _vdzRenderTabela() {
  const el = document.getElementById('vdz-tabela'), r = _vdzDados(); if (!el || !r) return;
  const lista = _vdzFiltrar(r.lista || []);
  const td = (v, s) => '<td style="padding:6px;' + (s || '') + '">' + v + '</td>';
  el.innerHTML = '<div style="font-size:.78rem;color:#64748b;margin-bottom:4px">' + lista.length + ' monitorado(s)</div>'
    + '<div class="table-scroll"><table class="data-table"><thead><tr><th>Monitorado</th><th>Registro</th><th>Comarca</th><th>Situação</th><th>Instalado por</th><th>Monitorado desde</th><th>Na lista desde</th></tr></thead><tbody>'
    + (lista.length ? lista.map(x => '<tr>' + td('<b>' + esc(x.nome) + '</b><div style="font-size:.72rem;color:#64748b">' + esc(x.grupo) + '</div>')
        + td(esc(x.reg), 'font-family:var(--font-mono)') + td(esc(x.comarca || '—'), 'font-size:.82rem')
        + td(x.zonas ? '<span style="font-size:.72rem;font-weight:600;padding:2px 7px;border-radius:3px;border-left:2px solid #d97706;background:#fef3c7;color:#b45309">SÓ INCLUSÃO (' + x.inclusao + ')</span>'
          : '<span style="font-size:.72rem;font-weight:600;padding:2px 7px;border-radius:3px;border-left:2px solid #dc2626;background:#fee2e2;color:#b91c1c">SEM NENHUMA ZONA</span>')
        + td(esc(_vdzInstalador(x)) + (!x.instNome && x.inst ? '<div style="font-size:.7rem;color:#94a3b8">operador antigo/inativo</div>' : ''))
        + td(_vdzBR(x.desde), 'font-family:var(--font-mono);font-size:.82rem') + td(_vdzBR(x.semZonaDesde), 'font-family:var(--font-mono);font-size:.82rem') + '</tr>').join('')
      : '<tr><td colspan="7" style="text-align:center;padding:24px;color:#888">Nenhum monitorado com esse filtro.</td></tr>')
    + '</tbody></table></div>';
}
function vdz_exportar() {
  const r = _vdzDados(); if (!r) return;
  const rows = _vdzFiltrar(r.lista || []).map(x => ({ 'Monitorado': x.nome, 'Registro': x.reg, 'Comarca': x.comarca || '', 'Grupo': x.grupo, 'Situação': x.zonas ? 'Só zona de inclusão (' + x.inclusao + ')' : 'Sem nenhuma zona',
    'Instalado por': _vdzInstalador(x), 'Monitorado desde': _vdzBR(x.desde), 'Na lista desde': _vdzBR(x.semZonaDesde) }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'VD sem zona de exclusão');
  XLSX.writeFile(wb, 'VD_sem_zona_de_exclusao_' + String(r.geradoEm).slice(0, 10) + '.xlsx');
  try { auditar({ modulo: 'Gerência', action: 'vdz_exportar', alvo: rows.length + ' monitorado(s)' }); } catch (e) {}
}
