/* ═══════════════════════════ LEITURA CONFERIDA — faixa de confiança comum ═══════════════════════════
   Padrão de TODA leitura de documento por IA no CME (decisão de 15/10/2026, sem IA paga):
   duas IAs grátis leem e são comparadas, o resultado é conferido contra o texto, o OCR dá nota a cada página
   e a tela diz se dá para confiar — verde "Leitura conferida" / amarela "pode ter erro" / neutra "confira".
   O Worker devolve { confianca: alta|media|baixa, avisos[], duvidas[{campo,a,b}], alternativa, segundaLeitura }.
   Usado na Comunicação Processual e no "Buscar documentos do monitorado" (Plantão / Multi / Jurídico);
   a Agenda da Secretaria tem a sua própria (secretaria-agenda-ia.js), no mesmo padrão.
   Emojis só por \u{...}. Prefixo lc_ / _lc. */

const LC_OCR_NOTA_MIN = 75; // abaixo disso a página foi lida com dificuldade (foto torta, borrada, carimbo)
function _lcEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// avisos de leitura das letras a partir das notas do OCR: [[rótulo, nota], ...]
function lc_avisosOcr(notas) {
  return (notas || []).filter(n => typeof n[1] === 'number' && n[1] < LC_OCR_NOTA_MIN)
    .map(n => n[0] + ' foi lida com dificuldade (qualidade ' + n[1] + '%) — confira nomes e números');
}

/* Faixa de confiança.
   conf: o que o Worker devolveu em "conferencia" (pode faltar → neutro)
   op.preencheu: lista do que foi preenchido · op.avisosLeitura: avisos do OCR (rebaixam a confiança)
   op.acaoAlt: código JS do botão "Usar a 2ª leitura" (só aparece se houver alternativa)
   op.verbo: 'gerar' (padrão) ou 'salvar' */
function lc_faixa(conf, op) {
  conf = conf || {}; op = op || {};
  const verbo = op.verbo || 'gerar';
  const leitura = op.avisosLeitura || [], avisos = leitura.concat(conf.avisos || []), duvidas = conf.duvidas || [];
  let nivel = conf.confianca || 'media';
  if (leitura.length && nivel === 'alta') nivel = 'baixa';
  const preencheu = (op.preencheu || []).length ? '<div style="font-size:.78rem;color:#475569;margin-top:3px">Preenchido: ' + op.preencheu.map(_lcEsc).join(', ') + (op.naoAchou && op.naoAchou.length ? ' · não encontrado: ' + op.naoAchou.map(_lcEsc).join(', ') : '') + '.</div>' : '';
  if (nivel === 'alta' && !avisos.length) {
    return '<div style="border:1px solid #86efac;background:#f0fdf4;border-left:4px solid #16a34a;border-radius:6px;padding:8px 10px;text-align:left">'
      + '<div style="font-weight:700;color:#15803d">\u{2705} Leitura conferida</div>'
      + '<div style="font-size:.8rem;color:#166534">Duas IAs leram os documentos e concordaram; os números e nomes batem com o texto. Dê uma olhada rápida antes de ' + verbo + '.</div>' + preencheu + '</div>';
  }
  const forte = nivel === 'baixa';
  const lista = duvidas.map(d => '<li><b>' + _lcEsc(d.campo) + ':</b> 1ª leitura <i>' + _lcEsc(d.a) + '</i> · 2ª leitura <i>' + _lcEsc(d.b) + '</i></li>').join('')
    + avisos.map(a => '<li>' + _lcEsc(a) + '</li>').join('');
  return '<div style="border:1px solid ' + (forte ? '#fcd34d' : '#cbd5e1') + ';background:' + (forte ? '#fffbeb' : '#f8fafc') + ';border-left:4px solid ' + (forte ? '#d97706' : '#64748b') + ';border-radius:6px;padding:8px 10px;text-align:left">'
    + '<div style="font-weight:700;color:' + (forte ? '#b45309' : '#334155') + '">' + (forte ? '\u{26A0}\u{FE0F} Confira antes de ' + verbo + ' — a leitura pode ter erro' : '\u{2139}\u{FE0F} Confira antes de ' + verbo) + '</div>'
    + (duvidas.length ? '<div style="font-size:.8rem;color:#92400e">As duas IAs leram os documentos de jeitos diferentes. Veja no documento qual está certa.</div>' : '')
    + (lista ? '<ul style="margin:4px 0 0 18px;padding:0;font-size:.8rem;color:#334155">' + lista + '</ul>' : '')
    + (conf.alternativa && op.acaoAlt ? '<button type="button" class="btn-sm btn-outline" style="margin-top:6px" onclick="' + _lcEsc(op.acaoAlt) + '">' + _lcEsc(op.rotuloAlt || 'Usar a 2ª leitura') + '</button>' : '')
    + preencheu + '</div>';
}

// mostra a faixa num elemento de status (div) — troca o texto simples antigo por HTML
function lc_mostrar(el, html) { if (!el) return; el.style.display = 'block'; el.style.background = 'transparent'; el.style.color = 'inherit'; el.style.padding = '0'; el.innerHTML = html; }
