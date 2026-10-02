#!/usr/bin/env node
// Weekly SEO + analytics report for Meapica, emailed to the owner (Spanish, text/html).
//
// Data: Google Search Console (search analytics, sitemaps, URL Inspection) + GA4 Data API, read with the
// same Service Account + Domain-Wide Delegation that the `cana` CLI uses (~/.config/casmar-analytics/:
// sa-key.json + sites.json, project resolved by path_match exactly like cana). cana itself only prints
// text tables for these queries, so the report calls the APIs directly with its credentials.
// Mail: sent with the `gws` CLI as admin@casmar.tech, authenticated with a short-lived SA+DWD token
// (GOOGLE_WORKSPACE_CLI_TOKEN), so it never depends on the global gws OAuth profile or the keychain.
//
// Usage:
//   node scripts/seo-weekly-report.mjs              # collect + send
//   node scripts/seo-weekly-report.mjs --dry-run    # collect + print HTML, no email
//   options: --to <addr>  --subject-prefix "[TEST]"  --no-inspect  --lag <days, default 3>
// Scheduled weekly by launchd: ~/Library/LaunchAgents/com.casmar.meapica-seo-weekly.plist (see docs/stack.md).

import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

// ───────── config ─────────
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
};
const DRY_RUN = flag("--dry-run");
const INSPECT = !flag("--no-inspect");
const TO = opt("--to", "admin@casmar.tech");
const SENDER = "admin@casmar.tech";
const SUBJECT_PREFIX = opt("--subject-prefix", "");
// GSC "final" data lags 2-3 days; using an incomplete last day would fake a drop. Mon run → Sat..Fri.
const LAG_DAYS = Number(opt("--lag", "3"));
const INSPECT_MAX = 500; // URL Inspection quota is 2,000/day and 600/min per property.
const GWS_BIN = process.env.GWS_BIN || "/opt/homebrew/bin/gws";
const CFG_DIR = join(homedir(), ".config", "casmar-analytics");
const KEY_EVENTS = ["purchase", "begin_checkout", "generate_lead", "tool_download"];
const DROP_THRESHOLD = 0.3;

const sites = JSON.parse(readFileSync(join(CFG_DIR, "sites.json"), "utf8"));
const cwd = process.cwd().replace(/\/?$/, "/");
const project =
  sites.projects.find((p) => cwd.includes(p.path_match)) ?? sites.projects.find((p) => p.key === "meapica");
if (!project) throw new Error("meapica project not found in sites.json");
const SITE = project.gsc_site; // sc-domain:meapica.shop
const PROPERTY = project.ga4_property;
const DOMAIN = project.domain;

// ───────── auth (SA + DWD, RS256 JWT bearer) ─────────
const saKey = JSON.parse(readFileSync(join(CFG_DIR, "sa-key.json"), "utf8"));
const tokenCache = new Map();
const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function accessToken(scope, subject = SENDER) {
  const cacheKey = `${scope}|${subject}`;
  if (tokenCache.has(cacheKey)) return tokenCache.get(cacheKey);
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({ iss: saKey.client_email, sub: subject, scope, aud: saKey.token_uri, iat: now, exp: now + 3600 }),
  );
  const signature = b64url(createSign("RSA-SHA256").update(`${header}.${claims}`).sign(saKey.private_key));
  const res = await fetch(saKey.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`token (${scope}): ${res.status} ${JSON.stringify(body)}`);
  tokenCache.set(cacheKey, body.access_token);
  return body.access_token;
}

async function api(url, scope, body) {
  const token = await accessToken(scope);
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 2000 * attempt));
      continue;
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${res.status} ${url}: ${JSON.stringify(json).slice(0, 300)}`);
    return json;
  }
}

// Must match the DWD-authorized scope list exactly (cana uses the full webmasters scope).
const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters";
const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.modify";
const gscBase = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}`;

// ───────── date windows (Europe/Madrid) ─────────
const madridToday = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Madrid" }); // YYYY-MM-DD
const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const cur = { start: addDays(madridToday, -LAG_DAYS - 6), end: addDays(madridToday, -LAG_DAYS) };
const prev = { start: addDays(cur.start, -7), end: addDays(cur.start, -1) };

// ───────── collectors ─────────
async function gscRows(range, dimensions, rowLimit = 1000) {
  const res = await api(`${gscBase}/searchAnalytics/query`, GSC_SCOPE, {
    startDate: range.start,
    endDate: range.end,
    dimensions,
    rowLimit,
    type: "web",
  });
  return res.rows ?? [];
}

async function gscTotals(range) {
  const [row] = await gscRows(range, [], 1);
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: row?.ctr ?? 0,
    position: row?.position ?? 0,
  };
}

async function ga4Report(range, dimensions, metrics, dimensionFilter) {
  const res = await api(`https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY}:runReport`, GA4_SCOPE, {
    dateRanges: [{ startDate: range.start, endDate: range.end }],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    ...(dimensionFilter ? { dimensionFilter } : {}),
    limit: 100,
  });
  return (res.rows ?? []).map((r) => ({
    dims: (r.dimensionValues ?? []).map((d) => d.value),
    mets: (r.metricValues ?? []).map((m) => Number(m.value) || 0),
  }));
}

async function ga4Summary(range) {
  const [totals] = await ga4Report(range, [], ["activeUsers", "sessions"]);
  const channels = await ga4Report(range, ["sessionDefaultChannelGroup"], ["sessions"]);
  const events = await ga4Report(range, ["eventName"], ["eventCount"], {
    filter: { fieldName: "eventName", inListFilter: { values: KEY_EVENTS } },
  });
  const eventCount = Object.fromEntries(KEY_EVENTS.map((e) => [e, 0]));
  for (const r of events) eventCount[r.dims[0]] = r.mets[0];
  return {
    users: totals?.mets[0] ?? 0,
    sessions: totals?.mets[1] ?? 0,
    organic: channels.find((r) => r.dims[0] === "Organic Search")?.mets[0] ?? 0,
    events: eventCount,
  };
}

async function sitemapUrls(url, depth = 0) {
  const xml = await (await fetch(url)).text();
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  if (/<sitemapindex/i.test(xml) && depth < 2) {
    const nested = await Promise.all(locs.map((l) => sitemapUrls(l, depth + 1)));
    return nested.flat();
  }
  return locs;
}

async function coverage() {
  const sm = await api(`${gscBase}/sitemaps`, GSC_SCOPE);
  const sitemaps = (sm.sitemap ?? []).map((s) => ({
    path: s.path,
    lastDownloaded: s.lastDownloaded?.slice(0, 10) ?? null,
    errors: Number(s.errors ?? 0),
    warnings: Number(s.warnings ?? 0),
    submitted: (s.contents ?? []).reduce((a, c) => a + Number(c.submitted ?? 0), 0),
  }));
  const result = { sitemaps, inspected: 0, indexed: 0, notIndexed: [], byState: {}, inspectErrors: 0, sitemapUrlCount: 0 };
  if (!INSPECT) return result;

  const urls = [...new Set((await Promise.all(sitemaps.map((s) => sitemapUrls(s.path).catch(() => [])))).flat())];
  result.sitemapUrlCount = urls.length;
  const queue = urls.slice(0, INSPECT_MAX);
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift();
      try {
        const res = await api("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", GSC_SCOPE, {
          inspectionUrl: url,
          siteUrl: SITE,
          languageCode: "es-ES",
        });
        const status = res.inspectionResult?.indexStatusResult ?? {};
        const state = status.coverageState ?? "Desconocido";
        result.inspected++;
        result.byState[state] = (result.byState[state] ?? 0) + 1;
        if (status.verdict === "PASS") result.indexed++;
        else result.notIndexed.push({ url, state });
      } catch {
        result.inspectErrors++;
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  return result;
}

// ───────── analysis ─────────
const change = (c, p) => (p === 0 ? (c === 0 ? 0 : null) : (c - p) / p); // null = new (from 0)
const byKey = (rows) => new Map(rows.map((r) => [r.keys[0], r]));

function analyse({ gscCur, gscPrev, qCur, qPrev, pCur, pPrev, gaCur, gaPrev, cov }) {
  const hasGsc = gscCur.impressions > 0 || gscPrev.impressions > 0;
  const hasGa = gaCur.sessions > 0 || gaPrev.sessions > 0;
  const firstGscWeek = gscPrev.impressions === 0 && gscCur.impressions > 0;

  // Drops > 30% (only when the previous value is large enough to not be noise).
  const drops = [];
  const checks = [
    ["Clics orgánicos (GSC)", gscCur.clicks, gscPrev.clicks, 5],
    ["Impresiones (GSC)", gscCur.impressions, gscPrev.impressions, 50],
    ["Usuarios (GA4)", gaCur.users, gaPrev.users, 10],
    ["Sesiones (GA4)", gaCur.sessions, gaPrev.sessions, 10],
    ["Sesiones orgánicas (GA4)", gaCur.organic, gaPrev.organic, 5],
    ...KEY_EVENTS.map((e) => [e, gaCur.events[e], gaPrev.events[e], 3]),
  ];
  for (const [label, c, p, min] of checks) {
    const ch = change(c, p);
    if (p >= min && ch !== null && ch <= -DROP_THRESHOLD) drops.push({ label, c, p, ch });
  }
  const curPages = byKey(pCur);
  for (const before of pPrev) {
    const c = curPages.get(before.keys[0])?.clicks ?? 0;
    const ch = change(c, before.clicks);
    if (before.clicks >= 5 && ch <= -DROP_THRESHOLD) drops.push({ label: `Página ${shortPath(before.keys[0])}`, c, p: before.clicks, ch });
  }

  // New queries: impressions this week, none last week (skip on the very first week with data).
  const prevQ = byKey(qPrev);
  const newQueries = firstGscWeek
    ? []
    : qCur.filter((r) => !prevQ.has(r.keys[0])).sort((a, b) => b.impressions - a.impressions).slice(0, 5);

  // Striking distance (pos 8-20) and low-CTR-on-page-1 candidates.
  const striking = qCur
    .filter((r) => r.position >= 8 && r.position <= 20 && r.impressions >= 10)
    .sort((a, b) => b.impressions - a.impressions);
  const lowCtr = pCur
    .filter((r) => r.position <= 10 && r.impressions >= 50 && r.ctr < 0.02)
    .sort((a, b) => b.impressions - a.impressions);

  // Three recommended actions, highest-leverage first.
  const actions = [];
  const notIdx = cov.notIndexed.length;
  if (cov.inspected > 0 && notIdx > 0) {
    const top = Object.entries(
      cov.notIndexed.reduce((m, n) => ((m[n.state] = (m[n.state] ?? 0) + 1), m), {}),
    ).sort((a, b) => b[1] - a[1])[0];
    actions.push(
      `Indexación: ${fmtInt(notIdx)} de ${fmtInt(cov.inspected)} URLs del sitemap no están indexadas (sobre todo "${esc(top[0])}"). ` +
        `Pide indexación manual en Search Console de las más importantes (${cov.notIndexed
          .map((n) => shortPath(n.url))
          .sort((x, y) => x.split("/").length - y.split("/").length || x.length - y.length)
          .slice(0, 4)
          .map(esc)
          .join(", ")}…) y refuerza su enlazado interno desde la home.`,
    );
  }
  if (drops.length) {
    const d = drops[0];
    actions.push(`Revisa la caída de ${esc(d.label)} (${fmtInt(d.p)} → ${fmtInt(d.c)}): compara cambios desplegados esa semana y la posición de sus consultas.`);
  }
  if (striking.length) {
    const s = striking[0];
    actions.push(
      `Quick win SEO: "${esc(s.keys[0])}" está en posición ${s.position.toFixed(1)} con ${fmtInt(s.impressions)} impresiones. ` +
        `Refuerza la página que posiciona (H1/H2 con esa intención, FAQ, enlaces internos) para llevarla al top 5.`,
    );
  }
  if (lowCtr.length) {
    const l = lowCtr[0];
    actions.push(`CTR bajo en ${esc(shortPath(l.keys[0]))} (${fmtPct(l.ctr)} en posición ${l.position.toFixed(1)}): reescribe title y meta description.`);
  }
  if (hasGa && gaCur.sessions >= 20 && gaCur.events.begin_checkout === 0) {
    actions.push(`${fmtInt(gaCur.sessions)} sesiones y ningún begin_checkout: revisa el embudo de creación (paso donde abandonan) y que el evento dispare con consentimiento.`);
  }
  if (!hasGsc) {
    actions.push(`Search Console aún no registra impresiones: comprueba en GSC que el sitemap se ha leído (última lectura) y ejecuta "node scripts/indexnow-ping.mjs" tras cada deploy.`);
  }
  if (!hasGa) {
    actions.push(`GA4 sin sesiones: verifica con la extensión Tag Assistant que gtag carga tras aceptar cookies en meapica.shop (Consent Mode v2) y que NEXT_PUBLIC_GA4_ID está en el build de producción.`);
  }
  const fallbacks = [
    `Publica 1 página nueva del clúster no-marca (regalo personalizado para niños por edad u ocasión) y enlázala desde la home y el blog.`,
    `Consigue 2 enlaces de calidad (blogs de crianza, tiendas infantiles locales) hacia las páginas de ocasión.`,
    `Revisa las 5 consultas con más impresiones y asegúrate de que cada una tiene una página dedicada que responde a esa intención.`,
  ];
  for (const f of fallbacks) if (actions.length < 3) actions.push(f);

  return { hasGsc, hasGa, firstGscWeek, drops, newQueries, actions: actions.slice(0, 3) };
}

// ───────── rendering ─────────
const nf = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
const fmtInt = (n) => nf.format(Math.round(n ?? 0));
const fmtPct = (r) => `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format((r ?? 0) * 100)} %`;
const fmtPos = (p) => (p ? new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(p) : "–");
const fmtDelta = (c, p) => {
  const ch = change(c, p);
  if (ch === null) return `<span style="color:#1a7f37">nuevo</span>`;
  if (ch === 0) return `<span style="color:#888">=</span>`;
  const color = ch < 0 ? "#c62828" : "#1a7f37";
  return `<span style="color:${color}">${ch > 0 ? "+" : "−"}${nf.format(Math.abs(Math.round(ch * 100)))} %</span>`;
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const shortPath = (url) => {
  try {
    const u = new URL(url);
    return u.host === DOMAIN ? u.pathname || "/" : url;
  } catch {
    return url;
  }
};
const fmtDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });

const TD = `style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap"`;
const TDL = `style="padding:4px 8px;border-bottom:1px solid #eee;text-align:left"`;
const TH = `style="padding:4px 8px;border-bottom:2px solid #ddd;text-align:right;font-weight:600;color:#555"`;
const THL = `style="padding:4px 8px;border-bottom:2px solid #ddd;text-align:left;font-weight:600;color:#555"`;
const TABLE = `cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px;margin:6px 0 14px"`;
const H3 = `style="font-size:14px;margin:18px 0 4px"`;

function render(d) {
  const { gscCur, gscPrev, qCur, qPrev, pCur, pPrev, gaCur, gaPrev, cov, a } = d;
  const period = `${fmtDate(cur.start)} – ${fmtDate(cur.end)} vs ${fmtDate(prev.start)} – ${fmtDate(prev.end)}`;
  const parts = [];
  parts.push(`<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#222;font-size:14px;line-height:1.5;max-width:680px">`);
  parts.push(`<p style="margin:0 0 2px;font-size:16px"><b>Meapica · informe SEO semanal</b></p>`);
  parts.push(`<p style="margin:0 0 12px;color:#666;font-size:13px">${period} (datos consolidados de GSC y GA4)</p>`);

  // What changed.
  const changed = [];
  if (!a.hasGsc && !a.hasGa) changed.push("Aún no hay datos: ni Search Console ni GA4 registran tráfico en estas dos semanas. Normal en las primeras semanas tras el lanzamiento.");
  else {
    changed.push(
      `Búsqueda: ${fmtInt(gscCur.clicks)} clics (${fmtDelta(gscCur.clicks, gscPrev.clicks)}) y ${fmtInt(gscCur.impressions)} impresiones (${fmtDelta(gscCur.impressions, gscPrev.impressions)}). ` +
        `Web: ${fmtInt(gaCur.sessions)} sesiones (${fmtDelta(gaCur.sessions, gaPrev.sessions)}), ${fmtInt(gaCur.events.purchase)} compras.`,
    );
    if (a.firstGscWeek) changed.push("Primera semana con impresiones en Google: aún no hay base de comparación por consulta.");
    for (const x of a.drops.slice(0, 3)) changed.push(`<span style="color:#c62828">Caída &gt;30 %</span>: ${esc(x.label)} ${fmtInt(x.p)} → ${fmtInt(x.c)}.`);
    if (a.newQueries.length) changed.push(`Consultas nuevas: ${a.newQueries.map((q) => `"${esc(q.keys[0])}" (${fmtInt(q.impressions)} impr.)`).join(", ")}.`);
  }
  if (cov.inspected > 0) {
    changed.push(
      `Indexación: ${fmtInt(cov.indexed)} de ${fmtInt(cov.inspected)} URLs del sitemap indexadas` +
        (cov.notIndexed.length ? `; ${fmtInt(cov.notIndexed.length)} sin indexar.` : "."),
    );
  }
  parts.push(`<p ${H3}><b>Qué ha cambiado</b></p><ul style="margin:0;padding-left:18px">${changed.map((c) => `<li>${c}</li>`).join("")}</ul>`);

  // Actions.
  parts.push(`<p ${H3}><b>3 acciones recomendadas</b></p><ol style="margin:0;padding-left:20px">${a.actions.map((x) => `<li>${x}</li>`).join("")}</ol>`);

  // KPI table.
  const kpis = [
    ["Clics GSC", gscCur.clicks, gscPrev.clicks],
    ["Impresiones GSC", gscCur.impressions, gscPrev.impressions],
    ["CTR medio", null, null, fmtPct(gscCur.ctr), fmtPct(gscPrev.ctr)],
    ["Posición media", null, null, fmtPos(gscCur.position), fmtPos(gscPrev.position)],
    ["Usuarios GA4", gaCur.users, gaPrev.users],
    ["Sesiones", gaCur.sessions, gaPrev.sessions],
    ["Sesiones orgánicas", gaCur.organic, gaPrev.organic],
    ...KEY_EVENTS.map((e) => [e, gaCur.events[e], gaPrev.events[e]]),
  ];
  parts.push(`<p ${H3}><b>Métricas</b></p><table ${TABLE}><tr><th ${THL}></th><th ${TH}>Semana</th><th ${TH}>Anterior</th><th ${TH}>Δ</th></tr>`);
  for (const [label, c, p, cs, ps] of kpis) {
    const delta = c === null ? "" : fmtDelta(c, p);
    parts.push(`<tr><td ${TDL}>${label}</td><td ${TD}>${cs ?? fmtInt(c)}</td><td ${TD}>${ps ?? fmtInt(p)}</td><td ${TD}>${delta}</td></tr>`);
  }
  parts.push(`</table>`);

  // Top queries / pages.
  const table = (title, rows, prevRows, keyLabel, fmtKey) => {
    if (!rows.length) return;
    const pm = byKey(prevRows);
    parts.push(`<p ${H3}><b>${title}</b></p><table ${TABLE}><tr><th ${THL}>${keyLabel}</th><th ${TH}>Impr.</th><th ${TH}>Δ impr.</th><th ${TH}>Clics</th><th ${TH}>CTR</th><th ${TH}>Pos.</th></tr>`);
    for (const r of rows.slice(0, 5)) {
      const p = pm.get(r.keys[0]);
      parts.push(
        `<tr><td ${TDL}>${esc(fmtKey(r.keys[0]))}</td><td ${TD}>${fmtInt(r.impressions)}</td><td ${TD}>${a.firstGscWeek ? "" : fmtDelta(r.impressions, p?.impressions ?? 0)}</td>` +
          `<td ${TD}>${fmtInt(r.clicks)}</td><td ${TD}>${fmtPct(r.ctr)}</td><td ${TD}>${fmtPos(r.position)}</td></tr>`,
      );
    }
    parts.push(`</table>`);
  };
  const byImpr = (rows) => [...rows].sort((x, y) => y.impressions - x.impressions || y.clicks - x.clicks);
  table("Top consultas", byImpr(qCur), qPrev, "Consulta", (k) => k);
  table("Top páginas", byImpr(pCur), pPrev, "Página", shortPath);

  // Coverage footer.
  const sm = cov.sitemaps
    .map((s) => `${esc(shortPath(s.path))}: ${fmtInt(s.submitted)} enviadas, última lectura ${s.lastDownloaded ?? "–"}${s.errors ? `, ${s.errors} errores` : ""}`)
    .join(" · ");
  const notIdxSample = cov.notIndexed.slice(0, 5).map((n) => esc(shortPath(n.url))).join(", ");
  parts.push(
    `<p style="margin:14px 0 0;color:#666;font-size:12px">Sitemap: ${sm || "ninguno registrado en Search Console"}.` +
      (cov.inspected
        ? ` Inspección de URLs: ${Object.entries(cov.byState).map(([s, n]) => `${esc(s)} ${fmtInt(n)}`).join(" · ")}` +
          (notIdxSample ? `. Ejemplos sin indexar: ${notIdxSample}` : "") +
          (cov.sitemapUrlCount > cov.inspected ? `. Inspeccionadas ${fmtInt(cov.inspected)} de ${fmtInt(cov.sitemapUrlCount)}` : "") +
          (cov.inspectErrors ? `. ${cov.inspectErrors} inspecciones fallidas` : "")
        : "") +
      `.</p>`,
  );
  parts.push(`<p style="margin:6px 0 0;color:#999;font-size:11px">Generado por scripts/seo-weekly-report.mjs (launchd, lunes 09:00).</p></div>`);
  return parts.join("\n");
}

// ───────── send ─────────
function encodeHeader(s) {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}

async function send(subject, html) {
  const mime = [
    `From: ${SENDER}`,
    `To: ${TO}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(html, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
  ].join("\r\n");
  const token = await accessToken(GMAIL_SCOPE);
  const out = execFileSync(
    GWS_BIN,
    ["gmail", "users", "messages", "send", "--params", JSON.stringify({ userId: "me" }), "--json", JSON.stringify({ raw: b64url(mime) })],
    { env: { ...process.env, GOOGLE_WORKSPACE_CLI_TOKEN: token }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const sent = JSON.parse(out.slice(out.indexOf("{")));
  if (!sent.id) throw new Error(`gws send returned no id: ${out.slice(0, 300)}`);
  return sent;
}

// ───────── main ─────────
async function main() {
  console.log(`[${new Date().toISOString()}] meapica weekly report: ${cur.start}..${cur.end} vs ${prev.start}..${prev.end}${DRY_RUN ? " (dry run)" : ""}`);
  const [gscCur, gscPrev, qCur, qPrev, pCur, pPrev, gaCur, gaPrev, cov] = await Promise.all([
    gscTotals(cur),
    gscTotals(prev),
    gscRows(cur, ["query"]),
    gscRows(prev, ["query"]),
    gscRows(cur, ["page"]),
    gscRows(prev, ["page"]),
    ga4Summary(cur),
    ga4Summary(prev),
    coverage(),
  ]);
  const data = { gscCur, gscPrev, qCur, qPrev, pCur, pPrev, gaCur, gaPrev, cov };
  data.a = analyse(data);
  const html = render(data);
  const noData = !data.a.hasGsc && !data.a.hasGa;
  const subject = `${SUBJECT_PREFIX ? `${SUBJECT_PREFIX} ` : ""}Meapica SEO semanal · ${fmtDate(cur.start)} – ${fmtDate(cur.end)}${noData ? " (sin datos aún)" : ""}`;

  if (DRY_RUN) {
    console.log(`Subject: ${subject}\n`);
    console.log(html);
    return;
  }
  const sent = await send(subject, html);
  console.log(`sent to ${TO}: message ${sent.id} (thread ${sent.threadId}) labels=${(sent.labelIds ?? []).join(",")}`);
}

main().catch((err) => {
  console.error(`[${new Date().toISOString()}] FAILED: ${err.stack ?? err}`);
  process.exit(1);
});
