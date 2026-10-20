/* ═══════════ ENTRADA PRODOC — regras (sem tela) ═══════════
   O robô (Desktop\CME\ROBO MAPAS AKILES\atualizar-prodoc.js) traz a lista do PRODOC; aqui se decide
   categoria, setor sugerido, nome, prazo e situação. As regras vêm da análise de 20/10/2026
   (199 recebidos e 200 enviados pela CME): a "evidência" é quantas vezes a CME fez assim.
   Também roda no Node para os testes (module.exports no fim). */

const _SPRD_REGRAS = [
  { cat: 'Não comparecimento', re: /N[ÃA]O COMPAREC|IMPOSSIBILIDADE DE CUMPRIMENTO|INFORMA[ÇC][ÃA]O EQUIVOCADA/,
    setores: ['Comunicação Processual'], modelo: 'p12', regra: 'Não comparecimento ou impossibilidade vai para Comunicação Processual (comunicar ao juízo)' },
  { cat: 'DPP / botão do pânico', re: /DEVOLU[ÇC][ÃA]O D[EO] (DPP|DISPOSITIVO)/,
    setores: ['Psicossocial'], modelo: 'p04', regra: 'Devolução de DPP vai para o Psicossocial' },
  { cat: 'DPP / botão do pânico', re: /\bDPP\b|BOT[ÃA]O DO P[ÂA]NICO|DISPOSITIVO DE PROTE/,
    setores: ['Psicossocial'], modelo: 'p03', regra: 'DPP vai para o Psicossocial (26 de 34 casos)' },
  { cat: 'Revogação / retirada', re: /REVOGA|RETIRADA D[AE] (TORNOZ|TNZ|EQUIP|MONITORA|DISPOSITIVO)|SOLICITO RETIRADA|DESINSTALA/,
    setores: ['Jurídico'], modelo: 'p02', regra: 'Revogação ou retirada vai para o Jurídico (19 de 33 casos)' },
  { cat: 'Trabalho externo', re: /TRABALHO EXTERNO|ATIVIDADES EXTERNAS|LOCAL DE TRABALHO|HOR[ÁA]RIO DE TRABALHO/,
    setores: ['Plantão'], modelo: 'p06', regra: 'Trabalho externo (UFAE) vai para o Plantão (4 de 4 casos)' },
  { cat: 'Alvará / instalação', re: /ALVAR[ÁA]|INSTALA[ÇC][ÃA]O D[AE] (TORNOZ|TNZ|EQUIP|MONITORA)|COLOCA[ÇC][ÃA]O D[AE] TORNOZ|SOLICITA[ÇC][ÃA]O DE INSTALA/,
    // modelo só quando o texto diz qual: preso que só sai depois da tornozeleira não é "comparecimento espontâneo"
    setores: ['Plantão'], modeloPor: t => /ESPONT|DEVER[ÁA] COMPARECER/.test(t) ? 'p05' : /UFAE|TRABALHO EXTERNO/.test(t) ? 'p06' : '',
    regra: 'Alvará ou instalação vai para o Plantão (33 de 42 casos)', extra: ' Mandar cópia da decisão ao Jurídico (foi feito em 8 de 42 casos).' },
  { cat: 'Relatório / informação', re: /RELAT[ÓO]RIO DE MONITORA|SOLICITA[ÇC][ÃA]O DE INFORMA|SOLICITA[ÇC][ÃA]O DE RELAT|SOLICITA RELAT|REQUISI[ÇC][ÃA]O DE RELAT|ESCLARECIMENTO|RELAT[ÓO]RIO ATUALIZADO/,
    setores: ['Relatórios'], modelo: 'p01', regra: 'Pedido de relatório ou informação vai para Relatórios (21 de 23 casos)' },
  { cat: 'Desvinculação', re: /DESVIN[CV]ULA/,
    setores: ['Jurídico', 'Psicossocial', 'Comunicação Processual'], modelo: 'p10', regra: 'Aviso de desvinculação vai em 3 cópias: Jurídico, Psicossocial e Comunicação Processual' },
  { cat: 'Vinculação', re: /VINCULA[ÇC]/,
    setores: ['Jurídico', 'Psicossocial', 'Comunicação Processual'], modelo: 'p10', regra: 'Aviso de vinculação vai em 3 cópias: Jurídico, Psicossocial e Comunicação Processual (6 de 6 casos)' },
  { cat: 'Ocorrência / violação', re: /OCORR[ÊE]NCIA|DESCUMPRIMENTO|ZONA DE EXCLUS|FALTA GRAVE|EVADI|ROMPIMENTO|INTEGRIDADE DA PULSEIRA/,
    setores: ['Comunicação Processual'], modelo: 'p11', regra: 'Ocorrência ou descumprimento vai para Comunicação Processual (comunicar ao juízo)' },
  { cat: 'Decisão judicial', re: /SEEU|DECIS[ÃA]O JUDICIAL|ENCAMINHA DECIS|ENCAMINHO DECIS|MANDADO/,
    setores: ['Jurídico'], modelo: 'p02', regra: 'Decisão judicial vai para o Jurídico (6 casos) ou Relatórios (4) — conferir se pede relatório' },
  { cat: 'Pessoal / RH', re: /F[ÉE]RIAS|FOLHAS? DE (PONTO|FREQU[ÊE]NCIA)|LICEN[ÇC]A[ -]PR[ÊE]MIO|PROGRESS[ÃA]O FUNCIONAL|CARGA HOR|FORMUL[ÁA]RIO DE AVALIA|SIGRH/,
    setores: ['Secretaria'], modelo: '', regra: 'Pessoal (férias, ponto, progressão) fica com a própria Secretaria' },
  { cat: 'Administrativo', re: /CLIMATIZA|AR-CONDICIONADO|COMBUST|REFEI[ÇC]|COMPUTADOR|CONTRATO|ESTUDO T[ÉE]CNICO|MEDI[ÇC][ÃA]O|PAGAMENTO|VE[ÍI]CULO|CHAMAMENTO|MATERIA/,
    setores: ['Administrativo'], modelo: '', regra: 'Assunto administrativo vai para o Administrativo' },
  { cat: 'Missão / operação', re: /\bMISS[ÃA]O\b|\bOPERA[ÇC][ÃA]O\b/,
    setores: ['Plantão'], modelo: '', regra: 'Ordem de missão ou operação vai para o Plantão (2 de 2 casos)' },
  { cat: 'Ciência', re: /PORTARIA|RELAT[ÓO]RIO SEMANAL|CONVITE|REUNI[ÃA]O|CONVOCA|DIVULGA|PARA CONHECIMENTO|CI[ÊE]NCIA/,
    setores: [], modelo: '', regra: 'Circular, portaria ou convite: só ciência, não encaminha', ciencia: true },
];

const _sprdMaiusc = s => String(s || '').toUpperCase();

// o ASSUNTO decide; o texto só desempata quando o assunto não diz nada — e nunca leva a "Ciência"
// (quase todo ofício diz "para conhecimento e providências"). Na dúvida fica "Outros", que segue "A encaminhar".
function _sprdSugestao(d) {
  const assunto = _sprdMaiusc(d.assunto), corpo = _sprdMaiusc(String(d.texto || '').slice(0, 400)), txt = assunto + ' ' + corpo;
  const r = _SPRD_REGRAS.find(x => x.re.test(assunto))
    || _SPRD_REGRAS.find(x => !x.ciencia && x.re.test(corpo))
    || (/CIRCULAR/.test(_sprdMaiusc(d.tipo)) ? _SPRD_REGRAS.find(x => x.ciencia) : null);
  if (!r) return { cat: 'Outros', setores: [], modelo: '', regra: 'Sem regra para este assunto — ler e decidir', fazer: 'Ler o documento e decidir para onde vai.', ciencia: false };
  const fazer = r.ciencia ? 'Dar ciência. Não precisa encaminhar.'
    : r.setores[0] === 'Secretaria' ? 'A própria Secretaria trata.'
    : 'Encaminhar para ' + r.setores.join(', ').replace(/, ([^,]*)$/, ' e $1') + '.' + (r.extra || '');
  return { cat: r.cat, setores: r.setores.slice(), modelo: r.modeloPor ? r.modeloPor(txt) : r.modelo, regra: r.regra, fazer, ciencia: !!r.ciencia };
}

// Nome da pessoa no assunto ("TIPO – NOME – PROCESSO …"). Devolve '' quando não tem certeza.
const _SPRD_NAO_NOME = /\b(DESCUMPRIMENTO|MEDIDA|LOCAL|TRABALHO|AUTORIZA\S*|SA[ÍI]DA|OPERA\S*|CIRCULAR|SERVIDOR\S*|PAGAMENTO|DI[ÁA]RIAS|VARA|PROCESSO|PLANT[ÃA]O|MACAP[ÁA]|SANTANA|TJAP|JUIZADO|CENTRAL|GABINETE|ALVAR[ÁA]|SOLTURA|VINCULA|DESVINCULA|INSTALA|TORNOZELEIRA|DECIS[ÃA]O|JUDICIAL|MONITORA|RELAT[ÓO]RIO|REVOGA|PORTARIA|DIVULGA|SOLICITA|ENCAMINHA|CUMPRIMENTO|COMUNICA|INFORMA|DPP|TNZ|IAPEN|CME|PPL|N[ºO°]|GAB)\b/;
const _sprdPareceNome = s => /^[A-ZÀ-Ú]+(\s+[A-ZÀ-Ú]+){1,7}$/.test(s) && !_SPRD_NAO_NOME.test(s);
function _sprdNome(assunto) {
  const a = _sprdMaiusc(assunto).replace(/\s+/g, ' ').trim();
  const m = a.match(/\b(?:PPL|MONITORAD[OA]|APENAD[OA]|V[ÍI]TIMA|REEDUCAND[OA]|NACIONAL)\s+([A-ZÀ-Ú]+(?:\s+[A-ZÀ-Ú]+){1,7})/);
  if (m) { // corta no primeiro termo que não é nome ("PPL JOSE DA SILVA PROCESSO 0001")
    const pal = m[1].split(' '), i = pal.findIndex(w => _SPRD_NAO_NOME.test(w));
    const nome = (i < 0 ? pal : pal.slice(0, i)).join(' ');
    if (_sprdPareceNome(nome)) return nome;
  }
  const partes = a.split(/\s*[-–]\s*/);
  // 1º trecho é o tipo do documento: só vale quando é "AÇÃO DE NOME" (ex.: "VINCULAÇÃO DE FULANO")
  const acao = partes[0].match(/^(?:VINCULA\S*|DESVINCULA\S*|INSTALA\S*|DPP|REVOGA\S*)(?:\s+\S+)*?\s+(?:DE|DA|DO)\s+([A-ZÀ-Ú]+(?:\s+[A-ZÀ-Ú]+){1,7})$/);
  for (const p of partes.slice(1).map(x => x.replace(/[.,;:]+$/, '').trim()).concat(acao ? [acao[1]] : [])) if (_sprdPareceNome(p)) return p;
  return '';
}

const _sprdP2 = n => String(n).padStart(2, '0');
function _sprdMaisDias(iso, n) {
  const d = new Date(String(iso).slice(0, 10) + 'T12:00'); d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + _sprdP2(d.getMonth() + 1) + '-' + _sprdP2(d.getDate());
}
// prazo escrito no texto: a data "até dd/mm/aaaa" válida mais próxima (a partir da chegada) vale mais;
// senão "em/no prazo de N dias" conta da chegada; "(24H)" ou "em 48 horas" = urgente
const _SPRD_HORAS = /(?:\(|\bEM\s+|PRAZO DE\s+)(12|24|48|72)\s?H(?:ORAS)?\b(?!:)/;
function _sprdPrazo(texto, recebidoEm) {
  const t = _sprdMaiusc(texto), desde = String(recebidoEm || '').slice(0, 10);
  const urgente = /URGENT|URG[ÊE]NCIA|IMEDIAT|REITERA/.test(t) || _SPRD_HORAS.test(t);
  const datas = [...t.matchAll(/AT[ÉE]\s+(?:O\s+DIA\s+)?(\d{2})\/(\d{2})\/(\d{4})/g)].map(m => {
    const d = new Date(+m[3], +m[2] - 1, +m[1]);
    return d.getDate() === +m[1] && d.getMonth() === +m[2] - 1 ? m[3] + '-' + m[2] + '-' + m[1] : '';
  }).filter(x => x && x >= desde).sort();
  if (datas.length) return { data: datas[0], urgente };
  const n = t.match(/(?:\bEM|NO PRAZO DE|PRAZO DE)\s+(\d{1,3})\s*(?:\([^)]*\)\s*)?DIAS/);
  if (n && recebidoEm) return { data: _sprdMaisDias(recebidoEm, +n[1]), urgente };
  const h = t.match(_SPRD_HORAS);
  if (h && recebidoEm && urgente) return { data: _sprdMaisDias(recebidoEm, Math.max(1, Math.ceil(+h[1] / 24))), urgente };
  return { data: '', urgente };
}

// novo | antigo | naolido | enc | ciencia | res     (marcas = cme_secretaria.prodoc)
// antigo = está na caixa há mais de 7 dias sem ninguém marcar (não infla o "A encaminhar" do dia a dia)
const _SPRD_DIAS_NOVO = 7;
function _sprdSituacao(d, marcas, agora) {
  const mk = (marcas || {})[d.id];
  if (mk && mk.st === 'res') return 'res';
  if (d.caixa === 'fora') return 'res';
  if (d.caixa === 'encaminhado' || (mk && mk.st === 'enc')) return 'enc'; // encaminhado entre duas leituras pode estar com lido=false
  if (d.lido !== true) return 'naolido';
  if (_sprdSugestao(d).ciencia) return 'ciencia';
  if (agora && String(d.recebidoEm || '').slice(0, 10) < _sprdMaisDias(agora, -_SPRD_DIAS_NOVO)) return 'antigo';
  return 'novo';
}

// encaminhado há mais de 24 h e algum setor ainda não abriu no PRODOC
function _sprdParado(d, agora) {
  if (d.caixa !== 'encaminhado' || !(d.setores || []).length) return false;
  const ultimo = (d.envios || []).map(e => e.em).sort().pop() || '';
  const h = (new Date(agora) - new Date(ultimo)) / 3600e3;
  if (!ultimo || h < 24 || h > 7 * 24) return false; // depois de 7 dias o robô não acompanha mais: não afirma que está parado
  return d.setores.some(s => !s.lido);
}

if (typeof module !== 'undefined') module.exports = { _SPRD_REGRAS, _sprdSugestao, _sprdNome, _sprdPrazo, _sprdSituacao, _sprdParado, _sprdMaisDias };
