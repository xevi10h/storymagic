import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 text-center">
      <div className="max-w-md">
        <div className="mb-6 inline-flex h-24 w-24 items-center justify-center rounded-full bg-badge-bg">
          <span className="material-symbols-outlined text-5xl text-text-muted">
            explore_off
          </span>
        </div>

        <h1 className="font-display text-3xl font-bold text-secondary">
          {t("title")}
        </h1>

        <p className="mt-4 text-base leading-relaxed text-text-muted">
          {t("description")}
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-white transition-all hover:bg-primary-hover active:scale-[0.98] shadow-md"
          >
            <span className="material-symbols-outlined text-lg">home</span>
            {t("backHome")}
          </Link>
          <Link
            href="/crear"
            className="text-sm text-text-muted hover:text-primary transition-colors"
          >
            {t("createStory")}
          </Link>
        </div>
      </div>
    </div>
  );
}
