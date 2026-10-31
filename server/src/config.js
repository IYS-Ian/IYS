import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

const VALID_SAME_SITE = new Set(['lax', 'strict', 'none']);
const VALID_ENVS = new Set(['development', 'production', 'test']);

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`环境变量 ${name} 必须是正整数，当前值是 "${raw}"`);
  }
  return value;
}

function envBool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.trim().toLowerCase());
}

function envList(name) {
  const raw = process.env[name];
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function envTrustProxy() {
  const raw = process.env.TRUST_PROXY;
  if (!raw) return false;
  if (raw === 'true') return 1;
  if (raw === 'false') return false;
  const hops = Number.parseInt(raw, 10);
  return Number.isFinite(hops) ? hops : false;
}

function deepMerge(base, overrides) {
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(overrides ?? {})) {
    const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * 读取环境变量生成配置。测试可以传入 overrides 覆盖任意字段。
 * 所有可配置项见 .env.example。
 */
export function loadConfig(overrides = {}) {
  const env = process.env.NODE_ENV || 'development';
  if (!VALID_ENVS.has(env)) {
    throw new Error(`NODE_ENV 只能是 development / production / test，当前是 "${env}"`);
  }

  const cookieSecure = envBool('COOKIE_SECURE', env === 'production');
  const cookieSameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  if (!VALID_SAME_SITE.has(cookieSameSite)) {
    throw new Error('COOKIE_SAMESITE 只能是 lax / strict / none');
  }
  if (cookieSameSite === 'none' && !cookieSecure) {
    throw new Error('COOKIE_SAMESITE=none 要求 COOKIE_SECURE=true（浏览器只接受 Secure 的跨站 Cookie）');
  }

  const base = {
    env,
    host: process.env.HOST || '127.0.0.1',
    port: envInt('PORT', 3000),

    // 数据库文件；测试里会覆盖成临时文件
    databasePath: process.env.DATABASE_PATH
      ? path.resolve(process.env.DATABASE_PATH)
      : path.join(SERVER_ROOT, 'data', 'iys.db'),

    // 静态站点（就是项目根目录里的 HTML/CSS/图片）。设为 false 可关闭。
    serveStatic: envBool('SERVE_STATIC', true),
    publicDir: process.env.PUBLIC_DIR
      ? path.resolve(process.env.PUBLIC_DIR)
      : PROJECT_ROOT,
    // 静态目录里不希望被直接下载的路径（后端源码、依赖、数据）
    blockedPathPrefixes: ['/server', '/node_modules', '/.git'],

    // 反向代理（Nginx / Render / Railway 等）后面部署时设为 1
    trustProxy: envTrustProxy(),

    // 允许跨域携带 Cookie 的前端地址；同源请求不需要配置
    allowedOrigins: envList('ALLOWED_ORIGINS'),

    cookie: {
      name: process.env.SESSION_COOKIE_NAME || 'iys_session',
      secure: cookieSecure,
      sameSite: cookieSameSite,
      sessionTtlMs: envInt('SESSION_TTL_HOURS', 12) * 60 * 60 * 1000,
      rememberTtlMs: envInt('REMEMBER_TTL_DAYS', 30) * 24 * 60 * 60 * 1000,
    },

    rateLimits: {
      // 学校/公司共用出口 IP 时多人会共享计数，门槛别设得太死
      register: { windowMs: 60 * 60 * 1000, max: 20 },
      loginIp: { windowMs: 15 * 60 * 1000, max: 60 },
      loginEmail: { windowMs: 15 * 60 * 1000, max: 10 },
    },

    // 默认只通过 HttpOnly Cookie 传递会话；纯前端分离部署且无法用 Cookie 时才打开
    exposeTokenInBody: envBool('EXPOSE_TOKEN_IN_BODY', false),

    logErrors: env !== 'test',
  };

  return deepMerge(base, overrides);
}
