/* ═══════════════════════════ SEM COMUNICAÇÃO — CONTATOS DO CADASTRO (AKILES) ═══════════════════════════
   Importa o "Cadastro completo dos monitorados" do AKILES (o .xls é uma tabela HTML) e guarda o
   telefone do monitorado e os contatos de referência SÓ de quem está sem comunicação (em aberto).
   Nada mais da planilha é guardado (CPF, endereço, filiação etc. ficam de fora).
   • Casa pelo nº de registro (_scChaveReg); se não achar, pelo nome sem acento — só se for único.
   • Grava com _scMutar (relê o banco antes). Fica em m.contato = { telefone, refs:[{nome,telefone}],
     obs, atualizadoEm, por, arquivo }. A atualização diária do AKILES mantém esse campo.
   Emojis só por \u{...} (emoji cru some no parse deste projeto). */

let _sccPlanoAtual = null;

function _sccNorm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[º°ª]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
// só dígitos; tira o 55 do país; aceita de 8 a 11 dígitos (fixo/celular, com ou sem DDD)
function _sccTel(v) {
  let d = String(v == null ? '' : v).replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  return d.length >= 8 && d.length <= 11 ? d : '';
}
function _sccFmtTel(d) {
  if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  if (d.length === 9) return d.slice(0, 5) + '-' + d.slice(5);
  return d.slice(0, 4) + '-' + d.slice(4);
}
function _sccLinkTel(d) {
  const wa = d.length === 11 && d[2] === '9'
    ? ' <a href="https://wa.me/55' + d + '" target="_blank" rel="noopener noreferrer" title="Abrir conversa no WhatsApp" style="color:var(--idv-ok);font-weight:600">WhatsApp</a>' : '';
  return '<span style="white-space:nowrap"><a href="tel:' + (d.length >= 10 ? '+55' : '') + d + '" title="Ligar" class="idv-mono" style="color:var(--idv-in)">' + _sccFmtTel(d) + '</a>' + wa + '</span>';
}

// ── Leitura da planilha ───────────────────────────────────────────────────────
async function _sccLerPlanilha(file) {
  const buf = await file.arrayBuffer();
  const inicio = new TextDecoder('latin1').decode(buf.slice(0, 300)).trim().toLowerCase();
  if (inicio.startsWith('<')) {
    let txt = new TextDecoder('utf-8').decode(buf);
    if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(buf);
    const doc = new DOMParser().parseFromString(txt, 'text/html'); // só lê o texto das células, nada é executado
    return [...doc.querySelectorAll('tr')].map(tr => [...tr.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim()));
  }
  const wb = XLSX.read(buf, { type: 'array' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }).map(r => r.map(c => String(c).replace(/\s+/g, ' ').trim()));
}
function _sccColunas(hdr) {
  const h = hdr.map(_sccNorm), achar = f => h.findIndex(f);
  const col = { nome: achar(x => x === 'nome'), registro: achar(x => /registro/.test(x) && !/data/.test(x)), telefone: achar(x => x === 'telefone'),
    obs: achar(x => /observa.*contato/.test(x)), refs: [] };
  for (let n = 1; n <= 5; n++) {
    const nome = achar(x => x === 'contato ref-' + n), tel = achar(x => x === 'telefone contato ref-' + n);
    if (nome >= 0 || tel >= 0) col.refs.push({ nome, tel });
  }
  return col;
}
// Cruza a planilha com quem está sem comunicação (em aberto). Não grava nada.
function _sccPlano(linhas, dados) {
  const iHdr = linhas.findIndex(r => { const h = r.map(_sccNorm); return h.includes('nome') && h.includes('telefone'); });
  if (iHdr < 0) throw new Error('Não achei as colunas "Nome" e "Telefone". Use o relatório "Cadastro completo dos monitorados" do AKILES.');
  const col = _sccColunas(linhas[iHdr]);
  const cel = (r, i) => (i >= 0 && i < r.length ? String(r[i] || '').trim() : '');
  const porReg = new Map(), porNome = new Map();
  let lidos = 0;
  linhas.slice(iHdr + 1).forEach(r => {
    const nome = cel(r, col.nome); if (!nome || r.length < 5) return;
    lidos++;
    const contato = { telefone: _sccTel(cel(r, col.telefone)), obs: _sccFixAcento(cel(r, col.obs)).slice(0, 400),
      refs: col.refs.map(k => ({ nome: cel(r, k.nome).slice(0, 80), telefone: _sccTel(cel(r, k.tel)) })).filter(x => x.nome || x.telefone) };
    const reg = _scChaveReg(cel(r, col.registro));
    if (reg && !porReg.has(reg)) porReg.set(reg, contato);
    const kn = _sccNorm(nome); porNome.set(kn, (porNome.get(kn) || []).concat([contato]));
  });
  const alvos = (dados.monitorados || []).filter(_scEmAberto);
  const itens = alvos.map(m => {
    let x = porReg.get(_scChaveReg(m.registro)), via = 'registro';
    if (!x) { const c = porNome.get(_sccNorm(m.nome)); if (c && c.length === 1) { x = c[0]; via = 'nome'; } }
    return { m, x, via };
  });
  const achados = itens.filter(i => i.x);
  return { lidos, total: alvos.length, achados, comTelefone: achados.filter(i => i.x.telefone || i.x.refs.some(r => r.telefone)).length,
    porNome: achados.filter(i => i.via === 'nome').length, faltando: itens.filter(i => !i.x).map(i => i.m) };
}

// ── Importar: lê, mostra a prévia e só grava ao confirmar ────────────────────
function _sccModal(titulo, corpo, botoes) {
  let ov = document.getElementById('scc-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'scc-modal'; ov.className = 'modal-overlay'; document.body.appendChild(ov); }
  ov.innerHTML = '<div class="modal-box" style="max-width:620px"><div class="modal-header"><h3>' + titulo + '</h3><button class="modal-close" onclick="document.getElementById(\'scc-modal\').classList.remove(\'open\')">\u{2715}</button></div>'
    + '<div class="modal-body">' + corpo + '</div><div class="modal-footer"><button class="btn-secondary" onclick="document.getElementById(\'scc-modal\').classList.remove(\'open\')">Cancelar</button>' + (botoes || '') + '</div></div>';
  ov.classList.add('open');
}
async function sc_importarContatos(input) {
  const f = input.files && input.files[0]; input.value = '';
  if (!f) return;
  if (f.size > 40 * 1024 * 1024) { _mostrarToast('Arquivo grande demais (máx. 40 MB).', 'erro'); return; }
  let plano;
  try {
    _mostrarToast('Lendo ' + f.name + '…');
    plano = _sccPlano(await _sccLerPlanilha(f), getSemCom());
  } catch (e) { _mostrarToast('Não consegui ler a planilha: ' + (e.message || e), 'erro'); return; }
  plano.arquivo = f.name.slice(0, 120);
  _sccPlanoAtual = plano;
  const falta = plano.faltando.slice(0, 40);
  _sccModal('\u{1F4C7} Contatos do cadastro completo',
    '<div style="font-size:14px;line-height:1.6">Planilha com <b>' + plano.lidos + '</b> monitorados cadastrados.<br>'
    + 'Sem comunicação agora: <b>' + plano.total + '</b> · encontrados na planilha: <b>' + plano.achados.length + '</b>'
    + ' (' + plano.comTelefone + ' com telefone' + (plano.porNome ? ', ' + plano.porNome + ' pelo nome' : '') + ').</div>'
    + '<div style="font-size:13px;color:var(--idv-sec);margin-top:8px">Só o telefone do monitorado, os contatos de referência e a observação de contatos são guardados — e só de quem está sem comunicação. CPF, endereço e o resto da planilha não são salvos.</div>'
    + (plano.faltando.length ? '<div style="margin-top:10px;font-size:13px"><b>Não encontrados no cadastro (' + plano.faltando.length + '):</b><div style="max-height:150px;overflow:auto;color:var(--idv-sec);margin-top:4px">'
      + falta.map(m => esc(m.nome) + ' <span class="idv-mono" style="color:var(--idv-sec)">' + esc(m.registro) + '</span>').join('<br>') + (plano.faltando.length > falta.length ? '<br>… e mais ' + (plano.faltando.length - falta.length) : '') + '</div></div>' : ''),
    plano.achados.length ? '<button class="btn-primary" id="scc-salvar" onclick="sc_salvarContatos()">Salvar ' + plano.achados.length + ' contato(s)</button>' : '');
}
async function sc_salvarContatos() {
  const plano = _sccPlanoAtual; if (!plano) return;
  const btn = document.getElementById('scc-salvar'); if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }
  const porId = new Map(plano.achados.map(i => [i.m.id, i.x]));
  const agora = new Date().toISOString(), por = usuarioAtual?.nome || '';
  let n = 0;
  const ok = await _scMutar(d => {
    d.monitorados.forEach(m => {
      const x = porId.get(m.id); if (!x || !_scEmAberto(m)) return;
      m.contato = Object.assign({}, x, { atualizadoEm: agora, por, arquivo: plano.arquivo }); n++;
    });
    if (!n) { _mostrarToast('Nenhum registro para atualizar — a lista mudou. Importe de novo.', 'erro'); return false; }
  });
  if (!ok) { if (btn) { btn.disabled = false; btn.textContent = 'Salvar'; } return; }
  try { auditar({ modulo: 'Sem Comunicação', action: 'semcom_contatos', alvo: n + ' monitorado(s)', detalhe: plano.arquivo }); } catch (e) {}
  _sccPlanoAtual = null;
  document.getElementById('scc-modal')?.classList.remove('open');
  _mostrarToast('\u{1F4DE} Contatos salvos em ' + n + ' monitorado(s) sem comunicação.', 'sucesso');
  try { renderizarSemCom('juridico'); renderizarSemCom('psicossocial'); } catch (e) {}
}

// ── Números escritos na OBSERVAÇÃO do AKILES ──────────────────────────────────
// Quando o número muda, o operador às vezes escreve o novo na observação em vez de trocar o campo.
// Lê os números do texto (com o que vem escrito ao lado como rótulo) e marca os DIFERENTES do cadastrado.
const _SCC_CP1252 = { '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A, '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E,
  '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C, 'ž': 0x9E, 'Ÿ': 0x9F };
// texto que veio do AKILES com acento quebrado ("NÃºmero" → "Número"); se não der para consertar, devolve como está
function _sccFixAcento(s) {
  // conserta cada trecho quebrado separado (o mesmo texto pode ter acento certo e quebrado)
  return String(s == null ? '' : s).replace(/(?:[ÃÂ][\u0080-¿Œ-™])+/g, trecho => {
    const bytes = [];
    for (const ch of trecho) { const c = ch.charCodeAt(0); if (c <= 0xFF) bytes.push(c); else if (_SCC_CP1252[ch] != null) bytes.push(_SCC_CP1252[ch]); else return trecho; }
    try { return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes)); } catch (e) { return trecho; }
  });
}
function _sccTelsDaObs(c) {
  const obs = _sccFixAcento(c && c.obs); if (!obs) return [];
  const conhecidos = [c.telefone].concat((c.refs || []).map(r => r.telefone)).filter(Boolean).map(t => t.slice(-8));
  const RX = /(?<!\d)(?:\(?(\d{2})\)?[\s.]*)?(9?\d{4})\s*[-.\s]?\s*(\d{4})(?!\d)/g, achados = [];
  const SEP = /(?:\(?\d{2}\)?[\s.]*)?9?\d{4}\s*[-.\s]?\s*\d{4}|[;|\n]| \/ /;   // outro número ou separador
  const limpa = t => t.replace(/^[\s\-–—>:.,()]+/, '').replace(/[\s\-–—>:.,()]+$/, '').slice(0, 40);
  let m, fimAnterior = 0;
  while ((m = RX.exec(obs))) {
    let d = (m[1] || '') + m[2] + m[3];
    if (d.length === 9 && d[0] === '9') d = '96' + d;            // celular sem DDD: Amapá
    const antes = obs.slice(fimAnterior, m.index).split(SEP).pop();
    fimAnterior = RX.lastIndex;
    if (d.length < 8 || d.length > 11 || achados.some(a => a.tel === d)) continue;
    // o que vem escrito DEPOIS do número; se não houver, o que vem ANTES ("NOVO NÚMERO 13/10 - (96) …")
    const depois = obs.slice(RX.lastIndex).split(SEP)[0];
    // texto depois que termina em ":" é o rótulo do PRÓXIMO número ("… 3333. Outro número: (96) …")
    const rotulo = (/:\s*$/.test(depois) ? '' : limpa(depois)) || limpa(antes);
    achados.push({ tel: d, rotulo, novo: !conhecidos.includes(d.slice(-8)), tipo: _sccTipoTel(rotulo) });
  }
  return achados;
}
// o que está escrito ao lado do número diz se ele serve para falar com o monitorado
function _sccTipoTel(rotulo) {
  const t = _sccNorm(rotulo);
  if (/vitima/.test(t)) return 'vitima';
  if (/erron|errad|incorret/.test(t)) return 'errado';
  if (/retid|apreendid|ciosp/.test(t)) return 'retido';
  if (/antig/.test(t)) return 'antigo';
  if (/atualiz|\bnov[oa]\b|\batual\b/.test(t)) return 'atual';
  return '';
}
const _SCC_TIPO_TEL = { vitima: ['número da VÍTIMA — não é do monitorado', 'cr'], errado: ['marcado como errado', 'ne'],
  retido: ['aparelho retido/apreendido', 'ne'], antigo: ['número antigo', 'ne'], atual: ['atualizado', 'ok'], '': ['diferente do cadastrado', 'at'] };
const _SCC_TIPOS_INUTEIS = ['vitima', 'errado', 'retido', 'antigo'];
function _sccSeloTipo(x) {
  const [txt, cls] = x.novo ? _SCC_TIPO_TEL[x.tipo] || _SCC_TIPO_TEL[''] : ['já cadastrado', 'ne'];
  return ' <span class="idv-etq ' + cls + '">' + txt + '</span>';
}

// ── Exibição ──────────────────────────────────────────────────────────────────
// linha curta abaixo do nome, na tabela
function _scLinhaContato(m) {
  const c = m && m.contato; if (!c) return '';
  const refs = (c.refs || []).filter(r => r.telefone);
  const daObs = _sccTelsDaObs(c);
  // na lista só entra número que pode ser do monitorado (antigo, errado, retido e da vítima ficam só no detalhe)
  const novos = daObs.filter(x => x.novo && !_SCC_TIPOS_INUTEIS.includes(x.tipo)).sort((a, b) => (b.tipo === 'atual') - (a.tipo === 'atual'));
  const temVitima = daObs.some(x => x.tipo === 'vitima');
  return '<div style="font-size:12px;margin-top:3px;font-weight:400;color:var(--idv-sec)">'
    + (c.telefone ? '<span style="white-space:nowrap">\u{1F4DE} ' + _sccLinkTel(c.telefone) + '</span>' :'<span style="color:var(--idv-sec)">sem telefone próprio</span>')
    + (refs.length ? ' <span style="color:var(--idv-sec);cursor:help" title="' + esc(refs.map(r => (r.nome || 'Contato') + ': ' + _sccFmtTel(r.telefone)).join(' · ')) + '">· +' + refs.length + ' de referência</span>' : '')
    + (novos.length ? '<div style="margin-top:2px"><span title="Número escrito na observação de contatos do AKILES, diferente do telefone cadastrado — pode ser o número atualizado" class="idv-etq at">NA OBSERVAÇÃO</span> '
      + _sccLinkTel(novos[0].tel) + (novos[0].rotulo ? ' <span style="color:var(--idv-sec)">' + esc(novos[0].rotulo) + '</span>' : '')
      + (novos.length > 1 ? ' <span style="color:var(--idv-sec)">· +' + (novos.length - 1) + '</span>' : '') + '</div>' : '')
    + (temVitima ? '<div style="margin-top:2px"><span title="A observação de contatos tem o telefone da vítima — abra o detalhe antes de ligar" class="idv-etq cr">\u{26A0}\u{FE0F} OBSERVAÇÃO TEM Nº DA VÍTIMA</span></div>' : '')
    + '</div>';
}
// bloco completo (modais de tratativa e de visualização)
function _scHtmlContatos(m) {
  const c = m && m.contato;
  if (!c) return '<div style="font-size:13px;color:var(--idv-sec)">Sem contato importado. Use "Importar contatos (cadastro)" na aba Sem Comunicação.</div>';
  const linha = (rot, tel) => '<div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-top:1px solid var(--idv-linha);font-size:13px"><span>' + rot + '</span><span style="white-space:nowrap">' + (tel ? _sccLinkTel(tel) : '<span style="color:var(--idv-sec)">sem número</span>') + '</span></div>';
  return linha('<b>Monitorado</b>', c.telefone)
    + (c.refs || []).map(r => linha(esc(r.nome || 'Contato de referência'), r.telefone)).join('')
    + (() => {
        const t = _sccTelsDaObs(c); if (!t.length) return '';
        return '<div style="font-size:13px;font-weight:600;color:var(--idv-at);margin-top:8px">Números escritos na observação do AKILES</div>'
          + t.map(x => linha(esc(x.rotulo || 'sem identificação') + _sccSeloTipo(x), x.tel)).join('');
      })()
    + (c.obs ? '<div style="font-size:13px;color:var(--idv-texto);margin-top:6px;white-space:pre-wrap"><b>Obs.:</b> ' + esc(_sccFixAcento(c.obs)) + '</div>' : '')
    + '<div style="font-size:12px;color:var(--idv-sec);margin-top:6px">Do cadastro do AKILES · importado em <span class="idv-data">' + new Date(c.atualizadoEm).toLocaleString('pt-BR') + '</span>' + (c.por ? ' por ' + esc(c.por) : '') + '</div>';
}

// ── Lista para contato (imprimir / salvar em PDF) ────────────────────────────
// Nome, telefones, endereço e tempo sem comunicação de quem está em aberto na área.
// O endereço NÃO fica guardado no CME: é lido na hora do "Cadastro completo dos monitorados"
// do AKILES (opcional) e só vai para a folha impressa.
let _sccListaArea = 'juridico';
function sc_imprimirLista(area) {
  _sccListaArea = area || 'juridico';
  _sccModal('\u{1F5A8}\u{FE0F} Lista para contato (PDF)',
    '<div style="font-size:14px;line-height:1.6">Sai a lista de quem está sem comunicação, com <b>telefones</b>, <b>tempo sem comunicar</b> e um espaço para o servidor anotar o resultado do contato.</div>'
    + '<div style="font-size:14px;line-height:1.6;margin-top:8px">Para incluir o <b>endereço</b>, escolha o relatório <b>"Cadastro completo dos monitorados"</b> do AKILES (.xls). O endereço só vai para a folha; não fica guardado no CME.</div>'
    + '<label class="btn-primary" style="cursor:pointer;margin-top:12px;display:inline-block">Escolher o cadastro do AKILES e gerar'
    + '<input type="file" accept=".xls,.xlsx,.html,.htm" style="display:none" onchange="sc_imprimirComCadastro(this)"></label>',
    '<button class="btn-secondary" onclick="document.getElementById(\'scc-modal\').classList.remove(\'open\');_sccImprimir(null)">Gerar sem endereço</button>');
}
async function sc_imprimirComCadastro(input) {
  const f = input.files && input.files[0]; input.value = '';
  if (!f) return;
  if (f.size > 40 * 1024 * 1024) { _mostrarToast('Arquivo grande demais (máx. 40 MB).', 'erro'); return; }
  try { _mostrarToast('Lendo ' + f.name + '…'); _sccImprimir(_sccEnderecos(await _sccLerPlanilha(f))); }
  catch (e) { _mostrarToast('Não consegui ler o cadastro: ' + (e.message || e), 'erro'); return; }
  document.getElementById('scc-modal').classList.remove('open');
}
// endereço residencial por nº de registro e por nome (só usado se o nome for único)
function _sccEnderecos(linhas) {
  const iHdr = linhas.findIndex(r => { const h = r.map(_sccNorm); return h.includes('nome') && h.some(x => /logradouro residencial/.test(x)); });
  if (iHdr < 0) throw new Error('Não achei a coluna "Logradouro Residencial". Use o relatório "Cadastro completo dos monitorados" do AKILES.');
  const h = linhas[iHdr].map(_sccNorm), ix = rx => h.findIndex(x => rx.test(x));
  const c = { nome: h.indexOf('nome'), reg: ix(/registro/), log: ix(/logradouro residencial/), num: ix(/numero residencial/), comp: ix(/complemento residencial/),
    bai: ix(/bairro residencial/), mun: ix(/municipio residencial/), uf: ix(/uf residencial/), cep: ix(/cep residencial/) };
  const cel = (r, i) => (i >= 0 && i < r.length ? _sccFixAcento(String(r[i] || '').trim()) : '');
  const porReg = new Map(), porNome = new Map();
  linhas.slice(iHdr + 1).forEach(r => {
    const nome = cel(r, c.nome); if (!nome || r.length < 10) return;
    const cep = cel(r, c.cep).replace(/\D/g, '');
    const end = [cel(r, c.log), cel(r, c.num) ? 'nº ' + cel(r, c.num) : '', cel(r, c.bai), [cel(r, c.mun), cel(r, c.uf)].filter(Boolean).join('/'),
      cep.length === 8 ? 'CEP ' + cep.slice(0, 5) + '-' + cep.slice(5) : ''].filter(Boolean).join(', ');
    const comp = cel(r, c.comp);
    const v = { end, comp: comp && !end.toUpperCase().includes(comp.toUpperCase()) ? comp.slice(0, 200) : '' };
    const reg = _scChaveReg(cel(r, c.reg)); if (reg && !porReg.has(reg)) porReg.set(reg, v);
    const kn = _sccNorm(nome); porNome.set(kn, (porNome.get(kn) || []).concat([v]));
  });
  return m => porReg.get(_scChaveReg(m.registro)) || ((porNome.get(_sccNorm(m.nome)) || []).length === 1 ? porNome.get(_sccNorm(m.nome))[0] : null);
}
function _sccImprimir(endDe) {
  const area = _sccListaArea;
  const lista = _scListaArea(getSemCom(), area).filter(_scEmAberto).sort(_scOrdemPrioridade);
  if (!lista.length) { _mostrarToast('Nenhum monitorado sem comunicação nesta área.', 'erro'); return; }
  const e = s => esc(String(s == null ? '' : s));
  const tels = m => {
    const c = m.contato || {}, out = [];
    if (c.telefone) out.push('<b>' + _sccFmtTel(c.telefone) + '</b> (próprio)');
    (c.refs || []).filter(r => r.telefone).forEach(r => out.push(_sccFmtTel(r.telefone) + ' (' + e(r.nome || 'referência') + ')'));
    _sccTelsDaObs(c).filter(x => x.novo && !_SCC_TIPOS_INUTEIS.includes(x.tipo)).forEach(x => out.push(_sccFmtTel(x.tel) + ' (' + e(x.rotulo || 'anotado no AKILES') + ')'));
    return out.length ? out.join('<br>') : '<i>sem telefone no cadastro</i>';
  };
  const titulo = area === 'psicossocial' ? 'Monitoradas com DPP sem comunicação' : 'Monitorados sem comunicação';
  const linhas = lista.map((m, i) => {
    const dias = _diasSemComAtual(m), en = endDe ? endDe(m) : null;
    return '<tr><td class="c">' + (i + 1) + '</td><td><b>' + e(m.nome) + '</b><div class="p">Reg. ' + e(m.registro) + (_scVD(m) ? ' · violência doméstica' : '') + '</div></td>'
      + '<td>' + tels(m) + '</td>'
      + (endDe ? '<td>' + (en ? e(en.end) + (en.comp ? '<div class="p">' + e(en.comp) + '</div>' : '') : '<i>não encontrado no cadastro</i>') + '</td>' : '')
      + '<td class="c"><b>' + dias + ' dia' + (dias === 1 ? '' : 's') + '</b><div class="p">desde ' + e(_scDataBR(m.ultimaComunicacao)) + '</div></td>'
      + '<td class="r"></td></tr>';
  }).join('');
  const html = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="color-scheme" content="light"><title>' + titulo + ' - lista para contato</title>'
    + '<style>html,body{background:#fff}@page{size:A4 landscape;margin:10mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0;font-size:9pt}'
    + 'h1{font-size:13pt;margin:0 0 2px}.s{font-size:9pt;margin-bottom:8px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:3px 5px;vertical-align:top}'
    + 'th{background:#e6e6e6;font-size:8.5pt}td.c{text-align:center;white-space:nowrap}td.r{width:19%}.p{font-size:8pt;color:#333}thead{display:table-header-group}tr{page-break-inside:avoid}'
    + '@media screen{body{padding:10px 16px}}@media print{.np{display:none}}</style></head><body>'
    + '<div class="np" style="text-align:right;margin-bottom:6px"><button onclick="print()" style="padding:6px 16px;font-size:11pt;cursor:pointer">Imprimir / salvar em PDF</button></div>'
    + '<h1>CME/IAPEN – ' + titulo + ' – lista para contato</h1>'
    + '<div class="s">' + lista.length + ' pessoa(s), em ordem de prioridade (mais tempo sem comunicar primeiro) · gerada em ' + new Date().toLocaleString('pt-BR') + ' · documento restrito (dados pessoais)</div>'
    + '<table><thead><tr><th>Nº</th><th style="width:20%">Nome</th><th style="width:21%">Telefones</th>' + (endDe ? '<th style="width:24%">Endereço residencial</th>' : '')
    + '<th>Sem comunicação</th><th>Resultado do contato (servidor, data, hora)</th></tr></thead><tbody>' + linhas + '</tbody></table></body></html>';
  _entregarDoc(new Blob([html], { type: 'text/html' }), titulo + ' - lista para contato.html');
  auditar({ modulo: 'Sem Comunicação', action: 'semcom_lista_contato', alvo: area, detalhe: lista.length + ' pessoa(s)' + (endDe ? ' com endereço' : '') });
}
