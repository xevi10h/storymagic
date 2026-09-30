// Pre-paint inline scripts for the seasonal banner + marketing header. Plain
// strings with no React import, so the root layout (server) can use them too.
// The banner is server-rendered (no layout shift when it appears); these keep a
// dismissed banner and the header height right before the first paint, without
// reading cookies on the server (which would make every marketing page dynamic).

/** localStorage key holding the id of the banner message the visitor closed. */
export const DISMISS_KEY = "meapica.seasonBanner.dismissed";

/** <html> attribute mirroring DISMISS_KEY before paint (see SeasonalBanner's <style>). */
export const DISMISSED_ATTR = "data-season-dismissed";

/** <head> script: copy the dismissed id onto <html> so CSS hides that banner before paint. */
export const DISMISSED_HEAD_SCRIPT = `try{var d=localStorage.getItem(${JSON.stringify(DISMISS_KEY)});if(d)document.documentElement.setAttribute(${JSON.stringify(DISMISSED_ATTR)},d)}catch(e){}`;

/** Right after the fixed header: publish its height (banner included) before the page paints. */
export const NAV_HEIGHT_SCRIPT = `(function(){var s=document.currentScript,h=s&&s.previousElementSibling;if(h&&h.tagName==="HEADER")document.documentElement.style.setProperty("--landing-nav-h",Math.round(h.getBoundingClientRect().height)+"px")})()`;
