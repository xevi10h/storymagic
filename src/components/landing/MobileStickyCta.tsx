import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * Persistent primary CTA pinned to the bottom on mobile only.
 * Keeps the conversion action one tap away through the whole landing scroll.
 */
export default function MobileStickyCta() {
  const t = useTranslations("hero");

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 md:hidden">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-cream via-cream/90 to-transparent" />
      <Link
        href="/crear"
        className="flex h-14 items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-bold text-white shadow-xl shadow-primary/20 transition-all active:scale-[0.98]"
      >
        {t("cta")}
        <span className="material-symbols-outlined text-xl">arrow_forward</span>
      </Link>
    </div>
  );
}
