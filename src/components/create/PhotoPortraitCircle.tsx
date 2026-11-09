"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { PhotoCharacter } from "@/lib/create-store";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Photo mode, inside the protagonist circle: the drawing made from the photo (how the child
 * will look in the book), a spinner while it is painted, or the "add a photo" icon.
 */
export default function PhotoPortraitCircle({
  name,
  photoCharacter,
  drawing,
}: {
  name: string;
  photoCharacter: PhotoCharacter | null;
  drawing: boolean;
}) {
  const t = useTranslations("crear.photoUi");
  // Signed URL older than its 24 h TTL (draft reopened the next day): the drawing still
  // anchors the book (its path is what the API gets), only the preview can't be shown.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (photoCharacter && failedUrl !== photoCharacter.portraitUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed URL of a private image (never through the optimizer)
      <img
        src={photoCharacter.portraitUrl}
        alt={t("portraitAlt", { name })}
        className="absolute inset-0 h-full w-full object-cover"
        onError={() => setFailedUrl(photoCharacter.portraitUrl)}
        data-testid="photo-portrait-image"
      />
    );
  }
  return (
    <span
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-create-primary/70"
      data-testid={drawing ? "photo-portrait-drawing" : undefined}
    >
      {drawing ? (
        <>
          <Spinner className="text-3xl lg:text-6xl" />
          <span className="hidden px-8 text-center text-sm font-bold text-create-text lg:block">{t("drawing", { name })}</span>
        </>
      ) : (
        <span aria-hidden className="material-symbols-outlined text-4xl lg:text-7xl" data-icon={photoCharacter ? "check_circle" : "add_a_photo"} />
      )}
    </span>
  );
}
