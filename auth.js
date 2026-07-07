/* ============================================================
   EMAG Contabilidade — Autenticação (armazenamento local)
   ------------------------------------------------------------
   Cadastro/login simples usando localStorage/sessionStorage.
   Não é um sistema de autenticação de servidor — serve para
   controlar o acesso ao painel dentro deste conjunto de
   arquivos HTML estáticos.
   ============================================================ */

const AUTH_USERS_KEY = 'emag_users_v1';
const AUTH_SESSION_KEY = 'emag_session_v1';
const AUTH_PREVIEW_ROLE_KEY = 'emag_admin_preview_role_v1';
const AUTH_PREVIEW_CLIENT_KEY = 'emag_admin_preview_client_v1';
const AUTH_PREVIEW_USER_KEY = 'emag_admin_preview_user_v1';
const AUTH_SITE_SETTINGS_KEY = 'emag_site_settings_v1';
const AUTH_ASSIGNMENTS_KEY = 'emag_operator_assignments_v1';
const AUTH_CLIENTS_KEY = 'emag_admin_clients_v1';
const AUTH_FORCED_ADMIN_EMAILS = ['contabilidademga@emagcontabilidade.com.br'];
const AUTH_SITE_SETTINGS_DEFAULTS = {
  theme: 'dark',
  reduceMotion: false,
  focusMode: false,
  pendingFocus: true,
  soundEnabled: false,
  soundPreset: 'crystal',
  soundVolume: 0.18,
};
const AUTH_SOUND_PRESETS = {
  crystal: {
    label: 'Cristal suave',
    wave: 'sine',
    gap: 0.11,
    notes: [[659.25, 0.28], [783.99, 0.32], [987.77, 0.42], null, [783.99, 0.28], [659.25, 0.45], null, [523.25, 0.36]]
  },
  pulse: {
    label: 'Pulso contábil',
    wave: 'triangle',
    gap: 0.08,
    notes: [[261.63, 0.22], [329.63, 0.22], [392.00, 0.30], [329.63, 0.22], null, [293.66, 0.26], [349.23, 0.32], null]
  },
  calm: {
    label: 'Noite calma',
    wave: 'sine',
    gap: 0.18,
    notes: [[392.00, 0.50], null, [493.88, 0.56], [587.33, 0.68], null, [523.25, 0.54], [440.00, 0.72], null]
  }
};

/* --------- util: hash simples (não é criptografia forte) --------- */
function authHash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/* --------- usuários, perfis e carteiras --------- */
function authIsForcedAdminEmail(email) {
  return AUTH_FORCED_ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}

function authNormalizeRole(role) {
  const value = String(role || '').trim().toLowerCase();
  if (['admin', 'administrador', 'master', 'dono'].includes(value)) return 'admin';
  if (['gerente', 'gerencial', 'manager'].includes(value)) return 'gerente';
  return 'operador';
}

function authNormalizeUser(user) {
  const u = { ...(user || {}) };
  u.nome = (u.nome || '').trim();
  u.email = (u.email || '').trim().toLowerCase();
  u.role = authIsForcedAdminEmail(u.email) ? 'admin' : authNormalizeRole(u.role);
  u.foto = u.foto || null;
  u.active = authIsForcedAdminEmail(u.email) ? true : u.active !== false;
  u.clientId = (u.clientId || '').trim();
  u.cargo = (u.cargo || '').trim();
  u.telefone = (u.telefone || '').trim();
  u.observacoes = (u.observacoes || '').trim();
  return u;
}

function authGetUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(AUTH_USERS_KEY)) || [];
    return Array.isArray(users) ? users.map(authNormalizeUser).filter(u => u.email) : [];
  } catch (e) { return []; }
}
function authSaveUsers(users) {
  localStorage.setItem(AUTH_USERS_KEY, JSON.stringify((users || []).map(authNormalizeUser)));
}
function authFindUser(email) {
  const e = (email || '').trim().toLowerCase();
  return authGetUsers().find(u => u.email === e) || null;
}

function authValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

function authIsFirstAccess() {
  return authGetUsers().length === 0;
}

function authRoleLabel(role) {
  const normalized = authNormalizeRole(role);
  if (normalized === 'admin') return 'Administrador Master';
  return normalized === 'gerente' ? 'Gerente' : 'Operador';
}

function authIsAdmin(session) {
  const s = session || authGetSession();
  if (!s) return false;
  return authNormalizeRole(s.actualRole || s.role) === 'admin' || authNormalizeRole(s.role) === 'admin';
}

function authIsManager(session) {
  const s = session || authGetSession();
  const role = s && authNormalizeRole(s.role);
  return !!s && (role === 'gerente' || role === 'admin');
}

function authGetOperatorUsers() {
  return authGetUsers().filter(u => authNormalizeRole(u.role) === 'operador');
}

function authGetManagerUsers() {
  return authGetUsers().filter(u => authNormalizeRole(u.role) === 'gerente');
}

function authGetAllAssignments() {
  try {
    const data = JSON.parse(localStorage.getItem(AUTH_ASSIGNMENTS_KEY)) || {};
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch (e) { return {}; }
}

function authSaveAllAssignments(assignments) {
  localStorage.setItem(AUTH_ASSIGNMENTS_KEY, JSON.stringify(assignments || {}));
}

function authGetAssignedCompanyIds(email) {
  const key = (email || (authGetSession() || {}).email || '').trim().toLowerCase();
  const assignments = authGetAllAssignments();
  const ids = assignments[key];
  return Array.isArray(ids) ? ids.map(String) : [];
}

function authSetAssignedCompanyIds(email, ids) {
  const key = (email || '').trim().toLowerCase();
  if (!authValidEmail(key)) return { ok: false, msg: 'Operador inválido.' };
  const assignments = authGetAllAssignments();
  assignments[key] = Array.from(new Set((ids || []).map(String)));
  authSaveAllAssignments(assignments);
  return { ok: true };
}

function authOperatorHasAssignmentRecord(email) {
  const key = (email || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(authGetAllAssignments(), key);
}

function authFilterCompaniesForSession(companies) {
  const list = Array.isArray(companies) ? companies : [];
  const session = authGetSession();
  if (!session || authIsManager(session)) return list;
  if (!authOperatorHasAssignmentRecord(session.email)) return [];
  const assigned = new Set(authGetAssignedCompanyIds(session.email));
  return list.filter(c => assigned.has(String(c.id)));
}

function authMergeCompanyScopeForSave(storageKey, visibleCompanies) {
  const session = authGetSession();
  const visible = Array.isArray(visibleCompanies) ? visibleCompanies : [];
  if (!session || authIsManager(session)) return visible;
  let full = [];
  try { full = JSON.parse(localStorage.getItem(storageKey)) || []; } catch (e) { full = []; }
  if (!Array.isArray(full)) full = [];
  if (!authOperatorHasAssignmentRecord(session.email)) return full;
  if (full.length === 0) return visible;
  const visibleById = new Map(visible.map(c => [String(c.id), c]));
  const merged = full.map(c => visibleById.get(String(c.id)) || c);
  visible.forEach(c => {
    if (!merged.some(m => String(m.id) === String(c.id))) merged.push(c);
  });
  return merged;
}

function authCreateOperator(nome, email, senha, meta) {
  if (!authIsManager()) return { ok: false, msg: 'Apenas gerente pode cadastrar operadores.' };
  const session = authGetSession();
  const scopedMeta = meta && typeof meta === 'object' ? { ...meta } : {};
  if (!scopedMeta.clientId && session && session.clientId) scopedMeta.clientId = session.clientId;
  const res = authRegister(nome, email, senha, 'operador');
  if (res.ok) {
    if (Object.keys(scopedMeta).length) authUpdateOperator(email, scopedMeta);
    authSetAssignedCompanyIds(email, []);
  }
  return res;
}

function authUpdateOperator(email, fields) {
  if (!authIsManager()) return { ok: false, msg: 'Apenas gerente pode atualizar operadores.' };
  const emailNorm = (email || '').trim().toLowerCase();
  const users = authGetUsers();
  const idx = users.findIndex(u => u.email === emailNorm && u.role === 'operador');
  if (idx === -1) return { ok: false, msg: 'Operador não encontrado.' };
  const f = fields || {};
  if (Object.prototype.hasOwnProperty.call(f, 'nome')) {
    const nome = String(f.nome || '').trim();
    if (!nome) return { ok: false, msg: 'Informe o nome do operador.' };
    users[idx].nome = nome;
  }
  if (Object.prototype.hasOwnProperty.call(f, 'clientId')) users[idx].clientId = String(f.clientId || '').trim();
  if (Object.prototype.hasOwnProperty.call(f, 'cargo')) users[idx].cargo = String(f.cargo || '').trim();
  if (Object.prototype.hasOwnProperty.call(f, 'telefone')) users[idx].telefone = String(f.telefone || '').trim();
  if (Object.prototype.hasOwnProperty.call(f, 'observacoes')) users[idx].observacoes = String(f.observacoes || '').trim();
  if (Object.prototype.hasOwnProperty.call(f, 'active')) users[idx].active = f.active !== false;
  users[idx].atualizadoEm = new Date().toISOString();
  authSaveUsers(users);
  return { ok: true };
}

function authUpdateOperatorPassword(email, novaSenha) {
  if (!authIsManager()) return { ok: false, msg: 'Apenas gerente pode redefinir senhas.' };
  const emailNorm = (email || '').trim().toLowerCase();
  if (!novaSenha || novaSenha.length < 8) return { ok: false, msg: 'A senha deve ter pelo menos 8 caracteres.' };
  if (!/[a-z]/.test(novaSenha) || !/[A-Z]/.test(novaSenha) || !/[0-9]/.test(novaSenha)) {
    return { ok: false, msg: 'Use letras maiúsculas, minúsculas e números na senha.' };
  }
  const users = authGetUsers();
  const idx = users.findIndex(u => u.email === emailNorm && u.role === 'operador');
  if (idx === -1) return { ok: false, msg: 'Operador não encontrado.' };
  users[idx].pass = authHash(novaSenha);
  authSaveUsers(users);
  return { ok: true };
}

function authDeleteOperator(email) {
  if (!authIsManager()) return { ok: false, msg: 'Apenas gerente pode excluir operadores.' };
  const emailNorm = (email || '').trim().toLowerCase();
  const users = authGetUsers();
  const next = users.filter(u => !(u.email === emailNorm && u.role === 'operador'));
  if (next.length === users.length) return { ok: false, msg: 'Operador não encontrado.' };
  authSaveUsers(next);
  const assignments = authGetAllAssignments();
  delete assignments[emailNorm];
  authSaveAllAssignments(assignments);
  return { ok: true };
}


/* --------- administrador master: clientes e gerentes --------- */
function authSlugify(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `cliente-${Date.now()}`;
}

function authGetClients() {
  try {
    const data = JSON.parse(localStorage.getItem(AUTH_CLIENTS_KEY)) || [];
    return Array.isArray(data) ? data.map(c => ({
      id: String(c.id || authSlugify(c.nome || c.siteTitle || 'cliente')).trim(),
      nome: String(c.nome || '').trim(),
      siteTitle: String(c.siteTitle || c.nome || '').trim(),
      slug: String(c.slug || c.id || '').trim(),
      status: c.status === 'inativo' ? 'inativo' : 'ativo',
      cor: String(c.cor || '#9fda68').trim(),
      observacoes: String(c.observacoes || '').trim(),
      criadoEm: c.criadoEm || new Date().toISOString(),
      atualizadoEm: c.atualizadoEm || null
    })).filter(c => c.id && c.nome) : [];
  } catch (e) { return []; }
}

function authSaveClients(clients) {
  localStorage.setItem(AUTH_CLIENTS_KEY, JSON.stringify(Array.isArray(clients) ? clients : []));
}

function authFindClient(id) {
  const key = String(id || '').trim();
  return authGetClients().find(c => c.id === key) || null;
}

function authGetClientForSession(session) {
  const s = session || authGetSession();
  if (!s) return null;
  const actualRole = authNormalizeRole(s.actualRole || s.role);

  // Admin master pode selecionar um cliente para "entrar no modo visualização"
  if (actualRole === 'admin') {
    const previewClientId = authGetPreviewClient();
    if (previewClientId) {
      const previewClient = authFindClient(previewClientId);
      if (previewClient) return previewClient;
    }
    return null;
  }

  const directClient = authFindClient(s.clientId);
  if (directClient) return directClient;

  const user = authFindUser(s.email);
  const userClient = user && authFindClient(user.clientId);
  if (userClient) return userClient;

  const activeClients = authGetClients().filter(c => c.status === 'ativo');
  return activeClients.length === 1 ? activeClients[0] : null;
}

function authGetPreviewClient() {
  try {
    return sessionStorage.getItem(AUTH_PREVIEW_CLIENT_KEY) || '';
  } catch (e) { return ''; }
}

function authSetPreviewClient(clientId) {
  const id = String(clientId || '').trim();
  if (!id) {
    sessionStorage.removeItem(AUTH_PREVIEW_CLIENT_KEY);
    return;
  }
  if (!authFindClient(id)) return;
  sessionStorage.setItem(AUTH_PREVIEW_CLIENT_KEY, id);
}

function authGetPreviewUser() {
  try {
    return (sessionStorage.getItem(AUTH_PREVIEW_USER_KEY) || '').trim().toLowerCase();
  } catch (e) { return ''; }
}

function authSetPreviewUser(email) {
  const norm = String(email || '').trim().toLowerCase();
  if (!norm) {
    sessionStorage.removeItem(AUTH_PREVIEW_USER_KEY);
    return;
  }
  sessionStorage.setItem(AUTH_PREVIEW_USER_KEY, norm);
}

function authClearPreview() {
  sessionStorage.removeItem(AUTH_PREVIEW_ROLE_KEY);
  sessionStorage.removeItem(AUTH_PREVIEW_CLIENT_KEY);
  sessionStorage.removeItem(AUTH_PREVIEW_USER_KEY);
}

function authHexToRgb(hex) {
  const raw = String(hex || '').trim().replace('#', '');
  const normalized = raw.length === 3 ? raw.split('').map(ch => ch + ch).join('') : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
}

function authSplitClientBrandName(siteName) {
  const clean = String(siteName || '').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ').filter(Boolean);
  if (words.length <= 1) return { main: clean.toUpperCase(), sub: '' };

  const genericWords = ['CONTABILIDADE', 'CONTABIL', 'ASSESSORIA', 'CONSULTORIA', 'ESCRITORIO', 'ESCRITÓRIO'];
  const genericIndex = words.findIndex(w => genericWords.includes(w.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()) || genericWords.includes(w.toUpperCase()));

  if (genericIndex > 0) {
    return {
      main: words.slice(0, genericIndex).join(' ').toUpperCase(),
      sub: words.slice(genericIndex).join(' ').toUpperCase()
    };
  }

  return {
    main: words[0].toUpperCase(),
    sub: words.slice(1).join(' ').toUpperCase()
  };
}

function authApplyClientBranding() {
  const client = authGetClientForSession();
  if (!client) return;

  const siteName = (client.siteTitle || client.nome || '').trim();
  if (!siteName) return;

  const color = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(client.cor || '').trim())
    ? String(client.cor).trim()
    : '#9fda68';
  const rgb = authHexToRgb(color) || { r: 159, g: 218, b: 104 };

  document.documentElement.classList.add('emag-client-branded');
  document.documentElement.style.setProperty('--client-brand-color', color);
  document.documentElement.style.setProperty('--client-brand-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  // A cor cadastrada para o cliente vira a cor de destaque de todo o site do cliente.
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-dim', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.12)`);
  document.documentElement.style.setProperty('--lime', color);
  if (document.body) document.body.setAttribute('data-client-id', client.id);

  document.querySelectorAll('.emag-top-title, .brand').forEach(logo => {
    logo.classList.add('client-brand');
    logo.setAttribute('title', siteName);
    logo.setAttribute('aria-label', siteName);
    const main = logo.querySelector('.emag');
    const sub = logo.querySelector('.contabilidade, .sub');
    const brand = authSplitClientBrandName(siteName);
    logo.classList.toggle('brand-long', brand.main.length > 13 || siteName.length > 22);
    logo.classList.toggle('brand-extra-long', brand.main.length > 20 || siteName.length > 34);
    if (main) {
      main.textContent = brand.main;
      main.style.color = color;
      main.style.textShadow = `0 0 18px rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .35)`;
      main.style.letterSpacing = brand.main.length > 13 ? '.7px' : '2.6px';
    }
    if (sub) {
      sub.textContent = brand.sub;
      sub.style.color = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, .62)`;
      sub.style.letterSpacing = brand.sub.length > 18 ? '2px' : '3.5px';
      sub.toggleAttribute('hidden', !brand.sub);
      sub.setAttribute('aria-hidden', brand.sub ? 'false' : 'true');
    }
  });

  if (document.title && document.title.includes('EMAG Contabilidade')) {
    document.title = document.title.replace('EMAG Contabilidade', siteName);
  }
}

/* Botão flutuante no canto inferior esquerdo para o admin master sair
   do "modo de visualização" de um cliente e voltar ao admin master.
   Só aparece quando o admin escolheu um cliente para visualizar. */
function authMountPreviewExitButton() {
  const existing = document.getElementById('auth-preview-exit');
  const session = authGetSession();
  if (!session) { if (existing) existing.remove(); return; }
  const actualRole = authNormalizeRole(session.actualRole || session.role);
  const previewClientId = authGetPreviewClient();
  const previewRole = authGetPreviewRole();
  // Só mostra o botão flutuante quando o admin está visualizando um cliente específico.
  if (actualRole !== 'admin' || !previewClientId || !previewRole) {
    if (existing) existing.remove();
    return;
  }

  if (existing) return;

  const client = authFindClient(previewClientId);
  if (!client) return;
  const roleLabel = previewRole === 'gerente' ? 'Gerente' : (previewRole === 'operador' ? 'Operador' : '');
  const clientLabel = client.siteTitle || client.nome;

  const btn = document.createElement('button');
  btn.id = 'auth-preview-exit';
  btn.type = 'button';
  btn.setAttribute('aria-label', `Sair da visualização · ${roleLabel} · Cliente: ${clientLabel}`);
  btn.setAttribute('title', `Sair da visualização (${roleLabel} · ${clientLabel})`);
  btn.innerHTML = '<span aria-hidden="true">✕</span>';

  if (!document.getElementById('auth-preview-exit-styles')) {
    const style = document.createElement('style');
    style.id = 'auth-preview-exit-styles';
    style.textContent = `
      #auth-preview-exit{position:fixed;left:20px;bottom:20px;z-index:9999;width:52px;height:52px;border-radius:50%;border:1px solid rgba(248,113,113,.36);background:linear-gradient(180deg,#2a1720,#1b1117);color:#fecaca;display:grid;place-items:center;cursor:pointer;padding:0;box-shadow:0 12px 26px rgba(0,0,0,.34);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,background .18s ease}
      #auth-preview-exit span{font-size:22px;font-weight:900;line-height:1;text-shadow:none}
      #auth-preview-exit:hover{transform:translateY(-2px);border-color:rgba(248,113,113,.58);background:linear-gradient(180deg,#351b24,#201318);box-shadow:0 16px 30px rgba(0,0,0,.42)}
      #auth-preview-exit:active{transform:scale(.96)}

      #auth-preview-exit-modal{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(3,7,18,.74);backdrop-filter:blur(9px);animation:authExitFadeIn .18s ease-out}
      #auth-preview-exit-modal .ape-card{width:min(420px,100%);background:linear-gradient(180deg,#1a1d27,#12141c);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:26px 24px 22px;box-shadow:0 40px 90px rgba(0,0,0,.55);color:#e2e8f0;font-family:'Inter',system-ui,sans-serif;text-align:center;animation:authExitPop .22s cubic-bezier(.2,.9,.35,1.25)}
      #auth-preview-exit-modal .ape-icon{width:60px;height:60px;border-radius:50%;margin:0 auto 14px;background:linear-gradient(180deg,#34202a,#21151a);border:1px solid rgba(248,113,113,.32);display:grid;place-items:center;color:#fecaca;font-size:26px;font-weight:900;box-shadow:0 12px 26px rgba(0,0,0,.35)}
      #auth-preview-exit-modal h3{font-size:18px;font-weight:900;margin:0 0 6px;color:#fff}
      #auth-preview-exit-modal p{font-size:13px;line-height:1.55;color:rgba(226,232,240,.7);margin:0 0 8px}
      #auth-preview-exit-modal .ape-detail{margin:14px 0 18px;padding:10px 12px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:rgba(255,255,255,.03);font-size:12px;line-height:1.5;color:rgba(226,232,240,.78)}
      #auth-preview-exit-modal .ape-detail b{color:#fff;font-weight:900}
      #auth-preview-exit-modal .ape-actions{display:flex;gap:10px;justify-content:center}
      #auth-preview-exit-modal button{flex:1;border:0;border-radius:12px;padding:12px 14px;font-weight:900;font-size:13px;cursor:pointer;font-family:inherit;transition:filter .15s,transform .1s}
      #auth-preview-exit-modal .ape-cancel{background:rgba(255,255,255,.06);color:#e2e8f0;border:1px solid rgba(255,255,255,.12)}
      #auth-preview-exit-modal .ape-cancel:hover{background:rgba(255,255,255,.1)}
      #auth-preview-exit-modal .ape-confirm{background:#7f1d1d;color:#fee2e2;border:1px solid rgba(248,113,113,.32)}
      #auth-preview-exit-modal .ape-confirm:hover{filter:brightness(1.08)}
      #auth-preview-exit-modal button:active{transform:translateY(1px)}
      @keyframes authExitFadeIn{from{opacity:0}to{opacity:1}}
      @keyframes authExitPop{from{opacity:0;transform:scale(.9)}to{opacity:1;transform:scale(1)}}
      @media(max-width:520px){#auth-preview-exit{left:14px;bottom:14px;width:46px;height:46px}#auth-preview-exit span{font-size:19px}}
    `;
    document.head.appendChild(style);
  }
  document.body.appendChild(btn);

  btn.addEventListener('click', () => authOpenPreviewExitModal(client, roleLabel));
}

function authOpenPreviewExitModal(client, roleLabel) {
  const existing = document.getElementById('auth-preview-exit-modal');
  if (existing) existing.remove();

  const clientLabel = client ? (client.siteTitle || client.nome) : '';
  const overlay = document.createElement('div');
  overlay.id = 'auth-preview-exit-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="ape-card">
      <div class="ape-icon" aria-hidden="true">✕</div>
      <h3>Sair da visualização?</h3>
      <p>Você voltará ao painel do Admin Master.</p>
      <div class="ape-detail">
        <b>Perfil:</b> ${authEscape(roleLabel || '')}<br>
        <b>Cliente:</b> ${authEscape(clientLabel)}
      </div>
      <div class="ape-actions">
        <button type="button" class="ape-cancel">Cancelar</button>
        <button type="button" class="ape-confirm">Sim, sair</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onEsc); };
  const onEsc = (e) => { if (e.key === 'Escape') close(); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('.ape-cancel').addEventListener('click', close);
  overlay.querySelector('.ape-confirm').addEventListener('click', () => {
    authClearPreview();
    // Volta para a tela inicial do admin master (index com os 3 módulos)
    window.location.href = 'index.html';
  });
  document.addEventListener('keydown', onEsc);
  setTimeout(() => overlay.querySelector('.ape-confirm').focus(), 50);
}

function authUpsertClient(data) {
  if (!authIsAdmin()) return { ok: false, msg: 'Apenas o Administrador Master pode configurar clientes.' };
  const d = data || {};
  const nome = String(d.nome || '').trim();
  if (!nome) return { ok: false, msg: 'Informe o nome do cliente.' };
  const clients = authGetClients();
  const editingId = String(d.id || '').trim();
  const id = editingId || authSlugify(nome);
  const duplicate = clients.find(c => c.id !== editingId && c.id === id);
  if (duplicate) return { ok: false, msg: 'Já existe um cliente com este identificador.' };
  const record = {
    id,
    nome,
    siteTitle: String(d.siteTitle || nome).trim(),
    slug: String(d.slug || id).trim(),
    status: d.status === 'inativo' ? 'inativo' : 'ativo',
    cor: String(d.cor || '#9fda68').trim(),
    observacoes: String(d.observacoes || '').trim(),
    criadoEm: (clients.find(c => c.id === id) || {}).criadoEm || new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };
  const idx = clients.findIndex(c => c.id === editingId || c.id === id);
  if (idx >= 0) clients[idx] = record;
  else clients.push(record);
  authSaveClients(clients);
  return { ok: true, client: record };
}

function authDeleteClient(id) {
  if (!authIsAdmin()) return { ok: false, msg: 'Apenas o Administrador Master pode excluir clientes.' };
  const key = String(id || '').trim();
  const managers = authGetManagerUsers().filter(u => u.clientId === key);
  if (managers.length) return { ok: false, msg: 'Remova ou transfira os gerentes deste cliente antes de excluir.' };
  const clients = authGetClients();
  const next = clients.filter(c => c.id !== key);
  if (next.length === clients.length) return { ok: false, msg: 'Cliente não encontrado.' };
  authSaveClients(next);
  return { ok: true };
}

function authCreateManager(nome, email, senha, meta) {
  if (!authIsAdmin()) return { ok: false, msg: 'Apenas o Administrador Master pode criar gerentes.' };
  const res = authRegister(nome, email, senha, 'gerente');
  if (res.ok && meta) authUpdateManager(email, meta);
  return res;
}

function authUpdateManager(email, fields) {
  if (!authIsAdmin()) return { ok: false, msg: 'Apenas o Administrador Master pode atualizar gerentes.' };
  const emailNorm = String(email || '').trim().toLowerCase();
  const users = authGetUsers();
  const idx = users.findIndex(u => u.email === emailNorm && u.role === 'gerente');
  if (idx === -1) return { ok: false, msg: 'Gerente não encontrado.' };
  const f = fields || {};
  if (Object.prototype.hasOwnProperty.call(f, 'nome')) {
    const nome = String(f.nome || '').trim();
    if (!nome) return { ok: false, msg: 'Informe o nome do gerente.' };
    users[idx].nome = nome;
  }
  if (Object.prototype.hasOwnProperty.call(f, 'clientId')) users[idx].clientId = String(f.clientId || '').trim();
  if (Object.prototype.hasOwnProperty.call(f, 'cargo')) users[idx].cargo = String(f.cargo || '').trim();
  if (Object.prototype.hasOwnProperty.call(f, 'telefone')) users[idx].telefone = String(f.telefone || '').trim();
  if (Object.prototype.hasOwnProperty.call(f, 'observacoes')) users[idx].observacoes = String(f.observacoes || '').trim();
  if (Object.prototype.hasOwnProperty.call(f, 'active')) users[idx].active = f.active !== false;
  users[idx].atualizadoEm = new Date().toISOString();
  authSaveUsers(users);
  return { ok: true };
}

function authUpdateManagerPassword(email, novaSenha) {
  if (!authIsAdmin()) return { ok: false, msg: 'Apenas o Administrador Master pode redefinir senhas de gerentes.' };
  const emailNorm = String(email || '').trim().toLowerCase();
  if (!novaSenha || novaSenha.length < 8) return { ok: false, msg: 'A senha deve ter pelo menos 8 caracteres.' };
  if (!/[a-z]/.test(novaSenha) || !/[A-Z]/.test(novaSenha) || !/[0-9]/.test(novaSenha)) {
    return { ok: false, msg: 'Use letras maiúsculas, minúsculas e números na senha.' };
  }
  const users = authGetUsers();
  const idx = users.findIndex(u => u.email === emailNorm && u.role === 'gerente');
  if (idx === -1) return { ok: false, msg: 'Gerente não encontrado.' };
  users[idx].pass = authHash(novaSenha);
  authSaveUsers(users);
  return { ok: true };
}

function authDeleteManager(email) {
  if (!authIsAdmin()) return { ok: false, msg: 'Apenas o Administrador Master pode excluir gerentes.' };
  const emailNorm = String(email || '').trim().toLowerCase();
  const users = authGetUsers();
  const next = users.filter(u => !(u.email === emailNorm && u.role === 'gerente'));
  if (next.length === users.length) return { ok: false, msg: 'Gerente não encontrado.' };
  authSaveUsers(next);
  return { ok: true };
}


/* --------- configurações visuais do site --------- */
function authGetSiteSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTH_SITE_SETTINGS_KEY)) || {};
    return authNormalizeSiteSettings(saved);
  } catch (e) {
    return { ...AUTH_SITE_SETTINGS_DEFAULTS };
  }
}

function authNormalizeSiteSettings(settings) {
  const next = { ...AUTH_SITE_SETTINGS_DEFAULTS, ...(settings || {}) };
  if (!['dark', 'light', 'system'].includes(next.theme)) next.theme = AUTH_SITE_SETTINGS_DEFAULTS.theme;
  next.reduceMotion = !!next.reduceMotion;
  next.focusMode = !!next.focusMode;
  next.pendingFocus = next.pendingFocus !== false;
  next.soundEnabled = !!next.soundEnabled;
  if (!AUTH_SOUND_PRESETS[next.soundPreset]) next.soundPreset = AUTH_SITE_SETTINGS_DEFAULTS.soundPreset;
  const vol = Number(next.soundVolume);
  next.soundVolume = Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : AUTH_SITE_SETTINGS_DEFAULTS.soundVolume;
  return next;
}

function authSaveSiteSettings(settings) {
  const next = authNormalizeSiteSettings(settings);
  localStorage.setItem(AUTH_SITE_SETTINGS_KEY, JSON.stringify(next));
  authApplySiteSettings(next);
  return next;
}

function authResolveTheme(theme) {
  if (theme === 'system' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return theme === 'light' ? 'light' : 'dark';
}

function authApplySiteSettings(settings) {
  const s = authNormalizeSiteSettings(settings || authGetSiteSettings());
  const root = document.documentElement;
  const resolvedTheme = authResolveTheme(s.theme);

  root.classList.toggle('emag-theme-light', resolvedTheme === 'light');
  root.classList.toggle('emag-theme-dark', resolvedTheme !== 'light');
  root.classList.toggle('emag-motion-reduced', !!s.reduceMotion);
  root.classList.toggle('emag-focus-mode', !!s.focusMode);
  root.classList.toggle('emag-pending-focus', !!s.pendingFocus);
  root.classList.remove('emag-density-compact', 'emag-text-large');
  root.dataset.emagTheme = resolvedTheme;
  window.EMAG_SUPPRESS_CELEBRATION = !!s.focusMode;
  if (s.focusMode && typeof window.stopGame === 'function') window.stopGame();
  authApplyAmbientSound(s);
}

/* --------- som ambiente simples (Web Audio, sem arquivos externos) --------- */
let authAudioCtx = null;
let authAudioGain = null;
let authAmbientTimer = null;
let authAmbientActive = false;
let authAmbientPreset = AUTH_SITE_SETTINGS_DEFAULTS.soundPreset;
let authAmbientStep = 0;
let authAudioUnlockRegistered = false;

function authAmbientVolumeToGain(volume) {
  const v = Math.max(0, Math.min(1, Number(volume) || 0));
  return v * 0.14; // mantém a melodia como fundo baixo, mesmo com o controle no máximo
}

function authEnsureAudioContext() {
  if (authAudioCtx) return true;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return false;
  authAudioCtx = new AudioCtor();
  authAudioGain = authAudioCtx.createGain();
  authAudioGain.gain.value = authAmbientVolumeToGain(AUTH_SITE_SETTINGS_DEFAULTS.soundVolume);
  authAudioGain.connect(authAudioCtx.destination);
  return true;
}

function authInstallAudioUnlock() {
  if (authAudioUnlockRegistered) return;
  authAudioUnlockRegistered = true;
  const unlock = () => {
    const s = authGetSiteSettings();
    if (s.soundEnabled) authApplyAmbientSound(s);
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach(type => {
    window.addEventListener(type, unlock, { once: true, passive: true, capture: true });
  });
}

function authSetAmbientVolume(volume) {
  if (!authAudioGain || !authAudioCtx) return;
  authAudioGain.gain.setTargetAtTime(authAmbientVolumeToGain(volume), authAudioCtx.currentTime, 0.08);
}

function authStopAmbientSound() {
  authAmbientActive = false;
  if (authAmbientTimer) clearTimeout(authAmbientTimer);
  authAmbientTimer = null;
}

function authPlayAmbientTone(freq, duration, wave, delay) {
  if (!authAudioCtx || !authAudioGain || !freq) return;
  const now = authAudioCtx.currentTime + (delay || 0);
  const osc = authAudioCtx.createOscillator();
  const noteGain = authAudioCtx.createGain();
  osc.type = wave || 'sine';
  osc.frequency.setValueAtTime(freq, now);
  noteGain.gain.setValueAtTime(0.0001, now);
  noteGain.gain.exponentialRampToValueAtTime(0.86, now + 0.035);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.08, duration));
  osc.connect(noteGain);
  noteGain.connect(authAudioGain);
  osc.start(now);
  osc.stop(now + Math.max(0.1, duration + 0.08));
}

function authAmbientLoop() {
  if (!authAmbientActive || !authAudioCtx || authAudioCtx.state !== 'running') {
    authAmbientTimer = null;
    return;
  }
  const preset = AUTH_SOUND_PRESETS[authAmbientPreset] || AUTH_SOUND_PRESETS.crystal;
  const note = preset.notes[authAmbientStep % preset.notes.length];
  const duration = note ? note[1] : 0.36;
  if (note) authPlayAmbientTone(note[0], duration, preset.wave, 0);
  authAmbientStep++;
  authAmbientTimer = setTimeout(authAmbientLoop, Math.round((duration + (preset.gap || 0.1)) * 1000));
}

function authApplyAmbientSound(settings) {
  const s = authNormalizeSiteSettings(settings || authGetSiteSettings());
  authAmbientPreset = s.soundPreset;
  if (!s.soundEnabled) {
    authStopAmbientSound();
    return;
  }
  if (!authEnsureAudioContext()) return;
  authSetAmbientVolume(s.soundVolume);
  authAmbientActive = true;
  const resume = authAudioCtx.state === 'suspended' ? authAudioCtx.resume() : Promise.resolve();
  resume.then(() => {
    if (!authAmbientTimer && authAmbientActive) authAmbientLoop();
  }).catch(() => authInstallAudioUnlock());
  if (authAudioCtx.state === 'suspended') authInstallAudioUnlock();
}

function authPlayPresetPreview(presetKey, volume) {
  if (!authEnsureAudioContext()) return;
  authSetAmbientVolume(volume);
  const preset = AUTH_SOUND_PRESETS[presetKey] || AUTH_SOUND_PRESETS.crystal;
  const play = () => {
    let offset = 0;
    preset.notes.slice(0, 8).forEach(note => {
      const duration = note ? note[1] : 0.28;
      if (note) authPlayAmbientTone(note[0], duration, preset.wave, offset);
      offset += duration + (preset.gap || 0.1);
    });
  };
  const resume = authAudioCtx.state === 'suspended' ? authAudioCtx.resume() : Promise.resolve();
  resume.then(play).catch(() => authInstallAudioUnlock());
}

authApplySiteSettings();
authInjectStyles();

if (window.matchMedia) {
  const authSystemThemeQuery = window.matchMedia('(prefers-color-scheme: light)');
  const authSystemThemeHandler = () => {
    if (authGetSiteSettings().theme === 'system') authApplySiteSettings();
  };
  if (authSystemThemeQuery.addEventListener) authSystemThemeQuery.addEventListener('change', authSystemThemeHandler);
  else if (authSystemThemeQuery.addListener) authSystemThemeQuery.addListener(authSystemThemeHandler);
}

/* --------- cadastro --------- */
function authRegister(nome, email, senha, role) {
  nome = (nome || '').trim();
  const emailNorm = (email || '').trim().toLowerCase();
  const users = authGetUsers();
  const finalRole = role ? authNormalizeRole(role) : (users.length === 0 ? 'gerente' : 'operador');

  if (!nome) return { ok: false, msg: 'Informe seu nome completo.' };
  if (!authValidEmail(emailNorm)) return { ok: false, msg: 'Informe um e-mail válido.' };
  if (!senha || senha.length < 8) return { ok: false, msg: 'A senha deve ter pelo menos 8 caracteres.' };
  if (!/[a-z]/.test(senha) || !/[A-Z]/.test(senha) || !/[0-9]/.test(senha)) {
    return { ok: false, msg: 'Use letras maiúsculas, minúsculas e números na senha.' };
  }
  if (authFindUser(emailNorm)) return { ok: false, msg: 'Já existe uma conta cadastrada com este e-mail.' };
  if (finalRole === 'admin' && users.some(u => u.role === 'admin')) {
    return { ok: false, msg: 'Já existe um administrador master cadastrado neste navegador.' };
  }

  users.push({ nome, email: emailNorm, pass: authHash(senha), role: finalRole, foto: null, active: true, criadoEm: new Date().toISOString() });
  authSaveUsers(users);
  return { ok: true, role: finalRole };
}

/* --------- login / sessão --------- */
function authLogin(email, senha, remember) {
  const emailNorm = (email || '').trim().toLowerCase();
  const user = authFindUser(emailNorm);
  if (!user || user.pass !== authHash(senha || '')) {
    return { ok: false, msg: 'E-mail ou senha incorretos.' };
  }
  if (user.active === false && !authIsForcedAdminEmail(user.email)) {
    return { ok: false, msg: 'Usuário inativo. Fale com o gerente do sistema.' };
  }
  const session = { nome: user.nome, email: user.email, role: authNormalizeRole(user.role), foto: user.foto || null, clientId: user.clientId || '', ts: Date.now() };
  if (remember) {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    sessionStorage.removeItem(AUTH_SESSION_KEY);
  } else {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    localStorage.removeItem(AUTH_SESSION_KEY);
  }
  return { ok: true };
}

function authGetPreviewRole() {
  const value = sessionStorage.getItem(AUTH_PREVIEW_ROLE_KEY) || '';
  const role = authNormalizeRole(value);
  return ['gerente', 'operador'].includes(role) ? role : '';
}

function authSetPreviewRole(role) {
  const normalized = authNormalizeRole(role);
  if (['gerente', 'operador'].includes(normalized)) sessionStorage.setItem(AUTH_PREVIEW_ROLE_KEY, normalized);
  else sessionStorage.removeItem(AUTH_PREVIEW_ROLE_KEY);
}

function authGetSession() {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY) || sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    const user = authFindUser(session.email);
    const actualRole = authNormalizeRole((user && user.role) || session.role);
    session.actualRole = actualRole;
    session.role = actualRole;
    if (user) {
      session.nome = user.nome || session.nome;
      session.foto = user.foto || null;
      session.clientId = user.clientId || '';
      session.cargo = user.cargo || '';
      session.telefone = user.telefone || '';
    }
    const previewRole = actualRole === 'admin' ? authGetPreviewRole() : '';
    if (previewRole) {
      session.previewRole = previewRole;
      session.role = previewRole;
      // Substitui a identidade da sessão pela do usuário selecionado no picker,
      // para que os filtros por email/carteira/cliente reflitam exatamente o
      // que aquele gerente/operador veria ao entrar no sistema.
      const previewEmail = authGetPreviewUser();
      if (previewEmail) {
        const previewUser = authFindUser(previewEmail);
        if (previewUser && authNormalizeRole(previewUser.role) === previewRole) {
          session.adminEmail = session.email;
          session.adminNome = session.nome;
          session.email = previewUser.email;
          session.nome = previewUser.nome || previewUser.email;
          session.foto = previewUser.foto || null;
          session.clientId = previewUser.clientId || '';
          session.cargo = previewUser.cargo || '';
          session.telefone = previewUser.telefone || '';
          session.previewUser = previewUser.email;
        }
      }
    } else {
      delete session.previewRole;
      if (actualRole !== 'admin') {
        sessionStorage.removeItem(AUTH_PREVIEW_ROLE_KEY);
        sessionStorage.removeItem(AUTH_PREVIEW_USER_KEY);
      }
    }
    return session;
  } catch (e) { return null; }
}

function authRequireRole(roles) {
  const session = authGetSession();
  if (!session) {
    window.location.replace('login.html');
    return false;
  }
  const allowed = Array.isArray(roles) ? roles : [roles];
  const normalizedAllowed = allowed.map(authNormalizeRole);
  const sessionRole = authNormalizeRole(session.role);
  const actualRole = authNormalizeRole(session.actualRole || session.role);
  if (actualRole === 'admin') return true;
  if (sessionRole === 'admin' && normalizedAllowed.includes('gerente')) return true;
  if (!normalizedAllowed.includes(sessionRole)) {
    window.location.replace('index.html');
    return false;
  }
  return true;
}

/* Reescreve a sessão ativa (mantendo-a no mesmo storage em que já estava:
   localStorage se "lembrar de mim" estava ativo, senão sessionStorage). */
function authWriteSession(session) {
  if (localStorage.getItem(AUTH_SESSION_KEY)) {
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  } else {
    sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  }
}

function authLogout() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  sessionStorage.removeItem(AUTH_SESSION_KEY);
  sessionStorage.removeItem(AUTH_PREVIEW_ROLE_KEY);
  sessionStorage.removeItem(AUTH_PREVIEW_CLIENT_KEY);
  sessionStorage.removeItem(AUTH_PREVIEW_USER_KEY);
  window.location.replace('login.html');
}

/* Bloqueia o acesso à página caso não haja sessão ativa.
   Deve ser chamada o mais cedo possível (no <head>, antes do body)
   para evitar qualquer "flash" de conteúdo protegido. */
function authRequire() {
  if (!authGetSession()) {
    window.location.replace('login.html');
  }
}

/* --------- atualização de perfil (nome, senha, foto) ---------
   Não permite alterar o e-mail, que é o identificador da conta. */
function authUpdateProfile({ nome, senhaAtual, novaSenha, foto, removerFoto } = {}) {
  const session = authGetSession();
  if (!session) return { ok: false, msg: 'Sua sessão expirou. Faça login novamente.' };

  const users = authGetUsers();
  const idx = users.findIndex(u => u.email === session.email);
  if (idx === -1) return { ok: false, msg: 'Usuário não encontrado.' };

  const user = { ...users[idx] };

  if (typeof nome === 'string') {
    const n = nome.trim();
    if (!n) return { ok: false, msg: 'Informe seu nome completo.', field: 'nome' };
    user.nome = n;
  }

  if (novaSenha) {
    if (!senhaAtual || user.pass !== authHash(senhaAtual)) {
      return { ok: false, msg: 'Senha atual incorreta.', field: 'atual' };
    }
    if (novaSenha.length < 8) {
      return { ok: false, msg: 'A nova senha deve ter pelo menos 8 caracteres.', field: 'nova' };
    }
    if (!/[a-z]/.test(novaSenha) || !/[A-Z]/.test(novaSenha) || !/[0-9]/.test(novaSenha)) {
      return { ok: false, msg: 'Use letras maiúsculas, minúsculas e números.', field: 'nova' };
    }
    user.pass = authHash(novaSenha);
  }

  if (removerFoto) {
    user.foto = null;
  } else if (foto) {
    user.foto = foto;
  }

  users[idx] = user;
  authSaveUsers(users);

  const newSession = { nome: user.nome, email: user.email, role: authNormalizeRole(user.role), foto: user.foto || null, clientId: user.clientId || '', ts: Date.now() };
  authWriteSession(newSession);

  return { ok: true, session: newSession };
}

/* Redimensiona uma imagem enviada pelo usuário para um dataURL
   pequeno (evita estourar o localStorage com fotos grandes). */
function authResizeImageFile(file, maxSize) {
  maxSize = maxSize || 240;
  return new Promise((resolve, reject) => {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) {
      reject(new Error('Selecione um arquivo de imagem válido.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = Math.round(h * (maxSize / w)); w = maxSize; } }
        else { if (h > maxSize) { w = Math.round(w * (maxSize / h)); h = maxSize; } }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      };
      img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

/* Lê um arquivo de imagem e devolve o dataURL original (sem redimensionar),
   usado para abrir a telinha de ajuste/zoom antes do recorte final. */
function authReadFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) {
      reject(new Error('Selecione um arquivo de imagem válido.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

/* --------- iniciais / avatar --------- */
function authInitials(session) {
  const base = (session && (session.nome || session.email)) || '?';
  const parts = base.trim().split(/\s+/).slice(0, 2).map(p => p[0].toUpperCase());
  return parts.join('') || '?';
}
function authAvatarHTML(session, extraClass) {
  if (session && session.foto) {
    return `<img src="${session.foto}" alt="Foto de perfil" class="${extraClass || ''}">`;
  }
  return authInitials(session);
}

/* Insere um chip com o nome/avatar do usuário no cabeçalho de cada
   página protegida, posicionado à ESQUERDA da logo EMAG. Ao clicar,
   abre um menu com "Gerenciar conta", "Sobre" e "Sair". O conteúdo
   original do cabeçalho é preservado dentro de um wrapper, então o
   chip nunca sobrepõe nada, independente do layout de cada tela. */
function authMountBadge(opts) {
  const session = authGetSession();
  if (!session) return;
  const showName = !!(opts && opts.showName);

  authInjectStyles();

  const badgeBtn = document.createElement('button');
  badgeBtn.type = 'button';
  badgeBtn.id = 'auth-badge-btn';
  if (showName) badgeBtn.classList.add('has-name');
  badgeBtn.setAttribute('aria-haspopup', 'true');
  badgeBtn.setAttribute('aria-expanded', 'false');
  badgeBtn.setAttribute('title', session.nome || session.email);
  badgeBtn.setAttribute('aria-label', 'Conta: ' + (session.nome || session.email));
  badgeBtn.innerHTML = `
    <span class="auth-avatar" id="auth-avatar">${authAvatarHTML(session, 'auth-avatar-img')}</span>
    <span class="auth-name" id="auth-name"${showName ? '' : ' hidden'}>${authEscape(session.nome || session.email)}</span>
  `;

  const dropdown = document.createElement('div');
  dropdown.id = 'auth-dropdown';
  dropdown.innerHTML = `
    <div class="auth-dd-role">
      <span>${authEscape(authRoleLabel(session.role))}</span>
      <small>${authEscape(session.email || '')}</small>
    </div>
    <div class="auth-dd-item" id="auth-dd-account">
      <span class="auth-dd-ico">👤</span> Gerenciar conta
    </div>
    <div class="auth-dd-item" id="auth-dd-settings">
      <span class="auth-dd-ico">⚙</span> Configurações
    </div>
    <div class="auth-dd-item" id="auth-dd-about">
      <span class="auth-dd-ico">ℹ️</span> Sobre
    </div>
    <div class="auth-dd-sep"></div>
    <div class="auth-dd-item auth-dd-danger" id="auth-dd-logout">
      <span class="auth-dd-ico">↩</span> Sair
    </div>
  `;

  const badgeWrap = document.createElement('div');
  badgeWrap.id = 'auth-badge';
  badgeWrap.appendChild(badgeBtn);
  badgeWrap.appendChild(dropdown);

  const header = document.querySelector('.header');
  if (header) {
    // Move todo o conteúdo original do cabeçalho para dentro de um wrapper
    // flexível, preservando o espaçamento original (space-between etc.),
    // e insere o chip ANTES desse wrapper — ou seja, à esquerda de tudo,
    // incluindo a logo EMAG, que é sempre o primeiro elemento do header.
    const headerStyles = getComputedStyle(header);
    const wrap = document.createElement('div');
    wrap.id = 'auth-header-wrap';
    wrap.style.justifyContent = headerStyles.justifyContent;
    wrap.style.gap = headerStyles.gap && headerStyles.gap !== 'normal' ? headerStyles.gap : '12px';
    while (header.firstChild) wrap.appendChild(header.firstChild);
    header.appendChild(badgeWrap);
    header.appendChild(wrap);
  } else {
    // fallback: se não houver .header, mantém o chip fixo no canto
    badgeWrap.classList.add('auth-badge-floating');
    document.body.appendChild(badgeWrap);
  }

  authApplyClientBranding();
  authMountPreviewExitButton();
  authMountModals();

  /* -------- interações -------- */
  function closeDropdown() {
    dropdown.classList.remove('open');
    badgeBtn.setAttribute('aria-expanded', 'false');
  }
  function toggleDropdown(e) {
    e.stopPropagation();
    const willOpen = !dropdown.classList.contains('open');
    dropdown.classList.toggle('open', willOpen);
    badgeBtn.setAttribute('aria-expanded', String(willOpen));
  }
  badgeBtn.addEventListener('click', toggleDropdown);
  document.addEventListener('click', (e) => {
    if (!badgeWrap.contains(e.target)) closeDropdown();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
  });

  dropdown.querySelector('#auth-dd-account').addEventListener('click', () => {
    closeDropdown();
    authOpenAccountModal();
  });
  dropdown.querySelector('#auth-dd-settings').addEventListener('click', () => {
    closeDropdown();
    authOpenSettingsModal();
  });
  dropdown.querySelector('#auth-dd-about').addEventListener('click', () => {
    closeDropdown();
    authOpenModal('auth-modal-about');
  });
  dropdown.querySelector('#auth-dd-logout').addEventListener('click', () => {
    closeDropdown();
    authLogout();
  });
}

function authEscape(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

/* Atualiza o chip do cabeçalho (nome/avatar) sem precisar recarregar a página,
   usado depois de salvar alterações no modal "Gerenciar conta". */
function authRefreshBadge(session) {
  const nameEl = document.getElementById('auth-name');
  const avatarEl = document.getElementById('auth-avatar');
  if (nameEl) nameEl.textContent = session.nome || session.email;
  if (avatarEl) avatarEl.innerHTML = authAvatarHTML(session, 'auth-avatar-img');
}

/* --------- modais: "Gerenciar conta" e "Sobre" --------- */
function authMountModals() {
  if (document.getElementById('auth-modal-account')) return; // já montado

  const overlayAccount = document.createElement('div');
  overlayAccount.className = 'auth-modal-overlay';
  overlayAccount.id = 'auth-modal-account';
  overlayAccount.innerHTML = `
    <div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-account-title">
      <div class="auth-modal-head">
        <h3 id="auth-modal-account-title">Gerenciar conta</h3>
        <button type="button" class="auth-modal-close" data-close>✕</button>
      </div>
      <div class="auth-modal-body">
        <div class="auth-banner error" id="auth-account-banner"></div>

        <div class="auth-photo-row">
          <div class="auth-photo-preview" id="auth-photo-preview">${authAvatarHTML(authGetSession(), 'auth-avatar-img')}</div>
          <div class="auth-photo-actions">
            <button type="button" class="auth-btn-secondary" id="auth-photo-pick">Alterar foto</button>
            <button type="button" class="auth-btn-link-danger" id="auth-photo-remove">Remover foto</button>
            <input type="file" accept="image/*" id="auth-photo-input" hidden>
          </div>
        </div>

        <form id="auth-account-form" autocomplete="off">
          <div class="auth-field">
            <label for="auth-acc-nome">Nome de usuário</label>
            <input type="text" id="auth-acc-nome" placeholder="Seu nome">
            <div class="auth-field-err" id="auth-acc-nome-err"></div>
          </div>

          <div class="auth-field">
            <label for="auth-acc-email">E-mail</label>
            <input type="email" id="auth-acc-email" disabled>
            <div class="auth-field-hint">O e-mail é o identificador da conta e não pode ser alterado.</div>
          </div>

          <div class="auth-divider-label">Alterar senha (opcional)</div>

          <div class="auth-field">
            <label for="auth-acc-senha-atual">Senha atual</label>
            <input type="password" id="auth-acc-senha-atual" placeholder="Necessária apenas para trocar a senha" autocomplete="current-password">
            <div class="auth-field-err" id="auth-acc-senha-atual-err"></div>
          </div>
          <div class="auth-field">
            <label for="auth-acc-senha-nova">Nova senha</label>
            <input type="password" id="auth-acc-senha-nova" placeholder="Mínimo 8 caracteres" autocomplete="new-password">
            <div class="auth-field-err" id="auth-acc-senha-nova-err"></div>
          </div>
          <div class="auth-field">
            <label for="auth-acc-senha-conf">Confirmar nova senha</label>
            <input type="password" id="auth-acc-senha-conf" placeholder="Repita a nova senha" autocomplete="new-password">
            <div class="auth-field-err" id="auth-acc-senha-conf-err"></div>
          </div>

          <div class="auth-modal-actions">
            <button type="button" class="auth-btn-secondary" data-close>Cancelar</button>
            <button type="submit" class="auth-btn-primary" id="auth-acc-submit">
              <span class="auth-spinner"></span>
              <span class="auth-btn-label">Salvar alterações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(overlayAccount);

  const overlaySettings = document.createElement('div');
  overlaySettings.className = 'auth-modal-overlay';
  overlaySettings.id = 'auth-modal-settings';
  overlaySettings.innerHTML = `
    <div class="auth-modal auth-settings-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-settings-title">
      <div class="auth-modal-head">
        <h3 id="auth-modal-settings-title">Configurações do site</h3>
        <button type="button" class="auth-modal-close" data-close>✕</button>
      </div>
      <div class="auth-modal-body">
        <div class="auth-banner success" id="auth-settings-banner"></div>

        <form id="auth-settings-form" autocomplete="off">
          <div class="auth-settings-group">
            <div class="auth-setting-heading">Aparência</div>
            <div class="auth-field">
              <label for="auth-set-theme">Tema do painel</label>
              <select id="auth-set-theme" class="auth-select">
                <option value="dark">Escuro</option>
                <option value="light">Claro</option>
                <option value="system">Automático do dispositivo</option>
              </select>
              <div class="auth-field-hint">A preferência fica salva neste navegador.</div>
            </div>
          </div>

          <div class="auth-settings-group">
            <div class="auth-setting-heading">Experiência</div>

            <label class="auth-toggle-row" for="auth-set-focus-mode">
              <span>
                <b>Modo foco de trabalho</b>
                <small>Oculta distrações como minigame, fogos e brilhos para priorizar a rotina.</small>
              </span>
              <input type="checkbox" id="auth-set-focus-mode" class="auth-switch">
            </label>

            <label class="auth-toggle-row" for="auth-set-pending-focus">
              <span>
                <b>Realçar pendências</b>
                <small>Destaca status pendentes nas tabelas, cards e indicadores mensais.</small>
              </span>
              <input type="checkbox" id="auth-set-pending-focus" class="auth-switch">
            </label>

            <label class="auth-toggle-row" for="auth-set-reduce-motion">
              <span>
                <b>Reduzir animações</b>
                <small>Desativa transições, partículas e efeitos em movimento.</small>
              </span>
              <input type="checkbox" id="auth-set-reduce-motion" class="auth-switch">
            </label>

            <label class="auth-toggle-row" for="auth-set-sound-enabled">
              <span>
                <b>Melodia de fundo</b>
                <small>Ativa um som ambiente baixo, gerado no navegador e sem arquivos externos.</small>
              </span>
              <input type="checkbox" id="auth-set-sound-enabled" class="auth-switch">
            </label>

            <div class="auth-sound-panel">
              <div class="auth-field">
                <label for="auth-set-sound-preset">Modelo da melodia</label>
                <select id="auth-set-sound-preset" class="auth-select">
                  <option value="crystal">Cristal suave</option>
                  <option value="pulse">Pulso contábil</option>
                  <option value="calm">Noite calma</option>
                </select>
              </div>
              <div class="auth-field">
                <div class="auth-range-head">
                  <label for="auth-set-sound-volume">Volume</label>
                  <span id="auth-set-sound-volume-label">18%</span>
                </div>
                <input type="range" id="auth-set-sound-volume" class="auth-range" min="0" max="100" step="1">
                <div class="auth-field-hint">O volume máximo continua limitado para não atrapalhar o trabalho.</div>
              </div>
              <button type="button" class="auth-btn-secondary auth-sound-preview" id="auth-sound-preview">Ouvir modelo</button>
            </div>
          </div>

          <div class="auth-modal-actions">
            <button type="button" class="auth-btn-secondary" id="auth-settings-reset">Restaurar padrão</button>
            <button type="button" class="auth-btn-secondary" data-close>Cancelar</button>
            <button type="submit" class="auth-btn-primary">
              <span class="auth-btn-label">Salvar configurações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(overlaySettings);

  const overlayAbout = document.createElement('div');
  overlayAbout.className = 'auth-modal-overlay';
  overlayAbout.id = 'auth-modal-about';
  overlayAbout.innerHTML = `
    <div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-about-title">
      <div class="auth-modal-head">
        <h3 id="auth-modal-about-title">Sobre este sistema</h3>
        <button type="button" class="auth-modal-close" data-close>✕</button>
      </div>
      <div class="auth-modal-body">
        <div class="auth-about-brand">
          <div class="auth-about-emag">EMAG</div>
          <div class="auth-about-sub">CONTABILIDADE</div>
        </div>
        <p class="auth-about-text">
          O <b>Painel do Setor Contábil</b> é um sistema interno para organizar a rotina contábil
          com controle por competência, acompanhamento de pendências, gestão de empresas e divisão
          de carteiras entre operadores. A proposta é separar claramente o trabalho operacional
          do gerenciamento, mantendo o gerente no controle da base e os operadores focados nas
          empresas designadas.
        </p>
        <p class="auth-about-text">
          Sistema criado por <b>João Victor Ferreira de Oliveira</b>, com foco em produtividade,
          organização mensal e visibilidade sobre o andamento das rotinas do escritório.
        </p>

        <div class="auth-about-modules">
          <div class="auth-about-module">
            <span class="auth-about-ico">🧑‍💼</span>
            <div>
              <b>Área do gerente</b>
              <p>Cadastro de operadores, manutenção da base de empresas e distribuição das carteiras de trabalho.</p>
            </div>
          </div>
          <div class="auth-about-module">
            <span class="auth-about-ico">🧮</span>
            <div>
              <b>Fechamento Contábil</b>
              <p>Checklist e apuração mensal das empresas atribuídas a cada operador.</p>
            </div>
          </div>
          <div class="auth-about-module">
            <span class="auth-about-ico">📑</span>
            <div>
              <b>Movimento Contábil</b>
              <p>Controle de envio e recebimento de documentos contábeis por competência.</p>
            </div>
          </div>
          <div class="auth-about-module">
            <span class="auth-about-ico">🗂️</span>
            <div>
              <b>Base de empresas</b>
              <p>Cadastro central de clientes, regimes tributários, situação ativa/inativa e dados de acompanhamento.</p>
            </div>
          </div>
        </div>

        <div class="auth-about-foot">
          <span>Painel interno · gestão e operação contábil</span>
          <span class="auth-about-version">v2.0</span>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlayAbout);

  /* -------- modal: ajustar/dimensionar foto (crop + zoom) -------- */
  const overlayCrop = document.createElement('div');
  overlayCrop.className = 'auth-modal-overlay';
  overlayCrop.id = 'auth-modal-crop';
  overlayCrop.innerHTML = `
    <div class="auth-modal auth-crop-modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-crop-title">
      <div class="auth-modal-head">
        <h3 id="auth-modal-crop-title">Ajustar foto</h3>
        <button type="button" class="auth-modal-close" data-close>✕</button>
      </div>
      <div class="auth-modal-body">
        <div class="auth-crop-stage" id="auth-crop-stage">
          <canvas id="auth-crop-canvas" width="260" height="260"></canvas>
        </div>
        <div class="auth-crop-controls">
          <span class="auth-crop-ico" aria-hidden="true">－</span>
          <input type="range" id="auth-crop-zoom" min="100" max="300" value="100" step="1">
          <span class="auth-crop-ico" aria-hidden="true">＋</span>
        </div>
        <p class="auth-crop-hint">Arraste a imagem para posicionar e use o controle para aplicar zoom.</p>
        <div class="auth-modal-actions">
          <button type="button" class="auth-btn-secondary" data-close>Cancelar</button>
          <button type="button" class="auth-btn-primary" id="auth-crop-confirm">
            <span class="auth-btn-label">Usar esta foto</span>
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlayCrop);

  /* fechar ao clicar fora do card ou no X */
  [overlayAccount, overlaySettings, overlayAbout, overlayCrop].forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) authCloseModal(overlay.id);
    });
    overlay.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => authCloseModal(overlay.id));
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    [overlayAccount, overlaySettings, overlayAbout, overlayCrop].forEach(overlay => {
      if (overlay.classList.contains('open')) authCloseModal(overlay.id);
    });
  });

  /* -------- lógica do formulário "Configurações do site" -------- */
  const settingsForm = document.getElementById('auth-settings-form');
  const settingsTheme = document.getElementById('auth-set-theme');
  const settingsFocusMode = document.getElementById('auth-set-focus-mode');
  const settingsPendingFocus = document.getElementById('auth-set-pending-focus');
  const settingsReduceMotion = document.getElementById('auth-set-reduce-motion');
  const settingsSoundEnabled = document.getElementById('auth-set-sound-enabled');
  const settingsSoundPreset = document.getElementById('auth-set-sound-preset');
  const settingsSoundVolume = document.getElementById('auth-set-sound-volume');
  const settingsSoundVolumeLabel = document.getElementById('auth-set-sound-volume-label');

  function authUpdateVolumeLabel() {
    settingsSoundVolumeLabel.textContent = `${settingsSoundVolume.value || 0}%`;
  }

  window.authFillSettingsForm = function () {
    const s = authGetSiteSettings();
    settingsTheme.value = s.theme || AUTH_SITE_SETTINGS_DEFAULTS.theme;
    settingsFocusMode.checked = !!s.focusMode;
    settingsPendingFocus.checked = !!s.pendingFocus;
    settingsReduceMotion.checked = !!s.reduceMotion;
    settingsSoundEnabled.checked = !!s.soundEnabled;
    settingsSoundPreset.value = s.soundPreset || AUTH_SITE_SETTINGS_DEFAULTS.soundPreset;
    settingsSoundVolume.value = Math.round((s.soundVolume == null ? AUTH_SITE_SETTINGS_DEFAULTS.soundVolume : s.soundVolume) * 100);
    authUpdateVolumeLabel();
  };

  function authReadSettingsForm() {
    return {
      theme: settingsTheme.value,
      focusMode: settingsFocusMode.checked,
      pendingFocus: settingsPendingFocus.checked,
      reduceMotion: settingsReduceMotion.checked,
      soundEnabled: settingsSoundEnabled.checked,
      soundPreset: settingsSoundPreset.value,
      soundVolume: Number(settingsSoundVolume.value || 0) / 100,
    };
  }

  settingsSoundVolume.addEventListener('input', () => {
    authUpdateVolumeLabel();
    if (settingsSoundEnabled.checked) authSetAmbientVolume(Number(settingsSoundVolume.value || 0) / 100);
  });

  settingsSoundPreset.addEventListener('change', () => {
    if (settingsSoundEnabled.checked) {
      authAmbientPreset = settingsSoundPreset.value;
      authAmbientStep = 0;
    }
  });

  settingsSoundEnabled.addEventListener('change', () => {
    if (settingsSoundEnabled.checked) authApplyAmbientSound(authReadSettingsForm());
    else authStopAmbientSound();
  });

  document.getElementById('auth-sound-preview').addEventListener('click', () => {
    authPlayPresetPreview(settingsSoundPreset.value, Number(settingsSoundVolume.value || 0) / 100);
  });

  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    authHideBanner('auth-settings-banner');
    authSaveSiteSettings(authReadSettingsForm());
    authShowBanner('auth-settings-banner', 'Configurações salvas com sucesso!', 'success');
    setTimeout(() => authCloseModal('auth-modal-settings'), 800);
  });

  document.getElementById('auth-settings-reset').addEventListener('click', () => {
    authHideBanner('auth-settings-banner');
    authSaveSiteSettings(AUTH_SITE_SETTINGS_DEFAULTS);
    window.authFillSettingsForm();
    authShowBanner('auth-settings-banner', 'Padrão restaurado.', 'success');
  });

  /* -------- lógica do ajuste de foto (arrastar + zoom) -------- */
  const cropCanvas = document.getElementById('auth-crop-canvas');
  const cropCtx = cropCanvas.getContext('2d');
  const cropZoomInput = document.getElementById('auth-crop-zoom');
  const cropStage = document.getElementById('auth-crop-stage');
  const cropBoxSize = 260;

  let cropImg = null;
  let cropBaseScale = 1;
  let cropDrawW = 0, cropDrawH = 0;
  let cropOffX = 0, cropOffY = 0;
  let cropOnConfirm = null;
  let dragging = false, dragStartX = 0, dragStartY = 0, dragOffStartX = 0, dragOffStartY = 0;

  function cropClamp() {
    const minX = Math.min(0, cropBoxSize - cropDrawW);
    const minY = Math.min(0, cropBoxSize - cropDrawH);
    cropOffX = Math.max(minX, Math.min(0, cropOffX));
    cropOffY = Math.max(minY, Math.min(0, cropOffY));
  }
  function cropRecalc(zoomPct) {
    const scale = cropBaseScale * (zoomPct / 100);
    const prevW = cropDrawW, prevH = cropDrawH;
    cropDrawW = cropImg.width * scale;
    cropDrawH = cropImg.height * scale;
    // mantém o ponto central enquadrado ao aplicar zoom
    if (prevW) {
      cropOffX -= (cropDrawW - prevW) / 2;
      cropOffY -= (cropDrawH - prevH) / 2;
    }
    cropClamp();
  }
  function cropDraw() {
    cropCtx.clearRect(0, 0, cropBoxSize, cropBoxSize);
    if (cropImg) cropCtx.drawImage(cropImg, cropOffX, cropOffY, cropDrawW, cropDrawH);
  }

  function cropPointerDown(x, y) {
    dragging = true;
    dragStartX = x; dragStartY = y;
    dragOffStartX = cropOffX; dragOffStartY = cropOffY;
    cropStage.classList.add('dragging');
  }
  function cropPointerMove(x, y) {
    if (!dragging) return;
    cropOffX = dragOffStartX + (x - dragStartX);
    cropOffY = dragOffStartY + (y - dragStartY);
    cropClamp();
    cropDraw();
  }
  function cropPointerUp() {
    dragging = false;
    cropStage.classList.remove('dragging');
  }

  cropCanvas.addEventListener('mousedown', (e) => cropPointerDown(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => cropPointerMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', cropPointerUp);
  cropCanvas.addEventListener('touchstart', (e) => {
    const t = e.touches[0]; cropPointerDown(t.clientX, t.clientY);
  }, { passive: true });
  cropCanvas.addEventListener('touchmove', (e) => {
    const t = e.touches[0]; cropPointerMove(t.clientX, t.clientY); e.preventDefault();
  }, { passive: false });
  cropCanvas.addEventListener('touchend', cropPointerUp);

  cropZoomInput.addEventListener('input', () => {
    cropRecalc(Number(cropZoomInput.value));
    cropDraw();
  });

  document.getElementById('auth-crop-confirm').addEventListener('click', () => {
    if (!cropImg) return;
    const outSize = 320;
    const ratio = outSize / cropBoxSize;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = outSize; outCanvas.height = outSize;
    const outCtx = outCanvas.getContext('2d');
    outCtx.drawImage(cropImg, cropOffX * ratio, cropOffY * ratio, cropDrawW * ratio, cropDrawH * ratio);
    const dataUrl = outCanvas.toDataURL('image/jpeg', 0.88);
    if (cropOnConfirm) cropOnConfirm(dataUrl);
    authCloseModal('auth-modal-crop');
  });

  window.authOpenCropper = function (rawDataUrl, onConfirm) {
    cropOnConfirm = onConfirm;
    const img = new Image();
    img.onload = () => {
      cropImg = img;
      cropBaseScale = Math.max(cropBoxSize / img.width, cropBoxSize / img.height);
      cropZoomInput.value = 100;
      cropDrawW = 0; cropDrawH = 0;
      cropRecalc(100);
      cropOffX = (cropBoxSize - cropDrawW) / 2;
      cropOffY = (cropBoxSize - cropDrawH) / 2;
      cropDraw();
      authOpenModal('auth-modal-crop');
    };
    img.src = rawDataUrl;
  };

  /* -------- lógica do formulário "Gerenciar conta" -------- */
  let pendingFoto = null;   // dataURL selecionado nesta sessão do modal (ainda não salvo)
  let removeFotoFlag = false;

  const photoInput = document.getElementById('auth-photo-input');
  const photoPreview = document.getElementById('auth-photo-preview');

  document.getElementById('auth-photo-pick').addEventListener('click', () => photoInput.click());

  photoInput.addEventListener('change', async () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;
    if (!file.type || file.type.indexOf('image/') !== 0) {
      authShowBanner('auth-account-banner', 'Selecione um arquivo de imagem válido.', 'error');
      photoInput.value = '';
      return;
    }
    try {
      const rawDataUrl = await authReadFileAsDataUrl(file);
      // abre a telinha de ajuste (arrastar/zoom) antes de confirmar a foto
      window.authOpenCropper(rawDataUrl, (croppedDataUrl) => {
        pendingFoto = croppedDataUrl;
        removeFotoFlag = false;
        photoPreview.innerHTML = `<img src="${croppedDataUrl}" class="auth-avatar-img" alt="Prévia da foto">`;
      });
    } catch (err) {
      authShowBanner('auth-account-banner', err.message || 'Não foi possível carregar a imagem.', 'error');
    }
    photoInput.value = '';
  });

  document.getElementById('auth-photo-remove').addEventListener('click', () => {
    pendingFoto = null;
    removeFotoFlag = true;
    photoPreview.innerHTML = authInitials(authGetSession());
  });

  const form = document.getElementById('auth-account-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    authClearFieldErrors(['auth-acc-nome', 'auth-acc-senha-atual', 'auth-acc-senha-nova', 'auth-acc-senha-conf']);
    authHideBanner('auth-account-banner');

    const nome = document.getElementById('auth-acc-nome').value;
    const senhaAtual = document.getElementById('auth-acc-senha-atual').value;
    const senhaNova = document.getElementById('auth-acc-senha-nova').value;
    const senhaConf = document.getElementById('auth-acc-senha-conf').value;

    let hasErr = false;
    if (!nome.trim()) { authSetFieldError('auth-acc-nome', 'Informe seu nome completo.'); hasErr = true; }
    if (senhaNova || senhaConf || senhaAtual) {
      if (!senhaAtual) { authSetFieldError('auth-acc-senha-atual', 'Informe a senha atual.'); hasErr = true; }
      if (!senhaNova || senhaNova.length < 8) { authSetFieldError('auth-acc-senha-nova', 'Mínimo de 8 caracteres.'); hasErr = true; }
      else if (!/[a-z]/.test(senhaNova) || !/[A-Z]/.test(senhaNova) || !/[0-9]/.test(senhaNova)) {
        authSetFieldError('auth-acc-senha-nova', 'Use maiúsculas, minúsculas e números.');
        hasErr = true;
      }
      if (senhaNova !== senhaConf) { authSetFieldError('auth-acc-senha-conf', 'As senhas não coincidem.'); hasErr = true; }
    }
    if (hasErr) return;

    authSetLoading('auth-acc-submit', true);
    setTimeout(() => {
      const res = authUpdateProfile({
        nome,
        senhaAtual: senhaNova ? senhaAtual : undefined,
        novaSenha: senhaNova || undefined,
        foto: pendingFoto,
        removerFoto: removeFotoFlag && !pendingFoto,
      });
      authSetLoading('auth-acc-submit', false);

      if (!res.ok) {
        if (res.field === 'atual') authSetFieldError('auth-acc-senha-atual', res.msg);
        else if (res.field === 'nova') authSetFieldError('auth-acc-senha-nova', res.msg);
        else if (res.field === 'nome') authSetFieldError('auth-acc-nome', res.msg);
        authShowBanner('auth-account-banner', res.msg, 'error');
        return;
      }

      pendingFoto = null;
      removeFotoFlag = false;
      document.getElementById('auth-acc-senha-atual').value = '';
      document.getElementById('auth-acc-senha-nova').value = '';
      document.getElementById('auth-acc-senha-conf').value = '';
      authRefreshBadge(res.session);
      authShowBanner('auth-account-banner', 'Dados atualizados com sucesso!', 'success');
      // fecha a aba/modal automaticamente após salvar com sucesso
      setTimeout(() => authCloseModal('auth-modal-account'), 900);
    }, 400);
  });
}

function authOpenModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.add('open');
  document.body.classList.add('auth-modal-lock');
}
function authCloseModal(id) {
  const overlay = document.getElementById(id);
  if (!overlay) return;
  overlay.classList.remove('open');
  if (id === 'auth-modal-settings') authApplySiteSettings(authGetSiteSettings());
  if (!document.querySelector('.auth-modal-overlay.open')) {
    document.body.classList.remove('auth-modal-lock');
  }
}
function authOpenAccountModal() {
  const session = authGetSession();
  if (!session) return;
  authHideBanner('auth-account-banner');
  authClearFieldErrors(['auth-acc-nome', 'auth-acc-senha-atual', 'auth-acc-senha-nova', 'auth-acc-senha-conf']);
  document.getElementById('auth-acc-nome').value = session.nome || '';
  document.getElementById('auth-acc-email').value = session.email || '';
  document.getElementById('auth-acc-senha-atual').value = '';
  document.getElementById('auth-acc-senha-nova').value = '';
  document.getElementById('auth-acc-senha-conf').value = '';
  document.getElementById('auth-photo-preview').innerHTML = authAvatarHTML(session, 'auth-avatar-img');
  authOpenModal('auth-modal-account');
}
function authOpenSettingsModal() {
  authHideBanner('auth-settings-banner');
  if (window.authFillSettingsForm) window.authFillSettingsForm();
  authOpenModal('auth-modal-settings');
}

/* -------- helpers de formulário (banners / erros / loading) -------- */
function authSetFieldError(id, msg) {
  const errEl = document.getElementById(id + '-err');
  const inputEl = document.getElementById(id);
  if (errEl) errEl.textContent = msg || '';
  if (inputEl) inputEl.classList.toggle('auth-err', !!msg);
}
function authClearFieldErrors(ids) {
  ids.forEach(id => authSetFieldError(id, ''));
}
function authShowBanner(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = 'auth-banner show ' + (type || 'error');
}
function authHideBanner(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}
function authSetLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
}

/* --------- estilos injetados (chip, dropdown, modais) --------- */
function authInjectStyles() {
  if (document.getElementById('auth-injected-styles')) return;
  const style = document.createElement('style');
  style.id = 'auth-injected-styles';
  style.textContent = `
    /* ---------- preferências visuais do site ---------- */
    html.emag-theme-light {
      --bg: #f4f7fb;
      --surface: #ffffff;
      --surface2: #eef3f8;
      --border: #d8e0ec;
      --text: #172033;
      --text-dim: #475569;
      --text-muted: #718096;
      --green-dim: #16a34a18;
      --yellow-dim: #f59e0b18;
      --red-dim: #ef444418;
      --blue-dim: #3b82f618;
      --gray-dim: #64748b18;
    }
    html.emag-client-branded .emag-top-title.client-brand,
    html.emag-client-branded .brand.client-brand {
      display: block;
      max-width: min(36vw, 340px);
      min-width: 0;
      white-space: normal !important;
      line-height: 1.08 !important;
    }
    html.emag-client-branded .emag-top-title.client-brand .emag,
    html.emag-client-branded .brand.client-brand .emag {
      color: var(--client-brand-color, #9fda68) !important;
      overflow-wrap: anywhere;
      line-height: 1.02 !important;
      text-transform: uppercase;
    }
    html.emag-client-branded .emag-top-title.client-brand .contabilidade,
    html.emag-client-branded .brand.client-brand .sub {
      display: block !important;
      min-height: 10px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap !important;
      text-transform: uppercase;
    }
    html.emag-client-branded .emag-top-title.client-brand .contabilidade[hidden],
    html.emag-client-branded .brand.client-brand .sub[hidden] {
      display: none !important;
    }
    html.emag-client-branded .emag-top-title.client-brand.brand-long .emag,
    html.emag-client-branded .brand.client-brand.brand-long .emag {
      font-size: 21px !important;
      letter-spacing: 1px !important;
    }
    html.emag-client-branded .emag-top-title.client-brand.brand-extra-long .emag,
    html.emag-client-branded .brand.client-brand.brand-extra-long .emag {
      font-size: 18px !important;
      letter-spacing: .4px !important;
    }
    html.emag-theme-light body {
      background: radial-gradient(ellipse 1100px 540px at 50% -10%, #e7eef9 0%, var(--bg) 58%) !important;
      color: var(--text) !important;
    }
    html.emag-theme-light .header {
      background: linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(241,245,249,0.98) 100%) !important;
      border-bottom-color: rgba(79,110,247,0.18) !important;
      box-shadow: 0 8px 30px rgba(15,23,42,0.08) !important;
    }
    html.emag-theme-light .header-center {
      border-left-color: rgba(15,23,42,0.08) !important;
      border-right-color: rgba(15,23,42,0.08) !important;
    }
    html.emag-theme-light .header-center h1,
    html.emag-theme-light .header h1 { color: #172033 !important; }
    html.emag-theme-light .header-center p { color: #64748b !important; }
    html.emag-theme-light .card,
    html.emag-theme-light .module-card,
    html.emag-theme-light .chart-box,
    html.emag-theme-light .highlight-card,
    html.emag-theme-light .edit-form,
    html.emag-theme-light .table-box,
    html.emag-theme-light .company-picker,
    html.emag-theme-light .company-info-modal,
    html.emag-theme-light .inactive-detail-card {
      background: var(--surface) !important;
      border-color: var(--border) !important;
      box-shadow: 0 12px 34px rgba(15,23,42,0.07) !important;
    }
    html.emag-theme-light thead tr,
    html.emag-theme-light .mobile-nav,
    html.emag-theme-light .month-tab,
    html.emag-theme-light .filter-select,
    html.emag-theme-light .search-input,
    html.emag-theme-light .form-control,
    html.emag-theme-light .input-wrap input {
      background: var(--surface2) !important;
      color: var(--text) !important;
      border-color: var(--border) !important;
    }
    html.emag-theme-light td,
    html.emag-theme-light th { border-bottom-color: var(--border) !important; }
    html.emag-theme-light tr:hover td { background: #f8fafc !important; }
    html.emag-theme-light .bg-grid {
      background-image:
        linear-gradient(rgba(79,110,247,0.075) 1px, transparent 1px),
        linear-gradient(90deg, rgba(79,110,247,0.075) 1px, transparent 1px) !important;
    }
    html.emag-theme-light .bg-spotlight {
      background: radial-gradient(circle 420px at var(--sx, 50%) var(--sy, 20%), rgba(79,110,247,0.10), transparent 62%) !important;
    }

    html.emag-focus-mode .bg-grid,
    html.emag-focus-mode .bg-orb,
    html.emag-focus-mode .bg-particle,
    html.emag-focus-mode .bg-spotlight {
      opacity: 0.16 !important;
      filter: saturate(0.45) !important;
    }
    html.emag-focus-mode #minigame-container { display: none !important; }
    html.emag-focus-mode .portfolio-firework { display: none !important; }
    html.emag-focus-mode .card:hover,
    html.emag-focus-mode .module-card:hover,
    html.emag-focus-mode .highlight-card:hover {
      transform: none !important;
    }

    html.emag-pending-focus .badge-pendente,
    html.emag-pending-focus .status-card.pendente {
      border-color: rgba(248,113,113,0.68) !important;
      box-shadow: 0 0 0 1px rgba(248,113,113,0.22), 0 10px 28px rgba(127,29,29,0.20) !important;
    }
    html.emag-pending-focus .badge-pendente {
      background: linear-gradient(135deg, rgba(239,68,68,0.20), rgba(251,146,60,0.12)) !important;
      color: #fecaca !important;
    }
    html.emag-pending-focus .mini-pendente {
      background: linear-gradient(135deg, rgba(239,68,68,0.38), rgba(251,146,60,0.18)) !important;
      border-color: rgba(248,113,113,0.82) !important;
      box-shadow: 0 0 0 1px rgba(239,68,68,0.22), 0 0 12px rgba(239,68,68,0.18) !important;
    }
    html.emag-pending-focus .bar-pendente {
      box-shadow: 0 0 12px rgba(239,68,68,0.32) !important;
    }

    html.emag-motion-reduced *,
    html.emag-motion-reduced *::before,
    html.emag-motion-reduced *::after {
      animation: none !important;
      transition: none !important;
      scroll-behavior: auto !important;
    }
    html.emag-motion-reduced .bg-particle,
    html.emag-motion-reduced .bg-orb,
    html.emag-motion-reduced .portfolio-firework { display: none !important; }

    #auth-badge {
      position: relative;
      flex-shrink: 0;
      margin-right: 14px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    #auth-badge-btn {
      display: flex; align-items: center; justify-content: center;
      background: transparent;
      border: none;
      border-radius: 50%;
      padding: 2px;
      cursor: pointer;
      font-family: inherit;
      transition: transform 0.18s ease, filter 0.18s ease, background 0.2s ease, border-color 0.2s ease;
    }
    #auth-badge-btn:hover { transform: scale(1.06); filter: brightness(1.08); }
    #auth-badge-btn:active { transform: scale(0.97); }
    #auth-badge-btn:focus-visible { outline: 2px solid rgba(159,218,104,0.5); outline-offset: 3px; }
    #auth-badge-btn[aria-expanded="true"] .auth-avatar {
      box-shadow: 0 0 0 2px #0f1117, 0 0 0 4px #9fda68, 0 0 12px rgba(159,218,104,0.55);
    }

    /* variante com nome visível (tela de seleção de módulos) */
    #auth-badge-btn.has-name {
      justify-content: flex-start;
      gap: 10px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(159,218,104,0.22);
      border-radius: 100px;
      padding: 4px 14px 4px 4px;
    }
    #auth-badge-btn.has-name:hover { background: rgba(159,218,104,0.08); border-color: rgba(159,218,104,0.4); transform: none; }
    #auth-badge-btn.has-name:active { transform: none; }

    .auth-avatar {
      width: 34px; height: 34px; border-radius: 50%;
      background: linear-gradient(135deg, #9fda68, #4f6ef7);
      color: #0f1117; font-weight: 800; font-size: 12.5px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; overflow: hidden;
      box-shadow: 0 0 0 2px #0f1117, 0 0 0 4px #9fda68;
      transition: box-shadow 0.2s ease;
    }
    .auth-avatar-img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }

    .auth-name { display: none; }
    #auth-badge-btn.has-name .auth-name {
      display: block;
      font-size: 12.5px; font-weight: 700; color: #e2e8f0;
      max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }


    #auth-dropdown {
      position: absolute; top: calc(100% + 8px); left: 0;
      min-width: 200px;
      background: #1a1d27;
      border: 1px solid #2e3350;
      border-radius: 12px;
      padding: 6px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.45);
      opacity: 0; visibility: hidden; transform: translateY(-6px);
      transition: opacity 0.18s ease, transform 0.18s ease, visibility 0.18s;
      z-index: 9999;
    }
    #auth-dropdown.open { opacity: 1; visibility: visible; transform: translateY(0); }

    .auth-dd-role {
      padding: 10px 10px 8px;
      border: 1px solid rgba(159,218,104,0.16);
      border-radius: 10px;
      background: linear-gradient(135deg, rgba(159,218,104,0.08), rgba(79,110,247,0.05));
      margin-bottom: 8px;
    }
    .auth-dd-role span { display: block; color: #9fda68; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4px; }
    .auth-dd-role small { display: block; color: #94a3b8; font-size: 11px; margin-top: 3px; max-width: 230px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .auth-dd-item {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 10px; border-radius: 8px;
      font-size: 13px; font-weight: 600; color: #e2e8f0;
      cursor: pointer; transition: background 0.15s;
      white-space: nowrap;
    }
    .auth-dd-item:hover { background: rgba(159,218,104,0.1); }
    .auth-dd-item.auth-dd-danger { color: #f87171; }
    .auth-dd-item.auth-dd-danger:hover { background: rgba(239,68,68,0.12); }
    .auth-dd-ico { font-size: 13px; width: 16px; text-align: center; flex-shrink: 0; }
    .auth-dd-sep { height: 1px; background: #2e3350; margin: 6px 4px; }

    .auth-badge-floating {
      position: fixed; top: 14px; left: 16px; z-index: 9999;
      background: rgba(26,29,39,0.92); backdrop-filter: blur(8px);
      border-radius: 100px; box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    }

    #auth-header-wrap {
      display: flex; align-items: center; flex: 1; min-width: 0;
    }

    @media (max-width: 700px) {
      #auth-badge-btn.has-name .auth-name { display: none; }
      #auth-badge-btn.has-name { padding: 2px; border-radius: 50%; }
      #auth-badge { margin-right: 6px; }
    }

    /* ---------- modais ---------- */
    body.auth-modal-lock { overflow: hidden; }
    .auth-modal-overlay {
      position: fixed; inset: 0; z-index: 100000;
      background: rgba(10,11,16,0.72);
      backdrop-filter: blur(3px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      opacity: 0; visibility: hidden;
      transition: opacity 0.22s ease, visibility 0.22s;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .auth-modal-overlay.open { opacity: 1; visibility: visible; }
    .auth-modal {
      width: 100%; max-width: 440px;
      max-height: 88vh; overflow-y: auto;
      background: #1a1d27;
      border: 1px solid #2e3350;
      border-radius: 18px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.5);
      transform: translateY(14px) scale(0.98);
      transition: transform 0.22s ease;
      color: #e2e8f0;
    }
    .auth-modal-overlay.open .auth-modal { transform: translateY(0) scale(1); }

    .auth-modal-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 22px 16px;
      border-bottom: 1px solid #2e3350;
      position: sticky; top: 0; background: #1a1d27; z-index: 1;
    }
    .auth-modal-head h3 { font-size: 17px; font-weight: 800; letter-spacing: -0.2px; }
    .auth-modal-close {
      background: transparent; border: none; color: #94a3b8;
      font-size: 14px; cursor: pointer; padding: 6px; border-radius: 8px;
      line-height: 1; transition: background 0.15s, color 0.15s;
    }
    .auth-modal-close:hover { background: rgba(239,68,68,0.12); color: #ef4444; }

    .auth-modal-body { padding: 20px 22px 24px; }


    /* Configurações em layout compacto para caber na janela sem rolagem em telas comuns. */
    .auth-settings-modal {
      max-width: 820px;
      max-height: calc(100vh - 32px);
      overflow: hidden;
    }
    .auth-settings-modal .auth-modal-head {
      padding: 14px 18px 12px;
    }
    .auth-settings-modal .auth-modal-body {
      padding: 14px 18px 16px;
    }
    .auth-settings-modal .auth-banner { margin-bottom: 10px; }
    .auth-settings-modal #auth-settings-form {
      display: grid;
      grid-template-columns: minmax(230px, 0.82fr) minmax(330px, 1.18fr);
      gap: 12px;
      align-items: start;
    }
    .auth-settings-modal .auth-settings-group {
      margin-bottom: 0;
      padding: 12px;
    }
    .auth-settings-modal .auth-setting-heading { margin-bottom: 8px; }
    .auth-settings-modal .auth-field { margin-bottom: 8px; }
    .auth-settings-modal .auth-toggle-row {
      padding: 8px 0;
      gap: 12px;
    }
    .auth-settings-modal .auth-toggle-row:first-of-type { padding-top: 0; }
    .auth-settings-modal .auth-toggle-row small {
      font-size: 11px;
      line-height: 1.28;
    }
    .auth-settings-modal .auth-sound-panel {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 8px;
      padding: 10px;
    }
    .auth-settings-modal .auth-sound-panel .auth-field { margin-bottom: 0; }
    .auth-settings-modal .auth-sound-preview {
      grid-column: 1 / -1;
      margin-top: 0;
      padding: 8px 12px;
    }
    .auth-settings-modal .auth-modal-actions {
      grid-column: 1 / -1;
      margin-top: 0;
      padding-top: 2px;
      flex-wrap: wrap;
    }
    @media (max-height: 720px) and (min-width: 761px) {
      .auth-settings-modal .auth-field-hint,
      .auth-settings-modal .auth-toggle-row small { display: none; }
      .auth-settings-modal .auth-toggle-row { padding: 6px 0; }
      .auth-settings-modal .auth-sound-panel {
        grid-template-columns: minmax(160px, 1fr) minmax(180px, 1fr) auto;
        align-items: end;
      }
      .auth-settings-modal .auth-sound-preview {
        grid-column: auto;
        white-space: nowrap;
      }
    }
    @media (max-width: 760px) {
      .auth-settings-modal {
        max-width: 440px;
        overflow-y: auto;
      }
      .auth-settings-modal #auth-settings-form { display: block; }
      .auth-settings-modal .auth-settings-group { margin-bottom: 14px; }
      .auth-settings-modal .auth-sound-panel { display: block; }
      .auth-settings-modal .auth-sound-panel .auth-field { margin-bottom: 14px; }
    }

    .auth-banner {
      display: none; align-items: center; gap: 8px;
      font-size: 12.5px; font-weight: 600; border-radius: 10px;
      padding: 10px 12px; margin-bottom: 14px;
    }
    .auth-banner.show { display: flex; }
    .auth-banner.error { background: rgba(239,68,68,0.1); color: #fca5a5; border: 1px solid rgba(239,68,68,0.25); }
    .auth-banner.success { background: rgba(159,218,104,0.12); color: #9fda68; border: 1px solid rgba(159,218,104,0.25); }

    .auth-photo-row {
      display: flex; align-items: center; gap: 16px;
      margin-bottom: 22px;
    }
    .auth-photo-preview {
      width: 64px; height: 64px; border-radius: 50%;
      background: linear-gradient(135deg, #9fda68, #4f6ef7);
      color: #0f1117; font-weight: 800; font-size: 20px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; overflow: hidden;
      border: 1px solid #2e3350;
    }
    .auth-photo-actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }

    .auth-btn-secondary {
      background: #22263a; color: #e2e8f0; border: 1px solid #2e3350;
      border-radius: 9px; padding: 8px 14px; font-size: 12.5px; font-weight: 700;
      cursor: pointer; transition: background 0.15s, border-color 0.15s;
    }
    .auth-btn-secondary:hover { background: #2a2f47; border-color: #9fda68; }
    .auth-btn-link-danger {
      background: none; border: none; color: #f87171; font-size: 12px;
      font-weight: 600; cursor: pointer; padding: 2px 4px;
    }
    .auth-btn-link-danger:hover { text-decoration: underline; }

    .auth-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
    .auth-field label { font-size: 12px; font-weight: 600; color: #94a3b8; letter-spacing: 0.2px; }
    .auth-field input {
      width: 100%; background: #1a1d27; border: 1px solid #2e3350;
      border-radius: 10px; padding: 11px 13px; color: #e2e8f0; font-size: 13.5px;
      font-family: inherit; outline: none; transition: border-color 0.2s, background 0.2s;
    }
    .auth-select {
      width: 100%; background: #1a1d27; border: 1px solid #2e3350;
      border-radius: 10px; padding: 11px 38px 11px 13px; color: #e2e8f0; font-size: 13.5px;
      font-family: inherit; outline: none; cursor: pointer;
      appearance: none;
      background-image: linear-gradient(45deg, transparent 50%, #94a3b8 50%), linear-gradient(135deg, #94a3b8 50%, transparent 50%);
      background-position: calc(100% - 18px) calc(50% - 2px), calc(100% - 13px) calc(50% - 2px);
      background-size: 5px 5px, 5px 5px;
      background-repeat: no-repeat;
      transition: border-color 0.2s, background-color 0.2s;
    }
    .auth-field input:focus { border-color: #9fda68; background: #22263a; }
    .auth-select:focus { border-color: #9fda68; background-color: #22263a; }
    .auth-field input.auth-err { border-color: #ef4444; }
    .auth-field input:disabled { color: #64748b; cursor: not-allowed; opacity: 0.75; }
    .auth-field-err { font-size: 11.5px; color: #ef4444; min-height: 14px; }
    .auth-field-hint { font-size: 11px; color: #64748b; }

    .auth-settings-group {
      border: 1px solid #2e3350;
      background: rgba(255,255,255,0.02);
      border-radius: 14px;
      padding: 14px;
      margin-bottom: 14px;
    }
    .auth-setting-heading {
      font-size: 11px; font-weight: 800; letter-spacing: 0.55px; text-transform: uppercase;
      color: #9fda68; margin-bottom: 12px;
    }
    .auth-toggle-row {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 12px 0;
      border-top: 1px solid rgba(46,51,80,0.78);
      cursor: pointer;
    }
    .auth-toggle-row:first-of-type { border-top: 0; padding-top: 2px; }
    .auth-toggle-row span { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .auth-toggle-row b { color: #e2e8f0; font-size: 13px; }
    .auth-toggle-row small { color: #64748b; font-size: 11.5px; line-height: 1.45; }
    .auth-sound-panel {
      margin-top: 12px;
      padding: 12px;
      border: 1px solid rgba(159,218,104,0.18);
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(159,218,104,0.06), rgba(79,110,247,0.05));
    }
    .auth-range-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .auth-range-head span {
      color: #9fda68;
      font-size: 11px;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }
    .auth-range {
      appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 999px;
      background: linear-gradient(90deg, #9fda68, #4f6ef7);
      outline: none;
      cursor: pointer;
    }
    .auth-range::-webkit-slider-thumb {
      appearance: none;
      width: 18px; height: 18px; border-radius: 50%;
      background: #e2e8f0;
      border: 3px solid #9fda68;
      box-shadow: 0 3px 12px rgba(0,0,0,0.28);
      cursor: pointer;
    }
    .auth-range::-moz-range-thumb {
      width: 18px; height: 18px; border-radius: 50%;
      background: #e2e8f0;
      border: 3px solid #9fda68;
      box-shadow: 0 3px 12px rgba(0,0,0,0.28);
      cursor: pointer;
    }
    .auth-sound-preview {
      width: 100%;
      justify-content: center;
      margin-top: 2px;
    }
    .auth-switch {
      appearance: none;
      width: 44px; height: 24px;
      border-radius: 999px;
      background: #2e3350;
      border: 1px solid rgba(148,163,184,0.18);
      position: relative;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.2s, border-color 0.2s;
    }
    .auth-switch::before {
      content: '';
      position: absolute;
      width: 18px; height: 18px;
      border-radius: 50%;
      background: #94a3b8;
      left: 2px; top: 2px;
      transition: transform 0.2s, background 0.2s;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    }
    .auth-switch:checked {
      background: rgba(159,218,104,0.28);
      border-color: rgba(159,218,104,0.55);
    }
    .auth-switch:checked::before {
      transform: translateX(20px);
      background: #9fda68;
    }
    .auth-switch:focus-visible {
      outline: 2px solid rgba(159,218,104,0.45);
      outline-offset: 3px;
    }

    .auth-divider-label {
      font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
      color: #64748b; margin: 18px 0 12px;
      padding-top: 14px; border-top: 1px solid #2e3350;
    }

    .auth-modal-actions {
      display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px;
    }
    .auth-btn-primary {
      background: #9fda68; color: #0f1117; border: none;
      border-radius: 10px; padding: 10px 18px; font-size: 13px; font-weight: 800;
      cursor: pointer; transition: filter 0.2s, transform 0.15s;
      display: flex; align-items: center; gap: 8px;
    }
    .auth-btn-primary:hover { filter: brightness(1.08); transform: translateY(-1px); }
    .auth-btn-primary:disabled { opacity: 0.65; cursor: default; transform: none; }
    .auth-spinner {
      width: 13px; height: 13px; border-radius: 50%;
      border: 2px solid rgba(15,17,23,0.25); border-top-color: #0f1117;
      animation: authspin 0.7s linear infinite; display: none;
    }
    .auth-btn-primary.loading .auth-spinner { display: inline-block; }
    .auth-btn-primary.loading .auth-btn-label { display: none; }
    @keyframes authspin { to { transform: rotate(360deg); } }

    .auth-about-brand { margin-bottom: 14px; }
    .auth-about-emag {
      font-size: 22px; font-weight: 800; color: #9fda68;
      letter-spacing: 3px; text-shadow: 0 0 18px rgba(159,218,104,0.35);
      line-height: 1.1;
    }
    .auth-about-sub {
      font-size: 9px; color: rgba(159,218,104,0.55);
      letter-spacing: 3px; font-weight: 600; text-transform: uppercase;
    }
    .auth-about-text { font-size: 13.5px; line-height: 1.65; color: #94a3b8; margin-bottom: 20px; }
    .auth-about-text b { color: #e2e8f0; }

    .auth-about-modules { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
    .auth-about-module {
      display: flex; align-items: flex-start; gap: 12px;
      padding: 12px; border: 1px solid #2e3350; border-radius: 12px;
      background: rgba(255,255,255,0.02);
    }
    .auth-about-ico { font-size: 18px; flex-shrink: 0; }
    .auth-about-module b { font-size: 13px; display: block; margin-bottom: 3px; }
    .auth-about-module p { font-size: 12px; color: #94a3b8; line-height: 1.5; }

    .auth-about-foot {
      display: flex; align-items: center; justify-content: space-between;
      padding-top: 14px; border-top: 1px solid #2e3350;
      font-size: 11px; color: #64748b;
    }
    .auth-about-version {
      background: rgba(159,218,104,0.12); color: #9fda68;
      padding: 3px 9px; border-radius: 100px; font-weight: 700; font-size: 10px;
    }

    /* ---------- telinha de ajuste de foto (crop/zoom) ---------- */
    .auth-crop-modal { max-width: 380px; }
    .auth-crop-stage {
      width: 260px; height: 260px; margin: 4px auto 18px;
      border-radius: 50%; overflow: hidden;
      background: repeating-conic-gradient(#22263a 0% 25%, #1a1d27 0% 50%) 50% / 20px 20px;
      border: 1px solid #2e3350;
      box-shadow: 0 0 0 4px rgba(159,218,104,0.12);
      cursor: grab;
    }
    .auth-crop-stage.dragging { cursor: grabbing; }
    .auth-crop-stage canvas { display: block; touch-action: none; user-select: none; }
    .auth-crop-controls {
      display: flex; align-items: center; gap: 12px;
      max-width: 260px; margin: 0 auto 10px;
    }
    .auth-crop-ico { font-size: 13px; color: #94a3b8; flex-shrink: 0; user-select: none; }
    .auth-crop-controls input[type="range"] {
      flex: 1; appearance: none; height: 4px; border-radius: 4px;
      background: #2e3350; outline: none; cursor: pointer;
    }
    .auth-crop-controls input[type="range"]::-webkit-slider-thumb {
      appearance: none; width: 16px; height: 16px; border-radius: 50%;
      background: #9fda68; cursor: pointer; border: 2px solid #0f1117;
      box-shadow: 0 0 0 1px rgba(159,218,104,0.4);
    }
    .auth-crop-controls input[type="range"]::-moz-range-thumb {
      width: 16px; height: 16px; border-radius: 50%;
      background: #9fda68; cursor: pointer; border: 2px solid #0f1117;
    }
    .auth-crop-hint {
      text-align: center; font-size: 11.5px; color: #64748b;
      max-width: 260px; margin: 0 auto 4px; line-height: 1.5;
    }

    html.emag-theme-light #auth-badge-btn.has-name {
      background: rgba(255,255,255,0.78);
      border-color: rgba(79,110,247,0.18);
    }
    html.emag-theme-light #auth-badge-btn.has-name:hover {
      background: rgba(79,110,247,0.08);
      border-color: rgba(79,110,247,0.28);
    }
    html.emag-theme-light #auth-badge-btn.has-name .auth-name { color: #172033; }
    html.emag-theme-light .auth-avatar {
      box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #9fda68;
    }
    html.emag-theme-light #auth-dropdown,
    html.emag-theme-light .auth-modal {
      background: #ffffff;
      border-color: #d8e0ec;
      color: #172033;
      box-shadow: 0 24px 60px rgba(15,23,42,0.18);
    }
    html.emag-theme-light .auth-modal-head {
      background: #ffffff;
      border-bottom-color: #d8e0ec;
    }
    html.emag-theme-light .auth-dd-item,
    html.emag-theme-light .auth-modal-head h3,
    html.emag-theme-light .auth-toggle-row b,
    html.emag-theme-light .auth-about-text b {
      color: #172033;
    }
    html.emag-theme-light .auth-dd-role {
      background: #f8fafc;
      border-color: #d8e0ec;
    }
    html.emag-theme-light .auth-dd-role small { color: #64748b; }
    html.emag-theme-light .auth-dd-item:hover { background: rgba(79,110,247,0.08); }
    html.emag-theme-light .auth-dd-sep,
    html.emag-theme-light .auth-divider-label,
    html.emag-theme-light .auth-toggle-row {
      border-color: #d8e0ec;
      background-color: transparent;
    }
    html.emag-theme-light .auth-field input,
    html.emag-theme-light .auth-select,
    html.emag-theme-light .auth-btn-secondary,
    html.emag-theme-light .auth-settings-group,
    html.emag-theme-light .auth-sound-panel,
    html.emag-theme-light .auth-about-module {
      background-color: #f8fafc;
      border-color: #d8e0ec;
      color: #172033;
    }
    html.emag-theme-light .auth-field input:focus,
    html.emag-theme-light .auth-select:focus,
    html.emag-theme-light .auth-btn-secondary:hover {
      background-color: #eef3f8;
      border-color: #4f6ef7;
    }
    html.emag-theme-light .auth-photo-preview,
    html.emag-theme-light .auth-crop-stage {
      border-color: #d8e0ec;
    }
    html.emag-theme-light .auth-about-text,
    html.emag-theme-light .auth-about-module p,
    html.emag-theme-light .auth-toggle-row small,
    html.emag-theme-light .auth-field label {
      color: #64748b;
    }
    html.emag-theme-light.emag-pending-focus .badge-pendente {
      color: #991b1b !important;
      background: linear-gradient(135deg, rgba(239,68,68,0.16), rgba(251,146,60,0.12)) !important;
    }
  `;
  document.head.appendChild(style);
}

/* Efeito suave de entrada da página (fade + leve deslocamento).
   O elemento <body> deve iniciar com opacidade 0 (ver bloco de
   proteção no <head> de cada página) para não haver "flash" antes
   da transição rodar. */
function authFadeIn() {
  authApplyClientBranding();
  authMountPreviewExitButton();
  requestAnimationFrame(() => {
    document.body.style.transition = 'opacity 0.45s ease';
    document.body.style.opacity = '1';
  });
}

/* --------- confirmação visual para ações importantes --------- */
function authEnsureChangeConfirmStyles() {
  if (document.getElementById('auth-change-confirm-styles')) return;
  const style = document.createElement('style');
  style.id = 'auth-change-confirm-styles';
  style.textContent = `
    .auth-change-confirm-overlay {
      position: fixed;
      inset: 0;
      z-index: 7000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
      background: rgba(3, 7, 18, 0.74);
      backdrop-filter: blur(9px);
      animation: authConfirmFadeIn 160ms ease-out;
    }
    .auth-change-confirm-card {
      width: min(460px, 100%);
      background: linear-gradient(180deg, #1a1d27, #141824);
      border: 1px solid rgba(159, 218, 104, 0.26);
      border-radius: 20px;
      box-shadow: 0 26px 90px rgba(0, 0, 0, 0.52), 0 0 0 1px rgba(255,255,255,0.03) inset;
      color: #e2e8f0;
      overflow: hidden;
      transform: translateY(0);
      animation: authConfirmPop 180ms ease-out;
    }
    .auth-change-confirm-top {
      padding: 18px 18px 14px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      display: flex;
      gap: 12px;
      align-items: flex-start;
    }
    .auth-change-confirm-icon {
      width: 38px;
      height: 38px;
      flex: 0 0 38px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      background: rgba(159, 218, 104, 0.14);
      border: 1px solid rgba(159, 218, 104, 0.36);
      color: #bef264;
      font-weight: 900;
      font-size: 18px;
    }
    .auth-change-confirm-card.danger .auth-change-confirm-icon {
      background: rgba(239,68,68,0.13);
      border-color: rgba(239,68,68,0.34);
      color: #fca5a5;
    }
    .auth-change-confirm-card.warning .auth-change-confirm-icon {
      background: rgba(245,158,11,0.13);
      border-color: rgba(245,158,11,0.34);
      color: #fcd34d;
    }
    .auth-change-confirm-title {
      font-size: 17px;
      font-weight: 900;
      letter-spacing: -0.2px;
      margin: 0 0 5px;
    }
    .auth-change-confirm-message {
      color: #94a3b8;
      font-size: 13px;
      line-height: 1.45;
      margin: 0;
    }
    .auth-change-confirm-body { padding: 14px 18px 18px; }
    .auth-change-confirm-detail {
      border: 1px solid rgba(148,163,184,0.18);
      background: rgba(255,255,255,0.035);
      border-radius: 13px;
      padding: 11px 12px;
      color: #cbd5e1;
      font-size: 12.5px;
      line-height: 1.45;
      margin-bottom: 14px;
      white-space: pre-wrap;
    }
    .auth-change-confirm-actions { display: flex; justify-content: flex-end; gap: 10px; }
    .auth-change-confirm-ok {
      border: 0;
      border-radius: 11px;
      padding: 10px 16px;
      font-weight: 900;
      cursor: pointer;
      color: #0f1117;
      background: #9fda68;
      transition: filter 0.2s, transform 0.15s;
      font-family: inherit;
    }
    .auth-change-confirm-ok:hover { filter: brightness(1.08); transform: translateY(-1px); }
    html.emag-theme-light .auth-change-confirm-card {
      background: #ffffff;
      color: #172033;
      border-color: #d8e0ec;
      box-shadow: 0 26px 70px rgba(15,23,42,0.20);
    }
    html.emag-theme-light .auth-change-confirm-top { border-bottom-color: #d8e0ec; }
    html.emag-theme-light .auth-change-confirm-message { color: #64748b; }
    html.emag-theme-light .auth-change-confirm-detail { background: #f8fafc; border-color: #d8e0ec; color: #334155; }
    @keyframes authConfirmFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes authConfirmPop { from { opacity: 0; transform: translateY(10px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
  `;
  document.head.appendChild(style);
}

function authShowChangeConfirmation(options) {
  const opts = options || {};
  authEnsureChangeConfirmStyles();
  const old = document.getElementById('auth-change-confirm-overlay');
  if (old) old.remove();
  const overlay = document.createElement('div');
  overlay.className = 'auth-change-confirm-overlay';
  overlay.id = 'auth-change-confirm-overlay';
  const type = ['success', 'warning', 'danger'].includes(opts.type) ? opts.type : 'success';
  const icon = type === 'danger' ? '!' : (type === 'warning' ? 'i' : '✓');
  overlay.innerHTML = `
    <div class="auth-change-confirm-card ${type}" role="dialog" aria-modal="true" aria-labelledby="auth-change-confirm-title">
      <div class="auth-change-confirm-top">
        <div class="auth-change-confirm-icon">${icon}</div>
        <div>
          <h3 class="auth-change-confirm-title" id="auth-change-confirm-title">${authEscape(opts.title || 'Alteração confirmada')}</h3>
          <p class="auth-change-confirm-message">${authEscape(opts.message || 'A operação foi registrada com sucesso.')}</p>
        </div>
      </div>
      <div class="auth-change-confirm-body">
        ${opts.detail ? `<div class="auth-change-confirm-detail">${authEscape(opts.detail)}</div>` : ''}
        <div class="auth-change-confirm-actions"><button type="button" class="auth-change-confirm-ok">Entendi</button></div>
      </div>
    </div>
  `;
  function close() {
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) { if (e.key === 'Escape' || e.key === 'Enter') close(); }
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('.auth-change-confirm-ok').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  setTimeout(() => overlay.querySelector('.auth-change-confirm-ok')?.focus(), 40);
}
