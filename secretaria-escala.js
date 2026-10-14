/* ═══════════════════════════ SECRETARIA — ESCALA DE APOIO DO ADMINISTRATIVO (SÁBADOS) ═══════════════════════════
   Sábados das 08h às 12h. É OBRIGAÇÃO do servidor administrativo para ter direito ao adicional noturno —
   NÃO gera dispensa (não mexe na Ficha de Apoio e Dispensas; apoio em evento de folga é outra coisa).
   • Dados: cme_secretaria.escalaSabado = [{ id, data, servidorId | nome, local: CME|PEF, status: ''|presente|falta }]
     e cme_secretaria.config.escalaHorario (padrão "das 08h às 12h").
   • Quadro no painel Hoje (igual ao papel), janela "Montar / editar escala" e impressão.
   Depende de secretaria*.js. Emojis só por \u{...}. Prefixo _secEsc / sec_esc. */

const _SEC_ESC_LOCAIS = ['CME', 'PEF'];
const _SEC_ESC_HORARIO = 'das 08h às 12h';
// Escala de outubro/2026 enviada pela gerência em 14/10 (botão "carregar" aparece só enquanto o mês estiver vazio)
const _SEC_ESC_OUT2026 = {
  '2026-10-03': [['ADRIANO', 'CME'], ['RONI', 'CME'], ['EVERTON', 'CME'], ['P ALEXANDRE', 'PEF']],
  '2026-10-10': [['PATRICIA', 'CME'], ['FABIOLLA', 'CME'], ['LENILDA', 'PEF']],
  '2026-10-17': [['DIEGO SOUZA', 'CME'], ['DEBORA', 'CME'], ['P GABRIEL', 'PEF']],
  '2026-10-24': [['VALDIRENE', 'CME'], ['PEDRO', 'CME'], ['EDICLEYDE', 'PEF']],
  '2026-10-31': [['BRUNA', 'CME'], ['ROZANE', 'CME'], ['SILMARA', 'PEF']],
};
let _secEscMesEd = null;

function _secEscNorm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function _secEscSabados(mes) {
  const [a, m] = mes.split('-').map(Number), out = [];
  for (let dia = 1; dia <= new Date(a, m, 0).getDate(); dia++) { const dt = new Date(a, m - 1, dia, 12); if (dt.getDay() === 6) out.push(mes + '-' + String(dia).padStart(2, '0')); }
  return out;
}
function _secEscDatas(mes, d) { return [...new Set(_secEscSabados(mes).concat(d.escalaSabado.filter(x => x.data.slice(0, 7) === mes).map(x => x.data)))].sort(); }
function _secEscNome(x, d) { return x.servidorId ? _secNomeServ(x.servidorId, d) : (x.nome || '—'); }
function _secEscCurto(nome) { const p = String(nome).split(' ').filter(Boolean); return p.length > 2 ? p[0] + ' ' + p[p.length - 1] : nome; }
function _secEscMesTxt(mes) { return new Date(mes + '-15T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }); }
// servidor pelo nome curto do papel ("P ALEXANDRE" = Paulo Alexandre…): só casa se for ÚNICO
function _secEscAcharServidor(curto, d) {
  const toks = _secEscNorm(curto).split(' ').filter(Boolean);
  const cands = d.servidores.filter(s => { const n = _secEscNorm(s.nome).split(' '); return toks.every(t => t.length === 1 ? n.some(x => x[0] === t) : n.includes(t)); });
  return cands.length === 1 ? cands[0] : null;
}
function _secEscAfastadosMes(mes, d) {
  const ini = mes + '-01', fim = mes + '-31';
  return d.afastamentos.filter(a => a.inicio <= fim && (a.fim || a.inicio) >= ini).sort((a, b) => String(a.tipo).localeCompare(String(b.tipo)) || String(a.inicio).localeCompare(String(b.inicio)));
}

// ── Quadro no painel Hoje ─────────────────────────────────────────────────────
function _secCartaoEscala(mes) {
  const d = _secDados(), hoje = _secHoje(); mes = mes || hoje.slice(0, 7);
  const datas = _secEscDatas(mes, d), prox = datas.find(x => x >= hoje);
  const horario = (d.config || {}).escalaHorario || _SEC_ESC_HORARIO;
  const doDia = dt => d.escalaSabado.filter(x => x.data === dt).sort((a, b) => a.local.localeCompare(b.local) || _secEscNome(a, d).localeCompare(_secEscNome(b, d)));
  const vazio = !d.escalaSabado.some(x => x.data.slice(0, 7) === mes);
  const escalados = new Set(d.escalaSabado.filter(x => x.data.slice(0, 7) === mes && x.servidorId).map(x => x.servidorId));
  const semEscala = d.servidores.filter(s => (s.situacao || 'ativo') === 'ativo' && s.equipe === 'EXPEDIENTE' && !escalados.has(s.id) && !_secEscAfastadosMes(mes, d).some(a => a.servidorId === s.id));
  const afast = _secEscAfastadosMes(mes, d);
  const marca = x => x.status === 'presente' ? ' <span title="compareceu" style="color:#16a34a">\u{2714}</span>' : x.status === 'falta' ? ' <span title="faltou" style="color:#dc2626">\u{2718}</span>' : '';
  return '<div style="background:#fff;border:1px solid #e2e8f0;border-left:4px solid #7c3aed;border-radius:6px;padding:12px 14px;margin-top:12px">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">'
    + '<div><div style="font-weight:700;font-size:1.02rem">\u{1F4CB} Escala de apoio do administrativo — <span style="text-transform:capitalize">' + esc(_secEscMesTxt(mes)) + '</span></div>'
    + '<div style="font-size:.78rem;color:#64748b">Sábados, ' + esc(horario) + ' · obrigação para o adicional noturno (não gera dispensa)</div></div>'
    + '<div style="display:flex;gap:6px;flex-wrap:wrap">' + (mes === '2026-10' && vazio ? '<button class="btn-sm btn-outline" onclick="sec_escCarregarOutubro()">Carregar a escala de outubro (papel)</button>' : '')
    + '<button class="btn-sm btn-outline" onclick="sec_escImprimir(\'' + mes + '\')">\u{1F5A8}\u{FE0F} Imprimir</button>'
    + '<button class="btn-sm btn-primary" onclick="sec_escEditar(\'' + mes + '\')">\u{270F}\u{FE0F} Montar / editar escala</button></div></div>'
    + (vazio ? '<div style="font-size:.86rem;color:#94a3b8;padding:10px 0">Escala deste mês ainda não montada. Clique em "Montar / editar escala".</div>'
      : '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:10px">' + datas.map(dt => {
        const lst = doDia(dt), ehHoje = dt === hoje, ehProx = dt === prox;
        return '<div style="border:1px solid ' + (ehHoje || ehProx ? '#7c3aed' : '#e2e8f0') + ';border-radius:4px;padding:6px 8px;' + (dt < hoje ? 'background:#f8fafc' : '') + '">'
          + '<div style="font-weight:700;font-size:.82rem;color:' + (ehHoje || ehProx ? '#6d28d9' : '#334155') + '">' + (new Date(dt + 'T12:00:00').getDay() === 6 ? 'Sáb ' : '') + _secBR(dt).slice(0, 5)
          + (ehHoje ? ' · HOJE' : ehProx ? ' · próximo' : '') + '</div>'
          + (lst.length ? lst.map(x => '<div style="font-size:.8rem;padding:1px 0">' + esc(_secEscCurto(_secEscNome(x, d))) + ' <span style="font-size:.66rem;font-weight:600;padding:0 4px;border-radius:2px;background:' + (x.local === 'PEF' ? '#fef3c7;color:#92400e' : '#dbeafe;color:#1e40af') + '">' + esc(x.local) + '</span>' + marca(x) + '</div>').join('')
            : '<div style="font-size:.78rem;color:#cbd5e1">ninguém escalado</div>') + '</div>';
      }).join('') + '</div>')
    + (afast.length ? '<div style="font-size:.78rem;color:#334155;margin-top:10px;line-height:1.5"><b>Férias e licenças no mês:</b> ' + afast.map(a => esc(_secEscCurto(_secNomeServ(a.servidorId, d))) + ' <span style="color:#64748b">(' + esc(a.tipo) + ' ' + _secBR(a.inicio).slice(0, 5) + ' a ' + _secBR(a.fim || a.inicio).slice(0, 5) + ')</span>').join(' · ') + '</div>' : '')
    + (!vazio && semEscala.length ? '<div style="font-size:.78rem;color:#b45309;margin-top:4px"><b>Expediente sem sábado neste mês:</b> ' + semEscala.map(s => esc(_secEscCurto(s.nome))).join(', ') + '</div>' : '')
    + '</div>';
}

// ── Janela de montar / editar (cada ação já grava; várias pessoas podem mexer) ─
function sec_escEditar(mes) {
  _secEscMesEd = mes || _secEscMesEd || _secHoje().slice(0, 7);
  const d = _secDados(), m = _secEscMesEd, hoje = _secHoje(), datas = _secEscDatas(m, d);
  const horario = (d.config || {}).escalaHorario || _SEC_ESC_HORARIO;
  const exp = d.servidores.filter(s => (s.situacao || 'ativo') === 'ativo').sort((a, b) => (a.equipe === 'EXPEDIENTE' ? 0 : 1) - (b.equipe === 'EXPEDIENTE' ? 0 : 1) || a.nome.localeCompare(b.nome));
  const noMes = id => d.escalaSabado.filter(x => x.servidorId === id && x.data.slice(0, 7) === m).map(x => _secBR(x.data).slice(0, 5));
  const nav = n => { const [a, mm] = m.split('-').map(Number), x = new Date(a, mm - 1 + n, 1); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  const opcoes = exp.map(s => { const ja = noMes(s.id); return '<option value="' + s.id + '">' + esc(s.nome) + (s.equipe && s.equipe !== 'EXPEDIENTE' ? ' (' + esc(s.equipe) + ')' : '') + (ja.length ? ' — já escalado ' + ja.join(', ') : '') + '</option>'; }).join('');
  const caixa = dt => {
    const lst = d.escalaSabado.filter(x => x.data === dt).sort((a, b) => a.local.localeCompare(b.local) || _secEscNome(a, d).localeCompare(_secEscNome(b, d))), passou = dt <= hoje;
    return '<div style="border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;margin-bottom:8px">'
      + '<div style="font-weight:700;margin-bottom:4px">' + (new Date(dt + 'T12:00:00').getDay() === 6 ? 'Sábado, ' : '') + _secBR(dt) + '</div>'
      + lst.map(x => '<div style="display:flex;align-items:center;gap:8px;padding:3px 0;border-top:1px solid #f1f5f9;flex-wrap:wrap"><span style="flex:1;min-width:160px;font-size:.88rem">' + esc(_secEscNome(x, d)) + (!x.servidorId ? ' <span style="font-size:.7rem;color:#94a3b8">(fora da lista de servidores)</span>' : '') + '</span>'
        + _SEC_ESC_LOCAIS.map(l => '<button type="button" onclick="sec_escAlterar(\'' + x.id + '\', {local:\'' + l + '\'})" style="padding:2px 10px;border-radius:4px;cursor:pointer;font-size:.78rem;font-weight:600;border:1px solid ' + (x.local === l ? '#2563eb;background:#dbeafe;color:#1e40af' : '#cbd5e1;background:#fff;color:#64748b') + '">' + l + '</button>').join('')
        + (passou ? '<select onchange="sec_escAlterar(\'' + x.id + '\', {status:this.value})" style="font-size:.78rem;padding:2px 4px"><option value="">presença?</option><option value="presente"' + (x.status === 'presente' ? ' selected' : '') + '>\u{2714} compareceu</option><option value="falta"' + (x.status === 'falta' ? ' selected' : '') + '>\u{2718} faltou</option></select>' : '')
        + '<button type="button" title="Tirar da escala" onclick="sec_escRemover(\'' + x.id + '\')" style="border:none;background:none;color:#b91c1c;cursor:pointer;font-size:1rem">\u{2715}</button></div>').join('')
      + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><select id="sec-esc-s-' + dt + '" style="flex:1;min-width:200px;padding:4px"><option value="">+ escolher servidor…</option>' + opcoes + '<option value="__outro">Outra pessoa (digitar o nome)…</option></select>'
      + '<select id="sec-esc-l-' + dt + '" style="padding:4px">' + _SEC_ESC_LOCAIS.map(l => '<option>' + l + '</option>').join('') + '</select>'
      + '<button type="button" class="btn-sm btn-primary" onclick="sec_escAdicionar(\'' + dt + '\')">Adicionar</button></div></div>';
  };
  _secModal('\u{1F4CB} Escala de apoio do administrativo',
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><button type="button" class="btn-secondary" onclick="sec_escEditar(\'' + nav(-1) + '\')">\u{2039}</button>'
    + '<b style="flex:1;text-align:center;text-transform:capitalize">' + esc(_secEscMesTxt(m)) + '</b><button type="button" class="btn-secondary" onclick="sec_escEditar(\'' + nav(1) + '\')">\u{203A}</button></div>'
    + '<div style="font-size:.8rem;color:#475569;background:#f8fafc;border-radius:4px;padding:6px 10px;margin-bottom:10px">Como preencher: em cada sábado, <b>escolha o servidor</b>, o <b>local</b> (CME ou PEF) e clique em <b>Adicionar</b>. Para trocar o local, clique em CME/PEF; para tirar, no \u{2715}. Depois do sábado, marque se <b>compareceu</b>. Tudo é salvo na hora.</div>'
    + '<div class="form-grid" style="margin-bottom:8px">' + _secCampo('sec-esc-horario', 'Horário', horario, 'onchange="sec_escHorario(this.value)"')
    + '<div class="form-field"><label>Data extra (feriado, mutirão…)</label><input type="date" id="sec-esc-extra" onchange="if(this.value){_secEscExtra=this.value;sec_escEditar()}"></div></div>'
    + datas.concat(typeof _secEscExtra === 'string' && _secEscExtra.slice(0, 7) === m && !datas.includes(_secEscExtra) ? [_secEscExtra] : []).sort().map(caixa).join(''),
    '<button class="btn-secondary" onclick="sec_escImprimir(\'' + m + '\')">\u{1F5A8}\u{FE0F} Imprimir</button>', 760);
}
var _secEscExtra = null;
async function sec_escAdicionar(dt) {
  const sel = document.getElementById('sec-esc-s-' + dt), local = document.getElementById('sec-esc-l-' + dt).value;
  let sid = sel && sel.value, nome = '';
  if (!sid) { _mostrarToast('Escolha o servidor.', 'erro'); return; }
  if (sid === '__outro') { nome = (prompt('Nome da pessoa (não está na lista de servidores):') || '').trim(); if (nome.length < 3) return; sid = ''; }
  const d0 = _secDados();
  if (sid && d0.escalaSabado.some(x => x.data === dt && x.servidorId === sid)) { _mostrarToast('Essa pessoa já está escalada neste dia.', 'erro'); return; }
  const afa = sid && d0.afastamentos.find(a => a.servidorId === sid && a.inicio <= dt && (a.fim || a.inicio) >= dt);
  if (afa && !confirm(_secNomeServ(sid, d0) + ' está de ' + afa.tipo + ' nesse dia. Escalar mesmo assim?')) return;
  const alvo = sid ? _secNomeServ(sid, d0) : nome;
  const ok = await _secMutar(d => { d.escalaSabado.push({ id: _secId('esc'), data: dt, servidorId: sid, nome, local, status: '', criadoPor: usuarioAtual ? usuarioAtual.nome : '', criadoEm: new Date().toISOString() }); },
    { action: 'sec_esc_add', alvo, detalhe: _secBR(dt) + ' · ' + local });
  if (ok) { sec_escEditar(); sec_render(); }
}
async function sec_escAlterar(id, mudar) {
  const d0 = _secDados(), x0 = d0.escalaSabado.find(e => e.id === id); if (!x0) return;
  const ok = await _secMutar(d => { const x = d.escalaSabado.find(e => e.id === id); if (!x) return false; Object.assign(x, mudar, { editadoPor: usuarioAtual ? usuarioAtual.nome : '', editadoEm: new Date().toISOString() }); },
    { action: mudar.status !== undefined ? 'sec_esc_presenca' : 'sec_esc_local', alvo: _secEscNome(x0, d0) + ' — ' + _secBR(x0.data), detalhe: mudar.status !== undefined ? (mudar.status || 'sem marcação') : mudar.local });
  if (ok) { sec_escEditar(); sec_render(); }
}
async function sec_escRemover(id) {
  const d0 = _secDados(), x = d0.escalaSabado.find(e => e.id === id); if (!x) return;
  if (!confirm('Tirar ' + _secEscNome(x, d0) + ' da escala de ' + _secBR(x.data) + '?')) return;
  const ok = await _secMutar(d => { const i = d.escalaSabado.findIndex(e => e.id === id); if (i < 0) return false; _secParaLixeira(d, 'escala', d.escalaSabado[i]); d.escalaSabado.splice(i, 1); },
    { action: 'sec_esc_remover', alvo: _secEscNome(x, d0), detalhe: _secBR(x.data) });
  if (ok) { sec_escEditar(); sec_render(); }
}
async function sec_escHorario(v) {
  v = String(v || '').trim().slice(0, 60); if (!v) return;
  await _secMutar(d => { d.config = Object.assign({}, d.config, { escalaHorario: v }); }, { action: 'sec_esc_horario', alvo: v });
  sec_render();
}
async function sec_escCarregarOutubro() {
  const d0 = _secDados();
  if (d0.escalaSabado.some(x => x.data.slice(0, 7) === '2026-10')) { _mostrarToast('Outubro já tem escala.', 'erro'); return; }
  const linhas = [];
  Object.entries(_SEC_ESC_OUT2026).forEach(([dt, lst]) => lst.forEach(([curto, local]) => { const s = _secEscAcharServidor(curto, d0); linhas.push({ dt, local, sid: s ? s.id : '', nome: s ? '' : curto }); }));
  const semCasar = linhas.filter(l => !l.sid).map(l => l.nome);
  if (!confirm('Carregar a escala de outubro/2026 (' + linhas.length + ' pessoas em 5 sábados)?' + (semCasar.length ? '\n\nNão achei na lista de servidores (entram só com o nome, dá para trocar depois): ' + semCasar.join(', ') : ''))) return;
  const agora = new Date().toISOString(), por = usuarioAtual ? usuarioAtual.nome : '';
  const ok = await _secMutar(d => {
    if (d.escalaSabado.some(x => x.data.slice(0, 7) === '2026-10')) return false;
    linhas.forEach(l => d.escalaSabado.push({ id: _secId('esc'), data: l.dt, servidorId: l.sid, nome: l.nome, local: l.local, status: '', criadoPor: por, criadoEm: agora }));
  }, { action: 'sec_esc_carregar', alvo: 'outubro/2026', detalhe: linhas.length + ' pessoa(s)' });
  if (ok) { _mostrarToast('Escala de outubro carregada.', 'sucesso'); sec_render(); }
}

// ── Impressão no formato do papel ─────────────────────────────────────────────
function sec_escImprimir(mes) {
  const d = _secDados(), datas = _secEscDatas(mes, d).filter(dt => d.escalaSabado.some(x => x.data === dt) || new Date(dt + 'T12:00:00').getDay() === 6);
  const horario = (d.config || {}).escalaHorario || _SEC_ESC_HORARIO, afast = _secEscAfastadosMes(mes, d);
  const b = 'border:1px solid #000;padding:6px;font-size:10.5pt;vertical-align:top';
  const nomes = dt => d.escalaSabado.filter(x => x.data === dt).sort((a, c) => a.local.localeCompare(c.local)).map(x => esc(_secEscCurto(_secEscNome(x, d)).toUpperCase()) + ' – ' + esc(x.local)).join('<br>');
  const porTipo = {}; afast.forEach(a => (porTipo[a.tipo] = porTipo[a.tipo] || []).push(a));
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>Escala de apoio - ' + esc(_secEscMesTxt(mes)) + '</title>'
    + '<style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,Helvetica,sans-serif;color:#000}table{border-collapse:collapse;width:100%}@media print{.np{display:none}}</style></head><body>'
    + '<div class="np" style="text-align:right;margin-bottom:8px"><button onclick="print()" style="padding:6px 14px">Imprimir</button></div>'
    + '<table><tr><th colspan="' + datas.length + '" style="' + b + ';background:#ddd;font-size:12pt">ESCALA DE APOIO DO ADMINISTRATIVO<br><span style="font-weight:normal">Horário: ' + esc(horario) + '</span></th></tr>'
    + '<tr>' + datas.map(dt => '<th style="' + b + '">DIA: ' + _secBR(dt) + '</th>').join('') + '</tr>'
    + '<tr>' + datas.map(dt => '<td style="' + b + ';height:90px">' + nomes(dt) + '</td>').join('') + '</tr></table>'
    + (afast.length ? '<div style="margin-top:12px;font-size:10.5pt;line-height:1.5">' + Object.entries(porTipo).map(([t, l]) => '<b><u>' + esc(t.toUpperCase()) + '</u>:</b> ' + l.map(a => 'PP. ' + esc(_secNomeServ(a.servidorId, d)) + ' – ' + _secBR(a.inicio) + ' a ' + _secBR(a.fim || a.inicio)).join('; ') + '.').join('<br>') + '</div>' : '')
    + '<div style="font-size:8pt;color:#555;margin-top:10px">Emitida pelo sistema CME em ' + new Date().toLocaleString('pt-BR') + '.</div></body></html>';
  _entregarDoc(new Blob([html], { type: 'text/html' }), 'Escala de apoio ' + mes + '.html');
}
Object.assign(_SEC_ACOES, { sec_esc_add: 'Escalou no apoio de sábado', sec_esc_remover: 'Tirou da escala de sábado', sec_esc_local: 'Trocou o local na escala', sec_esc_presenca: 'Marcou presença na escala', sec_esc_horario: 'Alterou o horário da escala', sec_esc_carregar: 'Carregou a escala do mês' });
