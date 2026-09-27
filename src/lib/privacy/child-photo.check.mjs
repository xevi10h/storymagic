// Runnable check for the child photo privacy path (no test runner, no network):
//   node --experimental-strip-types src/lib/privacy/child-photo.check.mjs
//
// Covers: consent required + version/locale validation, upload form parsing,
// real re-encode with sharp (EXIF/GPS/ICC stripped, orientation applied, ≤1536 px,
// non-images/unsupported formats rejected), path ownership, deleteChildPhoto
// idempotency + ownership, and the purge sweep against an in-memory fake Supabase.
import assert from "node:assert/strict";
import { register } from "node:module";

// Next resolves extensionless relative imports; plain Node doesn't. Tiny hook.
register(
  "data:text/javascript," +
    encodeURIComponent(`
export async function resolve(specifier, context, next) {
  try { return await next(specifier, context); }
  catch (err) {
    if (err?.code === "ERR_MODULE_NOT_FOUND" && specifier.startsWith(".") && !/\\.[cm]?[jt]s$/.test(specifier)) {
      return next(specifier + ".ts", context);
    }
    throw err;
  }
}`),
  import.meta.url,
);

const policy = await import("./child-photo-policy.ts");
const photo = await import("./child-photo.ts");
const { default: sharp } = await import("sharp");

const USER = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-2222-4333-8444-555555555555";
const ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

// ── Consent ──────────────────────────────────────────────────────────────────
const V = policy.PHOTO_CONSENT_VERSION;
assert.deepEqual(policy.parsePhotoConsent({ consent: null, consentVersion: V, locale: "es" }), { ok: false, error: "consent_required" });
assert.deepEqual(policy.parsePhotoConsent({ consent: "false", consentVersion: V, locale: "es" }), { ok: false, error: "consent_required" });
assert.deepEqual(policy.parsePhotoConsent({ consent: "on", consentVersion: V, locale: "es" }), { ok: false, error: "consent_required" });
assert.deepEqual(policy.parsePhotoConsent({ consent: "true", consentVersion: "2020-01-01", locale: "es" }), { ok: false, error: "consent_version_mismatch" });
assert.deepEqual(policy.parsePhotoConsent({ consent: "true", consentVersion: V, locale: "de" }), { ok: false, error: "invalid_locale" });
assert.deepEqual(policy.parsePhotoConsent({ consent: "true", consentVersion: V, locale: "ca" }), { ok: true, consent: { consentVersion: V, locale: "ca" } });

// ── Paths ────────────────────────────────────────────────────────────────────
assert.equal(policy.buildPhotoPath(USER, ID), `${USER}/${ID}.jpg`);
assert.ok(policy.isOwnedPhotoPath(`${USER}/${ID}.jpg`, USER));
assert.ok(policy.isOwnedPhotoPath(`${USER}/${ID}.jpg`, USER.toUpperCase()));
assert.ok(!policy.isOwnedPhotoPath(`${USER}/${ID}.jpg`, OTHER));
for (const bad of [`../${USER}/${ID}.jpg`, `${USER}/../${OTHER}/${ID}.jpg`, `${USER}/${ID}.png`, `${USER}/x/${ID}.jpg`, `portraits/${ID}.jpg`, "", null]) {
  assert.ok(!policy.isValidPhotoPath(bad), `must reject path ${bad}`);
}
assert.throws(() => policy.buildPhotoPath("not-a-uuid", ID));
assert.equal(policy.photoPurgeCutoff(Date.parse("2026-09-27T12:00:00Z")).toISOString(), "2026-09-26T12:00:00.000Z");

// ── Upload form ──────────────────────────────────────────────────────────────
const form = (fields, file) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  if (file) f.set("photo", file, "kid.jpg");
  return f;
};
const okFields = { consent: "true", consentVersion: V, locale: "es" };
const tiny = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
// consent is checked before (and without) touching the file
assert.deepEqual(photo.parsePhotoUploadForm(form({ consentVersion: V, locale: "es" }, tiny)), { ok: false, error: "consent_required" });
assert.deepEqual(photo.parsePhotoUploadForm(form(okFields)), { ok: false, error: "missing_file" });
assert.deepEqual(photo.parsePhotoUploadForm(form(okFields, new Blob([]))), { ok: false, error: "missing_file" });
const huge = new Blob([new Uint8Array(policy.PHOTO_MAX_UPLOAD_BYTES + 1)]);
assert.deepEqual(photo.parsePhotoUploadForm(form(okFields, huge)), { ok: false, error: "too_large" });
const good = photo.parsePhotoUploadForm(form(okFields, tiny));
assert.equal(good.ok, true);
assert.deepEqual(good.consent, { consentVersion: V, locale: "es" });

// ── Normalization (real sharp) ───────────────────────────────────────────────
// A 3000×2000 JPEG carrying EXIF (camera, GPS) + orientation 6 (rotate 90°) + ICC.
const withExif = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#c08040" } })
  .jpeg()
  .withExif({
    IFD0: { Make: "PhoneCo", Model: "Cam 1" },
    IFD3: { GPSLatitudeRef: "N", GPSLatitude: "41/1 23/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "2/1 9/1 0/1" },
  })
  .withMetadata({ orientation: 6 })
  .keepIccProfile()
  .toBuffer();
const inMeta = await sharp(withExif).metadata();
assert.ok(inMeta.exif && inMeta.exif.length > 0, "fixture must carry EXIF");
assert.equal(inMeta.orientation, 6);

const out = await photo.normalizeChildPhoto(withExif);
const outMeta = await sharp(out.data).metadata();
assert.equal(outMeta.format, "jpeg");
assert.equal(outMeta.exif, undefined, "EXIF must be stripped");
assert.equal(outMeta.xmp, undefined, "XMP must be stripped");
assert.equal(outMeta.iptc, undefined, "IPTC must be stripped");
assert.equal(outMeta.icc, undefined, "ICC must be stripped");
assert.equal(outMeta.orientation, undefined, "orientation applied, tag removed");
assert.ok(!out.data.includes(Buffer.from("PhoneCo")), "no camera make in bytes");
// orientation 6 → portrait; long edge capped at 1536
assert.equal(outMeta.width, 1024);
assert.equal(outMeta.height, 1536);
assert.deepEqual([out.width, out.height], [1024, 1536]);

// PNG with alpha → flattened JPEG; small images are not enlarged
const png = await sharp({ create: { width: 800, height: 600, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
const pngOut = await photo.normalizeChildPhoto(png);
const pngMeta = await sharp(pngOut.data).metadata();
assert.equal(pngMeta.format, "jpeg");
assert.equal(pngMeta.hasAlpha, false);
assert.deepEqual([pngMeta.width, pngMeta.height], [800, 600]);

const reject = async (buf, reason) => {
  await assert.rejects(photo.normalizeChildPhoto(buf), (e) => e instanceof photo.PhotoRejectedError && e.reason === reason);
};
await reject(Buffer.from("definitely not an image"), "invalid_image");
await reject(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg' width='900' height='900'/>"), "unsupported_type");
await reject(await sharp({ create: { width: 600, height: 600, channels: 3, background: "#fff" } }).gif().toBuffer(), "unsupported_type");
await reject(await sharp({ create: { width: 600, height: 100, channels: 3, background: "#fff" } }).jpeg().toBuffer(), "too_small");
await reject(Buffer.alloc(0), "missing_file");

// ── Fake Supabase (storage + photo_consents + rpc) ───────────────────────────
function fakeSupabase({ objects = {}, consents = [], failRemove = false } = {}) {
  const calls = { removed: [], uploads: [] };
  const storage = {
    from(bucket) {
      assert.equal(bucket, policy.CHILD_PHOTO_BUCKET);
      return {
        async upload(path, data, opts) {
          assert.equal(opts.upsert, false);
          assert.equal(opts.contentType, "image/jpeg");
          objects[path] = { created_at: new Date().toISOString(), data };
          calls.uploads.push(path);
          return { data: { path }, error: null };
        },
        async remove(paths) {
          if (failRemove) return { data: null, error: { message: "boom" } };
          for (const p of paths) {
            calls.removed.push(p);
            delete objects[p];
          }
          return { data: [], error: null };
        },
        async download(path) {
          const o = objects[path];
          return o ? { data: new Blob([o.data]), error: null } : { data: null, error: { message: "not found" } };
        },
      };
    },
  };
  function query(rows) {
    let filters = [];
    let patch = null;
    let limitN = Infinity;
    const apply = () => rows.filter((r) => filters.every((f) => f(r)));
    const q = {
      select() { return q; },
      update(p) { patch = p; return q; },
      insert(row) {
        rows.push({ id: String(rows.length + 1), deleted_at: null, created_at: new Date().toISOString(), ...row });
        return Promise.resolve({ error: null });
      },
      eq(k, v) { filters.push((r) => r[k] === v); return q; },
      is(k, v) { filters.push((r) => (r[k] ?? null) === v); return q; },
      lt(k, v) { filters.push((r) => r[k] < v); return q; },
      in(k, vs) { filters.push((r) => vs.includes(r[k])); return q; },
      order() { return q; },
      limit(n) { limitN = n; return q; },
      async maybeSingle() { return { data: apply()[0] ?? null, error: null }; },
      then(resolve, reject) {
        const hit = apply().slice(0, limitN);
        if (patch) for (const r of hit) Object.assign(r, patch);
        return Promise.resolve({ data: hit.map((r) => ({ ...r })), error: null }).then(resolve, reject);
      },
    };
    return q;
  }
  return {
    calls,
    objects,
    consents,
    storage,
    from(table) {
      assert.equal(table, "photo_consents");
      return query(consents);
    },
    async rpc(name, args) {
      assert.equal(name, "list_expired_child_photos");
      const data = Object.entries(objects)
        .filter(([, o]) => o.created_at < args.p_older_than)
        .map(([name, o]) => ({ name, created_at: o.created_at }));
      return { data, error: null };
    },
  };
}

// store → load → delete (idempotent) → load fails
{
  const db = fakeSupabase();
  const path = await photo.storeChildPhoto(db, USER, out.data, { consentVersion: V, locale: "es" });
  assert.ok(policy.isOwnedPhotoPath(path, USER));
  assert.equal(db.consents.length, 1);
  assert.equal(db.consents[0].photo_path, path);
  assert.equal(db.consents[0].consent_version, V);
  const ref = await photo.loadChildPhoto(path, USER, db);
  assert.equal(ref.mime, "image/jpeg");
  assert.ok(ref.data.equals(out.data));
  await assert.rejects(photo.loadChildPhoto(path, OTHER, db), photo.PhotoUnavailableError);

  assert.deepEqual(await photo.deleteChildPhoto(path, OTHER, db), { ok: false }, "never delete another user's photo");
  assert.ok(db.objects[path], "still there after foreign delete attempt");
  assert.deepEqual(await photo.deleteChildPhoto(path, USER, db), { ok: true });
  assert.equal(db.objects[path], undefined);
  assert.ok(db.consents[0].deleted_at, "consent row marked deleted");
  const firstDeletedAt = db.consents[0].deleted_at;
  assert.deepEqual(await photo.deleteChildPhoto(path, USER, db), { ok: true }, "idempotent");
  assert.equal(db.consents[0].deleted_at, firstDeletedAt, "deleted_at not rewritten");
  await assert.rejects(photo.loadChildPhoto(path, USER, db), photo.PhotoUnavailableError);
}

// deleteChildPhoto never throws on storage failure
{
  const db = fakeSupabase({ failRemove: true });
  assert.deepEqual(await photo.deleteChildPhoto(`${USER}/${ID}.jpg`, USER, db), { ok: false });
}

// ── Purge ────────────────────────────────────────────────────────────────────
{
  const now = Date.parse("2026-09-27T12:00:00Z");
  const hoursAgo = (h) => new Date(now - h * 3_600_000).toISOString();
  const p = (n) => `${USER}/aaaaaaaa-bbbb-4ccc-8ddd-00000000000${n}.jpg`;
  const db = fakeSupabase({
    objects: {
      [p(1)]: { created_at: hoursAgo(30), data: Buffer.from("a") }, // expired, has consent
      [p(2)]: { created_at: hoursAgo(2), data: Buffer.from("b") }, // fresh, keep
      [p(3)]: { created_at: hoursAgo(25), data: Buffer.from("c") }, // expired orphan (no consent row)
    },
    consents: [
      { id: "1", user_id: USER, photo_path: p(1), created_at: hoursAgo(30), deleted_at: null },
      { id: "2", user_id: USER, photo_path: p(2), created_at: hoursAgo(2), deleted_at: null },
      { id: "4", user_id: USER, photo_path: p(4), created_at: hoursAgo(40), deleted_at: null }, // object already gone
      { id: "5", user_id: USER, photo_path: p(5), created_at: hoursAgo(50), deleted_at: hoursAgo(49) }, // done
    ],
  });
  const res = await photo.purgeExpiredChildPhotos(db, now);
  assert.equal(res.cutoff, "2026-09-26T12:00:00.000Z");
  assert.equal(res.failed, 0);
  assert.deepEqual(Object.keys(db.objects), [p(2)], "only the fresh photo survives");
  assert.deepEqual(new Set(db.calls.removed), new Set([p(1), p(3), p(4)]));
  assert.equal(res.removed, 3);
  assert.equal(res.consentsMarked, 2);
  assert.ok(db.consents.find((r) => r.id === "1").deleted_at);
  assert.equal(db.consents.find((r) => r.id === "2").deleted_at, null);
  assert.ok(db.consents.find((r) => r.id === "4").deleted_at);
  assert.equal(db.consents.find((r) => r.id === "5").deleted_at, hoursAgo(49), "already-deleted rows untouched");

  // second run: nothing left to do
  const again = await photo.purgeExpiredChildPhotos(db, now);
  assert.deepEqual([again.removed, again.consentsMarked, again.failed], [0, 0, 0]);

  // storage failure: counted, consent rows NOT marked (retried next hour)
  const broken = fakeSupabase({
    failRemove: true,
    objects: { [p(1)]: { created_at: hoursAgo(30), data: Buffer.from("a") } },
    consents: [{ id: "1", user_id: USER, photo_path: p(1), created_at: hoursAgo(30), deleted_at: null }],
  });
  const bad = await photo.purgeExpiredChildPhotos(broken, now);
  assert.deepEqual([bad.removed, bad.failed, bad.consentsMarked], [0, 1, 0]);
  assert.equal(broken.consents[0].deleted_at, null);
}

console.log("child-photo checks passed");
