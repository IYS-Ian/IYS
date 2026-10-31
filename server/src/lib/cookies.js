/**
 * 解析 Cookie 请求头。Express 的 res.cookie() 负责写，这里只负责读，
 * 因此不需要额外安装 cookie-parser。
 */
export function parseCookieHeader(header) {
  const cookies = Object.create(null);
  if (!header || typeof header !== 'string') return cookies;

  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    let value = part.slice(index + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}
