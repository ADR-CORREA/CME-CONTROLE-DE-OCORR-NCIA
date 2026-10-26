/* ═══ PARECER AUTOMÁTICO DA VIOLAÇÃO (prefixo po_) ══════════════════════════════════════
   Pedido do Adriano (26/10/2026, "nível 1"): quando o operador abre uma ocorrência, o CME monta um parecer
   com prova para cada ocorrência do AKILES daquele monitorado no período — regras FIXAS, sem IA, as mesmas
   da conferência do Gerador (rv-conferencia, rv-conferencia-horario, rv-justificativas) mais o GPS e o
   espelhamento que o robô devolve junto com o mapa.
   • NÃO escreve no AKILES: quem marca 6/7 e assina é o operador. O parecer só sugere e mostra a prova.
   • Bateria: > 15 min = 6; até 15 min = critério do operador; em andamento = aguardar restabelecer.
   • Zona de exclusão: leitura do GPS dentro = 6 (passou por dentro, não importa a intenção); nenhuma
     leitura dentro = 7; espelhamento = 7; travessia sem leitura dentro ou GPS não conferido = operador.
   • Zona de inclusão: espelhamento ou fora do horário da decisão = 7; justificativa na pasta = 7;
     GPS confirma a saída no horário de recolhimento = 6; saída ≥ 24 h, horário parcial, justificativa
     possível ou GPS não conferido = operador.
   • Rompimento, botão, proximidade e as demais: o parecer não decide (POP), só reúne os dados.
   • Compara com o que o operador já marcou e avisa quando diverge.
   O último parecer de cada ocorrência fica no store "pareceres" (chave cme_pareceres) e aparece na linha
   da ocorrência e na janela de detalhe. As funções puras são testadas em node. Emojis só por \u{...}. */

const PO_DIAS_ANTES = 2, PO_DIAS_DEPOIS = 5;   // janela da busca no Metabase em volta da data do alerta
const PO_LIMITE_STORE = 600;
const PO_ROTULO = { '6': '6 — Violação confirmada', '7': '7 — Não confirmada', operador: 'Decisão do operador', aguardar: 'Aguardar' };

function _poNorm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[\u{300}-\u{36f}]/gu, '').toUpperCase(); }
function po_classe(tipo) {
  const t = _poNorm(tipo);
  if (/BATERIA|CARGA/.test(t)) return 'bateria';
  if (/EXCLUS/.test(t)) return 'exclusao';
  if (/INCLUS/.test(t)) return 'inclusao';
  return 'outro';
}

/* Núcleo (puro): parecer de UMA ocorrência do AKILES.
   v = linha normalizada (tipo, idOc, ocorreu, fim, duracao, situacao, atendimento, comentario, gps?)
   conf = rvc_conferir(v); horario = achados de rvch_conferir (ou []); justif = [{ ev, nivel, motivo }] de rvj.
   Devolve { sugestao:'6'|'7'|'operador'|'aguardar', rotulo, confianca:'alta'|'media'|null, motivos[], avisos[],
             operador:{ proc, procTexto, operador, texto }|null, concorda:true|false|null }. */
function po_parecer(v, conf, horario, justif) {
  const cls = po_classe(v.tipo);
  const ach = ((conf && conf.achados) || []).concat(horario || []);
  const cod = c => ach.find(a => a.codigo === c), tem = c => !!cod(c);
  const dur = rvc_duracaoMin(v.duracao), fmtDur = v.duracao ? String(v.duracao).trim() : '—';
  const trat = rvc_tratamentos(v.comentario), comProc = trat.filter(t => t.proc != null), final = comProc.length ? comProc[comProc.length - 1] : null;
  const g = v.gps || null, esp = g && g.espelho;
  const jc = (justif || []).filter(j => j.nivel === 'compativel'), jp = (justif || []).filter(j => j.nivel === 'possivel');
  const jTxt = lista => lista.map(j => '"' + ((j.ev && j.ev.nome) || 'documento') + '" (' + j.motivo + ')').join('; ');
  const motivos = [], avisos = [];
  let sugestao = 'operador', confianca = null, rotulo = null;
  const sug = (s, c, r) => { sugestao = s; confianca = c; rotulo = r || null; };

  if (cls === 'outro') {
    motivos.push('Ocorrência grave ou fora das regras automáticas (' + (v.tipo || 'tipo não lido') + '): o parecer não decide — siga o POP e decida no AKILES.');
  } else if (cls === 'bateria') {
    if (tem('aberta')) {
      sug('aguardar', 'alta', 'Aguardar restabelecer — não arquivar');
      motivos.push('Ainda sem carga (em andamento no AKILES): só pode ser arquivada depois de restabelecer.' + (dur != null && dur > RVC_BATERIA_MIN ? ' A descarga já passa de ' + RVC_BATERIA_MIN + ' min: ao restabelecer, é violação confirmada.' : ''));
    } else if (jc.length) {
      sug('7', 'media'); motivos.push('Há documento na pasta que cobre a descarga: ' + jTxt(jc) + '.');
    } else if (dur != null && dur > RVC_BATERIA_MIN) {
      sug('6', 'alta'); motivos.push('Descarga de ' + fmtDur + ', acima de ' + RVC_BATERIA_MIN + ' min: violação confirmada pela regra da CME.');
      if (jp.length) avisos.push('Possível justificativa na pasta: ' + jTxt(jp) + ' — confira antes de marcar.');
    } else if (dur != null) {
      motivos.push('Descarga de ' + fmtDur + ' (até ' + RVC_BATERIA_MIN + ' min): fica a critério do operador.');
    } else motivos.push('A duração da descarga não pôde ser lida na ocorrência.');
  } else {
    const semGps = !g || tem('gps-nao-conferido') || tem('gps-sem-leitura') || tem('telemetria-erro');
    if (esp && esp.veredito === 'espelhamento') {
      sug('7', 'alta'); motivos.push('Espelhamento de GPS: ' + esp.motivo + '. Pelo parecer técnico da UE Brasil (15/10/2025), ponto com altitude negativa é reflexão do sinal, não saída real.');
    } else if (tem('aberta')) {
      sug('aguardar', 'alta', 'Aguardar o encerramento no AKILES');
      motivos.push('Ocorrência em andamento no AKILES: a duração ainda não é a real. Decida quando ela encerrar.');
    } else if (cls === 'exclusao') {
      if (semGps) {
        motivos.push(g && g.semLeitura ? 'Sem leituras do GPS no período: o mapa não confirma nem desmente.' : 'GPS não conferido (o robô não devolveu o trajeto): não dá para checar se entrou na zona nem espelhamento.');
      } else if (g.dentro === true) {
        sug('6', g.bate === false ? 'media' : 'alta');
        motivos.push('O GPS registra leitura DENTRO da zona de exclusão' + (g.resumo ? ': ' + g.resumo : '') + '. Passou por dentro = violação confirmada, não importa a intenção.');
        if (g.bate === false) avisos.push('O horário do GPS difere do registrado no AKILES — confira o mapa.');
      } else if (g.travessia) {
        motivos.push('Nenhuma leitura dentro da zona, mas a linha entre duas leituras cruza a zona — olhe o mapa antes de decidir.');
      } else {
        sug('7', 'alta'); motivos.push('Nenhuma leitura do GPS dentro da zona de exclusão no período' + (g.maisProximo ? ' (mais próxima: ' + g.maisProximo + ')' : '') + ': passar só pelo anel de advertência não é violação.');
      }
      if (esp && esp.veredito === 'indicio') avisos.push(cod('espelhamento-indicio').texto);
      if (jc.length || jp.length) avisos.push('Há documento na pasta (' + jTxt(jc.concat(jp)) + '), mas entrada na zona de exclusão não se justifica por documento.');
    } else { // inclusão
      if (tem('horario-fora')) {
        sug('7', 'alta'); motivos.push(cod('horario-fora').texto);
        avisos.push('A agenda da zona no AKILES gerou ocorrência num horário em que a decisão não exige recolhimento — confira a agenda da zona (não altere sem ordem).');
      } else if (jc.length) {
        sug('7', 'media'); motivos.push('Há documento na pasta que cobre a saída: ' + jTxt(jc) + '.');
      } else if (semGps) {
        motivos.push(g && g.semLeitura ? 'Sem leituras do GPS no período: o mapa não confirma nem desmente a saída.' : 'GPS não conferido (o robô não devolveu o trajeto): não dá para checar a saída nem espelhamento.');
      } else if (g.saiu === true || g.bate === true) {
        if (tem('saida-temporaria')) motivos.push(cod('saida-temporaria').texto);
        else if (tem('horario-parcial')) motivos.push(cod('horario-parcial').texto);
        else if (jp.length) motivos.push('GPS confirma a saída, mas há possível justificativa na pasta: ' + jTxt(jp) + ' — confira o documento.');
        else if (tem('horario-ok')) { sug('6', 'alta'); motivos.push('GPS confirma a saída da zona de inclusão' + (g.resumo ? ': ' + g.resumo : '') + '. ' + cod('horario-ok').texto); }
        else { sug('6', 'media'); motivos.push('GPS confirma a saída da zona de inclusão' + (g.resumo ? ': ' + g.resumo : '') + '. Não li a decisão da pasta: confira o horário de recolhimento.'); }
        if (g.bate === false) avisos.push('O horário do GPS difere do registrado no AKILES' + (g.resumo ? ' (' + g.resumo + ')' : '') + '.');
      } else {
        sug('7', 'media'); motivos.push('O GPS não registra leitura fora da zona de inclusão no período — a ocorrência pode ser de leitura ruim; confira o mapa.');
      }
      if (esp && esp.veredito === 'indicio') avisos.push(cod('espelhamento-indicio').texto);
    }
  }
  // o que o operador já fez
  const operador = final ? { proc: final.proc, procTexto: final.procTexto, operador: final.operador, texto: final.texto } : (trat.length ? { proc: null, procTexto: '', operador: trat[trat.length - 1].operador, texto: trat[trat.length - 1].texto } : null);
  let concorda = null;
  if (final && (sugestao === '6' || sugestao === '7')) {
    concorda = String(final.proc) === sugestao;
    if (!concorda) avisos.push('O operador marcou "' + final.procTexto + '"' + (final.operador ? ' (' + final.operador + ')' : '') + '; o parecer sugere "' + PO_ROTULO[sugestao] + '".');
  }
  // achados que ainda não entraram no texto
  const usados = new Set(['aberta', 'gps-ok', 'horario-ok', 'horario-fora', 'horario-parcial', 'saida-temporaria', 'espelhamento', 'espelhamento-indicio', 'gps-fora', 'gps-diverge', 'gps-travessia', 'gps-sem-leitura', 'gps-nao-conferido', 'telemetria-erro']);
  ach.filter(a => a.nivel !== 'ok' && !usados.has(a.codigo) && !avisos.includes(a.texto)).forEach(a => avisos.push(a.texto));
  return { sugestao, rotulo: rotulo || PO_ROTULO[sugestao], confianca, motivos, avisos, operador, concorda };
}

if (typeof module !== 'undefined' && module.exports) module.exports = { po_classe, po_parecer, PO_ROTULO };

/* ───────────────────────── busca e montagem (navegador) ───────────────────────── */
function _poIso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
async function _poMetabase(filtros, ini, fim) {
  const qs = Object.entries(filtros).filter(([, v]) => v).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  const r = await fetch(r2_state.url.replace(/\/$/, '') + '/metabase/ocorrencias?' + qs + '&ini=' + ini + '&fim=' + fim, { headers: { Authorization: 'Bearer ' + _workerToken() } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || ('erro ' + r.status));
  return d.rows || [];
}
// mesmas colunas e normalização do relatório automático (rv_gerarAutomatico)
function _poLinhas(rows) {
  const colUS = _rvDetectarColunaUS(rows.map(r => r.data_ocorrencia_inicio)), t = v => String(v == null ? '' : v).trim(), vistos = new Set();
  return rows.map(r => ({
    nome: t(r.monitorado), processo: t(r.nu_processo), cpf: t(r.cpf), competencia: t(r.ds_juizo), comarca: t(r.ds_foro),
    tipo: t(r.tipo_ocorrencia), idOc: t(r.id_ocorrencia).replace(/\D/g, ''), ocorreu: _rvOcorreuNorm(r.data_ocorrencia_inicio, null, colUS),
    duracao: t(r.duracao_formatada), disp: t(r.id_dispositivo_usuario).replace(/\D/g, ''),
    fim: r.data_ocorrencia_fim ? _rvOcorreuNorm(r.data_ocorrencia_fim, null, colUS) : '', endereco: '', contato: '',
    situacao: t(r.ocorrencia_situacao_ocorrencia), atendimento: t(r.ocorrencia_situacao_atendimento), comentario: t(r.comentario),
  })).filter(x => x.nome && x.idOc && !vistos.has(x.idOc) && vistos.add(x.idOc))
    .sort((a, b) => ((rvc_data(b.ocorreu) || 0) - (rvc_data(a.ocorreu) || 0))); // mais recente primeiro
}
function _poOverlay(titulo) {
  let ov = document.getElementById('po-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'po-modal'; ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9990;display:flex;align-items:center;justify-content:center;padding:16px'; document.body.appendChild(ov); }
  ov.innerHTML = '<div style="background:var(--idv-cartao);border:1px solid var(--idv-borda);border-radius:8px;max-width:460px;width:100%;padding:18px 20px;font-size:14px;color:var(--idv-texto)">'
    + '<div style="font-weight:600;font-size:16px;margin-bottom:6px">\u{2696}\u{FE0F} ' + titulo + '</div><div id="po-prog" style="color:var(--idv-sec);min-height:2.4em">Começando…</div>'
    + '<div style="display:flex;justify-content:flex-end;margin-top:10px"><button type="button" class="idv-btn mini" onclick="document.getElementById(\'po-modal\').remove()">Cancelar</button></div></div>';
  return ov;
}
function _poProg(m) { const el = document.getElementById('po-prog'); if (el) el.textContent = m; }

async function po_abrir(idx) {
  if (typeof _ocRef === 'function') idx = _ocRef(idx); // (26/10/2026) aceita 'id:<id>'
  const oc = getOcorrencias()[idx]; if (!oc) return;
  const nome = String(oc.monitorado || '').trim();
  if (!nome) { _mostrarToast('Esta ocorrência não tem o nome do monitorado.', 'erro'); return; }
  if (!(typeof _r2Pronto === 'function' && _r2Pronto())) { _mostrarToast('Sem conexão com o servidor do CME — tente de novo em instantes.', 'erro'); return; }
  const ov = _poOverlay('Montando o parecer de ' + esc(nome));
  const vivo = () => document.getElementById('po-modal') === ov; // "Cancelar" tira a janela
  try {
    let base = oc.dataAlerta ? new Date(oc.dataAlerta) : new Date(); if (isNaN(base)) base = new Date();
    const ini = _poIso(new Date(base.getTime() - PO_DIAS_ANTES * 864e5)), fim = _poIso(new Date(Math.min(Date.now(), base.getTime() + PO_DIAS_DEPOIS * 864e5)));
    _poProg('Buscando no Metabase as ocorrências de ' + nome + ' entre ' + ini.split('-').reverse().join('/') + ' e ' + fim.split('-').reverse().join('/') + '…');
    let rows = await _poMetabase({ monitorado: nome }, ini, fim);
    if (!rows.length) { // nome um pouco diferente do AKILES
      const curto = nome.split(/\s+/).slice(0, 2).join(' ');
      if (curto !== nome) rows = (await _poMetabase({ monitorado: curto }, ini, fim)).filter(r => rvj_semelhancaNome(nome, r.monitorado) >= 0.8);
    }
    if (!vivo()) return;
    const linhas = _poLinhas(rows);
    if (!linhas.length) { ov.remove(); _poMostrar(oc, [], { ini, fim }); return; }
    // GPS e espelhamento pelo robô (só violações de zona, só as que ainda não vieram)
    const zona = linhas.filter(x => /zona/i.test(x.tipo));
    const faltam = zona.filter(x => !((window._rv_gps || {})[x.idOc])).map(_rvPedidoRobo).filter(Boolean);
    if (faltam.length) { _poProg('Pedindo ao robô o trajeto e a telemetria de ' + faltam.length + ' violação(ões) de zona… (o robô precisa estar ligado)'); await rv_capturarViaCloud(faltam); }
    if (!vivo()) return;
    // decisão judicial (horário de recolhimento) e justificativas da pasta
    let hor = {}, jus = null, jusErro = '';
    if (zona.some(x => po_classe(x.tipo) === 'inclusao') && typeof rvch_lerDecisoes === 'function') {
      _poProg('Lendo as decisões judiciais da pasta…');
      try { hor = await rvch_lerDecisoes([linhas], _poProg); } catch (e) { hor = { _avisoGeral: 'Não consegui ler as decisões da pasta (' + (e.message || e) + ').' }; }
    }
    if (!vivo()) return;
    if (typeof _rvjEvidencias === 'function') {
      _poProg('Cruzando com as justificativas da pasta…');
      try { _rvj_parar = false; const b = await _rvjEvidencias(linhas, { n: _RVJ_LER_TOTAL, naoLidos: 0, pastas: {} }, _poProg); jus = { base: b, itens: _rvjCruzarGrupo(linhas, b) }; }
      catch (e) { jusErro = 'Não consegui cruzar com as justificativas (' + (e.message || e) + ').'; }
    }
    if (!vivo()) return;
    const h = hor[linhas[0].nome], gps = window._rv_gps || {};
    const res = linhas.map(v => {
      const vg = gps[v.idOc] ? Object.assign({}, v, { gps: gps[v.idOc] }) : v;
      const c = rvc_conferir(vg);
      const extras = po_classe(v.tipo) === 'inclusao' && h && h.decs && h.decs.length && typeof rvch_conferir === 'function' ? rvch_conferir(v, h.decs) : [];
      const jv = jus ? ((jus.itens.find(it => it.v === v) || {}).achados || []) : [];
      return { v: vg, c, extras, jus: jv, p: po_parecer(vg, c, extras, jv), destaque: String(v.idOc) === String(oc.id) };
    });
    const geral = [].concat((h && h.avisos) || [], hor._avisoGeral ? [hor._avisoGeral] : [], (jus && jus.base.avisos) || [], jusErro ? [jusErro] : []);
    ov.remove();
    _poMostrar(oc, res, { ini, fim, geral });
    addLog('Parecer automático: ' + nome + ' — ' + res.map(r => r.v.idOc + ' ' + r.p.rotulo).join('; ') + ' (' + (usuarioAtual?.nome || '') + ')', { action: 'parecer', modulo: 'Ocorrências' });
    await _poSalvar(oc, res);
  } catch (e) {
    if (vivo()) ov.remove();
    _mostrarToast('Não consegui montar o parecer: ' + (e.message || e), 'erro');
  }
}

/* ───────────────────────── tela do parecer ───────────────────────── */
const _PO_COR = { '6': 'cr', '7': 'ne', operador: 'at', aguardar: 'in' };
const _PO_NIVEL = { trava: 'cr', aviso: 'at', ok: 'ok' };
function _poEtq(p) { return '<span class="idv-etq ' + (_PO_COR[p.sugestao] || 'ne') + '">' + esc(p.rotulo) + '</span>' + (p.confianca ? ' <span style="font-size:12px;color:var(--idv-sec)">confiança ' + p.confianca + '</span>' : ''); }
function _poHtmlItem(r) {
  const v = r.v, p = r.p, tipo = esc(v.tipo || '—');
  const ach = (r.c.achados || []).concat(r.extras || []);
  const cab = '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline"><div><b>' + tipo + '</b> <span class="idv-mono" style="font-size:12px">ID ' + esc(v.idOc) + '</span>'
    + (r.destaque ? ' <span class="idv-etq in">esta ocorrência</span>' : '') + '</div><div class="idv-data" style="font-size:13px;color:var(--idv-sec)">' + esc(v.ocorreu || '—') + (v.fim ? ' → ' + esc(v.fim) : '') + (v.duracao ? ' · ' + esc(v.duracao) : '') + '</div></div>'
    + '<div class="idv-mini" style="margin-top:2px">' + (v.situacao ? 'situação: ' + esc(v.situacao) : '') + (v.atendimento ? ' · atendimento: ' + esc(v.atendimento) : '') + (v.processo ? ' · processo <span class="idv-mono">' + esc(v.processo) + '</span>' : '') + '</div>';
  const parecer = '<div style="margin-top:8px;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap"><span style="font-weight:600">Parecer:</span>' + _poEtq(p) + '</div>'
    + '<ul style="margin:6px 0 0 18px;padding:0;font-size:14px;line-height:1.45">' + p.motivos.map(m => '<li>' + esc(m) + '</li>').join('') + '</ul>'
    + (p.avisos.length ? '<ul style="margin:6px 0 0 18px;padding:0;font-size:13px;line-height:1.45;color:var(--idv-at)">' + p.avisos.map(m => '<li>\u{26A0}\u{FE0F} ' + esc(m) + '</li>').join('') + '</ul>' : '');
  const op = p.operador ? '<div style="margin-top:8px;font-size:13px"><b>No AKILES:</b> ' + (p.operador.procTexto ? 'marcado "' + esc(p.operador.procTexto) + '"' : 'sem procedimento marcado') + (p.operador.operador ? ' por ' + esc(p.operador.operador) : '')
      + (p.operador.texto ? ' — "' + esc(p.operador.texto.slice(0, 300)) + '"' : '') + (p.concorda === true ? ' <span class="idv-etq ok">parecer concorda</span>' : p.concorda === false ? ' <span class="idv-etq cr">parecer diverge</span>' : '') + '</div>'
    : '<div style="margin-top:8px;font-size:13px;color:var(--idv-sec)"><b>No AKILES:</b> sem tratamento do operador.</div>';
  const prova = ach.length ? '<details style="margin-top:8px"><summary style="cursor:pointer;font-size:13px;color:var(--idv-sec)">Conferência (' + ach.length + ' ponto(s))</summary><ul style="margin:6px 0 0 18px;padding:0;font-size:13px;line-height:1.45">'
      + ach.map(a => '<li style="color:var(--idv-' + (_PO_NIVEL[a.nivel] || 'sec') + ')">' + esc(a.texto) + '</li>').join('') + '</ul></details>' : '';
  const jus = (r.jus || []).length ? '<div style="margin-top:6px;font-size:13px"><b>Pasta do monitorado:</b> ' + r.jus.map(j => '<span class="idv-etq ' + (j.nivel === 'compativel' ? 'ok' : 'at') + '">' + (j.nivel === 'compativel' ? 'compatível' : 'possível') + '</span> ' + esc((j.ev && j.ev.nome) || '') + ' — ' + esc(j.motivo)).join('<br>') + '</div>' : '';
  const img = _rv_imagens[v.idOc];
  const mapa = img ? '<div style="margin-top:8px"><img src="' + img + '" alt="Mapa do AKILES da ocorrência ' + esc(v.idOc) + '" style="max-width:100%;max-height:360px;border:1px solid var(--idv-linha);border-radius:6px"></div>' : '';
  return '<div class="idv-bloco" style="margin-bottom:12px;padding:12px 14px;box-shadow:inset 3px 0 0 var(--idv-' + (_PO_COR[p.sugestao] === 'cr' ? 'cr' : _PO_COR[p.sugestao] === 'at' ? 'at' : _PO_COR[p.sugestao] === 'in' ? 'in' : 'borda') + ')">' + cab + parecer + op + jus + prova + mapa + '</div>';
}
function _poMostrar(oc, res, info) {
  let ov = document.getElementById('po-modal');
  if (!ov) { ov = document.createElement('div'); ov.id = 'po-modal'; ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:9990;display:flex;align-items:center;justify-content:center;padding:16px'; document.body.appendChild(ov); }
  const per = info.ini.split('-').reverse().join('/') + ' a ' + info.fim.split('-').reverse().join('/');
  const corpo = res.length ? res.map(_poHtmlItem).join('')
    : '<div class="idv-vazio">Nenhuma ocorrência de ' + esc(oc.monitorado) + ' no Metabase entre ' + per + '.' + (oc.semNumeroAkiles ? ' Esta ocorrência veio do relatório de sem comunicação, sem nº no AKILES.' : '') + '</div>';
  const geral = (info.geral || []).length ? '<div class="idv-faixa at" style="margin-bottom:10px;display:block;font-size:13px">' + info.geral.map(esc).join('<br>') + '</div>' : '';
  ov.innerHTML = '<div style="background:var(--idv-cartao);border:1px solid var(--idv-borda);border-radius:8px;max-width:820px;width:100%;max-height:92vh;display:flex;flex-direction:column;font-size:14px;color:var(--idv-texto)">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--idv-linha)"><div><div style="font-weight:600;font-size:16px">\u{2696}\u{FE0F} Parecer automático — ' + esc(oc.monitorado) + '</div>'
    + '<div style="font-size:13px;color:var(--idv-sec)">Ocorrência #' + esc(oc.id) + ' no CME · ocorrências do AKILES de ' + per + ' · regras fixas, sem IA · quem decide e assina no AKILES é o operador</div></div>'
    + '<button type="button" class="idv-btn mini" onclick="document.getElementById(\'po-modal\').remove()">Fechar</button></div>'
    + '<div style="padding:14px 18px;overflow:auto">' + geral + corpo + '</div></div>';
}

/* ───────────────────────── guarda e mostra o último parecer ───────────────────────── */
function _poStore() { const d = carregarStore('pareceres', null); return d && typeof d === 'object' ? d : {}; }
async function _poSalvar(oc, res) {
  if (!res.length) return;
  const em = new Date().toISOString(), por = (usuarioAtual && usuarioAtual.nome) || '', novos = {};
  res.forEach(r => {
    novos[r.v.idOc] = { em, por, ocId: oc.id, monitorado: r.v.nome, tipo: r.v.tipo, ocorreu: r.v.ocorreu, fim: r.v.fim, duracao: r.v.duracao,
      sugestao: r.p.sugestao, rotulo: r.p.rotulo, confianca: r.p.confianca, motivos: r.p.motivos, avisos: r.p.avisos, operador: r.p.operador, concorda: r.p.concorda,
      achados: (r.c.achados || []).concat(r.extras || []).map(a => ({ nivel: a.nivel, texto: a.texto })),
      justificativas: (r.jus || []).map(j => ({ nivel: j.nivel, nome: (j.ev && j.ev.nome) || '', motivo: j.motivo })) };
  });
  let atual = {};
  try { if (window._db) { const r = await _dbLerChave('cme_pareceres'); if (!r.error && r.data && r.data.value && typeof r.data.value === 'object') atual = r.data.value; } else atual = _poStore(); } catch (e) { atual = _poStore(); }
  const d = Object.assign({}, atual, novos);
  const ks = Object.keys(d);
  if (ks.length > PO_LIMITE_STORE) ks.sort((a, b) => String(d[a].em || '').localeCompare(String(d[b].em || ''))).slice(0, ks.length - PO_LIMITE_STORE).forEach(k => delete d[k]);
  _cache.pareceres = d;
  if (window._db && typeof _dbGravar === 'function') { const r = await _dbGravar('cme_pareceres', d); if (r.error) _mostrarToast('O parecer foi mostrado, mas não ficou guardado (' + (r.error.message || r.error) + ').', 'erro'); }
  else salvarStore('pareceres', d);
  try { renderizarOcorrencias(); } catch (e) {} try { renderizarCriticos(); } catch (e) {}
}
// pareceres guardados desta ocorrência do CME (a própria, se tem nº do AKILES, e as outras do mesmo monitorado no período)
function po_dosDaOcorrencia(oc) {
  const d = _poStore(), id = String(oc.id);
  return Object.entries(d).filter(([k, p]) => k === id || String(p.ocId) === id).map(([k, p]) => Object.assign({ idOc: k }, p)).sort((a, b) => (a.idOc === id ? -1 : b.idOc === id ? 1 : String(b.em).localeCompare(String(a.em))));
}
// selo na linha da ocorrência
function po_selo(oc) {
  const ps = po_dosDaOcorrencia(oc); if (!ps.length) return '';
  const p = ps[0], dica = p.rotulo + ' · ' + new Date(p.em).toLocaleString('pt-BR') + (p.motivos && p.motivos[0] ? ' — ' + p.motivos[0] : '');
  return ' <span class="idv-etq ' + (_PO_COR[p.sugestao] || 'ne') + '" title="' + esc(dica) + '" style="margin-left:4px">parecer ' + esc(p.sugestao === '6' ? '6' : p.sugestao === '7' ? '7' : p.sugestao === 'aguardar' ? 'aguardar' : 'operador') + '</span>';
}
// bloco na janela de detalhe
function po_htmlResumo(oc, idx) {
  const ps = po_dosDaOcorrencia(oc);
  const btn = '<button type="button" class="idv-btn mini criar" onclick="fecharModal(\'modal-ver-ocorrencia\');po_abrir(' + idx + ')">\u{2696}\u{FE0F} ' + (ps.length ? 'Refazer o parecer' : 'Parecer da violação') + '</button>';
  if (!ps.length) return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span style="font-size:13px;color:var(--idv-sec)">Ainda sem parecer automático. Ele busca a ocorrência no AKILES (Metabase), confere GPS, decisão e justificativas e sugere 6 ou 7 — sem escrever no AKILES.</span>' + btn + '</div>';
  return '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px"><span style="font-size:13px;color:var(--idv-sec)">Último parecer em <span class="idv-data">' + new Date(ps[0].em).toLocaleString('pt-BR') + '</span>' + (ps[0].por ? ' por ' + esc(ps[0].por) : '') + '</span>' + btn + '</div>'
    + ps.map(p => '<div style="font-size:13px;padding:6px 0;border-top:1px solid var(--idv-linha)"><b>' + esc(p.tipo || '') + '</b> <span class="idv-mono" style="font-size:12px">ID ' + esc(p.idOc) + '</span> <span class="idv-data">' + esc(p.ocorreu || '') + '</span> ' + _poEtq(p)
      + (p.concorda === false ? ' <span class="idv-etq cr">diverge do operador</span>' : '') + '<div style="margin-top:3px">' + esc((p.motivos || [])[0] || '') + '</div></div>').join('');
}
