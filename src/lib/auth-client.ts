// ─── Types ────────────────────────────────────────────────────────────────────
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'SUPERADMIN';
  balance: number;
  referralCode?: string;
}

// ─── In-memory cache (faster than localStorage on repeat reads) ───────────────
let _token: string | null = undefined as any;
let _user:  SessionUser | null = null;
let _fetchPromise: Promise<SessionUser | null> | null = null; // deduplicate concurrent calls

// ─── Token helpers ────────────────────────────────────────────────────────────
export function getToken(): string | null {
  if (_token !== undefined) return _token;            // in-memory hit — no IO
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
  if (_user) return _user;                           // in-memory hit — no JSON.parse
  try {
    const raw = localStorage.getItem('sge_user');
    if (!raw) return null;
    _user = JSON.parse(raw) as SessionUser;
    return _user;
  } catch { return null; }
}

export function setCachedUser(u: SessionUser) {
  _user = u;                                         // update in-memory ref
  localStorage.setItem('sge_user', JSON.stringify(u));
}

// ─── Optimized fetch — single Authorization header build ─────────────────────
export function authFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const token = getToken();
  // Reuse headers object to avoid repeated spread allocations
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  return fetch(url, { ...opts, headers });
}

// ─── Deduplicated user fetch — concurrent callers share ONE in-flight request ─
export function fetchCurrentUser(): Promise<SessionUser | null> {
  if (!getToken()) return Promise.resolve(null);
  if (_user) return Promise.resolve(_user);          // already have it in memory

  // If a fetch is already in-flight, return the same promise (no duplicate requests)
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = authFetch('/api/auth/me')
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      _fetchPromise = null;
      if (!d?.user) return null;
      setCachedUser(d.user);
      return d.user as SessionUser;
    })
    .catch(() => { _fetchPromise = null; return null; });

  return _fetchPromise;
}
