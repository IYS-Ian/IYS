/**
 * 统一的 HTTP 错误类型：路由里直接 throw，由 app.js 的错误中间件转成 JSON。
 */
export class HttpError extends Error {
  constructor(status, code, message, { headers } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.headers = headers;
  }
}

export function badRequest(message = 'Invalid request.', code = 'invalid_request') {
  return new HttpError(400, code, message);
}

export function unauthorized(message = 'Authentication required.', code = 'not_authenticated') {
  return new HttpError(401, code, message);
}

export function forbidden(message = 'Request blocked.', code = 'forbidden') {
  return new HttpError(403, code, message);
}

export function conflict(message = 'Resource already exists.', code = 'conflict') {
  return new HttpError(409, code, message);
}

export function tooManyRequests(retryAfterSeconds, message = 'Too many attempts. Please try again later.') {
  return new HttpError(429, 'too_many_requests', message, {
    headers: { 'Retry-After': String(Math.max(1, Math.ceil(retryAfterSeconds))) },
  });
}
