/* ═══════════ ENTRADA PRODOC — leitura da IA (fase 2, pedido de 20/10/2026) ═══════════
   O robô manda à IA (Worker /robo/prodoc-ler: duas IAs grátis + conferência contra o texto) o texto do PRODOC
   e dos anexos de cada documento do mês JÁ ABERTO; o resultado vem em d.ia.
   Aqui: o bloco "Leitura da IA" (faixa de confiança padrão do CME — leitura-conferida.js) e o despacho sugerido,
   montado com os modelos de "Despachos PRODOC" (texto aprovado, nada inventado pela IA).
   O passo 2 (curto ou modelo formal, na própria Entrada) fica em secretaria-prodoc-responder.js.
   Emojis só por \u{...}. Prefixo _sprdIa / sec_prodoc. */

const _SPRD_MODELOS_VITIMA = ['p03', 'p04', 'p12', 'p13']; // modelos de DPP: o nome é o da vítima

// mesmo critério da faixa (lc_faixa): "conferida" só com as duas IAs de acordo, sem aviso e sem página lida com dificuldade
function _sprdIaConferida(ia) {
  return !!ia && ia.confianca === 'alta' && !(ia.avisos || []).length
    && !(ia.notasOcr || []).some(n => Array.isArray(n) && typeof n[1] === 'number' && n[1] < (typeof LC_OCR_NOTA_MIN === 'number' ? LC_OCR_NOTA_MIN : 75));
}
function _sprdIaPessoa(ia, modId) {
  const ps = ((ia && ia.pessoas) || []).filter(p => p && typeof p.nome === 'string' && p.nome);
  return _SPRD_MODELOS_VITIMA.includes(modId) ? ps.find(p => /v[íi]tima|requerente|ofendid/i.test(p.papel || ''))
    : ps.find(p => /monitorad|requerid|apenad|ppl|r[ée]u|reeducand|executad/i.test(p.papel || ''));
}

// modelo e nome do despacho: setor da IA só quando a leitura é conferida; senão o da regra (histórico da CME)
function _sprdIaDespacho(l) {
  const d = l.d, ia = d.ia, mods = _secModelos();
  const setorIA = _sprdIaConferida(ia) ? _sprdSetorIA(ia.responsavel) : '';
  const setor = setorIA && _SPRD_DESTINO_MODELO[setorIA] ? setorIA : l.sug.setores.find(x => _SPRD_DESTINO_MODELO[x]) || '';
  if (!setor) return null;
  const doRegra = mods.find(x => x.id === l.sug.modelo);
  const mod = (doRegra && doRegra.destino === _SPRD_DESTINO_MODELO[setor] ? doRegra : null) || mods.find(x => x.destino === _SPRD_DESTINO_MODELO[setor]);
  if (!mod) return null;
  const p = _sprdIaPessoa(ia, mod.id);
  // "escolhido" = a regra indicou exatamente este modelo; senão foi o 1º modelo do setor e a Secretaria escolhe
  return { mod, nome: String((p && p.nome) || _sprdNome(d.assunto) || '').toUpperCase(), escolhido: !!doRegra && mod.id === doRegra.id };
}
function _sprdIaTextos(l, html) {
  const p = _sprdIaDespacho(l); if (!p) return null;
  const vals = {}; if (p.nome) vals.NOME = p.nome;
  const ger = _secGerente(), faltam = _secCamposDe(p.mod).filter(k => !vals[k]);
  return Object.assign(p, { faltam, genero: _secUsaGenero(p.mod), assunto: _secPreencher(p.mod.assunto, vals, 'M', ger, html), texto: _secPreencher(p.mod.texto, vals, 'M', ger, html) });
}

function _sprdIaStatus(l) {
  const d = l.d;
  // a IA lê só o que ainda pede ação (pedido de 20/10/2026: não gastar a cota grátis inteira)
  const motivo = d.sigiloso ? 'documento sigiloso não vai para a IA'
    : d.caixa !== 'entrada' ? 'já foi encaminhado — a IA lê só o que ainda está na caixa'
    : /CIRCULAR/i.test(d.tipo || '') ? 'circular é só ciência — a IA não gasta leitura com ela'
    : String(d.recebidoEm || '').slice(0, 10) < _sprdMaisDias(_secHoje(), -7) ? 'a IA lê só o que chegou nos últimos 7 dias'
    : d.iaErro && (d.iaErro.n || 1) >= 3 ? 'a leitura falhou 3 vezes — leia no PRODOC'
    : d.iaErro ? 'a última tentativa falhou; o robô tenta de novo em algumas horas'
    : 'está na fila — entra nas próximas leituras do robô (a cota grátis da IA é dividida ao longo do dia)';
  return '<div style="margin-top:8px;font-size:13px;color:var(--idv-sec)">A IA ainda não leu este documento: ' + esc(motivo) + '.</div>';
}

function _sprdBlocoIA(l) {
  const d = l.d, ia = d.ia;
  if (!ia) return _sprdIaStatus(l);
  const setorIA = _sprdSetorIA(ia.responsavel), regra = l.sug.setores.join(', ');
  const concorda = !setorIA || !l.sug.setores.length || l.sug.setores.includes(setorIA);
  const notas = (ia.notasOcr || []).filter(n => Array.isArray(n)).map(n => [String(n[0]), n[1]]);
  const faixa = typeof lc_faixa === 'function' ? lc_faixa({ confianca: ia.confianca, avisos: ia.avisos, duvidas: ia.duvidas, alternativa: ia.alternativa },
    { avisosLeitura: typeof lc_avisosOcr === 'function' ? lc_avisosOcr(notas) : [], verbo: 'encaminhar' }) : '';
  const lin = (rot, html) => '<div style="margin-top:4px;font-size:14px"><b style="font-size:12px;color:var(--idv-sec)">' + rot + ':</b> ' + html + '</div>';
  const pessoas = (ia.pessoas || []).filter(p => p && p.nome);
  return '<div style="margin-top:10px;padding:10px 12px;background:var(--idv-de-f);border-left:4px solid var(--idv-de);border-radius:0 6px 6px 0">'
    + '<div style="font-size:12px;font-weight:600;color:var(--idv-de);text-transform:uppercase;letter-spacing:.05em">Leitura da IA — o que fazer</div>'
    + '<div style="font-weight:600;margin-top:2px">' + esc(ia.providencia || '—') + '</div>'
    + lin('Setor', esc(setorIA || '—') + (concorda ? '' : ' <span style="color:var(--idv-at);font-weight:600">· pelo histórico da CME iria para ' + esc(regra) + ' — confira</span>'))
    + (ia.prazo || ia.urgente ? lin('Prazo', (ia.prazo ? '<span class="idv-data">' + _sprdBR(ia.prazo) + '</span>' : '') + (ia.prazoTrecho ? ' ("' + esc(ia.prazoTrecho) + '")' : '') + (ia.urgente ? ' <b style="color:var(--idv-cr)">urgente</b>' : '')) : '')
    + (ia.determinacao ? lin('O documento determina', esc(ia.determinacao)) : '')
    + (pessoas.length ? lin('Pessoas', pessoas.map(p => esc(p.nome) + (p.papel ? ' (' + esc(p.papel) + ')' : '')).join('; ')) : '')
    + (ia.processo ? lin('Processo', '<span style="font-family:var(--font-mono)">' + esc(ia.processo) + '</span>') : '')
    + lin('Leu', 'texto do PRODOC' + ((ia.anexos || []).length ? ' + ' + ia.anexos.filter(a => a).map(a => esc(a.nome) + ' (' + (+a.paginas || 0) + ' pág.)').join(', ') : ' (sem anexo)') + ' · <span style="font-family:var(--font-mono)">' + _sprdBR(ia.em) + '</span>')
    + (faixa ? '<div style="margin-top:8px">' + faixa + '</div>' : '') + '</div>';
}

// Despacho curto = o padrão que a CME usa de verdade ("TIPO - NOME" + "Encaminha-se o expediente para providências."):
// sempre pronto para colar. O bloco do passo 2 (curto ou modelo formal) fica em secretaria-prodoc-responder.js. Pedido de 20/10/2026.
function _sprdIaCurto(l) {
  const d = l.d, ia = d.ia, setorIA = _sprdIaConferida(ia) ? _sprdSetorIA(ia.responsavel) : '';
  const setores = setorIA ? [setorIA] : l.sug.setores.filter(x => x !== 'Secretaria');
  const p = _sprdIaPessoa(ia, /DPP/.test(l.sug.cat) ? 'p03' : '');
  const nome = String((p && p.nome) || _sprdNome(d.assunto) || '').toUpperCase();
  return Object.assign({ setores, nome }, _sprdDespachoCurto(l.sug.cat, nome, setores, d.assunto));
}
async function sec_prodocCopiar(id, qual) {
  const l = _sprdLinhas('*').find(x => x.d.id === id); if (!l) return;
  const t = _sprdIaCurto(l), valor = qual === 'assunto' ? t.assunto : t.texto;
  try { await navigator.clipboard.writeText(valor); _mostrarToast((qual === 'assunto' ? 'Assunto' : 'Texto') + ' copiado — cole no PRODOC (Ctrl+V).', 'sucesso'); }
  catch (e) { _mostrarToast('Não consegui copiar automaticamente — selecione o texto e use Ctrl+C.', 'erro'); return; }
  if (qual !== 'texto') return;
  auditar({ modulo: 'Secretaria', action: 'sec_despacho_copiar', alvo: l.d.numero || id, detalhe: 'Entrada PRODOC · despacho curto' + (t.setores.length ? ' para ' + t.setores.join(', ') : '') });
  _sprdRespMarcarCopia(id); // passo 3 destaca "Já encaminhei" (secretaria-prodoc-responder.js)
}
