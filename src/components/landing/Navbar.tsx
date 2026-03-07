"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/hooks/useAuth";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import LogoIcon from "@/components/LogoIcon";

function UserMenu({
  user,
  onSignOut,
}: {
  user: { email?: string; user_metadata?: { full_name?: string; avatar_url?: string } };
  onSignOut: () => void;
}) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const name =
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    t("user");
  const avatarUrl = user.user_metadata?.avatar_url;
  const initials = name.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-border-light bg-white px-3 py-2 text-sm font-medium text-text-main transition-colors hover:border-border-medium hover:bg-cream"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="h-7 w-7 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
            {initials}
          </div>
        )}
        <span className="hidden max-w-30 truncate lg:block">{name}</span>
        <span className="material-symbols-outlined text-base text-text-muted">
          expand_more
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border-light bg-white py-1.5 shadow-lg">
          <div className="border-b border-border-light/50 px-4 py-2.5">
            <p className="text-sm font-medium text-text-main">{name}</p>
            <p className="text-xs text-text-muted">{user.email}</p>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-soft transition-colors hover:bg-cream hover:text-text-main"
            onClick={() => setOpen(false)}
          >
            <span className="material-symbols-outlined text-lg">auto_stories</span>
            {t("myBooks")}
          </Link>
          <Link
            href="/crear"
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-soft transition-colors hover:bg-cream hover:text-text-main"
            onClick={() => setOpen(false)}
          >
            <span className="material-symbols-outlined text-lg">edit</span>
            {t("createStory")}
          </Link>
          <Link
            href="/perfil"
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text-soft transition-colors hover:bg-cream hover:text-text-main"
            onClick={() => setOpen(false)}
          >
            <span className="material-symbols-outlined text-lg">settings</span>
            {t("myProfile")}
          </Link>
          <div className="mx-3 my-1 h-px bg-border-light/50" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-text-soft transition-colors hover:bg-cream hover:text-text-main"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            {t("signOut")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const t = useTranslations("nav");
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, loading, signOut } = useAuth();

  const navLinks = [
    { label: t("manifesto"), href: "#manifesto" },
    { label: t("collection"), href: "#catalog" },
    { label: t("artisanal"), href: "#artisanal" },
    { label: t("families"), href: "#reviews" },
  ];

  return (
    <nav className="fixed top-0 z-50 w-full px-4 py-4 transition-all duration-300">
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-lg border border-border-light bg-white/95 px-6 py-3 shadow-sm backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-3">
          <LogoIcon className="h-8 w-8 text-primary" />
          <span className="font-display text-2xl font-bold tracking-tight text-secondary">
            StoryMagic
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-text-soft transition-colors hover:text-primary"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <LocaleSwitcher />
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-lg bg-cream" />
          ) : user ? (
            <>
              <Link
                href="/crear"
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:bg-primary-hover active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
                {t("createMyStory")}
              </Link>
              <UserMenu user={user} onSignOut={signOut} />
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="rounded-lg px-4 py-2.5 text-sm font-medium text-text-soft transition-colors hover:text-text-main"
              >
                {t("signIn")}
              </Link>
              <Link
                href="/crear"
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:scale-105 hover:bg-primary-hover active:scale-95"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
                {t("createMyStory")}
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? t("closeMenu") : t("openMenu")}
        >
          <span className="material-symbols-outlined text-2xl text-text-main">
            {mobileOpen ? "close" : "menu"}
          </span>
        </button>
      </div>

      {mobileOpen && (
        <div className="mx-auto mt-2 max-w-6xl rounded-lg border border-border-light bg-white p-4 shadow-lg md:hidden">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block py-3 text-base font-medium text-text-soft transition-colors hover:text-primary"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}

          <div className="mt-3 border-t border-border-light/50 pt-3">
            <LocaleSwitcher />
            {loading ? null : user ? (
              <>
                <div className="flex items-center gap-3 py-2 mt-3">
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                      {(user.user_metadata?.full_name || user.email || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-text-main">
                      {user.user_metadata?.full_name || user.email?.split("@")[0]}
                    </p>
                    <p className="text-xs text-text-muted">{user.email}</p>
                  </div>
                </div>
                <Link
                  href="/dashboard"
                  className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-border-light px-5 py-3 text-sm font-medium text-text-soft transition-colors hover:bg-cream"
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="material-symbols-outlined text-lg">auto_stories</span>
                  {t("myBooks")}
                </Link>
                <Link
                  href="/crear"
                  className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-primary-hover"
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="material-symbols-outlined text-lg">edit</span>
                  {t("createMyStory")}
                </Link>
                <Link
                  href="/perfil"
                  className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-border-light px-5 py-3 text-sm font-medium text-text-soft transition-colors hover:bg-cream"
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="material-symbols-outlined text-lg">settings</span>
                  {t("myProfile")}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    signOut();
                  }}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-border-light px-5 py-3 text-sm font-medium text-text-soft transition-colors hover:bg-cream"
                >
                  <span className="material-symbols-outlined text-lg">logout</span>
                  {t("signOut")}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/crear"
                  className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-primary-hover"
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="material-symbols-outlined text-lg">edit</span>
                  {t("createMyStory")}
                </Link>
                <Link
                  href="/auth/login"
                  className="mt-2 block rounded-lg border border-border-light px-5 py-3 text-center text-sm font-medium text-text-soft transition-colors hover:bg-cream"
                  onClick={() => setMobileOpen(false)}
                >
                  {t("signIn")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
