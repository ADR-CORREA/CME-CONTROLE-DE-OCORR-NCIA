/* ═══════════════════ MODELOS — COMPACTAR PDF (09/11/2026) ══════════════════
   Diminui o tamanho de PDFs no próprio navegador (o arquivo não sai do computador).
   Cada página é redesenhada como imagem JPEG na resolução do nível escolhido e
   montada de novo num PDF (pdf.js lê, jsPDF escreve). Igual ao "compressão
   extrema" do iLovePDF: o texto deixa de ser selecionável. */

const CPDF_NIVEIS = {
  baixa:       { dpi: 150, qualidade: 0.80, nome: 'Pouca compressão' },
  recomendada: { dpi: 110, qualidade: 0.65, nome: 'Recomendada' },
  extrema:     { dpi: 72,  qualidade: 0.50, nome: 'Extrema' },
};
const CPDF_MAX_BYTES = 150 * 1024 * 1024;
const CPDF_URL_PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const CPDF_URL_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const CPDF_URL_JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

let cpdf_arquivos = [];
let cpdf_rodando = false;

function cpdf_tamanho(b) {
  if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + ' KB';
  return (b / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
}

function cpdf_esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function cpdf_init() {
  const dz = document.getElementById('cpdf-drop');
  if (!dz || dz._ok) return;
  dz._ok = true;
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('cpdf-sobre'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('cpdf-sobre'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('cpdf-sobre'); cpdf_adicionar([...e.dataTransfer.files]); });
  dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('cpdf-input').click(); } });
}

async function cpdf_ehPdf(file) {
  const cab = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const txt = String.fromCharCode(...cab);
  return txt.includes('%PDF-');
}

async function cpdf_adicionar(files) {
  if (cpdf_rodando) return;
  for (const f of files) {
    const item = { id: Date.now() + Math.random(), file: f, estado: 'pronto', msg: '', saida: null };
    if (f.size > CPDF_MAX_BYTES) { item.estado = 'erro'; item.msg = 'Arquivo acima de 150 MB.'; }
    else if (!(await cpdf_ehPdf(f))) { item.estado = 'erro'; item.msg = 'Não é um PDF.'; }
    cpdf_arquivos = [...cpdf_arquivos, item];
  }
  const inp = document.getElementById('cpdf-input');
  if (inp) inp.value = '';
  cpdf_render();
}

function cpdf_remover(id) {
  if (cpdf_rodando) return;
  const it = cpdf_arquivos.find(a => a.id === id);
  if (it && it.saida) URL.revokeObjectURL(it.saida.url);
  cpdf_arquivos = cpdf_arquivos.filter(a => a.id !== id);
  cpdf_render();
}

function cpdf_limpar() {
  if (cpdf_rodando) return;
  cpdf_arquivos.forEach(a => { if (a.saida) URL.revokeObjectURL(a.saida.url); });
  cpdf_arquivos = [];
  cpdf_render();
}

function cpdf_render() {
  const lista = document.getElementById('cpdf-lista');
  const btn = document.getElementById('cpdf-btn');
  if (!lista) return;
  const pendentes = cpdf_arquivos.filter(a => a.estado === 'pronto').length;
  if (btn) {
    btn.disabled = cpdf_rodando || !pendentes;
    btn.textContent = cpdf_rodando ? 'Compactando…' : (pendentes > 1 ? `Compactar ${pendentes} PDFs` : 'Compactar PDF');
  }
  const limpar = document.getElementById('cpdf-limpar');
  if (limpar) limpar.style.display = cpdf_arquivos.length && !cpdf_rodando ? '' : 'none';
  if (!cpdf_arquivos.length) { lista.innerHTML = ''; return; }
  lista.innerHTML = '<table class="data-table idv-tabela"><thead><tr><th>Arquivo</th><th>Original</th><th>Resultado</th><th></th></tr></thead><tbody>' +
    cpdf_arquivos.map(a => {
      const faixa = a.estado === 'erro' ? 'var(--idv-cr)' : a.estado === 'feito' ? 'var(--idv-ok)' : a.estado === 'igual' ? 'var(--idv-at)' : 'transparent';
      let res = '';
      if (a.estado === 'pronto') res = '<span style="color:var(--idv-sec)">aguardando</span>';
      if (a.estado === 'rodando') res = cpdf_esc(a.msg);
      if (a.estado === 'erro') res = '<span style="color:var(--idv-cr)">' + cpdf_esc(a.msg) + '</span>';
      if (a.estado === 'feito') res = `<b>${cpdf_tamanho(a.saida.tamanho)}</b> <span class="idv-etq ok">−${a.saida.reducao}%</span>`;
      if (a.estado === 'igual') res = '<span style="color:var(--idv-at)">' + cpdf_esc(a.msg) + '</span>';
      const acao = a.estado === 'feito'
        ? `<a class="idv-btn mini concluir" href="${a.saida.url}" download="${cpdf_esc(a.saida.nome)}">Baixar</a>`
        : (cpdf_rodando ? '' : `<button class="idv-btn mini" type="button" onclick="cpdf_remover(${a.id})">Tirar</button>`);
      return `<tr style="box-shadow:inset 3px 0 0 ${faixa}"><td>${cpdf_esc(a.file.name)}</td><td class="idv-data">${cpdf_tamanho(a.file.size)}</td><td>${res}</td><td style="text-align:right">${acao}</td></tr>`;
    }).join('') + '</tbody></table>';
}

async function cpdf_carregarLibs() {
  await _carregarScriptSE(CPDF_URL_PDFJS, 'pdfjsLib');
  try { pdfjsLib.GlobalWorkerOptions.workerSrc = CPDF_URL_WORKER; } catch (e) { /* segue sem worker */ }
  await _carregarScriptSE(CPDF_URL_JSPDF, 'jspdf');
}

async function cpdf_compactarUm(item, nivel, cinza, aoProgredir) {
  const dados = new Uint8Array(await item.file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: dados, isEvalSupported: false }).promise;
  const escala = nivel.dpi / 72;
  let doc = null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  for (let n = 1; n <= pdf.numPages; n++) {
    aoProgredir(`página ${n} de ${pdf.numPages}`);
    const pag = await pdf.getPage(n);
    const vp1 = pag.getViewport({ scale: 1 });
    const vp = pag.getViewport({ scale: escala });
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await pag.render({ canvasContext: ctx, viewport: vp }).promise;
    if (cinza) {
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) { const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; d[i] = d[i + 1] = d[i + 2] = y; }
      ctx.putImageData(img, 0, 0);
    }
    const jpeg = canvas.toDataURL('image/jpeg', nivel.qualidade);
    const larg = vp1.width, alt = vp1.height, orient = larg > alt ? 'l' : 'p';
    if (!doc) doc = new jspdf.jsPDF({ orientation: orient, unit: 'pt', format: [larg, alt], compress: true });
    else doc.addPage([larg, alt], orient);
    doc.addImage(jpeg, 'JPEG', 0, 0, larg, alt, undefined, 'FAST');
    pag.cleanup();
  }
  await pdf.destroy();
  canvas.width = canvas.height = 0;
  return doc.output('blob');
}

async function cpdf_compactar() {
  if (cpdf_rodando) return;
  const escolha = document.querySelector('input[name="cpdf-nivel"]:checked')?.value || 'recomendada';
  const nivel = CPDF_NIVEIS[escolha];
  const cinza = !!document.getElementById('cpdf-cinza')?.checked;
  cpdf_rodando = true;
  cpdf_render();
  try {
    await cpdf_carregarLibs();
  } catch (e) {
    cpdf_rodando = false;
    cpdf_arquivos = cpdf_arquivos.map(a => a.estado === 'pronto' ? { ...a, estado: 'erro', msg: 'Sem internet para carregar o leitor de PDF. Tente de novo.' } : a);
    cpdf_render();
    return;
  }
  for (const alvo of cpdf_arquivos.filter(a => a.estado === 'pronto')) {
    const atualizar = mudanca => { cpdf_arquivos = cpdf_arquivos.map(a => a.id === alvo.id ? { ...a, ...mudanca } : a); cpdf_render(); };
    atualizar({ estado: 'rodando', msg: 'abrindo…' });
    try {
      const blob = await cpdf_compactarUm(alvo, nivel, cinza, msg => atualizar({ msg }));
      if (blob.size >= alvo.file.size) {
        atualizar({ estado: 'igual', msg: 'Já estava compactado — o original é menor. Use o original ou tente "Extrema".' });
        continue;
      }
      const base = alvo.file.name.replace(/\.pdf$/i, '');
      atualizar({ estado: 'feito', msg: '', saida: { url: URL.createObjectURL(blob), nome: base + '_compactado.pdf', tamanho: blob.size, reducao: Math.min(99, Math.floor((1 - blob.size / alvo.file.size) * 100)) } });
    } catch (e) {
      const senha = e && (e.name === 'PasswordException' || /password/i.test(e.message || ''));
      console.error('[compactar-pdf]', alvo.file.name, e);
      atualizar({ estado: 'erro', msg: senha ? 'PDF protegido por senha.' : 'Não consegui ler este PDF.' });
    }
  }
  cpdf_rodando = false;
  cpdf_render();
}
