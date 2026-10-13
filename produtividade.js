/* ═══════════════════════════ GERÊNCIA — PRODUTIVIDADE DOS SERVIDORES (ADMINISTRATIVO) ═══════════════════════════
   Parte de baixo da sub-aba "Produtividade Servidores" (em cima fica o Desempenho dos Plantões).
   • Relatórios de violação: store 'relatorios' — autor = campo `servidor`; "automático" = fonte 'auto-relatorio'
     (lido do PDF pelo importador). Mostra quantos e de quais monitorados.
   • Documentos da Comunicação: store 'oficios' — autor = `geradoPor`; tipo pelo `modelo` (COM_MODELOS).
   Só leitura: não grava nada. Emojis só por \u{...}. */

let _prodPeriodo = 'mes', _prodAberto = null;

function _prodIntervalo(p) {
  const h = new Date(), ini = new Date(h), fim = new Date(h);
  fim.setHours(23, 59, 59, 999); ini.setHours(0, 0, 0, 0);
  if (p === 'mes') ini.setDate(1);
  else if (p === 'mesant') { ini.setMonth(ini.getMonth() - 1, 1); fim.setDate(0); }
  else if (p === 'ano') ini.setMonth(0, 1);
  else ini.setDate(ini.getDate() - (+p - 1));
  return { ini, fim };
}
function _prodNoPeriodo(iso, iv) { const d = new Date(iso); return !isNaN(d) && d >= iv.ini && d <= iv.fim; }
function _prodISO(s) { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : String(s || ''); }
function _prodDataBR(iso) { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('pt-BR'); }
function _prodModelo(id) {
  const m = (typeof COM_MODELOS !== 'undefined' ? COM_MODELOS : []).find(x => x.id === id);
  if (m) return { nome: String(m.nome).replace(/^\S+\s(?=Livre)/, ''), cat: String(m.cat).replace(/^[^A-Za-zÀ-ÿ]+/, '') };
  return { nome: id || 'Sem modelo', cat: /desvinc/i.test(id) ? 'Desvinculação' : /vinc/i.test(id) ? 'Vinculação' : 'Outros' };
}
function _prodAgrupar(lista, chave) {
  const g = {};
  lista.forEach(x => { const k = String(chave(x) || '(sem nome)').trim(); (g[k] = g[k] || []).push(x); });
  return Object.entries(g).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
}

function prod_renderAdm() {
  const box = document.getElementById('prod-adm'); if (!box) return;
  if (!['admin', 'gerencia'].includes(usuarioAtual?.nivel)) { box.innerHTML = ''; return; }
  const iv = _prodIntervalo(_prodPeriodo);
  const rels = ((getRelatorios() || {}).registros || []).filter(r => _prodNoPeriodo(r.criadoEm, iv));
  const ofs = ((com_getOficios() || {}).registros || []).filter(o => _prodNoPeriodo(o.geradoEm, iv));
  const per = [['mes', 'este mês'], ['mesant', 'mês passado'], ['30', 'últimos 30 dias'], ['90', 'últimos 90 dias'], ['ano', 'este ano']];
  box.innerHTML = '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px;margin-top:18px">'
    + '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px"><div style="font-weight:700;color:#0f2742">\u{1F4BC} Administrativo</div>'
    + '<span style="font-size:.78rem;color:#64748b">' + _prodDataBR(iv.ini) + ' a ' + _prodDataBR(iv.fim) + ' · ' + rels.length + ' relatório(s) de violação · ' + ofs.length + ' documento(s) da Comunicação</span>'
    + '<div style="flex:1"></div><label style="font-size:.78rem;color:#64748b">Período <select onchange="_prodPeriodo=this.value;_prodAberto=null;prod_renderAdm()" style="margin-left:4px;padding:3px 6px;border:1px solid #cbd5e1;border-radius:6px;font-size:.8rem">'
    + per.map(([v, r]) => '<option value="' + v + '"' + (v === _prodPeriodo ? ' selected' : '') + '>' + r + '</option>').join('') + '</select></label></div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:14px">'
    + _prodBlocoRelatorios(rels) + _prodBlocoComunicacao(ofs) + '</div></div>';
}

function _prodTabela(titulo, cor, sub, cab, linhas, vazio) {
  return '<div style="border:1px solid #e2e8f0;border-top:3px solid ' + cor + ';border-radius:8px;padding:10px 12px;min-width:0">'
    + '<div style="font-weight:700;margin-bottom:2px">' + titulo + '</div><div style="font-size:.76rem;color:#64748b;margin-bottom:6px">' + sub + '</div>'
    + (linhas ? '<div class="table-scroll"><table class="data-table"><thead><tr>' + cab.map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' + linhas + '</tbody></table></div>'
      : '<div style="font-size:.85rem;color:#94a3b8;padding:10px 0">' + vazio + '</div>') + '</div>';
}
function _prodLinhaServidor(id, nome, cols, detalhe, nCols) {
  const aberto = _prodAberto === id;
  return '<tr style="cursor:pointer" onclick="_prodAberto=' + (aberto ? 'null' : '\'' + id + '\'') + ';prod_renderAdm()" title="Clique para ver a lista">'
    + '<td><span style="color:#64748b;display:inline-block;width:12px">' + (aberto ? '\u{25BE}' : '\u{25B8}') + '</span> <b>' + esc(nome) + '</b></td>' + cols.map(c => '<td style="font-family:var(--font-mono);text-align:right">' + c + '</td>').join('') + '</tr>'
    + (aberto ? '<tr><td colspan="' + nCols + '" style="background:#f8fafc;padding:6px 10px"><div style="max-height:280px;overflow:auto">' + detalhe + '</div></td></tr>' : '');
}

function _prodBlocoRelatorios(rels) {
  const grupos = _prodAgrupar(rels, r => r.servidor || r.criadoPor);
  const linhas = grupos.map(([nome, lista], i) => {
    const auto = lista.filter(r => r.fonte === 'auto-relatorio').length;
    const nomes = new Set(lista.map(r => String(r.monitorado || '').trim().toUpperCase()).filter(Boolean)).size;
    const det = '<table style="width:100%;font-size:.8rem;border-collapse:collapse">' + lista.slice().sort((a, b) => String(b.criadoEm).localeCompare(String(a.criadoEm))).map(r =>
      '<tr style="border-top:1px solid #e2e8f0"><td style="font-family:var(--font-mono);white-space:nowrap;padding:3px 6px">' + _prodDataBR(r.criadoEm) + '</td>'
      + '<td style="padding:3px 6px"><b>' + esc(r.monitorado || '—') + '</b></td>'
      + '<td style="padding:3px 6px;color:#64748b;white-space:nowrap">' + (r.periodoInicio ? _prodISO(r.periodoInicio) + ' a ' + _prodISO(r.periodoFim) : '') + '</td>'
      + '<td style="padding:3px 6px;text-align:right;white-space:nowrap">' + (r.violacoesSoma != null ? r.violacoesSoma + ' viol.' : '') + '</td>'
      + '<td style="padding:3px 6px;white-space:nowrap;color:' + (r.comEnviadoEm ? '#16a34a' : '#d97706') + '">' + (r.comEnviadoEm ? 'enviado à COM' : 'aguardando COM') + '</td>'
      + '<td style="padding:3px 6px;color:#94a3b8">' + (r.fonte === 'auto-relatorio' ? 'automático' : 'manual') + '</td></tr>').join('') + '</table>';
    return _prodLinhaServidor('rel' + i, nome, [lista.length, auto, lista.length - auto, nomes], det, 5);
  }).join('');
  return _prodTabela('\u{1F4D1} Relatórios de violação', '#7c3aed', 'Quem confeccionou, quantos e de quais monitorados. "Automático" = lido do PDF pelo importador. Clique no nome para ver a lista.',
    ['Servidor', 'Total', 'Automáticos', 'Manuais', 'Monitorados'], linhas, 'Nenhum relatório no período.');
}

function _prodBlocoComunicacao(ofs) {
  const grupos = _prodAgrupar(ofs, o => o.geradoPor);
  const cats = ['Vinculação', 'Desvinculação', 'Relatório'];
  const linhas = grupos.map(([nome, lista], i) => {
    const porCat = c => lista.filter(o => _prodModelo(o.modelo).cat === c).length;
    const outros = lista.length - cats.reduce((s, c) => s + porCat(c), 0);
    const det = '<table style="width:100%;font-size:.8rem;border-collapse:collapse">' + lista.slice().sort((a, b) => String(b.geradoEm).localeCompare(String(a.geradoEm))).map(o =>
      '<tr style="border-top:1px solid #e2e8f0"><td style="font-family:var(--font-mono);white-space:nowrap;padding:3px 6px">' + _prodDataBR(o.geradoEm) + '</td>'
      + '<td style="font-family:var(--font-mono);white-space:nowrap;padding:3px 6px">Of. ' + esc(o.numero) + '/' + esc(o.ano) + '</td>'
      + '<td style="padding:3px 6px">' + esc(_prodModelo(o.modelo).nome) + '</td>'
      + '<td style="padding:3px 6px"><b>' + esc(o.monitorado || '—') + '</b></td></tr>').join('') + '</table>';
    return _prodLinhaServidor('com' + i, nome, [lista.length].concat(cats.map(porCat), [outros]), det, 6);
  }).join('');
  return _prodTabela('\u{2709}\u{FE0F} Documentos da Comunicação', '#0d9488', 'Ofícios gerados no sistema por servidor, por tipo. Clique no nome para ver cada ofício.',
    ['Servidor', 'Total', 'Vinculação', 'Desvinc.', 'Relatório', 'Outros'], linhas, 'Nenhum documento gerado no período.');
}
