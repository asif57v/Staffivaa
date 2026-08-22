/** Structured push/FCM logs — grep server output with: [Push] */

function formatDetails(details = {}) {
  return Object.entries(details)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join(' | ');
}

export function pushLog(step, details = {}) {
  const extra = formatDetails(details);
  console.log(`[Push] ${step}${extra ? ` | ${extra}` : ''}`);
}

export function pushWarn(step, details = {}) {
  const extra = formatDetails(details);
  console.warn(`[Push] ${step}${extra ? ` | ${extra}` : ''}`);
}

export function tokenPreview(token) {
  if (!token || typeof token !== 'string') return 'none';
  const t = token.trim();
  if (t.length <= 12) return t;
  return `${t.slice(0, 8)}…${t.slice(-6)}`;
}
