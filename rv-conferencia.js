/* ═══ Conferência das violações antes de gerar o relatório (prefixo rvc_) ═══════════
   Pedido do Adriano (22/10/2026): o Gerador de Violações faz sozinho a análise que antes
   era feita à mão, para nenhuma violação errada ir ao Judiciário. Regras FIXAS (sem IA):
   • ocorrência ainda EM ANDAMENTO no AKILES (duração vai até agora, não é real) → trava;
   • duração acima de 7 dias → trava (ocorrência que ficou aberta);
   • operador marcou "7. não confirmada" → trava (sugere retirar), salvo bateria > 15 min,
     que pela regra da gerência é violação confirmada (aí só avisa para corrigir o tratamento);
   • texto do operador contradiz o procedimento marcado → aviso;
   • sem tratamento do operador → aviso;
   • saída de zona de INCLUSÃO de 24 h ou mais (feriado/fim de semana) → aviso "confira no SEEU
     se era saída temporária autorizada";
   • GPS × horário da ocorrência (o robô devolve junto com o mapa) → trava se não bate.
   Fluxo: rv_gerarSelecionados → rvc_antesDeGerar → (decisões) → rvj_antesDeGerar (justificativas)
   → rv_gerarSelecionados(modo, gruposConferidos). As funções puras são testadas em node. */

const RVC_DIAS_LONGA = 7;            // acima disto a ocorrência quase certamente ficou aberta
const RVC_BATERIA_MIN = 15;          // descarga acima disto = violação confirmada (regra da gerência)
const RVC_SAIDA_LONGA_H = 24;        // inclusão: saída de 24 h ou mais → padrão de saída temporária
let _rvc_decisoes = {};              // idOc → { acao, motivo } (reaproveitado se gerar de novo)

function _rvcNorm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }

// "0d 16h 51min" / "305d 21h 27min" / "45min" → minutos
function rvc_duracaoMin(s) {
  const t = String(s || ''), n = re => { const m = t.match(re); return m ? +m[1] : 0; };
  if (!/\d/.test(t)) return null;
  return n(/(\d+)\s*d/i) * 1440 + n(/(\d+)\s*h/i) * 60 + n(/(\d+)\s*min/i);
}

// "dd/mm/aaaa hh:mm" (já normalizado pelo Gerador) → Date local
function rvc_data(s) {
  const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\D+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const a = +m[3] < 100 ? 2000 + +m[3] : +m[3];
  return new Date(a, +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
}

// Comentário do AKILES: "id:12 operador:FULANO comentário:TEXTO procedimento:6. VIOLAÇÃO CONFIRMADA | id:..."
function rvc_tratamentos(comentario) {
  return String(comentario || '').split(/\s*\|\s*(?=id:)/).map(p => p.trim()).filter(Boolean).map(p => {
    const op = (p.match(/operador:\s*(.*?)\s+coment[aá]rio:/i) || [])[1] || '';
    const tx = (p.match(/coment[aá]rio:\s*([\s\S]*?)(?:\s+procedimento:|$)/i) || [])[1] || '';
    const pr = p.match(/procedimento:\s*(\d+)\.?\s*([^|]*)/i);
    return { operador: op.trim(), texto: tx.trim(), proc: pr ? +pr[1] : null, procTexto: pr ? (pr[1] + '. ' + pr[2].trim()) : '' };
  });
}

/* Feriados nacionais (fixos + móveis) e do Amapá/Macapá — só para nomear o período no aviso. */
function _rvcPascoa(Y) { // algoritmo gregoriano anônimo (Meeus/Jones/Butcher)
  const a = Y % 19, b = Math.floor(Y / 100), c = Y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(Y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
}
function rvc_feriados(ano) {
  const f = {}, put = (d, nome) => { f[d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()] = nome; };
  [[1, 1, 'Confraternização Universal'], [2, 4, 'Aniversário de Macapá'], [3, 19, 'São José (padroeiro do Amapá)'], [4, 21, 'Tiradentes'], [5, 1, 'Dia do Trabalho'],
   [9, 7, 'Independência'], [9, 13, 'Criação do Território do Amapá'], [10, 12, 'Nossa Senhora Aparecida'], [11, 2, 'Finados'], [11, 15, 'Proclamação da República'],
   [11, 20, 'Consciência Negra'], [12, 25, 'Natal']].forEach(([m, d, n]) => put(new Date(ano, m - 1, d), n));
  const p = _rvcPascoa(ano), mais = (n, nome) => put(new Date(p.getFullYear(), p.getMonth(), p.getDate() + n), nome);
  mais(-48, 'Carnaval'); mais(-47, 'Carnaval'); mais(-2, 'Sexta-feira Santa'); mais(60, 'Corpus Christi');
  return f;
}
// O que o período [ini, fim] cobre: feriados e fim de semana (nomes distintos, na ordem)
function rvc_marcosDoPeriodo(ini, fim) {
  if (!ini || !fim || fim < ini) return [];
  const out = [], cache = {};
  const d = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate()), ult = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
  for (let n = 0; d <= ult && n < 60; n++, d.setDate(d.getDate() + 1)) {
    const fer = (cache[d.getFullYear()] = cache[d.getFullYear()] || rvc_feriados(d.getFullYear()))[d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()];
    if (fer && !out.includes(fer)) out.push(fer);
    if ((d.getDay() === 0 || d.getDay() === 6) && !out.includes('fim de semana')) out.push('fim de semana');
  }
  return out;
}

const _RVC_TEXTO_NAO_HOUVE = /DESCONSIDER|N[AÃ]O (ENTROU|SAIU|HOUVE|CARACTERIZ)|FALHA (DE|NO) (SINAL|GPS)|DERIVA|JUSTIFICOU|APRESENTOU JUSTIFICATIVA|JUSTIFICATIVA (APRESENTADA|ACEITA)|(?<!N[AÃ]O )AUTORIZAD[OA] (PELO|PELA|JUDICIAL)/;
const _RVC_TEXTO_HOUVE = /VIOLOU|DESCUMPRIU|DESCUMPRINDO/;

/* Núcleo: confere UMA violação. v = linha do Gerador (tipo, idOc, ocorreu, fim, duracao, situacao,
   atendimento, comentario, gps?). Devolve { nivel: 'ok'|'aviso'|'trava', achados[], sugestao }. */
function rvc_conferir(v) {
  const achados = [], add = (nivel, codigo, texto) => achados.push({ nivel, codigo, texto });
  const tipo = _rvcNorm(v.tipo), bateria = /BATERIA|CARGA/.test(tipo), inclusao = /INCLUS/.test(tipo), exclusao = /EXCLUS/.test(tipo);
  const dur = rvc_duracaoMin(v.duracao), sit = _rvcNorm(v.situacao), atd = _rvcNorm(v.atendimento);
  const fmtDur = v.duracao ? String(v.duracao).trim() : '';
  let sugestao = null;

  // 1) ocorrência que não fechou no AKILES
  if (/ANDAMENTO|ABERT/.test(sit)) {
    add('trava', 'aberta', 'A ocorrência ainda está EM ANDAMENTO no AKILES' + (/ARQUIV/.test(atd) ? ' e foi ARQUIVADA sem ter sido restabelecida' : '')
      + '. A duração (' + (fmtDur || '—') + ') vai até a hora da consulta — não é o tempo real da violação.');
    sugestao = 'retirar';
  } else if (dur != null && dur > RVC_DIAS_LONGA * 1440) {
    add('trava', 'longa', 'Duração de ' + fmtDur + ' (mais de ' + RVC_DIAS_LONGA + ' dias): confira no AKILES se a ocorrência não ficou aberta por falha de encerramento.');
  }

  // 2) tratamento do operador
  const trat = rvc_tratamentos(v.comentario), comProc = trat.filter(t => t.proc != null), final = comProc.length ? comProc[comProc.length - 1] : null;
  const textos = _rvcNorm(trat.map(t => t.texto).join(' '));
  if (!trat.length && v.comentario !== undefined) add('aviso', 'sem-tratamento', 'Sem tratamento registrado pelo operador no AKILES.');
  if (final && final.proc === 7) {
    if (bateria && dur != null && dur > RVC_BATERIA_MIN) {
      add('aviso', 'bateria-7', 'O operador marcou "7. não confirmada", mas descarga acima de ' + RVC_BATERIA_MIN + ' min é violação confirmada pela regra da CME — mantida; corrija o tratamento no AKILES' + (final.operador ? ' (' + final.operador + ')' : '') + '.');
    } else {
      add('trava', 'nao-confirmada', 'O operador marcou "' + final.procTexto + '"' + (final.operador ? ' (' + final.operador + ')' : '') + ' — não é violação confirmada.');
      sugestao = sugestao || 'retirar';
    }
    if (_RVC_TEXTO_HOUVE.test(textos)) add('aviso', 'contradicao', 'O texto do operador fala em descumprimento, mas o procedimento marcado é "não confirmada".');
  } else if (final && final.proc === 6) {
    if (_RVC_TEXTO_NAO_HOUVE.test(textos)) add('aviso', 'contradicao', 'Marcada como violação confirmada, mas o texto do operador indica que não houve violação ou que havia justificativa/autorização: "' + trat.map(t => t.texto).join(' / ').slice(0, 220) + '".');
  } else if (final && final.proc != null) {
    add('aviso', 'procedimento', 'Procedimento marcado: "' + final.procTexto + '" — confira se é violação.');
  } else if (trat.length) {
    add('aviso', 'sem-procedimento', 'O operador comentou, mas não marcou o procedimento (6 ou 7).');
  }

  // 3) saída longa de zona de inclusão → padrão de saída temporária
  if (inclusao && dur != null && dur >= RVC_SAIDA_LONGA_H * 60 && !achados.some(a => a.codigo === 'aberta' || a.codigo === 'longa')) {
    const marcos = rvc_marcosDoPeriodo(rvc_data(v.ocorreu), rvc_data(v.fim) || new Date(rvc_data(v.ocorreu)?.getTime() + dur * 60000));
    add('aviso', 'saida-temporaria', 'Saída de ' + fmtDur + ' da zona de inclusão' + (marcos.length ? ' cobrindo ' + marcos.join(', ') : '')
      + ' — padrão de saída temporária. Confira no SEEU se havia autorização antes de enviar.');
  }

  // 4) GPS × ocorrência (preenchido pelo robô junto com o mapa)
  if (v.gps && v.gps.verificado) {
    if (v.gps.bate === false) add('trava', 'gps-diverge', 'O GPS não confirma o horário registrado: ' + (v.gps.resumo || 'leituras fora do período da ocorrência') + '.');
    else if (exclusao && v.gps.dentro === false) add('trava', 'gps-fora', 'Nenhuma leitura do GPS dentro da zona de exclusão no período' + (v.gps.maisProximo ? ' (mais próxima: ' + v.gps.maisProximo + ')' : '') + '.');
    else if (v.gps.bate === true) add('ok', 'gps-ok', 'GPS compatível com a ocorrência' + (v.gps.resumo ? ': ' + v.gps.resumo : '') + '.');
  }

  const nivel = achados.some(a => a.nivel === 'trava') ? 'trava' : achados.some(a => a.nivel === 'aviso') ? 'aviso' : 'ok';
  return { nivel, achados, sugestao: nivel === 'trava' ? sugestao : null };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { rvc_conferir, rvc_tratamentos, rvc_duracaoMin, rvc_data, rvc_feriados, rvc_marcosDoPeriodo };

/* ───────────────────────── tela: antes de gerar ───────────────────────── */
function _rvcSeguir(modo, grupos) {
  if (typeof rvj_antesDeGerar === 'function') return rvj_antesDeGerar(modo, grupos);
  if (!confirm('O cruzamento com as justificativas do CME não carregou (recarregue a página com Ctrl+F5).\n\nGerar o relatório mesmo assim, SEM conferir as justificativas da pasta?')) return;
  addLog('Relatório de violações gerado SEM o cruzamento de justificativas (módulo não carregou) (' + (usuarioAtual?.nome || '') + ')', { action: 'rv-justificativa', modulo: 'Relatório' });
  return rv_gerarSelecionados(modo, grupos);
}

function rvc_antesDeGerar(modo, selecionados) {
  const res = selecionados.map(g => ({ grupo: g, itens: g.map(v => ({ v, c: rvc_conferir(v) })) }));
  const comAchado = res.some(r => r.itens.some(it => it.c.nivel !== 'ok'));
  if (!comAchado) {
    _mostrarToast('\u{2705} Conferência das violações: nenhum problema encontrado.', 'sucesso');
    return _rvcSeguir(modo, selecionados);
  }
  _rvcMostrar(modo, res);
}

const _RVC_COR = { trava: 'var(--idv-cr)', aviso: 'var(--idv-at)', ok: 'var(--idv-ok)' };
const _RVC_ROT = { trava: '\u{26D4} Não enviar sem a sua decisão', aviso: '\u{26A0}\u{FE0F} Confira antes de enviar', ok: '\u{2705} Conferida' };

function _rvcMostrar(modo, res) {
  let ov = document.getElementById('rvc-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'rvc-modal'; ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9990;display:flex;align-items:center;justify-content:center;padding:16px'; document.body.appendChild(ov); }
  const itens = [];
  const blocos = res.map(r => {
    const g0 = r.grupo[0], problemas = r.itens.filter(it => it.c.nivel !== 'ok');
    if (!problemas.length) return '';
    const ok = r.itens.length - problemas.length;
    const linhas = problemas.map(it => {
      const k = itens.push(Object.assign({ nome: g0.nome }, it)) - 1, id = String(it.v.idOc || '');
      const trava = it.c.nivel === 'trava', dec = (id && _rvc_decisoes[id]) || (trava ? (it.c.sugestao ? { acao: it.c.sugestao, motivo: '' } : null) : { acao: 'manter', motivo: '' });
      return '<div class="rvc-item" data-k="' + k + '" data-nivel="' + it.c.nivel + '" style="border:1px solid var(--idv-borda);border-left:3px solid ' + _RVC_COR[it.c.nivel] + ';background:var(--idv-cartao);border-radius:6px;padding:8px 12px;margin:6px 0">'
        + '<div style="font-weight:600;color:' + _RVC_COR[it.c.nivel] + '">' + _RVC_ROT[it.c.nivel] + '</div>'
        + '<div style="font-size:13px;margin:2px 0">' + esc(it.v.tipo) + ' · ID <span class="idv-mono">' + esc(id) + '</span> · <span class="idv-data">' + esc(it.v.ocorreu) + '</span>' + (it.v.duracao ? ' · ' + esc(it.v.duracao) : '') + '</div>'
        + '<ul style="margin:4px 0 6px;padding-left:18px;font-size:13px">' + it.c.achados.map(a => '<li style="color:' + (a.nivel === 'ok' ? 'var(--idv-sec)' : 'var(--idv-texto)') + '">' + esc(a.texto) + '</li>').join('') + '</ul>'
        + '<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;font-size:13px">'
        + '<label style="cursor:pointer"><input type="radio" name="rvc-' + k + '" value="retirar"' + (dec && dec.acao === 'retirar' ? ' checked' : '') + ' onchange="_rvcAtualizar()"> Retirar do relatório</label>'
        + '<label style="cursor:pointer"><input type="radio" name="rvc-' + k + '" value="manter"' + (dec && dec.acao === 'manter' ? ' checked' : '') + ' onchange="_rvcAtualizar()"> Manter no relatório</label>'
        + '<input type="text" class="rvc-motivo" placeholder="' + (trava ? 'Por que manter? (obrigatório)' : 'Observação (opcional)') + '" value="' + esc(dec && dec.motivo || '') + '" oninput="_rvcAtualizar()" style="flex:1;min-width:180px;padding:4px 8px;border:1px solid var(--idv-borda);border-radius:6px;font-size:13px;display:' + (dec && dec.acao === 'manter' && trava ? '' : 'none') + '">'
        + '</div></div>';
    }).join('');
    return '<div style="margin-bottom:12px"><div class="idv-nome">' + esc(g0.nome) + ' <span class="idv-mono" style="color:var(--idv-sec);font-weight:400;font-size:12px">' + esc(g0.processo) + '</span>'
      + (ok ? ' <span style="color:var(--idv-ok);font-weight:400;font-size:12px">· ' + ok + ' conferida(s) sem problema</span>' : '') + '</div>' + linhas + '</div>';
  }).join('');
  ov.innerHTML = '<div style="background:var(--idv-cartao);border:1px solid var(--idv-borda);border-radius:8px;max-width:780px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 8px 24px rgba(31,35,40,.18);font-size:14px;color:var(--idv-texto)">'
    + '<div style="padding:14px 18px 10px;border-bottom:1px solid var(--idv-borda)"><div style="font-weight:600;font-size:16px">\u{1F50E} Conferência das violações</div>'
    + '<div style="color:var(--idv-sec);font-size:13px;margin-top:2px">Antes de ir ao Judiciário, cada violação foi conferida pelo registro do AKILES' + (res.some(r => r.itens.some(it => it.v.gps)) ? ', pelo tratamento do operador e pelo GPS' : ' e pelo tratamento do operador') + '. As marcadas em <b style="color:var(--idv-cr)">vermelho</b> só seguem com a sua decisão; as <b style="color:var(--idv-at)">amarelas</b> são para conferir.</div></div>'
    + '<div style="padding:8px 18px;overflow-y:auto;flex:1">' + blocos + '</div>'
    + '<div style="padding:10px 18px;border-top:1px solid var(--idv-linha);display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap">'
    + '<span id="rvc-contagem" style="flex:1;font-size:13px;color:var(--idv-sec)"></span>'
    + '<button type="button" class="idv-btn mini" onclick="document.getElementById(\'rvc-modal\').remove()">Cancelar</button>'
    + '<button type="button" id="rvc-ok" class="idv-btn mini criar">Continuar</button></div></div>';
  ov._rvc = { modo, res, itens };
  document.getElementById('rvc-ok').onclick = () => _rvcConfirmar();
  _rvcAtualizar();
}

function _rvcLer() {
  return [...document.querySelectorAll('#rvc-modal .rvc-item')].map(el => {
    const r = el.querySelector('input[type=radio]:checked'), m = el.querySelector('.rvc-motivo'), trava = el.dataset.nivel === 'trava';
    if (m) m.style.display = r && r.value === 'manter' && trava ? '' : 'none';
    return { k: +el.dataset.k, trava, acao: r ? r.value : null, motivo: m ? m.value.trim() : '' };
  });
}
function _rvcAtualizar() {
  const ds = _rvcLer(), pend = ds.filter(d => !d.acao || (d.trava && d.acao === 'manter' && !d.motivo)).length;
  const c = document.getElementById('rvc-contagem'), ok = document.getElementById('rvc-ok');
  if (c) c.textContent = ds.filter(d => d.acao === 'retirar').length + ' a retirar · ' + ds.filter(d => d.acao === 'manter').length + ' mantida(s)' + (pend ? ' · ' + pend + ' sem decisão' : '');
  if (ok) { ok.disabled = !!pend; ok.style.opacity = pend ? '.5' : ''; ok.style.cursor = pend ? 'not-allowed' : 'pointer'; ok.title = pend ? 'Decida as violações em vermelho (e diga por que manter) antes de continuar' : ''; }
}
function _rvcConfirmar() {
  const ov = document.getElementById('rvc-modal'), st = ov && ov._rvc; if (!st) return;
  const ds = _rvcLer();
  if (ds.some(d => !d.acao || (d.trava && d.acao === 'manter' && !d.motivo))) { _mostrarToast('Decida as violações em vermelho antes de continuar.', 'erro'); return; }
  const retirar = new Set(), frases = [];
  ds.forEach(d => {
    const it = st.itens[d.k], id = String(it.v.idOc || '');
    if (d.acao === 'retirar') retirar.add(it.v);
    if (id) _rvc_decisoes[id] = { acao: d.acao, motivo: d.motivo };
    if (!d.trava && d.acao === 'manter') return; // aviso mantido: não precisa registrar
    const frase = (d.acao === 'retirar' ? 'RETIROU' : 'MANTEVE') + ' a violação ' + (id || it.v.ocorreu) + ' de ' + it.nome + ' — ' + it.c.achados.filter(a => a.nivel !== 'ok').map(a => a.codigo).join(', ') + (d.motivo ? ' — motivo: ' + d.motivo : '');
    frases.push(frase);
    if (typeof auditar === 'function') auditar({ action: 'rv-conferencia', modulo: 'Relatório', alvo: 'Violação ' + (id || it.v.ocorreu), monitorado: it.nome, detalhe: frase });
  });
  if (frases.length && typeof addLog === 'function') addLog('Relatório de violações (conferência): ' + frases.join(' | ') + ' (' + (usuarioAtual?.nome || '') + ')', { action: 'rv-conferencia-resumo', modulo: 'Relatório' });
  const grupos = st.res.map(r => r.grupo.filter(v => !retirar.has(v)));
  const vazios = st.res.filter((r, i) => !grupos[i].length).map(r => r.grupo[0].nome);
  ov.remove();
  if (vazios.length) _mostrarToast('Sem violações a enviar (todas retiradas): ' + vazios.join(', ') + '. Esse(s) relatório(s) não será(ão) gerado(s).', 'sucesso');
  const restantes = grupos.filter(g => g.length);
  if (restantes.length) _rvcSeguir(st.modo, restantes);
}
