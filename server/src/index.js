import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = createApp(config);

const server = app.listen(config.port, config.host, () => {
  console.log(`IYS auth server listening on http://${config.host}:${config.port}`);
  console.log(`SQLite database: ${config.databasePath}`);
  if (config.serveStatic) {
    console.log(`Static site: ${config.publicDir}`);
  }
  console.log('API: GET /api/health | POST /api/auth/register | POST /api/auth/login');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`端口 ${config.port} 已被占用。改一个端口：PORT=3001 npm start`);
  } else {
    console.error('[iys] Failed to start server:', error);
  }
  process.exitCode = 1;
});

let closing = false;
function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`\nReceived ${signal}, shutting down...`);

  server.close(() => {
    app.locals.close();
    process.exit(0);
  });

  // 有长连接卡住时最多等 5 秒
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
