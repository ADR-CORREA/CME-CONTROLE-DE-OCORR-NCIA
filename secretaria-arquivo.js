/* ═══════════════════════════ SECRETARIA — ARQUIVO GERAL DE DOCUMENTOS ═══════════════════════════
   Portarias, memorandos, ofícios, circulares, ordens de serviço, escalas e atas do setor.
   • Ficha do documento (tipo, número, data, origem, assunto, servidores vinculados) em
     cme_secretaria.documentos; os arquivos em si no Worker /sec/* (pasta arquivo/<tipo>).
   • Documento vinculado a um servidor aparece também na aba Documentos do perfil dele.
   • Excluir manda os arquivos para a lixeira do Worker e a ficha para a lixeira interna.
   Depende de secretaria*.js. Emojis só por \u{...}. */

const _SEC_TIPOS_DOC = [
  { nome: 'Portaria', pasta: 'portaria', cor: '#7c3aed' }, { nome: 'Memorando', pasta: 'memorando', cor: '#2563eb' },
  { nome: 'Ofício', pasta: 'oficio', cor: '#0d9488' }, { nome: 'Circular / Comunicado', pasta: 'circular', cor: '#d97706' },
  { nome: 'Ordem de Serviço', pasta: 'ordem-servico', cor: '#dc2626' }, { nome: 'Escala', pasta: 'escala', cor: '#0891b2' },
  { nome: 'Ata', pasta: 'ata', cor: '#db2777' }, { nome: 'Outros', pasta: 'outros', cor: '#64748b' },
];
let _secArqTipo = '', _secArqAno = '', _secArqBusca = '';

function _secTipoDoc(nome) { return _SEC_TIPOS_DOC.find(t => t.nome === nome) || _SEC_TIPOS_DOC[_SEC_TIPOS_DOC.length - 1]; }
function _secSeloTipo(nome) {
  const t = _secTipoDoc(nome);
  return '<span style="display:inline-flex;align-items:center;gap:5px;font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;padding:2px 7px;border-radius:3px;border-left:2px solid ' + t.cor + ';background:' + t.cor + '1f;color:' + t.cor + ';white-space:nowrap">'
    + '<span style="width:5px;height:5px;background:' + t.cor + '"></span>' + esc(nome) + '</span>';
}
function _secTextoBusca(x, d) {
  return [x.tipo, x.numero, x.assunto, x.origem, _secBR(x.data)].concat((x.servidorIds || []).map(id => _secNomeServ(id, d)), (x.arquivos || []).map(a => a.nome))
    .join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
function _secFiltrarDocs(d, tipo, ano, busca) {
  const termos = String(busca || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/\s+/).filter(Boolean);
  return d.documentos.filter(x => (!tipo || x.tipo === tipo) && (!ano || String(x.data).slice(0, 4) === ano)
    && (!termos.length || (t => termos.every(p => t.includes(p)))(_secTextoBusca(x, d))))
    .sort((a, b) => String(b.data).localeCompare(String(a.data)) || String(b.criadoEm).localeCompare(String(a.criadoEm)));
}

// ── Lista ─────────────────────────────────────────────────────────────────────
function sec_renderArquivo() {
  const c = document.getElementById('sec-conteudo'); if (!c) return;
  const d = _secDados();
  const anos = [...new Set(d.documentos.map(x => String(x.data).slice(0, 4)).filter(a => /^\d{4}$/.test(a)))].sort().reverse();
  const conta = n => d.documentos.filter(x => (!n || x.tipo === n) && (!_secArqAno || String(x.data).slice(0, 4) === _secArqAno)).length;
  const chip = (v, r) => '<button type="button" class="chip' + (v === _secArqTipo ? ' active' : '') + '" onclick="_secArqTipo=\'' + esc(v) + '\';sec_renderArquivo()" style="padding:5px 12px;border-radius:4px;cursor:pointer;font-size:.82rem;border:1px solid '
    + (v === _secArqTipo ? '#388bfd;background:#dbeafe;font-weight:600;box-shadow:inset 2px 0 0 #2563eb' : '#cbd5e1;background:#fff') + '">' + esc(r) + ' <span style="color:#64748b">' + conta(v) + '</span></button>';
  c.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">'
    + '<div style="display:flex;gap:8px;flex:1;min-width:260px"><input id="sec-arq-busca" value="' + esc(_secArqBusca) + '" oninput="_secArqBusca=this.value;_secRenderListaArquivo()" placeholder="Buscar por número, assunto, servidor, origem ou nome do arquivo…" style="flex:1;padding:7px 10px">'
    + '<select onchange="_secArqAno=this.value;sec_renderArquivo()" style="padding:6px 8px"><option value="">Todos os anos</option>' + anos.map(a => '<option' + (a === _secArqAno ? ' selected' : '') + '>' + a + '</option>').join('') + '</select></div>'
    + '<button class="btn-primary" onclick="sec_arqNovo()">+ Arquivar documento</button></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' + chip('', 'Todos') + _SEC_TIPOS_DOC.map(t => chip(t.nome, t.nome)).join('') + '</div>'
    + '<div id="sec-arq-lista"></div>';
  _secRenderListaArquivo();
}
function _secRenderListaArquivo() {
  const box = document.getElementById('sec-arq-lista'); if (!box) return;
  const d = _secDados(), lista = _secFiltrarDocs(d, _secArqTipo, _secArqAno, _secArqBusca);
  box.innerHTML = '<div style="font-size:.78rem;color:#64748b;margin-bottom:4px">' + lista.length + ' documento(s)' + (lista.length !== d.documentos.length ? ' de ' + d.documentos.length : '') + '</div>'
    + '<div class="table-scroll"><table class="data-table"><thead><tr><th>Data</th><th>Tipo</th><th>Nº</th><th>Assunto</th><th>Servidores</th><th>Arquivos</th><th></th></tr></thead><tbody>'
    + (lista.length ? lista.map(x => _secLinhaDoc(x, d)).join('')
      : '<tr><td colspan="7" style="text-align:center;padding:24px;color:#888">' + (d.documentos.length ? 'Nenhum documento com esse filtro.' : 'Nenhum documento arquivado ainda. Use "+ Arquivar documento".') + '</td></tr>')
    + '</tbody></table></div>';
}
function _secLinhaDoc(x, d) {
  return '<tr><td style="font-family:var(--font-mono);font-size:.8rem;white-space:nowrap">' + _secBR(x.data) + '</td><td>' + _secSeloTipo(x.tipo) + '</td>'
    + '<td style="font-family:var(--font-mono);font-size:.82rem;white-space:nowrap">' + esc(x.numero || '—') + '</td>'
    + '<td><div style="font-weight:600">' + esc(x.assunto) + '</div>' + (x.origem ? '<div style="font-size:.75rem;color:#64748b">' + esc(x.origem) + '</div>' : '') + '</td>'
    + '<td style="font-size:.8rem">' + ((x.servidorIds || []).map(id => _secServ(id, d) ? '<a href="#" onclick="sec_abrirPerfil(\'' + id + '\');return false">' + esc(_secNomeServ(id, d)) + '</a>' : '').filter(Boolean).join('<br>') || '<span style="color:#94a3b8">—</span>') + '</td>'
    + '<td style="font-size:.8rem">' + (x.arquivos || []).map(a => '<a href="#" onclick="sec_abrirDoc(\'' + encodeURIComponent(a.key) + '\',\'' + _jsq(a.nome) + '\');return false">\u{1F4CE} ' + esc(a.nome) + '</a>').join('<br>') + '</td>'
    + '<td style="white-space:nowrap"><button class="btn-sm btn-outline" onclick="sec_arqNovo(\'' + x.id + '\')">Editar</button> '
    + '<button class="btn-sm btn-outline" style="color:#b91c1c" onclick="sec_arqExcluir(\'' + x.id + '\')">Excluir</button></td></tr>';
}
// usado na aba Documentos do perfil do servidor
function _secHtmlArquivoDoServidor(id, d) {
  const lista = _secFiltrarDocs(d, '', '', '').filter(x => (x.servidorIds || []).includes(id));
  return '<div style="font-weight:700;margin-bottom:4px">\u{1F5C4}\u{FE0F} No arquivo geral (' + lista.length + ')</div>'
    + (lista.length ? '<div class="table-scroll" style="margin-bottom:14px"><table class="data-table"><thead><tr><th>Data</th><th>Tipo</th><th>Nº</th><th>Assunto</th><th>Servidores</th><th>Arquivos</th><th></th></tr></thead><tbody>'
      + lista.map(x => _secLinhaDoc(x, d)).join('') + '</tbody></table></div>'
      : '<div style="font-size:.85rem;color:#94a3b8;margin-bottom:14px">Nenhuma portaria ou documento do arquivo geral vinculado a este servidor.</div>')
    + '<div style="font-weight:700;margin-bottom:4px">\u{1F4CE} Documentos pessoais</div>';
}

// ── Arquivar / editar ─────────────────────────────────────────────────────────
function sec_arqNovo(id) {
  const d = _secDados(), x = id ? (d.documentos.find(k => k.id === id) || {}) : {};
  const marcados = new Set(x.servidorIds || (_secPerfilId ? [_secPerfilId] : []));
  const servs = d.servidores.slice().sort((a, b) => a.nome.localeCompare(b.nome));
  _secModal(id ? 'Editar documento' : 'Arquivar documento',
    '<div class="form-field"><label>Tipo *</label>' + _secChips('sec-arq-tipo', _SEC_TIPOS_DOC.map(t => t.nome), x.tipo || _secArqTipo || 'Portaria') + '</div>'
    + '<div class="form-grid">' + _secCampo('sec-arq-num', 'Número', x.numero || '', 'placeholder="Ex.: 123/2026-IAPEN"') + _secCampo('sec-arq-data', 'Data do documento *', x.data || _secHoje(), 'type="date"') + '</div>'
    + _secCampo('sec-arq-assunto', 'Assunto *', x.assunto || '', 'placeholder="Ex.: Concede férias a servidores do CME"')
    + _secCampo('sec-arq-origem', 'Origem / emitido por (opcional)', x.origem || '', 'placeholder="Ex.: Diretoria do IAPEN, Gerência do CME, Vara de Execuções"')
    + '<div class="form-field"><label>Servidores citados (opcional) — o documento aparece no perfil de cada um</label>'
    + '<input placeholder="Filtrar nomes…" oninput="_secArqFiltrarServs(this.value)" style="margin-bottom:4px">'
    + '<div id="sec-arq-servs" style="max-height:170px;overflow:auto;border:1px solid #e2e8f0;border-radius:6px;padding:4px 8px">'
    + (servs.length ? servs.map(s => '<label data-nome="' + esc(s.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()) + '" style="display:flex;gap:8px;align-items:center;padding:2px 0;font-size:.85rem;font-weight:400;cursor:pointer">'
      + '<input type="checkbox" value="' + s.id + '"' + (marcados.has(s.id) ? ' checked' : '') + '>' + esc(s.nome) + ' <span style="color:#94a3b8;font-size:.75rem">' + esc(s.equipe || '') + '</span></label>').join('') : '<div style="color:#94a3b8;font-size:.85rem">Nenhum servidor cadastrado.</div>')
    + '</div></div>'
    + (x.arquivos && x.arquivos.length ? '<div class="form-field"><label>Arquivos já anexados</label><div style="font-size:.85rem">' + x.arquivos.map(a => '\u{1F4CE} ' + esc(a.nome)).join('<br>') + '</div></div>' : '')
    + '<div class="form-field"><label>' + (id ? 'Anexar mais arquivos (opcional)' : 'Arquivo(s) * — PDF, imagem, Word ou Excel, até 15 MB cada') + '</label>'
    + '<input type="file" id="sec-arq-files" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.odt,.txt"' + (typeof sec_arqIaLer === 'function' ? ' onchange="sec_arqIaLer(this)"' : '') + '>'
    + '<div id="sec-arq-ia" style="font-size:.8rem;margin-top:4px;color:#64748b">\u{1F916} Ao escolher o arquivo, a IA lê e preenche tipo, número, data, assunto e os servidores citados.</div></div>',
    '<button class="btn-primary" id="sec-arq-salvar" onclick="sec_arqSalvar(\'' + (id || '') + '\')">Salvar</button>', 680);
}
function _secArqFiltrarServs(q) {
  q = String(q || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  document.querySelectorAll('#sec-arq-servs label').forEach(l => { l.style.display = !q || l.dataset.nome.includes(q) ? 'flex' : 'none'; });
}
async function _secEnviarArquivosDoc(arquivos, tipo, meta) {
  const pasta = 'arquivo/' + _secTipoDoc(tipo).pasta, enviados = [];
  for (const f of arquivos) {
    _mostrarToast('Enviando ' + f.name + '…');
    const r = await r2_api('POST', '/sec/upload', { 'Content-Type': 'application/json' }, JSON.stringify({ pasta, nome: f.name, conteudo: await _secLerArquivo(f), descricao: meta.descricao, referencia: meta.referencia }));
    enviados.push({ key: r.key, nome: f.name, tamanho: f.size });
  }
  return enviados;
}
async function _secMoverParaLixeiraR2(arquivos) {
  for (const a of arquivos) {
    try { await r2_api('POST', '/sec/delete', { 'Content-Type': 'application/json' }, JSON.stringify({ key: a.key })); }
    catch (e) { console.warn('[Secretaria] arquivo não movido para a lixeira:', a.key, e.message || e); }
  }
}
async function sec_arqSalvar(id) {
  const v = { tipo: _secVal('sec-arq-tipo'), numero: _secVal('sec-arq-num'), data: _secVal('sec-arq-data'), assunto: _secVal('sec-arq-assunto'), origem: _secVal('sec-arq-origem'),
    servidorIds: [...document.querySelectorAll('#sec-arq-servs input:checked')].map(i => i.value) };
  const files = [...(document.getElementById('sec-arq-files')?.files || [])];
  if (!_SEC_TIPOS_DOC.some(t => t.nome === v.tipo)) { _mostrarToast('Escolha o tipo do documento.', 'erro'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.data)) { _mostrarToast('Informe a data do documento.', 'erro'); return; }
  if (v.assunto.length < 3) { _mostrarToast('Escreva o assunto do documento.', 'erro'); return; }
  if (!id && !files.length) { _mostrarToast('Anexe o arquivo do documento.', 'erro'); return; }
  const grande = files.find(f => f.size > 15 * 1024 * 1024);
  if (grande) { _mostrarToast(grande.name + ': maior que 15 MB.', 'erro'); return; }
  const d0 = _secDados();
  if (v.numero && d0.documentos.some(k => k.id !== id && k.tipo === v.tipo && String(k.numero).trim().toLowerCase() === v.numero.toLowerCase())
    && !confirm('Já existe ' + v.tipo + ' nº ' + v.numero + ' no arquivo. Salvar mesmo assim?')) return;
  const btn = document.getElementById('sec-arq-salvar'); if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
  const rotulo = v.tipo + (v.numero ? ' nº ' + v.numero : '');
  let enviados = [];
  try {
    enviados = await _secEnviarArquivosDoc(files, v.tipo, { descricao: (rotulo + ' — ' + v.assunto).slice(0, 300), referencia: v.servidorIds.map(i => _secNomeServ(i, d0)).join(', ').slice(0, 150) });
  } catch (e) {
    _mostrarToast('Não consegui enviar o arquivo: ' + (e.message || e) + '. Nada foi salvo.', 'erro');
    await _secMoverParaLixeiraR2(enviados);
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
    return;
  }
  const agora = new Date().toISOString(), por = usuarioAtual ? usuarioAtual.nome : '';
  const ok = await _secMutar(d => {
    if (id) {
      const x = d.documentos.find(k => k.id === id); if (!x) return false;
      Object.assign(x, v, { arquivos: (x.arquivos || []).concat(enviados), editadoPor: por, editadoEm: agora });
    } else d.documentos.push(Object.assign({ id: _secId('doc'), arquivos: enviados, criadoPor: por, criadoEm: agora }, v));
  }, { action: id ? 'sec_doc_editar' : 'sec_doc_arquivar', alvo: rotulo, detalhe: v.assunto + (enviados.length ? ' · ' + enviados.length + ' arquivo(s)' : '') });
  if (!ok) {
    // a ficha não foi gravada: os arquivos enviados vão para a lixeira (nada fica solto sem registro)
    await _secMoverParaLixeiraR2(enviados);
    if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; }
    return;
  }
  _secFecharModal(); _mostrarToast(id ? 'Documento atualizado.' : 'Documento arquivado.', 'sucesso');
  sec_render();
}
async function sec_arqExcluir(id) {
  const x = _secDados().documentos.find(k => k.id === id); if (!x) return;
  const rotulo = x.tipo + (x.numero ? ' nº ' + x.numero : '');
  if (!confirm('Excluir ' + rotulo + ' — "' + x.assunto + '"?\n\nA ficha e os arquivos vão para a lixeira da Secretaria e podem ser recuperados pelo administrador.')) return;
  const ok = await _secMutar(d => { const i = d.documentos.findIndex(k => k.id === id); if (i < 0) return false; _secParaLixeira(d, 'documento', d.documentos[i]); d.documentos.splice(i, 1); },
    { action: 'sec_doc_excluir', alvo: rotulo, detalhe: x.assunto });
  if (!ok) return;
  await _secMoverParaLixeiraR2(x.arquivos || []);
  _mostrarToast('Documento movido para a lixeira.', 'sucesso');
  sec_render();
}
Object.assign(_SEC_ACOES, { sec_doc_arquivar: 'Arquivou documento', sec_doc_editar: 'Editou documento do arquivo', sec_doc_excluir: 'Excluiu documento do arquivo (lixeira)' });
