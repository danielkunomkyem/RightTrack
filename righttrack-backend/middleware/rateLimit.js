const buckets = new Map();

function normalizeEmail(value) {
  return String(value || "").toLowerCase().trim();
}

function createRateLimit({ name, windowMs, max, includeEmail = false }) {
  return (req, res, next) => {
    const now = Date.now();
    const emailPart = includeEmail ? `:${normalizeEmail(req.body?.email)}` : "";
    const key = `${name}:${req.ip || "unknown"}${emailPart}`;
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
    }

    if (bucket.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ message: "Too many attempts. Please wait and try again." });
    }

    bucket.count += 1;
    buckets.set(key, bucket);
    return next();
  };
}

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 15 * 60 * 1000);
cleanup.unref();

module.exports = { createRateLimit };
