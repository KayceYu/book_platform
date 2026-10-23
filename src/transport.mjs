const configuredBase = (import.meta.env?.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
export const isPagesBuild = import.meta.env?.MODE === 'pages';
export const apiBaseUrl = configuredBase;
export const requiresAccessCode = import.meta.env?.VITE_REQUIRE_ACCESS_CODE === 'true';
export const assetUrl = path => (import.meta.env?.BASE_URL || '/') + path.replace(/^\/+/, '');
const identityKey = 'cougeju-member';
let selectedMember = null;
let accessToken = null;
try { selectedMember = localStorage.getItem(identityKey); } catch {}
try { accessToken = localStorage.getItem('cougeju-session'); } catch {}

export async function apiRequest(path, options = {}) {
  if (isPagesBuild && !apiBaseUrl) throw new Error('共享服务尚未连接，请联系网站管理员配置后重试。');
  const headers = new Headers(options.headers);
  if (apiBaseUrl && selectedMember) headers.set('X-Member-Id', selectedMember);
  if (apiBaseUrl && accessToken) headers.set('Authorization', 'Bearer '+accessToken);
  const response = await fetch(apiBaseUrl + path, {
    ...options,
    headers,
    credentials: apiBaseUrl ? 'omit' : 'same-origin',
    signal: options.signal || AbortSignal.timeout(15000),
  });
  if (apiBaseUrl && path === '/api/identity' && response.ok) {
    const payload = await response.clone().json();
    const next = payload.memberId || null;
    selectedMember = next;
    accessToken = payload.access_token || null;
    try { if (next) localStorage.setItem(identityKey, next); else localStorage.removeItem(identityKey); } catch {}
    try { if(accessToken)localStorage.setItem('cougeju-session',accessToken);else localStorage.removeItem('cougeju-session'); } catch {}
  }
  return response;
}
