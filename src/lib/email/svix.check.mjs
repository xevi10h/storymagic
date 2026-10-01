// Runnable check for the Svix signature verification (no deps, no test runner):
//   node --experimental-strip-types src/lib/email/svix.check.mjs
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifySvix } from "./svix.ts";

const key = Buffer.from("test-secret-bytes");
const secret = `whsec_${key.toString("base64")}`;
const body = '{"type":"email.received","data":{"email_id":"e1"}}';
const now = 1_800_000_000;
const sign = (id, ts, b) => createHmac("sha256", key).update(`${id}.${ts}.${b}`).digest("base64");
const h = (over = {}) => ({ id: "msg_1", timestamp: String(now), signature: `v1,${sign("msg_1", now, body)}`, ...over });

assert.equal(verifySvix(secret, h(), body, now), true);
assert.equal(verifySvix(secret, h({ signature: `v1,bogus v1,${sign("msg_1", now, body)}` }), body, now), true, "any of several signatures");
assert.equal(verifySvix(secret, h(), body + " ", now), false, "tampered body");
assert.equal(verifySvix(secret, h(), body, now + 301), false, "stale timestamp");
assert.equal(verifySvix(secret, h({ signature: null }), body, now), false, "missing header");
assert.equal(verifySvix(`whsec_${Buffer.from("other").toString("base64")}`, h(), body, now), false, "wrong secret");
console.log("svix.check: ok");
