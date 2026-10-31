import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const LOOSE_LIMITS = {
  register: { windowMs: 60_000, max: 1000 },
  loginIp: { windowMs: 60_000, max: 1000 },
  loginEmail: { windowMs: 60_000, max: 1000 },
};

/**
 * 启动一个监听随机端口的测试服务器，使用临时数据库。
 * 返回 baseUrl / db / close()。
 */
export async function startTestServer(overrides = {}) {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), 'iys-auth-test-'));
  const rateLimits = { ...LOOSE_LIMITS, ...(overrides.rateLimits ?? {}) };

  const config = loadConfig({
    env: 'test',
    databasePath: path.join(dataDir, 'test.db'),
    serveStatic: false,
    logErrors: false,
    ...overrides,
    rateLimits,
  });

  const app = createApp(config);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  return {
    baseUrl,
    config,
    db: app.locals.db,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      app.locals.close();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

/** 带 Cookie 罐的简易客户端，模拟浏览器行为。 */
export function createClient(baseUrl) {
  const cookies = new Map();

  async function request(pathname, { method = 'GET', body, headers = {}, origin } = {}) {
    const requestHeaders = { ...headers };
    if (body !== undefined) requestHeaders['content-type'] = 'application/json';
    if (origin) requestHeaders.origin = origin;
    if (cookies.size > 0) {
      requestHeaders.cookie = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    }

    const response = await fetch(baseUrl + pathname, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    for (const setCookie of response.headers.getSetCookie()) {
      const pair = setCookie.split(';', 1)[0];
      const index = pair.indexOf('=');
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      // 服务端清 Cookie 时会写入空值 + 过期时间
      if (value === '') cookies.delete(name);
      else cookies.set(name, value);
    }

    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }

    return { status: response.status, headers: response.headers, data, text };
  }

  return { request, cookies };
}

export const VALID_PASSWORD = 'correct horse battery';
