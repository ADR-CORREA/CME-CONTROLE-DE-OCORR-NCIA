/* ═══════════════════════════ GERÊNCIA — VD SEM ZONA DE EXCLUSÃO ═══════════════════════════
   Monitorados de violência doméstica ATIVOS com tornozeleira vinculada (a DPP da vítima fica de fora)
   que NÃO têm zona de exclusão cadastrada
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
  if (!['admin', 'gerencia'].includes(usuarioAtual?.nivel)) { box.innerHTML = '<div class="idv-vazio">Acesso restrito à Gerência.</div>'; return; }
  const r = _vdzDados();
  if (!r) { box.innerHTML = '<div class="idv-vazio">Aguardando a 1ª coleta do robô (todo dia às 08h10, junto com a análise da troca de plantão).</div>'; return; }
  const lista = r.lista || [], nenhuma = lista.filter(x => !x.zonas).length, soInc = lista.length - nenhuma;
  const hoje = String(r.geradoEm).slice(0, 10), novos = lista.filter(x => x.semZonaDesde === hoje && x.semZonaDesde !== (lista.reduce((m, y) => y.semZonaDesde < m ? y.semZonaDesde : m, hoje))).length;
  const porInst = {}; lista.forEach(x => { const k = _vdzInstalador(x); porInst[k] = (porInst[k] || 0) + 1; });
  const ranking = Object.entries(porInst).sort((a, b) => b[1] - a[1]);
  const pct = r.totalVd ? Math.round(lista.length / r.totalVd * 100) : 0;
  box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
    + '<div style="font-size:13px;color:var(--idv-sec)">Atualizado em <span class="idv-data">' + new Date(r.geradoEm).toLocaleString('pt-BR') + '</span> · a lista é refeita <b>todo dia de manhã</b> (junto com a análise da troca de plantão): quem tiver a zona de exclusão cadastrada no AKILES <b>sai da lista</b> na atualização seguinte · consulta só de leitura</div>'
    + '<button class="btn-secondary" onclick="vdz_exportar()">\u{1F4E5} Exportar Excel</button></div>'
    + '<div class="idv-faixa cr" style="display:block;line-height:1.5;margin-bottom:12px">'
    + '<b class="idv-data" style="color:var(--idv-cr);font-size:20px;font-weight:600">' + lista.length + '</b> de ' + r.totalVd + ' monitorados de violência doméstica <b>ativos com tornozeleira</b> (<b>' + pct + '%</b>) estão <b>sem zona de exclusão</b> cadastrada no AKILES: '
    + '<b>' + nenhuma + '</b> sem nenhuma zona e <b>' + soInc + '</b> só com zona de inclusão.'
    + (novos ? ' <b style="color:var(--idv-cr);font-weight:600">' + novos + ' entraram na lista hoje.</b>' : '')
    + (r.falhas ? '<div style="font-size:13px;color:var(--idv-at);margin-top:4px">\u{26A0}\u{FE0F} ' + r.falhas + ' monitorado(s) não puderam ser conferidos nesta coleta.</div>' : '') + '</div>'
    + '<div style="font-size:14px;font-weight:600;margin-bottom:6px">Por servidor que fez a instalação <span style="font-weight:400;font-size:12px;color:var(--idv-sec)">— clique para filtrar</span></div>'
    + '<div class="idv-chips" style="margin-bottom:12px">' + ranking.map(([k, n]) => '<button type="button" class="idv-chip' + (_vdzInst === k ? ' ativo' : '') + '" onclick="_vdzInst=' + (_vdzInst === k ? '\'\'' : '\'' + _jsq(k) + '\'') + ';vdz_render()">'
      + esc(k) + ' <span class="idv-n">' + n + '</span></button>').join('') + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><div class="idv-busca" style="flex:1;min-width:240px"><input id="vdz-busca" value="' + esc(_vdzBusca) + '" oninput="_vdzBusca=this.value;_vdzRenderTabela()" placeholder="Buscar por nome, registro, comarca ou servidor…"></div>'
    + '<select class="idv-select" onchange="_vdzSit=this.value;_vdzRenderTabela()"><option value="">Todas as situações</option><option value="nenhuma"' + (_vdzSit === 'nenhuma' ? ' selected' : '') + '>Sem nenhuma zona</option><option value="inclusao"' + (_vdzSit === 'inclusao' ? ' selected' : '') + '>Só zona de inclusão</option></select></div>'
    + '<div id="vdz-tabela"></div>' + _vdzHtmlSaidas(r);
  _vdzRenderTabela();
}
function _vdzRenderTabela() {
  const el = document.getElementById('vdz-tabela'), r = _vdzDados(); if (!el || !r) return;
  const lista = _vdzFiltrar(r.lista || []);
  const td = (v, s) => '<td style="' + (s || '') + '">' + v + '</td>';
  el.innerHTML = '<div class="idv-data" style="font-size:13px;color:var(--idv-sec);margin-bottom:6px">' + lista.length + ' monitorado(s)</div>'
    + '<div class="table-scroll"><table class="data-table idv-tabela"><thead><tr><th>Monitorado</th><th>Registro</th><th>Comarca</th><th>Situação</th><th>Instalado por</th><th>Monitorado desde</th><th>Na lista desde</th></tr></thead><tbody>'
    + (lista.length ? lista.map(x => '<tr>' + td('<div class="idv-nome">' + esc(x.nome) + '</div><div class="idv-mini">' + esc(x.grupo) + '</div>')
        + td('<span class="idv-mono">' + esc(x.reg) + '</span>') + td(esc(x.comarca || '—'))
        + td(x.zonas ? '<span class="idv-etq at">SÓ INCLUSÃO (' + x.inclusao + ')</span>'
          : '<span class="idv-etq cr">SEM NENHUMA ZONA</span>')
        + td(esc(_vdzInstalador(x)) + (!x.instNome && x.inst ? '<div class="idv-mini">operador antigo/inativo</div>' : '') + (x.naoConferido ? '<div class="idv-mini" style="color:var(--idv-at)">não conferido hoje (consulta falhou)</div>' : ''))
        + td('<span class="idv-data">' + _vdzBR(x.desde) + '</span>', 'white-space:nowrap') + td('<span class="idv-data">' + _vdzBR(x.semZonaDesde) + '</span>', 'white-space:nowrap') + '</tr>').join('')
      : '<tr><td colspan="7" class="idv-vazio">Nenhum monitorado com esse filtro.</td></tr>')
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

// Quem saiu da lista nos últimos 30 dias (zona cadastrada × deixou de estar ativo)
function _vdzHtmlSaidas(r) {
  const lim = _isoLocal(new Date(Date.now() - 30 * 864e5));
  const s = (r.saidas || []).filter(x => x.dia >= lim).sort((a, b) => b.dia.localeCompare(a.dia));
  const zona = s.filter(x => x.motivo === 'zona').length, inat = s.length - zona;
  const td = (v, st) => '<td style="' + (st || '') + '">' + v + '</td>';
  return '<details style="margin-top:16px;border-top:1px solid var(--idv-linha);padding-top:12px"' + (s.length ? '' : '') + '><summary style="cursor:pointer;font-size:14px;font-weight:600;color:var(--idv-ok)">\u{2705} Saíram da lista nos últimos 30 dias: ' + s.length
    + (s.length ? ' <span style="font-weight:400;color:var(--idv-sec)">(' + zona + ' com zona de exclusão cadastrada · ' + inat + ' deixaram de estar ativos)</span>' : ' <span style="font-weight:400;color:var(--idv-sec)">— começa a contar a partir de 14/10/2026</span>') + '</summary>'
    + (s.length ? '<div class="table-scroll" style="margin-top:8px"><table class="data-table idv-tabela"><thead><tr><th>Saiu em</th><th>Monitorado</th><th>Registro</th><th>Motivo</th><th>Instalado por</th><th>Ficou na lista</th></tr></thead><tbody>'
      + s.map(x => '<tr>' + td('<span class="idv-data">' + _vdzBR(x.dia) + '</span>', 'white-space:nowrap') + td('<span class="idv-nome">' + esc(x.nome) + '</span>') + td('<span class="idv-mono">' + esc(x.reg) + '</span>')
        + td(x.motivo === 'zona' ? '<span class="idv-etq ok">zona de exclusão cadastrada</span>' : '<span style="color:var(--idv-sec)">deixou de estar ativo (tornozeleira desvinculada)</span>')
        + td(esc(x.instNome || '—')) + td('<span class="idv-data">' + x.dias + ' dia(s)</span>', 'white-space:nowrap') + '</tr>').join('') + '</tbody></table></div>' : '')
    + '</details>';
}
