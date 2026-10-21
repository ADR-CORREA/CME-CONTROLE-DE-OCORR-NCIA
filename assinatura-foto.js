/* ═══ Assinatura por FOTO (prefixo assFoto_) ═══════════════════════════════════
   O servidor tira uma foto da assinatura numa folha branca e o sistema devolve só
   o traço da caneta, recortado e sobre fundo branco — pronto para o documento.
   Passos: (1) papel estimado por blocos (anula sombra e luz desigual); (2) o que
   não é folha (mesa, fundo escuro) e a borda da folha viram branco; (3) tinta =
   pixel bem mais escuro que o papel embaixo dele; (4) sujeiras e marcas soltas
   saem; fica o conjunto principal da assinatura; (5) recorte com margem.
   O núcleo trabalha em pixels (RGBA) para poder ser testado fora do navegador. */

const ASSFOTO_LADO_MAX = 1600;     // a foto é reduzida para no máximo isto antes de tratar
const ASSFOTO_SAIDA_MAX = 1200;    // largura máxima da assinatura pronta
const ASSFOTO_TINTA = 0.80;        // pixel/papel abaixo disto = tinta (máscara)
const ASSFOTO_TOM_LO = 0.55, ASSFOTO_TOM_HI = 0.88;   // faixa do traço suave (antisserrilhado)

function _assFotoLuminancia(rgba, n) {
  const L = new Float32Array(n);
  for (let i = 0, j = 0; i < n; i++, j += 4) L[i] = rgba[j] * 0.299 + rgba[j + 1] * 0.587 + rgba[j + 2] * 0.114;
  return L;
}

// Papel embaixo de cada pixel: percentil 90 de cada bloco (a tinta é minoria), mediana 3x3 entre blocos e interpolação.
function _assFotoFundo(L, w, h) {
  const c = Math.max(16, Math.round(Math.max(w, h) / 40));
  const gw = Math.ceil(w / c), gh = Math.ceil(h / c);
  const grade = new Float32Array(gw * gh), hist = new Uint32Array(256);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    hist.fill(0); let tot = 0;
    for (let y = gy * c, ye = Math.min(h, y + c); y < ye; y++) for (let x = gx * c, xe = Math.min(w, x + c); x < xe; x++) { hist[L[y * w + x] | 0]++; tot++; }
    let alvo = tot * 0.9, acc = 0, v = 255;
    for (let k = 0; k < 256; k++) { acc += hist[k]; if (acc >= alvo) { v = k; break; } }
    grade[gy * gw + gx] = v;
  }
  const suave = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const viz = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = gx + dx, y = gy + dy;
      if (x >= 0 && y >= 0 && x < gw && y < gh) viz.push(grade[y * gw + x]);
    }
    viz.sort((a, b) => a - b);
    suave[gy * gw + gx] = viz[viz.length >> 1];
  }
  return { c, gw, gh, grade, suave };
}

// Blocos que não são folha + 1 bloco em volta (a borda da folha). A folha é o que se alcança a partir
// do bloco mais claro sem atravessar degrau brusco: sombra é gradual e passa; folha→mesa é um salto e trava.
// Também compara com o bloco de dois passos atrás: a borda desfocada cria um bloco "meio-termo" que serviria de escada.
const ASSFOTO_DEGRAU = 0.88, ASSFOTO_DEGRAU2 = 0.82;
function _assFotoForaDaFolha(f) {
  const n = f.gw * f.gh, folha = new Uint8Array(n), pai = new Int32Array(n).fill(-1), fila = [];
  let ini = 0;
  for (let i = 1; i < n; i++) if (f.grade[i] > f.grade[ini]) ini = i;
  folha[ini] = 1; fila.push(ini);
  for (let k = 0; k < fila.length; k++) {
    const p = fila[k], gx = p % f.gw, gy = (p - gx) / f.gw, avo = pai[p] >= 0 ? f.grade[pai[p]] : f.grade[p];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = gx + dx, y = gy + dy;
      if (x < 0 || y < 0 || x >= f.gw || y >= f.gh) continue;
      const q = y * f.gw + x;
      if (!folha[q] && f.grade[q] >= f.grade[p] * ASSFOTO_DEGRAU && f.grade[q] >= avo * ASSFOTO_DEGRAU2) { folha[q] = 1; pai[q] = p; fila.push(q); }
    }
  }
  const fora = new Uint8Array(n);
  for (let i = 0; i < n; i++) fora[i] = folha[i] ? 0 : 1;
  const exp = new Uint8Array(fora.length);
  for (let gy = 0; gy < f.gh; gy++) for (let gx = 0; gx < f.gw; gx++) {
    let v = 0;
    for (let dy = -1; dy <= 1 && !v; dy++) for (let dx = -1; dx <= 1 && !v; dx++) {
      const x = gx + dx, y = gy + dy;
      if (x >= 0 && y >= 0 && x < f.gw && y < f.gh && fora[y * f.gw + x]) v = 1;
    }
    exp[gy * f.gw + gx] = v;
  }
  return exp;
}

function _assFotoRazao(L, w, h, f, fora) {
  const R = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.min(f.gh - 1, Math.max(0, (y + 0.5) / f.c - 0.5)), y0 = Math.floor(fy), y1 = Math.min(f.gh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (fora[Math.floor(y / f.c) * f.gw + Math.floor(x / f.c)]) { R[i] = 1; continue; }
      const fx = Math.min(f.gw - 1, Math.max(0, (x + 0.5) / f.c - 0.5)), x0 = Math.floor(fx), x1 = Math.min(f.gw - 1, x0 + 1), tx = fx - x0;
      const a = f.suave[y0 * f.gw + x0], b = f.suave[y0 * f.gw + x1], cc = f.suave[y1 * f.gw + x0], d = f.suave[y1 * f.gw + x1];
      const fundo = (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty;
      R[i] = Math.min(1.2, L[i] / Math.max(1, fundo));
    }
  }
  return R;
}

// Componentes conectados (8 vizinhos) da máscara de tinta: rótulo por pixel + área e caixa de cada um.
function _assFotoComponentes(M, w, h) {
  const rot = new Int32Array(w * h).fill(-1), comps = [], pilha = new Int32Array(w * h);
  for (let s = 0; s < w * h; s++) {
    if (!M[s] || rot[s] >= 0) continue;
    const id = comps.length, cp = { id, area: 0, x0: w, y0: h, x1: 0, y1: 0, borda: false };
    let topo = 0; pilha[topo++] = s; rot[s] = id;
    while (topo) {
      const p = pilha[--topo], x = p % w, y = (p - x) / w;
      cp.area++;
      if (x < cp.x0) cp.x0 = x; if (x > cp.x1) cp.x1 = x; if (y < cp.y0) cp.y0 = y; if (y > cp.y1) cp.y1 = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) cp.borda = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (M[q] && rot[q] < 0) { rot[q] = id; pilha[topo++] = q; }
      }
    }
    comps.push(cp);
  }
  return { rot, comps };
}

// Conjunto principal: começa no maior traço e agrega os vizinhos próximos (pingos, sobrenome separado).
function _assFotoAgrupar(comps, w, h) {
  const minArea = Math.max(8, Math.round(w * h * 0.00002));
  const bons = comps.filter(c => c.area >= minArea && !(c.borda && (c.x1 - c.x0 > w * 0.5 || c.y1 - c.y0 > h * 0.5)));
  if (!bons.length) return null;
  bons.sort((a, b) => b.area - a.area);
  const g = Math.round(Math.max(w, h) * 0.08);
  const caixa = { x0: bons[0].x0, y0: bons[0].y0, x1: bons[0].x1, y1: bons[0].y1 };
  const dentro = new Set([bons[0].id]);
  let mudou = true;
  while (mudou) {
    mudou = false;
    for (const c of bons) {
      if (dentro.has(c.id)) continue;
      if (c.x1 >= caixa.x0 - g && c.x0 <= caixa.x1 + g && c.y1 >= caixa.y0 - g && c.y0 <= caixa.y1 + g) {
        dentro.add(c.id); mudou = true;
        caixa.x0 = Math.min(caixa.x0, c.x0); caixa.y0 = Math.min(caixa.y0, c.y0); caixa.x1 = Math.max(caixa.x1, c.x1); caixa.y1 = Math.max(caixa.y1, c.y1);
      }
    }
  }
  return { caixa, dentro, descartados: comps.length - dentro.size };
}

/* Núcleo: RGBA da foto → RGBA da assinatura pronta (fundo branco) ou null se não achar assinatura. */
function assFoto_processarPixels(rgba, w, h) {
  const n = w * h, L = _assFotoLuminancia(rgba, n);
  const f = _assFotoFundo(L, w, h), fora = _assFotoForaDaFolha(f), R = _assFotoRazao(L, w, h, f, fora);
  const M = new Uint8Array(n);
  for (let i = 0; i < n; i++) M[i] = R[i] < ASSFOTO_TINTA ? 1 : 0;
  const { rot, comps } = _assFotoComponentes(M, w, h);
  const grupo = _assFotoAgrupar(comps, w, h);
  if (!grupo) return null;
  const { caixa, dentro } = grupo;
  // perto de um traço aceito (até 2 px) o tom suave entra; o resto vira papel branco
  const perto = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (rot[i] < 0 || !dentro.has(rot[i])) continue;
    const x = i % w, y = (i - x) / w;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) perto[ny * w + nx] = 1;
    }
  }
  const lado = Math.max(caixa.x1 - caixa.x0, caixa.y1 - caixa.y0);
  const pad = Math.max(8, Math.round(lado * 0.06));
  const sx = Math.max(0, caixa.x0 - pad), sy = Math.max(0, caixa.y0 - pad);
  const cw = Math.min(w, caixa.x1 + pad + 1) - sx, ch = Math.min(h, caixa.y1 + pad + 1) - sy;
  const out = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = (sy + y) * w + (sx + x), o = (y * cw + x) * 4;
    let v = 255;
    if (perto[i]) { const t = (R[i] - ASSFOTO_TOM_LO) / (ASSFOTO_TOM_HI - ASSFOTO_TOM_LO); v = Math.round(255 * (t < 0 ? 0 : t > 1 ? 1 : t)); }
    out[o] = out[o + 1] = out[o + 2] = v; out[o + 3] = 255;
  }
  return { rgba: out, w: cw, h: ch, info: { tracos: dentro.size, descartados: grupo.descartados, foraDaFolha: fora.some(v => v) } };
}

/* Navegador: dataURL da foto → Promise<{ ok, dataUrl, motivo }>. */
function assFoto_tratar(srcDataUrl) {
  return new Promise(function (resolve) {
    const img = new Image();
    img.onload = function () {
      try {
        const W = img.naturalWidth || 1, H = img.naturalHeight || 1, sc = Math.min(1, ASSFOTO_LADO_MAX / Math.max(W, H));
        const w = Math.max(1, Math.round(W * sc)), h = Math.max(1, Math.round(H * sc));
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
        const r = assFoto_processarPixels(ctx.getImageData(0, 0, w, h).data, w, h);
        if (!r) return resolve({ ok: false, dataUrl: srcDataUrl, motivo: 'Não encontrei a assinatura na foto. Tire de novo mais perto, com a folha branca ocupando a tela e boa luz.' });
        const o = document.createElement('canvas'); o.width = r.w; o.height = r.h;
        o.getContext('2d').putImageData(new ImageData(r.rgba, r.w, r.h), 0, 0);
        let fim = o;
        if (r.w > ASSFOTO_SAIDA_MAX) {
          fim = document.createElement('canvas'); fim.width = ASSFOTO_SAIDA_MAX; fim.height = Math.round(r.h * ASSFOTO_SAIDA_MAX / r.w);
          const fc = fim.getContext('2d'); fc.imageSmoothingQuality = 'high'; fc.drawImage(o, 0, 0, fim.width, fim.height);
        }
        resolve({ ok: true, dataUrl: fim.toDataURL('image/png'), info: r.info });
      } catch (e) { resolve({ ok: false, dataUrl: srcDataUrl, motivo: 'Não consegui tratar a foto (' + (e && e.message || e) + ').' }); }
    };
    img.onerror = function () { resolve({ ok: false, dataUrl: srcDataUrl, motivo: 'Não consegui abrir essa imagem. Use uma foto JPG ou PNG.' }); };
    img.src = srcDataUrl;
  });
}

if (typeof module !== 'undefined' && module.exports) module.exports = { assFoto_processarPixels };
