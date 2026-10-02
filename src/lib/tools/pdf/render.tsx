// Server-only: renders a validated tool input (schema.ts) to an A4 PDF in memory.
// Nothing is stored and no child data is logged.

import { renderToBuffer } from "@react-pdf/renderer";
import { ensurePdfFontsLoaded } from "@/lib/pdf/fonts";
import { BRAND_LOGO_ASPECT, getBrandLogoPng } from "@/lib/pdf/assets";
import { formatChildName } from "@/lib/child-name";
import { giftSeason, spainToday } from "@/lib/shipping";
import { avatarPortraitPng } from "../avatar-png";
import { LETTER_COPY } from "../letter-copy";
import { composeReply } from "../reply-templates";
import type { ToolInput } from "../schema";
import { LetterDocument } from "./letter-document";
import { ReplyDocument } from "./reply-document";

/** ASCII slug of the name for the file name ("María José" → "maria-jose"). */
export function fileSlug(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/·/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "nen";
}

const FILE_PREFIX = {
  letter: { es: "carta-reyes-magos", ca: "carta-reis-orient" },
  reply: { es: "respuesta-reyes-magos", ca: "resposta-reis-orient" },
} as const;

export async function renderToolPdf(input: ToolInput): Promise<{ pdf: Buffer; filename: string }> {
  await ensurePdfFontsLoaded();
  const name = formatChildName(input.name);
  const [portraitPng, logoPng] = await Promise.all([avatarPortraitPng(input.avatar), getBrandLogoPng("#5D4037")]);

  const element =
    input.tool === "letter" ? (
      <LetterDocument
        copy={LETTER_COPY[input.locale]}
        name={name}
        age={input.age}
        layout={input.layout}
        portraitPng={portraitPng}
        logoPng={logoPng}
        logoAspect={BRAND_LOGO_ASPECT}
      />
    ) : (
      <ReplyDocument
        reply={composeReply(
          { ...input, name, gender: input.avatar.gender },
          giftSeason(spainToday()).christmasYear + 1,
        )}
        portraitPng={portraitPng}
        logoPng={logoPng}
        logoAspect={BRAND_LOGO_ASPECT}
      />
    );

  const pdf = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);
  return { pdf, filename: `${FILE_PREFIX[input.tool][input.locale]}-${fileSlug(name)}.pdf` };
}
