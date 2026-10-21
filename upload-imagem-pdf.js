/* ════════════════════════════════════════════════════════════════════
   DOCUMENTOS DO MONITORADO — data do anexo + imagem de documento vira PDF
   (pedido do Adriano, 20/10/2026)

   1) Listas "Buscar Documentos do Monitorado": cada arquivo mostra a data em
      que foi anexado à pasta (campo `enviado` do GET /list) e a lista sai
      ordenada da mais recente para a mais antiga; sem data vai para o fim.

   2) Ao CADASTRAR uma imagem na pasta do monitorado: se tem escrita (é
      documento), vira PDF antes de subir; se é foto sem escrita (ex.: rosto),
      continua imagem. "Se for foto de pessoa sem escrita, fica imagem, agora
      doc tem que ser doc." Detecção 100% local e grátis (Tesseract no
      navegador, o mesmo do OCR da Comunicação) — nada vai para IA paga.
      Vale só para upload NOVO: arquivos que já estão no R2 não são tocados.
   ════════════════════════════════════════════════════════════════════ */

/* ── 1) Data do anexo ───────────────────────────────────────────── */
function _uipDataEnvio(iso) {
  if (!iso) return 'sem data';
  const d = new Date(iso);
  return isNaN(d) ? 'sem data' : d.toLocaleDateString('pt-BR');
}

/* Nova lista ordenada: mais recente primeiro; sem `enviado` vai para o fim. */
function _uipOrdenarPorData(arqs) {
  return arqs.slice().sort((a, b) => {
    const ta = a.enviado ? Date.parse(a.enviado) || 0 : 0;
    const tb = b.enviado ? Date.parse(b.enviado) || 0 : 0;
    return tb - ta;
  });
}

/* Selo de data para a linha do documento. */
function _uipSeloData(arq) {
  const txt = _uipDataEnvio(arq.enviado);
  return `<span class="idv-data" title="Anexado à pasta em" style="font-size:12px;color:var(--idv-sec);flex-shrink:0;white-space:nowrap">${txt}</span>`;
}

/* ── 2) Imagem de documento → PDF ───────────────────────────────── */
const _UIP_EXT_IMAGEM = /\.(jpe?g|png|webp|heic|heif|bmp)$/i;
const _UIP_MIN_PALAVRAS = 8;     // palavras legíveis para considerar "tem escrita"
const _UIP_MIN_CARACTERES = 40;  // ou caracteres alfanuméricos legíveis
const _UIP_CONF_MIN = 60;        // confiança mínima do OCR por palavra (0–100)
const _UIP_LADO_OCR = 1600;      // px — basta para achar texto e é rápido
const _UIP_LADO_PDF = 2480;      // px — ~300 dpi numa folha A4

function _uipEhImagem(file) {
  return _UIP_EXT_IMAGEM.test(file.name || '') || /^image\/(jpeg|png|webp|heic|heif|bmp)$/i.test(file.type || '');
}

function _uipCanvas(bmp, ladoMax) {
  const esc = Math.min(1, ladoMax / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * esc);
  c.height = Math.round(bmp.height * esc);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';               // PNG transparente não vira fundo preto no JPEG
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

function _uipComLimite(p, ms) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('OCR passou de ' + ms / 1000 + ' s')), ms))]);
}

/* true = tem escrita (documento). Só OCR local — sem cair na nuvem. */
async function _uipTemEscrita(bmp) {
  const w = await _uipComLimite(_getTessWorker(), 60000);
  const { data } = await _uipComLimite(w.recognize(_uipCanvas(bmp, _UIP_LADO_OCR)), 90000);
  const palavras = (data.words || []).filter(p => p.confidence >= _UIP_CONF_MIN && /[A-Za-zÀ-ÿ0-9]{3,}/.test(p.text || ''));
  const chars = palavras.reduce((n, p) => n + ((p.text || '').match(/[A-Za-zÀ-ÿ0-9]/g) || []).length, 0);
  return palavras.length >= _UIP_MIN_PALAVRAS || chars >= _UIP_MIN_CARACTERES;
}

async function _uipImagemParaPdf(bmp, nomeOriginal) {
  await _carregarScriptSE('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf');
  const { jsPDF } = window.jspdf;
  const paisagem = bmp.width > bmp.height;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: paisagem ? 'landscape' : 'portrait' });
  const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
  const esc = Math.min(pw / bmp.width, ph / bmp.height);
  const w = bmp.width * esc, h = bmp.height * esc;
  const jpeg = _uipCanvas(bmp, _UIP_LADO_PDF).toDataURL('image/jpeg', 0.85);
  doc.addImage(jpeg, 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h);
  const nomePdf = String(nomeOriginal).replace(/\.[^.]+$/, '') + '.pdf';
  return new File([doc.output('blob')], nomePdf, { type: 'application/pdf' });
}

/* Prepara 1 arquivo para o upload. Devolve { file, nota }:
   - não é imagem → o próprio arquivo, nota vazia;
   - imagem com escrita → PDF novo;
   - foto sem escrita, ou não deu para ler → a imagem como veio. */
async function _uipPrepararUpload(file) {
  if (!_uipEhImagem(file)) return { file, nota: '' };
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch (e) { return { file, nota: `\u{1F5BC}\u{FE0F} ${file.name}: mantido como imagem (formato que o navegador não abre)` }; }
  try {
    let temEscrita;
    try { temEscrita = await _uipTemEscrita(bmp); }
    catch (e) {
      console.warn('[CME] OCR do upload falhou:', e.message);
      return { file, nota: `\u{1F5BC}\u{FE0F} ${file.name}: mantido como imagem (não foi possível verificar se há texto)` };
    }
    if (!temEscrita) return { file, nota: `\u{1F5BC}\u{FE0F} ${file.name}: mantido como imagem (sem texto)` };
    const pdf = await _uipImagemParaPdf(bmp, file.name);
    return { file: pdf, nota: `\u{1F4C4} ${file.name}: convertido para PDF (${pdf.name})` };
  } catch (e) {
    console.error('[CME] conversão imagem→PDF falhou:', e);
    return { file, nota: `\u{26A0}\u{FE0F} ${file.name}: não converteu para PDF, enviado como imagem` };
  } finally {
    try { bmp.close(); } catch (e) {}
  }
}

/* Aviso final do que foi feito com as imagens: toast curto + detalhe por
   arquivo na barra de progresso do upload (fica 10 s na tela).
   Devolve true se havia imagem (o chamador segura a barra por mais tempo). */
function _uipAvisar(notas, elDetalhe) {
  const lista = notas.filter(Boolean);
  if (!lista.length) return false;
  const pdf = lista.filter(n => n.startsWith('\u{1F4C4}')).length;
  const img = lista.length - pdf;
  const partes = [];
  if (pdf) partes.push(`\u{1F4C4} ${pdf} imagem(ns) de documento convertida(s) para PDF`);
  if (img) partes.push(`\u{1F5BC}\u{FE0F} ${img} mantida(s) como imagem`);
  _mostrarToast(partes.join(' · '), 'sucesso');
  if (elDetalhe) {
    elDetalhe.style.whiteSpace = 'pre-line';
    elDetalhe.textContent += '\n' + lista.join('\n');
  }
  return true;
}
