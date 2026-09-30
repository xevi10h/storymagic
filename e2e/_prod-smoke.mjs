// Prod smoke test of the write/read paths after the 2026-09-30 security migrations.
// Creates ONE anonymous guest + ONE draft story (no AI generation, no cost); the guest is
// erased at the end through DELETE /api/account. Run: node e2e/_prod-smoke.mjs
import { createServerClient } from "@supabase/ssr";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const BASE = process.env.BASE ?? "https://meapica.shop";

let jar = [];
const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  cookies: { getAll: () => jar, setAll: (c) => { jar = c.map(({ name, value }) => ({ name, value })); } },
});
const { data: auth, error: authErr } = await supabase.auth.signInAnonymously();
if (authErr) throw authErr;
console.log("guest", auth.user.id);
const cookie = jar.map((c) => `${c.name}=${c.value}`).join("; ");

const call = async (method, path, body) => {
  const r = await fetch(BASE + path, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text.slice(0, 200); }
  return { status: r.status, json };
};

const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", name, extra); };

const created = await call("POST", "/api/stories", {
  character: { name: "prueba", gender: "girl", age: 5, interests: ["space"] },
  templateId: "space",
  creationMode: "solo",
  locale: "es",
});
const storyId = created.json?.storyId ?? created.json?.id ?? created.json?.story?.id;
check("POST /api/stories creates a draft", created.status < 300 && !!storyId, `${created.status} ${JSON.stringify(created.json).slice(0, 160)}`);

if (storyId) {
  const full = await call("GET", `/api/stories/${storyId}`);
  check("GET story (owner)", full.status === 200, `${full.status} status=${full.json?.status}`);
  const light = await call("GET", `/api/stories/${storyId}?light=true`);
  check("GET story light", light.status === 200 && !("generated_text" in (light.json ?? {})), `${light.status}`);
  const title = await call("PATCH", `/api/stories/${storyId}/title`, { title: "Prueba de humo" });
  check("PATCH title on draft", title.status === 200, `${title.status} ${JSON.stringify(title.json).slice(0, 120)}`);
  const ded = await call("PATCH", `/api/stories/${storyId}/dedication`, { dedication: "Para ti", senderName: "Papá" });
  check("PATCH dedication", ded.status < 300, `${ded.status} ${JSON.stringify(ded.json).slice(0, 120)}`);
  const offer = await call("GET", `/api/stories/${storyId}/offer`);
  check("GET offer (none for unpaid)", offer.status === 200 && offer.json?.offer === null, `${offer.status}`);
  // Direct DB write with the user session must now be refused (security migration).
  const { error: directErr } = await supabase.from("stories").update({ is_showcase: true }).eq("id", storyId);
  check("direct client UPDATE stories is refused", !!directErr, directErr?.message ?? "NO ERROR (write allowed!)");
  const { data: directRead, error: readErr } = await supabase.from("stories").select("generated_text").eq("id", storyId);
  check("direct client read of generated_text is refused", !!readErr, readErr?.message ?? `read ok: ${JSON.stringify(directRead).slice(0, 80)}`);
}

const dash = await call("GET", "/api/dashboard");
check("GET /api/dashboard", dash.status === 200, `${dash.status} stories=${dash.json?.stories?.length}`);
const profile = await call("GET", "/api/profile");
check("GET /api/profile", profile.status === 200, `${profile.status}`);

const del = await call("DELETE", "/api/account", { confirm: true });
check("DELETE /api/account erases the test guest", del.status === 200, `${del.status} ${JSON.stringify(del.json).slice(0, 160)}`);

console.log(results.every(Boolean) ? "\nALL PASS" : "\nSOME FAILED");
