const test = require("node:test");
const assert = require("node:assert/strict");
const { createRateLimit } = require("../middleware/rateLimit");

test("rate limiter blocks requests beyond the configured maximum", () => {
  const middleware = createRateLimit({ name: "test-login", windowMs: 60_000, max: 2, includeEmail: true });
  const req = { ip: "127.0.0.1", body: { email: "user@example.com" } };
  let nextCalls = 0;
  let statusCode = null;
  const res = {
    set() {},
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      return payload;
    },
  };

  middleware(req, res, () => { nextCalls += 1; });
  middleware(req, res, () => { nextCalls += 1; });
  middleware(req, res, () => { nextCalls += 1; });

  assert.equal(nextCalls, 2);
  assert.equal(statusCode, 429);
});
