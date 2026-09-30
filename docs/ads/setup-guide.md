# Ads setup guide (Meta paid + TikTok organic)

Decided 2026-09-30: budget < 300 €/month → **paid on Meta only (Instagram + Facebook)**, **TikTok organic only**
(TikTok Ads minimum is 50 €/day per campaign and 20 €/day per ad group). Languages: ES + CA first, EN as a variant.
Creatives: `creative-pack.md`. Organic calendar: `organic-calendar.md`. Research with sources:
the 2026-09-30 session research (Meta Graph API v26.0, AEPD cookie guide May 2024, TikTok budgets).

## 1. Accounts (owner, one time)

1. **Instagram** `@meapica`: create it, then Settings › Account type › **Professional › Business** (category: Books / Shopping).
2. **Facebook Page** "Meapica": create it and link the Instagram account (Page settings › Linked accounts).
3. **Meta Business portfolio** at business.facebook.com: add the Page and the Instagram account.
4. **Ad account** inside the portfolio: currency **EUR**, time zone **Europe/Madrid**. Both are permanent. Add the payment method.
5. **Dataset (Pixel)**: Events Manager › Connect data › Web › "Meapica web". Copy the **dataset id**.
6. **Conversions API token**: Events Manager › the dataset › Settings › Conversions API › *Generate access token*.
   Also copy the **test event code** (Test events tab).
7. **Domain**: Business settings › Brand safety › Domains › add `meapica.shop` → give Claude the TXT record to add to DNS.
8. **TikTok** `@meapica`: create the account, then Settings › Account › **Switch to Business Account**. No TikTok Ads account for now.

Hand Claude: dataset id, CAPI token, test event code, domain TXT. Claude sets them in Vercel and runs a test purchase.

## 2. Wiring (Claude)

```
vercel env add NEXT_PUBLIC_META_PIXEL_ID production
vercel env add META_CAPI_TOKEN production
vercel env add META_CAPI_TEST_EVENT_CODE production   # remove after the test
```
Redeploy (the pixel id is inlined at build time). Then check in Events Manager › Test events:
PageView / ViewContent / InitiateCheckout / Lead from the browser, and one Stripe **test-mode** Purchase that arrives
twice (Browser + Server) and is shown as **deduplicated**. Remove `META_CAPI_TEST_EVENT_CODE` afterwards.
Offline check of the server payload: `npx tsx scripts/check-meta-capi.mts`.

## 3. First campaign (≈ 8 €/day)

- **Campaign**: objective **Sales**, conversion location Website, event **Purchase**. Advantage+ placements.
- **Ad sets** (2 × 4 €/day, do not edit for 7 days):
  - `cat_ca`: Catalonia, language Catalan, CA creatives.
  - `es_es`: Spain excluding the Canary Islands, Ceuta and Melilla (we don't ship there), ES creatives.
  - Ages 25–65, Advantage+ audience on. Never target minors.
- **Ads**: 3–4 per ad set: V1 + V2 videos and the A1/A2 static images from `creative-pack.md`. Final URL with the UTMs from `creative-pack.md` §5.
- **Decision after 10–14 days**: with ≤ 2 purchases, switch the optimisation event to InitiateCheckout until volume grows.
  Merge into one ad set if one language clearly underperforms.
- **Christmas**: from 1 Nov add A5 ("Llega a tiempo") with the real cut-offs in `src/lib/shipping.ts`
  (re-quote Gelato's peak-season times first).

## 4. Organic (IG + TikTok)

- 4 posts/week from `organic-calendar.md`, alternating ES and CA.
- Schedule IG/FB in **Meta Business Suite › Planner** and TikTok in **TikTok Studio (web) › Schedule**. Both are native and free, so no API integration is needed at this volume.
- TikTok: turn on the **"AI-generated content"** label on posts that show the generated illustrations (TikTok policy). Meta adds its "AI info" label by itself when it detects it.
- Bio link: `https://meapica.shop/es?utm_source=instagram&utm_medium=organic_social` (TikTok: `utm_source=tiktok`).

## 5. What the site tracks (and when)

Nothing before consent. The banner shows only while `NEXT_PUBLIC_META_PIXEL_ID` is set, with *Rechazar* / *Aceptar* at equal weight and a "Configurar cookies" footer link to withdraw.
With consent:
- Pixel events: PageView, ViewContent, Lead, InitiateCheckout, Purchase.
- UTMs go into a 30-day cookie and are copied to the Stripe session metadata, so each order shows its source in the Stripe Dashboard.
- The server Purchase is sent through the Conversions API only when the buyer consented.
