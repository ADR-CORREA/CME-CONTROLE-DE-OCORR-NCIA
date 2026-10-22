/* ═══════════════════════ GERÊNCIA — SAÍDA TEMPORÁRIA × ZONA DO AKILES ═══════════════════════
   Zonas de saída temporária/licença vigentes no AKILES e o que contradiz a regra padrão da saída
   (recolhimento integral na residência): agenda que libera horário, quem liberou (auditoria),
   ocorrência de saída da zona encerrada como "trabalho externo" e GPS com posição velha.
   Atualizado pelo robô todo dia de manhã, 08h10 (atualizar-plantoes.js → saida-temp-akiles.js, só leitura
   no AKILES); vem dentro de cme_plantao_auto (o banco só entrega à gerência e ao administrador).
   Caso que originou: 22/10/2026. Só leitura. Emojis só por \u{...}. Prefixo _stz. */

const _STZ_DIAS = { dom: 'Dom', seg: 'Seg', ter: 'Ter', qua: 'Qua', qui: 'Qui', sex: 'Sex', sab: 'Sáb', fer: 'Feriado' };

function _stzDados() { const d = carregarStore('plantao_auto', null); return d && d.saidaTemp ? d.saidaTemp : null; }
function _stzData(s) { const m = String(s || '').match(/(\d{2})\/(\d{2})\/\d{4}\s+(\d{2}):(\d{2})/); return m ? m[1] + '/' + m[2] + ' ' + m[3] + 'h' + m[4] : (s ? esc(s) : '—'); }
function _stzH(n) { return String(n).replace('.', ',') + ' h'; }
function _stzDiasTxt(dias) {
  const uteis = ['seg', 'ter', 'qua', 'qui', 'sex'];
  const resto = uteis.every(d => dias.includes(d)) ? ['Seg a Sex'].concat(dias.filter(d => !uteis.includes(d)).map(d => _STZ_DIAS[d])) : dias.map(d => _STZ_DIAS[d]);
  return resto.join(', ');
}
function _stzLiberacao(z) { return (z.eventos || []).find(e => e.liberou) || null; }

function stz_render() {
  const box = document.getElementById('stz-corpo'); if (!box) return;
  if (!['admin', 'gerencia'].includes(usuarioAtual?.nivel)) { box.innerHTML = '<div class="idv-vazio">Acesso restrito à Gerência.</div>'; return; }
  const r = _stzDados();
  if (!r) { box.innerHTML = '<div class="idv-vazio">Aguardando a 1ª coleta do robô (todo dia às 08h10, junto com a análise da troca de plantão).</div>'; return; }
  const zonas = r.zonas || [];
  const agenda = zonas.filter(z => z.horas && z.horas.maxDia > 0), trab = zonas.filter(z => (z.trabalhoExterno || []).length), gps = zonas.filter(z => z.gps && z.gps.velho);
  const pior = agenda.reduce((m, z) => (!m || z.horas.maxDia > m.horas.maxDia ? z : m), null), semAg = zonas.filter(z => z.horas && z.horas.semAgenda);
  const achado = agenda.length
    ? '<b class="idv-data" style="color:var(--idv-cr);font-size:20px;font-weight:600">' + agenda.length + '</b> de ' + zonas.length + ' zona(s) de saída temporária <b>liberam saída de casa</b> por agenda — a mais aberta deixa <b>' + _stzH(pior.horas.maxDia) + ' livres por dia</b>'
      + (pior.monitorado ? ' (' + esc(pior.monitorado.nome || 'registro ' + pior.monitorado.reg) + ')' : '') + '.'
    : zonas.length ? 'As ' + zonas.length + ' zona(s) de saída temporária vigentes estão válidas para qualquer horário (recolhimento integral).' : 'Nenhuma zona de saída temporária vigente no AKILES agora.';
  box.innerHTML = '<div style="font-size:13px;color:var(--idv-sec);margin-bottom:10px">Atualizado em <span class="idv-data">' + new Date(r.geradoEm).toLocaleString('pt-BR') + '</span> · refeito todo dia de manhã (08h10) · consulta só de leitura no AKILES. '
    + 'Regra padrão da saída temporária: <b>recolhimento à residência integralmente</b> — a zona deve valer para qualquer horário. Confira sempre a decisão do monitorado.</div>'
    + '<div class="idv-faixa ' + (agenda.length ? 'cr' : 'ok') + '" style="display:block;line-height:1.5;margin-bottom:12px">' + achado
    + (trab.length ? '<div style="margin-top:4px"><b style="color:var(--idv-cr)">' + trab.length + '</b> com ocorrência de saída da zona encerrada como "trabalho externo".</div>' : '')
    + (gps.length ? '<div style="margin-top:4px;color:var(--idv-at)"><b>' + gps.length + '</b> com GPS velho: o equipamento comunica, mas a posição mostrada no mapa tem mais de 24 h.</div>' : '')
    + (semAg.length ? '<div style="margin-top:4px;color:var(--idv-at)"><b>' + semAg.length + '</b> sem agenda e sem "qualquer horário" — conferir no AKILES.</div>' : '')
    + ((r.zonasNaoLidas || []).length ? '<div style="margin-top:4px;color:var(--idv-at)">' + r.zonasNaoLidas.length + ' zona(s) não puderam ser lidas nesta coleta (zona <span class="idv-mono">' + r.zonasNaoLidas.map(esc).join(', ') + '</span>).</div>' : '') + '</div>'
    + _stzTabela(zonas) + _stzHtmlEventos(r);
}

function _stzTabela(zonas) {
  if (!zonas.length) return '';
  const td = (v, s) => '<td style="' + (s || '') + '">' + v + '</td>';
  return '<div class="table-scroll"><table class="data-table idv-tabela"><thead><tr><th>Monitorado</th><th>Período da zona</th><th>Situação</th><th>Quem liberou o horário</th><th>Ocorrências no período</th></tr></thead><tbody>'
    + zonas.map(z => {
      const lib = _stzLiberacao(z), h = z.horas || {};
      const faixa = h.maxDia > 0 || (z.trabalhoExterno || []).length ? 'box-shadow:inset 3px 0 0 var(--idv-cr)' : (z.gps && z.gps.velho) || h.semAgenda ? 'box-shadow:inset 3px 0 0 var(--idv-at)' : '';
      const util = Math.max(h.seg || 0, h.ter || 0, h.qua || 0, h.qui || 0, h.sex || 0);
      const sit = (h.semAgenda ? '<span class="idv-etq at">Sem agenda e sem "qualquer horário" — conferir</span>'
        : h.maxDia > 0 ? '<div><span class="idv-etq cr">Agenda libera saída</span></div><div class="idv-mini">até ' + _stzH(util) + ' livres/dia útil · sáb ' + _stzH(h.sab) + ' · dom ' + _stzH(h.dom) + '</div>'
        + '<details class="idv-mini"><summary style="cursor:pointer">Agenda cadastrada (horário em que tem de estar em casa)</summary>' + (z.agenda || []).map(l => '<div>' + esc(_stzDiasTxt(l.dias)) + ': <span class="idv-data">' + esc(l.ini) + ' às ' + esc(l.fim) + '</span></div>').join('') + '</details>'
        : '<span class="idv-etq ok">Qualquer horário</span>')
        + (z.gps && z.gps.velho ? '<div style="margin-top:4px"><span class="idv-etq at">GPS velho · ' + z.gps.horasSemPosicao + ' h sem posição</span></div>' : '');
      const quem = lib ? esc(lib.operador) + '<div class="idv-mini">' + (lib.acao === 'criou' ? 'criou com agenda' : 'trocou de "qualquer horário" para agenda') + ' em <span class="idv-data">' + _stzData(lib.quando) + '</span></div>'
        : h.maxDia > 0 ? '<span class="idv-mini">não aparece na auditoria lida (antes da 1ª coleta ou fatia não lida)</span>' : '—';
      const oc = (z.trabalhoExterno || []).map(o => '<div><span class="idv-etq cr">Encerrada como trabalho externo</span><div class="idv-mini">nº <span class="idv-mono">' + esc(o.id) + '</span> · ' + esc(o.operador || '—') + ' · <span class="idv-data">' + _stzData(o.quando) + '</span></div></div>').join('')
        + '<div class="idv-mini">' + (z.ocorrenciasInclusao || 0) + ' de saída da zona</div>';
      return '<tr>' + td('<div class="idv-nome">' + esc(z.monitorado ? z.monitorado.nome || '—' : 'Monitorado não identificado') + '</div><div class="idv-mini">'
          + (z.monitorado ? 'registro <span class="idv-mono">' + esc(z.monitorado.reg) + '</span>' + (z.monitorado.confirmado ? '' : ' · <span style="color:var(--idv-at)">vínculo não confirmado</span>') : 'zona "' + esc(z.noZona) + '"')
          + ' · zona <span class="idv-mono">' + esc(z.idZona) + '</span></div>' + (z.ds ? '<div class="idv-mini">' + esc(z.ds) + '</div>' : ''), faixa + ';min-width:220px')
        + td('<span class="idv-data">' + _stzData(z.inicio) + '<br>' + _stzData(z.fim) + '</span>', 'white-space:nowrap') + td(sit) + td(quem) + td(oc) + '</tr>';
    }).join('') + '</tbody></table></div>';
}

// Liberações de horário em zonas de saída nos últimos 30 dias (inclusive de zonas já encerradas)
function _stzHtmlEventos(r) {
  const ev = (r.eventos || []).filter(e => e.liberou), f = (r.auditoria && r.auditoria.falhas) || [];
  const td = v => '<td>' + v + '</td>';
  return '<details style="margin-top:16px;border-top:1px solid var(--idv-linha);padding-top:12px"><summary style="cursor:pointer;font-size:14px;font-weight:600">Liberações de horário em zonas de saída — últimos 30 dias: ' + ev.length + '</summary>'
    + (ev.length ? '<div class="table-scroll" style="margin-top:8px"><table class="data-table idv-tabela"><thead><tr><th>Quando</th><th>Servidor</th><th>Zona</th><th>O que fez</th><th>Livre por dia</th></tr></thead><tbody>'
      + ev.map(e => '<tr>' + td('<span class="idv-data">' + _stzData(e.quando) + '</span>') + td(esc(e.operador)) + td('<span class="idv-mono">' + esc(e.idZona || e.noZona) + '</span><div class="idv-mini">' + esc(e.ds || '') + '</div>')
        + td(e.acao === 'criou' ? 'criou a zona já com agenda' : 'trocou "qualquer horário" por agenda') + td('<span class="idv-data">até ' + _stzH(e.horas.maxDia) + '</span>') + '</tr>').join('') + '</tbody></table></div>' : '')
    + '<div class="idv-mini" style="margin-top:6px">Auditoria lida de <span class="idv-data">' + esc((r.auditoria || {}).de || '—') + '</span> a <span class="idv-data">' + esc((r.auditoria || {}).ate || '—') + '</span>, operador por operador.'
    + (f.length ? ' <span style="color:var(--idv-at)">Trechos que o AKILES não deixou ler (registro com erro): ' + esc(Object.entries(f.reduce((m, x) => (m[x.operador] = (m[x.operador] || 0) + 1, m), {}))
      .map(([op, n]) => op + ' (' + n + ')').join(', ')) + '. Uma liberação feita nesses minutos pode não aparecer.</span>' : '')
    + (r.auditoria && r.auditoria.interrompida ? ' <span style="color:var(--idv-at)">A leitura foi interrompida (' + esc(r.auditoria.interrompida) + '); quem faltou é lido na próxima coleta.</span>' : '')
    + (r.auditoria && (r.auditoria.cortados || []).length ? ' <span style="color:var(--idv-at)">O robô ficou mais de 3 dias sem ler a auditoria de ' + r.auditoria.cortados.length + ' servidor(es); o período mais antigo não foi conferido.</span>' : '') + '</div>'
    + '</details>';
}
