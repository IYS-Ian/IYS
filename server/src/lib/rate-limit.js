/**
 * 进程内的固定窗口限流器。
 *
 * 说明：计数存在内存里，适合单实例部署。如果以后要做多实例负载均衡，
 * 需要换成 Redis 之类的共享存储。
 */
export class RateLimiter {
  #windowMs;
  #max;
  #buckets = new Map();

  constructor({ windowMs, max }) {
    if (!(windowMs > 0) || !(max > 0)) throw new Error('RateLimiter 参数不合法');
    this.#windowMs = windowMs;
    this.#max = max;
  }

  #bucket(key, now) {
    let bucket = this.#buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + this.#windowMs };
      this.#buckets.set(key, bucket);
    }
    return bucket;
  }

  #result(bucket, now) {
    return {
      ok: bucket.count <= this.#max,
      remaining: Math.max(0, this.#max - bucket.count),
      retryAfterSeconds: Math.max(0, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  /** 只查看状态，不计数。 */
  check(key) {
    return this.#result(this.#bucket(key, Date.now()), Date.now());
  }

  /** 记一次尝试。 */
  hit(key) {
    const now = Date.now();
    const bucket = this.#bucket(key, now);
    bucket.count += 1;
    if (this.#buckets.size > 5000) this.sweep(now);
    return this.#result(bucket, now);
  }

  /** 成功后清零（例如密码输对了，就不再累计失败次数）。 */
  reset(key) {
    this.#buckets.delete(key);
  }

  /** 清掉已过期的窗口，防止 Map 无限增长。 */
  sweep(now = Date.now()) {
    for (const [key, bucket] of this.#buckets) {
      if (now >= bucket.resetAt) this.#buckets.delete(key);
    }
  }
}
