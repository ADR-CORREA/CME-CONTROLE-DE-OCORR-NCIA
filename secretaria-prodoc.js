/* ═══════════ ENTRADA PRODOC (Secretaria › Agenda e Documentos) ═══════════
   Fila do que chegou à CME pelo PRODOC, com o setor sugerido, o prazo achado no texto e a confirmação
   "já encaminhei / resolvido". Pedido de 20/10/2026.
   • Dados do robô: chave cme_secretaria_bk_prodoc (robô atualizar-prodoc.js, a cada 30 min; só leitura no PRODOC).
     Lida só quando a Secretaria abre — não vem no login. O banco só entrega a admin, gerência e secretaria.
   • Texto do documento SÓ de quem já foi aberto no PRODOC; não lido aparece com os dados da lista.
   • Marcações da Secretaria: cme_secretaria.prodoc = { idDoc: { st: 'enc'|'res', por, em, nota } }.
   • Regras (setor, nome, prazo, situação): secretaria-prodoc-regras.js.
   Emojis só por \u{...}. */

const _SPRD_CHAVE = 'cme_secretaria_bk_prodoc';
const _SPRD_LINK = 'https://www.prodoc.ap.gov.br/documentos/historico_tramitacao/';
const _SPRD_SIT = { novo: ['A encaminhar', 'badge-atencao'], antigo: ['Na caixa há +7 dias', 'badge-neutro'], naolido: ['Não aberto no PRODOC', 'badge-neutro'], enc: ['Encaminhado', 'badge-neutro'],
  ciencia: ['Só ciência', 'badge-neutro'], res: ['Resolvido', 'badge-ok'] };
const _SPRD_FILTROS = [['novo', 'A encaminhar'], ['antigo', 'Na caixa há +7 dias'], ['naolido', 'Não abertos'], ['enc', 'Encaminhados'], ['ciencia', 'Só ciência'], ['res', 'Resolvidos'], ['todos', 'Todos'], ['criados', 'Criados pela CME']];
// setor da regra → "destino" dos modelos de Despachos PRODOC
const _SPRD_DESTINO_MODELO = { 'Relatórios': 'Relatório', 'Psicossocial': 'Psicossocial', 'Jurídico': 'Jurídico', 'Plantão': 'Plantão', 'Comunicação Processual': 'Comunicação Processual' };
let _sprdPacote = null, _sprdCarregando = null, _sprdErro = '', _sprdFiltro = null, _sprdSel = null, _sprdVisiveis = new Set();
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
      _sprdPacote = Object.assign({}, v, { docs: (Array.isArray(v.docs) ? v.docs : []).filter(d => d && _sprdIdOk(d.id)),
        criadosCME: (Array.isArray(v.criadosCME) ? v.criadosCME : []).filter(c => c && _sprdIdOk(c.id)) });
      _sprdErro = '';
    } catch (e) { _sprdErro = 'Não consegui ler o banco do CME (' + (e.message || e) + ').'; }
    _sprdCarregando = null;
    return _sprdPacote;
  })();
  return _sprdCarregando;
}

function _sprdLinhas() {
  const p = _sprdPacote || { docs: [] }, marcas = _secDados().prodoc, agora = _sprdAgora();
  return (p.docs || []).map(d => ({
    d, sit: _sprdSituacao(d, marcas, agora), sug: _sprdSugestao(d), marca: marcas[d.id] || null,
    prazo: _sprdPrazo((d.assunto || '') + ' ' + (d.texto || ''), d.recebidoEm),
  })).map(l => Object.assign(l, { parado: l.sit === 'enc' && _sprdParado(l.d, agora) }));
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
  const n = _sprdLinhas().filter(l => l.sit === 'novo').length;
  return n ? item('#7c3aed', '<b>' + n + '</b> PRODOC a encaminhar', 'entrada') : '';
}

function sec_renderEntrada() {
  const c = document.getElementById('sec-conteudo'); if (!c) return;
  if (!_sprdPacote && !_sprdErro) {
    c.innerHTML = '<div style="padding:30px;text-align:center;color:#64748b">Lendo a fila do PRODOC…</div>';
    _sprdCarregar().then(() => { if (_secAba === 'entrada' && !_secPerfilId) sec_renderEntrada(); });
    return;
  }
  if (!_sprdPacote) { c.innerHTML = '<div style="padding:20px;color:#b91c1c">' + esc(_sprdErro) + ' <button class="btn-secondary" onclick="sec_prodocAtualizar()">Tentar de novo</button></div>'; return; }
  const p = _sprdPacote, linhas = _sprdLinhas(), conta = s => linhas.filter(l => l.sit === s).length;
  if (!_sprdFiltro) _sprdFiltro = conta('novo') ? 'novo' : 'todos';
  const hoje = _secHoje(), marcas = _secDados().prodoc;
  const resHoje = Object.values(marcas).filter(m => m.st === 'res' && String(m.em || '').slice(0, 10) === hoje).length;
  const kpi = (cor, v, rot) => '<div class="kpi-card" style="border-left:4px solid ' + cor + '"><div class="kpi-value">' + v + '</div><div class="kpi-label">' + rot + '</div></div>';
  c.innerHTML = _sprdCabecalho(p)
    + '<div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin:10px 0 12px">'
    + kpi('#d97706', conta('novo'), 'A encaminhar') + kpi('#ea580c', linhas.filter(l => l.parado).length, 'Parado no setor (+24 h)')
    + kpi('#dc2626', linhas.filter(_sprdPrazoPerto).length, 'Prazo em até 3 dias') + kpi('#16a34a', resHoje, 'Resolvidos hoje') + '</div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">' + _SPRD_FILTROS.map(([k, r]) => {
      const n = k === 'todos' ? linhas.length : k === 'criados' ? (p.criadosCME || []).length : conta(k), on = k === _sprdFiltro;
      return '<button type="button" onclick="sec_prodocFiltro(\'' + k + '\')" style="padding:4px 12px;border-radius:4px;cursor:pointer;font-size:.84rem;'
        + (on ? 'border:1px solid #2563eb;background:#eff6ff;color:#1d4ed8;font-weight:700;box-shadow:inset 2px 0 0 #2563eb' : 'border:1px solid #cbd5e1;background:#fff;color:#475569') + '">' + r + ' <span style="opacity:.75">' + n + '</span></button>';
    }).join('') + '</div>'
    + (_sprdFiltro === 'criados' ? _sprdTabelaCriados(p) : _sprdTabela(linhas))
    + '<div id="sprd-detalhe" style="margin-top:12px"></div>';
  _sprdRenderDetalhe();
}

function _sprdCabecalho(p) {
  const ger = p.geradoEm || '', h = ger ? (new Date() - new Date(ger)) / 3600e3 : null, hora = new Date().getHours();
  const atrasado = h !== null && h > 2 && hora >= 8 && hora < 21;
  return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:.84rem;color:#64748b">'
    + '<div>\u{1F916} Robô PRODOC: ' + (ger ? 'última leitura <b style="font-family:var(--font-mono)">' + _sprdBR(ger) + '</b>' : '<b>ainda não rodou</b>')
    + (atrasado ? ' · <span style="color:#b45309;font-weight:600">sem ler há ' + Math.floor(h) + ' h — veja o atualizar-prodoc.log</span>' : '')
    + ' · só traz o texto de documento já aberto no PRODOC</div>'
    + '<button class="btn-sm btn-outline" onclick="sec_prodocAtualizar()">Atualizar</button></div>';
}

function _sprdTabela(linhas) {
  const f = _sprdFiltro, vis = linhas.filter(l => f === 'todos' || l.sit === f)
    .sort((a, b) => (_sprdPrazoPerto(b) - _sprdPrazoPerto(a)) || String(b.d.recebidoEm).localeCompare(String(a.d.recebidoEm)));
  _sprdVisiveis = new Set(vis.map(l => l.d.id));
  if (vis.length && !_sprdVisiveis.has(_sprdSel)) _sprdSel = vis[0].d.id;
  return '<div class="table-scroll" style="max-height:48vh"><table class="data-table"><thead><tr><th>Situação</th><th>Recebido</th><th>Documento</th><th>Prazo</th><th>Vai para</th></tr></thead><tbody>'
    + (vis.length ? vis.map(l => {
      const d = l.d, [rot, cls] = _SPRD_SIT[l.sit];
      const prazo = l.prazo.data ? _sprdBR(l.prazo.data).slice(0, 5) : l.prazo.urgente ? 'Urgente' : '—';
      const para = l.sit === 'enc' && d.envios && d.envios.length ? d.envios.map(e => _sprdSetorCurto(e.destino)).join(', ') : (l.sug.ciencia ? 'Só ciência' : l.sug.setores.join(', ') || '—');
      return '<tr style="cursor:pointer' + (d.id === _sprdSel ? ';background:#eff6ff;box-shadow:inset 3px 0 0 #2563eb' : '') + '" onclick="sec_prodocSel(\'' + _jsq(d.id) + '\')">'
        + '<td><span class="badge ' + cls + '">' + (l.sit === 'naolido' ? '\u{1F512} ' : '') + rot + '</span>' + (l.parado ? ' <span class="badge badge-vencendo">Parado</span>' : '') + '</td>'
        + '<td style="font-family:var(--font-mono);white-space:nowrap">' + _sprdBR(d.recebidoEm) + '</td>'
        + '<td><div style="font-weight:600">' + esc(d.assunto) + '</div><div style="font-size:.78rem;color:#64748b">' + esc(l.sug.cat) + ' · <span style="font-family:var(--font-mono)">' + esc(d.numero) + '</span> · ' + esc(d.origem) + '</div></td>'
        + '<td style="white-space:nowrap' + (_sprdPrazoPerto(l) ? ';color:#b91c1c;font-weight:700' : '') + '">' + prazo + '</td>'
        + '<td style="color:#1d4ed8">' + esc(para) + '</td></tr>';
    }).join('') : '<tr><td colspan="5" style="text-align:center;padding:24px;color:#888">Nada aqui.</td></tr>')
    + '</tbody></table></div>';
}

function _sprdTabelaCriados(p) {
  const l = p.criadosCME || [];
  return '<div style="font-size:.82rem;color:#64748b;margin-bottom:6px">Documentos que a própria CME criou e encaminhou nos últimos 15 dias (só para consulta).</div>'
    + '<div class="table-scroll" style="max-height:55vh"><table class="data-table"><thead><tr><th>Enviado</th><th>Assunto</th><th>Para</th><th></th></tr></thead><tbody>'
    + (l.length ? l.map(c => '<tr><td style="font-family:var(--font-mono);white-space:nowrap">' + _sprdBR(c.em) + '</td><td>' + esc(c.assunto) + '</td><td>' + esc((c.destinos || [c.destino]).map(_sprdSetorCurto).join(', ')) + '</td>'
      + '<td><a href="' + _SPRD_LINK + encodeURIComponent(c.id) + '" target="_blank" rel="noopener noreferrer">PRODOC</a></td></tr>').join('')
      : '<tr><td colspan="4" style="text-align:center;padding:24px;color:#888">Nada nos últimos 15 dias.</td></tr>')
    + '</tbody></table></div>';
}

function _sprdRenderDetalhe() {
  const box = document.getElementById('sprd-detalhe'); if (!box) return;
  const l = _sprdFiltro === 'criados' || !_sprdVisiveis.has(_sprdSel) ? null : _sprdLinhas().find(x => x.d.id === _sprdSel);
  if (!l) { box.innerHTML = ''; return; }
  const d = l.d, s = l.sug, [rot, cls] = _SPRD_SIT[l.sit], m = l.marca;
  const linha = (rotulo, html) => '<div style="margin-top:6px"><span style="font-size:.72rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">' + rotulo + '</span><div>' + html + '</div></div>';
  let h = '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:14px 16px">'
    + '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:flex-start"><div style="min-width:0">'
    + '<div style="font-size:.75rem;color:#64748b">' + esc(d.tipo) + ' · <span style="font-family:var(--font-mono)">' + esc(d.numero) + '</span> · de ' + esc(d.origem) + (d.origemNome ? ' (' + esc(d.origemNome) + ')' : '') + ' · recebido <span style="font-family:var(--font-mono)">' + _sprdBR(d.recebidoEm) + '</span></div>'
    + '<div style="font-weight:700;font-size:1.02rem">' + esc(d.assunto) + '</div></div><span class="badge ' + cls + '">' + rot + '</span></div>'
    + '<div style="margin-top:10px;padding:10px 12px;background:#eff6ff;border-left:3px solid #2563eb">'
    + '<div style="font-size:.72rem;font-weight:700;color:#1d4ed8;text-transform:uppercase;letter-spacing:.05em">O que fazer</div>'
    + '<div>' + esc(l.sit === 'enc' ? 'Já encaminhado. Acompanhar até o setor resolver.' : l.sit === 'res' ? 'Resolvido.' : s.fazer) + '</div>'
    + '<div style="font-size:.8rem;color:#475569;margin-top:3px">Regra: ' + esc(s.regra) + '</div>'
    + (l.prazo.data || l.prazo.urgente ? '<div style="font-size:.84rem;margin-top:3px;color:' + (_sprdPrazoPerto(l) ? '#b91c1c' : '#475569') + ';font-weight:600">\u{23F0} '
      + (l.prazo.data ? 'Prazo achado no texto: ' + _sprdBR(l.prazo.data) : '') + (l.prazo.urgente ? (l.prazo.data ? ' · ' : '') + 'pede urgência' : '') + '</div>' : '') + '</div>';
  if (l.sit === 'naolido') h += '<div style="margin-top:10px;font-size:.86rem;color:#475569">\u{1F512} Ainda não foi aberto no PRODOC. O robô só traz o texto depois que alguém abrir lá — e abrir marca "lido por" no nome de quem abriu.</div>';
  if ((d.envios || []).length) h += linha('Encaminhado no PRODOC', d.envios.map(e => {
    const curto = x => _sprdSetorCurto(x).replace(/\s/g, '').toUpperCase();
    const st = (d.setores || []).find(x => curto(e.destino) === curto(x.para));
    return esc(_sprdSetorCurto(e.destino)) + ' em <span style="font-family:var(--font-mono)">' + _sprdBR(e.em) + '</span>'
      + (st ? (st.lido ? ' — setor leu em <span style="font-family:var(--font-mono)">' + _sprdBR(st.lido) + '</span>' : ' — <b style="color:#c2410c">setor ainda não leu</b>') : '');
  }).join('<br>'));
  if (m) h += linha('Marcado na Secretaria', esc(m.st === 'res' ? 'Resolvido' : 'Encaminhado') + ' por ' + esc(m.por || '?') + ' em <span style="font-family:var(--font-mono)">' + _sprdBR(String(m.em || '').slice(0, 16)) + '</span>' + (m.nota ? ' · "' + esc(m.nota) + '"' : ''));
  if (d.sigiloso) h += linha('Texto', 'Documento sigiloso: o robô não traz o texto. Leia no PRODOC.');
  else if (d.texto) h += '<details style="margin-top:8px"' + (l.sit === 'novo' ? ' open' : '') + '><summary style="cursor:pointer;font-size:.8rem;font-weight:700;color:#64748b">TEXTO DO DOCUMENTO (como está no PRODOC)</summary>'
    + '<div style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:10px 12px;margin-top:6px;font-size:.88rem;line-height:1.5;max-height:260px;overflow:auto">' + esc(d.texto) + '</div></details>';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px">';
  if ((l.sit === 'novo' || l.sit === 'antigo') && (s.modelo || _SPRD_DESTINO_MODELO[s.setores[0]])) h += '<button class="btn-secondary" onclick="sec_prodocDespacho(\'' + _jsq(d.id) + '\')">Preparar despacho</button>';
  if (l.sit === 'novo' || l.sit === 'antigo') h += '<button class="btn-primary" onclick="sec_prodocMarcar(\'' + _jsq(d.id) + '\',\'enc\')">Já encaminhei no PRODOC</button>';
  if (l.sit !== 'res') h += '<input id="sprd-nota" placeholder="O que foi feito (opcional)" maxlength="300" style="flex:1;min-width:180px;padding:6px 10px"><button class="btn-primary" onclick="sec_prodocMarcar(\'' + _jsq(d.id) + '\',\'res\')">Confirmar resolvido</button>';
  if (m) h += '<button class="btn-sm btn-outline" onclick="sec_prodocMarcar(\'' + _jsq(d.id) + '\',\'\')">Desfazer marcação</button>';
  h += '<a class="btn-sm btn-outline" style="text-decoration:none" href="' + _SPRD_LINK + encodeURIComponent(d.id) + '" target="_blank" rel="noopener noreferrer"'
    + (d.lido !== true ? ' onclick="return confirm(\'Abrir no PRODOC marca este documento como LIDO no seu nome. Abrir mesmo assim?\')"' : '') + '>Abrir no PRODOC \u{2197}</a></div></div>';
  box.innerHTML = h;
}

function sec_prodocSel(id) { _sprdSel = id; sec_renderEntrada(); }
function sec_prodocFiltro(f) { _sprdFiltro = f; _sprdSel = null; sec_renderEntrada(); }
async function sec_prodocAtualizar() {
  _sprdErro = ''; await _sprdCarregar(true);
  if (_sprdErro && _sprdPacote) _mostrarToast(_sprdErro + ' Mostrando a última lista lida.', 'erro');
  sec_renderEntrada();
}

function sec_prodocMarcar(id, st) {
  const d = ((_sprdPacote || {}).docs || []).find(x => x.id === id); if (!d) return;
  const nota = st === 'res' ? _secVal('sprd-nota').slice(0, 300) : '';
  const limite = _sprdMaisDias(_secHoje(), -90), vivos = new Set(_sprdPacote.docs.map(x => x.id));
  _secMutar(n => {
    n.prodoc = Object.fromEntries(Object.entries(n.prodoc || {}).filter(([k, v]) => vivos.has(k) || String(v.em || '') > limite)); // esquece marca velha de documento que já saiu do pacote
    if (st) n.prodoc[id] = { st, por: (usuarioAtual && usuarioAtual.nome) || '', em: _sprdAgora(), nota }; // hora local, como o resto da Secretaria
    else delete n.prodoc[id];
  }, { action: st ? 'sec_prodoc_' + st : 'sec_prodoc_desfazer', alvo: d.numero || id, detalhe: 'PRODOC ' + (d.origem || '') })
    .then(ok => { if (ok) { _mostrarToast(st === 'res' ? 'Marcado como resolvido.' : st === 'enc' ? 'Marcado como encaminhado.' : 'Marcação desfeita.', 'sucesso'); sec_renderEntrada(); } });
}

// abre "Despachos PRODOC" no modelo sugerido, com o nome já preenchido
function sec_prodocDespacho(id) {
  const d = ((_sprdPacote || {}).docs || []).find(x => x.id === id); if (!d) return;
  const s = _sprdSugestao(d), mods = _secModelos();
  const mod = mods.find(x => x.id === s.modelo) || mods.find(x => x.destino === _SPRD_DESTINO_MODELO[s.setores[0]]);
  if (!mod) { _mostrarToast('Não há modelo de despacho para ' + (s.setores[0] || 'este caso') + '.', 'erro'); return; }
  _secModeloId = mod.id;
  sec_mudarAba('despachos');
  if (mod.id !== s.modelo) _mostrarToast('Escolha o modelo certo em "PRODOC para ' + mod.destino + '" — o texto não diz qual.', 'info');
  const el = document.getElementById('sec-dp-NOME');
  if (el) { el.value = _sprdNome(d.assunto); _secPrevDespacho(); el.focus(); }
}

Object.assign(_SEC_ACOES, { sec_prodoc_enc: 'Marcou PRODOC como encaminhado', sec_prodoc_res: 'Marcou PRODOC como resolvido', sec_prodoc_desfazer: 'Desfez marcação do PRODOC' });
