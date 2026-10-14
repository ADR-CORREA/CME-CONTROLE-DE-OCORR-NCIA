/* ═══════════════════════════ SECRETARIA — ESCALA DE APOIO DO ADMINISTRATIVO (SÁBADOS) ═══════════════════════════
   Sábados das 08h às 12h. É OBRIGAÇÃO do servidor administrativo para ter direito ao adicional noturno —
   NÃO gera dispensa (não mexe na Ficha de Apoio e Dispensas; apoio em evento de folga é outra coisa).
   • Dados: cme_secretaria.escalaSabado = [{ id, data, servidorId | nome, local: CME|PEF, status: ''|presente|falta }]
     e cme_secretaria.config.escalaHorario (padrão "das 08h às 12h").
   • Painel de escala no Hoje, editado NO PRÓPRIO QUADRO: os sábados de cada mês aparecem sozinhos (colunas);
     arraste o nome do expediente para o sábado (ou "+ adicionar"); clique na etiqueta para trocar CME/PEF;
     clique no nome (depois do sábado) para marcar compareceu/faltou; ✕ tira; arraste entre sábados para mudar.
   • "Preencher automaticamente": distribui o expediente pelos sábados do mês (cada um 1 vez), pula afastados,
     prioriza quem está há mais tempo sem sábado e alterna CME/PEF de quem é "rodízio".
   Depende de secretaria*.js. Emojis só por \u{...}. Prefixo _secEsc / sec_esc. */

const _SEC_ESC_LOCAIS = ['CME', 'PEF'];
const _SEC_ESC_HORARIO = 'das 08h às 12h';
// Escala de outubro/2026 enviada pela gerência em 14/10 (botão "carregar" aparece só enquanto o mês estiver vazio)
const _SEC_ESC_OUT2026 = {
  '2026-10-03': [['ADRIANO', 'CME'], ['RONI', 'CME'], ['EVERTON', 'CME'], ['P ALEXANDRE', 'PEF']],
  '2026-10-10': [['PATRICIA', 'CME'], ['FABIOLLA', 'CME'], ['LENILDA', 'PEF']],
  '2026-10-17': [['DIEGO SOUZA', 'CME'], ['DEBORA', 'CME'], ['P GABRIEL', 'PEF']],
  '2026-10-24': [['VALDIRENE', 'CME'], ['PEDRO', 'CME'], ['EDICLEYDE', 'PEF']],
  '2026-10-31': [['BRUNA', 'CME'], ['ROZANE', 'CME'], ['SILMARA', 'PEF']],
};
let _secEscMesVis = null, _secEscPicker = null, _secEscExtra = null;

// ── Funções de apoio ──────────────────────────────────────────────────────────
function _secEscNorm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function _secEscSabados(mes) {
  const [a, m] = mes.split('-').map(Number), out = [];
  for (let dia = 1; dia <= new Date(a, m, 0).getDate(); dia++) { const dt = new Date(a, m - 1, dia, 12); if (dt.getDay() === 6) out.push(mes + '-' + String(dia).padStart(2, '0')); }
  return out;
}
function _secEscDatas(mes, d) { return [...new Set(_secEscSabados(mes).concat(d.escalaSabado.filter(x => x.data.slice(0, 7) === mes).map(x => x.data)).concat(_secEscExtra && _secEscExtra.slice(0, 7) === mes ? [_secEscExtra] : []))].sort(); }
function _secEscNome(x, d) { return x.servidorId ? _secNomeServ(x.servidorId, d) : (x.nome || '—'); }
function _secEscCurto(nome) { const p = String(nome).split(' ').filter(Boolean); return p.length > 2 ? p[0] + ' ' + p[p.length - 1] : nome; }
function _secEscMesTxt(mes) { return new Date(mes + '-15T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); }
function _secEscMaisMes(mes, n) { const [a, m] = mes.split('-').map(Number), x = new Date(a, m - 1 + n, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); }
// servidor pelo nome curto do papel ("P ALEXANDRE" = Paulo Alexandre…): só casa se for ÚNICO
function _secEscAcharServidor(curto, d) {
  const toks = _secEscNorm(curto).split(' ').filter(Boolean);
  const cands = d.servidores.filter(s => { const n = _secEscNorm(s.nome).split(' '); return toks.every(t => t.length === 1 ? n.some(x => x[0] === t) : n.includes(t)); });
  return cands.length === 1 ? cands[0] : null;
}
function _secEscAfastadosMes(mes, d) {
  const ini = mes + '-01', fim = mes + '-31';
  return d.afastamentos.filter(a => a.inicio <= fim && (a.fim || a.inicio) >= ini).sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
}
function _secEscAfastadoEm(sid, dt, d) { return d.afastamentos.find(a => a.servidorId === sid && a.inicio <= dt && (a.fim || a.inicio) >= dt) || null; }
// quem faz sábado: expediente ativo (e quem tiver "apoio de sábado" marcado no cadastro)
function _secEscPessoal(d) { return d.servidores.filter(s => (s.situacao || 'ativo') === 'ativo' && (s.equipe === 'EXPEDIENTE' || s.apoioRegime)).sort((a, b) => a.nome.localeCompare(b.nome)); }
// local padrão: "só CME" → CME; "rodízio" → o contrário do último sábado dele; senão CME
function _secEscLocalPadrao(sid, d, ateData) {
  const s = _secServ(sid, d); if (!s || s.apoioRegime !== 'ROD') return 'CME';
  const ult = d.escalaSabado.filter(x => x.servidorId === sid && (!ateData || x.data < ateData)).sort((a, b) => b.data.localeCompare(a.data))[0];
  return ult ? (ult.local === 'PEF' ? 'CME' : 'PEF') : 'CME';
}
function _secEscAtualizar() { const el = document.getElementById('sec-esc-card'); if (el) el.outerHTML = _secCartaoEscala(); }

// ── Painel (editado no próprio quadro) ───────────────────────────────────────
function _secCartaoEscala() {
  const d = _secDados(), hoje = _secHoje(), mes = _secEscMesVis || hoje.slice(0, 7);
  const datas = _secEscDatas(mes, d), prox = datas.find(x => x >= hoje), horario = (d.config || {}).escalaHorario || _SEC_ESC_HORARIO;
  const doMes = d.escalaSabado.filter(x => x.data.slice(0, 7) === mes), vazio = !doMes.length;
  const pessoal = _secEscPessoal(d), afast = _secEscAfastadosMes(mes, d);
  const qtd = sid => doMes.filter(x => x.servidorId === sid).length;
  const bt = (txt, on, estilo) => '<button type="button" onclick="' + on + '" style="padding:5px 12px;border-radius:6px;cursor:pointer;font-size:.82rem;font-weight:600;' + (estilo || 'border:1px solid #cbd5e1;background:#fff;color:#334155') + '">' + txt + '</button>';

  const coluna = dt => {
    const lst = d.escalaSabado.filter(x => x.data === dt).sort((a, b) => a.local.localeCompare(b.local) || _secEscNome(a, d).localeCompare(_secEscNome(b, d)));
    const passou = dt <= hoje, ehHoje = dt === hoje, ehProx = dt === prox && !ehHoje, dia = new Date(dt + 'T12:00:00');
    const destaque = ehHoje || ehProx ? '#7c3aed' : '#e2e8f0';
    const chip = x => {
      const pres = x.status === 'presente', falta = x.status === 'falta';
      return '<div draggable="true" ondragstart="sec_escArrastar(event,\'item\',\'' + x.id + '\')" style="display:flex;align-items:center;gap:6px;padding:6px 8px;margin-top:6px;border-radius:6px;cursor:grab;background:' + (falta ? '#fef2f2' : pres ? '#f0fdf4' : '#fff') + ';border:1px solid ' + (falta ? '#fecaca' : pres ? '#bbf7d0' : '#e2e8f0') + '">'
        + '<span ' + (passou ? 'onclick="sec_escPresenca(\'' + x.id + '\')" title="Clique: compareceu / faltou" style="flex:1;min-width:0;font-size:.85rem;font-weight:600;cursor:pointer;' : 'style="flex:1;min-width:0;font-size:.85rem;font-weight:600;') + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
        + (pres ? '<span style="color:#16a34a">\u{2714}</span> ' : falta ? '<span style="color:#dc2626">\u{2718}</span> ' : '') + esc(_secEscCurto(_secEscNome(x, d))) + '</span>'
        + '<span onclick="sec_escLocal(\'' + x.id + '\')" title="Clique para trocar CME / PEF" style="cursor:pointer;font-size:.68rem;font-weight:700;padding:2px 6px;border-radius:3px;' + (x.local === 'PEF' ? 'background:#fef3c7;color:#92400e' : 'background:#dbeafe;color:#1e40af') + '">' + esc(x.local) + '</span>'
        + '<span onclick="sec_escRemover(\'' + x.id + '\')" title="Tirar da escala" style="cursor:pointer;color:#94a3b8;font-size:.9rem">\u{2715}</span></div>';
    };
    const picker = _secEscPicker === dt ? '<div style="margin-top:6px;padding:6px;border:1px dashed #7c3aed;border-radius:6px;background:#faf5ff">'
      + '<select id="sec-esc-sel" style="width:100%;padding:4px;margin-bottom:4px"><option value="">Escolha o servidor…</option>'
      + pessoal.map(s => { const af = _secEscAfastadoEm(s.id, dt, d), n = qtd(s.id); return '<option value="' + s.id + '">' + esc(_secEscCurto(s.nome)) + (af ? ' — ' + esc(af.tipo.toLowerCase()) : n ? ' — já tem ' + n + ' sábado' : '') + '</option>'; }).join('')
      + '<option value="__outro">Outra pessoa (digitar o nome)…</option></select>'
      + '<div style="display:flex;gap:4px">' + _SEC_ESC_LOCAIS.map(l => '<button type="button" onclick="sec_escConfirmarPicker(\'' + dt + '\',\'' + l + '\')" style="flex:1;padding:4px;border-radius:4px;cursor:pointer;font-weight:700;font-size:.78rem;' + (l === 'PEF' ? 'background:#fef3c7;color:#92400e;border:1px solid #fcd34d' : 'background:#dbeafe;color:#1e40af;border:1px solid #93c5fd') + '">+ ' + l + '</button>').join('')
      + '<button type="button" onclick="_secEscPicker=null;_secEscAtualizar()" style="padding:4px 8px;border-radius:4px;cursor:pointer;border:1px solid #cbd5e1;background:#fff">\u{2715}</button></div></div>'
      : '<div onclick="_secEscPicker=\'' + dt + '\';_secEscAtualizar()" style="margin-top:6px;padding:6px;border:1px dashed #cbd5e1;border-radius:6px;text-align:center;font-size:.8rem;color:#64748b;cursor:pointer">+ adicionar</div>';
    return '<div ondragover="event.preventDefault();this.style.background=\'#f5f3ff\'" ondragleave="this.style.background=\'\'" ondrop="sec_escSoltar(event,\'' + dt + '\')" style="flex:1 1 160px;min-width:150px;border:2px solid ' + destaque + ';border-radius:8px;padding:8px;' + (passou && !ehHoje ? 'background:#f8fafc' : '') + '">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline"><div><div style="font-size:.7rem;font-weight:700;color:#64748b;text-transform:uppercase">' + dia.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') + '</div>'
      + '<div style="font-size:1.4rem;font-weight:700;line-height:1;color:' + (ehHoje || ehProx ? '#6d28d9' : '#0f172a') + '">' + String(dia.getDate()).padStart(2, '0') + '<span style="font-size:.8rem;color:#94a3b8">/' + String(dia.getMonth() + 1).padStart(2, '0') + '</span></div></div>'
      + '<div style="text-align:right;font-size:.68rem;font-weight:700;color:' + (ehHoje || ehProx ? '#6d28d9' : '#94a3b8') + '">' + (ehHoje ? 'HOJE' : ehProx ? 'PRÓXIMO' : passou ? 'REALIZADO' : '') + '<div style="font-weight:400;color:#94a3b8">' + lst.length + ' pessoa(s)</div></div></div>'
      + lst.map(chip).join('') + picker + '</div>';
  };

  const lateral = '<div style="flex:0 0 220px;min-width:200px;border:1px solid #e2e8f0;border-radius:8px;padding:8px;background:#fcfcfd">'
    + '<div style="font-weight:700;font-size:.85rem">Expediente</div><div style="font-size:.72rem;color:#64748b;margin-bottom:6px">Arraste o nome para um sábado</div>'
    + '<div style="max-height:360px;overflow:auto">' + pessoal.map(s => {
      const n = qtd(s.id), af = afast.find(a => a.servidorId === s.id);
      return '<div draggable="true" ondragstart="sec_escArrastar(event,\'serv\',\'' + s.id + '\')" title="' + esc(s.nome) + '" style="display:flex;justify-content:space-between;gap:6px;align-items:center;padding:5px 6px;margin-bottom:3px;border-radius:5px;cursor:grab;background:#fff;border:1px solid #e2e8f0' + (af ? ';opacity:.55' : '') + '">'
        + '<span style="font-size:.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(_secEscCurto(s.nome)) + (s.apoioRegime === 'ROD' ? ' <span title="Rodízio CME/PEF" style="font-size:.62rem;color:#92400e">\u{21C4}</span>' : '') + '</span>'
        + '<span style="font-size:.66rem;font-weight:700;white-space:nowrap;color:' + (af ? '#64748b' : n ? '#15803d' : '#b45309') + '">' + (af ? esc(af.tipo.split(' ')[0].toLowerCase()) : n ? '\u{2714} ' + n : 'sem sábado') + '</span></div>';
    }).join('') + '</div></div>';

  const tabelaAfast = !afast.length ? '' : '<div style="margin-top:12px"><div style="font-weight:700;font-size:.88rem;margin-bottom:4px">Férias e licenças em ' + esc(_secEscMesTxt(mes)) + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:6px">' + afast.map(a => {
      const cor = typeof _secCorTipo === 'function' ? _secCorTipo(a.tipo) : '#64748b', emCurso = a.inicio <= hoje && (a.fim || a.inicio) >= hoje;
      return '<div style="display:flex;gap:8px;align-items:center;padding:6px 8px;border:1px solid #e2e8f0;border-left:3px solid ' + cor + ';border-radius:4px;background:#fff">'
        + '<div style="flex:1;min-width:0"><div style="font-size:.82rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(_secEscCurto(_secNomeServ(a.servidorId, d))) + '</div>'
        + '<div style="font-size:.72rem;color:' + cor + ';font-weight:600">' + esc(a.tipo) + '</div></div>'
        + '<div style="text-align:right;font-size:.72rem;font-family:var(--font-mono);color:#334155">' + _secBR(a.inicio).slice(0, 5) + ' → ' + _secBR(a.fim || a.inicio).slice(0, 5) + (emCurso ? '<div style="color:#b91c1c;font-family:inherit;font-weight:600">em curso</div>' : '') + '</div></div>';
    }).join('') + '</div></div>';

  return '<div id="sec-esc-card" style="background:#fff;border:1px solid #e2e8f0;border-left:4px solid #7c3aed;border-radius:6px;padding:12px 14px;margin-top:12px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
    + '<div><div style="font-weight:700;font-size:1.05rem">\u{1F4CB} Escala de apoio do administrativo</div>'
    + '<div style="font-size:.78rem;color:#64748b">Sábados, <span onclick="sec_escHorarioEditar()" title="Clique para mudar o horário" style="cursor:pointer;text-decoration:underline dotted">' + esc(horario) + '</span> · obrigação para o adicional noturno (não gera dispensa)</div></div>'
    + '<div style="display:flex;align-items:center;gap:6px">' + bt('\u{2039}', '_secEscMesVis=_secEscMaisMes(\'' + mes + '\',-1);_secEscPicker=null;_secEscAtualizar()')
    + '<div style="min-width:150px;text-align:center;font-weight:700;text-transform:capitalize">' + esc(_secEscMesTxt(mes)) + '</div>'
    + bt('\u{203A}', '_secEscMesVis=_secEscMaisMes(\'' + mes + '\',1);_secEscPicker=null;_secEscAtualizar()') + '</div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap">' + (mes === '2026-10' && vazio ? bt('Carregar a escala de outubro (papel)', 'sec_escCarregarOutubro()', 'border:1px solid #7c3aed;background:#f5f3ff;color:#6d28d9') : '')
    + (vazio ? bt('\u{2728} Preencher automaticamente', 'sec_escAutomatico(\'' + mes + '\')', 'border:1px solid #7c3aed;background:#7c3aed;color:#fff') : '')
    + bt('\u{1F5A8}\u{FE0F} Imprimir', 'sec_escImprimir(\'' + mes + '\')') + '</div></div>'
    + (vazio ? '<div style="font-size:.85rem;color:#475569;background:#f8fafc;border-radius:6px;padding:8px 12px;margin-bottom:10px">Escala de ' + esc(_secEscMesTxt(mes)) + ' ainda não montada. Use <b>Preencher automaticamente</b> ou arraste os nomes do expediente para os sábados.</div>' : '')
    + '<div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap"><div style="flex:1 1 600px;display:flex;gap:8px;flex-wrap:wrap">' + datas.map(coluna).join('')
    + '<div onclick="sec_escDataExtra(\'' + mes + '\')" title="Incluir um dia que não é sábado (feriado, mutirão…)" style="flex:0 0 46px;border:1px dashed #cbd5e1;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8;cursor:pointer;font-size:1.2rem;min-height:80px">+</div></div>'
    + lateral + '</div>'
    + '<div style="font-size:.72rem;color:#94a3b8;margin-top:8px">Clique na etiqueta CME/PEF para trocar · depois do sábado, clique no nome para marcar compareceu (\u{2714}) ou faltou (\u{2718}) · \u{2715} tira · arraste um nome de um sábado para outro para mudar o dia.</div>'
    + tabelaAfast + '</div>';
}

// ── Ações (cada uma grava na hora e redesenha só o quadro) ────────────────────
async function _secEscAdd(dt, sid, nome, local) {
  const d0 = _secDados();
  if (sid && d0.escalaSabado.some(x => x.data === dt && x.servidorId === sid)) { _mostrarToast('Essa pessoa já está nesse dia.', 'erro'); return false; }
  const af = sid && _secEscAfastadoEm(sid, dt, d0);
  if (af && !confirm(_secNomeServ(sid, d0) + ' está de ' + af.tipo.toLowerCase() + ' nesse dia. Escalar mesmo assim?')) return false;
  local = local || (sid ? _secEscLocalPadrao(sid, d0, dt) : 'CME');
  const ok = await _secMutar(d => { d.escalaSabado.push({ id: _secId('esc'), data: dt, servidorId: sid || '', nome: nome || '', local, status: '', criadoPor: usuarioAtual ? usuarioAtual.nome : '', criadoEm: new Date().toISOString() }); },
    { action: 'sec_esc_add', alvo: sid ? _secNomeServ(sid, d0) : nome, detalhe: _secBR(dt) + ' · ' + local });
  return ok;
}
async function sec_escConfirmarPicker(dt, local) {
  const v = (document.getElementById('sec-esc-sel') || {}).value;
  if (!v) { _mostrarToast('Escolha o servidor.', 'erro'); return; }
  let sid = v, nome = '';
  if (v === '__outro') { nome = (prompt('Nome da pessoa (não está na lista de servidores):') || '').trim(); if (nome.length < 3) return; sid = ''; }
  if (await _secEscAdd(dt, sid, nome, local)) { _secEscPicker = null; _secEscAtualizar(); }
}
function sec_escArrastar(ev, tipo, id) { ev.dataTransfer.setData('text/plain', tipo + ':' + id); ev.dataTransfer.effectAllowed = 'move'; }
async function sec_escSoltar(ev, dt) {
  ev.preventDefault(); ev.currentTarget.style.background = '';
  const [tipo, id] = String(ev.dataTransfer.getData('text/plain') || '').split(':');
  if (tipo === 'serv') { if (await _secEscAdd(dt, id, '', '')) _secEscAtualizar(); return; }
  if (tipo !== 'item') return;
  const d0 = _secDados(), x = d0.escalaSabado.find(e => e.id === id); if (!x || x.data === dt) return;
  if (x.servidorId && d0.escalaSabado.some(e => e.data === dt && e.servidorId === x.servidorId)) { _mostrarToast('Essa pessoa já está nesse dia.', 'erro'); return; }
  const ok = await _secMutar(d => { const e = d.escalaSabado.find(z => z.id === id); if (!e) return false; e.data = dt; e.status = ''; e.editadoPor = usuarioAtual ? usuarioAtual.nome : ''; e.editadoEm = new Date().toISOString(); },
    { action: 'sec_esc_mover', alvo: _secEscNome(x, d0), detalhe: _secBR(x.data) + ' → ' + _secBR(dt) });
  if (ok) _secEscAtualizar();
}
async function sec_escAlterar(id, mudar, acao) {
  const d0 = _secDados(), x0 = d0.escalaSabado.find(e => e.id === id); if (!x0) return;
  const ok = await _secMutar(d => { const x = d.escalaSabado.find(e => e.id === id); if (!x) return false; Object.assign(x, mudar, { editadoPor: usuarioAtual ? usuarioAtual.nome : '', editadoEm: new Date().toISOString() }); },
    { action: acao, alvo: _secEscNome(x0, d0) + ' — ' + _secBR(x0.data), detalhe: mudar.status !== undefined ? (mudar.status || 'sem marcação') : mudar.local });
  if (ok) _secEscAtualizar();
}
function sec_escLocal(id) { const x = _secDados().escalaSabado.find(e => e.id === id); if (x) sec_escAlterar(id, { local: x.local === 'PEF' ? 'CME' : 'PEF' }, 'sec_esc_local'); }
function sec_escPresenca(id) { const x = _secDados().escalaSabado.find(e => e.id === id); if (x) sec_escAlterar(id, { status: x.status === 'presente' ? 'falta' : x.status === 'falta' ? '' : 'presente' }, 'sec_esc_presenca'); }
async function sec_escRemover(id) {
  const d0 = _secDados(), x = d0.escalaSabado.find(e => e.id === id); if (!x) return;
  if (!confirm('Tirar ' + _secEscNome(x, d0) + ' da escala de ' + _secBR(x.data) + '?')) return;
  const ok = await _secMutar(d => { const i = d.escalaSabado.findIndex(e => e.id === id); if (i < 0) return false; _secParaLixeira(d, 'escala', d.escalaSabado[i]); d.escalaSabado.splice(i, 1); },
    { action: 'sec_esc_remover', alvo: _secEscNome(x, d0), detalhe: _secBR(x.data) });
  if (ok) _secEscAtualizar();
}
async function sec_escHorario(v) {
  v = String(v || '').trim().slice(0, 60); if (!v) return;
  if (await _secMutar(d => { d.config = Object.assign({}, d.config, { escalaHorario: v }); }, { action: 'sec_esc_horario', alvo: v })) _secEscAtualizar();
}
function sec_escHorarioEditar() { const v = prompt('Horário do apoio de sábado:', (_secDados().config || {}).escalaHorario || _SEC_ESC_HORARIO); if (v) sec_escHorario(v); }
function sec_escDataExtra(mes) {
  const v = prompt('Data extra em ' + _secEscMesTxt(mes) + ' (dd/mm):', ''); if (!v) return;
  const m = v.match(/^(\d{1,2})\/(\d{1,2})/); if (!m) { _mostrarToast('Use o formato dd/mm.', 'erro'); return; }
  const dt = mes.slice(0, 4) + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  if (dt.slice(0, 7) !== mes || isNaN(new Date(dt + 'T12:00:00'))) { _mostrarToast('A data precisa ser deste mês.', 'erro'); return; }
  _secEscExtra = dt; _secEscPicker = dt; _secEscAtualizar();
}

// ── Preencher automaticamente: cada servidor 1 sábado no mês ──────────────────
function _secEscPlanoAuto(mes, d) {
  const sabs = _secEscSabados(mes), pessoal = _secEscPessoal(d);
  if (!sabs.length || !pessoal.length) return [];
  const ultimo = sid => d.escalaSabado.filter(x => x.servidorId === sid && x.data < mes + '-01').reduce((m, x) => x.data > m ? x.data : m, '');
  // quem está há mais tempo sem sábado vai primeiro (vai para o 1º sábado livre); empate: ordem alfabética
  const fila = pessoal.slice().sort((a, b) => ultimo(a.id).localeCompare(ultimo(b.id)) || a.nome.localeCompare(b.nome));
  const porSab = {}; sabs.forEach(s => porSab[s] = []);
  const plano = [];
  fila.forEach((s, i) => {
    // tenta o sábado com menos gente em que ele NÃO está afastado (começando pelo da vez, para espalhar)
    const ordem = sabs.map((_, k) => sabs[(i + k) % sabs.length]).sort((a, b) => porSab[a].length - porSab[b].length);
    const dt = ordem.find(x => !_secEscAfastadoEm(s.id, x, d));
    if (!dt) return; // afastado o mês todo
    porSab[dt].push(s.id);
    plano.push({ dt, sid: s.id, local: _secEscLocalPadrao(s.id, d, dt) });
  });
  return plano.sort((a, b) => a.dt.localeCompare(b.dt));
}
async function sec_escAutomatico(mes) {
  const d0 = _secDados();
  if (d0.escalaSabado.some(x => x.data.slice(0, 7) === mes)) { _mostrarToast('Este mês já tem escala.', 'erro'); return; }
  const plano = _secEscPlanoAuto(mes, d0);
  if (!plano.length) { _mostrarToast('Não há servidores do expediente disponíveis.', 'erro'); return; }
  const fora = _secEscPessoal(d0).filter(s => !plano.some(p => p.sid === s.id)).map(s => _secEscCurto(s.nome));
  if (!confirm('Montar a escala de ' + _secEscMesTxt(mes) + ': ' + plano.length + ' servidor(es) em ' + _secEscSabados(mes).length + ' sábados (cada um uma vez)?' + (fora.length ? '\n\nFicam de fora (afastados o mês todo): ' + fora.join(', ') : '') + '\n\nDepois é só ajustar arrastando.')) return;
  const agora = new Date().toISOString(), por = usuarioAtual ? usuarioAtual.nome : '';
  const ok = await _secMutar(d => {
    if (d.escalaSabado.some(x => x.data.slice(0, 7) === mes)) return false;
    plano.forEach(p => d.escalaSabado.push({ id: _secId('esc'), data: p.dt, servidorId: p.sid, nome: '', local: p.local, status: '', criadoPor: por, criadoEm: agora }));
  }, { action: 'sec_esc_auto', alvo: _secEscMesTxt(mes), detalhe: plano.length + ' servidor(es)' });
  if (ok) { _mostrarToast('Escala montada. Ajuste arrastando, se precisar.', 'sucesso'); _secEscAtualizar(); }
}
async function sec_escCarregarOutubro() {
  const d0 = _secDados();
  if (d0.escalaSabado.some(x => x.data.slice(0, 7) === '2026-10')) { _mostrarToast('Outubro já tem escala.', 'erro'); return; }
  const linhas = [];
  Object.entries(_SEC_ESC_OUT2026).forEach(([dt, lst]) => lst.forEach(([curto, local]) => { const s = _secEscAcharServidor(curto, d0); linhas.push({ dt, local, sid: s ? s.id : '', nome: s ? '' : curto }); }));
  const semCasar = linhas.filter(l => !l.sid).map(l => l.nome);
  if (!confirm('Carregar a escala de outubro/2026 (' + linhas.length + ' pessoas em 5 sábados)?' + (semCasar.length ? '\n\nNão achei na lista de servidores (entram só com o nome): ' + semCasar.join(', ') : ''))) return;
  const agora = new Date().toISOString(), por = usuarioAtual ? usuarioAtual.nome : '';
  const ok = await _secMutar(d => {
    if (d.escalaSabado.some(x => x.data.slice(0, 7) === '2026-10')) return false;
    linhas.forEach(l => d.escalaSabado.push({ id: _secId('esc'), data: l.dt, servidorId: l.sid, nome: l.nome, local: l.local, status: '', criadoPor: por, criadoEm: agora }));
  }, { action: 'sec_esc_carregar', alvo: 'outubro/2026', detalhe: linhas.length + ' pessoa(s)' });
  if (ok) { _mostrarToast('Escala de outubro carregada.', 'sucesso'); _secEscAtualizar(); }
}

// ── Impressão no formato do papel ─────────────────────────────────────────────
function sec_escImprimir(mes) {
  const d = _secDados(), datas = _secEscDatas(mes, d).filter(dt => d.escalaSabado.some(x => x.data === dt) || new Date(dt + 'T12:00:00').getDay() === 6);
  const horario = (d.config || {}).escalaHorario || _SEC_ESC_HORARIO, afast = _secEscAfastadosMes(mes, d);
  const b = 'border:1px solid #000;padding:6px;font-size:10.5pt;vertical-align:top';
  const nomes = dt => d.escalaSabado.filter(x => x.data === dt).sort((a, c) => a.local.localeCompare(c.local)).map(x => esc(_secEscCurto(_secEscNome(x, d)).toUpperCase()) + ' – ' + esc(x.local)).join('<br>');
  const porTipo = {}; afast.forEach(a => (porTipo[a.tipo] = porTipo[a.tipo] || []).push(a));
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>Escala de apoio - ' + esc(_secEscMesTxt(mes)) + '</title>'
    + '<style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,Helvetica,sans-serif;color:#000}table{border-collapse:collapse;width:100%}@media print{.np{display:none}}</style></head><body>'
    + '<div class="np" style="text-align:right;margin-bottom:8px"><button onclick="print()" style="padding:6px 14px">Imprimir</button></div>'
    + '<table><tr><th colspan="' + datas.length + '" style="' + b + ';background:#ddd;font-size:12pt">ESCALA DE APOIO DO ADMINISTRATIVO<br><span style="font-weight:normal">Horário: ' + esc(horario) + '</span></th></tr>'
    + '<tr>' + datas.map(dt => '<th style="' + b + '">DIA: ' + _secBR(dt) + '</th>').join('') + '</tr>'
    + '<tr>' + datas.map(dt => '<td style="' + b + ';height:90px">' + nomes(dt) + '</td>').join('') + '</tr></table>'
    + (afast.length ? '<div style="margin-top:12px;font-size:10.5pt;line-height:1.5">' + Object.entries(porTipo).map(([t, l]) => '<b><u>' + esc(t.toUpperCase()) + '</u>:</b> ' + l.map(a => 'PP. ' + esc(_secNomeServ(a.servidorId, d)) + ' – ' + _secBR(a.inicio) + ' a ' + _secBR(a.fim || a.inicio)).join('; ') + '.').join('<br>') + '</div>' : '')
    + '<div style="font-size:8pt;color:#555;margin-top:10px">Emitida pelo sistema CME em ' + new Date().toLocaleString('pt-BR') + '.</div></body></html>';
  _entregarDoc(new Blob([html], { type: 'text/html' }), 'Escala de apoio ' + mes + '.html');
}
Object.assign(_SEC_ACOES, { sec_esc_add: 'Escalou no apoio de sábado', sec_esc_remover: 'Tirou da escala de sábado', sec_esc_local: 'Trocou o local na escala', sec_esc_presenca: 'Marcou presença na escala',
  sec_esc_mover: 'Mudou o sábado na escala', sec_esc_horario: 'Alterou o horário da escala', sec_esc_carregar: 'Carregou a escala do mês', sec_esc_auto: 'Montou a escala automaticamente' });
