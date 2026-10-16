/* ═══════════════════════════ RADAR — RASTREAMENTO EM TEMPO REAL (aba Mandado de Prisão) ═══════════════════════════
   Quem tem mandado de prisão (botão "Rastrear" na ficha do cruzamento) ou qualquer monitorado pelo código entra no
   RADAR do app Satélite Campo: foto, posição da tornozeleira a cada 1 min, rastro de 6 h e endereço onde ele está.
   Só gerência e administração. O CME fala com o servidor do CME (/radar/*), que confere a sessão e repassa ao Satélite
   com a chave dele — nenhuma chave fica no navegador. Remover tira do app na hora e apaga a ficha e o rastro.
   Depende do index (_mpApi, _mpEsc, _mpPastaAtual, _mostrarToast, usuarioAtual). Emojis só por \u{...}. Prefixo _rds. */

const _RDS_APP = 'https://satelite-campo.adr-correa30.workers.dev';
let _rdsLista = null, _rdsErro = '', _rdsLinkNovo = '', _rdsCodigoNovo = '';

function _rdsPode() { return ['admin', 'gerencia'].includes(usuarioAtual?.nivel); }
function _rdsCodigo(v) { const c = String(v == null ? '' : v).replace(/\D/g, ''); return c.length >= 3 && c.length <= 15 ? c : ''; }
function _rdsHa(ms) {
  if (!ms) return 'sem dado';
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
  return m < 1 ? 'agora' : m < 60 ? 'há ' + m + ' min' : m < 48 * 60 ? 'há ' + Math.round(m / 60) + ' h' : 'há ' + Math.round(m / 1440) + ' dias';
}
function _rdsNoRadar(reg) { const c = _rdsCodigo(reg); return !!(c && _rdsLista && _rdsLista.alvos.some(a => a.id_akiles === c)); }

async function rds_inicializar() {
  const el = document.getElementById('rds-secao'); if (!el) return;
  if (!_rdsPode()) { el.style.display = 'none'; return; }
  el.style.display = '';
  await rds_carregar();
}
async function rds_carregar() {
  try { _rdsLista = await _mpApi('/radar/lista'); _rdsErro = ''; }
  catch (e) { _rdsErro = e.message || String(e); }
  _rdsRender();
  if (typeof _mpPastaAtual !== 'undefined' && _mpPastaAtual) _rdsMarcarCartoes();
}

function _rdsRender() {
  const el = document.getElementById('rds-corpo'); if (!el) return;
  if (_rdsErro && !_rdsLista) { el.innerHTML = '<div style="color:#b91c1c;font-size:.85rem">Não consegui abrir o radar: ' + _mpEsc(_rdsErro) + '</div>'; return; }
  if (!_rdsLista) { el.innerHTML = '<div style="color:#64748b;font-size:.85rem">Carregando o radar…</div>'; return; }
  const L = _rdsLista, alvos = L.alvos || [];
  const linha = a => {
    const viaMandado = a.origem === 'mandado';
    const ficha = a.ficha_erro ? '<span style="color:#b91c1c">' + _mpEsc(a.ficha_erro) + '</span>'
      : !a.ficha_em ? '<span style="color:#b45309">\u{23F3} aguardando o robô buscar a ficha no AKILES</span>' : '';
    const sinal = a.tz_ts ? (Date.now() - a.tz_ts < 20 * 60000 ? '<b style="color:#15803d">ao vivo</b> ' : '<b style="color:#b45309">sem comunicar</b> ') + _rdsHa(a.tz_ts) : '<span style="color:#64748b">sem posição ainda</span>';
    return '<tr style="border-top:1px solid #f1f5f9">'
      + '<td style="padding:6px"><b>' + _mpEsc(a.nome || '(nome a buscar)') + '</b><div style="font-family:var(--font-mono);font-size:.75rem;color:#64748b">reg. ' + _mpEsc(a.id_akiles) + '</div>' + (ficha ? '<div style="font-size:.74rem">' + ficha + '</div>' : '') + '</td>'
      + '<td style="padding:6px"><span style="display:inline-block;font-size:.66rem;font-weight:700;padding:2px 7px;border-radius:3px;border-left:2px solid ' + (viaMandado ? '#dc2626;background:#fef2f2;color:#b91c1c">MANDADO' : '#2563eb;background:#eff6ff;color:#1d4ed8">INDIVIDUAL') + '</span>'
        + (viaMandado && a.mandado_numero ? '<div style="font-size:.72rem;color:#475569;margin-top:2px">nº ' + _mpEsc(a.mandado_numero) + (a.mandado_orgao ? ' · ' + _mpEsc(a.mandado_orgao) : '') + '</div>' : '') + '</td>'
      + '<td style="padding:6px;font-size:.8rem">' + sinal + (a.end_atual ? '<div style="color:#334155">\u{1F4CD} ' + _mpEsc(a.end_atual) + '</div>' : '') + '</td>'
      + '<td style="padding:6px;font-size:.72rem;color:#64748b">' + _mpEsc(a.adicionado_por || '') + '<div>' + (a.adicionado_em ? new Date(a.adicionado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '') + '</div></td>'
      + '<td style="padding:6px;text-align:right"><button type="button" data-rds-remover="' + _mpEsc(a.id_akiles) + '" style="background:#fff;border:1px solid #fca5a5;color:#b91c1c;border-radius:6px;padding:4px 10px;font-size:.78rem;cursor:pointer">Remover</button></td></tr>';
  };
  el.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">'
    + '<input id="rds-codigo" inputmode="numeric" maxlength="15" placeholder="Código (nº de registro)" style="padding:6px 10px;border:1px solid #cbd5e1;border-radius:6px;font-family:var(--font-mono);width:210px" onkeydown="if(event.key===\'Enter\')rds_adicionarDoCampo()">'
    + '<button type="button" onclick="rds_adicionarDoCampo()" style="background:#1f883d;color:#fff;border:1px solid rgba(31,35,40,.15);border-radius:6px;padding:6px 14px;font-weight:600;cursor:pointer">\u{1F4E1} Rastrear este código</button>'
    + '<span style="font-size:.75rem;color:#64748b">' + alvos.length + ' de ' + (L.max || 30) + ' no radar · atualiza a cada 1 min</span>'
    + '<div style="flex:1"></div><button type="button" onclick="rds_carregar()" style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:5px 12px;font-size:.8rem;cursor:pointer">\u{1F504} Atualizar</button></div>'
    + (alvos.length ? '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.82rem"><thead><tr style="color:#64748b;text-align:left;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em">'
        + ['Monitorado', 'Motivo', 'Agora', 'Colocado por', ''].map(h => '<th style="padding:4px 6px;font-weight:600">' + h + '</th>').join('') + '</tr></thead><tbody>' + alvos.map(linha).join('') + '</tbody></table></div>'
      : '<div style="font-size:.85rem;color:#64748b">Ninguém no radar. Use "Rastrear" na ficha de quem tem mandado ou digite o código acima.</div>')
    + _rdsHtmlAcesso(L);
  el.querySelectorAll('[data-rds-remover]').forEach(b => b.addEventListener('click', () => rds_remover(b.getAttribute('data-rds-remover'))));
}

// Código de acesso do app (um só). O CME não guarda o código: só mostra o link logo depois de trocar.
function _rdsHtmlAcesso(L) {
  return '<div style="margin-top:12px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:.8rem;color:#475569">'
    + '<b>Acesso no celular:</b> ' + (L.codigo_definido ? 'código gerado em ' + new Date(L.codigo_trocado_em).toLocaleString('pt-BR') + '. ' : '<span style="color:#b91c1c">ainda sem código — gere um para abrir o radar no app.</span> ')
    + ' <button type="button" onclick="rds_trocarCodigo()" style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:4px 10px;font-size:.78rem;cursor:pointer">' + (L.codigo_definido ? 'Gerar novo código' : 'Gerar código') + '</button>'
    + '<div style="font-size:.72rem;color:#94a3b8;margin-top:3px">O código é gerado pelo servidor (20 letras e números) e aparece só uma vez, aqui. Gerar outro desconecta todos os celulares com o radar aberto.</div>'
    + (_rdsLinkNovo ? '<div style="margin-top:6px;padding:8px 10px;background:#f0fdf4;border-left:3px solid #16a34a;border-radius:4px">\u{1F511} Código: <b style="font-family:var(--font-mono);letter-spacing:.06em">' + _mpEsc(_rdsCodigoNovo) + '</b> · \u{1F517} link (envie só para quem vai rastrear): <a href="' + _mpEsc(_rdsLinkNovo) + '" target="_blank" rel="noopener" style="font-family:var(--font-mono)">' + _mpEsc(_rdsLinkNovo) + '</a> <button type="button" onclick="navigator.clipboard&&navigator.clipboard.writeText(\'' + _mpEsc(_rdsLinkNovo) + '\');_mostrarToast(\'Link copiado.\',\'sucesso\')" style="background:#fff;border:1px solid #cbd5e1;border-radius:6px;padding:2px 8px;font-size:.75rem;cursor:pointer">Copiar</button></div>' : '')
    + '</div>';
}

async function rds_adicionar(reg, mandado, nome) {
  const c = _rdsCodigo(reg);
  if (!c) { _mostrarToast('Código inválido: use só os números do registro.', 'erro'); return false; }
  try {
    const r = await _mpApi('/radar/adicionar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mandado ? { id_akiles: c, mandado } : { id_akiles: c }) });
    _mostrarToast(r.ja_estava ? (nome || c) + ' já estava no radar' + (mandado ? ' (mandado atualizado)' : '') + '.' : '\u{1F4E1} ' + (nome || c) + ' entrou no radar. A posição aparece em até 1 min.', 'sucesso');
    await rds_carregar();
    return true;
  } catch (e) { _mostrarToast('Não consegui colocar no radar: ' + (e.message || e), 'erro'); return false; }
}
function rds_adicionarDoCampo() {
  const i = document.getElementById('rds-codigo'); if (!i) return;
  rds_adicionar(i.value).then(ok => { if (ok) i.value = ''; });
}
// Botão "Rastrear" na ficha do cruzamento: leva o mandado mais recente (nº, data, órgão)
function rds_rastrearDaPasta(i) {
  const x = (_mpPastaAtual && _mpPastaAtual.itens || [])[i]; if (!x) return;
  const f = x.ficha || {}, reg = _rdsCodigo(f.registro);
  if (!reg) { _mostrarToast('Sem número de registro do AKILES nesta ficha. Busque a ficha de novo ou digite o código no radar.', 'erro'); return; }
  const dt = s => { const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); return m ? m[3] + m[2] + m[1] : ''; };
  const m = (x.mandados || []).slice().sort((a, b) => dt(b.data).localeCompare(dt(a.data)))[0] || null;
  const nome = f.nome || x.monitorado;
  if (!confirm('Colocar ' + nome + ' (reg. ' + reg + ') no radar do Satélite?\n\nA posição dele passa a aparecer em tempo real para quem tem o código do radar.')) return;
  rds_adicionar(reg, m ? { numero: m.numero || '', data: m.data || '', orgao: m.orgao || '' } : { numero: '', data: '', orgao: '' }, nome);
}
async function rds_remover(reg) {
  const a = (_rdsLista && _rdsLista.alvos || []).find(x => x.id_akiles === reg);
  if (!confirm('Tirar ' + ((a && a.nome) || reg) + ' do radar?\n\nSome do app na hora, e a ficha e o rastro dele no radar são apagados.')) return;
  try { await _mpApi('/radar/remover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_akiles: reg }) }); _mostrarToast('Removido do radar.', 'sucesso'); }
  catch (e) { _mostrarToast('Não consegui remover: ' + (e.message || e), 'erro'); }
  await rds_carregar();
}
async function rds_trocarCodigo() {
  if (_rdsLista && _rdsLista.codigo_definido && !confirm('Gerar um novo código do radar? O antigo deixa de valer e todos os celulares com o radar aberto serão desconectados.')) return;
  try {
    const r = await _mpApi('/radar/codigo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const cod = String(r.codigo || '');
    if (!/^[A-Z0-9]{20}$/.test(cod)) throw new Error('resposta sem código');
    _rdsCodigoNovo = cod;
    // o código vai depois do # : essa parte do link não sai do celular (nem em log, nem na prévia do WhatsApp)
    _rdsLinkNovo = _RDS_APP + '/radar#' + cod;
    _mostrarToast('Novo código do radar gerado. Copie o link agora: ele não aparece de novo.', 'sucesso');
  } catch (e) { _mostrarToast('Não consegui trocar o código: ' + (e.message || e), 'erro'); }
  await rds_carregar();
}

// Nas fichas da pasta: botão "Rastrear" (ou "No radar") em cada cartão — chamado depois de mp_abrirPasta
function _rdsMarcarCartoes() {
  document.querySelectorAll('[data-rds-item]').forEach(b => {
    const i = +b.getAttribute('data-rds-item'), x = (_mpPastaAtual.itens || [])[i], reg = x && x.ficha && x.ficha.registro;
    const no = _rdsNoRadar(reg);
    b.textContent = no ? '\u{1F4E1} No radar' : '\u{1F4E1} Rastrear';
    b.style.background = no ? '#f0fdf4' : '#fff'; b.style.color = no ? '#15803d' : '#1d4ed8'; b.style.borderColor = no ? '#86efac' : '#93c5fd';
    b.disabled = !reg;
    b.title = !reg ? 'Sem registro do AKILES nesta ficha' : no ? 'Já está no radar (remova na lista do radar)' : 'Colocar no radar do Satélite';
  });
}
function _rdsBotaoCartao(i) {
  if (!_rdsPode()) return '';
  return '<button type="button" data-rds-item="' + i + '" onclick="event.stopPropagation();if(!this.textContent.includes(\'No radar\'))rds_rastrearDaPasta(' + i + ')" style="margin-top:6px;background:#fff;border:1px solid #93c5fd;color:#1d4ed8;border-radius:4px;padding:3px 8px;font-size:.72rem;font-weight:600;cursor:pointer">\u{1F4E1} Rastrear</button>';
}
