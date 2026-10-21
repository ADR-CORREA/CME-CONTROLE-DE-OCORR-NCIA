/* ═══════════════════════════ SECRETARIA — AGENDA DE COMPROMISSOS ═══════════════════════════
   Calendário do mês com os compromissos coloridos por categoria; clicar no dia mostra a lista.
   Compromisso NÃO concluído continua aparecendo nos dias seguintes ("atrasado desde…") — no dia
   de hoje, no painel Hoje e no contador do menu — até alguém marcar como concluído.
   • Dados: cme_secretaria.compromissos; categorias (nome + cor) em cme_secretaria.config.categorias.
   Depende de secretaria*.js. Emojis só por \u{...}. */

const _SEC_CAT_PADRAO = [
  { nome: 'Reunião', cor: '#2563eb' }, { nome: 'Prazo / Ofício', cor: '#dc2626' }, { nome: 'PRODOC / Documento', cor: '#7c3aed' },
  { nome: 'Escala / Plantão', cor: '#0d9488' }, { nome: 'Pessoal / RH', cor: '#db2777' }, { nome: 'Evento / Apoio', cor: '#d97706' }, { nome: 'Outros', cor: '#64748b' },
];
const _SEC_DIAS_SEM = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
let _secAgMes = null, _secAgDia = null, _secAgOcultas = new Set();

function _secCategorias(d) { const c = ((d || _secDados()).config || {}).categorias; return Array.isArray(c) && c.length ? c : _SEC_CAT_PADRAO; }
function _secCorCat(nome, d) { const c = _secCategorias(d).find(x => x.nome === nome); return c ? c.cor : '#64748b'; }
function _secDiasEntre(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }
// pendentes que já deviam ter sido feitos (hoje ou antes) — os que "carregam" para os dias seguintes
function _secCompromissosPendentes(d) { const hoje = _secHoje(); return (d || _secDados()).compromissos.filter(c => !c.concluido && c.data <= hoje); }
function _secOrdHora(a, b) { return String(a.hora || '99').localeCompare(String(b.hora || '99')) || a.titulo.localeCompare(b.titulo); }
function _secDoDia(dia, d) {
  // compromissos do dia; no dia de HOJE entram também os atrasados (não concluídos de dias anteriores)
  const hoje = _secHoje();
  const doDia = d.compromissos.filter(c => c.data === dia);
  const atrasados = dia === hoje ? d.compromissos.filter(c => !c.concluido && c.data < hoje) : [];
  return atrasados.sort((a, b) => a.data.localeCompare(b.data)).concat(doDia.sort(_secOrdHora)).filter(c => !_secAgOcultas.has(c.categoria));
}

// ── Calendário ────────────────────────────────────────────────────────────────
function sec_renderAgenda() {
  const c = document.getElementById('sec-conteudo'); if (!c) return;
  const d = _secDados(), hoje = _secHoje();
  _secAgMes = _secAgMes || hoje.slice(0, 7); _secAgDia = _secAgDia || hoje;
  const [ano, mes] = _secAgMes.split('-').map(Number);
  const primeiro = new Date(ano, mes - 1, 1), ultimo = new Date(ano, mes, 0).getDate(), feriados = (d.config || {}).feriados || [];
  const cats = _secCategorias(d);
  let grade = '';
  for (let i = 0; i < primeiro.getDay(); i++) grade += '<div></div>';
  for (let dia = 1; dia <= ultimo; dia++) {
    const iso = _secAgMes + '-' + String(dia).padStart(2, '0'), itens = _secDoDia(iso, d);
    const sel = iso === _secAgDia, eHoje = iso === hoje, fer = feriados.includes(iso), fds = [0, 6].includes(new Date(iso + 'T12:00:00').getDay());
    grade += '<div onclick="_secAgDia=\'' + iso + '\';sec_renderAgenda()" style="cursor:pointer;min-height:92px;padding:4px 5px;border-radius:6px;border:' + (sel ? '2px solid var(--idv-in)' : '1px solid var(--idv-linha)') + ';background:' + (eHoje ? 'var(--idv-in-f)' : fds ? 'var(--idv-fundo)' : 'var(--idv-cartao)') + ';overflow:hidden">'
      + '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:' + (fer ? 'var(--idv-cr)' : eHoje ? 'var(--idv-in)' : 'var(--idv-texto)') + '"><span class="idv-data">' + dia + '</span>' + (fer ? '<span style="font-size:12px">FERIADO</span>' : eHoje ? '<span style="font-size:12px">HOJE</span>' : '') + '</div>'
      + itens.slice(0, 3).map(x => {
        const atras = !x.concluido && x.data < iso, cor = _secCorCat(x.categoria, d);
        return '<div title="' + esc((x.hora ? x.hora + ' · ' : '') + x.titulo + ' (' + x.categoria + ')') + '" style="margin-top:2px;font-size:12px;line-height:1.25;padding:1px 4px;border-radius:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
          + (x.concluido ? 'background:var(--idv-zebra);color:var(--idv-sec);text-decoration:line-through' : 'background:' + cor + ';color:#fff') + (atras ? ';outline:2px solid var(--idv-cr)' : '') + '">'
          + (atras ? '\u{21BB} ' : '') + (x.hora ? x.hora + ' ' : '') + esc(x.titulo) + '</div>';
      }).join('')
      + (itens.length > 3 ? '<div style="font-size:12px;color:var(--idv-sec);margin-top:2px">+' + (itens.length - 3) + ' mais</div>' : '') + '</div>';
  }
  const nomeMes = primeiro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  c.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">'
    + '<div style="display:flex;align-items:center;gap:6px"><button class="btn-secondary" onclick="sec_agNavegar(-1)">\u{2039}</button>'
    + '<div style="min-width:170px;text-align:center;font-weight:600;font-size:16px;text-transform:capitalize">' + esc(nomeMes) + '</div>'
    + '<button class="btn-secondary" onclick="sec_agNavegar(1)">\u{203A}</button><button class="btn-secondary" onclick="_secAgMes=null;_secAgDia=null;sec_renderAgenda()">Hoje</button></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn-secondary" onclick="sec_agCategorias()">Categorias e cores</button>'
    + '<button class="btn-primary" onclick="sec_agNovo(\'' + _secAgDia + '\')">+ Novo compromisso</button></div></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;font-size:13px">' + cats.map(k => '<span onclick="sec_agFiltro(\'' + _jsq(k.nome) + '\')" title="Clique para mostrar/esconder" style="cursor:pointer;display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:4px;border:1px solid var(--idv-borda);background:var(--idv-cartao);'
      + (_secAgOcultas.has(k.nome) ? 'opacity:.4;text-decoration:line-through' : '') + '"><span style="width:10px;height:10px;background:' + k.cor + '"></span>' + esc(k.nome) + '</span>').join('') + '</div>'
    + '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start"><div style="flex:3 1 560px;min-width:0">'
    + '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin-bottom:4px">' + _SEC_DIAS_SEM.map(s => '<div style="text-align:center;font-size:12px;font-weight:600;color:var(--idv-sec)">' + s + '</div>').join('') + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">' + grade + '</div></div>'
    + '<div id="sec-ag-dia" style="flex:1 1 300px;min-width:280px"></div></div>';
  _secRenderDiaAgenda(_secAgDia);
}
function sec_agNavegar(n) {
  const [a, m] = (_secAgMes || _secHoje().slice(0, 7)).split('-').map(Number), x = new Date(a, m - 1 + n, 1);
  _secAgMes = x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); _secAgDia = _secAgMes + '-01'; sec_renderAgenda();
}
function sec_agFiltro(nome) { _secAgOcultas.has(nome) ? _secAgOcultas.delete(nome) : _secAgOcultas.add(nome); sec_renderAgenda(); }

// ── Lista do dia (painel ao lado do calendário e cartão do painel Hoje) ──────
function _secLinhaCompromisso(x, d, diaRef) {
  const hoje = _secHoje(), cor = _secCorCat(x.categoria, d), atraso = !x.concluido && x.data < hoje ? _secDiasEntre(x.data, hoje) : 0;
  return '<div style="display:flex;gap:10px;padding:8px 0;border-top:1px solid var(--idv-linha);align-items:flex-start">'
    + '<input type="checkbox" title="' + (x.concluido ? 'Reabrir' : 'Marcar como concluído') + '" ' + (x.concluido ? 'checked ' : '') + 'onchange="sec_agConcluir(\'' + x.id + '\',this.checked)" style="margin-top:3px;width:17px;height:17px;cursor:pointer">'
    + '<div style="flex:1;min-width:0;border-left:3px solid ' + cor + ';padding-left:8px">'
    + '<div style="font-weight:600;font-size:14px' + (x.concluido ? ';text-decoration:line-through;color:var(--idv-sec)' : '') + '">' + (x.hora ? '<span class="idv-data">' + esc(x.hora) + '</span> · ' : '') + esc(x.titulo) + '</div>'
    + '<div style="font-size:12px;color:var(--idv-sec)">' + esc(x.categoria) + (x.responsavel ? ' · ' + esc(x.responsavel) : '') + (x.data !== diaRef ? ' · marcado para ' + _secBR(x.data) : '') + '</div>'
    + (atraso ? '<div style="font-size:12px;font-weight:600;color:var(--idv-cr)">\u{21BB} Atrasado desde ' + _secBRc(x.data) + ' (' + atraso + ' dia' + (atraso > 1 ? 's' : '') + ')</div>' : '')
    + (x.descricao ? '<div style="font-size:13px;color:var(--idv-texto);margin-top:2px;white-space:pre-wrap">' + esc(x.descricao) + '</div>' : '')
    + ((x.arquivos || []).length ? '<div style="font-size:13px;margin-top:3px">' + x.arquivos.map(a => '<a href="#" onclick="sec_abrirDoc(\'' + encodeURIComponent(a.key) + '\',\'' + _jsq(a.nome) + '\');return false">\u{1F4CE} ' + esc(a.nome) + '</a>').join(' · ') + '</div>' : '')
    + (x.concluido ? '<div style="font-size:12px;color:var(--idv-ok)">Concluído por ' + esc(x.concluidoPor || '') + ' em ' + new Date(x.concluidoEm).toLocaleString('pt-BR') + '</div>' : '')
    + '</div><div style="display:flex;flex-direction:column;gap:3px"><button class="btn-sm btn-outline" onclick="sec_agNovo(\'\',\'' + x.id + '\')">Editar</button>'
    + '<button class="btn-sm btn-danger" onclick="sec_agExcluir(\'' + x.id + '\')">Excluir</button></div></div>';
}
function _secRenderDiaAgenda(dia) {
  const box = document.getElementById('sec-ag-dia'); if (!box) return;
  const d = _secDados(), itens = _secDoDia(dia, d);
  const titulo = new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  box.innerHTML = '<div style="background:var(--idv-cartao);border:1px solid var(--idv-borda);border-radius:6px;padding:12px 16px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><div style="font-weight:600;font-size:15px;text-transform:capitalize">' + esc(titulo) + '</div>'
    + '<button class="btn-sm btn-primary" onclick="sec_agNovo(\'' + dia + '\')">+ Neste dia</button></div>'
    + (itens.length ? itens.map(x => _secLinhaCompromisso(x, d, dia)).join('') : '<div style="font-size:14px;color:var(--idv-sec);padding:12px 0">Nenhum compromisso neste dia.</div>') + '</div>';
}
function _secCartaoCompromissos() {
  const d = _secDados(), hoje = _secHoje(), itens = _secDoDia(hoje, d);
  const amanha = d.compromissos.filter(c => c.data === _secMaisDias(hoje, 1) && !c.concluido).length;
  const atras = itens.filter(x => !x.concluido && x.data < hoje).length;
  return '<div class="idv-bloco" style="margin-bottom:12px">'
    + '<div class="idv-bloco-cab" style="flex-wrap:wrap"><div>\u{1F4CC} Compromissos de hoje'
    + (atras ? ' <span style="font-size:13px;color:var(--idv-cr)">· ' + atras + ' atrasado(s)</span>' : '') + '</div>'
    + '<div style="display:flex;gap:6px"><button class="btn-sm btn-outline" onclick="sec_mudarAba(\'agenda\')">Abrir agenda</button><button class="btn-sm btn-primary" onclick="sec_agNovo(\'' + hoje + '\')">+ Novo</button></div></div>'
    + '<div style="padding:0 16px 12px">'
    + (itens.length ? itens.map(x => _secLinhaCompromisso(x, d, hoje)).join('') : '<div style="font-size:14px;color:var(--idv-sec);padding:10px 0 0">Nada marcado para hoje.</div>')
    + (amanha ? '<div style="font-size:13px;color:var(--idv-sec);margin-top:6px">Amanhã: ' + amanha + ' compromisso(s).</div>' : '') + '</div></div>';
}

// ── Criar / editar / concluir / excluir ───────────────────────────────────────
function sec_agNovo(dia, id) {
  const d = _secDados(), x = id ? (d.compromissos.find(c => c.id === id) || {}) : {};
  const cats = _secCategorias(d), cat = x.categoria || cats[0].nome;
  const nomes = [...new Set(d.servidores.map(s => s.nome).concat(usuarioAtual ? [usuarioAtual.nome] : []))].sort();
  _secModal(id ? 'Editar compromisso' : 'Novo compromisso',
    (typeof _secAgHtmlAnexo === 'function' ? _secAgHtmlAnexo(x) : '')
    + _secCampo('sec-ag-titulo', 'O que precisa ser feito *', x.titulo || '', 'placeholder="Ex.: Enviar folhas de ponto assinadas à UNIPES"')
    + '<div class="form-grid">' + _secCampo('sec-ag-data', 'Data *', x.data || dia || _secHoje(), 'type="date"') + _secCampo('sec-ag-hora', 'Hora (opcional)', x.hora || '', 'type="time"') + '</div>'
    + '<div class="form-field"><label>Categoria</label><div style="display:flex;gap:6px;flex-wrap:wrap">' + cats.map(k => '<button type="button" data-grupo="sec-ag-cat" data-valor="' + esc(k.nome) + '" onclick="_secAgEscolherCat(this)" style="cursor:pointer;padding:5px 10px;border-radius:4px;border:2px solid '
      + (k.nome === cat ? k.cor : 'transparent') + ';background:' + k.cor + '22;color:var(--idv-texto);font-weight:600;font-size:13px" class="' + (k.nome === cat ? 'active' : '') + '"><span style="display:inline-block;width:9px;height:9px;background:' + k.cor + ';margin-right:5px"></span>' + esc(k.nome) + '</button>').join('')
    + '</div><input type="hidden" id="sec-ag-cat" value="' + esc(cat) + '"></div>'
    + _secCampo('sec-ag-resp', 'Responsável (opcional)', x.responsavel || '', 'list="sec-ag-nomes"') + '<datalist id="sec-ag-nomes">' + nomes.map(n => '<option>' + esc(n) + '</option>').join('') + '</datalist>'
    + '<div class="form-field"><label>Detalhes (opcional)</label><textarea id="sec-ag-desc" rows="3">' + esc(x.descricao || '') + '</textarea></div>'
    + '<div style="font-size:13px;color:var(--idv-sec)">Se não for marcado como concluído no dia, ele continua aparecendo nos dias seguintes (no painel Hoje e no contador do menu) até ser concluído.</div>',
    '<button class="btn-primary" id="sec-ag-salvar" onclick="sec_agSalvar(\'' + (id || '') + '\')">Salvar</button>', 640);
  setTimeout(() => document.getElementById('sec-ag-titulo')?.focus(), 50);
}
function _secAgEscolherCat(btn) {
  document.querySelectorAll('[data-grupo="sec-ag-cat"]').forEach(o => { o.style.borderColor = 'transparent'; });
  btn.style.borderColor = _secCorCat(btn.dataset.valor);
  document.getElementById('sec-ag-cat').value = btn.dataset.valor;
}
async function sec_agSalvar(id) {
  const v = { titulo: _secVal('sec-ag-titulo'), data: _secVal('sec-ag-data'), hora: _secVal('sec-ag-hora'), categoria: _secVal('sec-ag-cat'), responsavel: _secVal('sec-ag-resp'), descricao: _secVal('sec-ag-desc') };
  if (v.titulo.length < 3) { _mostrarToast('Escreva o que precisa ser feito.', 'erro'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.data)) { _mostrarToast('Informe a data.', 'erro'); return; }
  const files = [...(document.getElementById('sec-ag-files')?.files || [])];
  const grande = files.find(f => f.size > 15 * 1024 * 1024); if (grande) { _mostrarToast(grande.name + ': maior que 15 MB.', 'erro'); return; }
  const btn = document.getElementById('sec-ag-salvar'); if (btn && files.length) { btn.disabled = true; btn.textContent = 'Enviando…'; }
  let enviados = [];
  try { if (files.length) enviados = await _secAgEnviarAnexos(files, v); }
  catch (e) {
    _mostrarToast('Não consegui enviar o anexo: ' + (e.message || e) + '. Nada foi salvo.', 'erro');
    await _secMoverParaLixeiraR2(enviados); if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; } return;
  }
  const agora = new Date().toISOString(), por = usuarioAtual ? usuarioAtual.nome : '';
  const ok = await _secMutar(d => {
    if (id) { const x = d.compromissos.find(c => c.id === id); if (!x) return false; Object.assign(x, v, { arquivos: (x.arquivos || []).concat(enviados), editadoPor: por, editadoEm: agora }); }
    else d.compromissos.push(Object.assign({ id: _secId('cmp'), concluido: false, criadoPor: por, criadoEm: agora, arquivos: enviados }, v));
  }, { action: id ? 'sec_comp_editar' : 'sec_comp_criar', alvo: v.titulo, detalhe: _secBR(v.data) + (v.hora ? ' ' + v.hora : '') + ' · ' + v.categoria + (enviados.length ? ' · ' + enviados.length + ' anexo(s)' : '') });
  if (!ok) { await _secMoverParaLixeiraR2(enviados); if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; } return; }
  _secFecharModal(); _mostrarToast('Compromisso salvo.', 'sucesso');
  if (_secAba === 'agenda') { _secAgMes = v.data.slice(0, 7); _secAgDia = v.data; }
  sec_render();
}
async function sec_agConcluir(id, feito) {
  let alvo = '';
  const ok = await _secMutar(d => {
    const x = d.compromissos.find(c => c.id === id); if (!x) return false;
    alvo = x.titulo; x.concluido = !!feito;
    if (feito) { x.concluidoEm = new Date().toISOString(); x.concluidoPor = usuarioAtual ? usuarioAtual.nome : ''; } else { delete x.concluidoEm; delete x.concluidoPor; }
  });
  if (!ok) return;
  auditar({ modulo: 'Secretaria', action: feito ? 'sec_comp_concluir' : 'sec_comp_reabrir', alvo });
  sec_render();
}
async function sec_agExcluir(id) {
  const x = _secDados().compromissos.find(c => c.id === id); if (!x) return;
  if (!confirm('Excluir o compromisso "' + x.titulo + '"? (fica guardado na lixeira da Secretaria)')) return;
  const ok = await _secMutar(d => { const i = d.compromissos.findIndex(c => c.id === id); if (i < 0) return false; _secParaLixeira(d, 'compromisso', d.compromissos[i]); d.compromissos.splice(i, 1); },
    { action: 'sec_comp_excluir', alvo: x.titulo, detalhe: _secBR(x.data) });
  if (!ok) return;
  if ((x.arquivos || []).length) await _secMoverParaLixeiraR2(x.arquivos);
  sec_render();
}

// ── Categorias e cores ────────────────────────────────────────────────────────
function sec_agCategorias() {
  const cats = _secCategorias();
  _secModal('Categorias e cores',
    '<div id="sec-ag-cats">' + cats.map((k, i) => _secLinhaCat(k, i)).join('') + '</div>'
    + '<button type="button" class="btn-secondary" style="margin-top:6px" onclick="document.getElementById(\'sec-ag-cats\').insertAdjacentHTML(\'beforeend\', _secLinhaCat({ nome: \'\', cor: \'#0891b2\' }, Date.now()))">+ Nova categoria</button>'
    + '<div style="font-size:13px;color:var(--idv-sec);margin-top:8px">Compromissos de uma categoria removida continuam guardados (aparecem em cinza).</div>',
    '<button class="btn-primary" onclick="sec_agSalvarCategorias()">Salvar</button>', 520);
}
function _secLinhaCat(k, i) {
  return '<div class="sec-ag-cat-linha" style="display:flex;gap:8px;align-items:center;margin-bottom:6px"><input type="color" value="' + esc(k.cor) + '" style="width:44px;height:32px;padding:0;border:none">'
    + '<input value="' + esc(k.nome) + '" placeholder="Nome da categoria" style="flex:1;padding:6px 10px"><button type="button" class="btn-sm btn-danger" onclick="this.parentElement.remove()">Remover</button></div>';
}
async function sec_agSalvarCategorias() {
  const cats = [...document.querySelectorAll('.sec-ag-cat-linha')].map(l => { const [cor, nome] = l.querySelectorAll('input'); return { nome: nome.value.trim(), cor: cor.value }; }).filter(k => k.nome);
  if (!cats.length) { _mostrarToast('Mantenha ao menos uma categoria.', 'erro'); return; }
  if (new Set(cats.map(k => k.nome.toLowerCase())).size !== cats.length) { _mostrarToast('Há categorias com o mesmo nome.', 'erro'); return; }
  const ok = await _secMutar(d => { d.config = Object.assign({}, d.config, { categorias: cats }); }, { action: 'sec_comp_categorias', alvo: cats.length + ' categoria(s)' });
  if (ok) { _secFecharModal(); sec_render(); }
}
Object.assign(_SEC_ACOES, { sec_comp_criar: 'Criou compromisso', sec_comp_editar: 'Editou compromisso', sec_comp_concluir: 'Concluiu compromisso',
  sec_comp_reabrir: 'Reabriu compromisso', sec_comp_excluir: 'Excluiu compromisso', sec_comp_categorias: 'Alterou categorias da agenda' });
