/* ═══════════════════════════ INCONSISTÊNCIAS NO TRATAMENTO DE OCORRÊNCIAS ═══════════════════════════
   Gerência › Produtividade Servidores, bloco ACIMA de "Plantonistas" (pedido do Adriano, 20/10/2026).
   Para controle da gerência: dashboard por mês (jan–dez), consulta com filtros e PDF do resumo de cada guarnição.
   Dados: robô mensal (Desktop\CME\ROBO MAPAS AKILES\inconsistencias\mensal.js, só leitura no AKILES) grava
   cme_plantao_bk_inconsistencias_AAAA_MM + _indice (só admin/gerência leem; "_bk_" = fora do login, lido sob demanda).
   Gabarito da Gerência: zona de exclusão — passou por dentro (≥2 leituras a ≥15 m da borda) = 6; só advertência ou
   falha técnica = 7; o texto tem de bater com a marcação. Bateria — arquivar só após restabelecer; >15 min = 6.
   Emojis só por \u{...}. Prefixo _inc / inc_ (não colidir com o index). */

const _INC_CHAVE = 'cme_plantao_bk_inconsistencias_';
const _INC_MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const _INC_MESES_EXT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const _INC_GUAR = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'EXPEDIENTE', 'SEM ESCALA'];
const _INC_CAT = {
  nc: { rot: 'Violação não confirmada', cor: '#dc2626', dica: 'o GPS mostra entrada na zona de exclusão (ou o texto afirma a entrada) e foi marcada "7. não confirmada"' },
  tx: { rot: 'Texto × marcação', cor: '#d97706', dica: 'o comentário diz o contrário do procedimento marcado' },
  cf: { rot: 'A conferir', cor: '#2563eb', dica: 'confirmada, mas o GPS não mostra entrada (a zona pode ter sido alterada depois)' },
  bat: { rot: 'Bateria', cor: '#7c3aed', dica: 'arquivada antes de restabelecer ou descarga acima de 15 min sem confirmar' },
};
let _incIndice = null, _incMes = null, _incDados = {}, _incCarregando = false, _incErro = '';
let _incF = { g: '', op: '', cat: '', t: '', q: '' }, _incLimite = 100;

function _incAno() { return String(new Date().getFullYear()); }
function _incRot(mes) { const [a, m] = mes.split('_'); return _INC_MESES[+m - 1] + '/' + a; }
async function _incLer(chave) { const r = await _dbLerChave(chave); if (r.error) throw r.error; return r.data ? r.data.value : null; }

async function inc_render() {
  const box = document.getElementById('inc-secao'); if (!box) return;
  if (!['admin', 'gerencia'].includes(usuarioAtual?.nivel)) { box.innerHTML = ''; box.style.display = 'none'; return; }
  box.style.display = '';
  if (_incIndice === null && !_incCarregando) {
    _incCarregando = true; _incDesenhar(box);
    try { _incIndice = (await _incLer(_INC_CHAVE + 'indice')) || {}; _incErro = ''; }
    catch (e) { _incIndice = {}; _incErro = 'Não consegui ler as inconsistências agora (' + (e.message || e) + ').'; }
    _incCarregando = false;
    const meses = Object.keys(_incIndice).sort();
    if (!_incMes && meses.length) _incMes = meses[meses.length - 1];
  }
  if (_incMes && !_incDados[_incMes] && !_incCarregando) {
    _incCarregando = true; _incDesenhar(box);
    try { _incDados[_incMes] = (await _incLer(_INC_CHAVE + _incMes)) || { casos: [], resumo: { total: 0, porGuarnicao: {}, porServidor: {} } }; }
    catch (e) { _incErro = 'Não consegui ler ' + _incRot(_incMes) + ' (' + (e.message || e) + ').'; }
    _incCarregando = false;
  }
  _incDesenhar(box);
}
function inc_mes(mes) { _incMes = mes; _incF = { g: '', op: '', cat: '', t: '', q: '' }; _incLimite = 100; inc_render(); }
function inc_filtro(campo, valor) { _incF[campo] = valor; if (campo === 'g') _incF.op = ''; _incLimite = 100; _incDesenhar(document.getElementById('inc-secao')); }
function inc_maisLinhas() { _incLimite += 200; _incDesenhar(document.getElementById('inc-secao')); }

function _incDesenhar(box) {
  if (!box) return;
  const ano = (_incMes || '').split('_')[0] || _incAno();
  const chips = _INC_MESES.map((m, i) => {
    const k = ano + '_' + String(i + 1).padStart(2, '0'), tem = _incIndice && _incIndice[k], sel = k === _incMes;
    const tot = tem && _incIndice[k].resumo ? _incIndice[k].resumo.total : null;
    return '<button ' + (tem ? 'onclick="inc_mes(\'' + k + '\')"' : 'disabled title="ainda não analisado"') + ' style="padding:5px 10px;border-radius:4px;font-size:.8rem;cursor:' + (tem ? 'pointer' : 'default')
      + ';border:1px solid ' + (sel ? '#2563eb' : '#cbd5e1') + ';background:' + (sel ? 'rgba(37,99,235,.10)' : tem ? '#fff' : '#f8fafc') + ';color:' + (sel ? '#1d4ed8' : tem ? '#0f2742' : '#94a3b8')
      + ';font-weight:' + (sel ? 700 : 500) + (sel ? ';box-shadow:inset 2px 0 0 #2563eb' : '') + '">' + m + (tot != null ? ' <span style="font-family:var(--font-mono);color:#64748b">' + tot + '</span>' : '') + '</button>';
  }).join('');
  const d = _incMes && _incDados[_incMes];
  let corpo;
  if (_incCarregando) corpo = '<div style="padding:18px;color:#64748b">Carregando…</div>';
  else if (_incErro) corpo = '<div style="padding:12px;color:#b91c1c">' + esc(_incErro) + '</div>';
  else if (!_incIndice || !Object.keys(_incIndice).length) corpo = '<div style="padding:14px;color:#64748b">Ainda não há análise publicada. O robô roda todo dia 1 e analisa o mês anterior.</div>';
  else if (!d) corpo = '<div style="padding:14px;color:#64748b">Escolha um mês.</div>';
  else corpo = _incDashboard(d) + _incConsulta(d);
  box.innerHTML = '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">'
    + '<div style="font-weight:700;color:#0f2742">\u{1F9ED} Inconsistências no tratamento de ocorrências</div>'
    + '<span style="font-size:.78rem;color:#64748b">zona de exclusão e bateria · robô do AKILES (só leitura) · todo dia 1 analisa o mês anterior</span></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">' + chips + '</div>' + corpo;
}

function _incDashboard(d) {
  const r = d.resumo || { porGuarnicao: {}, porServidor: {} }, a = d.analisadas || {};
  const tot = { nc: 0, tx: 0, cf: 0, bat: 0 }; Object.values(r.porGuarnicao).forEach(g => Object.keys(tot).forEach(k => tot[k] += g[k] || 0));
  const card = (rot, val, cor, dica) => '<div title="' + esc(dica || '') + '" style="border:1px solid #e2e8f0;border-left:3px solid ' + cor + ';border-radius:6px;padding:8px 12px;min-width:0">'
    + '<div style="font-size:.74rem;color:#64748b;text-transform:uppercase;letter-spacing:.04em">' + rot + '</div><div style="font-size:1.45rem;font-weight:700;font-family:var(--font-mono);color:' + cor + '">' + val + '</div></div>';
  const kpis = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:12px">'
    + card('Analisadas', (a.zonas || 0) + ' + ' + (a.baterias || 0), '#0f2742', 'zonas de exclusão + baterias analisadas no período')
    + card('Apontamentos', r.total || 0, '#0f2742', 'ocorrências com inconsistência no tratamento')
    + Object.entries(_INC_CAT).map(([k, c]) => card(c.rot, tot[k], c.cor, c.dica)).join('') + '</div>';
  const max = Math.max(1, ...Object.values(r.porGuarnicao).map(g => g.total));
  const guar = _INC_GUAR.filter(g => r.porGuarnicao[g]).map(g => {
    const x = r.porGuarnicao[g], barra = Object.keys(_INC_CAT).map(k => x[k] ? '<span title="' + _INC_CAT[k].rot + ': ' + x[k] + '" style="display:inline-block;height:10px;width:' + (x[k] / max * 100) + '%;background:' + _INC_CAT[k].cor + '"></span>' : '').join('');
    return '<tr><td><b style="cursor:pointer" onclick="inc_filtro(\'g\',\'' + g + '\')" title="Ver os casos desta guarnição">' + g + '</b></td><td style="text-align:right;font-family:var(--font-mono)">' + x.servidores + '</td>'
      + Object.keys(_INC_CAT).map(k => '<td style="text-align:right;font-family:var(--font-mono)">' + (x[k] || '') + '</td>').join('')
      + '<td style="text-align:right;font-family:var(--font-mono)"><b>' + x.total + '</b></td><td style="min-width:140px"><div style="display:flex;background:#f1f5f9;border-radius:2px;overflow:hidden">' + barra + '</div></td>'
      + '<td><button class="btn-secondary" style="padding:3px 9px;font-size:.76rem;white-space:nowrap" onclick="inc_pdfGuarnicao(\'' + g + '\')">\u{1F5A8}\u{FE0F} PDF</button></td></tr>';
  }).join('');
  const top = Object.entries(r.porServidor).sort((a, b) => b[1].total - a[1].total).slice(0, 10)
    .map(([op, s], i) => '<tr style="cursor:pointer" onclick="inc_filtro(\'g\',\'' + s.g + '\');inc_filtro(\'op\',' + JSON.stringify(op).replace(/"/g, '&quot;') + ')" title="Ver os casos"><td style="color:#64748b">' + (i + 1) + '</td><td>' + esc(op) + '</td><td>' + esc(s.g) + '</td>'
      + '<td style="text-align:right;font-family:var(--font-mono)">' + (s.nc || '') + '</td><td style="text-align:right;font-family:var(--font-mono)"><b>' + s.total + '</b></td></tr>').join('');
  // tendência do ano (do índice)
  const ano = _incMes.split('_')[0], maxT = Math.max(1, ...Object.values(_incIndice).map(x => (x.resumo || {}).total || 0));
  const tend = _INC_MESES.map((m, i) => { const k = ano + '_' + String(i + 1).padStart(2, '0'), t = _incIndice[k] && _incIndice[k].resumo ? _incIndice[k].resumo.total : null;
    return '<div style="flex:1;text-align:center;min-width:0"><div style="height:60px;display:flex;align-items:flex-end;justify-content:center"><div title="' + m + ': ' + (t == null ? 'sem análise' : t + ' apontamentos') + '" style="width:70%;height:' + (t == null ? 2 : Math.max(3, t / maxT * 60)) + 'px;background:' + (k === _incMes ? '#2563eb' : t == null ? '#e2e8f0' : '#94a3b8') + ';border-radius:2px 2px 0 0"></div></div>'
      + '<div style="font-size:.7rem;color:' + (k === _incMes ? '#1d4ed8' : '#64748b') + '">' + m + '</div><div style="font-size:.7rem;font-family:var(--font-mono);color:#0f2742">' + (t == null ? '' : t) + '</div></div>'; }).join('');
  const per = d.periodo ? d.periodo.de + ' a ' + d.periodo.ate : '';
  return kpis + '<div style="font-size:.76rem;color:#64748b;margin:-4px 0 10px">Período: ' + esc(per) + ' · gerado em ' + esc(new Date(d.geradoEm).toLocaleString('pt-BR')) + ' · guarnição pela escala do CME</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:14px;margin-bottom:14px">'
    + '<div style="border:1px solid #e2e8f0;border-top:3px solid #0f2742;border-radius:8px;padding:10px 12px;min-width:0"><div style="font-weight:700;margin-bottom:6px">Por guarnição</div>'
    + '<div class="table-scroll"><table class="data-table"><thead><tr><th>Guarnição</th><th>Serv.</th>' + Object.values(_INC_CAT).map(c => '<th title="' + esc(c.dica) + '">' + c.rot + '</th>').join('') + '<th>Total</th><th></th><th></th></tr></thead><tbody>' + guar + '</tbody></table></div></div>'
    + '<div style="border:1px solid #e2e8f0;border-top:3px solid #dc2626;border-radius:8px;padding:10px 12px;min-width:0"><div style="font-weight:700;margin-bottom:6px">Servidores com mais apontamentos</div>'
    + '<div class="table-scroll"><table class="data-table"><thead><tr><th>#</th><th>Servidor</th><th>Guarnição</th><th>Não confirm.</th><th>Total</th></tr></thead><tbody>' + top + '</tbody></table></div></div></div>'
    + '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;margin-bottom:14px"><div style="font-weight:700;margin-bottom:4px">Apontamentos por mês (' + ano + ')</div><div style="display:flex;gap:4px">' + tend + '</div></div>';
}

function _incFiltrar(d) {
  const q = String(_incF.q || '').trim().toUpperCase();
  return (d.casos || []).filter(c => (!_incF.g || c.g === _incF.g) && (!_incF.op || c.op === _incF.op) && (!_incF.cat || c.cat === _incF.cat) && (!_incF.t || c.t === _incF.t)
    && (!q || String(c.id).includes(q) || String(c.mon || '').toUpperCase().includes(q) || String(c.op || '').toUpperCase().includes(q)));
}
function _incConsulta(d) {
  const sel = (campo, opts, rot) => '<label style="font-size:.78rem;color:#64748b">' + rot + ' <select onchange="inc_filtro(\'' + campo + '\',this.value)" style="margin-left:2px;padding:3px 6px;border:1px solid #cbd5e1;border-radius:6px;font-size:.8rem"><option value="">todos</option>'
    + opts.map(([v, r]) => '<option value="' + esc(v) + '"' + (v === _incF[campo] ? ' selected' : '') + '>' + esc(r) + '</option>').join('') + '</select></label>';
  const gs = _INC_GUAR.filter(g => (d.casos || []).some(c => c.g === g)).map(g => [g, g]);
  const ops = [...new Set((d.casos || []).filter(c => !_incF.g || c.g === _incF.g).map(c => c.op))].sort().map(o => [o, o]);
  const lista = _incFiltrar(d);
  const linhas = lista.slice(0, _incLimite).map(c => '<tr><td style="white-space:nowrap;font-family:var(--font-mono)">' + esc(c.id) + '<br><span style="font-size:.72rem;color:#64748b">' + esc(c.d) + '</span></td>'
    + '<td>' + esc(c.g) + '</td><td>' + esc(c.op) + '</td><td>' + esc(c.mon) + '</td><td>' + (c.t === 'B' ? 'Bateria' : 'Zona exc.') + '</td>'
    + '<td><span style="display:inline-block;padding:1px 6px;border-radius:3px;border-left:2px solid ' + _INC_CAT[c.cat].cor + ';color:' + _INC_CAT[c.cat].cor + ';font-size:.72rem;font-weight:700">' + esc(_INC_CAT[c.cat].rot) + '</span></td>'
    + '<td>' + esc(c.marcou) + '</td><td><b>' + esc(c.correto) + '</b></td><td style="min-width:260px">' + esc(c.motivo) + (c.com ? '<div style="font-size:.76rem;color:#475569;font-style:italic;margin-top:2px">“' + esc(c.com) + '”</div>' : '') + '</td></tr>').join('');
  return '<div style="border:1px solid #e2e8f0;border-top:3px solid #2563eb;border-radius:8px;padding:10px 12px">'
    + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px"><div style="font-weight:700">Consulta</div>'
    + sel('g', gs, 'Guarnição') + sel('op', ops, 'Servidor') + sel('cat', Object.entries(_INC_CAT).map(([k, c]) => [k, c.rot]), 'Tipo') + sel('t', [['Z', 'Zona de exclusão'], ['B', 'Bateria']], 'Ocorrência')
    + '<input type="search" placeholder="ID, monitorado ou servidor" value="' + esc(_incF.q) + '" onchange="inc_filtro(\'q\',this.value)" style="padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:.8rem;min-width:200px">'
    + '<span style="font-size:.78rem;color:#64748b">' + lista.length + ' resultado(s)</span>'
    + (_incF.g ? '<button class="btn-secondary" style="padding:3px 9px;font-size:.76rem" onclick="inc_pdfGuarnicao(\'' + _incF.g + '\')">\u{1F5A8}\u{FE0F} PDF da ' + esc(_incF.g) + '</button>' : '') + '</div>'
    + (lista.length ? '<div class="table-scroll"><table class="data-table"><thead><tr><th>Ocorrência</th><th>Guarnição</th><th>Servidor</th><th>Monitorado</th><th>Ocorr.</th><th>Inconsistência</th><th>Marcou</th><th>Correto</th><th>Motivo</th></tr></thead><tbody>' + linhas + '</tbody></table></div>'
      + (lista.length > _incLimite ? '<div style="text-align:center;margin-top:8px"><button class="btn-secondary" onclick="inc_maisLinhas()">Mostrar mais (' + (lista.length - _incLimite) + ')</button></div>' : '')
      : '<div style="padding:10px 0;color:#94a3b8">Nenhum caso com esses filtros.</div>') + '</div>';
}

// PDF do resumo de UMA guarnição (o mesmo formato enviado à gerência): resumo por servidor + 1 linha por ocorrência.
function inc_pdfGuarnicao(g) {
  const d = _incDados[_incMes]; if (!d) return;
  const casos = (d.casos || []).filter(c => c.g === g); if (!casos.length) { _mostrarToast('Sem casos para ' + g + '.', 'aviso'); return; }
  const porOp = {}; casos.forEach(c => (porOp[c.op] = porOp[c.op] || []).push(c));
  const servs = Object.entries(porOp).sort((a, b) => b[1].length - a[1].length);
  const conta = l => { const t = { nc: 0, tx: 0, cf: 0, bat: 0 }; l.forEach(c => t[c.cat]++); return t; };
  const [ano, mes] = _incMes.split('_'), per = d.periodo ? d.periodo.de + ' a ' + d.periodo.ate : _INC_MESES_EXT[+mes - 1] + ' de ' + ano;
  const logo = (b) => b ? '<img src="data:image/png;base64,' + b + '" style="max-width:54px;max-height:54px">' : '';
  const linha = c => '<tr><td style="text-align:center;white-space:nowrap">' + esc(c.id) + '<br><span style="font-size:8pt;color:#333">' + esc(c.d.slice(0, 5) + ' ' + c.d.slice(11, 16)) + '</span></td><td>' + esc(c.mon) + '</td><td style="text-align:center">' + (c.t === 'B' ? 'Bateria' : 'Zona exc.') + '</td><td>' + esc(c.marcou) + '</td><td><b>' + esc(c.correto) + '</b></td><td>' + esc(c.motivo) + (c.com ? ' Texto: “' + esc(c.com.length > 90 ? c.com.slice(0, 89) + '…' : c.com) + '”' : '') + '</td></tr>';
  const resumo = servs.map(([op, l]) => { const t = conta(l); return '<tr><td>' + esc(op) + '</td><td class="n">' + t.nc + '</td><td class="n">' + t.tx + '</td><td class="n">' + t.cf + '</td><td class="n">' + t.bat + '</td><td class="n"><b>' + l.length + '</b></td></tr>'; }).join('');
  const blocos = servs.map(([op, l]) => '<h2>' + esc(op) + ' — ' + l.length + ' ocorrência(s)</h2><table class="t"><tr><th style="width:70px">Ocorrência</th><th style="width:150px">Monitorado</th><th style="width:58px">Tipo</th><th style="width:95px">Marcou</th><th style="width:110px">Correto</th><th>Motivo</th></tr>' + l.map(linha).join('') + '</table>').join('');
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Inconsistências – ' + g + ' – ' + _incRot(_incMes) + '</title><style>'
    + '@page{size:A4 landscape;margin:1.4cm}body{font-family:"Times New Roman",Times,serif;font-size:11pt;line-height:1.3;color:#000;margin:0}'
    + '.cab{display:flex;align-items:center;gap:12px;border-bottom:1px solid #000;padding-bottom:6px;margin-bottom:8px}.ct{flex:1;text-align:center;font-size:9.5pt;font-weight:bold}'
    + 'h1{font-size:12pt;text-align:center;margin:0 0 6px}h2{font-size:11pt;margin:10px 0 4px;border-bottom:1px solid #000;page-break-after:avoid}ul{margin:2px 0 6px;padding-left:18px;font-size:10pt}'
    + 'table.t{width:100%;border-collapse:collapse;font-size:9pt;margin:4px 0}table.t th,table.t td{border:1px solid #000;padding:1px 4px;vertical-align:top}table.t th{background:#e6e6e6}td.n{text-align:center}tr{page-break-inside:avoid}'
    + '.fe{margin-top:14px;display:flex;justify-content:space-between;align-items:flex-end;page-break-inside:avoid}</style></head><body>'
    + '<div class="cab">' + logo(window._CME_LOGO_B64) + '<div class="ct">GOVERNO DO ESTADO DO AMAPÁ · SECRETARIA DE ESTADO DE JUSTIÇA E SEGURANÇA PÚBLICA<br>INSTITUTO DE ADMINISTRAÇÃO PENITENCIÁRIA DO AMAPÁ · CENTRAL DE MONITORAMENTO ELETRÔNICO – CME</div>' + logo(window._IAPEN_LOGO_B64) + '</div>'
    + '<h1>INCONSISTÊNCIAS NO TRATAMENTO DE OCORRÊNCIAS — ' + (g === 'EXPEDIENTE' ? 'EXPEDIENTE' : 'GUARNIÇÃO ' + esc(g)) + '</h1>'
    + '<p style="margin:0 0 4px"><b>Período:</b> ' + esc(per) + '. Documento <b>orientativo</b>: compara, no Sistema AKILES, o procedimento marcado, o comentário registrado e o rastreamento da tornozeleira, segundo as orientações da Gerência:</p>'
    + '<ul><li><b>Zona de exclusão:</b> passou por dentro da zona (mesmo só de passagem) = <b>6. Violação confirmada</b>; só pela zona de advertência = 7. Não confirmada. O comentário deve concordar com a marcação.</li>'
    + '<li><b>Bateria:</b> arquivar <b>somente após o restabelecimento</b>; descarregamento <b>acima de 15 min</b> = <b>6. Violação confirmada</b> (até 15 min, a critério do operador).</li>'
    + '<li>GPS com margem de 15 m e pelo menos 2 leituras dentro da zona (casos na borda não foram apontados). “Conferir” = pode ser alteração posterior no desenho da zona.</li></ul>'
    + '<table class="t"><tr><th>Servidor(a)</th><th style="width:120px">Violação não confirmada</th><th style="width:110px">Texto × marcação</th><th style="width:80px">A conferir</th><th style="width:70px">Bateria</th><th style="width:50px">Total</th></tr>' + resumo + '</table>'
    + blocos + '<div class="fe"><div>Macapá-AP, ' + new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) + '.</div><div style="text-align:center"><b>' + esc(usuarioAtual?.nome || '') + '</b><br>Gerência – Central de Monitoramento Eletrônico (CME/IAPEN)</div></div>'
    + '<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>';
  const w = window.open('', '_blank');
  if (!w) { _entregarDoc(new Blob([html], { type: 'text/html' }), 'Inconsistencias_' + g + '_' + _incMes + '.html'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
