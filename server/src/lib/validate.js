import { badRequest } from './errors.js';

// 常见邮箱格式校验。真正的“这个邮箱是否存在”只能靠发验证邮件确认。
const EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** 邮箱统一转小写并校验，保证 A@x.com 和 a@x.com 是同一个账号。 */
export function normalizeEmail(input) {
  if (typeof input !== 'string') {
    throw badRequest('Email is required.', 'invalid_email');
  }
  const email = input.trim().toLowerCase();
  const localPart = email.split('@')[0] ?? '';
  if (!email || email.length > 254 || localPart.length > 64 || !EMAIL_RE.test(email)) {
    throw badRequest('Please enter a valid email address.', 'invalid_email');
  }
  return email;
}

/** 新密码校验（注册、改密码共用）。 */
export function normalizeNewPassword(input, fieldName = 'password') {
  if (typeof input !== 'string') {
    throw badRequest('Password is required.', 'invalid_password');
  }
  if (input.length < PASSWORD_MIN_LENGTH) {
    throw badRequest(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`, 'invalid_password');
  }
  if (input.length > PASSWORD_MAX_LENGTH) {
    throw badRequest(`Password must be at most ${PASSWORD_MAX_LENGTH} characters.`, 'invalid_password');
  }
  if (input.trim().length === 0) {
    throw badRequest('Password cannot be blank.', 'invalid_password');
  }
  if (input.includes('\u0000')) {
    throw badRequest('Password contains unsupported characters.', 'invalid_password');
  }
  // 这里只是给密码校验失败一个稳定的字段名，方便前端定位是哪个输入框
  void fieldName;
  return input;
}

/** 显示名可选：不填返回 null。 */
export function normalizeDisplayName(input) {
  if (input === undefined || input === null) return null;
  if (typeof input !== 'string') {
    throw badRequest('Display name must be text.', 'invalid_display_name');
  }
  // 去掉控制字符，压缩连续空白
  const cleaned = input
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length === 0) return null;
  if (cleaned.length > 50) {
    throw badRequest('Display name must be at most 50 characters.', 'invalid_display_name');
  }
  return cleaned;
}

/** 注册 / 登录的请求体必须是 JSON 对象。 */
export function readJsonObject(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Request body must be a JSON object.', 'invalid_body');
  }
  return body;
}
