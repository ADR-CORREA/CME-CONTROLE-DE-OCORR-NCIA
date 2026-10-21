/* ═══════════ PASSAGEM DE SERVIÇO DO PLANTÃO — documento para imprimir (pedido de 21/10/2026) ═══════════
   Botão no Estoque do Plantão. A janela já vem preenchida com o que o sistema sabe (data, plantão que passa e
   que recebe, dia do serviço, servidor logado e as quantidades do Estoque do Plantão) e o plantonista completa o
   resto da folha (garrafões, algemas, chaves, viaturas…). Gera um A4 com o cabeçalho oficial (IAPEN, Polícia
   Penal e CME), o material com quadradinho de conferência, as viaturas, o texto automático e as duas
   assinaturas (quem passa e quem recebe) — para imprimir ou salvar em PDF e anexar no drive do plantão.
   Não grava nada no banco: os valores digitados ficam lembrados só neste computador (localStorage).
   Emojis só por \u{...}. Prefixo ep_pass / _epp. */

// [rótulo no papel, chave no Estoque do Plantão (quantidade vem do sistema) ou null (digitado)]
const _EPP_ITENS = [
  ['Tornozeleira eletrônica', 'Módulo eletrônico de monitoração'],
  ['Carregador (TNZ)', 'Carregador da tornozeleira'],
  ['Pulseiras (TNZ)', '*cintas'],
  ['Trava da pulseira', 'Trava'],
  ['DPP completo (dispositivo + carregador)', 'Dispositivo DPP'],
  ['Pulseiras de teste', null], ['Tornozeleira para JVD', null], ['Carregador DPP avulso', null],
  ['Smartphones com chip', null], ['Carregador de celular', null],
  ['Garrafões de água', null], ['Garrafão cheio', null], ['Garrafão vazio', null], ['Garrafão do plantão', null], ['Garrafão ADM', null],
  ['Algemas', null], ['Chave de algema', null], ['Chave da sala — Estado-Maior', null], ['Balança', null], ['Termômetro', null],
];
const _EPP_VIATURAS = ['Yaris / Toyota', 'L200 / Mitsubishi', 'Kwid / Renault'];
const _EPP_COMB = ['', 'Reserva', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8', 'Cheio'];
const _EPP_CHAVE_LOCAL = 'cme_passagem_ultima'; // só conveniência deste computador

function _eppUltima() { try { return JSON.parse(localStorage.getItem(_EPP_CHAVE_LOCAL) || '{}') || {}; } catch (e) { return {}; } }
function _eppGuardar(v) { try { localStorage.setItem(_EPP_CHAVE_LOCAL, JSON.stringify(v)); } catch (e) {} }
function _eppSistema(chave) {
  try {
    const it = ep_get().itens;
    if (chave === '*cintas') return EST_TAMANHOS.reduce((s, t) => s + (it['Cinta_' + t] || 0), 0);
    return it[chave] || 0;
  } catch (e) { return null; }
}
function _eppProxEquipe(eq) { const i = PLANTOES.indexOf(eq); return i < 0 ? '' : PLANTOES[(i + 1) % PLANTOES.length]; }
function _eppDataBR(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '/' + m[2] + '/' + m[1] : ''; }
function _eppMaisUmDia(iso) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + 1); return _isoLocal(d); }
function _eppAgoraLocal() { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()); }
// nomes conhecidos para o "quem recebe": servidores da Secretaria (quando carregados) e operadores do plantão
function _eppNomes() {
  const s = new Set();
  try { ((carregarStore('secretaria', null) || {}).servidores || []).forEach(x => x && x.nome && s.add(String(x.nome).toUpperCase())); } catch (e) {}
  try { Object.values((carregarStore('plantao_auto', null) || {}).operadores || {}).forEach(o => o && o.nome && s.add(String(o.nome).toUpperCase())); } catch (e) {}
  return [...s].sort().slice(0, 1500);
}

function ep_abrirPassagem() {
  if (!ep_podeVer()) { _mostrarToast('Sem permissão para a passagem de serviço.', 'erro'); return; }
  const ult = _eppUltima(), dia = _diaPlantao(), eq = _epEquipeHoje() || '';
  const opEq = sel => PLANTOES.map(p => '<option' + (p === sel ? ' selected' : '') + '>' + p + '</option>').join('');
  const campo = (lbl, html) => '<div class="form-field"><label>' + lbl + '</label>' + html + '</div>';
  const linhasItens = _EPP_ITENS.map(([rot, chave], i) => {
    const sis = chave ? _eppSistema(chave) : null, guard = (ult.itens || {})[rot] || {};
    const q = chave ? (sis == null ? '' : sis) : (guard.q != null ? guard.q : '');
    return '<tr><td><label style="display:flex;gap:8px;align-items:center;font-weight:400;font-size:14px;color:var(--idv-texto)"><input type="checkbox" id="epp-c-' + i + '"> ' + esc(rot) + '</label></td>'
      + '<td><input type="text" inputmode="numeric" id="epp-q-' + i + '" value="' + esc(q) + '" style="width:72px;height:32px;padding:0 8px;border:1px solid var(--idv-borda);border-radius:6px" aria-label="Quantidade de ' + esc(rot) + '"></td>'
      + '<td class="idv-mini">' + (chave ? 'sistema: <span class="idv-data">' + (sis == null ? '—' : sis) + '</span>' : '') + '</td>'
      + '<td><input type="text" id="epp-o-' + i + '" value="' + esc(chave ? '' : (guard.o || '')) + '" placeholder="Obs. (opcional)" style="width:100%;min-width:120px;height:32px;padding:0 8px;border:1px solid var(--idv-borda);border-radius:6px" aria-label="Observação de ' + esc(rot) + '"></td></tr>';
  }).join('');
  const linhasViat = _EPP_VIATURAS.map((v, i) => {
    const g = (ult.viaturas || {})[v] || {};
    return '<tr><td style="font-weight:600">' + esc(v) + '</td>'
      + '<td><input type="text" inputmode="numeric" id="epp-km-' + i + '" value="' + esc(g.km || '') + '" placeholder="KM" style="width:110px;height:32px;padding:0 8px;border:1px solid var(--idv-borda);border-radius:6px" aria-label="KM da ' + esc(v) + '"></td>'
      + '<td><select id="epp-cb-' + i + '" class="idv-select" style="height:32px" aria-label="Combustível da ' + esc(v) + '">' + _EPP_COMB.map(c => '<option' + (c === (g.comb || '') ? ' selected' : '') + ' value="' + c + '">' + (c || '—') + '</option>').join('') + '</select></td></tr>';
  }).join('');
  const nomes = _eppNomes();
  const corpo = '<div class="idv-secao" style="margin-top:0">Serviço</div>'
    + '<div class="form-grid">' + campo('Data e hora da passagem', '<input type="datetime-local" id="epp-dh" value="' + _eppAgoraLocal() + '">')
    + campo('Dia do serviço (08h às 08h)', '<input type="date" id="epp-dia" value="' + dia + '">') + '</div>'
    + '<div class="form-grid">' + campo('Plantão que passa', '<select id="epp-eq">' + opEq(eq) + '</select>')
    + campo('Plantão que recebe', '<select id="epp-eq2">' + opEq(_eppProxEquipe(eq)) + '</select>') + '</div>'
    + '<div class="form-grid">' + campo('Servidor que passa o serviço', '<input type="text" id="epp-passa" value="' + esc(((usuarioAtual && usuarioAtual.nome) || '').toUpperCase()) + '" style="text-transform:uppercase">')
    + campo('Servidor que recebe o serviço', '<input type="text" id="epp-recebe" list="epp-nomes" value="" placeholder="Nome de quem assume" style="text-transform:uppercase">') + '</div>'
    + '<datalist id="epp-nomes">' + nomes.map(n => '<option>' + esc(n) + '</option>').join('') + '</datalist>'
    + '<div class="idv-secao">Material carga <span class="idv-mini" style="font-weight:400">— marque o que foi conferido; as 5 primeiras quantidades vêm do Estoque do Plantão</span></div>'
    + '<div class="table-scroll" style="max-height:44vh"><table class="data-table idv-tabela"><thead><tr><th>Item</th><th>Qtd.</th><th></th><th>Observação</th></tr></thead><tbody>' + linhasItens + '</tbody></table></div>'
    + '<div class="idv-secao">Viaturas</div>'
    + '<div class="table-scroll"><table class="data-table idv-tabela"><thead><tr><th>Viatura</th><th>KM</th><th>Combustível</th></tr></thead><tbody>' + linhasViat + '</tbody></table></div>'
    + '<div class="form-field" style="margin-top:12px"><label>Observações da passagem</label><textarea id="epp-obs" rows="3" placeholder="Ocorrências do plantão, pendências, avarias…">' + esc(ult.obs || '') + '</textarea></div>';
  _epModal('\u{1F5A8}\u{FE0F} Passagem de serviço — plantão', corpo,
    _epBtn('Cancelar', "fecharModal('ep-modal')") + _epBtn('Gerar documento para imprimir', 'ep_gerarPassagem()', 'btn-primary'));
  const box = document.querySelector('#ep-modal .modal-box'); if (box) box.style.maxWidth = '860px';
}

// lê a janela, guarda o que é digitado (só neste computador) e monta o documento
function ep_gerarPassagem() {
  const v = id => ((document.getElementById(id) || {}).value || '').trim();
  const dados = {
    dh: v('epp-dh'), dia: v('epp-dia') || _diaPlantao(), eq: v('epp-eq'), eq2: v('epp-eq2'),
    passa: v('epp-passa').toUpperCase(), recebe: v('epp-recebe').toUpperCase(), obs: v('epp-obs'),
    itens: _EPP_ITENS.map(([rot, chave], i) => ({ rot, chave, q: v('epp-q-' + i), o: v('epp-o-' + i), c: !!(document.getElementById('epp-c-' + i) || {}).checked, sis: chave ? _eppSistema(chave) : null })),
    viaturas: _EPP_VIATURAS.map((nome, i) => ({ nome, km: v('epp-km-' + i), comb: v('epp-cb-' + i) })),
  };
  if (!dados.passa) { _mostrarToast('Informe o servidor que passa o serviço.', 'erro'); return; }
  const ruim = dados.itens.find(x => x.q && !/^\d{1,5}$/.test(x.q)) || dados.viaturas.find(x => x.km && !/^\d{1,3}(\.?\d{3})*$/.test(x.km));
  if (ruim) { _mostrarToast('Confira os números: quantidade e KM só com algarismos (' + (ruim.rot || ruim.nome) + ').', 'erro'); return; }
  _eppGuardar({
    itens: Object.fromEntries(dados.itens.filter(x => !x.chave).map(x => [x.rot, { q: x.q, o: x.o }])),
    viaturas: Object.fromEntries(dados.viaturas.map(x => [x.nome, { km: x.km, comb: x.comb }])),
  });
  const html = _eppDocumento(dados);
  _entregarDoc(new Blob([html], { type: 'text/html' }), 'Passagem de servico ' + dados.dia + ' ' + dados.eq + '.html');
  try { auditar({ modulo: 'Estoque Plantão', action: 'ep_passagem_imprimir', alvo: 'Passagem de serviço ' + _eppDataBR(dados.dia), detalhe: 'plantão ' + dados.eq + ' → ' + dados.eq2 }); } catch (e) {}
  fecharModal('ep-modal');
}

// texto corrido "como o do papel" (resumo de tudo em uma linha)
function _eppTextoAuto(d) {
  const it = d.itens.filter(x => x.q !== '').map(x => x.q.padStart(2, '0') + ' ' + x.rot.toUpperCase()).join('; ');
  const vi = d.viaturas.filter(x => x.km || x.comb).map(x => x.nome.toUpperCase() + ' — KM: ' + (x.km || '—') + ', COMB.: ' + (x.comb || '—')).join('; ');
  return 'MATERIAL DISPONÍVEL NA PASSAGEM DO SERVIÇO: ' + (it || 'NÃO INFORMADO') + '.' + (vi ? ' VIATURAS NA PASSAGEM DO SERVIÇO: ' + vi + '.' : '');
}

function _eppDocumento(d) {
  const img = (b64, tipo, alt) => b64 ? '<img src="data:' + tipo + ';base64,' + b64 + '" alt="' + alt + '" style="height:66px;width:auto">' : '';
  const dhTxt = d.dh ? _eppDataBR(d.dh) + ' às ' + d.dh.slice(11, 16) : '';
  const diaFim = _eppMaisUmDia(d.dia);
  const box = (rot, val) => '<td style="padding:4px 8px;width:25%"><div style="font-size:7.5pt;color:#444;text-transform:uppercase;letter-spacing:.04em">' + rot + '</div><div style="font-size:10.5pt;font-weight:bold">' + val + '</div></td>';
  // material em duas colunas, como na folha de papel
  const metade = Math.ceil(d.itens.length / 2), col = (lst) => lst.map(x => '<tr><td style="width:18px;text-align:center;font-size:11pt">' + (x.c ? '&#9745;' : '&#9744;') + '</td>'
    + '<td>' + esc(x.rot) + (x.o ? '<div style="font-size:7.5pt;color:#444">' + esc(x.o) + '</div>' : '') + '</td>'
    + '<td style="width:48px;text-align:center;font-weight:bold">' + (x.q !== '' ? esc(x.q.padStart(2, '0')) : '&nbsp;') + (x.chave && x.sis != null && x.q !== '' && +x.q !== +x.sis ? '<div style="font-size:6.5pt;font-weight:normal;color:#a00">sistema: ' + esc(String(x.sis)) + '</div>' : '') + '</td></tr>').join('');
  // pedido do Adriano (21/10/2026): esta folha leva a assinatura cadastrada de quem gerou, mesmo com o interruptor
  // _IMPRIMIR_ASSINATURA_NOS_DOCS desligado para os ofícios; só sai se quem passa o serviço for o próprio servidor logado
  const ass = (() => { try { return (usuarioAtual && usuarioAtual.usuario && _getAssinaturaDe(usuarioAtual.usuario)) || null; } catch (e) { return null; } })();
  const quemGerou = ((usuarioAtual && usuarioAtual.nome) || '').toUpperCase();
  const assPassa = ass && /^data:image\/(png|jpe?g|webp);base64,/.test(ass) && d.passa === quemGerou ? '<img src="' + esc(ass) + '" alt="Assinatura" style="max-height:52px;max-width:220px">' : '';
  const assinatura = (tit, nome, eq, imgAss) => '<td style="width:50%;vertical-align:top;padding:0 10px">'
    + '<div style="font-size:8pt;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">' + tit + '</div>'
    + '<div style="border:1px solid #000;height:64px;display:flex;align-items:center;justify-content:center">' + (imgAss || '') + '</div>' // sem imagem: quadro em branco para assinar à caneta
    + '<div style="text-align:center;margin-top:4px;font-size:9.5pt;font-weight:bold">' + (nome ? esc(nome) : '&nbsp;') + '</div>'
    + '<div style="text-align:center;font-size:8.5pt">Plantão ' + esc(eq || '—') + ' · Central de Monitoramento Eletrônico – CME/IAPEN</div></td>';
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="color-scheme" content="light"><title>Passagem de serviço - ' + esc(_eppDataBR(d.dia)) + ' - ' + esc(d.eq) + '</title>'
    + '<style>html,body{background:#fff}@page{size:A4 portrait;margin:8mm 10mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0;font-size:9.5pt}'
    + 'table{border-collapse:collapse;width:100%}.g td,.g th{border:1px solid #000;padding:3px 6px}.tit{background:#d9d9d9;font-weight:bold;text-transform:uppercase;font-size:9pt;padding:4px 8px;border:1px solid #000;border-bottom:0;margin-top:8px}'
    + '@media screen{body{padding:12px 18px;max-width:820px;margin:0 auto}}@media print{.np{display:none}}</style></head><body>'
    + '<div class="np" style="text-align:right;margin-bottom:6px"><button onclick="print()" style="padding:6px 16px;font-size:11pt;cursor:pointer">Imprimir / salvar em PDF</button></div>'
    // cabeçalho oficial (mesmo da escala de apoio)
    + '<div style="display:flex;align-items:center;gap:8px;border-bottom:1.5px solid #000;padding-bottom:4px">'
    + img(window._IAPEN_LOGO_B64, 'image/png', 'IAPEN') + img(window._PPENAL_LOGO_B64, 'image/jpeg', 'Polícia Penal')
    + '<div style="flex:1;text-align:center;font-weight:bold;font-size:8.5pt;line-height:1.7">GOVERNO DO ESTADO DO AMAPÁ<br>SECRETARIA DE ESTADO DE JUSTIÇA E SEGURANÇA PÚBLICA - SEJUSP<br>INSTITUTO DE ADMINISTRAÇÃO PENITENCIÁRIA - IAPEN<br>CENTRAL DE MONITORAMENTO ELETRÔNICO - CME</div>'
    + img(window._CME_LOGO_B64, 'image/png', 'CME') + '</div>'
    + '<div style="text-align:center;font-weight:bold;font-size:14pt;margin:10px 0 6px">PASSAGEM DE SERVIÇO — PLANTÃO</div>'
    + '<table class="g"><tr>' + box('Data e hora', esc(dhTxt)) + box('Dia do serviço', esc(_eppDataBR(d.dia)) + ' 08h às ' + esc(_eppDataBR(diaFim)) + ' 08h')
    + box('Plantão que passa', esc(d.eq || '—')) + box('Plantão que recebe', esc(d.eq2 || '—')) + '</tr></table>'
    + '<div class="tit">Material carga</div>'
    + '<table class="g"><tr><td style="padding:0;vertical-align:top;width:50%"><table class="g" style="border:0">' + col(d.itens.slice(0, metade)) + '</table></td>'
    + '<td style="padding:0;vertical-align:top;width:50%"><table class="g" style="border:0">' + col(d.itens.slice(metade)) + '</table></td></tr></table>'
    + '<div class="tit">Viaturas</div>'
    + '<table class="g"><tr><th style="text-align:left">Viatura</th><th style="width:28%">KM</th><th style="width:28%">Combustível</th></tr>'
    + d.viaturas.map(x => '<tr><td>' + esc(x.nome) + '</td><td style="text-align:center;font-weight:bold">' + (esc(x.km) || '&nbsp;') + '</td><td style="text-align:center;font-weight:bold">' + (esc(x.comb) || '&nbsp;') + '</td></tr>').join('') + '</table>'
    + '<div class="tit">Texto gerado automático</div>'
    + '<div style="border:1px solid #000;padding:6px 8px;font-size:8.5pt;line-height:1.45;text-align:justify">' + esc(_eppTextoAuto(d)) + '</div>'
    + '<div class="tit">Observações</div>'
    + '<div style="border:1px solid #000;padding:6px 8px;min-height:48px;font-size:9pt;white-space:pre-wrap">' + (esc(d.obs) || '&nbsp;') + '</div>'
    + '<table style="margin-top:16px"><tr>' + assinatura('Servidor que passa o serviço', d.passa, d.eq, assPassa) + assinatura('Servidor que recebe o serviço', d.recebe, d.eq2, '') + '</tr></table>'
    + '<div style="border-top:1.5px solid #000;margin-top:14px;padding-top:5px;text-align:center;font-size:7.5pt;line-height:1.6"><b>CENTRAL DE MONITORAMENTO ELETRÔNICO – CME -</b> Av. Machado de Assis, 372 – Centro - CEP: 68900-066, Macapá-AP.<br>Email: cme@iapen.ap.gov.br - Telefone (96) 98415 2844'
    + '<br><span style="color:#555">Documento gerado no sistema do CME por ' + esc(quemGerou || '—') + ' em ' + esc(new Date().toLocaleString('pt-BR')) + '</span></div>'
    + '</body></html>';
}

Object.assign(window, { ep_abrirPassagem, ep_gerarPassagem });
