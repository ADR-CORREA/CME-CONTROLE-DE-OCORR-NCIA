/* ═══════════════════════════ SECRETARIA — PAINEL "HOJE", IMPORTAÇÃO E ATALHOS ═══════════════════════════
   • Faixa "Hoje" no topo da aba + contador no menu (férias/licenças sem portaria anexa).
   • Importar servidores por planilha (com modelo para baixar).
   • Lançar a dispensa direto do perfil (usa o apoio pendente mais antigo).
   Depende de secretaria.js e secretaria-ferias.js (carregados antes). Emojis só por \u{...}. */

function _secCpfMascara(v) {
  const c = String(v || '').replace(/\D/g, '').slice(0, 11);
  return c.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1-$2');
}

// ── Pendências: férias/licenças em curso ou futuras sem portaria anexa ────────
function _secSemPortaria(d) { const hoje = _secHoje(); return (d || _secDados()).afastamentos.filter(a => a.fim >= hoje && !(a.anexos || []).length); }
function _secAtualizarBadge() {
  const el = document.getElementById('sec-badge'); if (!el) return;
  const n = _secPode() ? _secSemPortaria().length : 0;
  el.textContent = n; el.style.display = n > 0 ? 'flex' : 'none';
  el.title = n ? n + ' férias/licença(s) sem portaria anexa' : '';
}
setInterval(() => { try { if (usuarioAtual) _secAtualizarBadge(); } catch (e) {} }, 60000);

function _secRenderHoje() {
  const box = document.getElementById('sec-hoje'); if (!box) return;
  _secAtualizarBadge();
  const d = _secDados(), hoje = _secHoje();
  const fora = d.afastamentos.filter(a => _secSobrepoe(a, hoje, hoje)).sort((a, b) => a.fim.localeCompare(b.fim));
  const em30 = d.afastamentos.filter(a => a.inicio > hoje && a.inicio <= _secMaisDias(hoje, 30));
  const horas = d.apoios.filter(a => !a.dispensa).reduce((t, a) => t + (+a.horas || 0), 0);
  const semPort = _secSemPortaria(d).length;
  if (!d.servidores.length) {
    box.innerHTML = '<div style="margin-top:10px;background:#eff6ff;border-left:4px solid #2563eb;padding:10px 14px;border-radius:4px;font-size:.88rem">'
      + '<b>Primeiro passo:</b> cadastre os servidores em <a href="#" onclick="sec_mudarAba(\'servidores\');return false">Servidores</a> — um por um ou de uma vez pela planilha modelo. '
      + 'Os Despachos PRODOC já funcionam sem cadastro.</div>';
    return;
  }
  const item = (cor, txt, aba) => '<a href="#" onclick="sec_mudarAba(\'' + aba + '\');return false" style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:4px;border-left:3px solid ' + cor + ';background:' + cor + '14;color:#0f172a;text-decoration:none;font-size:.84rem">' + txt + '</a>';
  box.innerHTML = '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span style="font-size:.78rem;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Hoje, ' + _secBR(hoje).slice(0, 5) + '</span>'
    + item('#0d9488', '<b>' + fora.length + '</b> afastado(s)' + (fora.length ? ': ' + fora.slice(0, 4).map(a => esc(_secNomeServ(a.servidorId, d).split(' ')[0]) + ' até ' + _secBRc(a.fim)).join(', ') + (fora.length > 4 ? '…' : '') : ''), 'ferias')
    + item('#d97706', '<b>' + em30.length + '</b> começa(m) em 30 dias', 'ferias')
    + item('#2563eb', '<b>' + horas + 'h</b> de dispensa a usufruir', 'apoios')
    + (semPort ? item('#dc2626', '<b>' + semPort + '</b> sem portaria anexa', 'ferias') : '') + '</div>';
}

// ── Dispensa direto do perfil ─────────────────────────────────────────────────
function sec_lancarDispensaProxima(servId) {
  const pend = _secApoiosDe(servId).filter(a => !a.dispensa);
  if (!pend.length) { _mostrarToast('Esse servidor não tem apoio a usufruir.', 'erro'); return; }
  sec_lancarDispensa(pend[0].id); // o mais antigo primeiro, como na ficha de papel
}

// ── Importar servidores por planilha ──────────────────────────────────────────
const _SEC_COLS_IMPORT = [['nome', ['nome', 'nome completo', 'servidor']], ['matricula', ['matricula', 'matrícula']], ['cpf', ['cpf']], ['rg', ['rg']],
  ['nascimento', ['nascimento', 'data de nascimento']], ['cargo', ['cargo']], ['formacao', ['formacao', 'formação']], ['equipe', ['equipe', 'plantao', 'plantão']],
  ['setor', ['setor']], ['telefone', ['telefone', 'celular', 'contato']], ['email', ['email', 'e-mail']], ['endereco', ['endereco', 'endereço']]];
function sec_baixarModeloServidores() {
  const ws = XLSX.utils.aoa_to_sheet([['Nome', 'Matrícula', 'CPF', 'RG', 'Nascimento', 'Cargo', 'Formação', 'Equipe', 'Setor', 'Telefone', 'E-mail', 'Endereço'],
    ['MARIA DA SILVA EXEMPLO', '1234567', '529.982.247-25', '123456', '15/03/1985', 'Policial Penal', 'Direito', 'ALFA', 'Plantão', '(96) 99999-0000', 'exemplo@email.com', 'Rua Exemplo, 100 - Centro']]);
  ws['!cols'] = [{ wch: 34 }, { wch: 12 }, { wch: 16 }, { wch: 10 }, { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 34 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Servidores');
  XLSX.writeFile(wb, 'Modelo_Servidores_CME.xlsx');
}
function _secDataPlanilha(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const m = String(v || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim()) ? String(v).trim() : '';
}
let _secImportPendente = null;
async function sec_importarServidores(input) {
  const f = input.files && input.files[0]; input.value = ''; if (!f) return;
  let linhas;
  try {
    const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
    linhas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true });
  } catch (e) { _mostrarToast('Não consegui ler a planilha: ' + e.message, 'erro'); return; }
  if (!linhas.length) { _mostrarToast('Planilha vazia.', 'erro'); return; }
  const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const cols = Object.keys(linhas[0]), mapa = {};
  _SEC_COLS_IMPORT.forEach(([campo, nomes]) => { const c = cols.find(k => nomes.map(norm).includes(norm(k))); if (c) mapa[campo] = c; });
  if (!mapa.nome || !mapa.matricula) { _mostrarToast('A planilha precisa das colunas "Nome" e "Matrícula" (use a planilha modelo).', 'erro'); return; }
  const d = _secDados(), novos = [], ignorados = [], avisos = [];
  const mats = new Set(d.servidores.map(s => String(s.matricula))), cpfs = new Set(d.servidores.map(s => s.cpf).filter(Boolean));
  linhas.forEach((l, i) => {
    const v = {}; Object.keys(mapa).forEach(k => { v[k] = l[mapa[k]]; });
    const nome = String(v.nome || '').replace(/\s+/g, ' ').trim().toUpperCase(), mat = String(v.matricula || '').trim();
    if (!nome && !mat) return;
    if (nome.length < 5 || !mat) { ignorados.push('linha ' + (i + 2) + ': falta nome ou matrícula'); return; }
    if (/EXEMPLO/.test(nome)) { ignorados.push('linha ' + (i + 2) + ': linha de exemplo do modelo'); return; }
    let cpf = String(v.cpf || '').replace(/\D/g, '');
    if (cpf && cpf.length < 11) cpf = cpf.padStart(11, '0'); // Excel corta zeros à esquerda
    if (cpf && !_secCpfValido(cpf)) { avisos.push(nome + ': CPF inválido (importado sem CPF)'); cpf = ''; }
    if (mats.has(mat) || (cpf && cpfs.has(cpf))) { ignorados.push(nome + ': já cadastrado'); return; }
    mats.add(mat); if (cpf) cpfs.add(cpf);
    const eq = String(v.equipe || '').toUpperCase().trim();
    novos.push({ nome, matricula: mat, cpf, rg: String(v.rg || '').trim(), nascimento: _secDataPlanilha(v.nascimento), cargo: String(v.cargo || '').trim(),
      formacao: String(v.formacao || '').trim(), equipe: _SEC_EQUIPES.includes(eq) ? eq : '', setor: String(v.setor || '').trim(),
      telefone: String(v.telefone || '').trim(), email: String(v.email || '').trim(), endereco: String(v.endereco || '').trim(), situacao: 'ativo' });
  });
  _secImportPendente = novos;
  _secModal('Importar servidores',
    '<div style="font-size:.9rem;margin-bottom:8px"><b>' + novos.length + '</b> servidor(es) novo(s) para cadastrar'
    + (ignorados.length ? ' · <b>' + ignorados.length + '</b> linha(s) ignorada(s)' : '') + (avisos.length ? ' · <b>' + avisos.length + '</b> aviso(s)' : '') + '.</div>'
    + (novos.length ? '<div class="table-scroll" style="max-height:240px"><table class="data-table" style="font-size:.8rem"><thead><tr><th>Nome</th><th>Matrícula</th><th>CPF</th><th>Cargo</th><th>Equipe</th></tr></thead><tbody>'
      + novos.map(s => '<tr><td>' + esc(s.nome) + '</td><td>' + esc(s.matricula) + '</td><td>' + esc(_secCpfFmt(s.cpf)) + '</td><td>' + esc(s.cargo) + '</td><td>' + esc(s.equipe) + '</td></tr>').join('') + '</tbody></table></div>' : '')
    + (ignorados.concat(avisos).length ? '<details style="margin-top:8px;font-size:.8rem;color:#b45309"><summary>Ver avisos</summary>' + ignorados.concat(avisos).map(x => '<div>• ' + esc(x) + '</div>').join('') + '</details>' : ''),
    novos.length ? '<button class="btn-primary" onclick="sec_confirmarImportacao()">Cadastrar ' + novos.length + '</button>' : '', 720);
}
async function sec_confirmarImportacao() {
  const novos = _secImportPendente || []; if (!novos.length) return;
  const agora = new Date().toISOString(), por = usuarioAtual ? usuarioAtual.nome : '';
  let n = 0;
  const ok = await _secMutar(d => {
    const mats = new Set(d.servidores.map(s => String(s.matricula)));
    novos.forEach(s => { if (mats.has(s.matricula)) return; d.servidores.push(Object.assign({ id: _secId('srv'), criadoEm: agora, criadoPor: por }, s)); n++; });
  }, { action: 'sec_servidor_importar', alvo: novos.length + ' servidor(es)', detalhe: 'importação por planilha' });
  if (!ok) return;
  _secImportPendente = null; _secFecharModal(); _mostrarToast(n + ' servidor(es) cadastrado(s).', 'sucesso'); sec_render();
}
Object.assign(_SEC_ACOES, { sec_servidor_importar: 'Importou servidores (planilha)' });
