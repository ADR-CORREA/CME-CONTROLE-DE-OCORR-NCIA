/* ═══════════ ENTRADA PRODOC (Secretaria › Agenda e Documentos) ═══════════
   Fila do que chegou à CME pelo PRODOC, com o setor sugerido, o prazo achado no texto e a confirmação
   "já encaminhei / resolvido". Pedido de 20/10/2026.
   • Dados do robô: chave cme_secretaria_bk_prodoc (robô atualizar-prodoc.js, a cada 30 min; só leitura no PRODOC).
     Lida só quando a Secretaria abre — não vem no login. O banco só entrega a admin, gerência e secretaria.
   • Só entra o que já foi aberto no PRODOC (o não aberto não aparece — pedido de 20/10/2026).
   • Marcações da Secretaria: cme_secretaria.prodoc = { idDoc: { st: 'enc'|'res', por, em, nota } }.
   • Regras (setor, nome, prazo, situação): secretaria-prodoc-regras.js.
   Emojis só por \u{...}. */

const _SPRD_CHAVE = 'cme_secretaria_bk_prodoc';
const _SPRD_LINK = 'https://www.prodoc.ap.gov.br/documentos/historico_tramitacao/';
const _SPRD_SIT = { novo: ['A encaminhar', 'at'], aviso: ['Aviso da equipe', 'in'], naolido: ['Não aberto no PRODOC', 'ne'], enc: ['Encaminhado', 'ne'], // classes do idv-etq (identidade.css)
  ciencia: ['Só ciência', 'ne'], res: ['Resolvido', 'ok'] };
const _SPRD_FILTROS = [['novo', 'A encaminhar'], ['aviso', 'Avisos das equipes'], ['enc', 'Encaminhados'], ['ciencia', 'Só ciência'], ['res', 'Resolvidos'], ['todos', 'Todos'], ['criados', 'Criados pela CME']];
const _SPRD_LOTE_SITS = ['novo', 'aviso', 'ciencia', 'enc']; // situações que podem ser marcadas em lote
const _SPRD_PONTO = { novo: 'at', aviso: 'in', res: 'ok' }; // ponto colorido no filtro (mesma cor da etiqueta)
let _sprdMarcados = new Set(); // seleção em lote (ids)
// setor da regra → "destino" dos modelos de Despachos PRODOC
const _SPRD_DESTINO_MODELO = { 'Relatórios': 'Relatório', 'Psicossocial': 'Psicossocial', 'Jurídico': 'Jurídico', 'Plantão': 'Plantão', 'Comunicação Processual': 'Comunicação Processual' };
let _sprdPacote = null, _sprdCarregando = null, _sprdErro = '', _sprdFiltro = null, _sprdSel = null, _sprdVisiveis = new Set();
let _sprdMes = ''; // 'AAAA-MM' na tela (vazio = mês atual). Pedido de 20/10/2026: fila mensal, com volta aos meses anteriores
const _sprdMesTela = () => _sprdMes || _secHoje().slice(0, 7);
const _sprdIdOk = id => /^[A-Za-z0-9]{10}$/.test(String(id || '')); // o banco aceita qualquer coisa: só exibe id no formato do PRODOC

function _sprdAgora() { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); }
function _sprdBR(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/); return m ? m[3] + '/' + m[2] + (m[4] ? ' ' + m[4] : '/' + m[1]) : ''; }
const _sprdSetorCurto = s => String(s || '').replace(/^CENTRAL DE MONITORAMENTO\s*-\s*/i, 'CME-').replace(/^CENTRAL DE MONITORAMENTO ELETR[ÔO]NICO$/i, 'CME');

async function _sprdCarregar(forcar) {
  if (_sprdCarregando) return _sprdCarregando;
  if (_sprdPacote && !forcar) return _sprdPacote;
  _sprdCarregando = (async () => {
    try {
      const r = await _dbLerChave(_SPRD_CHAVE);
      if (r.error) throw r.error;
      const v = (r.data && r.data.value) || {};
      // só o que já foi aberto no PRODOC entra na tela (pedido de 20/10/2026; o robô também já não guarda os não abertos)
      _sprdPacote = Object.assign({}, v, { docs: (Array.isArray(v.docs) ? v.docs : []).filter(d => d && _sprdIdOk(d.id) && d.lido === true),
        criadosCME: (Array.isArray(v.criadosCME) ? v.criadosCME : []).filter(c => c && _sprdIdOk(c.id)) });
      _sprdErro = '';
    } catch (e) { _sprdErro = 'Não consegui ler o banco do CME (' + (e.message || e) + ').'; }
    _sprdCarregando = null;
    return _sprdPacote;
  })();
  return _sprdCarregando;
}

// mes: 'AAAA-MM' (padrão: o mês na tela) ou '*' para todos os meses guardados
function _sprdLinhas(mes) {
  const p = _sprdPacote || { docs: [] }, marcas = _secDados().prodoc, agora = _sprdAgora(), m = mes || _sprdMesTela();
  return (p.docs || []).filter(d => m === '*' || String(d.recebidoEm || '').slice(0, 7) === m).map(d => {
    // atendido com PRODOC novo (só conta quando o original ainda está na caixa e ninguém marcou nada)
    const atendido = d.caixa === 'entrada' && !marcas[d.id] ? _sprdAtendidoPor(d, p.criadosCME) : null;
    return { d, atendido, sit: _sprdSituacao(d, marcas, { atendido: !!atendido }), sug: _sprdSugestao(d), marca: marcas[d.id] || null, prazo: _sprdPrazoDoc(d) };
  }).map(l => Object.assign(l, { parado: l.sit === 'enc' && _sprdParado(l.d, agora) }));
}
// prazo achado no texto pela regra, ou o da IA (o que vencer primeiro); urgência de qualquer um dos dois
function _sprdPrazoDoc(d) {
  const p = _sprdPrazo((d.assunto || '') + ' ' + (d.texto || ''), d.recebidoEm), ia = d.ia || {};
  const dIA = /^\d{4}-\d{2}-\d{2}$/.test(String(ia.prazo || '')) ? ia.prazo : '';
  return { data: dIA && (!p.data || dIA < p.data) ? dIA : p.data, urgente: p.urgente || !!ia.urgente };
}
// prazo vencido ou em até 3 dias, só no que ainda está em aberto
function _sprdPrazoPerto(l) {
  if (l.sit === 'res' || l.sit === 'ciencia') return false;
  return (l.prazo.urgente && l.sit !== 'enc') || (!!l.prazo.data && l.prazo.data <= _sprdMaisDias(_secHoje(), 3));
}

// cartão no painel "Hoje" da Secretaria
function _sprdItemHoje(item) {
  if (!_sprdPacote) {
    if (!_sprdErro && !_sprdCarregando && typeof _dbLerChave === 'function') _sprdCarregar().then(() => { if (_sprdPacote && typeof _secRenderHoje === 'function') _secRenderHoje(); });
    return '';
  }
  // mês atual + o que sobrou do mês anterior (o que está parado há mais tempo fica nos meses dele, sem inflar o painel)
  const ate = _sprdMesSoma(_secHoje().slice(0, 7), -1);
  const n = _sprdLinhas('*').filter(l => l.sit === 'novo' && String(l.d.recebidoEm).slice(0, 7) >= ate).length;
  return n ? item('#7c3aed', '<b>' + n + '</b> PRODOC a encaminhar', 'entrada') : '';
}

function sec_renderEntrada() {
  const c = document.getElementById('sec-conteudo'); if (!c) return;
  if (!_sprdPacote && !_sprdErro) {
    c.innerHTML = '<div style="padding:30px;text-align:center;color:var(--idv-sec)">Lendo a fila do PRODOC…</div>';
    _sprdCarregar().then(() => { if (_secAba === 'entrada' && !_secPerfilId) sec_renderEntrada(); });
    return;
  }
  if (!_sprdPacote) { c.innerHTML = '<div class="idv-faixa cr">' + esc(_sprdErro) + ' <button class="idv-btn mini" onclick="sec_prodocAtualizar()">Tentar de novo</button></div>'; return; }
  const p = _sprdPacote, linhas = _sprdLinhas(), conta = s => linhas.filter(l => l.sit === s).length;
  if (!_sprdFiltro) _sprdFiltro = conta('novo') ? 'novo' : 'todos';
  const hoje = _secHoje(), marcas = _secDados().prodoc;
  const resHoje = Object.values(marcas).filter(m => m.st === 'res' && String(m.em || '').slice(0, 10) === hoje).length;
  // indicadores e filtros no guia de identidade (identidade.css); o indicador com filtro leva à lista filtrada
  const kpi = (cls, v, rot, filtro) => (filtro ? '<button type="button" class="idv-kpi ' + cls + '" onclick="sec_prodocFiltro(\'' + filtro + '\')">' : '<div class="idv-kpi ' + cls + '">')
    + '<div class="idv-num">' + v + '</div><div class="idv-rot">' + rot + '</div>' + (filtro ? '</button>' : '</div>');
  c.innerHTML = _sprdCabecalho(p) + _sprdNavMes()
    + '<div class="idv-kpis" style="margin:12px 0 14px">'
    + kpi('at', conta('novo'), 'A encaminhar', 'novo') + kpi('cr', linhas.filter(l => l.parado).length, 'Parado no setor (+24 h)', 'enc')
    + kpi('cr', linhas.filter(_sprdPrazoPerto).length, 'Prazo em até 3 dias') + kpi('ok', resHoje, 'Resolvidos hoje', 'res') + '</div>'
    + '<div class="idv-chips" style="margin-bottom:10px">' + _SPRD_FILTROS.map(([k, r]) => {
      const n = k === 'todos' ? linhas.length : k === 'criados' ? _sprdCriadosDoMes(p).length : conta(k), cor = _SPRD_PONTO[k];
      return '<button type="button" class="idv-chip' + (k === _sprdFiltro ? ' ativo' : '') + '" onclick="sec_prodocFiltro(\'' + k + '\')">'
        + (cor ? '<span class="idv-ponto" style="background:var(--idv-' + cor + ')"></span>' : '') + r + ' <span class="idv-n">' + n + '</span></button>';
    }).join('') + '</div>'
    + (_sprdFiltro === 'criados' ? _sprdTabelaCriados(p)
      // lista e documento lado a lado (pedido de 20/10/2026: análise e resposta na mesma tela); em tela estreita, um embaixo do outro
      : '<style>.sprd-split{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(380px,1fr);gap:12px;align-items:start}'
        + '.sprd-col-det{position:sticky;top:8px;max-height:calc(100vh - 16px);overflow:auto}.sprd-split .table-scroll{max-height:calc(100vh - 120px)!important}'
        + '.sprd-lista{container-type:inline-size}@container (max-width:640px){.sprd-lista th:nth-child(3),.sprd-lista td:nth-child(3){display:none}}' // lista estreita: a data fica no painel
        + '@media(max-width:980px){.sprd-split{grid-template-columns:1fr}.sprd-col-det{position:static;max-height:none}.sprd-split .table-scroll{max-height:48vh!important}}</style>'
        + '<div class="sprd-split"><div class="sprd-lista" style="min-width:0"><div id="sprd-lote"></div>' + _sprdTabela(linhas) + '</div>'
        + '<div id="sprd-detalhe" class="sprd-col-det"></div></div>');
  _sprdRenderLote();
  _sprdRenderDetalhe();
}

// ── seleção em lote (pedido de 20/10/2026): dar ciência / encaminhado / resolvido em vários de uma vez ──
function _sprdRenderLote() {
  const box = document.getElementById('sprd-lote'); if (!box) return;
  const ids = [..._sprdMarcados].filter(id => _sprdVisiveis.has(id));
  const bt = (st, rot, cls) => '<button type="button" class="idv-btn mini' + cls + '" onclick="sec_prodocLote(\'' + st + '\')">' + rot + '</button>';
  box.innerHTML = ids.length ? '<div class="idv-faixa" style="margin-bottom:10px;padding:8px 12px;font-size:14px">'
    + '<b>' + ids.length + ' selecionado' + (ids.length > 1 ? 's' : '') + '</b>'
    + bt('ciencia', 'Dar ciência', '') + bt('enc', 'Já encaminhei no PRODOC', '') + bt('res', 'Resolvido', ' concluir')
    + '<button type="button" class="idv-btn mini" onclick="sec_prodocLimparSel()">Limpar seleção</button></div>' : '';
}
function sec_prodocMarcarSel(id, ev) {
  if (ev) ev.stopPropagation();
  if (_sprdMarcados.has(id)) _sprdMarcados.delete(id); else _sprdMarcados.add(id);
  _sprdRenderLote();
}
function sec_prodocSelTodos(el) {
  const ids = _sprdLinhas().filter(l => _sprdVisiveis.has(l.d.id) && _SPRD_LOTE_SITS.includes(l.sit)).map(l => l.d.id);
  ids.forEach(id => el.checked ? _sprdMarcados.add(id) : _sprdMarcados.delete(id));
  sec_renderEntrada();
}
function sec_prodocLimparSel() { _sprdMarcados.clear(); sec_renderEntrada(); }
function sec_prodocLote(st) {
  const ids = [..._sprdMarcados].filter(id => _sprdVisiveis.has(id)); if (!ids.length) return;
  const rot = { ciencia: 'dar ciência em', enc: 'marcar como encaminhados', res: 'marcar como resolvidos' }[st];
  if (!confirm('Vai ' + rot + ' ' + ids.length + ' documento' + (ids.length > 1 ? 's' : '') + '. Confirma?')) return;
  const agora = _sprdAgora(), por = (usuarioAtual && usuarioAtual.nome) || '';
  _secMutar(n => {
    n.prodoc = Object.assign({}, n.prodoc || {});
    ids.forEach(id => { n.prodoc[id] = { st: st === 'enc' ? 'enc' : 'res', por, em: agora, nota: st === 'ciencia' ? 'Ciência' : '' }; });
  }, { action: 'sec_prodoc_lote', alvo: ids.length + ' documento(s)', detalhe: rot })
    .then(ok => { if (ok) { _sprdMarcados.clear(); _mostrarToast(ids.length + ' documento(s) marcados.', 'sucesso'); sec_renderEntrada(); } });
}
// criados pela CME no mês que está na tela
const _sprdCriadosDoMes = p => (p.criadosCME || []).filter(c => String(c.em || '').slice(0, 7) === _sprdMesTela());

function _sprdNavMes() {
  const m = _sprdMesTela(), atual = m >= _secHoje().slice(0, 7);
  // o robô guarda ~3 meses: não deixa voltar para antes do documento mais antigo guardado
  const meses = ((_sprdPacote || {}).docs || []).map(d => String(d.recebidoEm || '').slice(0, 7)).filter(x => /^\d{4}-\d{2}$/.test(x)).sort();
  const primeiro = meses[0] || m;
  const pendAntes = _sprdLinhas(_sprdMesSoma(m, -1)).filter(l => l.sit === 'novo'); // só o mês anterior (mais antigo: navegar)
  const mesPend = pendAntes.map(l => String(l.d.recebidoEm).slice(0, 7)).sort().pop();
  const bt = (rot, alvo, desligado) => '<button type="button" class="idv-btn mini"' + (desligado ? ' disabled style="opacity:.45;cursor:default"' : ' onclick="sec_prodocMes(\'' + alvo + '\')"') + '>' + rot + '</button>';
  return '<div style="display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap">' + bt('\u{2039} Mês anterior', _sprdMesSoma(m, -1), m <= primeiro)
    + '<b style="min-width:150px;text-align:center;font-size:15px;color:var(--idv-texto)">' + esc(_sprdMesRotulo(m)) + '</b>' + bt('Próximo mês \u{203A}', _sprdMesSoma(m, 1), atual)
    + (atual ? '' : bt('Voltar ao mês atual', '', false))
    + (pendAntes.length ? '<a href="#" onclick="sec_prodocMes(\'' + mesPend + '\');return false" style="font-size:14px;color:var(--idv-at);font-weight:600">'
      + pendAntes.length + ' a encaminhar no mês anterior — ver ' + esc(_sprdMesRotulo(mesPend).toLowerCase()) + '</a>' : '')
    + (m <= primeiro ? '<span style="font-size:12px;color:var(--idv-sec)">o robô guarda os últimos 3 meses</span>' : '') + '</div>';
}
function sec_prodocMes(m) { _sprdMes = /^\d{4}-\d{2}$/.test(m) ? m : ''; _sprdFiltro = null; _sprdSel = null; sec_renderEntrada(); }

function _sprdCabecalho(p) {
  const ger = p.geradoEm || '', h = ger ? (new Date() - new Date(ger)) / 3600e3 : null, hora = new Date().getHours();
  const atrasado = h !== null && h > 2 && hora >= 8 && hora < 21;
  return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:14px;color:var(--idv-sec)">'
    + '<div>Robô PRODOC: ' + (ger ? 'última leitura <b class="idv-data" style="color:var(--idv-texto)">' + _sprdBR(ger) + '</b>' : '<b>ainda não rodou</b>')
    + (atrasado ? ' · <span style="color:var(--idv-cr);font-weight:600">sem ler há ' + Math.floor(h) + ' h — veja o atualizar-prodoc.log</span>' : '')
    + ' · só entra o que já foi aberto no PRODOC</div>'
    + '<button class="idv-btn mini" onclick="sec_prodocAtualizar()">Atualizar</button></div>';
}

// faixa à esquerda da linha (guia de identidade: a situação vai na faixa, a linha não é pintada)
const _sprdFaixa = l => _sprdPrazoPerto(l) ? 'inset 4px 0 0 var(--idv-cr)' : l.sit === 'novo' ? 'inset 4px 0 0 var(--idv-at)' : l.sit === 'res' ? 'inset 4px 0 0 var(--idv-ok)' : '';
const _SPRD_SEL_FAIXA = 'inset 4px 0 0 var(--idv-in)';

function _sprdTabela(linhas) {
  const f = _sprdFiltro, vis = linhas.filter(l => f === 'todos' || l.sit === f)
    .sort((a, b) => (_sprdPrazoPerto(b) - _sprdPrazoPerto(a)) || String(b.d.recebidoEm).localeCompare(String(a.d.recebidoEm)));
  _sprdVisiveis = new Set(vis.map(l => l.d.id));
  if (vis.length && !_sprdVisiveis.has(_sprdSel)) _sprdSel = vis[0].d.id;
  const lote = vis.filter(l => _SPRD_LOTE_SITS.includes(l.sit)), todos = lote.length && lote.every(l => _sprdMarcados.has(l.d.id));
  return '<div class="table-scroll" style="max-height:48vh"><table class="data-table idv-tabela"><thead><tr>'
    + '<th style="width:28px">' + (lote.length ? '<input type="checkbox" title="Selecionar todos desta lista"' + (todos ? ' checked' : '') + ' onclick="sec_prodocSelTodos(this)">' : '') + '</th>'
    + '<th>Situação</th><th>Recebido</th><th>Documento</th><th>Prazo</th><th>Vai para</th></tr></thead><tbody>'
    + (vis.length ? vis.map(l => {
      const d = l.d, [rot, cls] = _SPRD_SIT[l.sit], faixa = _sprdFaixa(l), sel = d.id === _sprdSel;
      const prazo = l.prazo.data ? _sprdBR(l.prazo.data).slice(0, 5) : l.prazo.urgente ? 'Urgente' : '—';
      const para = l.sit === 'enc' && d.envios && d.envios.length ? d.envios.map(e => _sprdSetorCurto(e.destino)).join(', ')
        : l.sit === 'enc' && l.atendido ? (l.atendido.destinos || [l.atendido.destino]).map(_sprdSetorCurto).join(', ')
        : l.sit === 'aviso' ? 'Ciência' : (l.sug.ciencia ? 'Só ciência' : l.sug.setores.join(', ') || '—');
      return '<tr data-sprd="' + d.id + '" data-faixa="' + faixa + '" style="cursor:pointer;' + (sel ? 'background:var(--idv-in-f);box-shadow:' + _SPRD_SEL_FAIXA : faixa ? 'box-shadow:' + faixa : '') + '" onclick="sec_prodocSel(\'' + _jsq(d.id) + '\')">'
        + '<td onclick="event.stopPropagation()">' + (_SPRD_LOTE_SITS.includes(l.sit) ? '<input type="checkbox"' + (_sprdMarcados.has(d.id) ? ' checked' : '') + ' onclick="sec_prodocMarcarSel(\'' + _jsq(d.id) + '\',event)">' : '') + '</td>'
        + '<td><span class="idv-etq ' + cls + '">' + rot + '</span>' + (l.parado ? '<div style="margin-top:4px"><span class="idv-etq cr">Parado</span></div>' : '') + '</td>'
        + '<td class="idv-data" style="white-space:nowrap">' + _sprdBR(d.recebidoEm) + '</td>'
        + '<td><div style="font-weight:600">' + esc(d.assunto) + '</div><div class="idv-mini">' + esc(l.sug.cat) + ' · <span class="idv-mono">' + esc(d.numero) + '</span> · ' + esc(d.origem) + '</div>'
        + (d.ia && d.ia.providencia ? '<div style="font-size:13px;color:var(--idv-de);margin-top:2px">IA: ' + esc(d.ia.providencia) + (_sprdIaConferida(d.ia) ? ' <span style="color:var(--idv-ok);font-weight:600" title="leitura conferida">\u{2714}</span>' : ' <span style="color:var(--idv-at);font-weight:600" title="confira">?</span>') + '</div>' : '') + '</td>'
        + '<td class="idv-data" style="white-space:nowrap;font-weight:600' + (_sprdPrazoPerto(l) ? ';color:var(--idv-cr)' : '') + '">' + prazo + '</td>'
        + '<td style="color:var(--idv-in);font-weight:600">' + esc(para) + (d.ia && l.sit !== 'enc' && _sprdSetorIA(d.ia.responsavel) && !l.sug.setores.includes(_sprdSetorIA(d.ia.responsavel))
          ? '<div style="font-size:12px;font-weight:400;color:var(--idv-de)">IA: ' + esc(_sprdSetorIA(d.ia.responsavel)) + '</div>' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="6" class="idv-vazio">Nada aqui.</td></tr>')
    + '</tbody></table></div>';
}

function _sprdTabelaCriados(p) {
  const l = _sprdCriadosDoMes(p);
  return '<div style="font-size:14px;color:var(--idv-sec);margin-bottom:8px">Documentos que a própria CME criou e encaminhou neste mês (o robô guarda os últimos 35 dias) — só para consulta.</div>'
    + '<div class="table-scroll" style="max-height:55vh"><table class="data-table idv-tabela"><thead><tr><th>Enviado</th><th>Assunto</th><th>Para</th><th></th></tr></thead><tbody>'
    + (l.length ? l.map(c => '<tr><td class="idv-data" style="white-space:nowrap">' + _sprdBR(c.em) + '</td><td style="font-weight:600">' + esc(c.assunto) + '</td><td>' + esc((c.destinos || [c.destino]).map(_sprdSetorCurto).join(', ')) + '</td>'
      + '<td><a class="idv-link" href="' + _SPRD_LINK + encodeURIComponent(c.id) + '" target="_blank" rel="noopener noreferrer">Abrir no PRODOC</a></td></tr>').join('')
      : '<tr><td colspan="4" class="idv-vazio">Nada neste mês.</td></tr>')
    + '</tbody></table></div>';
}

const _SPRD_ROT = 'font-size:12px;font-weight:600;color:var(--idv-sec);text-transform:uppercase;letter-spacing:.05em'; // rótulo de campo do painel
function _sprdRenderDetalhe() {
  const box = document.getElementById('sprd-detalhe'); if (!box) return;
  const l = _sprdFiltro === 'criados' || !_sprdVisiveis.has(_sprdSel) ? null : _sprdLinhas().find(x => x.d.id === _sprdSel);
  if (!l) { box.innerHTML = ''; return; }
  const d = l.d, s = l.sug, [rot, cls] = _SPRD_SIT[l.sit], m = l.marca;
  const linha = (rotulo, html) => '<div style="margin-top:10px"><span style="' + _SPRD_ROT + '">' + rotulo + '</span><div style="font-size:14px">' + html + '</div></div>';
  let h = '<div class="idv-bloco"><div class="idv-bloco-cab"><span>' + esc(d.tipo) + ' · <span class="idv-mono">' + esc(d.numero) + '</span></span>'
    + '<span class="idv-data">recebido ' + _sprdBR(d.recebidoEm) + '</span></div><div style="padding:12px 16px 16px">'
    + '<div class="idv-mini">de <b>' + esc(d.origem) + '</b>' + (d.origemNome ? ' (' + esc(d.origemNome) + ')' : '') + '</div>'
    + '<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start;margin-top:4px">'
    + '<div class="idv-nome" style="font-size:16px;min-width:0">' + esc(d.assunto) + '</div><span class="idv-etq ' + cls + '">' + rot + '</span></div>'
    + _sprdPasso(l, 1, 'O que fazer')
    + _sprdBlocoIA(l)
    + '<div style="margin-top:10px;padding:10px 12px;background:var(--idv-in-f);border-left:4px solid var(--idv-in);border-radius:0 6px 6px 0">'
    + '<div style="' + _SPRD_ROT + ';color:var(--idv-in)">' + (d.ia ? 'Pelo histórico da CME' : 'O que fazer') + '</div>'
    + '<div style="font-size:15px;color:var(--idv-texto);margin-top:2px">' + esc(l.sit === 'enc' ? 'Já encaminhado. Acompanhar até o setor resolver.' : l.sit === 'res' ? 'Resolvido.'
      : l.sit === 'aviso' ? 'Aviso da própria equipe da CME sobre o que já foi feito: dar ciência. Encaminhe só se precisar.' : s.fazer) + '</div>'
    + '<div style="font-size:13px;color:var(--idv-sec);margin-top:3px">Regra: ' + esc(s.regra) + '</div>'
    + (l.prazo.data || l.prazo.urgente ? '<div style="font-size:14px;margin-top:4px;color:' + (_sprdPrazoPerto(l) ? 'var(--idv-cr)' : 'var(--idv-texto)') + ';font-weight:600">Prazo: '
      + (l.prazo.data ? '<span class="idv-data">' + _sprdBR(l.prazo.data) + '</span>' : '') + (l.prazo.urgente ? (l.prazo.data ? ' · ' : '') + 'pede urgência' : '') + '</div>' : '') + '</div>';
  if (d.sigiloso) h += linha('Texto', 'Documento sigiloso: o robô não traz o texto. Leia no PRODOC.');
  else if (d.texto) h += '<details style="margin-top:10px"' + (l.sit === 'novo' ? ' open' : '') + '><summary style="cursor:pointer;' + _SPRD_ROT + '">Texto do documento (como está no PRODOC)</summary>'
    + '<div style="white-space:pre-wrap;background:var(--idv-zebra);border:1px solid var(--idv-borda);border-radius:6px;padding:10px 12px;margin-top:6px;font-size:14px;line-height:1.5;color:var(--idv-texto);max-height:220px;overflow:auto">' + esc(d.texto) + '</div></details>';
  h += _sprdBlocoResponder(l); // passo 2: despacho curto ou modelo formal, aqui mesmo (secretaria-prodoc-responder.js)
  if ((d.envios || []).length) h += linha('Encaminhado no PRODOC', d.envios.map(e => {
    const curto = x => _sprdSetorCurto(x).replace(/\s/g, '').toUpperCase();
    const st = (d.setores || []).find(x => curto(e.destino) === curto(x.para));
    return esc(_sprdSetorCurto(e.destino)) + ' em <span class="idv-data">' + _sprdBR(e.em) + '</span>'
      + (st ? (st.lido ? ' — setor leu em <span class="idv-data">' + _sprdBR(st.lido) + '</span>' : ' — <b style="color:var(--idv-at)">setor ainda não leu</b>') : '');
  }).join('<br>'));
  if (l.atendido && l.sit === 'enc' && !(d.envios || []).length) h += linha('Atendido com PRODOC novo da CME', esc(l.atendido.assunto) + ' → ' + esc((l.atendido.destinos || [l.atendido.destino]).map(_sprdSetorCurto).join(', '))
    + ' em <span class="idv-data">' + _sprdBR(l.atendido.em) + '</span> <span class="idv-mini">(achado pelo nome — se não for o mesmo caso, marque abaixo)</span>');
  if (m) h += linha('Marcado na Secretaria', esc(m.st === 'res' ? 'Resolvido' : 'Encaminhado') + ' por ' + esc(m.por || '?') + ' em <span class="idv-data">' + _sprdBR(String(m.em || '').slice(0, 16)) + '</span>' + (m.nota ? ' · "' + esc(m.nota) + '"' : ''));
  // passo 3: abrir no PRODOC, colar e confirmar aqui mesmo (verde = concluir, como no guia)
  const copiou = l.sit === 'novo' && _sprdRespCopiou(d.id), idq = _jsq(d.id);
  h += _sprdPasso(l, 3, 'Encaminhar no PRODOC e confirmar aqui');
  if (copiou) h += '<div id="sprd-r-copiado" class="idv-faixa ok" style="margin:8px 0 0;padding:8px 12px;font-size:14px"><span class="idv-faixa-ic">\u{2714}</span><span>Texto copiado. Abra no PRODOC, cole (Ctrl+V), encaminhe e depois clique em <b>Já encaminhei no PRODOC</b>.</span></div>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:' + (l.sit === 'novo' ? 8 : 12) + 'px">'
    + '<a class="idv-btn mini" style="text-decoration:none" href="' + _SPRD_LINK + encodeURIComponent(d.id) + '" target="_blank" rel="noopener noreferrer"'
    + (d.lido !== true ? ' onclick="return confirm(\'Abrir no PRODOC marca este documento como LIDO no seu nome. Abrir mesmo assim?\')"' : '') + '>Abrir no PRODOC \u{2197}</a>';
  if (l.sit === 'aviso') h += '<button class="idv-btn mini concluir" onclick="sec_prodocMarcarCiencia(\'' + idq + '\')">Dar ciência</button>';
  if (l.sit === 'novo' || l.sit === 'aviso') h += '<button class="idv-btn mini' + (l.sit === 'novo' ? ' concluir' : '') + '"' + (l.sit === 'novo' ? ' id="sprd-r-jaenc"' : '') + (copiou ? ' style="box-shadow:0 0 0 3px var(--idv-ok-f)"' : '') + ' onclick="sec_prodocMarcar(\'' + idq + '\',\'enc\')">Já encaminhei no PRODOC</button>';
  if (l.sit !== 'res') h += '<input id="sprd-nota" placeholder="O que foi feito (opcional)" maxlength="300" value="' + esc(_sprdRespEstado(d.id).nota || '') + '" oninput="_sprdRespEstado(\'' + idq + '\').nota=this.value" style="flex:1;min-width:180px;height:32px;padding:0 10px;border:1px solid var(--idv-borda);border-radius:6px;font-size:14px"><button class="idv-btn mini' + (l.sit === 'novo' ? '' : ' concluir') + '" onclick="sec_prodocMarcar(\'' + idq + '\',\'res\')">Confirmar resolvido</button>';
  if (m) h += '<button class="idv-btn mini" onclick="sec_prodocMarcar(\'' + idq + '\',\'\')">Desfazer marcação</button>';
  const y = box.scrollTop; box.innerHTML = h + '</div></div></div>'; box.scrollTop = y; // redesenhar (gênero, modelo, cópia) não perde a rolagem do painel
}
// título numerado dos passos — só no que está "A encaminhar" (nos outros o painel é só consulta/confirmação)
function _sprdPasso(l, n, titulo) {
  if (l.sit !== 'novo') return '';
  return '<div style="display:flex;align-items:center;gap:8px;margin-top:' + (n === 1 ? 14 : 18) + 'px;padding-top:' + (n === 1 ? 0 : 12) + 'px;' + (n === 1 ? '' : 'border-top:1px solid var(--idv-linha);')
    + 'font-size:12px;font-weight:600;color:var(--idv-texto);text-transform:uppercase;letter-spacing:.05em">'
    + '<span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:3px;background:var(--idv-cab);color:#fff;font-size:12px">' + n + '</span>' + esc(titulo) + '</div>';
}

// troca só o destaque da linha e o painel do documento (sem redesenhar a lista nem perder a rolagem dela)
function sec_prodocSel(id) {
  _sprdSel = id;
  document.querySelectorAll('tr[data-sprd]').forEach(tr => { const on = tr.dataset.sprd === id; tr.style.background = on ? 'var(--idv-in-f)' : ''; tr.style.boxShadow = on ? _SPRD_SEL_FAIXA : tr.dataset.faixa || ''; });
  _sprdRenderDetalhe();
  const box = document.getElementById('sprd-detalhe');
  if (box) { box.scrollTop = 0; if (window.innerWidth <= 980) box.scrollIntoView({ block: 'start' }); }
}
// próximo da lista na tela (para abrir sozinho depois de marcar); o anterior se era o último
function _sprdProximoDe(id) { const ord = [..._sprdVisiveis], i = ord.indexOf(id); return i < 0 ? null : ord[i + 1] || ord[i - 1] || null; }
function sec_prodocFiltro(f) { _sprdFiltro = f; _sprdSel = null; sec_renderEntrada(); }
async function sec_prodocAtualizar() {
  _sprdErro = ''; await _sprdCarregar(true);
  if (_sprdErro && _sprdPacote) _mostrarToast(_sprdErro + ' Mostrando a última lista lida.', 'erro');
  sec_renderEntrada();
}

// "Dar ciência" = resolvido com a nota "Ciência" (aviso da equipe, circular)
function sec_prodocMarcarCiencia(id) { sec_prodocMarcar(id, 'res', 'Ciência'); }
function sec_prodocMarcar(id, st, notaFixa) {
  const d = ((_sprdPacote || {}).docs || []).find(x => x.id === id); if (!d) return;
  const nota = notaFixa || (st === 'res' ? _secVal('sprd-nota').slice(0, 300) : '');
  const limite = _sprdMaisDias(_secHoje(), -90), vivos = new Set(_sprdPacote.docs.map(x => x.id));
  const prox = st && _sprdFiltro !== 'todos' && _sprdSel === id ? _sprdProximoDe(id) : null; // o marcado sai do filtro: abre o seguinte
  _secMutar(n => {
    n.prodoc = Object.fromEntries(Object.entries(n.prodoc || {}).filter(([k, v]) => vivos.has(k) || String(v.em || '') > limite)); // esquece marca velha de documento que já saiu do pacote
    if (st) n.prodoc[id] = { st, por: (usuarioAtual && usuarioAtual.nome) || '', em: _sprdAgora(), nota }; // hora local, como o resto da Secretaria
    else delete n.prodoc[id];
  }, { action: st ? 'sec_prodoc_' + st : 'sec_prodoc_desfazer', alvo: d.numero || id, detalhe: 'PRODOC ' + (d.origem || '') })
    .then(ok => { if (ok) {
      if (prox && _sprdSel === id) _sprdSel = prox; // se a pessoa já clicou em outro, respeita
      if (!st && _sprdResp[id]) _sprdResp[id].copiou = false; // desfez: começa o passo 3 de novo
      const lista = document.querySelector('.sprd-lista .table-scroll'), y = lista ? lista.scrollTop : 0;
      _mostrarToast(st === 'res' ? 'Marcado como resolvido.' : st === 'enc' ? 'Marcado como encaminhado.' : 'Marcação desfeita.', 'sucesso'); sec_renderEntrada();
      const l2 = document.querySelector('.sprd-lista .table-scroll'), tr = document.querySelector('tr[data-sprd="' + _sprdSel + '"]');
      if (l2) l2.scrollTop = y; if (tr) tr.scrollIntoView({ block: 'nearest' }); // a lista não volta ao topo
    } });
}

Object.assign(_SEC_ACOES, { sec_prodoc_enc: 'Marcou PRODOC como encaminhado', sec_prodoc_res: 'Marcou PRODOC como resolvido', sec_prodoc_desfazer: 'Desfez marcação do PRODOC', sec_prodoc_lote: 'Marcou PRODOCs em lote' });
