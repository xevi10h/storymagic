type Locale = "es" | "ca" | "en" | "fr";

const CONTENT: Record<
  Locale,
  { subject: string; heading: string; body: string; signoff: string }
> = {
  es: {
    subject: "Bienvenido/a a Meapica — Estás en la lista",
    heading: "¡Estás dentro!",
    body: "Has reservado tu lugar en nuestra lista de espera. Estamos trabajando para traerte los cuentos personalizados más bonitos que tu hijo haya visto. Te avisaremos en cuanto estemos listos.",
    signoff: "Con cariño,\nEl equipo de Meapica",
  },
  ca: {
    subject: "Benvingut/da a Meapica — Estàs a la llista",
    heading: "Hi ets!",
    body: "Has reservat el teu lloc a la nostra llista d'espera. Estem treballant per portar-te els contes personalitzats més bonics que el teu fill hagi vist. T'avisarem quan estiguem a punt.",
    signoff: "Amb afecte,\nL'equip de Meapica",
  },
  en: {
    subject: "Welcome to Meapica — You're on the list",
    heading: "You're in!",
    body: "You've secured your spot on our waiting list. We're working to bring you the most beautiful personalized storybooks your child has ever seen. We'll let you know as soon as we're ready.",
    signoff: "With love,\nThe Meapica team",
  },
  fr: {
    subject: "Bienvenue chez Meapica — Vous êtes sur la liste",
    heading: "Vous y êtes !",
    body: "Vous avez réservé votre place sur notre liste d'attente. Nous travaillons pour vous apporter les plus beaux livres personnalisés que votre enfant ait jamais vus. Nous vous préviendrons dès que nous serons prêts.",
    signoff: "Avec amour,\nL'équipe Meapica",
  },
};

export function getWaitlistEmail(locale: string, recipientName?: string) {
  const loc = (["es", "ca", "en", "fr"].includes(locale) ? locale : "es") as Locale;
  const c = CONTENT[loc];

  const greeting = recipientName ? `${recipientName},` : "";

  const html = `<!DOCTYPE html>
<html lang="${loc}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#F9F5F0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9F5F0;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <!-- Logo -->
        <tr><td style="padding-bottom:32px;">
          <img src="https://meapica.com/images/meapica-logo.png" alt="Meapica" height="36" style="height:36px;width:auto;" />
        </td></tr>
        <!-- Card -->
        <tr><td style="background-color:#ffffff;border-radius:16px;padding:40px 36px;box-shadow:0 2px 12px rgba(44,24,16,0.06);">
          <h1 style="margin:0 0 8px;font-size:28px;color:#2C1810;font-weight:700;">${c.heading}</h1>
          ${greeting ? `<p style="margin:0 0 20px;font-size:16px;color:#5D4037;">${greeting}</p>` : ""}
          <p style="margin:0 0 28px;font-size:16px;line-height:1.7;color:#5D4037;">${c.body}</p>
          <div style="border-top:1px solid #E6C9A8;padding-top:24px;">
            <p style="margin:0;font-size:14px;color:#A1887F;white-space:pre-line;">${c.signoff}</p>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#A1887F;">&copy; 2026 Meapica. meapica.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [greeting, c.body, "---", c.signoff].filter(Boolean).join("\n\n");

  return { subject: c.subject, html, text };
}
