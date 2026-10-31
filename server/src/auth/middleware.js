import { unauthorized } from '../lib/errors.js';
import { findSessionUser } from './service.js';

/**
 * 每个 /api 请求都尝试识别当前用户：
 * 1. 优先读 Authorization: Bearer <token>（方便分离部署 / App 调用）
 * 2. 其次读 HttpOnly Cookie（网页默认走这条）
 * 未登录时 req.auth 为 null，不报错。
 */
export function createAttachAuth({ db, cookieName }) {
  return function attachAuth(req, res, next) {
    let token = null;

    const header = req.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      token = header.slice('Bearer '.length).trim();
    } else if (req.cookies && typeof req.cookies[cookieName] === 'string') {
      token = req.cookies[cookieName];
    }

    const found = token ? findSessionUser(db, token) : null;
    req.auth = found ? { ...found, token } : null;
    next();
  };
}

/** 需要登录的路由在 handler 前加上这个中间件。 */
export function requireAuth(req, res, next) {
  if (!req.auth?.user) throw unauthorized();
  next();
}
