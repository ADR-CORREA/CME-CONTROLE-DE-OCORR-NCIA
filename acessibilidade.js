/* ═══════════ PROTEÇÃO E USO PELO TECLADO — todas as telas (Fase 1 do novo visual, 20/10/2026) ═══════════
   Age de forma central, sem mexer em cada tela:
   • janela (modal) com algo digitado pergunta antes de fechar por clique fora ou Esc;
   • janela abre com foco no 1º campo, prende o Tab dentro dela e devolve o foco ao fechar (role=dialog);
   • botão de salvar não aceita o 2º clique enquanto o 1º trabalha;
   • abas, sub-abas e linhas clicáveis funcionam com Tab + Enter/Espaço;
   • rótulo ligado ao campo (clicar no rótulo foca; leitor de tela diz o nome);
   • campos de dado pessoal sem sugestão automática do navegador; botão ✕ com nome "Fechar".
   Prefixo _acc. Emojis só por \u{...}. Par: identidade.css (foco visível, movimento reduzido). */

(function () {
  'use strict';
  const NATIVOS = 'a[href],button,input,select,textarea,summary,label,iframe,[contenteditable="true"]';
  const SO_PARA = /^\s*(event\.)?stopPropagation\(\)\s*;?\s*$/; // célula que só barra o clique da linha (ex.: caixa de seleção)
  let _accSeq = 0;

  // ── janelas: algo foi digitado? ────────────────────────────────────────────
  // marca a janela aberta como "suja" quando a pessoa digita/muda algo dentro dela
  function _accMarcarSuja(e) {
    const ov = e.target && e.target.closest && e.target.closest('.modal-overlay.open');
    if (ov && e.isTrusted) ov.dataset.accSuja = '1';
  }
  document.addEventListener('input', _accMarcarSuja, true);
  document.addEventListener('change', _accMarcarSuja, true);

  // pode fechar sem perder nada? (pergunta só se houve digitação)
  window._accPodeFechar = function (ov) {
    if (!ov || ov.dataset.accSuja !== '1') return true;
    return confirm('Fechar esta janela e descartar o que foi digitado?');
  };

  // ── janelas: foco ao abrir, Tab preso dentro, foco de volta ao fechar ─────
  const _accOrigem = new WeakMap(); // janela → elemento que estava com foco antes de abrir
  function _accFocaveis(box) {
    return [...box.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter(el => el.offsetParent !== null || el === document.activeElement);
  }
  function _accAoAbrir(ov) {
    delete ov.dataset.accSuja; // janela reaberta começa limpa
    const box = ov.querySelector('.modal-box') || ov.firstElementChild || ov;
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    const tit = box.querySelector('h1,h2,h3,.modal-header');
    if (tit) { if (!tit.id) tit.id = 'acc-tit-' + (++_accSeq); box.setAttribute('aria-labelledby', tit.id); }
    const ativo = document.activeElement;
    if (ativo && ativo !== document.body && !ov.contains(ativo)) _accOrigem.set(ov, ativo);
    setTimeout(() => {
      if (!ov.classList.contains('open') || ov.contains(document.activeElement)) return;
      const campos = _accFocaveis(box);
      const alvo = campos.find(el => /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && !el.readOnly) || campos.find(el => !/fechar|cancelar/i.test(el.getAttribute('aria-label') || el.textContent || '')) || campos[0];
      if (alvo) { try { alvo.focus({ preventScroll: false }); } catch (e) {} }
    }, 60);
  }
  function _accAoFechar(ov) {
    delete ov.dataset.accSuja;
    const volta = _accOrigem.get(ov); _accOrigem.delete(ov);
    if (volta && document.contains(volta) && !document.querySelector('.modal-overlay.open')) { try { volta.focus({ preventScroll: true }); } catch (e) {} }
  }
  // Tab não "vaza" para a tela de trás
  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const abertas = document.querySelectorAll('.modal-overlay.open'); if (!abertas.length) return;
    const ov = abertas[abertas.length - 1], box = ov.querySelector('.modal-box') || ov;
    const campos = _accFocaveis(box); if (!campos.length) return;
    const pri = campos[0], ult = campos[campos.length - 1];
    if (!box.contains(document.activeElement)) { e.preventDefault(); pri.focus(); return; }
    if (e.shiftKey && document.activeElement === pri) { e.preventDefault(); ult.focus(); }
    else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); pri.focus(); }
  });

  // ── botão de salvar: sem 2º clique enquanto o 1º trabalha ─────────────────
  // vale para os botões de rodapé de janela e para os que dizem Salvar/Registrar/Confirmar/Gravar/Enviar
  const _ACC_SALVAR = /^\s*(\S+\s+)?(salvar|registrar|confirmar|gravar|enviar|cadastrar|criar|lançar|atualizar dados)/i;
  document.addEventListener('click', e => {
    const b = e.target && e.target.closest && e.target.closest('button');
    if (!b || b.disabled) return;
    const ehSalvar = b.closest('.modal-footer') && /btn-primary|idv-btn/.test(b.className) || _ACC_SALVAR.test(b.textContent || '');
    if (!ehSalvar) return;
    const agora = Date.now();
    if (b._accUltimo && agora - b._accUltimo < 1500) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    b._accUltimo = agora;
  }, true);

  // ── teclado: o que é clicável recebe foco e responde a Enter/Espaço ────────
  function _accPreparar(el) {
    if (el._accOk || el.matches(NATIVOS) || el.hasAttribute('tabindex')) return;
    const oc = el.getAttribute('onclick') || '';
    if (SO_PARA.test(oc) || el.classList.contains('modal-overlay')) return;
    el._accOk = true;
    el.setAttribute('tabindex', '0');
    if (el.classList.contains('nav-tab') || el.classList.contains('sub-tab')) {
      el.setAttribute('role', 'tab'); el.setAttribute('aria-selected', el.classList.contains('active') ? 'true' : 'false');
    } else if (el.tagName !== 'TR' && !el.hasAttribute('role')) el.setAttribute('role', 'button');
  }
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target;
    if (!el || !el._accOk || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault(); el.click();
  });

  // ── rótulo ligado ao campo + campos sem sugestão do navegador ─────────────
  function _accRotulos(raiz) {
    raiz.querySelectorAll('.form-field > label:not([for]), .form-group > label:not([for])').forEach(lab => {
      const campo = lab.parentElement.querySelector('input:not([type="hidden"]),select,textarea');
      if (!campo || lab.contains(campo)) return;
      if (!campo.id) campo.id = 'acc-campo-' + (++_accSeq);
      lab.htmlFor = campo.id;
    });
    raiz.querySelectorAll('input:not([autocomplete]):not([type="password"]):not([type="hidden"]), textarea:not([autocomplete])').forEach(c => {
      if (c.closest('#login-screen')) return;
      c.setAttribute('autocomplete', 'off');
      if (/cpf/i.test((c.id || '') + ' ' + (c.name || '') + ' ' + (c.placeholder || '')) && !c.hasAttribute('inputmode')) c.setAttribute('inputmode', 'numeric');
    });
    // botão ✕ / × sem nome → "Fechar"
    // (o bloco cme-icones troca o "✕" por desenho em tempo de execução, então vale também a classe .modal-close)
    raiz.querySelectorAll('button:not([aria-label])').forEach(b => {
      if (b.classList.contains('modal-close') || /^\s*[\u{2715}\u{00D7}\u{2716}xX]\s*$/u.test(b.textContent || '')) { b.setAttribute('aria-label', 'Fechar'); if (!b.hasAttribute('type')) b.type = 'button'; }
    });
  }

  function _accVarrer(raiz) {
    if (!raiz || !raiz.querySelectorAll) return;
    if (raiz.matches && (raiz.matches('[onclick],.nav-tab,.sub-tab'))) _accPreparar(raiz);
    raiz.querySelectorAll('[onclick],.nav-tab,.sub-tab').forEach(_accPreparar);
    _accRotulos(raiz);
  }

  // ── observador único: telas redesenhadas, janelas abrindo/fechando, aba ativa ──
  let _accFila = new Set(), _accAgendado = false;
  function _accProcessar() {
    _accAgendado = false;
    const fila = [..._accFila]; _accFila.clear();
    fila.forEach(n => { if (document.contains(n)) _accVarrer(n); });
  }
  const obs = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'childList') {
        m.addedNodes.forEach(n => { if (n.nodeType === 1) _accFila.add(n); });
      } else if (m.type === 'attributes' && m.attributeName === 'class') {
        const el = m.target, era = m.oldValue || '';
        if (el.classList.contains('modal-overlay')) {
          const abriu = el.classList.contains('open'), estava = /\bopen\b/.test(era);
          if (abriu && !estava) _accAoAbrir(el); else if (!abriu && estava) _accAoFechar(el);
        } else if (el._accOk && el.getAttribute('role') === 'tab') {
          el.setAttribute('aria-selected', el.classList.contains('active') ? 'true' : 'false');
        }
      }
    }
    if (_accFila.size && !_accAgendado) { _accAgendado = true; requestAnimationFrame(_accProcessar); }
  });

  function _accIniciar() {
    _accVarrer(document.body);
    document.querySelectorAll('.nav-tabs').forEach(n => n.setAttribute('role', 'tablist'));
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _accIniciar); else _accIniciar();
})();
