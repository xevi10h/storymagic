import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import CreationHeader from "@/components/crear/CreationHeader";

// Invalid, expired or no-longer-shareable link (the story was deleted): a friendly dead end.
export default async function SharedPreviewNotFound() {
  const t = await getTranslations("sharePreview.notFound");
  return (
    <div className="flex min-h-screen flex-col bg-create-bg" data-testid="share-not-found">
      <CreationHeader rightAction="none" />
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="max-w-md">
          <span aria-hidden className="material-symbols-outlined text-5xl text-create-primary">link_off</span>
          <h1 className="mt-4 font-display text-2xl font-bold text-secondary">{t("title")}</h1>
          <p className="mt-3 text-sm leading-relaxed text-text-muted">{t("body")}</p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Link
              href="/crear"
              className="inline-flex items-center gap-2 rounded-xl bg-create-primary px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-create-primary-hover"
            >
              <span aria-hidden className="material-symbols-outlined text-lg">auto_stories</span>
              {t("createCta")}
            </Link>
            <Link href="/" className="text-sm text-text-muted transition-colors hover:text-create-primary">
              {t("home")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
