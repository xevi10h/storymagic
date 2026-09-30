"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useAuth } from "@/hooks/useAuth";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import BrandLogo from "@/components/BrandLogo";
import SeasonalBanner from "@/components/seasonal/SeasonalBanner";
import { NAV_HEIGHT_SCRIPT } from "@/components/seasonal/season-scripts";
import { brandBadge, buttonClass, cx, focusRing } from "@/components/ui";

type NavUser = { email?: string; user_metadata?: { full_name?: string; avatar_url?: string } };

/** Material Symbols glyph in a fixed box (no text flash / shift while the icon font loads). */
function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`material-symbols-outlined inline-block w-5 shrink-0 overflow-hidden text-center text-[20px] leading-5 ${className}`}
    >
      {name}
    </span>
  );
}

function displayName(user: NavUser, fallback: string): string {
  return user.user_metadata?.full_name || user.email?.split("@")[0] || fallback;
}

function Avatar({ user, name, size }: { user: NavUser; name: string; size: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm";
  const url = user.user_metadata?.avatar_url;
  return url ? (
    // Provider avatar (Google): external URL, plain <img>
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={`${box} rounded-full object-cover`} referrerPolicy="no-referrer" />
  ) : (
    <span aria-hidden className={`${box} flex items-center justify-center rounded-full ${brandBadge} font-bold`}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

const menuItem = cx(
  "flex min-h-11 w-full items-center gap-2.5 px-4 text-sm font-medium text-ink-soft transition-colors hover:bg-brand/5 hover:text-ink",
  focusRing,
);

function UserMenu({ user, onSignOut }: { user: NavUser; onSignOut: () => void }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const name = displayName(user, t("user"));

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={name}
        className={cx(
          "flex min-h-11 items-center gap-1.5 rounded-full border-2 border-line bg-surface py-1 pl-1 pr-2 transition-colors hover:border-brand/40",
          focusRing,
        )}
      >
        <Avatar user={user} name={name} size="sm" />
        <Icon name="expand_more" className="text-ink-muted" />
      </button>

      {open && (
        <div
          id={menuId}
          className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-2xl bg-surface py-1.5 shadow-card ring-1 ring-line"
        >
          <div className="border-b border-line px-4 py-2.5">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            <p className="truncate text-xs text-ink-muted">{user.email}</p>
          </div>
          <Link href="/dashboard" className={menuItem} onClick={() => setOpen(false)}>
            <Icon name="auto_stories" />
            {t("myBooks")}
          </Link>
          <Link href="/perfil" className={menuItem} onClick={() => setOpen(false)}>
            <Icon name="settings" />
            {t("myProfile")}
          </Link>
          <div className="mx-3 my-1 h-px bg-line" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className={menuItem}
          >
            <Icon name="logout" />
            {t("signOut")}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Marketing header (landing, blog, SEO pages). Fixed; publishes its height as
 * --landing-nav-h so the hero clears it even when the seasonal banner shows
 * (an inline script right after the header sets it before first paint, the
 * layout effect keeps it in sync afterwards). Mounted via the server `Navbar`,
 * which passes the season date so the banner is in the initial HTML.
 * Full nav from xl (1280). Below that a 44 px menu button opens a sheet; from lg (1024)
 * the primary "Crear su libro" stays in the bar next to it (the sticky CTA is < lg only).
 */
export default function NavbarClient({ seasonToday }: { seasonToday: string | null }) {
  const t = useTranslations("nav");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user: sessionUser, loading, signOut } = useAuth();
  // A guest (anonymous session) has no account yet: show "Entrar", never an avatar menu.
  const user = sessionUser && !sessionUser.is_anonymous ? sessionUser : null;
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const loginHref = pathname && pathname !== "/" ? `/auth/login?next=${encodeURIComponent(pathname)}` : "/auth/login";

  const navLinks = [
    { label: t("howItWorks"), href: "/#manifesto" },
    { label: t("books"), href: "/#catalog" },
    { label: t("sample"), href: "/ejemplo" },
    { label: t("faq"), href: "/#faq" },
  ];

  // Expose the header height (banner included) to the page.
  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty("--landing-nav-h", `${Math.round(el.getBoundingClientRect().height)}px`);
    publish();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--landing-nav-h");
    };
  }, []);

  // Close the sheet on Escape and when crossing to desktop width.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMobileOpen(false);
      // Disclosure pattern: focus goes back to the button that opened the sheet.
      toggleRef.current?.focus();
    };
    const mq = window.matchMedia("(min-width: 1280px)");
    const onMq = () => mq.matches && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
    };
  }, [mobileOpen]);

  const close = () => setMobileOpen(false);

  return (
    <>
      <header ref={navRef} className="fixed inset-x-0 top-0 z-50">
        <SeasonalBanner serverToday={seasonToday} />
        <div className={cx("relative z-50 border-b border-brand/10 backdrop-blur-md", mobileOpen ? "bg-paper" : "bg-paper/90")}>
          <nav
            aria-label={t("mainNav")}
            className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 lg:h-16"
          >
            <Link href="/" aria-label="Meapica" className={cx("flex min-h-11 shrink-0 items-center rounded-md", focusRing)} onClick={close}>
              <BrandLogo className="h-6 text-brand-deep lg:h-7" />
            </Link>

            <ul className="hidden items-center gap-1 xl:flex">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={cx(
                      "flex min-h-11 items-center rounded-full px-3.5 text-[15px] font-semibold text-ink-soft transition-colors hover:bg-brand/5 hover:text-ink",
                      focusRing,
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="hidden items-center gap-2 lg:ml-auto lg:flex xl:ml-0">
              <div className="hidden xl:block">
                <LocaleSwitcher />
              </div>
              {loading ? (
                // Reserve the signed-out layout (most visitors) so nothing shifts when auth resolves.
                <>
                  <span aria-hidden className={cx(buttonClass({ variant: "quiet", size: "sm" }), "invisible max-xl:hidden")}>
                    {t("signIn")}
                  </span>
                  <Link href="/crear" className={buttonClass({ size: "sm" })}>
                    {t("createBook")}
                  </Link>
                </>
              ) : user ? (
                <>
                  <Link href="/crear" className={buttonClass({ size: "sm" })}>
                    {t("createBook")}
                  </Link>
                  <div className="hidden xl:block">
                    <UserMenu user={user} onSignOut={signOut} />
                  </div>
                </>
              ) : (
                <>
                  <Link href={loginHref} className={buttonClass({ variant: "quiet", size: "sm", className: "max-xl:hidden" })}>
                    {t("signIn")}
                  </Link>
                  <Link href="/crear" className={buttonClass({ size: "sm" })}>
                    {t("createBook")}
                  </Link>
                </>
              )}
            </div>

            <button
              ref={toggleRef}
              type="button"
              className={cx(
                "-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-brand/5 xl:hidden",
                focusRing,
              )}
              onClick={() => setMobileOpen((o) => !o)}
              aria-expanded={mobileOpen}
              aria-controls={panelId}
              aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
            >
              <span aria-hidden className="material-symbols-outlined inline-block w-6 overflow-hidden text-2xl leading-6">
                {mobileOpen ? "close" : "menu"}
              </span>
            </button>
          </nav>

          {/* Mobile / tablet sheet */}
          <div
            id={panelId}
            inert={!mobileOpen}
            className={cx(
              "absolute inset-x-0 top-full origin-top border-b border-line bg-paper shadow-card transition-[opacity,transform] duration-200 motion-reduce:transition-none xl:hidden",
              mobileOpen ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
            )}
          >
            <div className="mx-auto max-w-[1200px] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2 sm:px-6">
              <ul className="divide-y divide-line">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={close}
                      className={cx(
                        "flex min-h-12 items-center justify-between font-display text-lg font-semibold text-ink transition-colors hover:text-brand-text",
                        focusRing,
                      )}
                    >
                      {link.label}
                      <Icon name="chevron_right" className="text-ink-muted" />
                    </Link>
                  </li>
                ))}
              </ul>

              {user && !loading && (
                <div className="mt-2 flex items-center gap-3 border-t border-line pt-4">
                  <Avatar user={user} name={displayName(user, t("user"))} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{displayName(user, t("user"))}</p>
                    <p className="truncate text-xs text-ink-muted">{user.email}</p>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-col gap-2.5">
                <Link href="/crear" onClick={close} className={buttonClass({ block: true, className: "h-12 lg:hidden" })}>
                  {t("createBook")}
                </Link>
                {loading ? null : user ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Link href="/dashboard" onClick={close} className={buttonClass({ variant: "secondary", size: "sm", block: true })}>
                      {t("myBooks")}
                    </Link>
                    <Link href="/perfil" onClick={close} className={buttonClass({ variant: "secondary", size: "sm", block: true })}>
                      {t("myProfile")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        signOut();
                      }}
                      className={cx(buttonClass({ variant: "quiet", size: "sm", block: true }), "col-span-2")}
                    >
                      {t("signOut")}
                    </button>
                  </div>
                ) : (
                  <Link href={loginHref} onClick={close} className={buttonClass({ variant: "secondary", size: "sm", block: true })}>
                    {t("signIn")}
                  </Link>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                <span className="text-xs font-bold uppercase tracking-wide text-ink-muted">{t("language")}</span>
                <LocaleSwitcher />
              </div>
            </div>
          </div>
        </div>

        {/* Backdrop under the sheet */}
        {mobileOpen && (
          <div aria-hidden className="fixed inset-0 -z-10 bg-scrim xl:hidden" onClick={close} />
        )}
      </header>
      {/* Runs while the HTML is parsed, before the page below paints: no jump
          when the server-rendered seasonal banner makes the header taller. */}
      <script dangerouslySetInnerHTML={{ __html: NAV_HEIGHT_SCRIPT }} />
    </>
  );
}
