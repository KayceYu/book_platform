const configuredBase = (import.meta.env?.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
export const isPagesBuild = import.meta.env?.MODE === 'pages';
export const apiBaseUrl = configuredBase;
export const assetUrl = path => (import.meta.env?.BASE_URL || '/') + path.replace(/^\/+/, '');
const identityKey = 'cougeju-member';
let selectedMember = null;
try { selectedMember = localStorage.getItem(identityKey); } catch {}

export async function apiRequest(path, options = {}) {
  if (isPagesBuild && !apiBaseUrl) throw new Error('共享服务尚未连接，请联系网站管理员配置后重试。');
  const headers = new Headers(options.headers);
  if (apiBaseUrl && selectedMember) headers.set('X-Member-Id', selectedMember);
  const response = await fetch(apiBaseUrl + path, {
    ...options,
    headers,
    credentials: apiBaseUrl ? 'omit' : 'same-origin',
    signal: options.signal || AbortSignal.timeout(15000),
  });
  if (apiBaseUrl && path === '/api/identity' && response.ok) {
    const next = JSON.parse(options.body || '{}').memberId || null;
    selectedMember = next;
    try { if (next) localStorage.setItem(identityKey, next); else localStorage.removeItem(identityKey); } catch {}
  }
  return response;
}
