/* ═══════════════════════════ SECRETARIA — ESCALA DE SERVIÇO E APOIO ═══════════════════════════
   Sub-aba própria (pedido de 14/10/2026), separada de "Apoios e Dispensas" — são coisas diferentes:
   • em cima: a escala de apoio do administrativo aos sábados (secretaria-escala.js, _secCartaoEscala);
   • embaixo: a escala de serviço do mês, igual ao papel "ESCALA DE SERVIÇO (24x96)":
     guarnições ALFA–ECHO com os dias de plantão do mês e o posto de cada um, e o setor administrativo
     com o turno (M/T). Férias e licenças vêm da aba Férias e Licenças.
   • Atualiza sozinha: o mês atual e os seguintes saem do CADASTRO dos servidores (equipe, posto, setor, turno) e os
     dias de plantão são calculados. O mês atual é guardado em cme_secretaria.escalaServico[mes] (refeito sempre que
     muda), então quando o mês acaba ele fica no histórico do jeito que foi — mudar o cadastro depois não mexe nele.
   • Edição no próprio quadro: arrastar o nome para outra guarnição ou setor, clicar no "Posto" ou no "(M)/(T)" para
     trocar, clicar no nome para abrir o cadastro. No mês atual/futuro a mudança vai para o CADASTRO; num mês que já
     passou, muda só o registro daquele mês.
   • Imprimir: formato do papel (A4 deitado) com o cabeçalho do IAPEN/CME, a escala de apoio, as observações de férias
     e licenças e a assinatura do gerente.
   Depende de secretaria*.js e de getPlantaoParaData (index.html). Emojis só por \u{...}. Prefixo _secServ / sec_serv. */

const _PL_EQUIPES_SEC = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO'];
const _SEC_SERV_SEM_SETOR = 'Sem setor definido';
const _SEC_SERV_DECRETO = 'Decreto nº 5953/2025 – GEA';

function sec_renderEscalas() {
  const c = document.getElementById('sec-conteudo'); if (!c) return;
  _secServGuardarAuto();
  c.innerHTML = _secCartaoEscala() + _secCartaoServico();
}

// ── Funções de apoio ──────────────────────────────────────────────────────────
function _secServAtual() { return _secHoje().slice(0, 7); }
function _secServFimMes(mes) { return mes + '-' + String(new Date(+mes.slice(0, 4), +mes.slice(5, 7), 0).getDate()); }
// dias do mês em que cada guarnição está de plantão (troca às 08h; o dia é o do início do plantão)
function _secServDiasGuarnicao(mes) {
  const ult = +_secServFimMes(mes).slice(8), dias = {};
  for (let i = 1; i <= ult; i++) {
    const dt = mes + '-' + String(i).padStart(2, '0'), g = getPlantaoParaData(dt);
    (dias[g] = dias[g] || []).push(String(i).padStart(2, '0'));
  }
  return dias;
}
// escala tirada do cadastro: { id: { nome, equipe, posto, setor, turno } }
function _secServDoCadastro(d) {
  const linhas = {};
  d.servidores.filter(s => (s.situacao || 'ativo') === 'ativo' && (_PL_EQUIPES_SEC.includes(s.equipe) || s.equipe === 'EXPEDIENTE'))
    .forEach(s => { linhas[s.id] = { nome: s.nome, equipe: s.equipe, posto: s.posto || '', setor: s.setor || '', turno: s.turno || '' }; });
  return linhas;
}
// a escala do mês: mês passado = o que foi guardado; mês atual/futuro = o cadastro de agora
function _secServLinhas(mes, d) {
  const g = (d.escalaServico || {})[mes];
  return mes < _secServAtual() && g && g.linhas ? g.linhas : _secServDoCadastro(d);
}
function _secServSetor(l) { return l.setor && !['Expediente', 'Plantão'].includes(l.setor) ? l.setor : _SEC_SERV_SEM_SETOR; }
function _secServOrdemSetor(k) { return /^ger[eê]ncia/i.test(k) ? '0' + k : k === _SEC_SERV_SEM_SETOR ? '2' : '1' + k; }
function _secServAfastNoMes(sid, mes, d) { const ini = mes + '-01', fim = _secServFimMes(mes); return d.afastamentos.find(a => a.servidorId === sid && a.inicio <= fim && (a.fim || a.inicio) >= ini) || null; }
// afastado na maior parte do mês (20 dias ou mais) vai para a faixa de baixo, como "FÉRIAS: PP. Fulano" no papel
function _secServForaMes(a, mes) {
  if (!a) return false;
  const ini = mes + '-01', fim = _secServFimMes(mes), de = a.inicio > ini ? a.inicio : ini, ate = (a.fim || a.inicio) < fim ? (a.fim || a.inicio) : fim;
  return Math.round((new Date(ate + 'T12:00:00') - new Date(de + 'T12:00:00')) / 864e5) + 1 >= 20;
}

// ── Guardar o mês atual no histórico (sozinho) ────────────────────────────────
let _secServGuardando = false;
function _secServGuardarAuto() {
  const d = _secDados(), mes = _secServAtual();
  if (_secServGuardando || !d.servidores.length) return;
  const g = (d.escalaServico || {})[mes], atual = _secServDoCadastro(d);
  if (g && JSON.stringify(g.linhas) === JSON.stringify(atual)) return; // nada mudou
  _secServGuardando = true;
  _secMutar(x => {
    const linhas = _secServDoCadastro(x), ant = x.escalaServico[mes];
    if (ant && JSON.stringify(ant.linhas) === JSON.stringify(linhas)) return false;
    x.escalaServico = Object.assign({}, x.escalaServico, { [mes]: { linhas, guardadoEm: new Date().toISOString() } });
  }).finally(() => { _secServGuardando = false; });
}

// ── Painel ────────────────────────────────────────────────────────────────────
function _secCartaoServico() {
  const d = _secDados(), hoje = _secHoje(), mes = _secEscMesVis || hoje.slice(0, 7), passado = mes < _secServAtual();
  const linhas = _secServLinhas(mes, d), ids = Object.keys(linhas);
  const dias = _secServDiasGuarnicao(mes), deHoje = mes === _secServAtual() ? _secPlantaoAgora().guarnicao : '';
  const corPosto = { '1': '#dc2626', '2': '#2563eb' }, corTurno = { M: '#b45309', T: '#7c3aed' };
  const guardado = (d.escalaServico || {})[mes];
  const solta = alvo => ' ondragover="event.preventDefault();this.style.outline=\'2px dashed #0d9488\'" ondragleave="this.style.outline=\'\'" ondrop="sec_servSoltar(event,\'' + mes + '\',\'' + alvo + '\')"';

  // fundo suave por posto (plantão) ou turno (expediente) + barrinha à esquerda, para ler de relance sem chamar atenção
  const TOM = { P1: ['#fff', '#f1d4d4', '#dc2626'], P2: ['#fff', '#cfdcf5', '#2563eb'], M: ['#fff', '#ecdcb6', '#b45309'], T: ['#fff', '#ddd3f5', '#7c3aed'], X: ['#fff', '#e2e8f0', '#cbd5e1'] };
  // cada guarnição e cada setor com um fundo próprio, suave (nome em cartão branco por cima, para ler fácil)
  const CAIXA = [['#eaf2ff', '#c3d6f7'], ['#eaf8ef', '#bfe3cc'], ['#fdf4e3', '#efd9a9'], ['#f3eefe', '#d6c9f6'], ['#e8f7f5', '#b9e2dc'], ['#fdeef2', '#f2c9d4'], ['#eef1f6', '#cfd6e2']];
  const CAIXA_G = { ALFA: CAIXA[0], BRAVO: CAIXA[1], CHARLIE: CAIXA[2], DELTA: CAIXA[3], ECHO: CAIXA[4] };
  const tomDe = l => TOM[l.equipe === 'EXPEDIENTE' ? (l.turno || 'X') : (l.posto ? 'P' + l.posto : 'X')] || TOM.X;
  const chip = (sid, etiqueta) => {
    const l = linhas[sid], af = _secServAfastNoMes(sid, mes, d), [fundo, borda, barra] = tomDe(l);
    return '<div draggable="true" ondragstart="event.dataTransfer.setData(\'text/plain\',\'escserv:' + sid + '\')" onclick="sec_editarServidor(\'' + sid + '\')" title="' + esc(l.nome) + ' — arraste para mudar de guarnição/setor · clique para abrir o cadastro' + (af ? ' · ' + esc(af.tipo) + ' ' + _secBRc(af.inicio) + ' a ' + _secBRc(af.fim || af.inicio) : '') + '" style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:5px 8px;border:1px solid ' + borda + ';border-left:3px solid ' + barra + ';border-radius:6px;background:' + fundo + ';cursor:grab">'
      + '<div style="min-width:0"><div style="font-size:.84rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(_secEscCurto(l.nome)) + '</div>'
      + (af ? '<div style="font-size:.68rem;font-weight:600;color:' + _secCorTipo(af.tipo) + '">' + esc(af.tipo.toLowerCase()) + ' ' + _secBRc(af.inicio) + '–' + _secBRc(af.fim || af.inicio) + '</div>' : '') + '</div>'
      + (etiqueta || '') + '</div>';
  };
  const etqPosto = sid => { const p = linhas[sid].posto; return '<span onclick="event.stopPropagation();sec_servPosto(\'' + mes + '\',\'' + sid + '\')" title="Clique para trocar o posto" style="font-size:.68rem;font-weight:700;white-space:nowrap;cursor:pointer;padding:1px 4px;border-radius:3px;color:' + (corPosto[p] || '#94a3b8') + '">' + (p ? 'Posto ' + esc(p) : 'sem posto') + '</span>'; };
  const etqTurno = sid => { const t = linhas[sid].turno; return '<span onclick="event.stopPropagation();sec_servTurno(\'' + mes + '\',\'' + sid + '\')" title="' + (t ? esc(_SEC_TURNOS[t] || t) + ' — ' : '') + 'clique para trocar o turno" style="font-size:.7rem;font-weight:700;cursor:pointer;padding:1px 4px;border-radius:3px;color:' + (corTurno[t] || '#94a3b8') + '">' + (t ? '(' + esc(t) + ')' : '(—)') + '</span>'; };

  // ── Plantão 24x96 ──
  const guarnicao = g => {
    const membros = ids.filter(id => linhas[id].equipe === g);
    const fora = membros.filter(id => _secServForaMes(_secServAfastNoMes(id, mes, d), mes));
    const lista = membros.filter(id => !fora.includes(id)).sort((a, b) => String(linhas[a].posto || '9').localeCompare(String(linhas[b].posto || '9')) || linhas[a].nome.localeCompare(linhas[b].nome));
    const atual = g === deHoje;
    return '<div' + solta('G:' + g) + ' style="flex:1 1 190px;min-width:180px;border:2px solid ' + (atual ? '#0d9488' : CAIXA_G[g][1]) + ';border-radius:8px;padding:8px;background:' + CAIXA_G[g][0] + '">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px"><div style="font-weight:700;font-size:.9rem">Guarnição ' + g + '</div>'
      + (atual ? '<div style="font-size:.66rem;font-weight:700;color:#0d9488">DE PLANTÃO</div>' : '') + '</div>'
      + '<div style="font-size:.72rem;color:#475569;font-family:var(--font-mono);margin:2px 0 8px">Dias: ' + (dias[g] || []).join(', ') + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:4px">' + (lista.length ? lista.map(id => chip(id, etqPosto(id))).join('') : '<div style="font-size:.8rem;color:#94a3b8">Arraste um nome para cá.</div>') + '</div>'
      + (fora.length ? '<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #cbd5e1;display:flex;flex-direction:column;gap:4px">' + fora.map(id => '<div style="opacity:.6">' + chip(id, etqPosto(id)) + '</div>').join('') + '</div>' : '')
      + '</div>';
  };

  // ── Setor administrativo (expediente) ──
  const setores = {}; ids.filter(id => linhas[id].equipe === 'EXPEDIENTE').forEach(id => { const k = _secServSetor(linhas[id]); (setores[k] = setores[k] || []).push(id); });
  const setorCard = (k, i) => '<div' + solta('S:' + k) + ' style="border:1px solid ' + CAIXA[i % CAIXA.length][1] + ';border-radius:8px;padding:8px;background:' + CAIXA[i % CAIXA.length][0] + '">'
    + '<div style="font-weight:700;font-size:.82rem;margin-bottom:6px">' + esc(k) + ' <span style="font-weight:400;color:#94a3b8">(' + setores[k].length + ')</span></div>'
    + '<div style="display:flex;flex-direction:column;gap:4px">' + setores[k].sort((a, b) => String(linhas[a].turno || 'Z').localeCompare(String(linhas[b].turno || 'Z')) || linhas[a].nome.localeCompare(linhas[b].nome))
      .map(id => chip(id, etqTurno(id))).join('') + '</div></div>';
  const novoSetor = '<div' + solta('S:+') + ' style="border:1px dashed #cbd5e1;border-radius:8px;padding:8px;display:flex;align-items:center;justify-content:center;text-align:center;color:#94a3b8;font-size:.8rem;min-height:70px">+ arraste um nome aqui para criar um setor novo</div>';

  const aviso = passado
    ? 'Mês encerrado — ' + (guardado ? 'escala guardada como estava em ' + _secBR(guardado.guardadoEm) + '. Mudanças aqui valem só para este mês.' : 'não havia registro guardado; mostrando o cadastro atual.')
    : 'Atualiza sozinha pelo cadastro · arraste o nome para mudar de guarnição ou setor · clique no Posto ou no turno para trocar · clique no nome para abrir o cadastro';
  return '<div id="sec-serv-card" style="background:#fff;border:1px solid #e2e8f0;border-left:4px solid #0d9488;border-radius:6px;padding:12px 14px;margin-top:12px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
    + '<div><div style="font-weight:700;font-size:1.05rem">\u{1F6E1}\u{FE0F} Escala de serviço (24x96) — Plantão da CME</div>'
    + '<div style="font-size:.78rem;color:' + (passado ? '#b45309' : '#64748b') + '">' + aviso + '</div></div>'
    + '<div style="display:flex;align-items:center;gap:10px"><div style="font-weight:700;text-transform:capitalize">' + esc(_secEscMesTxt(mes)) + '</div>'
    + '<button type="button" onclick="sec_servImprimir(\'' + mes + '\')" style="padding:5px 12px;border-radius:6px;cursor:pointer;font-size:.82rem;font-weight:600;border:1px solid #0d9488;background:#0d9488;color:#fff">\u{1F5A8}\u{FE0F} Imprimir escala do mês</button></div></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:stretch">' + _PL_EQUIPES_SEC.map(guarnicao).join('') + '</div>'
    + '<div style="font-size:.74rem;color:#475569;margin-top:6px"><b style="color:#dc2626">Posto 1</b> — instalação, inspeção, criação de zona · <b style="color:#2563eb">Posto 2</b> — tratamento de ocorrência, mudança de endereço, alimentação do drive, livro</div>'
    + '<div style="margin-top:14px;font-weight:700;font-size:.95rem">\u{1F3E2} Setor administrativo <span style="font-weight:400;font-size:.78rem;color:#64748b">— Manhã (M) · Tarde (T)</span></div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-top:6px">'
    + Object.keys(setores).sort((a, b) => _secServOrdemSetor(a).localeCompare(_secServOrdemSetor(b))).map(setorCard).join('') + novoSetor
    + '</div></div>';
}

// ── Edição ────────────────────────────────────────────────────────────────────
// mês atual/futuro → muda o cadastro do servidor (e o registro do mês atual); mês passado → só o registro daquele mês
async function _secServAplicar(mes, sid, patch, audit) {
  const passado = mes < _secServAtual(), agora = new Date().toISOString(), por = usuarioAtual ? usuarioAtual.nome : '';
  const ok = await _secMutar(d => {
    if (passado) {
      const g = d.escalaServico[mes] || { linhas: _secServLinhas(mes, d) };
      if (!g.linhas[sid]) return false;
      d.escalaServico = Object.assign({}, d.escalaServico, { [mes]: { linhas: Object.assign({}, g.linhas, { [sid]: Object.assign({}, g.linhas[sid], patch) }), guardadoEm: g.guardadoEm || agora, editadoEm: agora, editadoPor: por } });
      return;
    }
    const s = d.servidores.find(x => x.id === sid); if (!s) return false;
    Object.assign(s, patch, { atualizadoEm: agora, atualizadoPor: por });
    if (patch.equipe) s.equipeFixa = true; // guarnição definida pela gerência: a folha de ponto não muda mais
    const atual = _secServAtual();
    d.escalaServico = Object.assign({}, d.escalaServico, { [atual]: { linhas: _secServDoCadastro(d), guardadoEm: agora } });
  }, Object.assign({ alvo: (linhas => linhas && linhas.nome)(_secServLinhas(mes, _secDados())[sid]) || sid }, audit));
  if (ok) _secEscAtualizar();
  return ok;
}
async function sec_servSoltar(ev, mes, alvo) {
  ev.preventDefault(); if (ev.currentTarget) ev.currentTarget.style.outline = '';
  const txt = ev.dataTransfer.getData('text/plain') || '', sid = txt.startsWith('escserv:') ? txt.slice(8) : '';
  const l = _secServLinhas(mes, _secDados())[sid]; if (!l) return;
  if (alvo.startsWith('G:')) {
    const g = alvo.slice(2); if (l.equipe === g) return;
    return _secServAplicar(mes, sid, { equipe: g, setor: 'Plantão', turno: '' }, { action: 'sec_serv_mover', detalhe: (l.equipe === 'EXPEDIENTE' ? _secServSetor(l) : l.equipe) + ' → ' + g + ' (' + _secEscMesTxt(mes) + ')' });
  }
  let setor = alvo.slice(2);
  if (setor === '+') { setor = String(prompt('Nome do setor novo (ex.: Jurídico, Secretaria):') || '').trim(); if (!setor) return; }
  if (setor === _SEC_SERV_SEM_SETOR) setor = '';
  if (l.equipe === 'EXPEDIENTE' && (l.setor || '') === setor) return;
  return _secServAplicar(mes, sid, { equipe: 'EXPEDIENTE', setor, posto: '' }, { action: 'sec_serv_mover', detalhe: (l.equipe === 'EXPEDIENTE' ? _secServSetor(l) : l.equipe) + ' → ' + (setor || _SEC_SERV_SEM_SETOR) + ' (' + _secEscMesTxt(mes) + ')' });
}
function sec_servPosto(mes, sid) {
  const l = _secServLinhas(mes, _secDados())[sid]; if (!l) return;
  const novo = l.posto === '1' ? '2' : '1';
  return _secServAplicar(mes, sid, { posto: novo }, { action: 'sec_serv_posto', detalhe: 'Posto ' + (l.posto || '—') + ' → ' + novo });
}
function sec_servTurno(mes, sid) {
  const l = _secServLinhas(mes, _secDados())[sid]; if (!l) return;
  const novo = l.turno === 'M' ? 'T' : 'M';
  return _secServAplicar(mes, sid, { turno: novo }, { action: 'sec_serv_turno', detalhe: (l.turno || '—') + ' → ' + novo });
}

// ── Impressão no formato do papel (A4 deitado, cabeçalho IAPEN/CME, assinatura do gerente) ──
function _secServNomePapel(nome) { const p = String(nome || '').split(' ').filter(Boolean); return (p.length > 2 ? p[0] + ' ' + p[p.length - 1] : p.join(' ')).toUpperCase(); }
function sec_servImprimir(mes) {
  const d = _secDados(), linhas = _secServLinhas(mes, d), ids = Object.keys(linhas), dias = _secServDiasGuarnicao(mes);
  const cfg = d.config || {}, MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
  const mesNum = +mes.slice(5, 7), ano = mes.slice(0, 4);
  const iapen = window._IAPEN_LOGO_B64 ? 'data:image/png;base64,' + window._IAPEN_LOGO_B64 : '', cme = window._CME_LOGO_B64 ? 'data:image/png;base64,' + window._CME_LOGO_B64 : '';
  const b = 'border:1px solid #000;padding:3px 5px';
  const posto = p => p ? ' - <span style="color:' + (p === '1' ? '#e00000' : '#1f5fd6') + ';font-weight:bold">Posto 0' + esc(p) + '</span>' : '';
  // guarnições
  const col = _PL_EQUIPES_SEC.map(g => {
    const membros = ids.filter(id => linhas[id].equipe === g);
    const fora = membros.filter(id => _secServForaMes(_secServAfastNoMes(id, mes, d), mes));
    return { g, lista: membros.filter(id => !fora.includes(id)).sort((a, c) => String(linhas[a].posto || '9').localeCompare(String(linhas[c].posto || '9')) || linhas[a].nome.localeCompare(linhas[c].nome)), fora };
  });
  const nLin = Math.max(4, ...col.map(c => c.lista.length));
  let tabG = '<table style="width:100%;border-collapse:collapse;font-size:8.5pt"><tr><th style="' + b + ';background:#e7e7e7;width:34px">Nº</th>'
    + col.map(c => '<th style="' + b + ';background:#e7e7e7">GUARNIÇÃO ' + c.g + '<br>Dias: ' + (dias[c.g] || []).join(', ') + '</th>').join('') + '</tr>';
  for (let i = 0; i < nLin; i++) tabG += '<tr><td style="' + b + ';text-align:center">' + String(i + 1).padStart(2, '0') + '</td>' + col.map(c => { const id = c.lista[i]; return '<td style="' + b + ';text-align:center;font-weight:bold">' + (id ? 'PP. ' + esc(_secServNomePapel(linhas[id].nome)) + posto(linhas[id].posto) : '') + '</td>'; }).join('') + '</tr>';
  if (col.some(c => c.fora.length)) tabG += '<tr><td style="' + b + ';text-align:center">' + String(nLin + 1).padStart(2, '0') + '</td>' + col.map(c => '<td style="' + b + ';text-align:center;font-weight:bold">' + c.fora.map(id => { const a = _secServAfastNoMes(id, mes, d); return '<i>' + esc(String(a.tipo).toUpperCase()) + '</i>: PP. ' + esc(_secServNomePapel(linhas[id].nome)); }).join('<br>') + '</td>').join('') + '</tr>';
  tabG += '</table>';
  // setor administrativo (2 pares setor/nomes por linha, como no papel)
  const setores = {}; ids.filter(id => linhas[id].equipe === 'EXPEDIENTE').forEach(id => { const k = _secServSetor(linhas[id]); (setores[k] = setores[k] || []).push(id); });
  const ks = Object.keys(setores).sort((a, c) => _secServOrdemSetor(a).localeCompare(_secServOrdemSetor(c)));
  const celNomes = k => setores[k].sort((a, c) => String(linhas[a].turno || 'Z').localeCompare(String(linhas[c].turno || 'Z')) || linhas[a].nome.localeCompare(linhas[c].nome)).map(id => '<span style="white-space:nowrap">PP. ' + esc(_secServNomePapel(linhas[id].nome)) + (linhas[id].turno ? ' (' + esc(linhas[id].turno) + ')' : '') + '</span>').join('<br>');
  let tabS = '<table style="width:100%;border-collapse:collapse;font-size:8pt"><tr><th colspan="4" style="' + b + ';background:#e7e7e7;font-size:9.5pt">SETOR ADMINISTRATIVO: <span style="font-weight:normal">Manhã (M) - Tarde (T)</span></th></tr>';
  for (let i = 0; i < ks.length; i += 2) tabS += '<tr>' + [ks[i], ks[i + 1]].map(k => k ? '<td style="' + b + ';background:#e7e7e7;font-weight:bold;text-align:center;width:22%">' + esc(k) + ':</td><td style="' + b + ';width:28%">' + celNomes(k) + '</td>' : '<td style="' + b + '"></td><td style="' + b + '"></td>').join('') + '</tr>';
  tabS += '</table>';
  // escala de apoio do administrativo (sábados)
  const sabs = _secEscDatas(mes, d).filter(dt => d.escalaSabado.some(x => x.data === dt) || new Date(dt + 'T12:00:00').getDay() === 6);
  const nomesSab = dt => d.escalaSabado.filter(x => x.data === dt).sort((a, c) => a.local.localeCompare(c.local)).map(x => esc(_secServNomePapel(_secEscNome(x, d))) + ' – ' + esc(x.local)).join('<br>');
  const tabA = '<table style="width:100%;border-collapse:collapse;font-size:7.5pt"><tr><th colspan="' + sabs.length + '" style="' + b + ';background:#e7e7e7;font-size:8.5pt">ESCALA DE APOIO DO ADMINISTRATIVO<br>Horário: ' + esc(cfg.escalaHorario || _SEC_ESC_HORARIO) + '</th></tr>'
    + '<tr>' + sabs.map(dt => '<th style="' + b + '">DIA: ' + _secBR(dt) + '</th>').join('') + '</tr><tr>' + sabs.map(dt => '<td style="' + b + ';vertical-align:top">' + nomesSab(dt) + '</td>').join('') + '</tr></table>';
  // observações: férias, licenças… do mês
  const porTipo = {}; _secEscAfastadosMes(mes, d).forEach(a => (porTipo[a.tipo] = porTipo[a.tipo] || []).push(a));
  const equipeDe = sid => { const s = _secServ(sid, d); return s ? (s.equipe === 'EXPEDIENTE' ? (_secServSetor(s) === _SEC_SERV_SEM_SETOR ? '' : _secServSetor(s)) :s.equipe ? s.equipe.charAt(0) + s.equipe.slice(1).toLowerCase() : '') : ''; };
  const obs = Object.entries(porTipo).map(([t, l]) => '<b><u>' + esc(t.toUpperCase()) + '</u>:</b> ' + l.map(a => '<b>PP. ' + esc(_secNomeServ(a.servidorId, d).toUpperCase()) + '</b>' + (equipeDe(a.servidorId) ? ' (' + esc(equipeDe(a.servidorId)) + ')' : '') + ' – ' + _secBR(a.inicio) + ' a ' + _secBR(a.fim || a.inicio)).join('; ') + ';').join('<br>');
  // data: o dia em que o documento é gerado
  const dataTxt = _secDataEmissao();
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Escala de Serviço - ' + MESES[mesNum - 1] + '/' + ano + '</title>'
    + '<style>@page{size:A4 landscape;margin:8mm 10mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0;font-size:9pt}@media screen{body{padding:12px 18px}}@media print{.np{display:none}}</style></head><body>'
    + '<div class="np" style="text-align:right;margin-bottom:6px"><button onclick="print()" style="padding:6px 16px;font-size:11pt;cursor:pointer">Imprimir</button></div>'
    + '<div style="display:flex;align-items:center;gap:14px;margin:0 0 4px 30px">' + (iapen ? '<img src="' + iapen + '" style="height:86px;width:auto">' : '')
    + '<div style="flex:1;font-size:10pt;line-height:1.3">GOVERNO DO ESTADO DO AMAPÁ<br>Secretaria de Estado da Justiça e Segurança Pública<br>Instituto de Administração Penitenciária do Estado do Amapá<br>Central de Monitoramento Eletrônico – CME/IAPEN<br>Av.: Machado de Assis, nº. 372, Bairro: Central – Macapá/AP – CEP: 68.900-066.<br><span style="font-size:8.5pt">Email: <u style="color:#1f5fd6">cme.iapen.ap@gmail.com</u> – Fone: (96) 98415-2844 ou (96) 98409-9906.</span></div>'
    + (cme ? '<img src="' + cme + '" style="height:80px;width:auto;margin-right:20px">' : '') + '</div>'
    + '<div style="text-align:center;font-weight:bold;font-size:14pt;margin:2px 0 6px">ESCALA DE SERVIÇO (24x96) - PLANTÃO DA CME – ' + MESES[mesNum - 1] + '/' + ano + '</div>'
    + tabG
    + '<div style="font-size:8.5pt;margin:4px 0 8px"><b style="color:#e00000">Postos de Serviço: 01</b> – Instalação, Inspeção, Criação de zona; <b style="color:#1f5fd6">Postos de Serviço: 02</b> – Tratamento de ocorrência, Mudança de endereço, Alimentação do drive, Livro.</div>'
    + '<div style="display:flex;gap:12px;align-items:flex-start"><div style="flex:1 1 50%">' + tabS + '</div>'
    + '<div style="flex:1 1 50%">' + tabA + (obs ? '<div style="font-size:8pt;margin-top:5px;text-align:justify;line-height:1.35"><b><u>OBS:</u></b> ' + obs + '</div>' : '') + '</div></div>'
    + '<div style="text-align:right;margin-top:10px;font-size:9.5pt">' + dataTxt + '</div>'
    + '<div style="text-align:center;margin-top:16px;font-size:9.5pt;line-height:1.35"><b>' + esc(_secGerente(d).toUpperCase()) + '</b><br>Gerente da Central de Monitoramento Eletrônico<br>' + esc(cfg.gerenteDecreto || _SEC_SERV_DECRETO) + '</div>'
    + '</body></html>';
  _entregarDoc(new Blob([html], { type: 'text/html' }), 'Escala de Servico ' + mes + '.html');
  auditar({ modulo: 'Secretaria', action: 'sec_serv_imprimir', alvo: MESES[mesNum - 1] + '/' + ano });
}
Object.assign(_SEC_ACOES, { sec_serv_mover: 'Mudou servidor de guarnição/setor na escala de serviço', sec_serv_posto: 'Trocou o posto na escala de serviço', sec_serv_turno: 'Trocou o turno na escala de serviço', sec_serv_imprimir: 'Imprimiu a escala de serviço' });
