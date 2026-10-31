import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

/**
 * scrypt 参数。N 越大越慢、越难被暴力破解。
 * 当前配置在普通笔记本上单次约 50~100ms，登录体验和安全性比较平衡。
 * 修改参数不会让旧密码失效：每个哈希都自带自己的参数。
 */
const PARAMS = Object.freeze({ N: 32768, r: 8, p: 1, keylen: 64 });
const MAXMEM = 128 * 1024 * 1024;

function derive(password, salt, { N, r, p, keylen }) {
  return scrypt(password, salt, keylen, { N, r, p, maxmem: MAXMEM });
}

/** 生成 "scrypt$N$r$p$salt$hash" 格式的字符串，直接存数据库。 */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, PARAMS);
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$');
}

/** 用数据库里的哈希校验密码，全程常量时间比较。 */
export async function verifyPassword(password, encoded) {
  if (typeof encoded !== 'string') return false;
  const parts = encoded.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');

  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (N < 1024 || N > 2 ** 20 || r < 1 || r > 32 || p < 1 || p > 16) return false;
  if (salt.length < 8 || expected.length < 16) return false;

  let actual;
  try {
    actual = await derive(password, salt, { N, r, p, keylen: expected.length });
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * 账号不存在时也跑一次 scrypt，避免攻击者通过响应时间判断邮箱是否注册过。
 */
let dummyHashPromise;
export async function verifyAgainstDummyHash(password) {
  dummyHashPromise ??= hashPassword(randomBytes(32).toString('hex'));
  await verifyPassword(password, await dummyHashPromise);
  return false;
}
