/* ═══════════════════════════ SECRETARIA — ESCALA DE APOIO DO ADMINISTRATIVO (SÁBADOS) ═══════════════════════════
   Sábados das 08h às 12h. É OBRIGAÇÃO do servidor administrativo para ter direito ao adicional noturno —
   NÃO gera dispensa (não mexe na Ficha de Apoio e Dispensas; apoio em evento de folga é outra coisa).
   • Dados: cme_secretaria.escalaSabado = [{ id, data, servidorId | nome, local: CME|PEF, status: ''|presente|falta }]
     e cme_secretaria.config.escalaHorario (padrão "das 08h às 12h").
   • Painel na sub-aba "Apoio de sábado" (grupo Escalas), editado NO PRÓPRIO QUADRO: os sábados de cada mês aparecem sozinhos (colunas);
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

// ── Visual das duas escalas (15/10/2026: "fundo branco e letras pequenas confundem") ──
// Tema escuro do design system do CME (GitHub Dark), texto 14px, só o essencial à vista; o resto em seções recolhíveis.
function _secEscxCss() {
  if (document.getElementById('sec-escx-css')) return '';
  const st = document.createElement('style'); st.id = 'sec-escx-css';
  st.textContent = '.escx{--bg:#0d1117;--sf:#161b22;--el:#21262d;--bd:#30363d;--tx:#e6edf3;--mu:#8b949e;--sb:#6e7681;--ac:#58a6ff;--ok:#3fb950;--wa:#d29922;--da:#f85149;--pu:#a371f7;'
    + 'background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:6px;padding:16px;margin-top:12px;font-size:14px;line-height:1.5;'
    + 'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans",Helvetica,Arial,sans-serif}'
    + '.escx *{box-sizing:border-box}'
    + '.escx-top{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px}'
    + '.escx-tit{font-size:20px;font-weight:600;line-height:1.25}'
    + '.escx-sub{font-size:13px;color:var(--mu);margin-top:3px}'
    + '.escx-nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap}'
    + '.escx-btn{background:var(--el);color:#c9d1d9;border:1px solid var(--bd);padding:5px 14px;border-radius:6px;font-size:14px;font-weight:600;cursor:pointer;line-height:1.5}'
    + '.escx-btn:hover{border-color:var(--ac);color:var(--tx)}'
    + '.escx-btn.pri{background:#1f883d;color:#fff;border-color:rgba(240,246,252,.1)}.escx-btn.pri:hover{background:#2c974b}'
    + '.escx-mes{font-size:16px;font-weight:600;min-width:160px;text-align:center;text-transform:capitalize}'
    + '.escx-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}'
    + '.escx-card{background:var(--sf);border:1px solid var(--bd);border-radius:6px;padding:12px;min-width:0}'
    + '.escx-card.on{border-color:var(--pu);box-shadow:inset 3px 0 0 var(--pu)}.escx-card.plantao{border-color:var(--ok);box-shadow:inset 3px 0 0 var(--ok)}'
    + '.escx-card.feito{opacity:.75}'
    + '.escx-cab{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px}'
    + '.escx-dia{font-size:24px;font-weight:600;line-height:1.1}.escx-dia small{font-size:14px;color:var(--mu);font-weight:400}'
    + '.escx-rot{font-size:12px;color:var(--mu);text-transform:uppercase;letter-spacing:.06em;font-weight:600}'
    + '.escx-row{display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--el);border:1px solid var(--bd);border-radius:6px;margin-top:6px;cursor:grab;min-width:0}'
    + '.escx-row:hover{border-color:#484f58}.escx-row.ok{box-shadow:inset 3px 0 0 var(--ok)}.escx-row.falta{box-shadow:inset 3px 0 0 var(--da)}.escx-row.apagado{opacity:.6}'
    + '.escx-nome{flex:1;min-width:0;font-size:14px;font-weight:600;line-height:1.3;overflow-wrap:anywhere}'
    + '.escx-row.col{flex-direction:column;align-items:flex-start;gap:4px}.escx-etqs{display:flex;gap:4px;flex-wrap:wrap}'
    + '.escx-det{display:block;font-size:12px;font-weight:400;color:var(--mu);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.escx-badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;padding:3px 8px;border-radius:3px;border-left:2px solid currentColor;white-space:nowrap;cursor:default}'
    + '.escx-badge::before{content:"";width:5px;height:5px;background:currentColor;flex:none}'
    + '.escx-badge[onclick]{cursor:pointer}.escx-badge[onclick]:hover{filter:brightness(1.25)}'
    + '.b-ac{background:rgba(88,166,255,.14);color:#58a6ff}.b-wa{background:rgba(210,153,34,.14);color:#d29922}.b-ok{background:rgba(63,185,80,.14);color:#3fb950}'
    + '.b-da{background:rgba(248,81,73,.14);color:#f85149}.b-pu{background:rgba(163,113,247,.16);color:#a371f7}.b-mu{background:rgba(139,148,158,.14);color:#8b949e}'
    + '.escx-x{color:var(--sb);cursor:pointer;font-size:14px;padding:0 2px;flex:none}.escx-x:hover{color:var(--da)}'
    + '.escx-add{margin-top:6px;padding:7px;border:1px dashed var(--bd);border-radius:6px;text-align:center;font-size:13px;color:var(--mu);cursor:pointer}'
    + '.escx-add:hover{border-color:var(--ac);color:var(--ac)}'
    + '.escx-sec{font-size:12px;font-weight:600;color:var(--mu);text-transform:uppercase;letter-spacing:.06em;margin:20px 0 8px;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}'
    + '.escx-sec span{text-transform:none;letter-spacing:0;font-weight:400}'
    + '.escx-faixa{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;border-radius:6px;background:var(--sf);border:1px solid var(--bd);margin-bottom:14px;font-size:14px}'
    + '.escx details{margin-top:10px;border:1px solid var(--bd);border-radius:6px;background:var(--sf)}'
    + '.escx summary{cursor:pointer;padding:10px 12px;font-size:14px;font-weight:600;list-style:none}.escx summary::-webkit-details-marker{display:none}'
    + '.escx summary::before{content:"\\25B8  ";color:var(--mu)}.escx details[open]>summary::before{content:"\\25BE  "}'
    + '.escx summary .n{color:var(--mu);font-weight:400}.escx details>.dentro{padding:0 12px 12px}'
    + '.escx select,.escx textarea{background:var(--bg);color:var(--tx);border:1px solid var(--bd);border-radius:6px;font-size:14px;font-family:inherit}'
    + '.escx .mono{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace}'
    + '.escx .vazio{font-size:13px;color:var(--sb);padding:6px 2px}'
    + '.escx a{color:var(--ac)}';
  document.head.appendChild(st);
  return '';
}
const _SEC_ESCX_TIPO = t => /f[ée]rias/i.test(t) ? 'b-ac' : /sa[uú]de|m[ée]dic/i.test(t) ? 'b-wa' : /licen/i.test(t) ? 'b-pu' : 'b-mu';

// ── Painel (editado no próprio quadro) ───────────────────────────────────────
function _secCartaoEscala() {
  _secEscxCss();
  const d = _secDados(), hoje = _secHoje(), mes = _secEscMesVis || hoje.slice(0, 7);
  const datas = _secEscDatas(mes, d), prox = datas.find(x => x >= hoje), horario = (d.config || {}).escalaHorario || _SEC_ESC_HORARIO;
  const doMes = d.escalaSabado.filter(x => x.data.slice(0, 7) === mes), vazio = !doMes.length;
  const pessoal = _secEscPessoal(d), afast = _secEscAfastadosMes(mes, d);
  const qtd = sid => doMes.filter(x => x.servidorId === sid).length;
  const atual = hoje.slice(0, 7); [atual, _secEscMaisMes(atual, 1), mes].forEach(_secEscAutoAgendar);
  // o quadro fixo da escala de serviço é copiado na 1ª vez que o mês aparece — também por aqui, agora que as escalas têm sub-abas separadas
  if (typeof _secServApoioCongelar === 'function') _secServApoioCongelar(mes);
  const badgeLocal = (x, clic) => '<span class="escx-badge ' + (x.local === 'PEF' ? 'b-wa' : 'b-ac') + '"' + (clic ? ' onclick="sec_escLocal(\'' + x.id + '\')" title="Clique para trocar CME / PEF"' : '') + '>' + esc(x.local) + '</span>';

  const coluna = dt => {
    const lst = d.escalaSabado.filter(x => x.data === dt).sort((a, b) => a.local.localeCompare(b.local) || _secEscNome(a, d).localeCompare(_secEscNome(b, d)));
    const passou = dt <= hoje, ehHoje = dt === hoje, ehProx = dt === prox && !ehHoje, dia = new Date(dt + 'T12:00:00');
    const linha = x => {
      const pres = x.status === 'presente', falta = x.status === 'falta';
      return '<div class="escx-row' + (pres ? ' ok' : falta ? ' falta' : '') + '" draggable="true" ondragstart="sec_escArrastar(event,\'item\',\'' + x.id + '\')">'
        + '<span class="escx-nome"' + (passou ? ' onclick="sec_escPresenca(\'' + x.id + '\')" title="Clique: compareceu / faltou" style="cursor:pointer"' : '') + '>'
        + esc(_secEscCurto(_secEscNome(x, d))) + (pres ? '<span class="escx-det" style="color:var(--ok)">\u{2713} compareceu</span>' : falta ? '<span class="escx-det" style="color:var(--da)">\u{2717} faltou</span>' : '') + '</span>'
        + badgeLocal(x, true) + '<span class="escx-x" onclick="sec_escRemover(\'' + x.id + '\')" title="Tirar da escala">\u{2715}</span></div>';
    };
    const picker = _secEscPicker === dt ? '<div style="margin-top:8px;padding:8px;border:1px dashed var(--pu);border-radius:6px">'
      + '<select id="sec-esc-sel" style="width:100%;padding:6px;margin-bottom:6px"><option value="">Escolha o servidor…</option>'
      + pessoal.map(s => { const af = _secEscAfastadoEm(s.id, dt, d), n = qtd(s.id); return '<option value="' + s.id + '">' + esc(_secEscCurto(s.nome)) + (af ? ' — ' + esc(af.tipo.toLowerCase()) : n ? ' — já tem ' + n + ' sábado' : '') + '</option>'; }).join('')
      + '<option value="__outro">Outra pessoa (digitar o nome)…</option></select>'
      + '<div style="display:flex;gap:6px">' + _SEC_ESC_LOCAIS.map(l => '<button type="button" class="escx-btn" style="flex:1;padding:4px" onclick="sec_escConfirmarPicker(\'' + dt + '\',\'' + l + '\')">+ ' + l + '</button>').join('')
      + '<button type="button" class="escx-btn" style="padding:4px 10px" onclick="_secEscPicker=null;_secEscAtualizar()">\u{2715}</button></div></div>'
      : '<div class="escx-add" onclick="_secEscPicker=\'' + dt + '\';_secEscAtualizar()">+ adicionar</div>';
    const selo = ehHoje ? '<span class="escx-badge b-pu">Hoje</span>' : ehProx ? '<span class="escx-badge b-pu">Próximo</span>' : passou ? '<span class="escx-badge b-mu">Realizado</span>' : '';
    return '<div class="escx-card' + (ehHoje || ehProx ? ' on' : passou ? ' feito' : '') + '" ondragover="event.preventDefault();this.style.borderColor=\'var(--ac)\'" ondragleave="this.style.borderColor=\'\'" ondrop="sec_escSoltar(event,\'' + dt + '\')">'
      + '<div class="escx-cab"><div><div class="escx-rot">' + dia.toLocaleDateString('pt-BR', { weekday: 'long' }) + '</div>'
      + '<div class="escx-dia">' + String(dia.getDate()).padStart(2, '0') + '<small>/' + String(dia.getMonth() + 1).padStart(2, '0') + '</small></div></div>' + selo + '</div>'
      + (lst.length ? lst.map(linha).join('') : '<div class="vazio">Ninguém escalado.</div>') + picker + '</div>';
  };

  // quem do expediente ainda falta escalar no mês (o resto fica recolhido)
  const situacao = pessoal.map(s => {
    const af = afast.find(a => a.servidorId === s.id), reg = _secEscRegime(s), precisa = _secEscPrecisa(s);
    const tem = l => doMes.some(x => x.servidorId === s.id && x.local === l);
    return { s, af, reg, precisa, falta: precisa.filter(l => !tem(l)) };
  });
  const fora = situacao.filter(x => x.reg === 'NAO' || !x.precisa.length || x.af);
  const pend = situacao.filter(x => !fora.includes(x) && x.falta.length);
  const prontos = situacao.filter(x => !fora.includes(x) && !x.falta.length);
  const pessoa = (x, extra) => '<div class="escx-row col" draggable="true" ondragstart="sec_escArrastar(event,\'serv\',\'' + x.s.id + '\')" title="' + esc(x.s.nome) + ' — arraste para um sábado">'
    + '<span class="escx-nome">' + esc(_secEscCurto(x.s.nome)) + '</span><span class="escx-etqs">' + extra + '</span></div>';
  const grade = itens => '<div class="escx-grid" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:0 10px">' + itens.join('') + '</div>';
  const blocoPend = pend.length
    ? '<div class="escx-sec">Faltam escalar <span>arraste o nome para um sábado</span></div>'
      + grade(pend.map(x => pessoa(x, x.falta.map(l => '<span class="escx-badge ' + (l === 'PEF' ? 'b-wa' : 'b-ac') + '">falta ' + l + '</span>').join(''))))
    : '';
  const blocoProntos = prontos.length ? '<details><summary>Já escalados no mês <span class="n">(' + prontos.length + ')</span></summary><div class="dentro">'
    + grade(prontos.map(x => pessoa(x, x.precisa.map(l => '<span class="escx-badge b-ok">' + l + '</span>').join('')))) + '</div></details>' : '';
  const blocoFora = fora.length ? '<details><summary>Não entram este mês <span class="n">(' + fora.length + ' — férias, licença ou não tira)</span></summary><div class="dentro">'
    + grade(fora.map(x => pessoa(x, '<span class="escx-badge ' + (x.af ? _SEC_ESCX_TIPO(x.af.tipo) : 'b-mu') + '">' + esc(x.af ? x.af.tipo : 'não tira') + '</span>'))) + '</div></details>' : '';
  const blocoAfast = !afast.length ? '' : '<details><summary>Férias e licenças em ' + esc(_secEscMesTxt(mes)) + ' <span class="n">(' + afast.length + ')</span></summary><div class="dentro">'
    + grade(afast.map(a => '<div class="escx-row" style="cursor:default"><span class="escx-nome">' + esc(_secEscCurto(_secNomeServ(a.servidorId, d)))
      + '<span class="escx-det mono">' + _secBR(a.inicio).slice(0, 5) + ' → ' + _secBR(a.fim || a.inicio).slice(0, 5) + '</span></span><span class="escx-badge ' + _SEC_ESCX_TIPO(a.tipo) + '">' + esc(a.tipo) + '</span></div>')) + '</div></details>';
  const ajuda = '<details><summary>Como usar e regra do mês</summary><div class="dentro" style="font-size:13px;color:var(--mu)">'
    + '<p style="margin:0 0 6px"><b style="color:var(--tx)">Regra:</b> 1 sábado na CME + 1 na PEF por mês · Bruna, Olidete, Francisco e Débora: só CME · Everton: não tira. O cadastro do servidor ("Apoio de sábado") manda mais que a regra.</p>'
    + '<p style="margin:0">Arraste o nome para um sábado (ou "+ adicionar") · clique na etiqueta CME/PEF para trocar · depois do sábado, clique no nome para marcar compareceu ou faltou · \u{2715} tira · arraste entre sábados para mudar o dia · '
    + '<a href="#" onclick="sec_escDataExtra(\'' + mes + '\');return false">incluir um dia que não é sábado</a>.</p></div></details>';

  const faixa = mes < atual ? '' : '<div class="escx-faixa">' + (pend.length
    ? '<span class="escx-badge b-wa">Pendente</span><span><b>' + pend.length + '</b> servidor(es) ainda sem todos os sábados do mês.</span>'
    : vazio ? '<span class="escx-badge b-mu">Montando</span><span>Montando a escala de ' + esc(_secEscMesTxt(mes)) + ' pela regra…</span>'
    : '<span class="escx-badge b-ok">Completa</span><span>Todos do expediente já estão escalados neste mês.</span>') + '</div>';

  return '<div id="sec-esc-card" class="escx">'
    + '<div class="escx-top"><div><div class="escx-tit">Apoio de sábado</div>'
    + '<div class="escx-sub">Administrativo · <span onclick="sec_escHorarioEditar()" title="Clique para mudar o horário" style="cursor:pointer;text-decoration:underline dotted">' + esc(horario) + '</span> · obrigação para o adicional noturno (não gera dispensa)</div></div>'
    + '<div class="escx-nav"><button type="button" class="escx-btn" onclick="_secEscMesVis=_secEscMaisMes(\'' + mes + '\',-1);_secEscPicker=null;_secEscAtualizar()" title="Mês anterior">\u{2039}</button>'
    + '<div class="escx-mes">' + esc(_secEscMesTxt(mes)) + '</div>'
    + '<button type="button" class="escx-btn" onclick="_secEscMesVis=_secEscMaisMes(\'' + mes + '\',1);_secEscPicker=null;_secEscAtualizar()" title="Próximo mês">\u{203A}</button>'
    + '<button type="button" class="escx-btn" onclick="sec_escImprimir(\'' + mes + '\')">\u{1F5A8}\u{FE0F} Imprimir</button></div></div>'
    + (vazio && mes < atual ? '<div class="escx-faixa"><span class="escx-badge b-mu">Sem registro</span><span>Sem escala registrada em ' + esc(_secEscMesTxt(mes)) + '.</span></div>' : faixa)
    + '<div class="escx-grid">' + datas.map(coluna).join('') + '</div>'
    + blocoPend + blocoProntos + blocoFora + blocoAfast + ajuda + '</div>';
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
