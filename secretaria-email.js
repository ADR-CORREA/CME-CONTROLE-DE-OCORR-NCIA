/* ═══════════ ENTRADA E-MAIL (Secretaria › Agenda e Documentos) ═══════════
   Fila dos e-mails que chegaram à caixa da CME, para receber e tratar — mesmo jeito da Entrada PRODOC.
   Pedido de 21/10/2026. Fase 1: fila + marcação + resposta preparada. A leitura da IA vem na fase 2 (espaço já reservado).
   • Dados do robô: chave cme_secretaria_bk_email. Lida só quando a aba abre — não vem no login.
   • Só vêm e-mails JÁ ABERTOS no webmail (decisão do Adriano); os não abertos chegam só como contagem (naoLidos).
   • Marcações da Secretaria: cme_secretaria.email = { id: { st: 'enc'|'resp'|'ciencia'|'res', por, em, nota } }.
   • O sistema NÃO envia e-mail (decisão dele): "Preparar resposta" só monta o texto para copiar e colar no webmail.
   • O corpo do e-mail é texto cru e pode ter <script>: TODO texto do pacote passa por esc(); dentro de onclick, por _jsq().
   Emojis só por \u{...}. Prefixo _secEm / sec_em. */

const _SEC_EM_CHAVE = 'cme_secretaria_bk_email';
const _SEC_EM_ATRASO_H = 2; // robô sem ler há mais que isso (entre 8h e 21h) → aviso no cabeçalho
// situação → [rótulo, classe do idv-etq]
const _SEC_EM_SIT = { novo: ['A tratar', 'at'], enc: ['Encaminhado', 'ne'], resp: ['Respondido', 'in'], ciencia: ['Ciência (aviso)', 'ne'], res: ['Resolvido', 'ok'] };
const _SEC_EM_SETORES = ['Plantão', 'Jurídico', 'Psicossocial', 'Relatórios', 'Comunicação Processual', 'Administrativo', 'Estatística', 'Gerência'];
const _SEC_EM_MODELOS = [['rec', 'Confirmação de recebimento'], ['enc', 'Encaminhado ao setor'], ['info', 'Informação prestada']];

// Origem do e-mail pelo NOME e pelo DOMÍNIO do remetente. A 1ª regra que casar vence; a última ("Outros") pega o resto.
// Para ajustar: acrescente palavras no "nome" (sem acento, em maiúsculas) ou domínios no "dominio".
const _SEC_EM_ORIGENS = [
  { k: 'erro', rot: 'Erro de entrega', nome: /MAILER-DAEMON|MAIL DELIVERY|POSTMASTER|UNDELIVER|DELIVERY STATUS/, email: /^(mailer-daemon|postmaster)@/ },
  { k: 'ue', rot: 'UE Tecnologia', nome: /\bUE\s*TECNOLOGIA\b|^UE\b/, dominio: /uetecnologia|uetec/ },
  { k: 'ccep', rot: 'CCEP', nome: /\bCCEP\b/, dominio: /ccep/ },
  { k: 'judiciario', rot: 'Judiciário', nome: /\bVARA\b|JUIZ|TRIBUNAL|PLANTAO CRIMINAL|\bTJ\b|\bTJAP\b|\bVEP\b|EXECUCAO PENAL|JUSTICA FEDERAL|\bTRF\b|FORUM|COMARCA/, dominio: /\.jus\.br$/ },
  { k: 'orgaos', rot: 'Órgãos', nome: /PREFEITURA|DEFENSORIA|\bDPE|SENAPPEN|MINISTERIO|\bMJ\b|\bMJSP\b|POLICIA|DELEGACIA|\bSEJUSP\b|\bPM\b|\bPC\b|\bPRF\b|\bPF\b|\bMP\b/,
    dominio: /\.def\.br$|\.mp\.br$|mj\.gov\.br$|pf\.gov\.br$|prf\.gov\.br$|prefeitura|santana\.ap\.gov\.br$|macapa\.ap\.gov\.br$|pc\.ap\.gov\.br$|pm\.ap\.gov\.br$/ },
  { k: 'outros', rot: 'Outros' }
];

let _secEmPacote = null, _secEmCarregando = null, _secEmErro = '';
let _secEmMes = '', _secEmFSit = null, _secEmFOrig = 'todos', _secEmSel = null, _secEmVisiveis = [];
let _secEmMarcados = new Set(); // seleção em lote (ids)
const _secEmResp = {};          // id → { modelo, setor, compl, copiou } — só na memória da tela
const _secEmMesTela = () => _secEmMes || _secHoje().slice(0, 7);
const _secEmIdOk = id => /^\d{1,12}-\d{1,12}$/.test(String(id || '')); // <uidValidity>-<uid>
const _secEmNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const _secEmP2 = n => String(n).padStart(2, '0');

// ISO com fuso → 'AAAA-MM-DDTHH:MM' na hora LOCAL (o mês da fila é o do relógio da CME)
function _secEmLocal(iso) {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.getFullYear() + '-' + _secEmP2(d.getMonth() + 1) + '-' + _secEmP2(d.getDate()) + 'T' + _secEmP2(d.getHours()) + ':' + _secEmP2(d.getMinutes());
}
function _secEmBR(loc, curto) { const m = String(loc || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/); return m ? m[3] + '/' + m[2] + (curto ? '' : '/' + m[1]) + ' ' + m[4] : ''; }
function _secEmTam(n) { n = +n || 0; return n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1).replace('.', ',') + ' MB'; }
// endereço do pacote: texto ou { nome, email }
function _secEmEnd(x) {
  if (!x) return '';
  if (typeof x === 'string') return x;
  const nome = String(x.nome || '').trim(), em = String(x.email || '').trim();
  return nome && em ? nome + ' <' + em + '>' : nome || em;
}
const _secEmRemetente = e => String((e.de && (e.de.nome || e.de.email)) || '').trim() || '(remetente não informado)';
const _secEmUid = e => /^\d+$/.test(String(e.uid)) ? String(e.uid) : String(e.id).split('-')[1];
const _secEmLink = e => 'https://webmail.amapa.gov.br/?_task=mail&_mbox=INBOX&_uid=' + _secEmUid(e) + '&_action=show';

function _secEmOrigem(e) {
  const de = e.de || {}, nome = _secEmNorm(de.nome), email = String(de.email || '').toLowerCase().trim(), dom = email.split('@')[1] || '';
  const r = _SEC_EM_ORIGENS.find(o => !o.nome && !o.dominio && !o.email
    || (o.nome && (o.nome.test(nome) || o.nome.test(_secEmNorm(email))))
    || (o.dominio && dom && o.dominio.test(dom)) || (o.email && o.email.test(email)));
  return r ? r.k : 'outros';
}
const _secEmOrigRot = k => (_SEC_EM_ORIGENS.find(o => o.k === k) || {}).rot || 'Outros';

async function _secEmCarregar(forcar) {
  if (_secEmCarregando) return _secEmCarregando;
  if (_secEmPacote && !forcar) return _secEmPacote;
  _secEmCarregando = (async () => {
    try {
      const r = await _dbLerChave(_SEC_EM_CHAVE);
      if (r.error) throw r.error;
      const v = (r.data && r.data.value) || {}, vistos = new Set();
      // só entra e-mail com id no formato do robô e data válida; id repetido entra uma vez
      const emails = (Array.isArray(v.emails) ? v.emails : []).filter(e => e && _secEmIdOk(e.id) && _secEmLocal(e.data) && !vistos.has(e.id) && vistos.add(e.id))
        .map(e => Object.assign({}, e, { _loc: _secEmLocal(e.data) }));
      _secEmPacote = { geradoEm: v.geradoEm || '', caixa: String(v.caixa || 'INBOX'), dias: +v.dias || 0, naoLidos: Math.max(0, parseInt(v.naoLidos, 10) || 0),
        emails, ia: (v.ia && typeof v.ia === 'object' && !Array.isArray(v.ia)) ? v.ia : {} };
      _secEmErro = '';
    } catch (e) { _secEmErro = 'Não consegui ler o banco do CME (' + (e.message || e) + ').'; }
    _secEmCarregando = null;
    return _secEmPacote;
  })();
  return _secEmCarregando;
}

// situação: a marcação da Secretaria vence; sem marcação, o que o webmail diz; erro de entrega já entra como aviso
function _secEmSituacao(e, orig, marca) {
  if (marca && _SEC_EM_SIT[marca.st]) return marca.st;
  if (e.respondido === true) return 'resp';
  if (e.encaminhado === true) return 'enc';
  return orig === 'erro' ? 'ciencia' : 'novo';
}
// mes: 'AAAA-MM' (padrão: o mês na tela) ou '*' para todos
function _secEmLinhas(mes) {
  const p = _secEmPacote || { emails: [] }, marcas = _secDados().email, m = mes || _secEmMesTela();
  return p.emails.filter(e => m === '*' || e._loc.slice(0, 7) === m).map(e => {
    const orig = _secEmOrigem(e), mk = marcas[e.id], marca = mk && typeof mk === 'object' && _SEC_EM_SIT[mk.st] ? mk : null; // marca estranha no banco é ignorada
    return { e, orig, marca, sit: _secEmSituacao(e, orig, marca) };
  });
}
const _secEmCasaSit = (sit, f) => f === 'todos' || sit === f || (f === 'fim' && (sit === 'res' || sit === 'ciencia'));
const _secEmLoteOk = l => !(l.marca && (l.marca.st === 'res' || l.marca.st === 'ciencia'));

function sec_renderEmail() {
  const c = document.getElementById('sec-conteudo'); if (!c) return;
  if (!_secEmPacote && !_secEmErro) {
    c.innerHTML = '<div class="idv-vazio">Lendo a fila do e-mail…</div>';
    _secEmCarregar().then(() => { if (_secAba === 'email' && !_secPerfilId) sec_renderEmail(); });
    return;
  }
  if (!_secEmPacote) { c.innerHTML = '<div class="idv-faixa cr">' + esc(_secEmErro) + ' <button class="idv-btn mini" onclick="sec_emAtualizar()">Tentar de novo</button></div>'; return; }
  const linhas = _secEmLinhas(), conta = f => linhas.filter(l => _secEmCasaSit(l.sit, f)).length;
  if (!_secEmFSit) _secEmFSit = conta('novo') ? 'novo' : 'todos';
  const porSit = linhas.filter(l => _secEmCasaSit(l.sit, _secEmFSit));
  // indicador = filtro de situação (clicar de novo no ativo mostra todas); só o número em tinta escura, como no guia
  const kpi = (f, rot) => '<button type="button" class="idv-kpi" aria-pressed="' + (f === _secEmFSit) + '" onclick="sec_emFiltroSit(\'' + f + '\')"'
    + (f === _secEmFSit ? ' style="border-color:var(--idv-cab);box-shadow:inset 0 0 0 1px var(--idv-cab)"' : '') + '><div class="idv-num">' + conta(f) + '</div><div class="idv-rot">' + rot + '</div></button>';
  const novos = linhas.filter(l => l.sit === 'novo').sort((a, b) => a.e._loc.localeCompare(b.e._loc));
  c.innerHTML = _secEmCabecalho(_secEmPacote) + _secEmNavMes()
    + (novos.length ? '<div class="idv-achado" style="margin-top:10px"><b class="cr">' + novos.length + ' a tratar</b> neste mês <span class="idv-sec">— o mais antigo chegou em ' + _secEmBR(novos[0].e._loc) + '</span></div>' : '')
    + '<div class="idv-kpis" style="margin:12px 0 10px">' + kpi('novo', 'A tratar') + kpi('enc', 'Encaminhados') + kpi('resp', 'Respondidos') + kpi('fim', 'Resolvidos / ciência') + '</div>'
    + (_secEmFSit !== 'todos' ? '<div style="font-size:13px;color:var(--idv-sec);margin-bottom:8px">Mostrando só a situação escolhida no indicador · <a href="#" class="idv-link" onclick="sec_emFiltroSit(\'todos\');return false">ver todas as situações (' + linhas.length + ')</a></div>' : '')
    + '<div class="idv-chips" style="margin-bottom:10px">' + [['todos', 'Todas as origens']].concat(_SEC_EM_ORIGENS.map(o => [o.k, o.rot])).map(([k, r]) =>
      '<button type="button" class="idv-chip' + (k === _secEmFOrig ? ' ativo' : '') + '" onclick="sec_emFiltroOrig(\'' + k + '\')">' + esc(r)
      + ' <span class="idv-n">' + (k === 'todos' ? porSit.length : porSit.filter(l => l.orig === k).length) + '</span></button>').join('') + '</div>'
    // lista e e-mail lado a lado (como a Entrada PRODOC); em tela estreita, um embaixo do outro
    + '<style>.secem-split{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(380px,1fr);gap:12px;align-items:start}'
    + '.secem-col-det{position:sticky;top:8px;max-height:calc(100vh - 16px);overflow:auto}.secem-split .table-scroll{max-height:calc(100vh - 120px)!important}'
    + '.secem-lista{container-type:inline-size}@container (max-width:560px){.secem-lista th:nth-child(5),.secem-lista td:nth-child(5){display:none}}'
    + '@media(max-width:980px){.secem-split{grid-template-columns:1fr}.secem-col-det{position:static;max-height:none}.secem-split .table-scroll{max-height:48vh!important}}</style>'
    + '<div class="secem-split"><div class="secem-lista" style="min-width:0"><div id="secem-lote"></div>' + _secEmTabela(porSit) + '</div>'
    + '<div id="secem-detalhe" class="secem-col-det"></div></div>';
  _secEmRenderLote();
  _secEmRenderDetalhe();
}

function _secEmCabecalho(p) {
  const ger = _secEmLocal(p.geradoEm), h = ger ? (new Date() - new Date(p.geradoEm)) / 3600e3 : null, hora = new Date().getHours();
  const atrasado = h !== null && h > _SEC_EM_ATRASO_H && hora >= 8 && hora < 21, n = p.naoLidos;
  return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:14px;color:var(--idv-sec)">'
    + '<div>Robô do e-mail: ' + (ger ? 'última leitura <b class="idv-data" style="color:var(--idv-texto)">' + _secEmBR(ger) + '</b>' : '<b>ainda não rodou</b>')
    + (atrasado ? ' · <span style="color:var(--idv-cr);font-weight:600">sem ler há ' + Math.floor(h) + ' h</span>' : '')
    + ' · caixa ' + esc(p.caixa) + (p.dias ? ' · guarda os últimos ' + p.dias + ' dias' : '') + ' · só entram e-mails já abertos no webmail</div>'
    + '<button class="idv-btn mini" onclick="sec_emAtualizar()">Atualizar</button></div>'
    + (n ? '<div class="idv-faixa in" style="margin-top:10px;padding:8px 12px;font-size:14px">' + n + (n > 1 ? ' e-mails ainda não abertos' : ' e-mail ainda não aberto')
      + ' no webmail — entram aqui depois de abertos.</div>' : '');
}

function _secEmNavMes() {
  const m = _secEmMesTela(), atual = m >= _secHoje().slice(0, 7);
  const meses = ((_secEmPacote || {}).emails || []).map(e => e._loc.slice(0, 7)).sort(), primeiro = meses[0] || m;
  // "a tratar" em QUALQUER mês anterior ao da tela; o link leva ao mais recente deles
  const pend = _secEmLinhas('*').filter(l => l.sit === 'novo' && l.e._loc.slice(0, 7) < m), mesPend = pend.map(l => l.e._loc.slice(0, 7)).sort().pop();
  const bt = (rot, alvo, desligado) => '<button type="button" class="idv-btn mini"' + (desligado ? ' disabled style="opacity:.45;cursor:default"' : ' onclick="sec_emMes(\'' + alvo + '\')"') + '>' + rot + '</button>';
  return '<div style="display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap">' + bt('\u{2039} Mês anterior', _sprdMesSoma(m, -1), m <= primeiro)
    + '<b style="min-width:150px;text-align:center;font-size:15px;color:var(--idv-texto)">' + esc(_sprdMesRotulo(m)) + '</b>' + bt('Próximo mês \u{203A}', _sprdMesSoma(m, 1), atual)
    + (atual ? '' : bt('Voltar ao mês atual', '', false))
    + (pend.length ? '<a href="#" onclick="sec_emMes(\'' + mesPend + '\');return false" style="font-size:14px;color:var(--idv-at);font-weight:600">'
      + pend.length + ' a tratar em meses anteriores — ver ' + esc(_sprdMesRotulo(mesPend).toLowerCase()) + '</a>' : '') + '</div>';
}

// faixa à esquerda (a situação vai na faixa, a linha não é pintada)
const _secEmFaixa = l => l.sit === 'novo' ? 'inset 3px 0 0 var(--idv-at)' : l.sit === 'res' ? 'inset 3px 0 0 var(--idv-ok)' : '';
const _SEC_EM_SEL_FAIXA = 'inset 3px 0 0 var(--idv-in)';

function _secEmTabela(porSit) {
  const vis = porSit.filter(l => _secEmFOrig === 'todos' || l.orig === _secEmFOrig).sort((a, b) => b.e._loc.localeCompare(a.e._loc));
  _secEmVisiveis = vis.map(l => l.e.id);
  if (vis.length && !_secEmVisiveis.includes(_secEmSel)) _secEmSel = vis[0].e.id;
  if (!vis.length) _secEmSel = null;
  const lote = vis.filter(_secEmLoteOk), todos = lote.length && lote.every(l => _secEmMarcados.has(l.e.id));
  return '<div class="table-scroll" style="max-height:48vh"><table class="data-table idv-tabela"><thead><tr>'
    + '<th style="width:28px">' + (lote.length ? '<input type="checkbox" aria-label="Selecionar todos desta lista" title="Selecionar todos desta lista"' + (todos ? ' checked' : '') + ' onclick="sec_emSelTodos(this)">' : '') + '</th>'
    + '<th>Situação</th><th>Recebido</th><th>E-mail</th><th>Anexos</th></tr></thead><tbody>'
    + (vis.length ? vis.map(l => {
      const e = l.e, [rot, cls] = _SEC_EM_SIT[l.sit], faixa = _secEmFaixa(l), sel = e.id === _secEmSel, idq = _jsq(e.id), n = Array.isArray(e.anexos) ? e.anexos.filter(a => a && typeof a === 'object').length : 0;
      const webmail = !l.marca && (l.sit === 'resp' || l.sit === 'enc') ? '<div class="idv-mini" style="margin-top:2px">no webmail</div>' : '';
      return '<tr data-secem="' + esc(e.id) + '" data-faixa="' + faixa + '" style="cursor:pointer;' + (sel ? 'background:var(--idv-in-f);box-shadow:' + _SEC_EM_SEL_FAIXA : faixa ? 'box-shadow:' + faixa : '') + '" onclick="sec_emSel(\'' + idq + '\')">'
        + '<td onclick="event.stopPropagation()">' + (_secEmLoteOk(l) ? '<input type="checkbox" aria-label="Selecionar"' + (_secEmMarcados.has(e.id) ? ' checked' : '') + ' onclick="sec_emMarcarSel(\'' + idq + '\',event)">' : '') + '</td>'
        + '<td><span class="idv-etq ' + cls + '">' + rot + '</span>' + webmail + '</td>'
        + '<td class="idv-data" style="white-space:nowrap">' + _secEmBR(e._loc, true) + '</td>'
        + '<td style="min-width:0"><div style="font-weight:600;overflow-wrap:anywhere">' + (esc(String(e.assunto || '').trim()) || '(sem assunto)') + '</div>'
        + '<div class="idv-mini" style="overflow-wrap:anywhere">' + esc(_secEmRemetente(e)) + ' · ' + esc(_secEmOrigRot(l.orig)) + '</div></td>'
        + '<td class="idv-data">' + (n || '—') + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="idv-vazio">Nenhum e-mail aqui.</td></tr>')
    + '</tbody></table></div>';
}

// ── painel do e-mail escolhido ──
const _SEC_EM_ROT = 'font-size:12px;font-weight:600;color:var(--idv-sec)';
function _secEmRenderDetalhe() {
  const box = document.getElementById('secem-detalhe'); if (!box) return;
  const l = _secEmSel ? _secEmLinhas().find(x => x.e.id === _secEmSel) : null;
  if (!l) { box.innerHTML = ''; return; }
  const e = l.e, [rot, cls] = _SEC_EM_SIT[l.sit], m = l.marca, idq = _jsq(e.id), anexos = Array.isArray(e.anexos) ? e.anexos.filter(a => a && typeof a === 'object') : [];
  const lista = v => (Array.isArray(v) ? v : v ? [v] : []).map(_secEmEnd).filter(Boolean);
  const campo = (rotulo, txt) => txt ? '<div style="display:flex;gap:8px;font-size:14px;margin-top:2px"><span style="' + _SEC_EM_ROT + ';min-width:36px;padding-top:1px">' + rotulo + '</span><span style="min-width:0;overflow-wrap:anywhere">' + txt + '</span></div>' : '';
  const sec = titulo => '<div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--idv-linha);font-size:14px;font-weight:600;color:var(--idv-texto)">' + titulo + '</div>';
  let h = '<div class="idv-bloco"><div class="idv-bloco-cab"><span>E-mail · ' + esc(_secEmOrigRot(l.orig)) + '</span><span class="idv-data">' + _secEmBR(e._loc) + '</span></div><div style="padding:12px 16px 16px">'
    + '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">'
    + '<div class="idv-nome" style="font-size:16px;min-width:0;overflow-wrap:anywhere">' + (esc(String(e.assunto || '').trim()) || '(sem assunto)') + '</div><span class="idv-etq ' + cls + '">' + rot + '</span></div>'
    + '<div style="margin-top:8px">' + campo('De', esc(_secEmEnd(e.de) || '(remetente não informado)')) + campo('Para', esc(lista(e.para).join(', '))) + campo('Cc', esc(lista(e.cc).join(', ')))
    + campo('Data', '<span class="idv-data">' + _secEmBR(e._loc) + '</span>') + '</div>'
    + (!m && e.respondido === true ? '<div style="font-size:13px;color:var(--idv-in);margin-top:6px">Respondido no webmail.</div>' : '')
    + (!m && e.encaminhado === true && e.respondido !== true ? '<div style="font-size:13px;color:var(--idv-sec);margin-top:6px">Encaminhado no webmail.</div>' : '')
    + _secEmBlocoIA(e)
    + (l.orig === 'erro' ? '<div class="idv-faixa at" style="margin-top:10px;padding:8px 12px;font-size:14px">Aviso automático do servidor de e-mail: uma mensagem enviada pela CME não chegou ao destino. Veja no texto qual endereço falhou e, se for preciso, reenvie pelo webmail.</div>' : '')
    + sec('Texto do e-mail')
    + (String(e.texto || '').trim() ? '<div style="white-space:pre-wrap;overflow-wrap:anywhere;background:var(--idv-zebra);border:1px solid var(--idv-borda);border-radius:6px;padding:10px 12px;margin-top:6px;font-size:14px;line-height:1.5;color:var(--idv-texto);max-height:320px;overflow:auto">' + esc(e.texto) + '</div>'
      : '<div class="idv-mini" style="margin-top:4px">Sem texto (veja no webmail).</div>')
    + (e.temMais ? '<div style="font-size:13px;color:var(--idv-at);font-weight:600;margin-top:4px">O texto veio cortado — leia o restante no webmail.</div>' : '')
    + sec('Anexos' + (anexos.length ? ' (' + anexos.length + ')' : ''))
    + (anexos.length ? '<ul style="margin:6px 0 0;padding-left:18px;font-size:14px">' + anexos.map(a => '<li style="overflow-wrap:anywhere">' + (esc(a.nome) || '(sem nome)')
      + ' <span class="idv-mini">' + esc(a.tipo || '') + (a.tam ? ' · ' + _secEmTam(a.tam) : '') + '</span></li>').join('') + '</ul>'
      + '<div class="idv-mini" style="margin-top:4px">Aqui só aparecem nome, tipo e tamanho: o arquivo fica no webmail.</div>'
      : '<div class="idv-mini" style="margin-top:4px">Sem anexos.</div>')
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'
    + '<a class="idv-btn mini" style="text-decoration:none" href="' + _secEmLink(e) + '" target="_blank" rel="noopener noreferrer">Abrir no webmail \u{2197}</a>'
    + (anexos.length ? '<a class="idv-btn mini" style="text-decoration:none" href="' + _secEmLink(e) + '" target="_blank" rel="noopener noreferrer">Ver anexos no webmail \u{2197}</a>' : '') + '</div>';
  if (l.orig !== 'erro') h += sec('Preparar resposta') + _secEmBlocoResposta(l);
  h += sec('Situação');
  if (m) h += '<div style="font-size:14px;margin-top:4px">' + esc(_SEC_EM_SIT[m.st][0]) + ' por ' + esc(m.por || '?') + ' em <span class="idv-data">' + esc(_secEmBR(m.em)) + '</span>' + (m.nota ? ' · "' + esc(m.nota) + '"' : '') + '</div>';
  const copiou = !!(_secEmResp[e.id] && _secEmResp[e.id].copiou) && l.sit !== 'resp';
  // o botão da situação já marcada some; depois de copiar a resposta, "Já respondi" fica em destaque (verde)
  const bt = (st, rotulo, verde, attrs) => l.sit === st && m ? '' : '<button class="idv-btn mini' + (verde ? ' concluir' : '') + '"' + (attrs || '') + ' onclick="sec_emMarcar(\'' + idq + '\',\'' + st + '\')">' + rotulo + '</button>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px">'
    + '<input id="secem-nota" aria-label="Nota" placeholder="Nota: o que foi feito, para quem foi (opcional)" maxlength="300" style="flex:1 1 100%;height:32px;padding:0 10px;border:1px solid var(--idv-borda);border-radius:6px;font-size:14px">'
    + bt('enc', 'Encaminhei', false)
    + bt('resp', 'Já respondi', copiou, ' id="secem-jaresp"' + (copiou ? ' style="box-shadow:0 0 0 3px var(--idv-ok-f)"' : ''))
    + bt('ciencia', 'Dar ciência', true) + bt('res', 'Resolvido', true)
    + (m ? '<button class="idv-btn mini" onclick="sec_emMarcar(\'' + idq + '\',\'\')">Desfazer marcação</button>' : '') + '</div>';
  const y = box.scrollTop; box.innerHTML = h + '</div></div>'; box.scrollTop = y;
}

// "Leitura da IA" — FASE 2: só aparece quando o robô mandar ia[id]; até lá fica escondido
function _secEmBlocoIA(e) {
  const ia = ((_secEmPacote || {}).ia || {})[e.id];
  if (!ia || typeof ia !== 'object') return '';
  const lin = (rot, txt) => txt ? '<div style="margin-top:4px;font-size:14px"><b style="font-size:12px;color:var(--idv-sec)">' + rot + ':</b> ' + esc(txt) + '</div>' : '';
  const faixa = ia.confianca && typeof lc_faixa === 'function' ? lc_faixa({ confianca: ia.confianca, avisos: ia.avisos, duvidas: ia.duvidas, alternativa: ia.alternativa }, { verbo: 'tratar' }) : '';
  return '<div style="margin-top:10px;padding:10px 12px;background:var(--idv-de-f);border-left:3px solid var(--idv-de);border-radius:0 6px 6px 0">'
    + '<div style="font-size:12px;font-weight:600;color:var(--idv-de)">Leitura da IA</div>'
    + '<div style="font-weight:600;margin-top:2px">' + esc(ia.providencia || ia.resumo || '—') + '</div>'
    + lin('Setor', ia.responsavel) + lin('Prazo', ia.prazo) + (faixa ? '<div style="margin-top:8px">' + faixa + '</div>' : '') + '</div>';
}

// ── "Preparar resposta": monta o texto; NADA é enviado daqui ──
function _secEmRespEstado(id) { return _secEmResp[id] || (_secEmResp[id] = { modelo: 'rec', setor: _SEC_EM_SETORES[0], compl: '', copiou: false }); }
function _secEmAssinatura() {
  const u = usuarioAtual || {}, us = typeof getUsuarios === 'function' ? (getUsuarios() || []) : [];
  const cargo = String(u.cargo || (us.find(x => x && u.usuario && x.usuario === u.usuario) || {}).cargo || '').trim();
  return [String(u.nome || '').trim(), cargo, 'Central de Monitoramento Eletrônico – CME/IAPEN'].filter(Boolean).join('\n');
}
function _secEmRespTexto(e, st) {
  const ref = 'o e-mail "' + (String(e.assunto || '').trim() || 'sem assunto') + '", recebido em ' + _secBR(e._loc);
  const compl = String(st.compl || '').trim();
  const corpo = st.modelo === 'enc' ? 'Acusamos o recebimento d' + ref + ', e informamos que a demanda foi encaminhada ao setor ' + st.setor + ' desta Central, para as providências cabíveis.'
    : st.modelo === 'info' ? 'Em atenção a' + ref + ', informamos que ' + (compl ? compl.replace(/[.\s]+$/, '') + '.' : '[escreva aqui a informação].')
    : 'Acusamos o recebimento d' + ref + ', que será analisado por esta Central.';
  return 'Prezados(as),\n\n' + corpo + '\n\nAtenciosamente,\n\n' + _secEmAssinatura();
}
function _secEmBlocoResposta(l) {
  const e = l.e, idq = _jsq(e.id), st = _secEmRespEstado(e.id);
  return '<div class="idv-mini" style="margin-top:4px">O sistema não envia nada: copie o texto, responda pelo webmail e depois marque <b>Já respondi</b>.</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'
    + '<select class="idv-select" aria-label="Modelo da resposta" style="flex:1;min-width:200px" onchange="sec_emRespModelo(\'' + idq + '\',this.value)">'
    + _SEC_EM_MODELOS.map(([k, r]) => '<option value="' + k + '"' + (k === st.modelo ? ' selected' : '') + '>' + r + '</option>').join('') + '</select>'
    + (st.modelo === 'enc' ? '<select class="idv-select" aria-label="Setor" style="flex:1;min-width:160px" onchange="sec_emRespSetor(\'' + idq + '\',this.value)">'
      + _SEC_EM_SETORES.map(s => '<option' + (s === st.setor ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select>' : '') + '</div>'
    + (st.modelo === 'info' ? '<input aria-label="Informação" placeholder="Informação a prestar (ex.: o monitorado está com a tornozeleira ativa desde 10/10/2026)" maxlength="600" value="' + esc(st.compl) + '" oninput="sec_emRespCompl(\'' + idq + '\',this.value)" style="width:100%;height:32px;margin-top:8px;padding:0 10px;border:1px solid var(--idv-borda);border-radius:6px;font-size:14px;box-sizing:border-box">' : '')
    + '<div id="secem-r-prev" style="white-space:pre-wrap;overflow-wrap:anywhere;background:var(--idv-zebra);border:1px solid var(--idv-borda);border-radius:6px;padding:10px 12px;margin-top:8px;font-size:14px;line-height:1.5;color:var(--idv-texto)">' + esc(_secEmRespTexto(e, st)) + '</div>'
    + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px"><button class="idv-btn mini criar" onclick="sec_emRespCopiar(\'' + idq + '\')">Copiar resposta</button>'
    + (st.copiou && l.sit !== 'resp' ? '<span id="secem-r-copiado" style="font-size:14px;color:var(--idv-ok);font-weight:600">Copiado. Responda no webmail (Ctrl+V) e clique em Já respondi.</span>' : '') + '</div>';
}
const _secEmAchar = id => ((_secEmPacote || {}).emails || []).find(x => x.id === id) || null;
function sec_emRespModelo(id, v) { const st = _secEmRespEstado(id); st.modelo = _SEC_EM_MODELOS.some(m => m[0] === v) ? v : 'rec'; st.copiou = false; _secEmRenderDetalhe(); }
function sec_emRespSetor(id, v) { const st = _secEmRespEstado(id); st.setor = _SEC_EM_SETORES.includes(v) ? v : _SEC_EM_SETORES[0]; st.copiou = false; _secEmRenderDetalhe(); }
// atualiza só a prévia (sem redesenhar, para não perder o foco do campo)
function sec_emRespCompl(id, v) {
  const st = _secEmRespEstado(id), e = _secEmAchar(id); if (!e) return;
  st.compl = String(v || '').slice(0, 600);
  if (st.copiou) { st.copiou = false; const a = document.getElementById('secem-r-copiado'); if (a) a.remove(); }
  const p = document.getElementById('secem-r-prev'); if (p) p.textContent = _secEmRespTexto(e, st);
}
async function sec_emRespCopiar(id) {
  const st = _secEmRespEstado(id), e = _secEmAchar(id); if (!e) return;
  try { await navigator.clipboard.writeText(_secEmRespTexto(e, st)); }
  catch (err) { _mostrarToast('Não consegui copiar automaticamente — selecione o texto e use Ctrl+C.', 'erro'); return; }
  _mostrarToast('Resposta copiada — cole no webmail (Ctrl+V).', 'sucesso');
  auditar({ modulo: 'Secretaria', action: 'sec_email_resp_copiar', alvo: String(e.assunto || '').slice(0, 80), detalhe: 'Entrada E-mail · ' + (_SEC_EM_MODELOS.find(m => m[0] === st.modelo) || [])[1] });
  st.copiou = true; _secEmRenderDetalhe(); // destaca "Já respondi"
}

// ── seleção em lote: Dar ciência / Resolvido ──
function _secEmRenderLote() {
  const box = document.getElementById('secem-lote'); if (!box) return;
  const ids = [..._secEmMarcados].filter(id => _secEmVisiveis.includes(id));
  box.innerHTML = ids.length ? '<div class="idv-faixa" style="margin-bottom:10px;padding:8px 12px;font-size:14px;flex-wrap:wrap">'
    + '<b>' + ids.length + ' selecionado' + (ids.length > 1 ? 's' : '') + '</b>'
    + '<button type="button" class="idv-btn mini concluir" onclick="sec_emLote(\'ciencia\')">Dar ciência</button>'
    + '<button type="button" class="idv-btn mini concluir" onclick="sec_emLote(\'res\')">Resolvido</button>'
    + '<button type="button" class="idv-btn mini" onclick="sec_emLimparSel()">Limpar seleção</button></div>' : '';
}
function sec_emMarcarSel(id, ev) { if (ev) ev.stopPropagation(); if (_secEmMarcados.has(id)) _secEmMarcados.delete(id); else _secEmMarcados.add(id); _secEmRenderLote(); }
function sec_emSelTodos(el) {
  _secEmLinhas().filter(l => _secEmVisiveis.includes(l.e.id) && _secEmLoteOk(l)).forEach(l => el.checked ? _secEmMarcados.add(l.e.id) : _secEmMarcados.delete(l.e.id));
  sec_renderEmail();
}
function sec_emLimparSel() { _secEmMarcados.clear(); sec_renderEmail(); }
function sec_emLote(st) {
  const ids = [..._secEmMarcados].filter(id => _secEmVisiveis.includes(id)); if (!ids.length || !_SEC_EM_SIT[st]) return;
  const rot = st === 'ciencia' ? 'dar ciência em' : 'marcar como resolvidos';
  if (!confirm('Vai ' + rot + ' ' + ids.length + ' e-mail' + (ids.length > 1 ? 's' : '') + '. Confirma?')) return;
  const em = _sprdAgora(), por = (usuarioAtual && usuarioAtual.nome) || '';
  _secMutar(n => { n.email = Object.assign({}, n.email || {}); ids.forEach(id => { n.email[id] = { st, por, em, nota: '' }; }); },
    { action: 'sec_email_lote', alvo: ids.length + ' e-mail(s)', detalhe: rot })
    .then(ok => { if (ok) { _secEmMarcados.clear(); _mostrarToast(ids.length + ' e-mail(s) marcados.', 'sucesso'); sec_renderEmail(); } });
}

// ── marcação de um e-mail ──
function sec_emMarcar(id, st) {
  const e = _secEmAchar(id); if (!e || (st && !_SEC_EM_SIT[st])) return;
  const nota = st ? _secVal('secem-nota').slice(0, 300) : '';
  const limite = _sprdMaisDias(_secHoje(), -120), vivos = new Set(_secEmPacote.emails.map(x => x.id));
  const i = _secEmVisiveis.indexOf(id), prox = st && _secEmFSit !== 'todos' && _secEmSel === id ? _secEmVisiveis[i + 1] || _secEmVisiveis[i - 1] || null : null;
  return _secMutar(n => {
    // esquece marca velha de e-mail que já saiu do pacote
    n.email = Object.fromEntries(Object.entries(n.email || {}).filter(([k, v]) => vivos.has(k) || String((v && v.em) || '') > limite));
    if (st) n.email[id] = { st, por: (usuarioAtual && usuarioAtual.nome) || '', em: _sprdAgora(), nota };
    else delete n.email[id];
  }, { action: st ? 'sec_email_' + st : 'sec_email_desfazer', alvo: String(e.assunto || '').slice(0, 80) || id, detalhe: 'E-mail de ' + _secEmRemetente(e) })
    .then(ok => {
      if (!ok) return;
      if (prox && _secEmSel === id) _secEmSel = prox; // o marcado sai do filtro: abre o seguinte
      if (_secEmResp[id]) _secEmResp[id].copiou = false;
      const lista = document.querySelector('.secem-lista .table-scroll'), y = lista ? lista.scrollTop : 0;
      _mostrarToast(st ? 'Marcado: ' + _SEC_EM_SIT[st][0].toLowerCase() + '.' : 'Marcação desfeita.', 'sucesso');
      sec_renderEmail();
      const l2 = document.querySelector('.secem-lista .table-scroll'); if (l2) l2.scrollTop = y;
    });
}

// troca só o destaque da linha e o painel (sem redesenhar a lista nem perder a rolagem)
function sec_emSel(id) {
  _secEmSel = id;
  document.querySelectorAll('tr[data-secem]').forEach(tr => { const on = tr.dataset.secem === id; tr.style.background = on ? 'var(--idv-in-f)' : ''; tr.style.boxShadow = on ? _SEC_EM_SEL_FAIXA : tr.dataset.faixa || ''; });
  _secEmRenderDetalhe();
  const box = document.getElementById('secem-detalhe');
  if (box) { box.scrollTop = 0; if (window.innerWidth <= 980) box.scrollIntoView({ block: 'start' }); }
}
function sec_emFiltroSit(f) { _secEmFSit = f === _secEmFSit || !['novo', 'enc', 'resp', 'fim', 'todos'].includes(f) ? 'todos' : f; _secEmSel = null; sec_renderEmail(); }
function sec_emFiltroOrig(k) { _secEmFOrig = k === 'todos' || _SEC_EM_ORIGENS.some(o => o.k === k) ? k : 'todos'; _secEmSel = null; sec_renderEmail(); }
function sec_emMes(m) { _secEmMes = /^\d{4}-\d{2}$/.test(m) ? m : ''; _secEmFSit = null; _secEmSel = null; sec_renderEmail(); }
async function sec_emAtualizar() {
  _secEmErro = ''; await _secEmCarregar(true);
  if (_secEmErro && _secEmPacote) _mostrarToast(_secEmErro + ' Mostrando a última lista lida.', 'erro');
  sec_renderEmail();
}

Object.assign(_SEC_ACOES, { sec_email_enc: 'Marcou e-mail como encaminhado', sec_email_resp: 'Marcou e-mail como respondido', sec_email_ciencia: 'Deu ciência em e-mail',
  sec_email_res: 'Marcou e-mail como resolvido', sec_email_desfazer: 'Desfez marcação de e-mail', sec_email_lote: 'Marcou e-mails em lote', sec_email_resp_copiar: 'Copiou resposta de e-mail' });
