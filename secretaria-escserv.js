/* ═══════════════════════════ SECRETARIA — ESCALA DE SERVIÇO E APOIO ═══════════════════════════
   Sub-aba própria (pedido de 14/10/2026), separada de "Apoios e Dispensas" — são coisas diferentes:
   • em cima: a escala de apoio do administrativo aos sábados (secretaria-escala.js, _secCartaoEscala);
   • embaixo: a escala de serviço do mês, igual ao papel "ESCALA DE SERVIÇO (24x96)":
     guarnições ALFA–ECHO com os dias de plantão do mês e o posto de cada um, e o setor administrativo
     com o turno (M/T). Tudo sai do cadastro dos servidores (equipe, posto, setor, turno) e das férias/licenças.
     Clicar num nome abre o cadastro para editar. O mês acompanha as setas da escala de apoio.
   Depende de secretaria*.js e de getPlantaoParaData (index.html). Emojis só por \u{...}. */

function sec_renderEscalas() {
  const c = document.getElementById('sec-conteudo'); if (!c) return;
  c.innerHTML = _secCartaoEscala() + _secCartaoServico();
}

// dias do mês em que cada guarnição está de plantão (troca às 08h; o dia é o do início do plantão)
function _secServDiasGuarnicao(mes) {
  const [a, m] = mes.split('-').map(Number), ult = new Date(a, m, 0).getDate(), dias = {};
  for (let i = 1; i <= ult; i++) {
    const dt = mes + '-' + String(i).padStart(2, '0'), g = getPlantaoParaData(dt);
    (dias[g] = dias[g] || []).push(String(i).padStart(2, '0'));
  }
  return dias;
}

function _secCartaoServico() {
  const d = _secDados(), hoje = _secHoje(), mes = _secEscMesVis || hoje.slice(0, 7);
  const ini = mes + '-01', fim = mes + '-' + String(new Date(+mes.slice(0, 4), +mes.slice(5, 7), 0).getDate());
  const ativos = d.servidores.filter(s => (s.situacao || 'ativo') === 'ativo');
  const afastNoMes = sid => d.afastamentos.find(a => a.servidorId === sid && a.inicio <= fim && (a.fim || a.inicio) >= ini) || null;
  // afastado na maior parte do mês (20 dias ou mais) vai para a faixa de baixo, como "FÉRIAS: PP. Fulano" no papel
  const diasFora = a => { if (!a) return 0; const de = a.inicio > ini ? a.inicio : ini, ate = (a.fim || a.inicio) < fim ? (a.fim || a.inicio) : fim; return Math.round((new Date(ate + 'T12:00:00') - new Date(de + 'T12:00:00')) / 864e5) + 1; };
  const mesTodo = a => diasFora(a) >= 20;
  const dias = _secServDiasGuarnicao(mes), deHoje = mes === hoje.slice(0, 7) ? _secPlantaoAgora().guarnicao : '';
  const corPosto = { '1': '#dc2626', '2': '#2563eb' };

  const nomeChip = (s, extra) => {
    const af = afastNoMes(s.id);
    return '<div onclick="sec_editarServidor(\'' + s.id + '\')" title="' + esc(s.nome) + ' — clique para editar' + (af ? ' · ' + esc(af.tipo) + ' ' + _secBRc(af.inicio) + ' a ' + _secBRc(af.fim || af.inicio) : '') + '" style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:5px 8px;border:1px solid #e2e8f0;border-radius:6px;background:#fff;cursor:pointer">'
      + '<div style="min-width:0"><div style="font-size:.84rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(_secEscCurto(s.nome)) + '</div>'
      + (af ? '<div style="font-size:.68rem;font-weight:600;color:' + _secCorTipo(af.tipo) + '">' + esc(af.tipo.toLowerCase()) + ' ' + _secBRc(af.inicio) + '–' + _secBRc(af.fim || af.inicio) + '</div>' : '') + '</div>'
      + (extra || '') + '</div>';
  };

  // ── Plantão 24x96 ──
  const guarnicao = g => {
    const membros = ativos.filter(s => s.equipe === g);
    const fora = membros.filter(s => mesTodo(afastNoMes(s.id)));
    const lista = membros.filter(s => !fora.includes(s)).sort((a, b) => String(a.posto || '9').localeCompare(String(b.posto || '9')) || a.nome.localeCompare(b.nome));
    const atual = g === deHoje;
    return '<div style="flex:1 1 190px;min-width:180px;border:2px solid ' + (atual ? '#0d9488' : '#e2e8f0') + ';border-radius:8px;padding:8px;background:' + (atual ? '#f0fdfa' : '#fafafa') + '">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:6px"><div style="font-weight:700;font-size:.9rem">Guarnição ' + g + '</div>'
      + (atual ? '<div style="font-size:.66rem;font-weight:700;color:#0d9488">DE PLANTÃO</div>' : '') + '</div>'
      + '<div style="font-size:.72rem;color:#475569;font-family:var(--font-mono);margin:2px 0 8px">Dias: ' + (dias[g] || []).join(', ') + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:4px">' + (lista.length ? lista.map(s => nomeChip(s, s.posto ? '<span style="font-size:.68rem;font-weight:700;white-space:nowrap;color:' + (corPosto[s.posto] || '#475569') + '">Posto ' + esc(s.posto) + '</span>' : '<span style="font-size:.66rem;color:#94a3b8;white-space:nowrap">sem posto</span>')).join('')
        : '<div style="font-size:.8rem;color:#94a3b8">Ninguém cadastrado.</div>') + '</div>'
      + (fora.length ? '<div style="margin-top:6px;padding-top:6px;border-top:1px dashed #cbd5e1;display:flex;flex-direction:column;gap:4px">' + fora.map(s => '<div style="opacity:.6">' + nomeChip(s) + '</div>').join('') + '</div>' : '')
      + '</div>';
  };

  // ── Setor administrativo (expediente) ──
  const exp = ativos.filter(s => s.equipe === 'EXPEDIENTE');
  const setores = {}; exp.forEach(s => { const k = s.setor && s.setor !== 'Expediente' ? s.setor : 'Sem setor definido'; (setores[k] = setores[k] || []).push(s); });
  const ordemSetor = k => k === 'Gerência' ? '0' : k === 'Sem setor definido' ? '2' : '1' + k;
  const corTurno = { M: '#b45309', T: '#7c3aed' };
  const setorCard = k => '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:8px;background:#fafafa">'
    + '<div style="font-weight:700;font-size:.82rem;margin-bottom:6px">' + esc(k) + ' <span style="font-weight:400;color:#94a3b8">(' + setores[k].length + ')</span></div>'
    + '<div style="display:flex;flex-direction:column;gap:4px">' + setores[k].sort((a, b) => String(a.turno || 'Z').localeCompare(String(b.turno || 'Z')) || a.nome.localeCompare(b.nome))
      .map(s => nomeChip(s, s.turno ? '<span title="' + esc(_SEC_TURNOS[s.turno] || s.turno) + '" style="font-size:.7rem;font-weight:700;color:' + (corTurno[s.turno] || '#475569') + '">(' + esc(s.turno) + ')</span>' : '')).join('') + '</div></div>';

  return '<div id="sec-serv-card" style="background:#fff;border:1px solid #e2e8f0;border-left:4px solid #0d9488;border-radius:6px;padding:12px 14px;margin-top:12px">'
    + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:10px">'
    + '<div><div style="font-weight:700;font-size:1.05rem">\u{1F6E1}\u{FE0F} Escala de serviço (24x96) — Plantão da CME</div>'
    + '<div style="font-size:.78rem;color:#64748b">Sai do cadastro dos servidores (guarnição, posto, setor e turno) · clique no nome para editar</div></div>'
    + '<div style="font-weight:700;text-transform:capitalize">' + esc(_secEscMesTxt(mes)) + '</div></div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:stretch">' + _PL_EQUIPES_SEC.map(guarnicao).join('') + '</div>'
    + '<div style="font-size:.74rem;color:#475569;margin-top:6px"><b style="color:#dc2626">Posto 1</b> — instalação, inspeção, criação de zona · <b style="color:#2563eb">Posto 2</b> — tratamento de ocorrência, mudança de endereço, alimentação do drive, livro</div>'
    + '<div style="margin-top:14px;font-weight:700;font-size:.95rem">\u{1F3E2} Setor administrativo <span style="font-weight:400;font-size:.78rem;color:#64748b">— Manhã (M) · Tarde (T)</span></div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin-top:6px">'
    + (exp.length ? Object.keys(setores).sort((a, b) => ordemSetor(a).localeCompare(ordemSetor(b))).map(setorCard).join('') : '<div style="font-size:.85rem;color:#94a3b8">Nenhum servidor do expediente cadastrado.</div>')
    + '</div></div>';
}
const _PL_EQUIPES_SEC = ['ALFA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO'];
