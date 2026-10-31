import { existsSync } from 'node:fs';
import express from 'express';
import { createAuthRouter } from './auth/routes.js';
import { createAttachAuth } from './auth/middleware.js';
import { loadConfig } from './config.js';
import { cleanupExpiredSessions, openDatabase } from './db.js';
import { parseCookieHeader } from './lib/cookies.js';
import { HttpError, forbidden } from './lib/errors.js';
import { RateLimiter } from './lib/rate-limit.js';

/** 判断某个 Origin 是否被允许（显式白名单 + 同源）。 */
function isAllowedOrigin(origin, req, config) {
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (config.allowedOrigins.includes(parsed.origin)) return true;
  // 同源请求：只比较 host，协议由反向代理决定，不在这里判断
  return parsed.host === req.headers.host;
}

function securityHeaders(config) {
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    if (config.env === 'production' && config.cookie.secure) {
      res.setHeader('Strict-Transport-Security', 'max-age=15552000');
    }
    next();
  };
}

/**
 * 允许的前端跨域访问（带 Cookie）。同源请求不需要任何配置。
 * 只在 Origin 命中白名单时才回 CORS 头，不给任意网站开口子。
 */
function createCors(config) {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || !isAllowedOrigin(origin, req, config)) return next();

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.vary('Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '600');
      return res.status(204).end();
    }
    return next();
  };
}

/**
 * CSRF 防护：浏览器发起的写操作必须来自同源或白名单 Origin。
 * 配合 SameSite=Lax Cookie 和“只接受 application/json”使用。
 */
function createOriginGuard(config) {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

    const origin = req.headers.origin;
    if (!origin) return next(); // curl、服务端调用不会带 Origin

    if (!isAllowedOrigin(origin, req, config)) {
      throw forbidden('Cross-site request blocked.', 'origin_not_allowed');
    }
    next();
  };
}

/** 不允许静态服务器把后端源码、数据库、依赖暴露出去。 */
function createBlockedPathGuard(prefixes) {
  return (req, res, next) => {
    const blocked = prefixes.some(
      (prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`),
    );
    if (blocked) return res.status(404).type('text/plain').send('Not found');
    next();
  };
}

function createErrorHandler(config) {
  return (err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err instanceof HttpError) {
      if (err.headers) {
        for (const [name, value] of Object.entries(err.headers)) res.setHeader(name, value);
      }
      return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    }

    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({
        error: { code: 'invalid_json', message: 'Request body must be valid JSON.' },
      });
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({
        error: { code: 'payload_too_large', message: 'Request body is too large.' },
      });
    }
    if (err?.type === 'encoding.unsupported' || err?.type === 'charset.unsupported') {
      return res.status(415).json({
        error: { code: 'unsupported_encoding', message: 'Unsupported request encoding.' },
      });
    }

    if (config.logErrors) console.error('[iys] Unhandled error:', err);
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Something went wrong.' },
    });
  };
}

/**
 * 组装 Express 应用（不监听端口，方便测试直接调用）。
 */
export function createApp(config = loadConfig()) {
  const db = openDatabase(config.databasePath);

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.locals.config = config;
  app.locals.db = db;

  const limiters = {
    register: new RateLimiter(config.rateLimits.register),
    loginIp: new RateLimiter(config.rateLimits.loginIp),
    loginEmail: new RateLimiter(config.rateLimits.loginEmail),
  };

  app.use(securityHeaders(config));
  app.use(createCors(config));
  app.use((req, res, next) => {
    req.cookies = parseCookieHeader(req.headers.cookie);
    next();
  });

  app.use('/api', createOriginGuard(config));
  app.use('/api', express.json({ limit: '10kb', type: ['application/json'] }));
  app.use('/api', createAttachAuth({ db, cookieName: config.cookie.name }));

  app.get('/api/health', (req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.use('/api/auth', createAuthRouter({ db, config, limiters }));

  // 未匹配的 /api 路径统一返回 JSON，而不是 Express 默认的 HTML
  app.use('/api', (req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Unknown API endpoint.' } });
  });

  // 可选：顺便把项目根目录的静态页面也托管起来，前后端同源，Cookie 最省事
  if (config.serveStatic && existsSync(config.publicDir)) {
    app.use(createBlockedPathGuard(config.blockedPathPrefixes));
    app.use(
      express.static(config.publicDir, {
        index: 'index.html',
        dotfiles: 'ignore',
        setHeaders(res) {
          res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
  }

  app.use((req, res) => {
    res.status(404).type('text/plain').send('Not found');
  });

  app.use(createErrorHandler(config));

  // 每小时清理一次过期会话（unref：不阻止进程退出）
  const cleanupTimer = setInterval(() => cleanupExpiredSessions(db), 60 * 60 * 1000);
  cleanupTimer.unref();

  app.locals.close = () => {
    clearInterval(cleanupTimer);
    try {
      db.close();
    } catch {
      // 已关闭时忽略
    }
  };

  return app;
}
