/**
 * Pass-through root layout (next-intl pattern). The <html>/<body> document lives in
 * RootDocument, rendered by [locale]/layout.tsx (with the URL's locale as `lang`),
 * admin/layout.tsx and the unlocalized not-found.tsx, so the server HTML carries
 * the right `lang` on every locale instead of a hardcoded "es".
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
