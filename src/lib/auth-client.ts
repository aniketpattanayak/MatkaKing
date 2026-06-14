// ─── Types ────────────────────────────────────────────────────────────────────
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  balance: number;
  referralCode?: string;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────
let _token: string | null = undefined as any;
let _user:  SessionUser | null = null;
let _fetchPromise: Promise<SessionUser | null> | null = null;

// ─── Token helpers ────────────────────────────────────────────────────────────
export function getToken(): string | null {
  if (_token !== undefined) return _token;
  _token = typeof window !== 'undefined'
    ? localStorage.getItem('sge_token')
    : null;
  return _token;
}

export function setToken(t: string) {
  _token = t;
  localStorage.setItem('sge_token', t);
}

export function clearToken() {
  _token = null;
  _user  = null;
  _fetchPromise = null;
  localStorage.removeItem('sge_token');
  localStorage.removeItem('sge_user');
}

// ─── User cache helpers ───────────────────────────────────────────────────────
export function getCachedUser(): SessionUser | null {
  if (_user) return _user;
  try {
    const raw = localStorage.getItem('sge_user');
    if (!raw) return null;
    _user = JSON.parse(raw) as SessionUser;
    return _user;
  } catch { return null; }
}

export function setCachedUser(u: SessionUser) {
  _user = u;
  localStorage.setItem('sge_user', JSON.stringify(u));
  // Broadcast so any component (e.g. Header) can react to the fresh balance
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kh-balance-update', { detail: u }));
  }
}

// ─── Auth fetch ───────────────────────────────────────────────────────────────
export function authFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers });
}

// ─── fetchCurrentUser — deduplicates concurrent calls but ALWAYS fetches fresh
// (does NOT short-circuit on _user so balance is always up-to-date)
export function fetchCurrentUser(): Promise<SessionUser | null> {
  if (!getToken()) return Promise.resolve(null);

  // If a fetch is already in-flight, return the same promise (no duplicate requests)
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = authFetch('/api/auth/me')
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      _fetchPromise = null;
      if (!d?.user) return null;
      setCachedUser(d.user);  // this also fires the kh-balance-update event
      return d.user as SessionUser;
    })
    .catch(() => { _fetchPromise = null; return null; });

  return _fetchPromise;
}

// ─── refreshBalance — force fresh fetch even if one just completed
// Call this after any action that changes balance (bet, spin, deposit)
export function refreshBalance(): Promise<SessionUser | null> {
  _fetchPromise = null; // clear any cached promise so we always go to network
  return fetchCurrentUser();
}
