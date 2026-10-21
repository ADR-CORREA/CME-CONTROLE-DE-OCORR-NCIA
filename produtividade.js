/* ═══════════════════════════ GERÊNCIA — PRODUTIVIDADE DOS SERVIDORES (ADMINISTRATIVO) ═══════════════════════════
   Parte de baixo da sub-aba "Produtividade Servidores" (em cima fica o Desempenho dos Plantões).
   • Relatórios de violação: store 'relatorios' — autor = campo `servidor`; "automático" = fonte 'auto-relatorio'
     (lido do PDF pelo importador). Mostra quantos e de quais monitorados.
   • Documentos da Comunicação: store 'oficios' — autor = `geradoPor`; tipo pelo `modelo` (COM_MODELOS).
   Só leitura: não grava nada. Emojis só por \u{...}. */

let _padmPeriodo = 'mes', _padmAberto = null;

function _padmIntervalo(p) {
  const h = new Date(), ini = new Date(h), fim = new Date(h);
  fim.setHours(23, 59, 59, 999); ini.setHours(0, 0, 0, 0);
  if (p === 'mes') ini.setDate(1);
  else if (p === 'mesant') { ini.setMonth(ini.getMonth() - 1, 1); fim.setDate(0); }
  else if (p === 'ano') ini.setMonth(0, 1);
  else ini.setDate(ini.getDate() - (+p - 1));
  return { ini, fim };
}
function _padmNoPeriodo(iso, iv) { const d = new Date(iso); return !isNaN(d) && d >= iv.ini && d <= iv.fim; }
function _padmISO(s) { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(s || ''); }
function _padmDataBR(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR'); }
function _padmModelo(id) {
  const m = (typeof COM_MODELOS !== 'undefined' ? COM_MODELOS : []).find(x => x.id === id);
  if (m) return { nome: String(m.nome).replace(/^\S+\s(?=Livre)/, ''), cat: String(m.cat).replace(/^[^A-Za-zÀ-ÿ]+/, '') };
  return { nome: id || 'Sem modelo', cat: /desvinc/i.test(id) ? 'Desvinculação' : /vinc/i.test(id) ? 'Vinculação' : 'Outros' };
}
function _padmAgrupar(lista, chave) {
  const g = {};
  lista.forEach(x => { const k = String(chave(x) || '(sem nome)').trim(); (g[k] = g[k] || []).push(x); });
  return Object.entries(g).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

function prod_renderAdm() {
  const box = document.getElementById('prod-adm'); if (!box) return;
  if (!['admin', 'gerencia'].includes(usuarioAtual?.nivel)) { box.innerHTML = ''; return; }
  const iv = _padmIntervalo(_padmPeriodo);
  const rels = ((getRelatorios() || {}).registros || []).filter(r => _padmNoPeriodo(r.criadoEm, iv));
  const ofs = ((com_getOficios() || {}).registros || []).filter(o => _padmNoPeriodo(o.geradoEm, iv));
  const per = [['mes', 'este mês'], ['mesant', 'mês passado'], ['30', 'últimos 30 dias'], ['90', 'últimos 90 dias'], ['ano', 'este ano']];
  box.innerHTML = '<div style="background:var(--idv-cartao);border:1px solid var(--idv-borda);border-radius:6px;padding:16px;margin-top:16px">'
    + '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px"><div class="idv-secao" style="margin:0">\u{1F4BC} Administrativo</div>'
    + '<span class="idv-data" style="font-size:13px;color:var(--idv-sec)">' + _padmDataBR(iv.ini) + ' a ' + _padmDataBR(iv.fim) + ' · ' + rels.length + ' relatório(s) de violação · ' + ofs.length + ' documento(s) da Comunicação</span>'
    + '<div style="flex:1"></div><label style="font-size:13px;color:var(--idv-sec)">Período <select class="idv-select" onchange="_padmPeriodo=this.value;_padmAberto=null;prod_renderAdm()" style="margin-left:4px">'
    + per.map(([v, r]) => '<option value="' + v + '"' + (v === _padmPeriodo ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></label></div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:12px">'
    + _padmBlocoRelatorios(rels) + _padmBlocoComunicacao(ofs) + '</div></div>';
}

function _padmTabela(titulo, sub, cab, linhas, vazio) {
  return '<div class="idv-bloco" style="min-width:0"><div class="idv-bloco-cab"><span>' + titulo + '</span></div><div class="idv-bloco-corpo" style="gap:8px">'
    + '<div class="idv-mini" style="font-size:13px">' + sub + '</div>'
    + (linhas ? '<div class="table-scroll"><table class="data-table idv-tabela"><thead><tr>' + cab.map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' + linhas + '</tbody></table></div>'
      : '<div style="font-size:14px;color:var(--idv-sec);padding:12px 0">' + vazio + '</div>') + '</div></div>';
}
function _padmLinhaServidor(id, nome, cols, detalhe, nCols) {
  const aberto = _padmAberto === id;
  return '<tr style="cursor:pointer" onclick="_padmAberto=' + (aberto ? 'null' : '\'' + id + '\'') + ';prod_renderAdm()" title="Clique para ver a lista">'
    + '<td><span style="color:var(--idv-sec);display:inline-block;width:12px">' + (aberto ? '\u{25BE}' : '\u{25B8}') + '</span> <b style="font-weight:600">' + esc(nome) + '</b></td>' + cols.map(c => '<td class="idv-data" style="text-align:right">' + c + '</td>').join('') + '</tr>'
    + (aberto ? '<tr><td colspan="' + nCols + '" style="background:var(--idv-fundo);padding:8px 12px"><div style="max-height:280px;overflow:auto">' + detalhe + '</div></td></tr>' : '');
}

function _padmBlocoRelatorios(rels) {
  const grupos = _padmAgrupar(rels, r => r.servidor || r.criadoPor);
  const linhas = grupos.map(([nome, lista], i) => {
    const auto = lista.filter(r => r.fonte === 'auto-relatorio').length;
    const nomes = new Set(lista.map(r => String(r.monitorado || '').trim().toUpperCase()).filter(Boolean)).size;
    const det = '<table style="width:100%;font-size:13px;border-collapse:collapse">' + lista.slice().sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm))).map(r =>
      '<tr style="border-top:1px solid var(--idv-linha)"><td class="idv-data" style="white-space:nowrap;padding:4px 8px">' + _padmDataBR(r.criadoEm) + '</td>'
      + '<td style="padding:4px 8px"><b style="font-weight:600">' + esc(r.monitorado || '—') + '</b></td>'
      + '<td class="idv-data" style="padding:4px 8px;color:var(--idv-sec);white-space:nowrap">' + (r.periodoInicio ? _padmISO(r.periodoInicio) + ' a ' + _padmISO(r.periodoFim) : '') + '</td>'
      + '<td class="idv-data" style="padding:4px 8px;text-align:right;white-space:nowrap">' + (r.violacoesSoma != null ? r.violacoesSoma + ' viol.' : '') + '</td>'
      + '<td style="padding:4px 8px;white-space:nowrap"><span class="idv-etq ' + (r.comEnviadoEm ? 'ok' : 'at') + '">' + (r.comEnviadoEm ? 'enviado à COM' : 'aguardando COM') + '</span></td>'
      + '<td style="padding:4px 8px;color:var(--idv-sec)">' + (r.fonte === 'auto-relatorio' ? 'automático' : 'manual') + '</td></tr>').join('') + '</table>';
    return _padmLinhaServidor('rel' + i, nome, [lista.length, auto, lista.length - auto, nomes], det, 5);
  }).join('');
  return _padmTabela('\u{1F4D1} Relatórios de violação', 'Quem confeccionou, quantos e de quais monitorados. "Automático" = lido do PDF pelo importador. Clique no nome para ver a lista.',
    ['Servidor', 'Total', 'Automáticos', 'Manuais', 'Monitorados'], linhas, 'Nenhum relatório no período.');
}

function _padmBlocoComunicacao(ofs) {
  const grupos = _padmAgrupar(ofs, o => o.geradoPor);
  const cats = ['Vinculação', 'Desvinculação', 'Relatório'];
  const linhas = grupos.map(([nome, lista], i) => {
    const porCat = c => lista.filter(o => _padmModelo(o.modelo).cat === c).length;
    const outros = lista.length - cats.reduce((s, c) => s + porCat(c), 0);
    const det = '<table style="width:100%;font-size:13px;border-collapse:collapse">' + lista.slice().sort((a, b) => String(b.geradoEm).localeCompare(String(a.geradoEm))).map(o =>
      '<tr style="border-top:1px solid var(--idv-linha)"><td class="idv-data" style="white-space:nowrap;padding:4px 8px">' + _padmDataBR(o.geradoEm) + '</td>'
      + '<td class="idv-mono" style="white-space:nowrap;padding:4px 8px">Of. ' + esc(o.numero) + '/' + esc(o.ano) + '</td>'
      + '<td style="padding:4px 8px">' + esc(_padmModelo(o.modelo).nome) + '</td>'
      + '<td style="padding:4px 8px"><b style="font-weight:600">' + esc(o.monitorado || '—') + '</b></td></tr>').join('') + '</table>';
    return _padmLinhaServidor('com' + i, nome, [lista.length].concat(cats.map(porCat), [outros]), det, 6);
  }).join('');
  return _padmTabela('\u{2709}\u{FE0F} Documentos da Comunicação', 'Ofícios gerados no sistema por servidor, por tipo. Clique no nome para ver cada ofício.',
    ['Servidor', 'Total', 'Vinculação', 'Desvinc.', 'Relatório', 'Outros'], linhas, 'Nenhum documento gerado no período.');
}
