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
  if (_rdsErro && !_rdsLista) { el.innerHTML = '<div class="idv-faixa cr"><span>Não consegui abrir o radar: ' + _mpEsc(_rdsErro) + '</span></div>'; return; }
  if (!_rdsLista) { el.innerHTML = '<div style="color:var(--idv-sec);font-size:13px">Carregando o radar…</div>'; return; }
  const L = _rdsLista, alvos = L.alvos || [];
  const linha = a => {
    const viaMandado = a.origem === 'mandado';
    let al = null; try { al = a.tz_alertas ? JSON.parse(a.tz_alertas) : null; } catch (e) { al = null; }
    const alertasAk = (al && al.rompida ? '<div class="idv-det cr">PULSEIRA ROMPIDA</div>' : '') + (al && al.descarregada ? '<div class="idv-det at">BATERIA DESCARREGADA</div>' : '');
    const ficha = a.ficha_erro ? '<span style="color:var(--idv-cr)">' + _mpEsc(a.ficha_erro) + '</span>'
      : !a.ficha_em ? '<span style="color:var(--idv-at)">\u{23F3} aguardando o robô buscar a ficha no AKILES</span>' : '';
    const sinal = a.tz_ts ? (Date.now() - a.tz_ts < 20 * 60000 ? '<b style="color:var(--idv-ok);font-weight:600">ao vivo</b> ' : '<b style="color:var(--idv-at);font-weight:600">sem comunicar</b> ') + '<span class="idv-data">' + _rdsHa(a.tz_ts) + '</span>' : '<span style="color:var(--idv-sec)">sem posição ainda</span>';
    // situação como faixa à esquerda da linha (só visual): pulseira rompida = vermelho; bateria ou sem comunicar = amarelo
    const faixa = al && al.rompida ? 'var(--idv-cr)' : (al && al.descarregada) || (a.tz_ts && Date.now() - a.tz_ts >= 20 * 60000) ? 'var(--idv-at)' : '';
    return '<tr' + (faixa ? ' style="box-shadow:inset 3px 0 0 ' + faixa + '"' : '') + '>'
      + '<td><div class="idv-nome">' + _mpEsc(a.nome || '(nome a buscar)') + '</div><div class="idv-mini">reg. <span class="idv-mono">' + _mpEsc(a.id_akiles) + '</span></div>' + (ficha ? '<div style="font-size:12px;margin-top:2px">' + ficha + '</div>' : '') + '</td>'
      + '<td>' + (viaMandado ? '<span class="idv-etq cr">MANDADO</span>' : '<span class="idv-etq in">INDIVIDUAL</span>')
        + (viaMandado && a.mandado_numero ? '<div class="idv-mini" style="margin-top:3px">nº <span class="idv-mono">' + _mpEsc(a.mandado_numero) + '</span>' + (a.mandado_orgao ? ' · ' + _mpEsc(a.mandado_orgao) : '') + '</div>' : '') + '</td>'
      + '<td style="font-size:13px">' + sinal + alertasAk + (a.end_atual ? '<div style="color:var(--idv-texto)">\u{1F4CD} ' + _mpEsc(a.end_atual) + '</div>' : '') + '</td>'
      + '<td style="font-size:12px;color:var(--idv-sec)">' + _mpEsc(a.adicionado_por || '') + '<div class="idv-data">' + (a.adicionado_em ? new Date(a.adicionado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '') + '</div></td>'
      + '<td style="text-align:right"><button type="button" class="idv-btn mini perigo" data-rds-remover="' + _mpEsc(a.id_akiles) + '">Remover</button></td></tr>';
  };
  el.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">'
    + '<input id="rds-codigo" inputmode="numeric" maxlength="15" placeholder="Código (nº de registro)" style="height:32px;padding:0 10px;border:1px solid var(--idv-borda);border-radius:6px;font-family:var(--idv-mono);font-size:14px;width:210px" onkeydown="if(event.key===\'Enter\')rds_adicionarDoCampo()">'
    + '<button type="button" class="idv-btn mini criar" onclick="rds_adicionarDoCampo()">\u{1F4E1} Rastrear este código</button>'
    + '<span style="font-size:12px;color:var(--idv-sec)"><span class="idv-data">' + alvos.length + ' de ' + (L.max || 30) + '</span> no radar · atualiza a cada 1 min</span>'
    + '<div style="flex:1"></div><button type="button" class="idv-btn mini" onclick="rds_carregar()">\u{1F504} Atualizar</button></div>'
    + (alvos.length ? '<div class="table-scroll"><table class="data-table idv-tabela"><thead><tr>'
        + ['Monitorado', 'Motivo', 'Agora', 'Colocado por', ''].map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' + alvos.map(linha).join('') + '</tbody></table></div>'
      : '<div style="font-size:14px;color:var(--idv-sec);padding:12px 0">Ninguém no radar. Use "Rastrear" na ficha de quem tem mandado ou digite o código acima.</div>')
    + _rdsHtmlAcesso(L);
  el.querySelectorAll('[data-rds-remover]').forEach(b => b.addEventListener('click', () => rds_remover(b.getAttribute('data-rds-remover'))));
  // copiar o link sem montar o texto dentro de onclick (senha escolhida pode ter aspas e símbolos)
  el.querySelectorAll('[data-rds-copiar]').forEach(b => b.addEventListener('click', () => { if (navigator.clipboard) navigator.clipboard.writeText(_rdsLinkNovo); _mostrarToast('Link copiado.', 'sucesso'); }));
}

// Código de acesso do app (um só). O CME não guarda o código: só mostra o link logo depois de trocar.
function _rdsHtmlAcesso(L) {
  return '<div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--idv-linha);font-size:13px;color:var(--idv-sec)">'
    + '<b>Acesso no celular:</b> ' + (L.codigo_definido ? 'senha gerada em <span class="idv-data">' + new Date(L.codigo_trocado_em).toLocaleString('pt-BR') + '</span>. ' : '<span style="color:var(--idv-cr)">ainda sem senha — gere uma para abrir o radar no celular.</span> ')
    + ' <button type="button" class="idv-btn mini" onclick="rds_trocarCodigo()">' + (L.codigo_definido ? 'Gerar nova senha' : 'Gerar senha') + '</button>'
    + ' <span style="color:var(--idv-sec)">ou</span> <input id="rds-senha-propria" type="password" autocomplete="new-password" maxlength="40" placeholder="escolha a senha" style="height:32px;padding:0 10px;border:1px solid var(--idv-borda);border-radius:6px;width:170px;font-size:14px">'
    + ' <button type="button" class="idv-btn mini" onclick="rds_cadastrarSenha()">Cadastrar senha</button>'
    + '<div style="font-size:12px;color:var(--idv-sec);margin-top:6px">Gere uma senha forte (20 letras e números, aparece só uma vez, aqui) ou cadastre a sua: de 8 a 40 caracteres, sem espaço, com letra e número. Trocar a senha desconecta todos os celulares com o radar aberto.</div>'
    + (_rdsLinkNovo ? '<div class="idv-faixa ok" style="margin-top:8px"><span>' + (_rdsCodigoNovo ? '\u{1F511} Senha: <b class="idv-mono" style="letter-spacing:.06em">' + _mpEsc(_rdsCodigoNovo) + '</b> · ' : '\u{1F511} Senha cadastrada. · ') + '\u{1F517} link (envie só para quem vai rastrear; ele já leva a senha): <a href="' + _mpEsc(_rdsLinkNovo).replace(/"/g, '&quot;') + '" target="_blank" rel="noopener" class="idv-mono" style="color:var(--idv-in)">' + _mpEsc(_rdsLinkNovo) + '</a> <button type="button" class="idv-btn mini" data-rds-copiar="1">Copiar</button></span></div>' : '')
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
// Depois do cruzamento: confirmados com identidade conferida entram sozinhos no radar (um aviso só no fim)
async function rds_adicionarVarios(lista) {
  if (!_rdsPode() || !lista || !lista.length) return;
  let novos = 0, jaEstavam = 0, falhas = 0, cheio = false;
  for (const x of lista) {
    const c = _rdsCodigo(x.reg); if (!c) { falhas++; continue; }
    try {
      const r = await _mpApi('/radar/adicionar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_akiles: c, mandado: x.mandado || { numero: '', data: '', orgao: '' } }) });
      if (r.ja_estava) jaEstavam++; else novos++;
    } catch (e) { if (/já tem \d+ monitorados/.test(e.message || '')) { cheio = true; break; } falhas++; }
  }
  _mostrarToast('\u{1F4E1} Radar: ' + novos + ' confirmado(s) entraram' + (jaEstavam ? ', ' + jaEstavam + ' já estavam' : '') + (cheio ? ' — o radar ficou CHEIO, remova alguém' : '') + (falhas ? ' (' + falhas + ' com erro)' : '') + '.', cheio || falhas ? 'erro' : 'sucesso');
  await rds_carregar();
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
// Senha escolhida pela gerência (16/10/2026, pedido do Adriano). O servidor confere as mesmas regras e guarda só o hash.
async function rds_cadastrarSenha() {
  const i = document.getElementById('rds-senha-propria'), cod = String(i && i.value || '');
  if (cod.length < 8 || cod.length > 40 || /\s/.test(cod) || !/[A-Za-z]/.test(cod) || !/\d/.test(cod)) {
    _mostrarToast('A senha precisa ter de 8 a 40 caracteres, sem espaço, com pelo menos uma letra e um número.', 'erro'); return;
  }
  if (_rdsLista && _rdsLista.codigo_definido && !confirm('Trocar a senha do radar pela que você digitou? A antiga deixa de valer e todos os celulares com o radar aberto serão desconectados.')) return;
  try {
    await _mpApi('/radar/codigo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ codigo: cod }) });
    _rdsCodigoNovo = ''; // a senha escolhida não é mostrada de volta
    _rdsLinkNovo = _RDS_APP + '/radar#' + encodeURIComponent(cod);
    if (i) i.value = '';
    _mostrarToast('Senha do radar cadastrada. Use a mesma no celular (maiúsculas e minúsculas tanto faz).', 'sucesso');
  } catch (e) { _mostrarToast('Não consegui cadastrar a senha: ' + (e.message || e), 'erro'); }
  await rds_carregar();
}
async function rds_trocarCodigo() {
  if (_rdsLista && _rdsLista.codigo_definido && !confirm('Gerar uma nova senha do radar? A antiga deixa de valer e todos os celulares com o radar aberto serão desconectados.')) return;
  try {
    const r = await _mpApi('/radar/codigo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    const cod = String(r.codigo || '');
    if (!/^[A-Z0-9]{20}$/.test(cod)) throw new Error('resposta sem código');
    _rdsCodigoNovo = cod;
    // o código vai depois do # : essa parte do link não sai do celular (nem em log, nem na prévia do WhatsApp)
    _rdsLinkNovo = _RDS_APP + '/radar#' + cod;
    _mostrarToast('Nova senha do radar gerada. Copie agora: ela não aparece de novo.', 'sucesso');
  } catch (e) { _mostrarToast('Não consegui trocar o código: ' + (e.message || e), 'erro'); }
  await rds_carregar();
}

// Nas fichas da pasta: botão "Rastrear" (ou "No radar") em cada cartão — chamado depois de mp_abrirPasta
function _rdsMarcarCartoes() {
  document.querySelectorAll('[data-rds-item]').forEach(b => {
    const i = +b.getAttribute('data-rds-item'), x = (_mpPastaAtual.itens || [])[i], reg = x && x.ficha && x.ficha.registro;
    const no = _rdsNoRadar(reg);
    b.textContent = no ? '\u{1F4E1} No radar' : '\u{1F4E1} Rastrear';
    b.style.background = no ? 'var(--idv-ok-f)' : 'var(--idv-cartao)'; b.style.color = no ? 'var(--idv-ok)' : 'var(--idv-in)'; b.style.borderColor = no ? 'var(--idv-ok)' : 'var(--idv-borda)';
    b.disabled = !reg;
    b.title = !reg ? 'Sem registro do AKILES nesta ficha' : no ? 'Já está no radar (remova na lista do radar)' : 'Colocar no radar do Satélite';
  });
}
function _rdsBotaoCartao(i) {
  if (!_rdsPode()) return '';
  return '<button type="button" data-rds-item="' + i + '" onclick="event.stopPropagation();if(!this.textContent.includes(\'No radar\'))rds_rastrearDaPasta(' + i + ')" style="margin-top:6px;background:var(--idv-cartao);border:1px solid var(--idv-borda);color:var(--idv-in);border-radius:6px;padding:3px 8px;font-size:12px;font-weight:600;cursor:pointer">\u{1F4E1} Rastrear</button>';
}
