// Customer emails for the orders that don't go to plan (es / ca / en / fr):
// refund issued, payment failed (order cancelled), print delayed, print problem
// (Gelato failed / parcel returned), excluded shipping area (auto-refunded), and the tracking
// code that arrives after the "shipped" email. Merged into the lifecycle email
// table of order-emails.ts, so they share its layout, greeting and sign-off.
//
// Voice: warm, direct, short, honest about what happens next, always a human
// contact. No em-dashes.

import { escapeHtml } from "./layout";
import { formatPrice } from "@/lib/pricing";
import { SUPPORT_EMAIL } from "@/lib/support";
import type { OrderEmailContext } from "./order-emails";

export type OrderNoticeEvent =
  | "refund_issued"
  | "order_cancelled"
  | "print_delayed"
  | "print_problem"
  | "excluded_area"
  | "tracking_update";

export interface NoticeEventStrings {
  subject: (ctx: OrderEmailContext) => string;
  heading: string;
  paragraphs: (ctx: OrderEmailContext) => string[];
  /** Label of the library button when the notice has no better link. */
  ctaLabel?: string;
}

type Locale = "es" | "ca" | "en" | "fr";

const b = (c: OrderEmailContext) => `<strong>${escapeHtml(c.bookTitle)}</strong>`;
const support = `<a href="mailto:${SUPPORT_EMAIL}" style="color:inherit;font-weight:600;">${SUPPORT_EMAIL}</a>`;
const ref = (c: OrderEmailContext) => escapeHtml(c.reference ?? "");
const amount = (c: OrderEmailContext, loc: Locale) =>
  typeof c.amountCents === "number" && c.amountCents > 0 ? formatPrice(c.amountCents, loc) : null;
const postcode = (c: OrderEmailContext) => escapeHtml(c.postcode ?? "");
const compact = (lines: Array<string | null | false | undefined>): string[] => lines.filter((l): l is string => !!l);

export const ORDER_NOTICES: Record<Locale, Record<OrderNoticeEvent, NoticeEventStrings>> = {
  es: {
    refund_issued: {
      subject: (c) => `Te hemos devuelto el importe de ${c.bookTitle}`,
      heading: "Reembolso hecho",
      ctaLabel: "Ir a mi biblioteca",
      paragraphs: (c) =>
        compact([
          `${amount(c, "es") ? `Hemos devuelto ${amount(c, "es")} a tu tarjeta` : "Hemos hecho el reembolso"} por ${c.reference ? `el pedido ${ref(c)}` : "tu pedido"} de ${b(c)}.`,
          c.cancelledBeforeShipping && "El pedido queda cancelado y no se imprimirá.",
          "Según tu banco, puede tardar entre 5 y 10 días en aparecer en tu cuenta.",
          `Si tienes cualquier duda, escríbenos a ${support} y te respondemos.`,
        ]),
    },
    order_cancelled: {
      subject: (c) => `No hemos podido cobrar tu pedido de ${c.bookTitle}`,
      heading: "Tu pago no se ha completado",
      ctaLabel: "Ir a mi biblioteca",
      paragraphs: (c) => [
        `Tu banco no ha confirmado el pago del pedido de ${b(c)}, así que lo hemos cancelado. No se te ha cobrado nada.`,
        "Tu cuento sigue guardado. Puedes volver a pedirlo cuando quieras desde tu biblioteca.",
        `Si crees que es un error, escríbenos a ${support}.`,
      ],
    },
    print_delayed: {
      subject: (c) => `${c.bookTitle} va con un poco de retraso`,
      heading: "Tu libro va con retraso",
      paragraphs: (c) => [
        `La imprenta está tardando más de lo normal con ${b(c)}${c.reference ? ` (pedido ${ref(c)})` : ""}. Lo estamos siguiendo de cerca y te avisaremos en cuanto salga hacia casa.`,
        `Sentimos la espera. Si lo necesitas para una fecha concreta, escríbenos a ${support} y buscamos una solución.`,
      ],
    },
    print_problem: {
      subject: (c) => `Un problema con tu pedido de ${c.bookTitle}`,
      heading: "Estamos resolviendo un problema",
      paragraphs: (c) => [
        c.problemKind === "returned"
          ? `El paquete con ${b(c)}${c.reference ? ` (pedido ${ref(c)})` : ""} ha vuelto sin poder entregarse.`
          : `La imprenta nos ha avisado de un problema con ${b(c)}${c.reference ? ` (pedido ${ref(c)})` : ""} y no ha podido terminarlo.`,
        "Ya lo estamos revisando y te escribiremos personalmente muy pronto para solucionarlo. No tienes que hacer nada.",
        `Si quieres, puedes escribirnos a ${support}.`,
      ],
    },
    excluded_area: {
      subject: (c) => (amount(c, "es") ? `Te hemos devuelto el pedido de ${c.bookTitle}` : `Hemos cancelado tu pedido de ${c.bookTitle}`),
      heading: "De momento no enviamos allí",
      ctaLabel: "Ir a mi biblioteca",
      paragraphs: (c) =>
        compact([
          `Tu pedido ${ref(c)} iba a un código postal${c.postcode ? ` (${postcode(c)})` : ""} de Canarias, Ceuta o Melilla, y de momento no podemos enviar libros impresos allí. Lo sentimos mucho.`,
          amount(c, "es")
            ? `Por eso lo hemos cancelado y te hemos devuelto el importe completo, ${amount(c, "es")}. Según tu banco, puede tardar entre 5 y 10 días en aparecer en tu cuenta.`
            : "Por eso lo hemos cancelado. No se te ha cobrado nada.",
          `Tu cuento sigue guardado en tu biblioteca. Puedes pedirlo de nuevo con una dirección de la península o Baleares (la de un familiar, por ejemplo) o elegir el PDF, que llega a cualquier sitio.`,
          `Si tienes cualquier duda, escríbenos a ${support}.`,
        ]),
    },
    tracking_update: {
      subject: (c) => `Ya puedes seguir el envío de ${c.bookTitle}`,
      heading: "Aquí tienes el seguimiento",
      paragraphs: (c) => [
        `${b(c)} ya va de camino y el transportista nos acaba de pasar el número de seguimiento.`,
        c.trackingUrl
          ? "Puedes seguir el paquete con el botón de abajo."
          : "Puedes consultarlo en la web del transportista con el número de abajo.",
      ],
    },
  },
  ca: {
    refund_issued: {
      subject: (c) => `T'hem retornat l'import de ${c.bookTitle}`,
      heading: "Reemborsament fet",
      ctaLabel: "Anar a la meva biblioteca",
      paragraphs: (c) =>
        compact([
          `${amount(c, "ca") ? `Hem retornat ${amount(c, "ca")} a la teva targeta` : "Hem fet el reemborsament"} per ${c.reference ? `la comanda ${ref(c)}` : "la teva comanda"} de ${b(c)}.`,
          c.cancelledBeforeShipping && "La comanda queda cancel·lada i no s'imprimirà.",
          "Segons el teu banc, pot trigar entre 5 i 10 dies a aparèixer al teu compte.",
          `Si tens qualsevol dubte, escriu-nos a ${support} i et responem.`,
        ]),
    },
    order_cancelled: {
      subject: (c) => `No hem pogut cobrar la teva comanda de ${c.bookTitle}`,
      heading: "El teu pagament no s'ha completat",
      ctaLabel: "Anar a la meva biblioteca",
      paragraphs: (c) => [
        `El teu banc no ha confirmat el pagament de la comanda de ${b(c)}, així que l'hem cancel·lada. No se t'ha cobrat res.`,
        "El teu conte continua guardat. El pots tornar a demanar quan vulguis des de la teva biblioteca.",
        `Si creus que és un error, escriu-nos a ${support}.`,
      ],
    },
    print_delayed: {
      subject: (c) => `${c.bookTitle} va amb una mica de retard`,
      heading: "El teu llibre va amb retard",
      paragraphs: (c) => [
        `La impremta està trigant més del normal amb ${b(c)}${c.reference ? ` (comanda ${ref(c)})` : ""}. Ho estem seguint de prop i t'avisarem quan surti cap a casa.`,
        `Sentim l'espera. Si el necessites per a una data concreta, escriu-nos a ${support} i buscarem una solució.`,
      ],
    },
    print_problem: {
      subject: (c) => `Un problema amb la teva comanda de ${c.bookTitle}`,
      heading: "Estem resolent un problema",
      paragraphs: (c) => [
        c.problemKind === "returned"
          ? `El paquet amb ${b(c)}${c.reference ? ` (comanda ${ref(c)})` : ""} ha tornat sense poder-se lliurar.`
          : `La impremta ens ha avisat d'un problema amb ${b(c)}${c.reference ? ` (comanda ${ref(c)})` : ""} i no l'ha pogut acabar.`,
        "Ja ho estem revisant i t'escriurem personalment molt aviat per solucionar-ho. No has de fer res.",
        `Si vols, pots escriure'ns a ${support}.`,
      ],
    },
    excluded_area: {
      subject: (c) => (amount(c, "ca") ? `T'hem retornat la comanda de ${c.bookTitle}` : `Hem cancel·lat la teva comanda de ${c.bookTitle}`),
      heading: "De moment no hi enviem",
      ctaLabel: "Anar a la meva biblioteca",
      paragraphs: (c) =>
        compact([
          `La teva comanda ${ref(c)} anava a un codi postal${c.postcode ? ` (${postcode(c)})` : ""} de les Canàries, Ceuta o Melilla, i de moment no hi podem enviar llibres impresos. Ho sentim molt.`,
          amount(c, "ca")
            ? `Per això l'hem cancel·lada i t'hem retornat l'import complet, ${amount(c, "ca")}. Segons el teu banc, pot trigar entre 5 i 10 dies a aparèixer al teu compte.`
            : "Per això l'hem cancel·lada. No se t'ha cobrat res.",
          `El teu conte continua guardat a la teva biblioteca. El pots tornar a demanar amb una adreça de la península o les Balears (la d'un familiar, per exemple) o triar el PDF, que arriba a qualsevol lloc.`,
          `Si tens qualsevol dubte, escriu-nos a ${support}.`,
        ]),
    },
    tracking_update: {
      subject: (c) => `Ja pots seguir l'enviament de ${c.bookTitle}`,
      heading: "Aquí tens el seguiment",
      paragraphs: (c) => [
        `${b(c)} ja és de camí i el transportista ens acaba de passar el número de seguiment.`,
        c.trackingUrl
          ? "Pots seguir el paquet amb el botó de sota."
          : "El pots consultar al web del transportista amb el número de sota.",
      ],
    },
  },
  en: {
    refund_issued: {
      subject: (c) => `We've refunded your order for ${c.bookTitle}`,
      heading: "Refund done",
      ctaLabel: "Go to my library",
      paragraphs: (c) =>
        compact([
          `${amount(c, "en") ? `We've refunded ${amount(c, "en")} to your card` : "We've refunded your payment"} for ${c.reference ? `order ${ref(c)}` : "your order"}, ${b(c)}.`,
          c.cancelledBeforeShipping && "The order is cancelled and won't be printed.",
          "Depending on your bank, it can take 5 to 10 days to show up in your account.",
          `Any questions, write to ${support} and we'll get back to you.`,
        ]),
    },
    order_cancelled: {
      subject: (c) => `We couldn't take payment for ${c.bookTitle}`,
      heading: "Your payment didn't go through",
      ctaLabel: "Go to my library",
      paragraphs: (c) => [
        `Your bank didn't confirm the payment for ${b(c)}, so we've cancelled the order. You haven't been charged.`,
        "Your story is still saved. You can order it again whenever you like from your library.",
        `If you think this is a mistake, write to ${support}.`,
      ],
    },
    print_delayed: {
      subject: (c) => `${c.bookTitle} is running a little late`,
      heading: "Your book is running late",
      paragraphs: (c) => [
        `The print studio is taking longer than usual with ${b(c)}${c.reference ? ` (order ${ref(c)})` : ""}. We're keeping a close eye on it and will let you know as soon as it ships.`,
        `Sorry for the wait. If you need it by a particular date, write to ${support} and we'll find a solution.`,
      ],
    },
    print_problem: {
      subject: (c) => `A problem with your order for ${c.bookTitle}`,
      heading: "We're sorting out a problem",
      paragraphs: (c) => [
        c.problemKind === "returned"
          ? `The parcel with ${b(c)}${c.reference ? ` (order ${ref(c)})` : ""} came back undelivered.`
          : `The print studio told us about a problem with ${b(c)}${c.reference ? ` (order ${ref(c)})` : ""} and couldn't finish it.`,
        "We're already looking into it and will write to you personally very soon to put it right. You don't need to do anything.",
        `If you like, you can write to us at ${support}.`,
      ],
    },
    excluded_area: {
      subject: (c) => (amount(c, "en") ? `We've refunded your order of ${c.bookTitle}` : `We've cancelled your order of ${c.bookTitle}`),
      heading: "We don't ship there yet",
      ctaLabel: "Go to my library",
      paragraphs: (c) =>
        compact([
          `Your order ${ref(c)} was going to a postcode${c.postcode ? ` (${postcode(c)})` : ""} in the Canary Islands, Ceuta or Melilla, where we can't ship printed books yet. We're really sorry.`,
          amount(c, "en")
            ? `So we've cancelled it and refunded the full amount, ${amount(c, "en")}. Depending on your bank, it can take 5 to 10 days to show in your account.`
            : "So we've cancelled it. You haven't been charged anything.",
          `Your story is still saved in your library. You can order it again with an address in mainland Spain or the Balearic Islands (a relative's, for example) or choose the PDF, which reaches you anywhere.`,
          `If you have any questions, write to us at ${support}.`,
        ]),
    },
    tracking_update: {
      subject: (c) => `You can now track ${c.bookTitle}`,
      heading: "Here's your tracking",
      paragraphs: (c) => [
        `${b(c)} is on its way and the carrier has just sent us the tracking number.`,
        c.trackingUrl
          ? "You can follow the parcel with the button below."
          : "You can check it on the carrier's website with the number below.",
      ],
    },
  },
  fr: {
    refund_issued: {
      subject: (c) => `Nous vous avons remboursé ${c.bookTitle}`,
      heading: "Remboursement effectué",
      ctaLabel: "Aller à ma bibliothèque",
      paragraphs: (c) =>
        compact([
          `${amount(c, "fr") ? `Nous avons remboursé ${amount(c, "fr")} sur votre carte` : "Nous avons effectué le remboursement"} pour ${c.reference ? `la commande ${ref(c)}` : "votre commande"}, ${b(c)}.`,
          c.cancelledBeforeShipping && "La commande est annulée et ne sera pas imprimée.",
          "Selon votre banque, le montant peut mettre 5 à 10 jours à apparaître sur votre compte.",
          `Pour toute question, écrivez-nous à ${support}, nous vous répondrons.`,
        ]),
    },
    order_cancelled: {
      subject: (c) => `Le paiement de votre commande ${c.bookTitle} n'a pas abouti`,
      heading: "Votre paiement n'a pas abouti",
      ctaLabel: "Aller à ma bibliothèque",
      paragraphs: (c) => [
        `Votre banque n'a pas confirmé le paiement de ${b(c)}, nous avons donc annulé la commande. Rien ne vous a été débité.`,
        "Votre histoire reste enregistrée. Vous pouvez la commander à nouveau quand vous voulez depuis votre bibliothèque.",
        `Si vous pensez qu'il s'agit d'une erreur, écrivez-nous à ${support}.`,
      ],
    },
    print_delayed: {
      subject: (c) => `${c.bookTitle} a un peu de retard`,
      heading: "Votre livre a du retard",
      paragraphs: (c) => [
        `L'atelier d'impression prend plus de temps que prévu pour ${b(c)}${c.reference ? ` (commande ${ref(c)})` : ""}. Nous suivons cela de près et vous préviendrons dès son expédition.`,
        `Désolés pour l'attente. Si vous en avez besoin pour une date précise, écrivez-nous à ${support} et nous trouverons une solution.`,
      ],
    },
    print_problem: {
      subject: (c) => `Un problème avec votre commande ${c.bookTitle}`,
      heading: "Nous réglons un problème",
      paragraphs: (c) => [
        c.problemKind === "returned"
          ? `Le colis contenant ${b(c)}${c.reference ? ` (commande ${ref(c)})` : ""} nous est revenu sans avoir pu être livré.`
          : `L'atelier d'impression nous a signalé un problème avec ${b(c)}${c.reference ? ` (commande ${ref(c)})` : ""} et n'a pas pu le terminer.`,
        "Nous nous en occupons déjà et vous écrirons personnellement très vite pour y remédier. Vous n'avez rien à faire.",
        `Si vous le souhaitez, écrivez-nous à ${support}.`,
      ],
    },
    excluded_area: {
      subject: (c) => (amount(c, "fr") ? `Nous vous avons remboursé la commande ${c.bookTitle}` : `Nous avons annulé votre commande ${c.bookTitle}`),
      heading: "Nous ne livrons pas encore là-bas",
      ctaLabel: "Aller à ma bibliothèque",
      paragraphs: (c) =>
        compact([
          `Votre commande ${ref(c)} devait être livrée à un code postal${c.postcode ? ` (${postcode(c)})` : ""} des Canaries, de Ceuta ou de Melilla, où nous ne pouvons pas encore livrer de livres imprimés. Nous en sommes vraiment désolés.`,
          amount(c, "fr")
            ? `Nous l'avons donc annulée et vous avons remboursé la totalité, ${amount(c, "fr")}. Selon votre banque, le montant peut mettre 5 à 10 jours à apparaître sur votre compte.`
            : "Nous l'avons donc annulée. Rien ne vous a été débité.",
          `Votre histoire reste enregistrée dans votre bibliothèque. Vous pouvez la commander à nouveau avec une adresse en Espagne péninsulaire ou aux Baléares (celle d'un proche, par exemple) ou choisir le PDF, qui arrive partout.`,
          `Pour toute question, écrivez-nous à ${support}.`,
        ]),
    },
    tracking_update: {
      subject: (c) => `Vous pouvez suivre l'envoi de ${c.bookTitle}`,
      heading: "Voici votre suivi",
      paragraphs: (c) => [
        `${b(c)} est en route et le transporteur vient de nous transmettre le numéro de suivi.`,
        c.trackingUrl
          ? "Vous pouvez suivre le colis avec le bouton ci-dessous."
          : "Vous pouvez le consulter sur le site du transporteur avec le numéro ci-dessous.",
      ],
    },
  },
};
