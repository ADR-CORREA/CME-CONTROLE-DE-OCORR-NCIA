/* ═══════════════════════════ SECRETARIA — FÉRIAS E LICENÇAS ═══════════════════════════
   Afastamentos dos servidores (férias e licenças) por mês e ano, com a portaria anexa.
   • Dados: cme_secretaria.afastamentos (mesma chave restrita da Secretaria).
   • Anexos: Worker /sec/* na pasta afastamentos/<id> (auditado; apagar vai para a lixeira).
   • Aviso de conflito: outra pessoa da MESMA equipe afastada no mesmo período.
   Depende de secretaria.js (carregado antes). Emojis só por \u{...}. */

const _SEC_TIPOS_AFA = [
  ['Férias', '#0d9488'], ['Licença-prêmio', '#7c3aed'], ['Licença para tratamento de saúde', '#dc2626'],
  ['Licença maternidade', '#db2777'], ['Licença paternidade', '#2563eb'], ['Licença por doença em pessoa da família', '#ea580c'],
  ['Licença para capacitação', '#0891b2'], ['Licença sem vencimento', '#64748b'], ['Outro afastamento', '#475569'],
];
const _SEC_MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
let _secFeriasVisao = 'mes';

function _secCorTipo(t) { const x = _SEC_TIPOS_AFA.find(a => a[0] === t); return x ? x[1] : '#475569'; }
function _secDias(ini, fim) { return Math.round((new Date(fim + 'T12:00:00') - new Date(ini + 'T12:00:00')) / 864e5) + 1; }
function _secMaisDias(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function _secSobrepoe(a, ini, fim) { return a.inicio <= fim && a.fim >= ini; }
function _secAfastamentoEm(servId, dia, d) { return (d || _secDados()).afastamentos.find(a => a.servidorId === servId && _secSobrepoe(a, dia, dia)) || null; }
function _secBRc(iso) { return _secBR(iso).slice(0, 5); } // dd/mm

// Selo "Férias até 20/10" na lista e no perfil
function _secSeloForaHoje(servId, d) {
  const a = _secAfastamentoEm(servId, _secHoje(), d); if (!a) return '';
  return '<span class="idv-etq in" title="' + esc(a.tipo + ' de ' + _secBR(a.inicio) + ' a ' + _secBR(a.fim)) + '">' + esc(a.tipo === 'Férias' ? 'Férias' : 'Licença') + ' até ' + _secBRc(a.fim) + '</span>';
}

// ── Aba geral ─────────────────────────────────────────────────────────────────
function sec_renderFerias() {
  const c = document.getElementById('sec-conteudo'); if (!c) return;
  const d = _secDados(), hoje = _secHoje();
  const fMes = document.getElementById('sec-fe-mes')?.value || hoje.slice(0, 7);
  const fAno = +(document.getElementById('sec-fe-ano')?.value || hoje.slice(0, 4));
  const fTipo = document.getElementById('sec-fe-tipo')?.value || '';
  const foraHoje = d.afastamentos.filter(a => _secSobrepoe(a, hoje, hoje));
  const em30 = d.afastamentos.filter(a => a.inicio > hoje && a.inicio <= _secMaisDias(hoje, 30));
  const nome = id => _secNomeServ(id, d);
  c.innerHTML = '<div class="idv-kpis" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-bottom:12px">'
    + '<div class="idv-kpi in"><div class="idv-num">' + foraHoje.length + '</div><div class="idv-rot">Afastados hoje</div>'
    + '<div class="idv-leg">' + (foraHoje.map(a => esc(nome(a.servidorId).split(' ')[0]) + ' (' + esc(a.tipo === 'Férias' ? 'férias' : 'licença') + ' até ' + _secBRc(a.fim) + ')').join(', ') || '—') + '</div></div>'
    + '<div class="idv-kpi at"><div class="idv-num">' + em30.length + '</div><div class="idv-rot">Começam nos próximos 30 dias</div>'
    + '<div class="idv-leg">' + (em30.sort((a, b) => a.inicio.localeCompare(b.inicio)).map(a => esc(nome(a.servidorId).split(' ')[0]) + ' (' + _secBRc(a.inicio) + ')').join(', ') || '—') + '</div></div></div>'
    + '<div class="table-toolbar" style="flex-wrap:wrap;gap:8px">'
    + '<div class="sub-tabs" style="margin:0">' + [['mes', 'Por mês'], ['ano', 'Escala do ano']].map(([k, r]) => '<div class="sub-tab' + (k === _secFeriasVisao ? ' active' : '') + '" onclick="_secFeriasVisao=\'' + k + '\';sec_renderFerias()">' + r + '</div>').join('') + '</div>'
    + (_secFeriasVisao === 'mes'
      ? '<label style="font-size:14px">Mês <input type="month" id="sec-fe-mes" value="' + esc(fMes) + '" onchange="sec_renderFerias()"></label>'
      : '<label style="font-size:14px">Ano <input type="number" id="sec-fe-ano" value="' + fAno + '" min="2020" max="2100" style="width:90px" onchange="sec_renderFerias()"></label>')
    + '<select id="sec-fe-tipo" onchange="sec_renderFerias()"><option value="">Todos os tipos</option>' + _SEC_TIPOS_AFA.map(([t]) => '<option' + (t === fTipo ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>'
    + '<span style="flex:1"></span><button class="btn-secondary" onclick="sec_exportarFerias(' + (_secFeriasVisao === 'ano' ? fAno : +fMes.slice(0, 4)) + ')">Exportar ano (Excel)</button>'
    + '<button class="btn-primary" onclick="sec_novoAfastamento()">+ Lançar férias / licença</button></div><div id="sec-fe-corpo"></div>';
  const corpo = document.getElementById('sec-fe-corpo');
  const base = d.afastamentos.filter(a => !fTipo || a.tipo === fTipo);
  if (_secFeriasVisao === 'ano') { corpo.innerHTML = _secHtmlEscalaAno(base, fAno, d); return; }
  const ini = fMes + '-01', fim = _secMaisDias(_secMaisDias(ini, 31).slice(0, 7) + '-01', -1);
  const lista = base.filter(a => _secSobrepoe(a, ini, fim)).sort((a, b) => a.inicio.localeCompare(b.inicio));
  corpo.innerHTML = _secHtmlTabelaAfa(lista, true, d, 'Nenhuma férias ou licença em ' + _SEC_MESES[+fMes.slice(5) - 1] + '/' + fMes.slice(0, 4) + '.');
}
function _secHtmlTabelaAfa(lista, comNome, d, vazio) {
  const hoje = _secHoje();
  return '<div class="table-scroll"><table class="data-table idv-tabela"><thead><tr>' + (comNome ? '<th>Servidor</th><th>Equipe</th>' : '') + '<th>Tipo</th><th>Período</th><th>Dias</th><th>Portaria</th><th>Exercício</th><th>Anexos</th><th></th></tr></thead><tbody>'
    + (lista.length ? lista.map(a => {
      const s = _secServ(a.servidorId, d) || {}, cor = _secCorTipo(a.tipo), agora = _secSobrepoe(a, hoje, hoje);
      const anexos = (a.anexos || []).map(x => '<a href="#" title="Abrir" onclick="sec_abrirDoc(\'' + encodeURIComponent(x.key) + '\',\'' + _jsq(x.nome) + '\');return false">\u{1F4CE} ' + esc(x.nome.length > 22 ? x.nome.slice(0, 20) + '…' : x.nome) + '</a>').join('<br>');
      return '<tr' + (agora ? ' style="box-shadow:inset 3px 0 0 var(--idv-in)"' : '') + '>' + (comNome ? '<td><a href="#" onclick="sec_abrirPerfil(\'' + a.servidorId + '\');return false"><strong>' + esc(s.nome || '(removido)') + '</strong></a></td><td>' + esc(s.equipe || '—') + '</td>' : '')
        + '<td><span style="display:inline-block;width:8px;height:8px;background:' + cor + ';margin-right:6px"></span>' + esc(a.tipo) + (agora ? ' <span class="idv-etq in">EM CURSO</span>' : '') + '</td>'
        + '<td class="idv-data" style="white-space:nowrap">' + _secBR(a.inicio) + ' a ' + _secBR(a.fim) + '</td><td class="idv-data">' + _secDias(a.inicio, a.fim) + '</td>'
        + '<td>' + esc(a.portaria || '—') + '</td><td>' + esc(a.exercicio || '—') + '</td>'
        + '<td style="font-size:13px">' + (anexos || '<span class="idv-etq at">sem portaria anexa</span>') + '</td>'
        + '<td style="white-space:nowrap"><label class="btn-sm btn-outline" style="cursor:pointer">Anexar<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" style="display:none" onchange="sec_anexarAfastamento(this,\'' + a.id + '\')"></label> '
        + '<button class="btn-sm btn-outline" onclick="sec_novoAfastamento(\'' + a.servidorId + '\',\'' + a.id + '\')">Editar</button> '
        + '<button class="btn-sm btn-danger" onclick="sec_excluirAfastamento(\'' + a.id + '\')">Excluir</button></td></tr>';
    }).join('') : '<tr><td colspan="' + (comNome ? 9 : 7) + '" class="idv-vazio">' + vazio + '</td></tr>')
    + '</tbody></table></div>';
}
function _secHtmlEscalaAno(base, ano, d) {
  const servs = d.servidores.filter(s => (s.situacao || 'ativo') === 'ativo' || base.some(a => a.servidorId === s.id && a.inicio.slice(0, 4) <= String(ano) && a.fim.slice(0, 4) >= String(ano)))
    .sort((a, b) => String(a.equipe || '').localeCompare(String(b.equipe || '')) || a.nome.localeCompare(b.nome));
  if (!servs.length) return '<div class="idv-vazio">Cadastre os servidores para ver a escala.</div>';
  const mesAtual = _secHoje().slice(0, 7);
  return '<div style="font-size:13px;color:var(--idv-sec);margin:4px 0 8px">Clique num servidor para abrir o perfil. Cada cor é um tipo de afastamento.</div>'
    + '<div class="table-scroll"><table class="data-table idv-tabela" style="font-size:13px"><thead><tr><th>Servidor</th><th>Equipe</th>'
    + _SEC_MESES.map((m, i) => '<th style="text-align:center' + (ano + '-' + String(i + 1).padStart(2, '0') === mesAtual ? ';background:var(--idv-in-f);color:var(--idv-in)' : '') + '">' + m + '</th>').join('') + '</tr></thead><tbody>'
    + servs.map(s => '<tr><td style="white-space:nowrap"><a href="#" onclick="sec_abrirPerfil(\'' + s.id + '\');return false">' + esc(s.nome) + '</a></td><td>' + esc(s.equipe || '—') + '</td>'
      + _SEC_MESES.map((m, i) => {
        const ini = ano + '-' + String(i + 1).padStart(2, '0') + '-01', fim = _secMaisDias(_secMaisDias(ini, 31).slice(0, 7) + '-01', -1);
        const as = base.filter(a => a.servidorId === s.id && _secSobrepoe(a, ini, fim));
        return '<td style="padding:3px;min-width:58px">' + as.map(a => {
          const di = a.inicio < ini ? ini : a.inicio, df = a.fim > fim ? fim : a.fim;
          return '<div title="' + esc(a.tipo + ': ' + _secBR(a.inicio) + ' a ' + _secBR(a.fim)) + '" style="background:' + _secCorTipo(a.tipo) + ';color:#fff;border-radius:2px;padding:1px 4px;margin:1px 0;white-space:nowrap">'
            + di.slice(8) + '–' + df.slice(8) + '</div>';
        }).join('') + '</td>';
      }).join('') + '</tr>').join('')
    + '</tbody></table></div><div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;color:var(--idv-sec);margin-top:8px">'
    + _SEC_TIPOS_AFA.map(([t, c]) => '<span><span style="display:inline-block;width:10px;height:10px;background:' + c + ';margin-right:4px"></span>' + t + '</span>').join('') + '</div>';
}

// ── Perfil do servidor ────────────────────────────────────────────────────────
function _secHtmlAfastamentosServidor(s, d) {
  const lista = d.afastamentos.filter(a => a.servidorId === s.id).sort((a, b) => b.inicio.localeCompare(a.inicio));
  const ano = _secHoje().slice(0, 4);
  const feriasAno = lista.filter(a => a.tipo === 'Férias' && (a.exercicio === ano || (!a.exercicio && a.inicio.slice(0, 4) === ano))).reduce((t, a) => t + _secDias(a.inicio, a.fim), 0);
  return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">'
    + '<div style="font-size:14px;color:var(--idv-sec)">Férias do exercício ' + ano + ': <b>' + feriasAno + ' dia(s)</b> lançados</div>'
    + '<button class="btn-primary" onclick="sec_novoAfastamento(\'' + s.id + '\')">+ Lançar férias / licença</button></div>'
    + _secHtmlTabelaAfa(lista, false, d, 'Nenhuma férias ou licença lançada.');
}

// ── Lançar / editar ───────────────────────────────────────────────────────────
function sec_novoAfastamento(servidorId, id) {
  const d = _secDados(), a = id ? (d.afastamentos.find(x => x.id === id) || {}) : {};
  const servs = d.servidores.filter(s => (s.situacao || 'ativo') === 'ativo' || s.id === servidorId).sort((x, y) => x.nome.localeCompare(y.nome));
  if (!servs.length) { _mostrarToast('Cadastre os servidores antes.', 'erro'); return; }
  const tipo = a.tipo || 'Férias';
  _secModal(id ? 'Editar férias / licença' : 'Lançar férias ou licença',
    '<div class="form-field"><label>Servidor</label><select id="sec-af-serv">' + servs.map(s => '<option value="' + s.id + '"' + (s.id === (a.servidorId || servidorId) ? ' selected' : '') + '>' + esc(s.nome) + (s.equipe ? ' — ' + esc(s.equipe) : '') + '</option>').join('') + '</select></div>'
    + '<div class="form-field"><label>Tipo</label><select id="sec-af-tipo">' + _SEC_TIPOS_AFA.map(([t]) => '<option' + (t === tipo ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></div>'
    + '<div class="form-grid">' + _secCampo('sec-af-ini', 'Início', a.inicio || '', 'type="date" oninput="_secAfaCalc(\'ini\')"')
    + _secCampo('sec-af-dias', 'Quantidade de dias', a.inicio ? String(_secDias(a.inicio, a.fim)) : '', 'type="number" min="1" max="730" oninput="_secAfaCalc(\'dias\')"')
    + _secCampo('sec-af-fim', 'Fim (último dia)', a.fim || '', 'type="date" oninput="_secAfaCalc(\'fim\')"') + '</div>'
    + '<div style="display:flex;gap:6px;margin:-4px 0 10px;flex-wrap:wrap">' + [10, 15, 20, 30].map(n => '<button type="button" class="btn-sm btn-outline" onclick="document.getElementById(\'sec-af-dias\').value=' + n + ';_secAfaCalc(\'dias\')">' + n + ' dias</button>').join('') + '</div>'
    + '<div class="form-grid">' + _secCampo('sec-af-portaria', 'Nº da portaria', a.portaria || '', 'placeholder="Ex.: 123/2026-IAPEN"')
    + _secCampo('sec-af-exercicio', 'Exercício (ano de referência)', a.exercicio || '', 'placeholder="Ex.: 2026" inputmode="numeric"') + '</div>'
    + '<div class="form-field"><label>Observação</label><input id="sec-af-obs" value="' + esc(a.obs || '') + '"></div>'
    + (id ? '' : '<div class="form-field"><label>Portaria / documento (opcional — pode anexar depois)</label><input type="file" id="sec-af-arq" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"></div>')
    + '<div id="sec-af-aviso" style="font-size:13px;color:var(--idv-at)"></div>',
    '<button class="btn-primary" onclick="sec_salvarAfastamento(\'' + (id || '') + '\')">Salvar</button>', 620);
}
// Início + dias → fim; início + fim → dias (o que a pessoa preencher por último manda).
function _secAfaCalc(origem) {
  const ini = _secVal('sec-af-ini'), dias = +_secVal('sec-af-dias'), fimEl = document.getElementById('sec-af-fim'), diasEl = document.getElementById('sec-af-dias');
  if (!ini) return;
  if (origem !== 'fim' && dias > 0) fimEl.value = _secMaisDias(ini, dias - 1);
  else if (origem === 'fim' && fimEl.value >= ini) diasEl.value = _secDias(ini, fimEl.value);
}
async function sec_salvarAfastamento(id) {
  const v = { servidorId: _secVal('sec-af-serv'), tipo: _secVal('sec-af-tipo'), inicio: _secVal('sec-af-ini'), fim: _secVal('sec-af-fim'),
    portaria: _secVal('sec-af-portaria'), exercicio: _secVal('sec-af-exercicio'), obs: _secVal('sec-af-obs') };
  if (!v.servidorId || !v.inicio || !v.fim) { _mostrarToast('Informe o servidor, o início e o fim (ou a quantidade de dias).', 'erro'); return; }
  if (v.fim < v.inicio) { _mostrarToast('O fim é anterior ao início.', 'erro'); return; }
  if (_secDias(v.inicio, v.fim) > 730) { _mostrarToast('Período longo demais (máximo de 2 anos).', 'erro'); return; }
  if (v.exercicio && !/^\d{4}$/.test(v.exercicio)) { _mostrarToast('Exercício deve ser o ano, ex.: 2026.', 'erro'); return; }
  const d = _secDados(), s = _secServ(v.servidorId, d) || {};
  const proprio = d.afastamentos.find(a => a.id !== id && a.servidorId === v.servidorId && _secSobrepoe(a, v.inicio, v.fim));
  if (proprio) { _mostrarToast('Esse servidor já tem ' + proprio.tipo.toLowerCase() + ' de ' + _secBR(proprio.inicio) + ' a ' + _secBR(proprio.fim) + ' nesse período.', 'erro'); return; }
  // conflito na mesma equipe (escala): avisa, mas deixa a gerência decidir
  if (s.equipe) {
    const mesmos = d.afastamentos.filter(a => a.id !== id && a.servidorId !== v.servidorId && _secSobrepoe(a, v.inicio, v.fim) && (_secServ(a.servidorId, d) || {}).equipe === s.equipe);
    if (mesmos.length && !confirm('Atenção: na equipe ' + s.equipe + ' já há afastamento no mesmo período:\n\n'
      + mesmos.map(a => '• ' + _secNomeServ(a.servidorId, d) + ' — ' + a.tipo + ' de ' + _secBR(a.inicio) + ' a ' + _secBR(a.fim)).join('\n') + '\n\nLançar mesmo assim?')) return;
  }
  const arq = !id && document.getElementById('sec-af-arq')?.files[0];
  if (arq && arq.size > 15 * 1024 * 1024) { _mostrarToast('Arquivo maior que 15 MB.', 'erro'); return; }
  const agora = new Date().toISOString(), por = usuarioAtual ? usuarioAtual.nome : '';
  let novoId = id;
  const ok = await _secMutar(dd => {
    if (id) { const a = dd.afastamentos.find(x => x.id === id); if (!a) return false; Object.assign(a, v, { editadoPor: por, editadoEm: agora }); }
    else { novoId = _secId('afa'); dd.afastamentos.push(Object.assign({ id: novoId, anexos: [], criadoPor: por, criadoEm: agora }, v)); }
  }, { action: id ? 'sec_afast_editar' : 'sec_afast_lancar', alvo: s.nome || '', detalhe: v.tipo + ' de ' + _secBR(v.inicio) + ' a ' + _secBR(v.fim) + (v.portaria ? ' · portaria ' + v.portaria : '') });
  if (!ok) return;
  _secFecharModal(); _mostrarToast((v.tipo === 'Férias' ? 'Férias lançadas' : 'Licença lançada') + '.', 'sucesso');
  if (arq) await _secAnexarArquivoAfa(novoId, arq);
  sec_render();
}
async function sec_excluirAfastamento(id) {
  const d = _secDados(), a = d.afastamentos.find(x => x.id === id); if (!a) return;
  if (!confirm('Excluir ' + a.tipo.toLowerCase() + ' de ' + _secNomeServ(a.servidorId, d) + ' (' + _secBR(a.inicio) + ' a ' + _secBR(a.fim) + ')?\nO lançamento fica guardado na lixeira; os anexos continuam guardados.')) return;
  const ok = await _secMutar(dd => {
    const i = dd.afastamentos.findIndex(x => x.id === id); if (i < 0) return false;
    _secParaLixeira(dd, 'afastamento', dd.afastamentos[i]); dd.afastamentos.splice(i, 1);
  }, { action: 'sec_afast_excluir', alvo: _secNomeServ(a.servidorId, d), detalhe: a.tipo + ' de ' + _secBR(a.inicio) + ' a ' + _secBR(a.fim) });
  if (ok) sec_render();
}

// ── Anexos (portaria) ─────────────────────────────────────────────────────────
async function _secAnexarArquivoAfa(id, f) {
  const d = _secDados(), a = d.afastamentos.find(x => x.id === id); if (!a) return false;
  try {
    _mostrarToast('Enviando ' + f.name + '…');
    const r = await r2_api('POST', '/sec/upload', { 'Content-Type': 'application/json' }, JSON.stringify({ pasta: 'afastamentos/' + id, nome: f.name, conteudo: await _secLerArquivo(f),
      descricao: a.tipo + ' ' + _secBR(a.inicio) + ' a ' + _secBR(a.fim), referencia: _secNomeServ(a.servidorId, d) }));
    await _secMutar(dd => { const x = dd.afastamentos.find(y => y.id === id); if (!x) return false; (x.anexos = x.anexos || []).push({ key: r.key, nome: f.name, em: new Date().toISOString(), por: usuarioAtual ? usuarioAtual.nome : '' }); });
    _mostrarToast('Portaria anexada.', 'sucesso');
    return true;
  } catch (e) { _mostrarToast('Não consegui anexar: ' + (e.message || e), 'erro'); return false; }
}
async function sec_anexarAfastamento(input, id) {
  const f = input.files && input.files[0]; input.value = ''; if (!f) return;
  if (f.size > 15 * 1024 * 1024) { _mostrarToast('Arquivo maior que 15 MB.', 'erro'); return; }
  await _secAnexarArquivoAfa(id, f); sec_render();
}

// ── Exportar a escala do ano (Excel) ──────────────────────────────────────────
function sec_exportarFerias(ano) {
  const d = _secDados(), A = String(ano);
  const lista = d.afastamentos.filter(a => a.inicio.slice(0, 4) <= A && a.fim.slice(0, 4) >= A).sort((a, b) => a.inicio.localeCompare(b.inicio));
  if (!lista.length) { _mostrarToast('Nenhuma férias ou licença em ' + A + '.', 'erro'); return; }
  const rows = lista.map(a => { const s = _secServ(a.servidorId, d) || {}; return { 'Servidor': s.nome || '', 'Matrícula': s.matricula || '', 'Equipe': s.equipe || '', 'Tipo': a.tipo,
    'Início': _secBR(a.inicio), 'Fim': _secBR(a.fim), 'Dias': _secDias(a.inicio, a.fim), 'Portaria': a.portaria || '', 'Exercício': a.exercicio || '', 'Anexos': (a.anexos || []).length, 'Observação': a.obs || '' }; });
  const wb = XLSX.utils.book_new(), ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 36 }, { wch: 12 }, { wch: 12 }, { wch: 34 }, { wch: 11 }, { wch: 11 }, { wch: 6 }, { wch: 18 }, { wch: 10 }, { wch: 8 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Férias e licenças ' + A);
  XLSX.writeFile(wb, 'Ferias_e_Licencas_CME_' + A + '.xlsx');
  auditar({ modulo: 'Secretaria', action: 'sec_afast_exportar', alvo: 'Escala ' + A, detalhe: lista.length + ' lançamento(s)' });
}

Object.assign(_SEC_ACOES, { sec_afast_lancar: 'Lançou férias/licença', sec_afast_editar: 'Editou férias/licença', sec_afast_excluir: 'Excluiu férias/licença', sec_afast_exportar: 'Exportou escala de férias' });
