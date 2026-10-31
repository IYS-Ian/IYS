import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * 数据库结构版本。以后加字段时不要改这里已有的 SQL，
 * 而是在数组末尾追加一段新的 SQL，服务启动时会自动升级。
 */
const MIGRATIONS = [
  // v1：用户表 + 会话表
  `
  CREATE TABLE users (
    id                TEXT PRIMARY KEY,
    email             TEXT NOT NULL UNIQUE,
    password_hash     TEXT NOT NULL,
    display_name      TEXT,
    email_verified    INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    password_changed_at TEXT NOT NULL
  );

  CREATE TABLE sessions (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at    TEXT NOT NULL,
    expires_at    TEXT NOT NULL,
    last_used_at  TEXT,
    ip            TEXT,
    user_agent    TEXT
  );

  CREATE INDEX idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
  `,
];

function migrate(db) {
  const row = db.prepare('PRAGMA user_version').get();
  const currentVersion = Number(row?.user_version ?? 0);

  if (currentVersion > MIGRATIONS.length) {
    throw new Error(
      `数据库版本是 ${currentVersion}，但代码只认识 ${MIGRATIONS.length} 个版本。请确认没有用旧代码打开新数据库。`,
    );
  }

  for (let version = currentVersion; version < MIGRATIONS.length; version += 1) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(MIGRATIONS[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
}

/** 打开数据库、设置 PRAGMA、执行迁移。 */
export function openDatabase(file) {
  if (file !== ':memory:') {
    mkdirSync(path.dirname(file), { recursive: true });
  }

  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  db.exec('PRAGMA synchronous = NORMAL');
  migrate(db);
  cleanupExpiredSessions(db);
  return db;
}

/** 删除过期会话，避免表越来越大。 */
export function cleanupExpiredSessions(db) {
  const now = new Date().toISOString();
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
}
