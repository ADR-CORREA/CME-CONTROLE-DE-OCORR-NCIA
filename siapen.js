/* ═══════════════════════════ GERÊNCIA — SIAPEN × AKILES ═══════════════════════════
   Monitorados ATIVOS no AKILES que o SIAPENweb mostra como PRESOS (situação "PRESO…" ou entrada
   recente por prisão/recaptura), com destaque para os que estão Sem Comunicação, e os que têm
   regime/situação diferente entre os dois sistemas. Robô siapen-robo.js (só leitura nos dois
   sistemas), dentro de cme_akiles_auto.siapen. Só leitura. Emojis só por \u{...}. Prefixo _spn. */

let _spnBusca = '', _spnFiltro = '';

function _spnDados() { const p = carregarStore('akiles_auto', null); return p && p.siapen ? p.siapen : null; }
function _spnNorm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
const _SPN_URL = 'https://siapen.portal.ap.gov.br';

function spn_render() {
  const box = document.getElementById('spn-corpo'); if (!box) return;
  if (!['admin', 'gerencia'].includes(usuarioAtual?.nivel)) { box.innerHTML = '<div class="idv-vazio">Acesso restrito à Gerência.</div>'; return; }
  const r = _spnDados();
  if (!r) { box.innerHTML = '<div class="idv-vazio">Aguardando a 1ª coleta do robô do SIAPEN.</div>'; return; }
  const presos = r.presos || [], div = r.divergentes || [], novos = presos.filter(x => x.novaEntrada).length;
  const chip = (k, rot, n, cls) => '<button type="button" class="idv-chip' + (_spnFiltro === k ? ' ativo' : '') + '" onclick="_spnFiltro=' + (_spnFiltro === k ? "''" : "'" + k + "'") + ';spn_render()">' + rot + ' <span class="idv-n">' + n + '</span></button>';
  box.innerHTML = '<div style="font-size:13px;color:var(--idv-sec);margin-bottom:10px">Atualizado em <span class="idv-data">' + new Date(r.em).toLocaleString('pt-BR') + '</span> · '
    + r.achados + ' de ' + r.conferidos + ' monitorados ativos achados no SIAPEN pelo CPF'
    + (r.erros ? ' · <span style="color:var(--idv-at)">' + r.erros + ' consulta(s) falharam (tentam de novo amanhã)</span>' : '')
    + ' · a ficha completa de cada um é relida em até 7 dias · consulta só de leitura</div>'
    + (presos.length ? '<div class="idv-faixa cr" style="display:block;line-height:1.5;margin-bottom:12px"><b class="idv-data" style="color:var(--idv-cr);font-size:20px;font-weight:600">' + presos.length + '</b> monitorado(s) com tornozeleira ativa aparecem como <b>presos</b> no SIAPEN'
      + (r.semcomPresos ? ' — <b>' + r.semcomPresos + '</b> deles estão <b>sem comunicação</b>' : '') + (novos ? ' · <b style="color:var(--idv-cr)">' + novos + ' entrada(s) nova(s)</b>' : '')
      + '. Conferir no SIAPEN e, se confirmado, providenciar o recolhimento do equipamento e comunicar o juízo.</div>' : '<div class="idv-faixa ok" style="margin-bottom:12px">Nenhum monitorado ativo aparece como preso no SIAPEN.</div>')
    + '<div class="idv-chips" style="margin-bottom:10px">' + chip('presos', 'Possivelmente presos', presos.length) + chip('semcom', 'Presos e sem comunicação', r.semcomPresos || 0) + chip('div', 'Regime/situação divergente', div.length) + '</div>'
    + '<div class="idv-busca" style="margin-bottom:8px;max-width:420px"><input value="' + esc(_spnBusca) + '" oninput="_spnBusca=this.value;_spnTabela()" placeholder="Buscar por nome, registro ou unidade…"></div>'
    + '<div id="spn-tabela"></div>';
  _spnTabela();
}

function _spnTabela() {
  const el = document.getElementById('spn-tabela'), r = _spnDados(); if (!el || !r) return;
  const q = _spnNorm(_spnBusca).trim();
  let lista = _spnFiltro === 'div' ? (r.divergentes || []).map(x => ({ ...x, _div: true }))
    : _spnFiltro === 'semcom' ? (r.presos || []).filter(x => x.semcom)
    : _spnFiltro === 'presos' ? (r.presos || []) : [...(r.presos || []), ...(r.divergentes || []).map(x => ({ ...x, _div: true }))];
  lista = lista.filter(x => !q || _spnNorm(x.nome + ' ' + x.registro + ' ' + (x.unidade || '')).includes(q));
  const td = (v, s) => '<td style="' + (s || '') + '">' + v + '</td>';
  const ult = u => u && u.tipo ? esc(u.tipo) + (u.motivo && u.motivo !== 'INDISPONÍVEL' ? ' · ' + esc(u.motivo) : '') + (u.data ? '<div class="idv-mini idv-data">' + esc(u.data) + '</div>' : '') : '—';
  el.innerHTML = '<div class="idv-data" style="font-size:13px;color:var(--idv-sec);margin-bottom:6px">' + lista.length + ' monitorado(s)</div>'
    + '<div class="table-scroll"><table class="data-table idv-tabela"><thead><tr><th>Monitorado</th><th>Registro</th><th>Achado</th><th>SIAPEN: situação / regime</th><th>Última movimentação</th><th>Unidade</th><th></th></tr></thead><tbody>'
    + (lista.length ? lista.map(x => '<tr style="box-shadow:inset 3px 0 0 var(' + (x._div ? '--idv-at' : '--idv-cr') + ')">'
        + td('<div class="idv-nome">' + esc(x.nome) + '</div><div class="idv-mini">' + esc(x.grupo || '') + '</div>')
        + td('<span class="idv-mono">' + esc(x.registro) + '</span>')
        + td(x._div ? '<span class="idv-etq at">DIVERGENTE</span><div class="idv-mini">' + esc(x.diverge) + '</div>'
          : '<span class="idv-etq cr">POSSÍVEL PRESO</span>' + (x.semcom ? '<div><span class="idv-etq ne" style="margin-top:4px">SEM COMUNICAÇÃO</span></div>' : '') + (x.novaEntrada ? '<div class="idv-mini" style="color:var(--idv-cr)">entrada nova</div>' : ''))
        + td(esc(x.situacao || '—') + '<div class="idv-mini">' + esc(x.regime || '') + '</div>')
        + td(ult(x.ult)) + td(esc(x.unidade || '—'))
        + td('<a class="idv-btn mini" target="_blank" rel="noopener" href="' + _SPN_URL + '/custodiado/movimentacoesExternas/' + encodeURIComponent(x.idSiapen) + '">Abrir no SIAPEN</a>', 'white-space:nowrap')
        + '</tr>').join('')
      : '<tr><td colspan="7" class="idv-vazio">Nenhum monitorado com esse filtro.</td></tr>')
    + '</tbody></table></div>';
}
