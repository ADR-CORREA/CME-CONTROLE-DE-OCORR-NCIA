/* ═══════════════════════════ SECRETARIA — FOLHAS DE PONTO E PAINEL "HOJE" ═══════════════════════════
   • Importa os PDFs mensais das folhas de ponto (SIGRH): a do PLANTÃO (traz a GUARNIÇÃO de cada policial)
     e a do EXPEDIENTE (traz CPF, nível, carga horária). Lê nome, matrícula, cargo, vínculo e os dias
     marcados (férias, licenças, feriado) — mostra uma prévia e só grava depois do OK.
   • Painel "Hoje": guarnição de plantão (troca às 08h), expediente, quem está de apoio e quem está fora.
   Leitor de PDF: pdf.js da cdnjs, carregado só quando precisa. Depende de secretaria*.js. Emojis só por \u{...}. */

const _SEC_PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const _SEC_MESES_NOME = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
let _secPontoPendente = null;

function _secSemAcento(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); }
function _secSoDigitos(s) { return String(s || '').replace(/\D/g, ''); }
function _secCarregarPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((ok, erro) => {
    const s = document.createElement('script'); s.src = _SEC_PDFJS + 'pdf.min.js';
    s.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = _SEC_PDFJS + 'pdf.worker.min.js'; ok(window.pdfjsLib); } catch (e) { erro(e); } };
    s.onerror = () => erro(new Error('não consegui carregar o leitor de PDF (sem internet?)'));
    document.head.appendChild(s);
  });
}

// ── Leitura de UMA página da folha de ponto ───────────────────────────────────
function _secLerPaginaPonto(itens) {
  const its = itens.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5] }));
  const txt = _secSemAcento(its.map(i => i.s).join(' '));
  const ehPlantao = /GUARNI[CÇ]AO/.test(txt), ehExp = /CONTROLE DE FREQU/.test(txt) && /NOME:/.test(txt);
  if (!ehPlantao && !ehExp) return null;
  // valor de um rótulo = texto logo ABAIXO dele, na mesma coluna
  const abaixo = rot => {
    const r = its.find(i => _secSemAcento(i.s).replace(/:$/, '') === rot); if (!r) return '';
    const c = its.filter(i => i !== r && r.y - i.y > 2 && r.y - i.y < 22 && Math.abs(i.x - r.x) < 45).sort((a, b) => (r.y - a.y) - (r.y - b.y))[0];
    return c ? c.s : '';
  };
  const mes = (txt.match(/(JANEIRO|FEVEREIRO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s*\/\s*(\d{4})/) || []);
  const mesNum = mes[1] ? _SEC_MESES_NOME.map(_secSemAcento).indexOf(mes[1]) + 1 : 0;
  // linhas dos dias: números 01..31 da primeira coluna; marcas = o resto da linha
  const nums = its.filter(i => /^\d{2}$/.test(i.s) && +i.s >= 1 && +i.s <= 31);
  const xDia = Math.min(...nums.map(i => i.x));
  const dias = {};
  nums.filter(i => i.x - xDia < 8).forEach(n => {
    const resto = its.filter(i => i !== n && Math.abs(i.y - n.y) < 3.5 && i.x > n.x + 6).sort((a, b) => a.x - b.x).map(i => i.s).join('');
    dias[+n.s] = _secSemAcento(resto).replace(/\s+/g, '');
  });
  return {
    tipo: ehPlantao ? 'plantao' : 'expediente', ano: mes[2] ? +mes[2] : 0, mes: mesNum,
    nome: abaixo('NOME').replace(/\s+/g, ' ').toUpperCase(), matricula: abaixo('MATRICULA'), cargo: abaixo('CARGO'),
    vinculo: abaixo('TIPO VINCULO'), guarnicao: ehPlantao ? _secSemAcento(abaixo('GUARNICAO')) : '',
    cpf: _secSoDigitos(abaixo('CPF')), nivel: abaixo('NIVEL/REFERENCIA'), carga: abaixo('CARGA HORARIA'), dias,
  };
}
// Marcas do dia → tipo de afastamento (ou feriado)
function _secMarcaDia(m) {
  if (!m) return '';
  if (/FERIAS/.test(m)) return 'Férias';
  if (/MATERNIDADE|GRAVIDICA/.test(m)) return 'Licença maternidade';
  if (/PATERNIDADE/.test(m)) return 'Licença paternidade';
  if (/TRATAMENTODESAUDE|SAUDE/.test(m)) return 'Licença para tratamento de saúde';
  if (/PREMIO/.test(m)) return 'Licença-prêmio';
  if (/LICENCA/.test(m)) return 'Outro afastamento';
  if (/FERIADO/.test(m)) return 'feriado';
  return '';
}
// Junta os dias marcados em períodos (sábado/domingo/feriado entre dias do mesmo tipo não quebram o período)
function _secPeriodosDaFolha(f) {
  const ult = new Date(f.ano, f.mes, 0).getDate(), iso = d => f.ano + '-' + String(f.mes).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  const tipoDia = d => _secMarcaDia(f.dias[d]);
  const neutro = d => { const m = f.dias[d] || ''; return !tipoDia(d) && /SABADO|DOMINGO|FERIADO/.test(m) || tipoDia(d) === 'feriado'; };
  const out = []; let cur = null, pend = 0;
  for (let d = 1; d <= ult; d++) {
    const t = tipoDia(d);
    if (t && t !== 'feriado') {
      if (cur && cur.tipo === t) { cur.fim = d; pend = 0; } else { if (cur) out.push(cur); cur = { tipo: t, ini: d, fim: d }; pend = 0; }
    } else if (cur && neutro(d)) { pend++; } else if (cur) { out.push(cur); cur = null; pend = 0; }
  }
  if (cur) out.push(cur);
  return out.map(p => ({ tipo: p.tipo, inicio: iso(p.ini), fim: iso(p.fim) }));
}
function _secFeriadosDaFolha(f) {
  return Object.keys(f.dias).filter(d => _secMarcaDia(f.dias[d]) === 'feriado').map(d => f.ano + '-' + String(f.mes).padStart(2, '0') + '-' + String(d).padStart(2, '0'));
}

// ── Importar ──────────────────────────────────────────────────────────────────
async function sec_importarPonto(input) {
  const arquivos = [...(input.files || [])]; input.value = ''; if (!arquivos.length) return;
  let pdfjs; try { pdfjs = await _secCarregarPdfJs(); } catch (e) { _mostrarToast(e.message, 'erro'); return; }
  const folhas = [];
  for (const f of arquivos) {
    try {
      _mostrarToast('Lendo ' + f.name + '…');
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise;
      const doArquivo = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const fo = _secLerPaginaPonto((await (await pdf.getPage(p)).getTextContent()).items);
        if (fo && fo.nome) doArquivo.push(Object.assign(fo, { arquivo: f.name, pagina: p }));
      }
      // algumas páginas vêm sem o cabeçalho "Outubro/2026": herdam o mês das outras folhas do arquivo
      const comMes = doArquivo.find(x => x.ano && x.mes);
      doArquivo.forEach(x => { if ((!x.ano || !x.mes) && comMes) { x.ano = comMes.ano; x.mes = comMes.mes; } });
      folhas.push(...doArquivo);
    } catch (e) { _mostrarToast(f.name + ': ' + (e.message || e), 'erro'); }
  }
  const semMes = folhas.filter(x => !x.ano || !x.mes);
  if (semMes.length) { const ref = folhas.find(x => x.ano && x.mes); semMes.forEach(x => { if (ref) { x.ano = ref.ano; x.mes = ref.mes; } }); }
  for (let i = folhas.length - 1; i >= 0; i--) if (!folhas[i].ano || !folhas[i].mes) folhas.splice(i, 1);
  if (!folhas.length) { _mostrarToast('Não encontrei folhas de ponto nesses PDFs.', 'erro'); return; }
  if (new Set(folhas.map(x => x.ano + '-' + x.mes)).size > 1) { _mostrarToast('Os PDFs são de meses diferentes — importe um mês por vez.', 'erro'); return; }
  _secPontoPendente = _secPlanoPonto(folhas, _secDados());
  _secMostrarPrevPonto(_secPontoPendente);
}
// O que vai mudar (sem gravar): servidores novos/atualizados, afastamentos e feriados
function _secPlanoPonto(folhas, d) {
  const acha = f => d.servidores.find(s => (f.matricula && _secSoDigitos(s.matricula) === _secSoDigitos(f.matricula)) || (f.cpf && s.cpf === f.cpf) || _secSemAcento(s.nome) === _secSemAcento(f.nome));
  const plano = { mes: folhas[0].mes, ano: folhas[0].ano, novos: [], mudancas: [], afast: [], feriados: [...new Set(folhas.flatMap(_secFeriadosDaFolha))].sort(), folhas: folhas.length };
  folhas.forEach(f => {
    const s = acha(f), equipe = f.tipo === 'plantao' ? f.guarnicao : 'EXPEDIENTE';
    if (!s) plano.novos.push({ f, equipe });
    else {
      const mud = [];
      // equipeFixa: a gerência definiu a guarnição à mão (ex.: folha gerada por outra guarnição)
      if (_SEC_EQUIPES.includes(equipe) && s.equipe !== equipe && !s.equipeFixa) mud.push('equipe ' + (s.equipe || '—') + ' → ' + equipe);
      if (f.cpf && !s.cpf && _secCpfValido(f.cpf)) mud.push('CPF');
      if (f.cargo && !s.cargo) mud.push('cargo');
      plano.mudancas.push({ f, s, equipe, mud });
    }
    _secPeriodosDaFolha(f).forEach(p => {
      const sid = s && s.id;
      const ja = sid && d.afastamentos.some(a => a.servidorId === sid && _secSobrepoe(a, p.inicio, p.fim));
      plano.afast.push(Object.assign({ nome: f.nome, matricula: f.matricula, ja: !!ja }, p));
    });
  });
  return plano;
}
function _secMostrarPrevPonto(p) {
  const mesTxt = _SEC_MESES[p.mes - 1] + '/' + p.ano, mudou = p.mudancas.filter(m => m.mud.length);
  const tab = (cab, linhas) => '<div class="table-scroll" style="max-height:200px"><table class="data-table" style="font-size:.8rem"><thead><tr>' + cab.map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' + linhas.join('') + '</tbody></table></div>';
  _secModal('Folhas de ponto — ' + mesTxt,
    '<div style="font-size:.9rem;margin-bottom:8px">Li <b>' + p.folhas + '</b> folha(s): <b>' + p.novos.length + '</b> servidor(es) novo(s), <b>' + mudou.length + '</b> com mudança, '
    + '<b>' + p.afast.filter(a => !a.ja).length + '</b> férias/licença(s) a lançar' + (p.feriados.length ? ', feriado(s): ' + p.feriados.map(_secBRc).join(', ') : '') + '.</div>'
    + (p.novos.length ? '<div style="font-weight:600;margin:8px 0 4px">Novos servidores</div>' + tab(['Nome', 'Matrícula', 'Cargo', 'Equipe'], p.novos.map(n => '<tr><td>' + esc(n.f.nome) + '</td><td>' + esc(n.f.matricula) + '</td><td>' + esc(n.f.cargo) + '</td><td>' + esc(n.equipe) + '</td></tr>')) : '')
    + (mudou.length ? '<div style="font-weight:600;margin:8px 0 4px">Atualizações</div>' + tab(['Servidor', 'O que muda'], mudou.map(m => '<tr><td>' + esc(m.s.nome) + '</td><td>' + esc(m.mud.join(', ')) + '</td></tr>')) : '')
    + (p.afast.length ? '<div style="font-weight:600;margin:8px 0 4px">Férias e licenças marcadas na folha</div>' + tab(['Servidor', 'Tipo', 'Período', ''], p.afast.map(a => '<tr><td>' + esc(a.nome) + '</td><td>' + esc(a.tipo) + '</td><td>' + _secBR(a.inicio) + ' a ' + _secBR(a.fim) + '</td><td>' + (a.ja ? '<span style="color:#64748b">já lançado</span>' : '<b style="color:#0d9488">novo</b>') + '</td></tr>')) : '')
    + '<div style="font-size:.78rem;color:#64748b;margin-top:8px">Nada é apagado: servidores que não aparecem nas folhas continuam cadastrados. Confira e confirme.</div>',
    '<button class="btn-primary" onclick="sec_confirmarPonto()">Confirmar e gravar</button>', 780);
}
async function sec_confirmarPonto() {
  const p = _secPontoPendente; if (!p) return;
  const agora = new Date().toISOString(), por = usuarioAtual ? usuarioAtual.nome : '', origem = 'Folha de ponto ' + _SEC_MESES[p.mes - 1] + '/' + p.ano;
  let nNovos = 0, nAtual = 0, nAfa = 0;
  const ok = await _secMutar(d => {
    const acha = f => d.servidores.find(s => (f.matricula && _secSoDigitos(s.matricula) === _secSoDigitos(f.matricula)) || (f.cpf && s.cpf === f.cpf) || _secSemAcento(s.nome) === _secSemAcento(f.nome));
    p.novos.concat(p.mudancas).forEach(item => {
      const f = item.f, equipe = item.equipe; let s = acha(f);
      if (!s) {
        s = { id: _secId('srv'), nome: f.nome, matricula: f.matricula, cpf: _secCpfValido(f.cpf) ? f.cpf : '', cargo: f.cargo ? f.cargo.charAt(0) + f.cargo.slice(1).toLowerCase() : '',
          equipe: _SEC_EQUIPES.includes(equipe) ? equipe : '', setor: f.tipo === 'plantao' ? 'Plantão' : 'Expediente', situacao: 'ativo', criadoEm: agora, criadoPor: por, origem };
        d.servidores.push(s); nNovos++;
      } else {
        let mudou = false;
        if (_SEC_EQUIPES.includes(equipe) && s.equipe !== equipe && !s.equipeFixa) { s.equipe = equipe; mudou = true; }
        if (s.equipeFixa && _SEC_EQUIPES.includes(equipe)) s.equipeFolha = equipe; // só registra de qual guarnição veio a folha
        if (!s.cpf && _secCpfValido(f.cpf)) { s.cpf = f.cpf; mudou = true; }
        if (!s.cargo && f.cargo) { s.cargo = f.cargo.charAt(0) + f.cargo.slice(1).toLowerCase(); mudou = true; }
        if (!s.setor) { s.setor = f.tipo === 'plantao' ? 'Plantão' : 'Expediente'; mudou = true; }
        if (mudou) { s.atualizadoEm = agora; s.atualizadoPor = por; nAtual++; }
      }
      Object.assign(s, { vinculo: f.vinculo || s.vinculo || '', nivel: f.nivel || s.nivel || '', cargaHoraria: f.carga || s.cargaHoraria || '' });
      _secPeriodosDaFolha(f).forEach(per => {
        if (d.afastamentos.some(a => a.servidorId === s.id && _secSobrepoe(a, per.inicio, per.fim))) return;
        // continua um afastamento do mês anterior (mesmo tipo, termina na véspera) em vez de duplicar
        const ant = d.afastamentos.find(a => a.servidorId === s.id && a.tipo === per.tipo && _secMaisDias(a.fim, 1) === per.inicio);
        if (ant) { ant.fim = per.fim; ant.editadoEm = agora; ant.editadoPor = por; }
        else d.afastamentos.push({ id: _secId('afa'), servidorId: s.id, tipo: per.tipo, inicio: per.inicio, fim: per.fim, portaria: '', exercicio: '', obs: 'Marcado na ' + origem.toLowerCase(), anexos: [], criadoPor: por, criadoEm: agora });
        nAfa++;
      });
    });
    d.config = Object.assign({}, d.config);
    d.config.feriados = [...new Set((d.config.feriados || []).concat(p.feriados))].sort();
    d.config.pontoImportado = (d.config.pontoImportado || []).concat([{ mes: p.ano + '-' + String(p.mes).padStart(2, '0'), folhas: p.folhas, em: agora, por }]).slice(-24);
  }, { action: 'sec_ponto_importar', alvo: origem, detalhe: p.folhas + ' folha(s)' });
  if (!ok) return;
  _secPontoPendente = null; _secFecharModal();
  _mostrarToast(origem + ': ' + nNovos + ' novo(s), ' + nAtual + ' atualizado(s), ' + nAfa + ' férias/licença(s).', 'sucesso');
  sec_render();
}

// ── Painel "Hoje" ─────────────────────────────────────────────────────────────
// O plantão vai das 08h às 08h: antes das 08h ainda é o plantão que começou ontem.
function _secPlantaoAgora() {
  const a = new Date(); if (a.getHours() < 8) a.setDate(a.getDate() - 1);
  const dia = a.getFullYear() + '-' + String(a.getMonth() + 1).padStart(2, '0') + '-' + String(a.getDate()).padStart(2, '0');
  return { dia, guarnicao: getPlantaoParaData(dia), proxima: getPlantaoParaData(_secMaisDias(dia, 1)) };
}
function _secSituacaoHoje(s, d, hoje) {
  const af = _secAfastamentoEm(s.id, hoje, d); if (af) return { fora: true, txt: af.tipo + ' até ' + _secBRc(af.fim), cor: _secCorTipo(af.tipo) };
  const disp = d.apoios.find(a => a.servidorId === s.id && a.dispensa && a.dispensa.data === hoje);
  if (disp) return { fora: true, txt: 'Dispensa (' + _secTurnoTxt(disp.dispensa.turno).toLowerCase() + ')', cor: '#d97706' };
  const fol = d.folgas.find(f => f.servidorId === s.id && f.data <= hoje && (f.ate || f.data) >= hoje);
  if (fol) return { fora: true, txt: 'Folga combinada', cor: '#7c3aed' };
  const ap = d.apoios.find(a => a.servidorId === s.id && a.data === hoje);
  if (ap) return { fora: false, txt: 'Apoio: ' + ap.acao, cor: '#2563eb' };
  return { fora: false, txt: '', cor: '' };
}
function _secCartaoEquipe(titulo, sub, cor, servs, d, hoje, vazio) {
  const sits = servs.map(s => ({ s, st: _secSituacaoHoje(s, d, hoje) }));
  const presentes = sits.filter(x => !x.st.fora).length;
  return '<div style="background:#fff;border:1px solid #e2e8f0;border-left:4px solid ' + cor + ';border-radius:6px;padding:12px 14px">'
    + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><div style="font-weight:700;font-size:1.02rem">' + titulo + '</div>'
    + (servs.length ? '<div style="font-size:.8rem;color:#475569"><b>' + presentes + '</b> de ' + servs.length + ' presentes</div>' : '') + '</div>'
    + '<div style="font-size:.78rem;color:#64748b;margin-bottom:6px">' + sub + '</div>'
    + (servs.length ? '<div style="max-height:340px;overflow:auto">' + sits.sort((a, b) => b.st.fora - a.st.fora || a.s.nome.localeCompare(b.s.nome)).map(x => '<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-top:1px solid #f1f5f9;font-size:.86rem' + (x.st.fora ? ';color:#94a3b8' : '') + '">'
      + '<span><a href="#" onclick="sec_abrirPerfil(\'' + x.s.id + '\');return false" style="color:inherit;text-decoration:' + (x.st.fora ? 'line-through' : 'none') + '">' + esc(x.s.nome) + '</a>'
      + (!x.st.fora && _secRotuloEscala(x.s) ? ' <span title="' + esc(_SEC_POSTOS[x.s.posto] || '') + '" style="font-size:.68rem;font-weight:600;color:#475569;background:#f1f5f9;border-left:2px solid #94a3b8;border-radius:3px;padding:1px 5px;white-space:nowrap">' + esc(_secRotuloEscala(x.s)) + '</span>' : '') + '</span>'
      + (x.st.txt ? '<span style="font-size:.72rem;font-weight:600;color:' + x.st.cor + ';white-space:nowrap">' + esc(x.st.txt) + '</span>' : '') + '</div>').join('') + '</div>'
      : '<div style="font-size:.85rem;color:#94a3b8;padding:6px 0">' + vazio + '</div>') + '</div>';
}
function sec_renderHojeDash() {
  const c = document.getElementById('sec-conteudo'); if (!c) return;
  const d = _secDados(), hoje = _secHoje(), pl = _secPlantaoAgora();
  const ativos = d.servidores.filter(s => (s.situacao || 'ativo') === 'ativo');
  const dow = new Date(hoje + 'T12:00:00').getDay(), feriado = ((d.config || {}).feriados || []).includes(hoje);
  const diaUtil = dow >= 1 && dow <= 5 && !feriado;
  const guarn = ativos.filter(s => s.equipe === pl.guarnicao), exp = ativos.filter(s => s.equipe === 'EXPEDIENTE');
  const foraHoje = ativos.filter(s => _secSituacaoHoje(s, d, hoje).fora);
  const diaTxt = new Date(hoje + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  c.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px">'
    + '<div style="font-size:1.05rem;font-weight:700;text-transform:capitalize">' + esc(diaTxt) + (feriado ? ' <span style="color:#dc2626;font-size:.8rem">· FERIADO</span>' : '') + '</div>'
    + '</div>'
    + (!d.servidores.length ? '<div style="background:#eff6ff;border-left:4px solid #2563eb;padding:10px 14px;border-radius:4px;font-size:.88rem;margin-bottom:12px"><b>Comece por aqui:</b> na aba Servidores, importe os PDFs das folhas de ponto do mês (plantão e expediente). O sistema cadastra os servidores com a guarnição de cada um, e as férias e licenças marcadas.</div>' : '')
    + (typeof _secCartaoCompromissos === 'function' ? _secCartaoCompromissos() : '')
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px">'
    + _secCartaoEquipe('\u{1F6E1}\u{FE0F} Plantão — ' + pl.guarnicao, 'Das 08h de ' + _secBRc(pl.dia) + ' às 08h de ' + _secBRc(_secMaisDias(pl.dia, 1)) + ' · próximo: ' + pl.proxima, '#0d9488', guarn, d, hoje, 'Nenhum servidor cadastrado na guarnição ' + pl.guarnicao + '.')
    + (diaUtil ? _secCartaoEquipe('\u{1F3E2} Expediente', 'Segunda a sexta', '#2563eb', exp, d, hoje, 'Nenhum servidor de expediente cadastrado.')
      : '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #94a3b8;border-radius:6px;padding:12px 14px"><div style="font-weight:700">\u{1F3E2} Expediente</div><div style="font-size:.86rem;color:#64748b;margin-top:6px">Hoje não há expediente (' + (feriado ? 'feriado' : 'fim de semana') + ').</div></div>')
    + '<div style="background:#fff;border:1px solid #e2e8f0;border-left:4px solid #dc2626;border-radius:6px;padding:12px 14px"><div style="font-weight:700;font-size:1.02rem">\u{1F6AB} Fora hoje</div>'
    + (foraHoje.length ? foraHoje.map(s => { const st = _secSituacaoHoje(s, d, hoje); return '<div style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-top:1px solid #f1f5f9;font-size:.86rem"><a href="#" onclick="sec_abrirPerfil(\'' + s.id + '\');return false">' + esc(s.nome) + '</a><span style="font-size:.72rem;font-weight:600;color:' + st.cor + ';white-space:nowrap">' + esc(st.txt) + '</span></div>'; }).join('')
      : '<div style="font-size:.85rem;color:#94a3b8;padding:6px 0">Ninguém afastado hoje.</div>') + '</div></div>'
    + (typeof _secCartaoEscala === 'function' ? _secCartaoEscala() : '');
}
Object.assign(_SEC_ACOES, { sec_ponto_importar: 'Importou folhas de ponto' });
