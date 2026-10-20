/* ═══════════ ENTRADA PRODOC — passo 2 "Despacho" (pedido de 20/10/2026) ═══════════
   Análise e resposta na mesma tela: o despacho curto (padrão da CME) ou qualquer modelo formal de
   "Despachos PRODOC", preenchido com o nome que a IA/regra achou — sem trocar de aba.
   A aba Despachos PRODOC continua para criar/editar modelos e para despacho avulso.
   Nada vai ao PRODOC por aqui: o servidor copia, cola lá e confirma na Entrada (passo 3).
   Estado só na memória da tela, por documento. Emojis só por \u{...}. Prefixo _sprdResp / sec_prodocResp. */

const _sprdResp = {}; // idDoc → { modo: 'curto' | id do modelo, vals: { idModelo: { CAMPO: valor } }, genero: 'M'|'F', copiou: bool, nota }
const _SPRD_SETOR_DO_DESTINO = { 'Relatório': 'Relatórios' }; // destino do modelo → nome do setor (o resto é igual)

function _sprdRespEstado(id) { return _sprdResp[id] || (_sprdResp[id] = { modo: 'curto', vals: {}, genero: 'M', copiou: false }); }
function _sprdRespCopiou(id) { return !!(_sprdResp[id] && _sprdResp[id].copiou); }
// só o documento (não recalcula a fila inteira a cada tecla)
const _sprdRespLinha = id => { const d = ((_sprdPacote || {}).docs || []).find(x => x.id === id); return d ? { d } : null; };
const _sprdRespModelo = st => st.modo === 'curto' ? null : _secModelos().find(m => m.id === st.modo) || null;

// valores do modelo: o que a Secretaria digitou NESTE modelo; o nome, se não digitou, vem da IA/regra (vítima nos modelos de DPP)
function _sprdRespValores(l, mod, st, formatar) {
  const p = _sprdIaPessoa(l.d.ia, mod.id), padrao = { NOME: String((p && p.nome) || _sprdNome(l.d.assunto) || '').toUpperCase() };
  const vals = {}, dig = st.vals[mod.id] || {};
  _secCamposDe(mod).forEach(k => {
    const v = String(k in dig ? dig[k] : padrao[k] || '').trim();
    vals[k] = !formatar ? v : /^DATA/.test(k) ? _secBR(v) : v.toUpperCase();
  });
  return vals;
}
const _sprdRespPara = setores => setores.length ? setores.map(x => 'CME-' + x.toUpperCase()).join(', ') : 'escolha o setor';

function _sprdBlocoResponder(l) {
  if (l.sit !== 'novo') return '';
  const id = l.d.id, idq = _jsq(id), st = _sprdRespEstado(id), mod = _sprdRespModelo(st), sug = _sprdIaDespacho(l);
  if (!mod) st.modo = 'curto';
  // seletor: curto primeiro; modelos agrupados por setor, o grupo sugerido primeiro
  const grupos = {};
  _secModelos().forEach(m => { (grupos[m.destino] = grupos[m.destino] || []).push(m); });
  const ordem = Object.keys(grupos).sort((a, b) => (sug && b === sug.mod.destino) - (sug && a === sug.mod.destino));
  const sel = '<select class="idv-select" onchange="sec_prodocRespModo(\'' + idq + '\',this.value)" style="width:100%;margin-top:8px">'
    + '<option value="curto"' + (st.modo === 'curto' ? ' selected' : '') + '>Despacho curto (padrão da CME)</option>'
    + ordem.map(g => '<optgroup label="Modelo formal — PRODOC para ' + esc(g) + '">' + grupos[g].map(m => '<option value="' + esc(m.id) + '"' + (m.id === st.modo ? ' selected' : '') + '>'
      + esc(m.titulo) + (sug && sug.mod.id === m.id ? ' (sugerido)' : '') + '</option>').join('') + '</optgroup>').join('') + '</select>';
  const caixa = (rot, html, qual, idPrev) => '<div style="display:flex;gap:8px;align-items:flex-start;margin-top:8px"><div style="flex:1;min-width:0"><span style="font-size:12px;color:var(--idv-sec)">' + rot + '</span>'
    + '<div' + (idPrev ? ' id="' + idPrev + '"' : '') + ' style="background:var(--idv-zebra);border:1px solid var(--idv-borda);border-radius:6px;padding:6px 10px;line-height:1.5;font-size:14px;color:var(--idv-texto);' + (qual === 'assunto' ? 'font-weight:600' : idPrev ? 'text-align:justify' : '') + '">' + html + '</div></div>'
    + '<button class="idv-btn mini' + (qual === 'texto' ? ' criar' : '') + '" style="margin-top:18px;white-space:nowrap" onclick="'
    + (mod ? 'sec_prodocRespCopiar' : 'sec_prodocCopiar') + '(\'' + idq + '\',\'' + qual + '\')">Copiar ' + qual + '</button></div>';
  let h = _sprdPasso(l, 2, 'Despacho') + sel;
  if (!mod) {
    const t = _sprdIaCurto(l);
    h += '<div style="font-size:13px;color:var(--idv-sec);margin-top:6px">Encaminhar no PRODOC para: <b style="color:var(--idv-texto)">' + esc(_sprdRespPara(t.setores)) + '</b>'
      + (/cópia/i.test(l.sug.fazer) && t.setores.includes('Plantão') ? ' — ' + esc(l.sug.fazer.replace(/^[^.]*\.\s*/, '')) : '') + '</div>'
      + caixa('Assunto (se for criar um PRODOC novo)', esc(t.assunto), 'assunto') + caixa('Texto do despacho', esc(t.texto), 'texto');
    return h;
  }
  const campos = _secCamposDe(mod), vals = _sprdRespValores(l, mod, st, false), prev = _sprdRespValores(l, mod, st, true), ger = _secGerente();
  h += '<div style="font-size:13px;color:var(--idv-sec);margin-top:6px">Encaminhar no PRODOC para: <b style="color:var(--idv-texto)">' + esc(_sprdRespPara([_SPRD_SETOR_DO_DESTINO[mod.destino] || mod.destino])) + '</b>'
    + (sug && sug.mod.id !== mod.id ? ' · <span style="color:var(--idv-at);font-weight:600">a sugestão era "' + esc(sug.mod.titulo) + '"</span>' : '') + '</div>'
    + '<div class="form-grid" style="margin-top:6px">' + campos.map(k => /^DATA/.test(k)
      ? _secCampo('sprd-r-' + k, _secRotulo(k), vals[k], 'type="date" oninput="sec_prodocRespPrev(\'' + idq + '\')"')
      : _secCampo('sprd-r-' + k, _secRotulo(k), vals[k], 'oninput="sec_prodocRespPrev(\'' + idq + '\')" style="text-transform:uppercase"')).join('') + '</div>'
    + (_secUsaGenero(mod) ? '<div class="idv-chips" style="margin-top:8px;font-size:13px"><span style="color:var(--idv-sec)">Gênero:</span>'
      + [['M', 'Masculino'], ['F', 'Feminino']].map(([v, r]) => '<button type="button" class="idv-chip' + (st.genero === v ? ' ativo' : '') + '" onclick="sec_prodocRespGenero(\'' + idq + '\',\'' + v + '\')" '
        + 'style="height:32px">' + r + '</button>').join('') + '</div>' : '')
    + caixa('Assunto', 'ASSUNTO: ' + _secPreencher(mod.assunto, prev, st.genero, ger, true), 'assunto', 'sprd-r-prev-assunto')
    + caixa('Texto do despacho', _secPreencher(mod.texto, prev, st.genero, ger, true), 'texto', 'sprd-r-prev-texto');
  return h;
}

function sec_prodocRespModo(id, modo) {
  const st = _sprdRespEstado(id);
  st.modo = modo === 'curto' || _secModelos().some(m => m.id === modo) ? modo : 'curto';
  st.copiou = false;
  _sprdRenderDetalhe();
}
function sec_prodocRespGenero(id, g) { const st = _sprdRespEstado(id); st.genero = g === 'F' ? 'F' : 'M'; st.copiou = false; _sprdRenderDetalhe(); }
// guarda o que foi digitado e atualiza a pré-visualização (sem redesenhar, para não perder o foco do campo)
function sec_prodocRespPrev(id) {
  const st = _sprdRespEstado(id), mod = _sprdRespModelo(st), l = _sprdRespLinha(id); if (!mod || !l) return;
  const dig = st.vals[mod.id] = st.vals[mod.id] || {};
  let mudou = false;
  _secCamposDe(mod).forEach(k => { const el = document.getElementById('sprd-r-' + k); if (el && dig[k] !== el.value) { mudou = mudou || k in dig || el.defaultValue !== el.value; dig[k] = el.value; } });
  if (mudou && st.copiou) _sprdRespCopiaVelha(st);
  const vals = _sprdRespValores(l, mod, st, true), ger = _secGerente();
  const a = document.getElementById('sprd-r-prev-assunto'), t = document.getElementById('sprd-r-prev-texto');
  if (a) a.innerHTML = 'ASSUNTO: ' + _secPreencher(mod.assunto, vals, st.genero, ger, true);
  if (t) t.innerHTML = _secPreencher(mod.texto, vals, st.genero, ger, true);
}
async function sec_prodocRespCopiar(id, qual) {
  const st = _sprdRespEstado(id), mod = _sprdRespModelo(st), l = _sprdRespLinha(id); if (!mod || !l) return;
  sec_prodocRespPrev(id);
  const vals = _sprdRespValores(l, mod, st, true), falta = Object.keys(vals).filter(k => !vals[k]);
  if (falta.length) { _mostrarToast('Preencha: ' + falta.map(_secRotulo).join(', '), 'erro'); return; }
  const ger = _secGerente(), tpl = qual === 'assunto' ? mod.assunto : mod.texto;
  const puro = _secPreencher(tpl, vals, st.genero, ger, false), html = _secPreencher(tpl, vals, st.genero, ger, true);
  try {
    if (window.ClipboardItem && qual === 'texto') await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([puro], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) })]);
    else await navigator.clipboard.writeText(puro);
    _mostrarToast((qual === 'assunto' ? 'Assunto' : 'Texto') + ' copiado — cole no PRODOC (Ctrl+V).', 'sucesso');
  } catch (e) { _mostrarToast('Não consegui copiar automaticamente — selecione o texto e use Ctrl+C.', 'erro'); return; }
  if (qual !== 'texto') return;
  auditar({ modulo: 'Secretaria', action: 'sec_despacho_copiar', alvo: l.d.numero || id, detalhe: 'Entrada PRODOC · ' + mod.titulo + ' (PRODOC para ' + mod.destino + ')' });
  _sprdRespMarcarCopia(id);
}
// mudou o texto depois de copiar: tira o aviso (sem redesenhar, para não perder o foco)
function _sprdRespCopiaVelha(st) {
  st.copiou = false;
  const a = document.getElementById('sprd-r-copiado'), b = document.getElementById('sprd-r-jaenc');
  if (a) a.remove(); if (b) b.style.boxShadow = '';
}
// depois de copiar o texto, o passo 3 destaca "Já encaminhei no PRODOC"
function _sprdRespMarcarCopia(id) { const st = _sprdRespEstado(id); if (!st.copiou) { st.copiou = true; _sprdRenderDetalhe(); } }
