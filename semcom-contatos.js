/* ═══════════════════════════ SEM COMUNICAÇÃO — CONTATOS DO CADASTRO (AKILES) ═══════════════════════════
   Importa o "Cadastro completo dos monitorados" do AKILES (o .xls é uma tabela HTML) e guarda o
   telefone do monitorado e os contatos de referência SÓ de quem está sem comunicação (em aberto).
   Nada mais da planilha é guardado (CPF, endereço, filiação etc. ficam de fora).
   • Casa pelo nº de registro (_scChaveReg); se não achar, pelo nome sem acento — só se for único.
   • Grava com _scMutar (relê o banco antes). Fica em m.contato = { telefone, refs:[{nome,telefone}],
     obs, atualizadoEm, por, arquivo }. A atualização diária do AKILES mantém esse campo.
   Emojis só por \u{...} (emoji cru some no parse deste projeto). */

let _sccPlanoAtual = null;

function _sccNorm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[º°ª]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
// só dígitos; tira o 55 do país; aceita de 8 a 11 dígitos (fixo/celular, com ou sem DDD)
function _sccTel(v) {
  let d = String(v == null ? '' : v).replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  return d.length >= 8 && d.length <= 11 ? d : '';
}
function _sccFmtTel(d) {
  if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  if (d.length === 9) return d.slice(0, 5) + '-' + d.slice(5);
  return d.slice(0, 4) + '-' + d.slice(4);
}
function _sccLinkTel(d) {
  const wa = d.length === 11 && d[2] === '9'
    ? ' <a href="https://wa.me/55' + d + '" target="_blank" rel="noopener noreferrer" title="Abrir conversa no WhatsApp" style="color:#16a34a;font-weight:600">WhatsApp</a>' : '';
  return '<span style="white-space:nowrap"><a href="tel:' + (d.length >= 10 ? '+55' : '') + d + '" title="Ligar" style="font-family:var(--font-mono);color:#2563eb">' + _sccFmtTel(d) + '</a>' + wa + '</span>';
}

// ── Leitura da planilha ───────────────────────────────────────────────────────
async function _sccLerPlanilha(file) {
  const buf = await file.arrayBuffer();
  const inicio = new TextDecoder('latin1').decode(buf.slice(0, 300)).trim().toLowerCase();
  if (inicio.startsWith('<')) {
    let txt = new TextDecoder('utf-8').decode(buf);
    if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(buf);
    const doc = new DOMParser().parseFromString(txt, 'text/html'); // só lê o texto das células, nada é executado
    return [...doc.querySelectorAll('tr')].map(tr => [...tr.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim()));
  }
  const wb = XLSX.read(buf, { type: 'array' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }).map(r => r.map(c => String(c).replace(/\s+/g, ' ').trim()));
}
function _sccColunas(hdr) {
  const h = hdr.map(_sccNorm), achar = f => h.findIndex(f);
  const col = { nome: achar(x => x === 'nome'), registro: achar(x => /registro/.test(x) && !/data/.test(x)), telefone: achar(x => x === 'telefone'),
    obs: achar(x => /observa.*contato/.test(x)), refs: [] };
  for (let n = 1; n <= 5; n++) {
    const nome = achar(x => x === 'contato ref-' + n), tel = achar(x => x === 'telefone contato ref-' + n);
    if (nome >= 0 || tel >= 0) col.refs.push({ nome, tel });
  }
  return col;
}
// Cruza a planilha com quem está sem comunicação (em aberto). Não grava nada.
function _sccPlano(linhas, dados) {
  const iHdr = linhas.findIndex(r => { const h = r.map(_sccNorm); return h.includes('nome') && h.includes('telefone'); });
  if (iHdr < 0) throw new Error('Não achei as colunas "Nome" e "Telefone". Use o relatório "Cadastro completo dos monitorados" do AKILES.');
  const col = _sccColunas(linhas[iHdr]);
  const cel = (r, i) => (i >= 0 && i < r.length ? String(r[i] || '').trim() : '');
  const porReg = new Map(), porNome = new Map();
  let lidos = 0;
  linhas.slice(iHdr + 1).forEach(r => {
    const nome = cel(r, col.nome); if (!nome || r.length < 5) return;
    lidos++;
    const contato = { telefone: _sccTel(cel(r, col.telefone)), obs: cel(r, col.obs).slice(0, 400),
      refs: col.refs.map(k => ({ nome: cel(r, k.nome).slice(0, 80), telefone: _sccTel(cel(r, k.tel)) })).filter(x => x.nome || x.telefone) };
    const reg = _scChaveReg(cel(r, col.registro));
    if (reg && !porReg.has(reg)) porReg.set(reg, contato);
    const kn = _sccNorm(nome); porNome.set(kn, (porNome.get(kn) || []).concat([contato]));
  });
  const alvos = (dados.monitorados || []).filter(_scEmAberto);
  const itens = alvos.map(m => {
    let x = porReg.get(_scChaveReg(m.registro)), via = 'registro';
    if (!x) { const c = porNome.get(_sccNorm(m.nome)); if (c && c.length === 1) { x = c[0]; via = 'nome'; } }
    return { m, x, via };
  });
  const achados = itens.filter(i => i.x);
  return { lidos, total: alvos.length, achados, comTelefone: achados.filter(i => i.x.telefone || i.x.refs.some(r => r.telefone)).length,
    porNome: achados.filter(i => i.via === 'nome').length, faltando: itens.filter(i => !i.x).map(i => i.m) };
}

// ── Importar: lê, mostra a prévia e só grava ao confirmar ────────────────────
function _sccModal(titulo, corpo, botoes) {
  let ov = document.getElementById('scc-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'scc-modal'; ov.className = 'modal-overlay'; document.body.appendChild(ov); }
  ov.innerHTML = '<div class="modal-box" style="max-width:620px"><div class="modal-header"><h3>' + titulo + '</h3><button class="modal-close" onclick="document.getElementById(\'scc-modal\').classList.remove(\'open\')">\u{2715}</button></div>'
    + '<div class="modal-body">' + corpo + '</div><div class="modal-footer"><button class="btn-secondary" onclick="document.getElementById(\'scc-modal\').classList.remove(\'open\')">Cancelar</button>' + (botoes || '') + '</div></div>';
  ov.classList.add('open');
}
async function sc_importarContatos(input) {
  const f = input.files && input.files[0]; input.value = '';
  if (!f) return;
  if (f.size > 40 * 1024 * 1024) { _mostrarToast('Arquivo grande demais (máx. 40 MB).', 'erro'); return; }
  let plano;
  try {
    _mostrarToast('Lendo ' + f.name + '…');
    plano = _sccPlano(await _sccLerPlanilha(f), getSemCom());
  } catch (e) { _mostrarToast('Não consegui ler a planilha: ' + (e.message || e), 'erro'); return; }
  plano.arquivo = f.name.slice(0, 120);
  _sccPlanoAtual = plano;
  const falta = plano.faltando.slice(0, 40);
  _sccModal('\u{1F4C7} Contatos do cadastro completo',
    '<div style="font-size:.9rem;line-height:1.6">Planilha com <b>' + plano.lidos + '</b> monitorados cadastrados.<br>'
    + 'Sem comunicação agora: <b>' + plano.total + '</b> · encontrados na planilha: <b>' + plano.achados.length + '</b>'
    + ' (' + plano.comTelefone + ' com telefone' + (plano.porNome ? ', ' + plano.porNome + ' pelo nome' : '') + ').</div>'
    + '<div style="font-size:.8rem;color:#64748b;margin-top:6px">Só o telefone do monitorado, os contatos de referência e a observação de contatos são guardados — e só de quem está sem comunicação. CPF, endereço e o resto da planilha não são salvos.</div>'
    + (plano.faltando.length ? '<div style="margin-top:10px;font-size:.82rem"><b>Não encontrados no cadastro (' + plano.faltando.length + '):</b><div style="max-height:150px;overflow:auto;color:#475569;margin-top:4px">'
      + falta.map(m => esc(m.nome) + ' <span style="font-family:var(--font-mono);color:#94a3b8">' + esc(m.registro) + '</span>').join('<br>') + (plano.faltando.length > falta.length ? '<br>… e mais ' + (plano.faltando.length - falta.length) : '') + '</div></div>' : ''),
    plano.achados.length ? '<button class="btn-primary" id="scc-salvar" onclick="sc_salvarContatos()">Salvar ' + plano.achados.length + ' contato(s)</button>' : '');
}
async function sc_salvarContatos() {
  const plano = _sccPlanoAtual; if (!plano) return;
  const btn = document.getElementById('scc-salvar'); if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
  const porId = new Map(plano.achados.map(i => [i.m.id, i.x]));
  const agora = new Date().toISOString(), por = usuarioAtual?.nome || '';
  let n = 0;
  const ok = await _scMutar(d => {
    d.monitorados.forEach(m => {
      const x = porId.get(m.id); if (!x || !_scEmAberto(m)) return;
      m.contato = Object.assign({}, x, { atualizadoEm: agora, por, arquivo: plano.arquivo }); n++;
    });
    if (!n) { _mostrarToast('Nenhum registro para atualizar — a lista mudou. Importe de novo.', 'erro'); return false; }
  });
  if (!ok) { if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; } return; }
  try { auditar({ modulo: 'Sem Comunicação', action: 'semcom_contatos', alvo: n + ' monitorado(s)', detalhe: plano.arquivo }); } catch (e) {}
  _sccPlanoAtual = null;
  document.getElementById('scc-modal')?.classList.remove('open');
  _mostrarToast('\u{1F4DE} Contatos salvos em ' + n + ' monitorado(s) sem comunicação.', 'sucesso');
  try { renderizarSemCom('juridico'); renderizarSemCom('psicossocial'); } catch (e) {}
}

// ── Exibição ──────────────────────────────────────────────────────────────────
// linha curta abaixo do nome, na tabela
function _scLinhaContato(m) {
  const c = m && m.contato; if (!c) return '';
  const refs = (c.refs || []).filter(r => r.telefone);
  return '<div style="font-size:.78rem;margin-top:3px;font-weight:400;color:#475569">'
    + (c.telefone ? '\u{1F4DE} ' + _sccLinkTel(c.telefone) : '<span style="color:#94a3b8">sem telefone próprio</span>')
    + (refs.length ? ' <span style="color:#64748b;cursor:help" title="' + esc(refs.map(r => (r.nome || 'Contato') + ': ' + _sccFmtTel(r.telefone)).join(' · ')) + '">· +' + refs.length + ' de referência</span>' : '')
    + '</div>';
}
// bloco completo (modais de tratativa e de visualização)
function _scHtmlContatos(m) {
  const c = m && m.contato;
  if (!c) return '<div style="font-size:.85rem;color:#94a3b8">Sem contato importado. Use "Importar contatos (cadastro)" na aba Sem Comunicação.</div>';
  const linha = (rot, tel) => '<div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-top:1px solid #f1f5f9;font-size:.86rem"><span>' + rot + '</span><span style="white-space:nowrap">' + (tel ? _sccLinkTel(tel) : '<span style="color:#94a3b8">sem número</span>') + '</span></div>';
  return linha('<b>Monitorado</b>', c.telefone)
    + (c.refs || []).map(r => linha(esc(r.nome || 'Contato de referência'), r.telefone)).join('')
    + (c.obs ? '<div style="font-size:.82rem;color:#334155;margin-top:6px;white-space:pre-wrap"><b>Obs.:</b> ' + esc(c.obs) + '</div>' : '')
    + '<div style="font-size:.72rem;color:#94a3b8;margin-top:6px">Do cadastro do AKILES · importado em ' + new Date(c.atualizadoEm).toLocaleString('pt-BR') + (c.por ? ' por ' + esc(c.por) : '') + '</div>';
}
