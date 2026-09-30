import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <>
      <Navbar />
      <main
        className="flex min-h-[80dvh] flex-col items-center justify-center bg-paper px-4 pb-16 text-center sm:px-6"
        style={{ paddingTop: "calc(var(--landing-nav-h, 56px) + 3rem)" }}
      >
        <p className="font-display text-6xl font-bold tabular-nums text-brand sm:text-7xl">404</p>
        <h1 className="mt-4 text-balance font-display text-[26px] font-bold leading-tight text-ink sm:text-4xl">{t("title")}</h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-ink-body">{t("description")}</p>
        <div className="mt-8 flex flex-col items-center gap-2">
          <Link href="/" className={buttonClass()}>
            {t("backHome")}
          </Link>
          <Link href="/crear" className={buttonClass({ variant: "quiet" })}>
            {t("createStory")}
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
