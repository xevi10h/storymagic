// Keyword → private message with the link, on Instagram and Facebook (Zernio comment automations).
// Someone comments (or messages) CUENTO / CONTE on any post and gets a DM with a button to the site, plus a short
// public reply. Captions cannot carry a clickable link on Instagram, so this is the easy way to the site.
//   node scripts/social/setup-automations.mjs            # list what exists
//   node scripts/social/setup-automations.mjs --create   # create the missing ones (idempotent by name)
import { PROFILE_ID, api, meapicaAccounts } from "./zernio.mjs";

const link = (source, lang) =>
  `https://meapica.shop/${lang}?utm_source=${source}&utm_medium=organic_social&utm_campaign=org_q4-26&utm_content=dm_keyword&lang=${lang}`;

const TEXT = {
  es: {
    keyword: "CUENTO",
    dm: "¡Hola! Aquí tienes el enlace para crear su cuento. Eliges su nombre, cómo es y su aventura, y ves la portada y las primeras páginas gratis antes de pagar.",
    button: "Crear su cuento",
    replies: ["¡Te lo acabo de enviar por privado!", "¡Enviado! Mira tus mensajes privados.", "Hecho, tienes el enlace en un mensaje privado."],
  },
  ca: {
    keyword: "CONTE",
    dm: "Hola! Aquí tens l'enllaç per crear el seu conte. Tries el seu nom, com és i la seva aventura, i veus la portada i les primeres pàgines gratis abans de pagar.",
    button: "Crear el seu conte",
    replies: ["T'ho acabo d'enviar per privat!", "Enviat! Mira els teus missatges privats.", "Fet, tens l'enllaç en un missatge privat."],
  },
};

const existing = (await api("GET", `/comment-automations?profileId=${PROFILE_ID}`)).json.automations ?? [];
for (const a of existing) console.log(`= ${a.name} · ${a.isActive === false ? "paused" : "active"} · ${JSON.stringify(a.stats ?? {})}`);
if (!process.argv.includes("--create")) process.exit(0);

const accounts = await meapicaAccounts();
for (const source of ["instagram", "facebook"]) {
  for (const [lang, t] of Object.entries(TEXT)) {
    const name = `Meapica ${source} ${lang.toUpperCase()}: ${t.keyword} → enlace`;
    if (existing.some((a) => a.name === name)) continue;
    const r = await api("POST", "/comment-automations", {
      profileId: PROFILE_ID,
      accountId: accounts[source]._id,
      name,
      trigger: "comment",
      keywords: [t.keyword],
      matchMode: "word", // "contains" would fire on "cuentos" inside any sentence
      typoTolerance: true,
      alsoMatchInDms: true,
      dmMessage: t.dm,
      buttons: [{ type: "url", title: t.button, url: link(source, lang) }],
      commentReply: t.replies[0],
      commentReplyVariations: t.replies.slice(1),
      linkTracking: true,
    });
    console.log(`${r.status < 300 ? "✓" : "✗"} ${name}: HTTP ${r.status} ${r.status < 300 ? "" : JSON.stringify(r.json).slice(0, 300)}`);
  }
}
