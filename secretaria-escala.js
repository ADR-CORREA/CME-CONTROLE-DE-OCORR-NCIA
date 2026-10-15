/* ═══════════════════════════ SECRETARIA — ESCALA DE APOIO DO ADMINISTRATIVO (SÁBADOS) ═══════════════════════════
   Sábados das 08h às 12h. É OBRIGAÇÃO do servidor administrativo para ter direito ao adicional noturno —
   NÃO gera dispensa (não mexe na Ficha de Apoio e Dispensas; apoio em evento de folga é outra coisa).
   • Dados: cme_secretaria.escalaSabado = [{ id, data, servidorId | nome, local: CME|PEF, status: ''|presente|falta }]
     e cme_secretaria.config.escalaHorario (padrão "das 08h às 12h").
   • Painel na sub-aba "Escala de Serviço e Apoio" (secretaria-escserv.js), editado NO PRÓPRIO QUADRO: os sábados de cada mês aparecem sozinhos (colunas);
     arraste o nome do expediente para o sábado (ou "+ adicionar"); clique na etiqueta para trocar CME/PEF;
     clique no nome (depois do sábado) para marcar compareceu/faltou; ✕ tira; arraste entre sábados para mudar.
   • Regra (gerência, 14/10/2026): Bruna, Olidete, Francisco e Débora → 1 sábado no mês, na CME; Everton → não tira;
     todos os demais do administrativo → 2 sábados no mês: 1 na CME + 1 na PEF (Penitenciária Feminina).
     O campo "Apoio de sábado" do cadastro do servidor manda mais que essa regra padrão.
   • Montagem AUTOMÁTICA (sem botão, pedido de 14/10): ao abrir o painel, o sistema monta sozinho o mês atual (só os
     sábados que ainda vão acontecer) e o próximo, se estiverem vazios — aplica a regra, pula afastados e espalha pelos
     sábados. Cada mês é montado uma vez só (config.escalaAutoMeses); depois a secretaria ajusta à mão.
   Depende de secretaria*.js. Emojis só por \u{...}. Prefixo _secEsc / sec_esc. */

const _SEC_ESC_LOCAIS = ['CME', 'PEF'];
const _SEC_ESC_HORARIO = 'das 08h às 12h';
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
function _secEscAfastadosMes(mes, d) {
  const ini = mes + '-01', fim = mes + '-31';
  return d.afastamentos.filter(a => a.inicio <= fim && (a.fim || a.inicio) >= ini).sort((a, b) => String(a.inicio).localeCompare(String(b.inicio)));
}
function _secEscAfastadoEm(sid, dt, d) { return d.afastamentos.find(a => a.servidorId === sid && a.inicio <= dt && (a.fim || a.inicio) >= dt) || null; }
// Regra padrão da gerência (vale quando o cadastro do servidor não diz nada em "Apoio de sábado")
const _SEC_ESC_SO_CME = ['BRUNA', 'OLIDETE', 'FRANCISCO', 'DEBORA'];
const _SEC_ESC_NAO_TIRA = ['EVERTON'];
// CME = 1 sábado na CME · ROD = 1 na CME + 1 na PEF · NAO = não tira
function _secEscRegime(s) {
  if (!s) return '';
  if (s.apoioSabado) return s.apoioSabado; // exceção marcada no cadastro (o antigo apoioRegime seguia a regra velha e é ignorado)
  const primeiro = _secEscNorm(s.nome).split(' ')[0];
  if (_SEC_ESC_SO_CME.includes(primeiro)) return 'CME';
  if (_SEC_ESC_NAO_TIRA.includes(primeiro)) return 'NAO';
  return s.equipe === 'EXPEDIENTE' ? 'ROD' : '';
}
function _secEscPrecisa(s) { const r = _secEscRegime(s); return r === 'ROD' ? ['CME', 'PEF'] : r === 'CME' ? ['CME'] : []; }
// quem faz sábado: expediente ativo (e quem tiver "apoio de sábado" marcado no cadastro)
function _secEscPessoal(d) { return d.servidores.filter(s => (s.situacao || 'ativo') === 'ativo' && (s.equipe === 'EXPEDIENTE' || s.apoioSabado)).sort((a, b) => a.nome.localeCompare(b.nome)); }
// local sugerido: o que ainda FALTA para ele no mês (CME + PEF de quem faz os dois); senão CME
function _secEscLocalPadrao(sid, d, dt) {
  const s = _secServ(sid, d), mes = String(dt || '').slice(0, 7);
  const tem = l => d.escalaSabado.some(x => x.servidorId === sid && x.data.slice(0, 7) === mes && x.local === l);
  return _secEscRegime(s) === 'ROD' && tem('CME') && !tem('PEF') ? 'PEF' : 'CME';
}
function _secEscAtualizar() {
  const el = document.getElementById('sec-esc-card'); if (el) el.outerHTML = _secCartaoEscala();
  const sv = document.getElementById('sec-serv-card'); if (sv && typeof _secCartaoServico === 'function') sv.outerHTML = _secCartaoServico(); // escala de serviço acompanha o mês
}

// ── Painel (editado no próprio quadro) ───────────────────────────────────────
function _secCartaoEscala() {
  const d = _secDados(), hoje = _secHoje(), mes = _secEscMesVis || hoje.slice(0, 7);
  const datas = _secEscDatas(mes, d), prox = datas.find(x => x >= hoje), horario = (d.config || {}).escalaHorario || _SEC_ESC_HORARIO;
  const doMes = d.escalaSabado.filter(x => x.data.slice(0, 7) === mes), vazio = !doMes.length;
  const pessoal = _secEscPessoal(d), afast = _secEscAfastadosMes(mes, d);
  const qtd = sid => doMes.filter(x => x.servidorId === sid).length;
  const atual = hoje.slice(0, 7); [atual, _secEscMaisMes(atual, 1), mes].forEach(_secEscAutoAgendar);
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
    return '<div ondragover="event.preventDefault();this.style.background=\'#f5f3ff\'" ondragleave="this.style.background=\'\'" ondrop="sec_escSoltar(event,\'' + dt + '\')" style="flex:1 1 170px;min-width:160px;min-height:150px;border:2px solid ' + destaque + ';border-radius:8px;padding:8px;' + (passou && !ehHoje ? 'background:#f8fafc' : '') + '">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline"><div><div style="font-size:.7rem;font-weight:700;color:#64748b;text-transform:uppercase">' + dia.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') + '</div>'
      + '<div style="font-size:1.4rem;font-weight:700;line-height:1;color:' + (ehHoje || ehProx ? '#6d28d9' : '#0f172a') + '">' + String(dia.getDate()).padStart(2, '0') + '<span style="font-size:.8rem;color:#94a3b8">/' + String(dia.getMonth() + 1).padStart(2, '0') + '</span></div></div>'
      + '<div style="text-align:right;font-size:.68rem;font-weight:700;color:' + (ehHoje || ehProx ? '#6d28d9' : '#94a3b8') + '">' + (ehHoje ? 'HOJE' : ehProx ? 'PRÓXIMO' : passou ? 'REALIZADO' : '') + '<div style="font-weight:400;color:#94a3b8">' + lst.length + ' pessoa(s)</div></div></div>'
      + lst.map(chip).join('') + picker + '</div>';
  };

  const lateral = '<div style="margin-top:12px;border:1px solid #e2e8f0;border-radius:8px;padding:10px;background:#fcfcfd">'
    + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:8px"><div style="font-weight:700;font-size:.9rem">\u{1F465} Expediente <span style="font-weight:400;font-size:.78rem;color:#64748b">— arraste o nome para um sábado</span></div>'
    + '<div style="font-size:.74rem;color:#64748b">Regra: <b>1 CME + 1 PEF</b> por mês · Bruna, Olidete, Francisco e Débora: <b>só CME</b> · Everton: <b>não tira</b></div></div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px">' + pessoal.map(s => {
      const af = afast.find(a => a.servidorId === s.id), reg = _secEscRegime(s), precisa = _secEscPrecisa(s);
      const tem = l => doMes.some(x => x.servidorId === s.id && x.local === l);
      const falta = precisa.filter(l => !tem(l));
      const status = reg === 'NAO' ? '<span style="color:#94a3b8">não tira</span>'
        : precisa.map(l => '<span style="color:' + (tem(l) ? '#15803d' : '#b45309') + '">' + l + (tem(l) ? ' \u{2714}' : ' falta') + '</span>').join(' · ');
      return '<div draggable="true" ondragstart="sec_escArrastar(event,\'serv\',\'' + s.id + '\')" title="' + esc(s.nome) + ' — ' + esc(_SEC_APOIO_REGIME[reg] || 'sem regra') + (af ? ' · ' + esc(af.tipo) : '') + '" style="padding:6px 8px;border-radius:6px;min-width:0;overflow:hidden;cursor:grab;background:' + (falta.length && !af && reg !== 'NAO' ? '#fffbeb' : '#fff') + ';border:1px solid #e2e8f0' + (af || reg === 'NAO' ? ';opacity:.55' : '') + '">'
        + '<div style="font-size:.84rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(_secEscCurto(s.nome)) + '</div>'
        + '<div style="font-size:.7rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (af ? '<span style="color:#64748b">' + esc(af.tipo.toLowerCase()) + ' · </span>' : '') + status + '</div></div>';
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
    + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
    + bt('\u{1F5A8}\u{FE0F} Imprimir', 'sec_escImprimir(\'' + mes + '\')') + '</div></div>'
    + (vazio ? '<div style="font-size:.85rem;color:#475569;background:#f8fafc;border-radius:6px;padding:8px 12px;margin-bottom:10px">' + (mes < atual ? 'Sem escala registrada em ' + esc(_secEscMesTxt(mes)) + '.' : 'Montando a escala de ' + esc(_secEscMesTxt(mes)) + ' pela regra… se não aparecer, arraste os nomes do expediente para os sábados.') + '</div>' : '')
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:stretch">' + datas.map(coluna).join('')
    + '<div onclick="sec_escDataExtra(\'' + mes + '\')" title="Incluir um dia que não é sábado (feriado, mutirão…)" style="flex:0 0 46px;border:1px dashed #cbd5e1;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#94a3b8;cursor:pointer;font-size:1.2rem;min-height:80px">+</div></div>'
    + lateral
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
function sec_escLocal(id) { const x = _secDados().escalaSabado.find(e => e.id === id); if (x) return sec_escAlterar(id, { local: x.local === 'PEF' ? 'CME' : 'PEF' }, 'sec_esc_local'); }
function sec_escPresenca(id) { const x = _secDados().escalaSabado.find(e => e.id === id); if (x) return sec_escAlterar(id, { status: x.status === 'presente' ? 'falta' : x.status === 'falta' ? '' : 'presente' }, 'sec_esc_presenca'); }
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

// ── Montagem automática pela regra (só sábados de hoje em diante) ─────────────
function _secEscPlanoAuto(mes, d) {
  const hoje = _secHoje(), sabs = _secEscSabados(mes).filter(s => s >= hoje), pessoal = _secEscPessoal(d).filter(s => _secEscPrecisa(s).length);
  if (!sabs.length || !pessoal.length) return [];
  const ultimo = sid => d.escalaSabado.filter(x => x.servidorId === sid && x.data < mes + '-01').reduce((m, x) => x.data > m ? x.data : m, '');
  // quem está há mais tempo sem sábado escolhe primeiro; empate: ordem alfabética
  const fila = pessoal.slice().sort((a, b) => ultimo(a.id).localeCompare(ultimo(b.id)) || a.nome.localeCompare(b.nome));
  const cont = {}; sabs.forEach(s => cont[s] = { CME: 0, PEF: 0, tot: 0, pessoas: new Set() });
  const plano = [];
  // PEF primeiro (vaga mais disputada), depois CME; cada vaga vai para o sábado com menos gente daquele local
  ['PEF', 'CME'].forEach(local => fila.forEach((s, i) => {
    if (!_secEscPrecisa(s).includes(local)) return;
    const ordem = sabs.map((_, k) => sabs[(i + k) % sabs.length])
      .filter(dt => !cont[dt].pessoas.has(s.id) && !_secEscAfastadoEm(s.id, dt, d))
      .sort((a, b) => cont[a][local] - cont[b][local] || cont[a].tot - cont[b].tot);
    const dt = ordem[0]; if (!dt) return; // afastado em todos os sábados possíveis
    cont[dt][local]++; cont[dt].tot++; cont[dt].pessoas.add(s.id);
    plano.push({ dt, sid: s.id, local });
  }));
  return plano.sort((a, b) => a.dt.localeCompare(b.dt) || a.local.localeCompare(b.local));
}
// meses já tentados nesta sessão (evita repetir a gravação ou o aviso de erro a cada redesenho)
const _secEscAutoTentado = new Set();
function _secEscAutoAgendar(mes) {
  const d = _secDados();
  if (!mes || mes < _secHoje().slice(0, 7) || _secEscAutoTentado.has(mes) || !d.servidores.length) return; // passado ou dados ainda não carregados
  if (d.escalaSabado.some(x => x.data.slice(0, 7) === mes) || ((d.config || {}).escalaAutoMeses || []).includes(mes)) return;
  _secEscAutoTentado.add(mes);
  setTimeout(() => _secEscAutoGerar(mes), 0);
}
async function _secEscAutoGerar(mes) {
  let n = 0;
  const ok = await _secMutar(d => {
    const feitos = Array.isArray(d.config.escalaAutoMeses) ? d.config.escalaAutoMeses : [];
    // relê o banco: se alguém já montou (ou já foi montado e esvaziado de propósito), não mexe
    if (feitos.includes(mes) || d.escalaSabado.some(x => x.data.slice(0, 7) === mes)) return false;
    const plano = _secEscPlanoAuto(mes, d); if (!plano.length) return false;
    const agora = new Date().toISOString();
    plano.forEach(p => d.escalaSabado.push({ id: _secId('esc'), data: p.dt, servidorId: p.sid, nome: '', local: p.local, status: '', criadoPor: 'Automático (regra da gerência)', criadoEm: agora }));
    d.config = Object.assign({}, d.config, { escalaAutoMeses: feitos.concat(mes) });
    n = plano.length;
  }, { action: 'sec_esc_auto', alvo: _secEscMesTxt(mes), detalhe: 'montada automaticamente pela regra' });
  _secEscAtualizar();
  return ok ? n : 0;
}

// ── Impressão no formato do papel ─────────────────────────────────────────────
// "Macapá-AP, 14 de Outubro de 2026." — o documento sai com a data do dia em que é gerado (pedido de 14/10/2026)
function _secDataEmissao() {
  const MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const e = new Date(_secHoje() + 'T12:00:00');
  return 'Macapá-AP, ' + e.getDate() + ' de ' + MES[e.getMonth()] + ' de ' + e.getFullYear() + '.';
}
// nome como no papel: dois primeiros nomes, pulando "de/da/dos" ("BRUNA MARIA", "PATRÍCIA CARNEIRO")
function _secEscNomePapel(nome) {
  const p = String(nome || '').toUpperCase().split(' ').filter(Boolean), lig = ['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'];
  const seg = p.slice(1).find(x => !lig.includes(x));
  return p.length ? p[0] + (seg ? ' ' + seg : '') : '';
}
// Impressão no formato oficial "ESCALA DE APOIO DO ADMINISTRATIVO DA CME" (A4 deitado): cabeçalho IAPEN / Polícia Penal / CME,
// uma linha por servidor escalado e uma coluna por sábado, OBS de férias e licenças do administrativo, assinatura e rodapé.
function sec_escImprimir(mes) {
  const d = _secDados(), cfg = d.config || {};
  const MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  const mesNum = +mes.slice(5, 7), ano = mes.slice(0, 4), mesAno = MESES[mesNum - 1] + '/' + ano;
  const datas = _secEscDatas(mes, d).filter(dt => d.escalaSabado.some(x => x.data === dt) || new Date(dt + 'T12:00:00').getDay() === 6);
  const horario = String(cfg.escalaHorario || _SEC_ESC_HORARIO).replace(/0(\d)h/g, '$1h');
  const lin = d.escalaSabado.filter(x => x.data.slice(0, 7) === mes)
    .sort((a, b) => a.data.localeCompare(b.data) || a.local.localeCompare(b.local) || _secEscNome(a, d).localeCompare(_secEscNome(b, d)));
  const img = (b64, tipo, alt) => b64 ? '<img src="data:' + tipo + ';base64,' + b64 + '" alt="' + alt + '" style="height:76px;width:auto">' : '';
  const cinza = 'background:#d9d9d9', bd = 'border:1px solid #000';
  // OBS: só férias/licenças de quem é do administrativo (expediente)
  const doAdm = a => { const s = _secServ(a.servidorId, d); return s && (s.equipe === 'EXPEDIENTE' || s.apoioSabado); };
  const afast = _secEscAfastadosMes(mes, d).filter(doAdm);
  const setorDe = sid => { const s = _secServ(sid, d); return s && s.setor && !['Expediente', 'Plantão'].includes(s.setor) ? s.setor : ''; };
  const pessoa = a => '<b>' + esc(_secServNomePapelCurto(_secNomeServ(a.servidorId, d))) + '</b>' + (setorDe(a.servidorId) ? '(' + esc(setorDe(a.servidorId)) + ')' : '') + ' - ' + _secBR(a.inicio) + ' a ' + _secBR(a.fim || a.inicio);
  const grupo = tipos => { const g = {}; tipos.forEach(a => (g[a.tipo] = g[a.tipo] || []).push(a)); return Object.entries(g).map(([t, l]) => '<b>' + esc(_secEscSiglaTipo(t)) + ':</b> ' + l.map(pessoa).join('; ') + '.').join('<br><br>'); };
  const ferias = afast.filter(a => /^f[ée]rias/i.test(a.tipo)), outros = afast.filter(a => !/^f[ée]rias/i.test(a.tipo));
  const diasTxt = datas.map(dt => dt.slice(8)).join(', ') + '/' + mes.slice(5, 7) + '/' + ano + '– ' + horario;
  const n = datas.length;
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="color-scheme" content="light"><title>Escala de Apoio - ' + mesAno + '</title>'
    + '<style>html,body{background:#fff}@page{size:A4 landscape;margin:6mm 8mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0;font-size:10pt}'
    + 'table{border-collapse:collapse;width:100%}td,th{' + bd + ';padding:2px 8px}@media screen{body{padding:10px 16px}}@media print{.np{display:none}}'
    + '</style></head><body' + (lin.length > 16 ? ' style="zoom:' + Math.max(0.55, 26 / (lin.length + 8)).toFixed(2) + '"' : '') + '>' // muitas linhas: reduz tudo para caber em 1 folha
    + '<div class="np" style="text-align:right;margin-bottom:6px"><button onclick="print()" style="padding:6px 16px;font-size:11pt;cursor:pointer">Imprimir</button></div>'
    + '<div style="display:flex;align-items:center;gap:8px;border-bottom:1.5px solid #000;padding-bottom:4px">'
    + img(window._IAPEN_LOGO_B64, 'image/png', 'IAPEN') + img(window._PPENAL_LOGO_B64, 'image/jpeg', 'Polícia Penal')
    + '<div style="flex:1;text-align:center;font-weight:bold;font-size:9.5pt;line-height:1.9">GOVERNO DO ESTADO DO AMAPÁ<br>SECRETARIA DE ESTADO DE JUSTIÇA E SEGURANÇA PÚBLICA - SEJUSP<br>INSTITUTO DE ADMINISTRAÇÃO PENITENCIÁRIA DO AMAPÁ - IAPEN</div>'
    + img(window._CME_LOGO_B64, 'image/png', 'CME') + '</div>'
    + '<table style="width:88%;margin:10px auto 0">'
    + '<tr><th colspan="' + (n + 1) + '" style="font-size:16pt;padding:6px">ESCALA DE APOIO DO ADMINISTRATIVO DA CME - ' + mesAno + '</th></tr>'
    + '<tr><th colspan="' + (n + 1) + '" style="' + cinza + ';font-size:10pt;padding:6px">ADMINISTRATIVO DA CENTRAL DE MONITORAÇÃO ELETRÔNICA DO IAPEN</th></tr>'
    + '<tr><th style="' + cinza + ';width:26%;padding:12px 8px;font-size:9.5pt">SERVIDORES:</th><th colspan="' + n + '" style="font-size:9pt">DIAS E HORÁRIOS: ' + esc(diasTxt) + '</th></tr>'
    + (lin.length ? lin.map(x => '<tr><td style="' + cinza + ';font-size:9.5pt">' + esc(_secEscNomePapel(_secEscNome(x, d))) + ' – ' + esc(x.local) + '</td>'
        + datas.map(dt => '<td style="font-weight:bold;font-size:10pt;text-align:center;width:' + (74 / Math.max(n, 1)).toFixed(1) + '%">' + (x.data === dt ? _secBR(dt) : '') + '</td>').join('') + '</tr>').join('')
      : '<tr><td style="' + cinza + '">&nbsp;</td>' + datas.map(() => '<td></td>').join('') + '</tr>')
    + '<tr><td colspan="' + Math.max(1, Math.ceil((n + 1) / 2)) + '" style="' + cinza + ';font-size:8.5pt;text-align:justify;vertical-align:top;height:64px">' + (ferias.length ? '<b>OBS:</b>' + grupo(ferias) : '<b>OBS:</b>') + '</td>'
    + '<td colspan="' + Math.max(1, n + 1 - Math.ceil((n + 1) / 2)) + '" style="' + cinza + ';font-size:8pt;vertical-align:top">' + grupo(outros) + '</td></tr>'
    + '</table>'
    + '<div style="text-align:right;margin-top:26px;font-size:10pt">' + _secDataEmissao() + '</div>'
    + '<div style="text-align:center;font-size:9.5pt;line-height:1.3"><b>' + esc(_secGerente(d).toUpperCase()) + '</b><br>Gerente da Central de Monitoramento Eletrônico<br>' + esc(cfg.gerenteDecreto || 'Decreto nº 5953/2025 – GEA') + '</div>'
    + '<div style="border-top:1.5px solid #000;margin-top:4px;padding-top:6px;text-align:center;font-size:8.5pt;line-height:1.6"><b>CENTRAL DE MONITORAMENTO ELETRÔNICO – CME -</b> Av. Machado de Assis, 372 – Centro - CEP: 68900-066, Macapá-AP.<br>Email: cme@iapen.ap.gov.br - Telefone (96) 98415 2844</div>'
    + '</body></html>';
  _entregarDoc(new Blob([html], { type: 'text/html' }), 'Escala de apoio ' + mes + '.html');
}
// "DIANE BRITO", "ADRIANE BASTOS": primeiro + último nome, em maiúsculas
function _secServNomePapelCurto(nome) { const p = String(nome || '').toUpperCase().split(' ').filter(Boolean); return p.length > 2 ? p[0] + ' ' + p[p.length - 1] : p.join(' '); }
// tipo do afastamento como no papel: "FÉRIAS", "L.MATERNIDADE", "L.PRÊMIO"…
function _secEscSiglaTipo(t) { const u = String(t || '').toUpperCase(); return /^LICEN[ÇC]A[- ]/.test(u) ? 'L.' + u.replace(/^LICEN[ÇC]A[- ]+/, '').replace(/^PARA /, '') : u; }
Object.assign(_SEC_ACOES, { sec_esc_add: 'Escalou no apoio de sábado', sec_esc_remover: 'Tirou da escala de sábado', sec_esc_local: 'Trocou o local na escala', sec_esc_presenca: 'Marcou presença na escala',
  sec_esc_mover: 'Mudou o sábado na escala', sec_esc_horario: 'Alterou o horário da escala', sec_esc_carregar: 'Carregou a escala do mês', sec_esc_auto: 'Montou a escala automaticamente' });
