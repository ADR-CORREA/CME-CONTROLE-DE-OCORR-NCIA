/* ═══════════════════════════ SECRETARIA — ESCALA DE SERVIÇO E APOIO ═══════════════════════════
   Grupo "Escalas" com duas sub-abas (15/10/2026), separadas de "Apoios e Dispensas" — são coisas diferentes:
   • "Apoio de sábado": a escala de apoio do administrativo aos sábados (secretaria-escala.js, _secCartaoEscala);
   • "Escala de serviço (24x96)": a escala de serviço do mês, igual ao papel "ESCALA DE SERVIÇO (24x96)":
     guarnições ALFA–ECHO com os dias de plantão do mês e o posto de cada um, e o setor administrativo
     com o turno (M/T). Férias e licenças vêm da aba Férias e Licenças.
   • Atualiza sozinha: o mês atual e os seguintes saem do CADASTRO dos servidores (equipe, posto, setor, turno) e os
     dias de plantão são calculados. O mês atual é guardado em cme_secretaria.escalaServico[mes] (refeito sempre que
     muda), então quando o mês acaba ele fica no histórico do jeito que foi — mudar o cadastro depois não mexe nele.
   • Edição no próprio quadro: arrastar o nome para outra guarnição, setor ou coluna de turno, "⇄" troca o posto ou o
     turno, clicar no nome para abrir o cadastro. No mês atual/futuro a mudança vai para o CADASTRO; num mês que já
     passou, muda só o registro daquele mês.
   • Imprimir: formato do papel (A4 deitado) com o cabeçalho do IAPEN/CME, a escala de apoio, as observações de férias
     e licenças e a assinatura do gerente.
   Depende de secretaria*.js e de getPlantaoParaData (index.html). Emojis só por \u{...}. Prefixo _secServ / sec_serv. */

const _PL_EQUIPES_SEC = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO'];
const _SEC_SERV_SEM_SETOR = 'Sem setor definido';
const _SEC_SERV_DECRETO = 'Decreto nº 5953/2025 – GEA';

// 15/10/2026: cada escala na sua sub-aba (grupo Escalas): "Apoio de sábado" e "Escala de serviço (24x96)"
function sec_renderEscalas() {
  const c = document.getElementById('sec-conteudo'); if (!c) return;
  _secServGuardarAuto();
  c.innerHTML = _secCartaoEscala();
}
function sec_renderEscServ() {
  const c = document.getElementById('sec-conteudo'); if (!c) return;
  _secServGuardarAuto();
  c.innerHTML = _secCartaoServico();
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
function _secServDoCadastro(d, mes) {
  const linhas = {}, m = mes || _secServAtual();
  d.servidores.filter(s => (s.situacao || 'ativo') === 'ativo' && (_PL_EQUIPES_SEC.includes(s.equipe) || s.equipe === 'EXPEDIENTE'))
    .forEach(s => { linhas[s.id] = { nome: s.nome, equipe: s.equipe, posto: _secPostoNoMes(s.posto, m, d), setor: s.setor || '', turno: s.turno || '' }; });
  return linhas;
}
// a escala do mês: mês passado = o que foi guardado; mês atual/futuro = o cadastro de agora
function _secServLinhas(mes, d) {
  const g = (d.escalaServico || {})[mes];
  return mes < _secServAtual() && g && g.linhas ? g.linhas : _secServDoCadastro(d, mes);
}
// Setores do administrativo FIXOS (pedido de 14/10/2026: "nenhum pode sumir se não tiver ninguém").
// Lista em config.setoresAdm; enquanto não existir, vale a lista da escala geral de outubro/2026.
const _SEC_SETORES_PADRAO = ['Gerência — Gerente', 'Gerência — Subgerente', 'Casa da Mulher Brasileira (CME)', 'Comunicação Processual', 'Jurídico', 'Logística',
  'Protocolo / Recepção', 'Psicossocial — Assistente Social', 'Psicossocial — Psicólogo', 'Relatórios Estatísticos', 'Relatórios Judiciais', 'Secretaria'];
// lista guardada + os setores em uso (pelos servidores do expediente e, se vier, pelas linhas de um mês)
function _secServSetoresConhecidos(d, linhas) {
  const base = Array.isArray((d.config || {}).setoresAdm) ? d.config.setoresAdm : _SEC_SETORES_PADRAO;
  const uso = d.servidores.filter(s => s.equipe === 'EXPEDIENTE').map(_secServSetor).concat(Object.values(linhas || {}).filter(l => l.equipe === 'EXPEDIENTE').map(_secServSetor));
  return [...new Set(base.concat(uso))].filter(k => k && k !== _SEC_SERV_SEM_SETOR && !_SEC_SERV_NAO_SETOR.includes(k));
}
const _SEC_SERV_NAO_SETOR = ['Expediente', 'Plantão'];
function _secServSetor(l) { return l.setor && !_SEC_SERV_NAO_SETOR.includes(l.setor) ? l.setor : _SEC_SERV_SEM_SETOR; }
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
function _secServJsonEstavel(v) {
  if (Array.isArray(v)) return '[' + v.map(_secServJsonEstavel).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + _secServJsonEstavel(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
function _secServGuardarAuto() {
  const d = _secDados(), mes = _secServAtual();
  if (_secServGuardando || !d.servidores.length) return;
  const g = (d.escalaServico || {})[mes], atual = _secServDoCadastro(d);
  if (g && _secServJsonEstavel(g.linhas) === _secServJsonEstavel(atual)) return; // nada mudou
  _secServGuardando = true;
  _secMutar(x => {
    const linhas = _secServDoCadastro(x), ant = x.escalaServico[mes];
    if (ant && _secServJsonEstavel(ant.linhas) === _secServJsonEstavel(linhas)) return false;
    x.escalaServico = Object.assign({}, x.escalaServico, { [mes]: { linhas, guardadoEm: new Date().toISOString() } });
  }).finally(() => { _secServGuardando = false; });
}

// ── Painel ────────────────────────────────────────────────────────────────────
// 16/10/2026 (identidade visual, proposta aprovada no quadro de design): guarnições com faixa de título escura
// (verde = de plantão hoje), nomes agrupados por posto; setor administrativo numa tabela Setor | Manhã | Tarde | Sem turno.
// Edição igual: arrastar o nome (para a coluna Manhã/Tarde já muda o turno), "⇄" troca posto/turno, clique no nome abre o cadastro.
function _secCartaoServico() {
  if (typeof _secEscxCss === 'function') _secEscxCss();
  const d = _secDados(), hoje = _secHoje(), mes = _secEscMesVis || hoje.slice(0, 7), passado = mes < _secServAtual();
  _secServApoioCongelar(mes);
  const linhas = _secServLinhas(mes, d), ids = Object.keys(linhas);
  const dias = _secServDiasGuarnicao(mes), deHoje = mes === _secServAtual() ? _secPlantaoAgora().guarnicao : '';
  const guardado = (d.escalaServico || {})[mes];
  const solta = alvo => ' ondragover="event.preventDefault();this.classList.add(\'escx-drop\')" ondragleave="this.classList.remove(\'escx-drop\')" ondrop="sec_servSoltar(event,\'' + mes + '\',\'' + _jsq(alvo) + '\')"';
  const arrasta = sid => ' draggable="true" ondragstart="event.dataTransfer.setData(\'text/plain\',\'escserv:' + sid + '\')" onclick="sec_editarServidor(\'' + sid + '\')" title="' + esc(linhas[sid].nome) + ' — arraste para mudar de guarnição/setor · clique para abrir o cadastro"';
  const det = af => af ? '<span class="escx-det">' + esc(af.tipo.toLowerCase()) + ' <span class="mono">' + _secBRc(af.inicio) + '–' + _secBRc(af.fim || af.inicio) + '</span></span>' : '';
  const porNome = (a, b) => linhas[a].nome.localeCompare(linhas[b].nome);

  // ── Plantão 24x96: um cartão por guarnição, nomes agrupados por posto ──
  const trocaPosto = sid => { const p = linhas[sid].posto; return '<button type="button" class="escx-ic" onclick="event.stopPropagation();sec_servPosto(\'' + mes + '\',\'' + sid + '\')" title="Posto ' + (p || '—') + ' — clique para passar para o posto ' + (p === '1' ? '2' : '1') + '">\u{21C4}</button>'; };
  const pessoa = (sid, i, apagado) => '<div class="escx-p' + (i % 2 ? ' z' : '') + (apagado ? ' apagado' : '') + '"' + arrasta(sid) + '>'
    + '<span class="escx-nome">' + esc(_secEscCurto(linhas[sid].nome)) + det(_secServAfastNoMes(sid, mes, d)) + '</span>' + trocaPosto(sid) + '</div>';
  const guarnicao = g => {
    const membros = ids.filter(id => linhas[id].equipe === g);
    const fora = membros.filter(id => _secServForaMes(_secServAfastNoMes(id, mes, d), mes));
    const lista = membros.filter(id => !fora.includes(id));
    const atual = g === deHoje;
    const grupos = [['1', 'p1', 'Posto 1'], ['2', 'p2', 'Posto 2'], ['', 'p0', 'Sem posto']].map(([n, c, rot]) => {
      const ps = lista.filter(id => n ? linhas[id].posto === n : !['1', '2'].includes(linhas[id].posto)).sort(porNome);
      return ps.length ? '<div class="escx-g-grupo ' + c + '">' + (n ? '<span class="escx-num ' + c + '">' + n + '</span>' : '') + rot + '</div>' + ps.map((id, i) => pessoa(id, i)).join('') : '';
    }).join('');
    return '<section class="escx-g' + (atual ? ' hoje' : '') + '" data-guarnicao="' + g + '"' + solta('G:' + g) + '>'
      + '<div class="escx-g-cab"><span class="escx-g-nome">' + g + '</span>' + (atual ? '<span class="escx-g-selo">De plantão hoje</span>' : '') + '</div>'
      + '<div class="escx-g-dias mono" title="Dias de plantão no mês">Dias ' + (dias[g] || []).join(' · ') + '</div>'
      + (grupos || '<div class="vazio" style="padding:8px 14px">Arraste um nome para cá.</div>')
      + (fora.length ? '<div class="escx-g-fora">Fora no mês</div>' + fora.sort(porNome).map((id, i) => pessoa(id, i, true)).join('') : '')
      + '</section>';
  };

  // ── Setor administrativo (expediente): tabela Setor | Manhã | Tarde | Sem turno ──
  const setores = {}; _secServSetoresConhecidos(d, linhas).forEach(k => { setores[k] = []; });
  ids.filter(id => linhas[id].equipe === 'EXPEDIENTE').forEach(id => { const k = _secServSetor(linhas[id]); (setores[k] = setores[k] || []).push(id); });
  const ordem = Object.keys(setores).filter(k => k !== _SEC_SERV_SEM_SETOR || setores[k].length).sort((a, b) => _secServOrdemSetor(a).localeCompare(_secServOrdemSetor(b)));
  const turnoDe = id => ['M', 'T'].includes(linhas[id].turno) ? linhas[id].turno : '';
  const celPessoa = id => {
    const af = _secServAfastNoMes(id, mes, d), t = turnoDe(id);
    return '<div class="escx-cel-p' + (af ? ' apagado' : '') + '"' + arrasta(id) + '><span class="escx-nome">' + esc(_secEscCurto(linhas[id].nome))
      + (af ? '<span class="escx-det">' + esc(af.tipo.toLowerCase()) + ' até <span class="mono">' + _secBRc(af.fim || af.inicio) + '</span></span>' : '') + '</span>'
      + '<button type="button" class="escx-ic" onclick="event.stopPropagation();sec_servTurno(\'' + mes + '\',\'' + id + '\')" title="Passar para o turno da ' + (t === 'M' ? 'tarde' : 'manhã') + '">\u{21C4}</button></div>';
  };
  const linhaSetor = k => {
    const ps = setores[k].sort(porNome);
    const col = t => { const doTurno = ps.filter(id => turnoDe(id) === t); return '<td' + solta('S:' + k + '|' + t) + '>' + (doTurno.length ? doTurno.map(celPessoa).join('') : '<span class="escx-vazio">—</span>') + '</td>'; };
    return '<tr data-setor="' + esc(k) + '"><th scope="row"' + solta('S:' + k) + '>' + esc(k)
      + (ps.length ? '' : ' <a href="#" class="escx-rem" onclick="sec_servRemoverSetor(\'' + _jsq(k) + '\');return false" title="Tirar este setor vazio da escala">remover</a>') + '</th>'
      + col('M') + col('T') + col('') + '</tr>';
  };
  const tabelaAdm = '<div class="escx-tab-box"><table class="escx-tab"><thead><tr><th scope="col" style="width:30%">Setor</th>'
    + '<th scope="col" style="width:27%"><span class="escx-turno m"></span>Manhã</th><th scope="col" style="width:27%"><span class="escx-turno t"></span>Tarde</th><th scope="col">Sem turno</th></tr></thead><tbody>'
    + ordem.map(linhaSetor).join('')
    + '<tr><td colspan="4" class="escx-novo"' + solta('S:+') + '>+ arraste um nome aqui para criar um setor</td></tr></tbody></table></div>';

  const aviso = passado
    ? '<div class="escx-faixa at"><span class="escx-faixa-ic">!</span><span><b>Mês encerrado.</b> ' + (guardado ? 'Escala guardada como estava em ' + _secBR(guardado.guardadoEm) + '. Mudanças aqui valem só para este mês.' : 'Não havia registro guardado; mostrando o cadastro atual.') + '</span></div>'
    : '';
  const legenda = '<div class="escx-legenda"><span><span class="escx-num p1">1</span> <b>Posto 1</b> — instalação, inspeção, criação de zona</span>'
    + '<span><span class="escx-num p2">2</span> <b>Posto 2</b> — ocorrências, mudança de endereço, drive, livro</span>'
    + '<span style="color:var(--mu)">Os postos trocam sozinhos todo mês (1 \u{2194} 2)</span></div>';
  return '<div id="sec-serv-card" class="escx">'
    + '<div class="escx-top"><div><div class="escx-tit">Escala de serviço (24x96)</div><div class="escx-sub">Plantão da CME e setor administrativo</div></div>'
    + '<div class="escx-nav"><button type="button" class="escx-btn" onclick="_secEscMesVis=_secEscMaisMes(\'' + mes + '\',-1);_secEscAtualizar()" title="Mês anterior" aria-label="Mês anterior">\u{2039}</button>'
    + '<div class="escx-mes">' + esc(_secEscMesTxt(mes)) + '</div>'
    + '<button type="button" class="escx-btn" onclick="_secEscMesVis=_secEscMaisMes(\'' + mes + '\',1);_secEscAtualizar()" title="Próximo mês" aria-label="Próximo mês">\u{203A}</button>'
    + '<button type="button" class="escx-btn pri" onclick="sec_servImprimir(\'' + mes + '\')">Imprimir escala do mês</button></div></div>'
    + aviso + legenda
    + '<div class="escx-sec" style="margin-top:0">Plantão — guarnições</div>'
    + '<div class="escx-grid" style="grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px">' + _PL_EQUIPES_SEC.map(guarnicao).join('') + '</div>'
    + '<div class="escx-sec">Setor administrativo</div>'
    + tabelaAdm
    + '<div class="escx-nota">Nome em cinza = afastado no mês (férias ou licença). Arraste o nome para mudar de setor, turno ou guarnição; \u{21C4} troca o posto ou o turno; clique no nome para abrir o cadastro.</div>'
    + _secServHtmlQuadroApoio(mes, d) + _secServHtmlObs(mes, d) + '</div>';
}

// ── OBS da escala de serviço (27/10/2026: "já venha sugerido, mas que possamos editar") ──
// A sugestão sai das férias e licenças do mês (aba Férias e Licenças); o texto editado fica em
// cme_secretaria.escalaServObs[mes] e é o que sai na impressão. "Sugerir de novo" apaga a edição.
function _secServEquipeDe(sid, d) { const s = _secServ(sid, d); return s ? (s.equipe === 'EXPEDIENTE' ? (_secServSetor(s) === _SEC_SERV_SEM_SETOR ? '' : _secServSetor(s)) : s.equipe ? s.equipe.charAt(0) + s.equipe.slice(1).toLowerCase() : '') : ''; }
function _secServObsSugestao(mes, d) {
  const porTipo = {}; _secEscAfastadosMes(mes, d).forEach(a => (porTipo[a.tipo] = porTipo[a.tipo] || []).push(a));
  return Object.entries(porTipo).map(([t, l]) => t.toUpperCase() + ': ' + l.map(a => 'PP. ' + _secNomeServ(a.servidorId, d).toUpperCase() + (_secServEquipeDe(a.servidorId, d) ? ' (' + _secServEquipeDe(a.servidorId, d) + ')' : '') + ' – ' + _secBR(a.inicio) + ' a ' + _secBR(a.fim || a.inicio)).join('; ') + ';').join('\n');
}
function _secServObsTexto(mes, d) { const g = (d.escalaServObs || {})[mes]; return g && typeof g.texto === 'string' ? g.texto : _secServObsSugestao(mes, d); }
// impressão: "RÓTULO:" em negrito sublinhado e "PP. NOME" em negrito, como no papel
function _secServObsHtml(texto) {
  return String(texto || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => esc(l)
    .replace(/^([^:]{2,40}):/, '<b><u>$1</u>:</b>')
    .replace(/PP\. ([A-ZÀ-Ú][A-ZÀ-Ú ]+?)(?=\s*[(–\-;]|$)/g, '<b>PP. $1</b>')).join('<br>');
}
function _secServHtmlObs(mes, d) {
  const g = (d.escalaServObs || {})[mes], texto = _secServObsTexto(mes, d);
  const origem = g && typeof g.texto === 'string' ? 'Editada' + (g.editadoPor ? ' por ' + esc(g.editadoPor) : '') + (g.editadoEm ? ' em ' + _secBR(g.editadoEm) : '') + '.' : 'Sugestão automática (férias e licenças do mês) — ainda não editada.';
  return '<div class="escx-sec">Observações (OBS) que saem na impressão</div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px"><div style="font-size:13px;color:var(--mu)">' + origem + ' Uma linha por tipo (ex.: FÉRIAS: PP. NOME (Equipe) – 01/11/2026 a 30/11/2026;). O texto é salvo ao sair do campo.</div>'
    + '<button type="button" class="escx-btn" onclick="sec_servObsSugerir(\'' + mes + '\')">Sugerir de novo (das férias e licenças)</button></div>'
    + '<textarea rows="6" onchange="sec_servObsSalvar(\'' + mes + '\',this.value)" style="width:100%;padding:8px 10px;resize:vertical;font-size:14px">' + esc(texto) + '</textarea>';
}
async function sec_servObsSalvar(mes, valor) {
  const texto = String(valor || '').split('\n').map(l => l.trim()).filter(Boolean).join('\n').slice(0, 4000);
  const ok = await _secMutar(d => { d.escalaServObs = Object.assign({}, d.escalaServObs, { [mes]: { texto, editadoEm: new Date().toISOString(), editadoPor: usuarioAtual ? usuarioAtual.nome : '' } }); },
    { action: 'sec_serv_obs', alvo: _secEscMesTxt(mes), detalhe: texto.replace(/\n/g, ' | ').slice(0, 200) });
  if (ok) { _mostrarToast('Observações da escala de serviço salvas.', 'sucesso'); _secEscAtualizar(); }
}
async function sec_servObsSugerir(mes) {
  if (!confirm('Trocar as observações de ' + _secEscMesTxt(mes) + ' pela sugestão feita das férias e licenças cadastradas? O texto editado será apagado.')) return;
  const ok = await _secMutar(d => { const o = Object.assign({}, d.escalaServObs); delete o[mes]; d.escalaServObs = o; }, { action: 'sec_serv_obs', alvo: _secEscMesTxt(mes), detalhe: 'voltou para a sugestão automática' });
  if (ok) { _mostrarToast('Observações refeitas pela sugestão.', 'sucesso'); _secEscAtualizar(); }
}

// ── Quadro "Escala de apoio" da escala de serviço: nomes FIXOS (pedido de 14/10/2026) ──
// Na 1ª vez que o mês (atual ou futuro) aparece com a escala de apoio montada, o quadro é copiado dela e fica guardado em
// cme_secretaria.escalaServApoio[mes]; mudar a escala de apoio depois NÃO muda este quadro (só editando aqui ou "copiar de novo").
function _secServSabados(mes, d) { return _secEscDatas(mes, d).filter(dt => d.escalaSabado.some(x => x.data === dt) || new Date(dt + 'T12:00:00').getDay() === 6); }
function _secServApoioCopia(mes, d) {
  const r = {};
  _secServSabados(mes, d).forEach(dt => { r[dt] = d.escalaSabado.filter(x => x.data === dt).sort((a, c) => a.local.localeCompare(c.local) || _secEscNome(a, d).localeCompare(_secEscNome(c, d))).map(x => _secServNomePapel(_secEscNome(x, d)) + ' – ' + x.local).join('\n'); });
  return r;
}
// o quadro do mês: o guardado; se ainda não há, uma cópia da escala de apoio (só para mostrar)
function _secServQuadroApoio(mes, d) { return Object.assign(_secServApoioCopia(mes, d), (d.escalaServApoio || {})[mes] || {}); }
const _secServApoioTentado = new Set();
function _secServApoioCongelar(mes) {
  const d = _secDados();
  if (mes < _secServAtual() || (d.escalaServApoio || {})[mes] || _secServApoioTentado.has(mes) || !d.escalaSabado.some(x => x.data.slice(0, 7) === mes)) return;
  _secServApoioTentado.add(mes);
  _secMutar(x => { if (x.escalaServApoio[mes]) return false; x.escalaServApoio = Object.assign({}, x.escalaServApoio, { [mes]: _secServApoioCopia(mes, x) }); })
    .then(ok => { if (ok) _secEscAtualizar(); });
}
function _secServHtmlQuadroApoio(mes, d) {
  const q = _secServQuadroApoio(mes, d), dts = Object.keys(q).sort(), fixo = !!(d.escalaServApoio || {})[mes];
  return '<div class="escx-sec">Escala de apoio do administrativo que sai na impressão <span style="font-weight:400;color:var(--mu)">(' + (fixo ? 'nomes guardados' : 'sugestão do apoio de sábado — ainda não guardada') + ')</span></div><div>'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px">'
    + '<div style="font-size:13px;color:var(--mu)">Edite direto nos campos (um nome por linha, ex.: BRUNA SANTOS – CME); o texto é salvo ao sair do campo. Mudar o apoio de sábado <b style="color:var(--tx)">não</b> muda este quadro.</div>'
    + '<button type="button" class="escx-btn" onclick="sec_servApoioRecopiar(\'' + mes + '\')">Copiar de novo do apoio de sábado</button></div>'
    + '<div class="escx-grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">'
    + dts.map(dt => '<div><div class="escx-rot" style="margin-bottom:4px">Dia ' + _secBR(dt) + '</div>'
      + '<textarea rows="5" onchange="sec_servApoioSalvar(\'' + mes + '\',\'' + dt + '\',this.value)" style="width:100%;padding:6px 8px;resize:vertical">' + esc(q[dt] || '') + '</textarea></div>').join('')
    + '</div></div>';
}
async function sec_servApoioSalvar(mes, dt, valor) {
  const txt = String(valor || '').split('\n').map(l => l.trim()).filter(Boolean).join('\n').slice(0, 1000);
  const ok = await _secMutar(d => {
    const atual = Object.assign(_secServApoioCopia(mes, d), d.escalaServApoio[mes] || {});
    d.escalaServApoio = Object.assign({}, d.escalaServApoio, { [mes]: Object.assign(atual, { [dt]: txt }) });
  }, { action: 'sec_serv_apoio', alvo: _secBR(dt), detalhe: txt.replace(/\n/g, '; ').slice(0, 200) });
  if (ok) _mostrarToast('Quadro de apoio da escala de serviço salvo.', 'sucesso');
}
async function sec_servApoioRecopiar(mes) {
  if (!confirm('Substituir o quadro de apoio da escala de serviço de ' + _secEscMesTxt(mes) + ' pelos nomes que estão agora na escala de apoio de sábado?')) return;
  const ok = await _secMutar(d => { d.escalaServApoio = Object.assign({}, d.escalaServApoio, { [mes]: _secServApoioCopia(mes, d) }); },
    { action: 'sec_serv_apoio', alvo: _secEscMesTxt(mes), detalhe: 'copiado de novo da escala de apoio' });
  if (ok) { _mostrarToast('Quadro atualizado.', 'sucesso'); _secEscAtualizar(); }
}

// ── Edição ────────────────────────────────────────────────────────────────────
// mês atual/futuro → muda o cadastro do servidor (e o registro do mês atual); mês passado → só o registro daquele mês
async function _secServAplicar(mes, sid, patch, audit) {
  const passado = mes < _secServAtual(), agora = new Date().toISOString(), por = usuarioAtual ? usuarioAtual.nome : '';
  const ok = await _secMutar(d => {
    const antes = _secServSetoresConhecidos(d, _secServLinhas(mes, d));
    d.config = Object.assign({}, d.config, { setoresAdm: [...new Set(antes.concat(patch.setor && !_SEC_SERV_NAO_SETOR.includes(patch.setor) ? [patch.setor] : []))] });
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
  ev.preventDefault(); if (ev.currentTarget) { ev.currentTarget.style.outline = ''; if (ev.currentTarget.classList) ev.currentTarget.classList.remove('escx-drop'); }
  const txt = ev.dataTransfer.getData('text/plain') || '', sid = txt.startsWith('escserv:') ? txt.slice(8) : '';
  const l = _secServLinhas(mes, _secDados())[sid]; if (!l) return;
  if (alvo.startsWith('G:')) {
    const g = alvo.slice(2); if (l.equipe === g) return;
    return _secServAplicar(mes, sid, { equipe: g, setor: 'Plantão', turno: '' }, { action: 'sec_serv_mover', detalhe: (l.equipe === 'EXPEDIENTE' ? _secServSetor(l) : l.equipe) + ' → ' + g + ' (' + _secEscMesTxt(mes) + ')' });
  }
  let setor = alvo.slice(2), turno;
  const barra = setor.lastIndexOf('|'); // "S:setor|M" = soltou na coluna de um turno (16/10/2026: tabela do setor administrativo)
  if (barra >= 0) { turno = setor.slice(barra + 1); setor = setor.slice(0, barra); }
  if (setor === '+') { setor = String(prompt('Nome do setor novo (ex.: Jurídico, Secretaria):') || '').trim(); if (!setor) return; }
  if (setor === _SEC_SERV_SEM_SETOR) setor = '';
  if (l.equipe === 'EXPEDIENTE' && (l.setor || '') === setor && (turno === undefined || (l.turno || '') === turno)) return;
  const patch = { equipe: 'EXPEDIENTE', setor, posto: '' }; if (turno !== undefined) patch.turno = turno;
  const turnoTxt = turno === undefined ? '' : ' · ' + (turno === 'M' ? 'manhã' : turno === 'T' ? 'tarde' : 'sem turno');
  return _secServAplicar(mes, sid, patch, { action: 'sec_serv_mover', detalhe: (l.equipe === 'EXPEDIENTE' ? _secServSetor(l) : l.equipe) + ' → ' + (setor || _SEC_SERV_SEM_SETOR) + turnoTxt + ' (' + _secEscMesTxt(mes) + ')' });
}
async function sec_servRemoverSetor(k) {
  const d0 = _secDados();
  if (d0.servidores.some(s => s.equipe === 'EXPEDIENTE' && _secServSetor(s) === k)) { _mostrarToast('Esse setor ainda tem servidor — mova os nomes antes.', 'erro'); return; }
  if (!confirm('Remover o setor "' + k + '" da escala de serviço?')) return;
  const ok = await _secMutar(d => { d.config = Object.assign({}, d.config, { setoresAdm: _secServSetoresConhecidos(d).filter(x => x !== k) }); },
    { action: 'sec_serv_setor', alvo: k, detalhe: 'setor removido da escala de serviço' });
  if (ok) _secEscAtualizar();
}
function sec_servPosto(mes, sid) {
  const l = _secServLinhas(mes, _secDados())[sid]; if (!l) return;
  const novo = l.posto === '1' ? '2' : '1';
  // mês atual/futuro grava no cadastro o posto do mês-base (o rodízio mensal faz o resto); mês passado grava o do próprio mês
  return _secServAplicar(mes, sid, { posto: mes < _secServAtual() ? novo : _secPostoNoMes(novo, mes) }, { action: 'sec_serv_posto', detalhe: 'Posto ' + (l.posto || '—') + ' → ' + novo });
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
  const setores = {}; _secServSetoresConhecidos(d, linhas).forEach(k => { setores[k] = []; });
  ids.filter(id => linhas[id].equipe === 'EXPEDIENTE').forEach(id => { const k = _secServSetor(linhas[id]); (setores[k] = setores[k] || []).push(id); });
  const ks = Object.keys(setores).filter(k => k !== _SEC_SERV_SEM_SETOR || setores[k].length).sort((a, c) => _secServOrdemSetor(a).localeCompare(_secServOrdemSetor(c)));
  const celNomes = k => setores[k].sort((a, c) => String(linhas[a].turno || 'Z').localeCompare(String(linhas[c].turno || 'Z')) || linhas[a].nome.localeCompare(linhas[c].nome)).map(id => '<span style="white-space:nowrap">PP. ' + esc(_secServNomePapel(linhas[id].nome)) + (linhas[id].turno ? ' (' + esc(linhas[id].turno) + ')' : '') + '</span>').join('<br>');
  let tabS = '<table style="width:100%;border-collapse:collapse;font-size:8pt"><tr><th colspan="4" style="' + b + ';background:#e7e7e7;font-size:9.5pt">SETOR ADMINISTRATIVO: <span style="font-weight:normal">Manhã (M) - Tarde (T)</span></th></tr>';
  for (let i = 0; i < ks.length; i += 2) tabS += '<tr>' + [ks[i], ks[i + 1]].map(k => k ? '<td style="' + b + ';background:#e7e7e7;font-weight:bold;text-align:center;width:22%">' + esc(k) + ':</td><td style="' + b + ';width:28%">' + celNomes(k) + '</td>' : '<td style="' + b + '"></td><td style="' + b + '"></td>').join('') + '</tr>';
  tabS += '</table>';
  // escala de apoio do administrativo (sábados)
  const quadro = _secServQuadroApoio(mes, d), sabs = Object.keys(quadro).sort();
  const nomesSab = dt => esc(quadro[dt] || '').replace(/\n/g, '<br>');
  const tabA = '<table style="width:100%;border-collapse:collapse;font-size:7.5pt"><tr><th colspan="' + sabs.length + '" style="' + b + ';background:#e7e7e7;font-size:8.5pt">ESCALA DE APOIO DO ADMINISTRATIVO<br>Horário: ' + esc(cfg.escalaHorario || _SEC_ESC_HORARIO) + '</th></tr>'
    + '<tr>' + sabs.map(dt => '<th style="' + b + '">DIA: ' + _secBR(dt) + '</th>').join('') + '</tr><tr>' + sabs.map(dt => '<td style="' + b + ';vertical-align:top">' + nomesSab(dt) + '</td>').join('') + '</tr></table>';
  // observações: o texto editado do mês ou, sem edição, a sugestão (férias, licenças… do mês)
  const obs = _secServObsHtml(_secServObsTexto(mes, d));
  // data: o dia em que o documento é gerado
  const dataTxt = _secDataEmissao();
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="color-scheme" content="light"><title>Escala de Serviço - ' + MESES[mesNum - 1] + '/' + ano + '</title>'
    + '<style>html,body{background:#fff}@page{size:A4 landscape;margin:8mm 10mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0;font-size:9pt}@media screen{body{padding:12px 18px}}@media print{.np{display:none}}</style></head><body>'
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
Object.assign(_SEC_ACOES, { sec_serv_mover: 'Mudou servidor de guarnição/setor na escala de serviço', sec_serv_posto: 'Trocou o posto na escala de serviço', sec_serv_turno: 'Trocou o turno na escala de serviço', sec_serv_imprimir: 'Imprimiu a escala de serviço', sec_serv_apoio: 'Editou o quadro de apoio da escala de serviço', sec_serv_setor: 'Removeu setor da escala de serviço', sec_serv_obs: 'Editou as observações da escala de serviço' });
