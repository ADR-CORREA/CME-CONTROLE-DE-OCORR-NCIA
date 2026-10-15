/* ═══════════════════════════ SECRETARIA — FALTAS E FOLHA DE PONTO ═══════════════════════════
   Pedido de 14/10/2026.
   • Faltas de serviço: cme_secretaria.faltas = [{ id, servidorId, data, obs, status, reposicao?, atestado?, criadoPor, criadoEm }]
     status: 'pendente' → a falta conta;
             'paga'       → o servidor REPÔS em outro dia (reposicao = { data, obs }); na folha a linha fica em branco;
             'justificada'→ trouxe ATESTADO (atestado = { arquivos:[{key,nome,tamanho}], obs }); a falta é retirada e na
                            folha a linha sai "ATESTADO". O atestado fica anexado (Worker /sec, pasta faltas/<servidor>).
   • Folha de ponto do mês, no formato da folha do SIGRH (A4 em pé, uma página por servidor):
     expediente → Manhã/Tarde/Noite, sábado/domingo/feriado em cinza; plantão → Entrada/Saída, dias em branco.
     Férias e licenças preenchem as linhas com o nome do afastamento ("FÉRIAS"); falta pendente → "FALTA";
     falta com atestado → "ATESTADO"; falta paga → linha em branco.
   Depende de secretaria*.js. Emojis só por \u{...}. Prefixo _secFal / sec_fal. */

const _SEC_FALTA_ST = { pendente: ['Pendente', '#b45309', '#fef3c7'], paga: ['Paga (reposta)', '#1d4ed8', '#dbeafe'], justificada: ['Justificada (atestado)', '#15803d', '#dcfce7'] };
let _secFalMes = null, _secFalFiltro = '';

// ── Funções de apoio ──────────────────────────────────────────────────────────
function _secFalMesAtual() { return _secFalMes || _secHoje().slice(0, 7); }
function _secFalPasta(sid) { return 'faltas/' + (String(sid || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 60) || 'geral'); }
function _secFalSelo(st) { const x = _SEC_FALTA_ST[st] || _SEC_FALTA_ST.pendente; return '<span style="display:inline-block;padding:2px 8px;border-radius:3px;border-left:2px solid ' + x[1] + ';font-size:.72rem;font-weight:700;color:' + x[1] + ';background:' + x[2] + ';white-space:nowrap">' + x[0] + '</span>'; }
function _secFalPendentes(d) { return (d || _secDados()).faltas.filter(f => f.status === 'pendente').length; }

// ── Aba ───────────────────────────────────────────────────────────────────────
function sec_renderFaltas() {
  const c = document.getElementById('sec-conteudo'); if (!c) return;
  const d = _secDados(), mes = _secFalMesAtual();
  const doMes = d.faltas.filter(f => f.data.slice(0, 7) === mes);
  const lista = (_secFalFiltro === 'pendente' ? d.faltas.filter(f => f.status === 'pendente') : _secFalFiltro ? doMes.filter(f => f.status === _secFalFiltro) : doMes)
    .slice().sort((a, b) => b.data.localeCompare(a.data) || _secNomeServ(a.servidorId, d).localeCompare(_secNomeServ(b.servidorId, d)));
  const n = st => doMes.filter(f => f.status === st).length, pendTodas = _secFalPendentes(d);
  const chip = (v, r) => '<button type="button" onclick="_secFalFiltro=\'' + v + '\';sec_renderFaltas()" style="padding:4px 10px;border-radius:4px;cursor:pointer;font-size:.8rem;' + (_secFalFiltro === v ? 'border:1px solid #2563eb;background:#eff6ff;color:#1d4ed8;font-weight:700;box-shadow:inset 2px 0 0 #2563eb' : 'border:1px solid #cbd5e1;background:#fff;color:#475569') + '">' + r + '</button>';
  const servs = d.servidores.filter(s => (s.situacao || 'ativo') === 'ativo').sort((a, b) => a.nome.localeCompare(b.nome));

  c.innerHTML = '<div style="background:#fff;border:1px solid #e2e8f0;border-left:4px solid #b45309;border-radius:6px;padding:12px 14px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
    + '<div><div style="font-weight:700;font-size:1.05rem">\u{1F4DD} Faltas de serviço</div>'
    + '<div style="font-size:.78rem;color:#64748b">Registre a falta; depois marque se o servidor <b>pagou</b> (repôs em outro dia) ou <b>trouxe atestado</b> (a falta é retirada).</div></div>'
    + '<div style="display:flex;align-items:center;gap:6px"><button class="btn-sm btn-outline" onclick="_secFalMes=_secEscMaisMes(\'' + mes + '\',-1);sec_renderFaltas()">\u{2039}</button>'
    + '<div style="min-width:140px;text-align:center;font-weight:700;text-transform:capitalize">' + esc(_secEscMesTxt(mes)) + '</div>'
    + '<button class="btn-sm btn-outline" onclick="_secFalMes=_secEscMaisMes(\'' + mes + '\',1);sec_renderFaltas()">\u{203A}</button></div>'
    + '<button class="btn-primary" onclick="sec_falNova()">+ Registrar falta</button></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' + chip('', 'Todas do mês (' + doMes.length + ')') + chip('pendente', 'Pendentes — todos os meses (' + pendTodas + ')')
    + chip('paga', 'Pagas (' + n('paga') + ')') + chip('justificada', 'Com atestado (' + n('justificada') + ')') + '</div>'
    + '<div class="table-scroll"><table class="data-table"><thead><tr><th>Data</th><th>Servidor</th><th>Situação</th><th>Detalhe</th><th></th></tr></thead><tbody>'
    + (lista.length ? lista.map(f => _secFalLinha(f, d)).join('') : '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:18px">Nenhuma falta ' + (_secFalFiltro === 'pendente' ? 'pendente.' : 'neste filtro.') + '</td></tr>')
    + '</tbody></table></div></div>'
    // ── Folha de ponto ──
    + '<div style="background:#fff;border:1px solid #e2e8f0;border-left:4px solid #2563eb;border-radius:6px;padding:12px 14px;margin-top:12px">'
    + '<div style="font-weight:700;font-size:1.05rem">\u{1F5D3}\u{FE0F} Folha de ponto</div>'
    + '<div style="font-size:.78rem;color:#64748b;margin-bottom:10px">Formato da folha do SIGRH, uma página por servidor. Férias e licenças saem escritas nas linhas; falta sai <b>FALTA</b>; falta com atestado sai <b>ATESTADO</b>; falta paga fica em branco.</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">'
    + '<div class="form-field" style="margin:0"><label>Mês</label><input type="month" id="sec-fol-mes" value="' + mes + '"></div>'
    + '<div class="form-field" style="margin:0;min-width:280px"><label>Servidor(es)</label><select id="sec-fol-alvo">'
    + '<option value="EXP">Todo o expediente (administrativo)</option><option value="PLA">Todos os plantonistas</option><option value="TODOS">Todos os servidores</option>'
    + '<optgroup label="Um servidor">' + servs.map(s => '<option value="' + s.id + '">' + esc(s.nome) + ' — ' + esc(s.equipe || 'sem equipe') + '</option>').join('') + '</optgroup></select></div>'
    + '<button class="btn-primary" onclick="sec_folhaGerar()">\u{1F5A8}\u{FE0F} Gerar folha de ponto</button></div></div>';
}

function _secFalLinha(f, d) {
  const s = _secServ(f.servidorId, d), arqs = (f.atestado && f.atestado.arquivos) || [];
  const detalhe = f.status === 'paga' ? 'Reposta em <b style="font-family:var(--font-mono)">' + _secBR(f.reposicao && f.reposicao.data) + '</b>' + (f.reposicao && f.reposicao.obs ? '<div style="font-size:.75rem;color:#64748b">' + esc(f.reposicao.obs) + '</div>' : '')
    : f.status === 'justificada' ? arqs.map(a => '<a href="#" onclick="sec_abrirDoc(\'' + encodeURIComponent(a.key) + '\',\'' + esc(a.nome).replace(/'/g, '') + '\');return false">\u{1F4CE} ' + esc(a.nome) + '</a>').join('<br>') + (f.atestado.obs ? '<div style="font-size:.75rem;color:#64748b">' + esc(f.atestado.obs) + '</div>' : '')
    : (f.obs ? '<span style="font-size:.8rem;color:#475569">' + esc(f.obs) + '</span>' : '<span style="color:#94a3b8">—</span>');
  const acoes = f.status === 'pendente'
    ? '<button class="btn-sm btn-outline" onclick="sec_falPagar(\'' + f.id + '\')">Pagou (repôs)</button> <button class="btn-sm btn-outline" style="color:#15803d" onclick="sec_falAtestado(\'' + f.id + '\')">\u{1F4CE} Atestado</button> '
    : '';
  return '<tr><td style="font-family:var(--font-mono);font-size:.82rem;white-space:nowrap">' + _secBR(f.data) + '</td>'
    + '<td><a href="#" onclick="sec_abrirPerfil(\'' + f.servidorId + '\');return false" style="font-weight:600">' + esc(s ? s.nome : '(servidor removido)') + '</a><div style="font-size:.72rem;color:#64748b">' + esc(s ? s.equipe || '' : '') + '</div></td>'
    + '<td>' + _secFalSelo(f.status) + '</td><td style="font-size:.82rem">' + detalhe + '</td>'
    + '<td style="white-space:nowrap">' + acoes + '<button class="btn-sm btn-outline" style="color:#b91c1c" onclick="sec_falExcluir(\'' + f.id + '\')">Excluir</button></td></tr>';
}

// ── Registrar falta ───────────────────────────────────────────────────────────
function sec_falNova() {
  const servs = _secDados().servidores.filter(s => (s.situacao || 'ativo') === 'ativo').sort((a, b) => a.nome.localeCompare(b.nome));
  _secModal('Registrar falta',
    '<div class="form-field"><label>Servidor *</label><select id="sec-fal-serv"><option value="">— escolha —</option>' + servs.map(s => '<option value="' + s.id + '">' + esc(s.nome) + ' — ' + esc(s.equipe || '') + '</option>').join('') + '</select></div>'
    + _secCampo('sec-fal-data', 'Dia da falta *', _secHoje(), 'type="date"')
    + _secCampo('sec-fal-obs', 'Observação (opcional)', '', 'placeholder="Ex.: não compareceu ao plantão"'),
    '<button class="btn-primary" id="sec-fal-salvar" onclick="sec_falSalvar()">Registrar</button>', 520);
}
async function sec_falSalvar() {
  const v = { servidorId: _secVal('sec-fal-serv'), data: _secVal('sec-fal-data'), obs: _secVal('sec-fal-obs').slice(0, 300) };
  if (!v.servidorId) { _mostrarToast('Escolha o servidor.', 'erro'); return; }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.data)) { _mostrarToast('Informe o dia da falta.', 'erro'); return; }
  const d0 = _secDados(), nome = _secNomeServ(v.servidorId, d0);
  if (d0.faltas.some(f => f.servidorId === v.servidorId && f.data === v.data)) { _mostrarToast('Já existe falta de ' + nome + ' em ' + _secBR(v.data) + '.', 'erro'); return; }
  const af = _secAfastamentoEm(v.servidorId, v.data, d0);
  if (af && !confirm(nome + ' está de ' + af.tipo + ' nesse dia. Registrar a falta mesmo assim?')) return;
  const agora = new Date().toISOString(), por = usuarioAtual ? usuarioAtual.nome : '';
  const ok = await _secMutar(d => {
    if (d.faltas.some(f => f.servidorId === v.servidorId && f.data === v.data)) return false;
    d.faltas.push(Object.assign({ id: _secId('fal'), status: 'pendente', criadoPor: por, criadoEm: agora }, v));
  }, { action: 'sec_falta_registrar', alvo: nome, detalhe: _secBR(v.data) + (v.obs ? ' · ' + v.obs : '') });
  if (!ok) return;
  _secFecharModal(); _mostrarToast('Falta registrada.', 'sucesso');
  _secFalMes = v.data.slice(0, 7); sec_render();
}

// ── Pagou (repôs em outro dia) ───────────────────────────────────────────────
function sec_falPagar(id) {
  const f = _secDados().faltas.find(x => x.id === id); if (!f) return;
  _secModal('Falta paga — ' + esc(_secNomeServ(f.servidorId)),
    '<div style="font-size:.85rem;color:#475569;margin-bottom:8px">Falta de <b>' + _secBR(f.data) + '</b>. Informe o dia em que o servidor repôs.</div>'
    + _secCampo('sec-fal-rep', 'Dia da reposição *', '', 'type="date"')
    + _secCampo('sec-fal-repobs', 'Observação (opcional)', '', 'placeholder="Ex.: cobriu o plantão da guarnição CHARLIE"'),
    '<button class="btn-primary" onclick="sec_falPagarSalvar(\'' + id + '\')">Confirmar</button>', 520);
}
async function sec_falPagarSalvar(id) {
  const rep = { data: _secVal('sec-fal-rep'), obs: _secVal('sec-fal-repobs').slice(0, 300) };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rep.data)) { _mostrarToast('Informe o dia da reposição.', 'erro'); return; }
  const f0 = _secDados().faltas.find(x => x.id === id); if (!f0) return;
  const agora = new Date().toISOString(), por = usuarioAtual ? usuarioAtual.nome : '';
  const ok = await _secMutar(d => {
    const f = d.faltas.find(x => x.id === id); if (!f || f.status !== 'pendente') return false;
    Object.assign(f, { status: 'paga', reposicao: Object.assign({ registradoPor: por, registradoEm: agora }, rep) });
  }, { action: 'sec_falta_paga', alvo: _secNomeServ(f0.servidorId), detalhe: 'falta de ' + _secBR(f0.data) + ' reposta em ' + _secBR(rep.data) });
  if (!ok) return;
  _secFecharModal(); _mostrarToast('Falta marcada como paga.', 'sucesso'); sec_render();
}

// ── Atestado (falta justificada — é retirada) ─────────────────────────────────
function sec_falAtestado(id) {
  const f = _secDados().faltas.find(x => x.id === id); if (!f) return;
  _secModal('Atestado — ' + esc(_secNomeServ(f.servidorId)),
    '<div style="font-size:.85rem;color:#475569;margin-bottom:8px">Falta de <b>' + _secBR(f.data) + '</b>. Com o atestado anexado a falta é <b>retirada</b> e a folha de ponto mostra "ATESTADO" nesse dia.</div>'
    + '<div class="form-field"><label>Arquivo do atestado * — PDF ou foto, até 15 MB</label><input type="file" id="sec-fal-arq" multiple accept=".pdf,.jpg,.jpeg,.png,.webp"></div>'
    + _secCampo('sec-fal-atobs', 'Observação (opcional)', '', 'placeholder="Ex.: atestado de 1 dia"'),
    '<button class="btn-primary" id="sec-fal-atsalvar" onclick="sec_falAtestadoSalvar(\'' + id + '\')">Anexar e justificar</button>', 540);
}
async function sec_falAtestadoSalvar(id) {
  const files = [...(document.getElementById('sec-fal-arq')?.files || [])], obs = _secVal('sec-fal-atobs').slice(0, 300);
  if (!files.length) { _mostrarToast('Anexe o arquivo do atestado.', 'erro'); return; }
  const grande = files.find(x => x.size > 15 * 1024 * 1024); if (grande) { _mostrarToast(grande.name + ': maior que 15 MB.', 'erro'); return; }
  const f0 = _secDados().faltas.find(x => x.id === id); if (!f0) return;
  const nome = _secNomeServ(f0.servidorId), btn = document.getElementById('sec-fal-atsalvar'); if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
  const enviados = [];
  try {
    for (const f of files) {
      _mostrarToast('Enviando ' + f.name + '…');
      const r = await r2_api('POST', '/sec/upload', { 'Content-Type': 'application/json' }, JSON.stringify({ pasta: _secFalPasta(f0.servidorId), nome: f.name, conteudo: await _secLerArquivo(f), descricao: ('Atestado — falta de ' + _secBR(f0.data)).slice(0, 300), referencia: nome.slice(0, 150) }));
      enviados.push({ key: r.key, nome: f.name, tamanho: f.size });
    }
  } catch (e) {
    _mostrarToast('Não consegui enviar o atestado: ' + (e.message || e) + '. Nada foi salvo.', 'erro');
    await _secMoverParaLixeiraR2(enviados);
    if (btn) { btn.disabled = false; btn.textContent = 'Anexar e justificar'; }
    return;
  }
  const agora = new Date().toISOString(), por = usuarioAtual ? usuarioAtual.nome : '';
  const ok = await _secMutar(d => {
    const f = d.faltas.find(x => x.id === id); if (!f || f.status !== 'pendente') return false;
    Object.assign(f, { status: 'justificada', atestado: { arquivos: enviados, obs, registradoPor: por, registradoEm: agora } });
  }, { action: 'sec_falta_atestado', alvo: nome, detalhe: 'falta de ' + _secBR(f0.data) + ' justificada · ' + enviados.length + ' arquivo(s)' });
  if (!ok) { await _secMoverParaLixeiraR2(enviados); if (btn) { btn.disabled = false; btn.textContent = 'Anexar e justificar'; } return; }
  _secFecharModal(); _mostrarToast('Atestado anexado — falta retirada.', 'sucesso'); sec_render();
}

async function sec_falExcluir(id) {
  const f0 = _secDados().faltas.find(x => x.id === id); if (!f0) return;
  const nome = _secNomeServ(f0.servidorId);
  if (!confirm('Excluir a falta de ' + nome + ' em ' + _secBR(f0.data) + '?\n\nO registro (e o atestado, se houver) vai para a lixeira da Secretaria.')) return;
  const ok = await _secMutar(d => { const i = d.faltas.findIndex(x => x.id === id); if (i < 0) return false; _secParaLixeira(d, 'falta', d.faltas[i]); d.faltas.splice(i, 1); },
    { action: 'sec_falta_excluir', alvo: nome, detalhe: _secBR(f0.data) });
  if (!ok) return;
  if (f0.atestado && f0.atestado.arquivos) await _secMoverParaLixeiraR2(f0.atestado.arquivos);
  _mostrarToast('Falta excluída (na lixeira).', 'sucesso'); sec_render();
}

// ── Folha de ponto (formato SIGRH) ────────────────────────────────────────────
// texto da linha do dia: afastamento > falta (pendente = FALTA, atestado = ATESTADO, paga = branco) > fim de semana/feriado (só expediente)
function _secFolhaDia(s, dt, d, expediente) {
  const af = _secAfastamentoEm(s.id, dt, d);
  if (af) return { txt: String(af.tipo).toUpperCase(), cinza: false };
  const f = d.faltas.find(x => x.servidorId === s.id && x.data === dt);
  if (f && f.status === 'pendente') return { txt: 'FALTA', cinza: false };
  if (f && f.status === 'justificada') return { txt: 'ATESTADO', cinza: false };
  if (expediente) {
    if (((d.config || {}).feriados || []).includes(dt)) return { txt: 'FERIADO', cinza: true };
    const dow = new Date(dt + 'T12:00:00').getDay();
    if (dow === 6) return { txt: 'SÁBADO', cinza: true };
    if (dow === 0) return { txt: 'DOMINGO', cinza: true };
  }
  return { txt: '', cinza: false };
}
function _secFolhaPagina(s, mes, d) {
  const MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  const exp = s.equipe === 'EXPEDIENTE' || !_PL_EQUIPES_SEC.includes(s.equipe);
  const ult = +_secServFimMes(mes).slice(8), b = 'border:1px solid #000;padding:1px 4px';
  const rot = t => '<div style="font-size:7pt;font-weight:bold">' + t + '</div>';
  const iapen = window._IAPEN_LOGO_B64 ? '<img src="data:image/png;base64,' + window._IAPEN_LOGO_B64 + '" style="height:54px;width:auto">' : '';
  let linhas = '';
  for (let i = 1; i <= ult; i++) {
    const dt = mes + '-' + String(i).padStart(2, '0'), x = _secFolhaDia(s, dt, d, exp);
    const fundo = x.cinza ? ';background:#cfcfcf' : '';
    const cel = x.txt ? '<td colspan="' + (exp ? 6 : 2) + '" style="' + b + fundo + ';font-weight:bold;letter-spacing:.45em;font-size:8pt">' + esc(x.txt) + '</td>'
      : ('<td style="' + b + '"></td>').repeat(exp ? 6 : 2);
    linhas += '<tr style="height:5.6mm"><td style="' + b + fundo + ';text-align:center;font-weight:bold">' + String(i).padStart(2, '0') + '</td>' + cel + '<td style="' + b + fundo + '"></td></tr>';
  }
  // quadro de abono: afastamentos e faltas do mês
  const ini = mes + '-01', fim = _secServFimMes(mes), motivos = [];
  d.afastamentos.filter(a => a.servidorId === s.id && a.inicio <= fim && (a.fim || a.inicio) >= ini).forEach(a => motivos.push([(a.inicio < ini ? '01' : a.inicio.slice(8)) + ' a ' + ((a.fim || a.inicio) > fim ? fim.slice(8) : (a.fim || a.inicio).slice(8)), a.tipo]));
  d.faltas.filter(f => f.servidorId === s.id && f.data.slice(0, 7) === mes && f.status !== 'paga').sort((a, c) => a.data.localeCompare(c.data))
    .forEach(f => motivos.push([f.data.slice(8), f.status === 'justificada' ? 'Falta justificada — atestado' : 'Falta']));
  const nAbono = Math.max(4, motivos.length);
  let abono = '';
  for (let i = 0; i < nAbono; i++) abono += '<tr style="height:5mm"><td style="' + b + ';text-align:center">' + esc(motivos[i] ? motivos[i][0] : '') + '</td><td style="' + b + '">' + esc(motivos[i] ? motivos[i][1] : '') + '</td><td style="' + b + '"></td></tr>';
  const cab = exp
    ? '<tr><th rowspan="2" style="' + b + ';width:9mm">Dia</th><th colspan="2" style="' + b + '">Manhã/Hora</th><th colspan="2" style="' + b + '">Tarde/Hora</th><th colspan="2" style="' + b + '">Noite/Hora</th><th rowspan="2" style="' + b + '">Assinatura</th></tr>'
      + '<tr>' + ['Entrada', 'Saída', 'Entrada', 'Saída', 'Entrada', 'Saída'].map(t => '<th style="' + b + ';width:14mm;font-size:7pt">' + t + '</th>').join('') + '</tr>'
    : '<tr><th style="' + b + ';width:9mm">Dia</th><th style="' + b + ';width:30mm">Entrada</th><th style="' + b + ';width:30mm">Saída</th><th style="' + b + '">Assinatura</th></tr>';
  return '<div class="pag">'
    + '<div style="display:flex;align-items:center;gap:10px">' + iapen + '<div style="flex:1;line-height:1.25"><div style="font-weight:bold;font-size:11pt">GOVERNO DO ESTADO DO AMAPÁ</div><div style="font-weight:bold;font-size:8pt">INSTITUTO DE ADMINISTRAÇÃO PENITENCIÁRIA DO ESTADO DO AMAPÁ</div><div style="font-size:8pt">Central de Monitoramento Eletrônico – CME/IAPEN</div></div>'
    + '<div style="text-align:right"><div style="font-weight:bold;font-size:10pt">Controle de Frequência</div><div style="background:#d9d9d9;padding:1px 8px;font-size:8pt;margin-top:3px">Mês/Ano: ' + MESES[+mes.slice(5, 7) - 1] + '/' + mes.slice(0, 4) + '</div></div></div>'
    + '<table style="margin-top:6px"><tr><td style="' + b + '" colspan="2">' + rot('Unidade Organizacional') + 'CENTRAL DE MONITORAMENTO ELETRÔNICO - CME</td></tr>'
    + (exp ? '<tr><td style="' + b + '" colspan="2">' + rot('Município') + 'MACAPÁ</td></tr>'
      : '<tr><td style="' + b + ';width:50%">' + rot('Guarnição') + esc(s.equipe || '') + '</td><td style="' + b + '">' + rot('Município') + 'MACAPÁ</td></tr>') + '</table>'
    + '<div style="font-weight:bold;font-size:8pt;margin-top:4px">Servidor</div>'
    + '<table><tr><td style="' + b + ';width:50%">' + rot('Nome') + esc(s.nome) + '</td><td style="' + b + '">' + rot('Matrícula') + esc(s.matricula || '') + '</td>'
    + (exp ? '<td style="' + b + '">' + rot('CPF') + esc(s.cpf ? s.cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : '') + '</td><td style="' + b + '">' + rot('Carga horária') + esc(s.cargaHoraria || '') + '</td>' : '') + '</tr>'
    + '<tr><td style="' + b + '">' + rot('Cargo') + esc(String(s.cargo || '').toUpperCase()) + '</td><td style="' + b + '">' + rot('Tipo Vínculo') + esc(String(s.vinculo || '').toUpperCase()) + '</td>'
    + (exp ? '<td style="' + b + '" colspan="2">' + rot('Nível/Referência') + esc(s.nivel || '') + '</td>' : '') + '</tr></table>'
    + '<table style="margin-top:6px;font-size:8pt">' + cab + linhas + '</table>'
    + '<div style="display:flex;gap:8px;margin-top:6px;align-items:flex-start"><table style="flex:1.6;font-size:7.5pt"><tr><th style="' + b + ';width:16mm">Dia</th><th style="' + b + '">Motivo (licenças, férias, faltas justificadas ou não)</th><th style="' + b + ';width:28mm">Assinatura</th></tr>' + abono + '</table>'
    + '<table style="flex:1;font-size:7.5pt"><tr><th colspan="2" style="' + b + ';text-align:left">Chefia imediata</th></tr><tr><td colspan="2" style="' + b + ';font-size:7pt">Reconheço como verdadeiras as anotações sobre a assiduidade e a pontualidade do servidor e as assumo na íntegra.</td></tr>'
    + '<tr style="height:14mm"><td style="' + b + ';width:16mm;vertical-align:top">Data</td><td style="' + b + ';vertical-align:top">Carimbo e assinatura</td></tr></table></div>'
    + '<div style="font-size:6.5pt;color:#444;margin-top:4px;text-align:right">Emitida pelo sistema CME em ' + new Date().toLocaleString('pt-BR') + (usuarioAtual ? ' por ' + esc(usuarioAtual.nome) : '') + '</div>'
    + '</div>';
}
function sec_folhaGerar() {
  const mes = _secVal('sec-fol-mes'), alvo = _secVal('sec-fol-alvo');
  if (!/^\d{4}-\d{2}$/.test(mes)) { _mostrarToast('Escolha o mês.', 'erro'); return; }
  const d = _secDados(), ativos = d.servidores.filter(s => (s.situacao || 'ativo') === 'ativo');
  const lista = (alvo === 'EXP' ? ativos.filter(s => s.equipe === 'EXPEDIENTE') : alvo === 'PLA' ? ativos.filter(s => _PL_EQUIPES_SEC.includes(s.equipe)) : alvo === 'TODOS' ? ativos : d.servidores.filter(s => s.id === alvo))
    .sort((a, b) => String(a.equipe || '').localeCompare(String(b.equipe || '')) || a.nome.localeCompare(b.nome));
  if (!lista.length) { _mostrarToast('Nenhum servidor para gerar a folha.', 'erro'); return; }
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Folha de ponto - ' + mes + '</title>'
    + '<style>@page{size:A4 portrait;margin:8mm 10mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0;font-size:8.5pt}'
    + 'table{border-collapse:collapse;width:100%}.pag{page-break-after:always}.pag:last-child{page-break-after:auto}@media screen{body{padding:10px 16px}.pag{margin-bottom:30px}}@media print{.np{display:none}}</style></head><body>'
    + '<div class="np" style="text-align:right;margin-bottom:6px"><button onclick="print()" style="padding:6px 16px;font-size:11pt;cursor:pointer">Imprimir</button></div>'
    + lista.map(s => _secFolhaPagina(s, mes, d)).join('') + '</body></html>';
  _entregarDoc(new Blob([html], { type: 'text/html' }), 'Folha de ponto ' + mes + (lista.length === 1 ? ' - ' + lista[0].nome : '') + '.html');
  auditar({ modulo: 'Secretaria', action: 'sec_folha_gerar', alvo: _secEscMesTxt(mes), detalhe: lista.length + ' servidor(es)' });
}
Object.assign(_SEC_ACOES, { sec_falta_registrar: 'Registrou falta de serviço', sec_falta_paga: 'Marcou falta como paga (reposta)', sec_falta_atestado: 'Anexou atestado (falta justificada)', sec_falta_excluir: 'Excluiu falta (lixeira)', sec_folha_gerar: 'Gerou folha de ponto' });
