# Marketing Strategy

## Communication plan Q4 2026: borrowed audiences, near-zero cost (written 2026-10-09)

Starting point (2026-10-09): 0 paid orders from strangers, 15 of 90 URLs indexed, 2-6 s average watch time on
social, ~3 followers per network, no reviews, brand name unknown (Google autocorrects "meapica" to Emapica).
Gross margin per book before AI cost and acquisition: hardcover ~30 €, softcover ~19 €, PDF ~9 €. Paid
acquisition cannot be the engine at this margin: every channel below borrows someone else's audience or
turns a customer into the next ad.

**Deadlines that frame everything** (`src/lib/shipping.ts`): printed book for Christmas, order by 10 Dec;
for Reyes, by 22 Dec. After that only the PDF, or a gift voucher (not built yet).

**One message per audience, always with the proof:**
- Parents (es): "Su nombre en la portada y su cara en cada página. Ves las primeras páginas antes de pagar."
- Catalan families: "Escrit en català, no traduït." This is the one SERP and press space with no big competitor.
- Grandparents and aunts/uncles: "El regalo que guardará cuando sea mayor."
- Schools/AFA and companies: "Un regalo de lectura sin pantallas que además financia la clase."
What sets us apart against Librio, Wonderbly and Mumablue, which have 700-800 reviews and 30-35 € prices: the free
preview before paying, the child's real likeness in watercolour, and native Catalan.

### Phase 1, now to 31 Oct: proof
1. Creators, first wave: the replies to @onanemdema and @familiacaricu are still Gmail drafts (owner sends).
   Every redeemed book: ask for a reaction video plus written permission to reuse it in ads and on the site.
   Second wave, 10 more creators from `docs/outreach/creators-2026-10.md`, once the first books arrive (Sabadell: 19-20 Oct).
2. Reviews: open Trustpilot and a Google Business Profile; ask every creator and buyer 5 days after delivery.
   Wire them into `ProductJsonLd`. Target: 10 real reviews by 15 Nov.
3. Social: keep one post a day, but double the format that already works (bedtime story in 1 minute: 1,346 views,
   best watch time). Same video to Reels, TikTok, Shorts and Pinterest at no extra cost.

### Phase 2, 20 Oct to 30 Nov: borrowed audiences
4. Press for Reyes: 18 pitches in `docs/outreach/reyes-2026-targets.csv` are Gmail drafts, unsent. Roundups of
   "carta a los Reyes para imprimir" are refreshed in November: send them in the last week of October.
   Add Catalan media with the tió page (Ara Criatures, Sortir amb Nens, Criatures, Petit Explorador) and gift
   guides that pay affiliate commission instead of charging for placement.
5. AFA/AMPA (Catalonia first) and companies: a Stripe promotion code per school (already supported:
   `allow_promotion_codes`), 10 % off for families plus 5 € per book to the class. Companies: Christmas gift for
   employees' children. One deal = 50-400 books. Leads via the `lead-research` skill, emails from hola@meapica.shop.
6. Every book is an ad: last page with a QR "crea el de un amigo" plus a 10 € code for both families
   (referral, not built), and the grandparents share link from the preview (exists: `src/lib/share/`) pushed in the
   preview UI and the reminder emails.

### Phase 3, 1 Nov to 22 Dec: urgency
7. Deadline countdown in banner, social and reminder emails: "último día para que llegue en Navidad / Reyes".
8. Gift voucher for late buyers (not built): buy now, the family creates the book in January. Turns the dead
   period after 22 Dec into sales.
9. Paid, only on proven winners: boost the best creator reaction video, 50-100 € total, Spain 25-44 + grandparents
   55-70. No cold ads with AI-only creatives. Meta has no payment method yet; TikTok balance is 0.

### Measure weekly (Monday)
Previews created, paid orders and revenue (`node scripts/growth-funnel.mjs --days 7`), orders per promo code /
UTM source, reviews count, indexed URLs. Kill a channel after 2 weeks with no previews; double the one that
brings orders.

Cost of the whole plan: gifted creator books at ~17 € each, plus at most 100 € of ads. Owner time: sending
emails/DMs drafted by Claude, calls with AFA and companies, opening review profiles.

## Core Message

**"Convierte a tu hijo en el protagonista de su propia aventura mágica."**

Secondary messages:
- "Menos pantallas, más historias para tocar."
- "Cada libro es único. Como tu hijo."
- "No es un cuento más. Es SU cuento."

## Brand Voice

| Attribute | Description |
|-----------|-------------|
| Tone | Warm, magical, empowering — never condescending |
| Feel | Artisanal, handcrafted, intimate — NOT "powered by AI" |
| Language | Simple, direct, emotional — speaks to parents' hearts |
| Avoid | Tech jargon, AI buzzwords, corporate language, generic "innovation" claims |

## Target Audiences

### Segment 1: Modern Moms (Primary)
- **Who:** Women 28-42, 1-2 children aged 2-8
- **Where:** Instagram, parenting blogs, WhatsApp groups
- **Motivation:** Unique gifts, reduce screen time, quality family moments
- **Message:** "Create something magical together"
- **Ad angle:** Unboxing videos, child's reaction to seeing themselves in a book

### Segment 2: Gift-Giving Grandparents (Secondary)
- **Who:** 55-70, looking for meaningful gifts
- **Where:** Facebook, Google Search
- **Motivation:** Stand out as the "special" gift-giver
- **Message:** "The gift they'll never forget"
- **Ad angle:** Testimonials, quality/premium positioning

### Segment 3: Aunts/Uncles/Friends (Tertiary)
- **Who:** 25-45, no kids but buying for others
- **Where:** Instagram, Google Search ("regalo personalizado niños")
- **Motivation:** Unique birthday/communion gift
- **Message:** "Not another toy. A story that lasts forever."
- **Ad angle:** Gift wrapping, ease of ordering

## Channel Strategy

### Tier 1: Organic Foundation
| Channel | Action | Goal |
|---------|--------|------|
| Instagram | 3-4 posts/week: unboxings, illustrations, process, testimonials | Build community, social proof |
| SEO Blog | Articles: "mejores regalos niños", "cuentos personalizados", "alternativas a pantallas" | Organic traffic |
| Pinterest | Illustration pins, book photos, gift ideas | Visual discovery traffic |

### Tier 2: Paid Acquisition
| Channel | Budget | Targeting |
|---------|--------|-----------|
| Instagram/Facebook Ads | Start with 50-100 EUR/month test | Parents 28-45, interests: parenting, children's books, gifts |
| Google Ads | 50-100 EUR/month test | "regalo personalizado niños", "cuento con nombre de mi hijo", "libros personalizados" |

### Tier 3: Partnerships
| Channel | Action |
|---------|--------|
| Parenting influencers | Gift 10 books to micro-influencers (5K-50K followers) in exchange for honest reviews |
| Parenting groups | Share in Facebook/WhatsApp parenting communities (authentic, not spammy) |
| Schools/nurseries | Pilot programs with local schools |

## Content Calendar (Weekly)

| Day | Content Type | Example |
|-----|-------------|---------|
| Monday | Behind the scenes | How an illustration is made (watercolor process) |
| Wednesday | Product showcase | Finished book photos, page spreads |
| Friday | Emotional content | Child reaction to receiving their book, parent testimonial |
| Saturday | Story snippet | Share a passage from a template story |

## Launch Campaign

### Pre-launch (2 weeks before)
- Landing page with email capture ("Be first to create your child's story")
- Teaser content on Instagram (illustrations, sneak peeks)
- Early access list: 20% discount for first 50 orders

### Launch Week
- Product reveal post
- First influencer reviews go live
- Limited-time launch offer (free shipping or included Pack Aventura)
- Email blast to waitlist

### Post-launch (Ongoing)
- Testimonial collection and sharing
- Retargeting ads for cart abandoners
- Email sequences: welcome → education → conversion → post-purchase → saga upsell

## Key Copy Examples

**Ad headline (Instagram):**
"¿Y si tu hijo fuera el héroe de su propia aventura?"

**Ad body:**
"Leo tiene 5 años y le encantan los dinosaurios. Ahora vive su propia aventura en un libro ilustrado hecho solo para él. Cada página, cada ilustración, cada detalle... creado a mano para que se sienta el protagonista que es."

**Email subject lines:**
- "El cuento de [nombre] está casi listo..."
- "Mira quién es el nuevo héroe del barrio"
- "Un regalo que no se queda sin pilas"

**CTA variations:**
- "Crear la aventura de [nombre]"
- "Empezar mi cuento"
- "Regalar una historia única"

## Low-CAC Go-To-Market Playbook

The objective is to generate first visits and purchases without relying on paid ads. Paid media should be used only as a small testing layer after organic proof exists.

### Strategic Principle

meapica should not market itself as an AI book generator. The most defensible low-CAC position is:

**"The first personalized book parents can proudly show because it feels like a handcrafted keepsake, not a mass-produced template."**

The acquisition engine should be built around moments that people already share:

- The child's reaction when they see themselves in the book
- The family gift moment
- The unboxing ritual
- The parent-child co-creation process
- The finished physical object

### Priority 1: Reaction-Led Social Proof

Every early order should be treated as a content asset, not only a transaction.

Actions:
- Offer the first 20-50 beta buyers a strong founder discount in exchange for reaction photos/videos and honest feedback.
- Add a post-delivery email asking for the child's reaction, not a generic review.
- Include a small card in the package: "Capture the moment when [child_name] discovers the hero."
- Build a landing section around real reactions: child face, book spread, parent quote, child name anonymized if needed.

Why it works:
- Parents buy emotionally, but need proof that the child will care.
- A reaction video is more persuasive than a polished ad.
- It creates assets for Instagram, TikTok, Pinterest, email, ads, and SEO.

### Priority 2: Referral As The Default Purchase Path

The best customer acquisition channel is another family in the same social circle.

Actions:
- Give every buyer a personalized referral link after checkout and in post-delivery emails.
- Reward both sides: referrer gets a future chapter/PDF/pack credit; new buyer gets free shipping or the adventure pack.
- Use child-safe wording: referrals are for parents, never framed as asking children to promote.
- Add "gift another child in the family" after purchase with a second-copy or cousin/sibling flow.

Best early mechanic:
**"Regala 10 EUR a otra familia y consigue el próximo capítulo digital gratis."**

Why it works:
- Families with children cluster: school, birthdays, cousins, WhatsApp groups.
- A personalized book naturally prompts "where did you get that?"
- Rewarding future chapters pushes repeat purchase and the saga model.

### Priority 3: Local Community Launch

Start in a narrow geographic/social area instead of trying to market to all Spain.

Actions:
- Pick 1-2 launch cities or neighborhoods where the founder has access.
- Create city-personalized examples: "Piratas del Mar de Barcelona", "El Bosque Mágico de Sant Cugat".
- Contact parent associations, nurseries, children's bookshops, toy stores, libraries, and birthday venues.
- Offer a revenue-share code to each partner instead of paying upfront.
- Run small "story creation afternoon" events where parents create the book with children on a tablet and order on-site.

Why it works:
- Local trust lowers CAC.
- City personalization makes the product feel less generic.
- Partners care if they earn without inventory or operational risk.

### Priority 4: AI-Assisted Content Factory

Use AI to create cheap, high-volume, but non-generic acquisition assets.

Actions:
- Generate SEO pages and blog posts around high-intent gift queries, but make each page genuinely useful and locally relevant.
- Build seasonal landing pages: birthdays, Christmas, communions, Father's Day, Mother's Day, end of school year.
- Create template-specific pages: space book, pirate book, forest book, superhero book, chef book.
- Create city pages only where the story templates can make the city feel meaningful, not doorway spam.
- Turn every generated book into anonymized content snippets: title, spread mockup, dedication example, theme angle.

High-intent SEO angles:
- regalos personalizados para niños
- cuentos personalizados infantiles
- regalo comunión niño / niña
- regalo original para nietos
- regalo para niño que lo tiene todo
- alternativas a pantallas niños
- cuentos para dormir personalizados

Why it works:
- SEO compounds over time and has low marginal cost.
- AI makes content production cheap, but human curation keeps quality high.
- Long-tail gift searches convert better than broad parenting content.

### Priority 5: Micro-Influencers With No Cash Fee

Do not start with paid influencer campaigns. Start with creator-product exchange and revenue share.

Actions:
- Send finished books to 20-30 micro-creators in parenting, children's books, Montessori, homeschooling, motherhood, and local family accounts.
- Prioritize creators with high comment quality over follower count.
- Give each creator a personalized book, affiliate link, and limited code for their audience.
- Ask for an honest reaction/unboxing, not scripted promotion.
- Track conversion by code and repeat only with creators who produce purchases.

Why it works:
- The product is visually and emotionally shareable.
- Smaller creators are more reachable and less expensive.
- Affiliate structure keeps cash CAC low.

### Priority 6: School And Nursery Fundraising

Position meapica as a fundraising product, not a vendor asking schools to buy.

Actions:
- Offer schools and nursery parent associations a custom code.
- For every book bought with the code, donate 5-10 EUR to the class, library, or end-of-year activity.
- Create a school landing page explaining the fundraiser and showing sample books.
- Offer class-themed story variants post-MVP.

Why it works:
- Schools and parent associations already coordinate group purchases.
- Fundraising creates a reason to share in parent WhatsApp groups.
- The product aligns with reading and reduced screen time.

### Priority 7: Gift Calendar Automation

The product should chase gift moments automatically.

Actions:
- Capture birthday month and relationship during checkout or post-purchase.
- Send reminders 4 weeks before birthdays, communions, Christmas, and school-year endings.
- Create "grandparent gift" and "aunt/uncle gift" flows with simpler personalization.
- Add gift cards when production lead time is too short.

Why it works:
- The same buyer can purchase for siblings, cousins, classmates, and future chapters.
- Reminder-based lifecycle marketing is cheaper than reacquiring customers.

### Priority 8: The Meapica Story Club

Build a lightweight community layer before building a full subscription.

Actions:
- Invite buyers into a monthly "new adventure ideas" email.
- Let children vote on the next template theme through parents.
- Feature one anonymous "hero of the month" book spread.
- Offer early access to new templates to past buyers.

Why it works:
- Keeps customers warm for repeat purchases.
- Makes the saga system feel alive before it is fully built.
- Generates product insights from real families.

### Priority 9: Out-Of-The-Box AI Plays

Low-cost experiments that would have been expensive before AI:

- **Personalized sample preview ads:** Generate anonymized sample spreads for common names and interests, then use them organically: "Así se vería una aventura de Martina si le encantan los dinosaurios."
- **Name-based SEO/social series:** Publish examples by popular child names: Martina, Leo, Olivia, Hugo, etc. This creates immediate emotional recognition.
- **WhatsApp preview generator:** Let users create a free one-page preview and share it with family before buying. The shared preview drives referral traffic.
- **Grandparent letter mode:** Generate a printable letter "from the future book" that grandparents can give before the real book arrives.
- **Birthday party bundle:** One birthday child gets a book; guests receive a small printable coloring page featuring the hero and a QR to create their own.
- **Library/bookshop demo copy:** Create physical demo books with local city names and leave them in partner locations with QR codes.
- **Teacher reading kit:** A free PDF classroom activity around "being the protagonist of a story" with a subtle parent-facing coupon.
- **Personalized audio teaser:** After preview generation, send a 30-second narrated intro using the child's name. This can convert hesitant parents before print purchase.

### 30-Day Launch Sprint

Week 1:
- Finalize 3-5 physical demo books.
- Recruit 20 beta families from personal/local networks.
- Set up referral links/codes manually if needed.
- Create 10 short-form content pieces from product demos.

Week 2:
- Ship beta orders or deliver locally.
- Capture reaction content and testimonials.
- Contact 30 micro-creators and 20 local partners.
- Publish first high-intent SEO pages.

Week 3:
- Launch first referral loop to beta families.
- Run 1-2 local partner demos.
- Publish real reaction assets.
- Test one small paid retargeting campaign only to site visitors/waitlist.

Week 4:
- Double down on the two channels producing actual checkout starts.
- Add school/nursery fundraising outreach.
- Package best testimonials into landing page sections.
- Prepare Christmas/communion/birthday seasonal pages depending on calendar.

## Remote-Only Engagement Strategy

This strategy assumes the founder does not want to handle physical logistics, events, school visits, local deliveries, or manual packages. All acquisition should be operated from a computer, with printing/shipping handled by providers and content/community handled remotely.

### What To Avoid

- Do not build a content calendar that depends on the founder filming daily.
- Do not pay a fixed monthly fee to a social media manager before proving that the account can drive checkout starts.
- Do not over-index on polished brand videos. The product needs emotional proof, not agency-style ads.
- Do not make "AI-generated book" the public hook. It invites comparison with cheap AI tools and lowers perceived quality.
- Do not buy broad traffic. If paid is used, it should amplify winning creator content or retarget warm visitors.

### Best Remote Acquisition System

The strongest remote setup is a creator/content operating system:

1. Founder or operator defines weekly hooks, offers, and tests.
2. UGC creators produce raw videos from scripts, mockups, or their own personalized samples.
3. A visible host publishes and reacts from the brand account.
4. Micro-influencers post on their own accounts with affiliate codes.
5. The brand repurposes the best assets into Reels, TikTok, Shorts, Pinterest, emails, and landing sections.

### Visible Face Strategy

Hiring a person to be the public face can work if treated as a performance role, not a generic community manager role.

Recommended profile:
- Mother/father, teacher, storyteller, children's librarian, illustrator, or educator.
- Warm on camera, credible with parents, comfortable speaking Spanish and Catalan if possible.
- Can record short vertical videos, reply to comments, interview parents/creators, and host live story-building sessions.

Recommended compensation:
- Small base fee plus performance upside, not a large fixed retainer.
- Example: 300-600 EUR/month base for 12-20 short videos + comment replies + 1 live/month.
- Add commission per sale from tracked codes or checkout attribution.
- Give a 30-day trial with clear kill criteria.

Critical kill criteria:
- If after 30 days there are no checkout starts, referral signups, creator collaborations, or clear engagement lift, stop.
- If the person needs constant scripts, edits, and supervision, they are not leverage.
- If they create generic parenting content instead of meapica-specific proof, stop.

Best content formats for the visible face:
- "Today I created a story for a child who loves dinosaurs and lives in Girona."
- "3 gifts I would not buy for a 5-year-old, and 1 that becomes a memory."
- "Let's build a bedtime story from a child's favorite things."
- "I read the first page of a personalized adventure."
- "What happens when a child sees their own name in a real book?"

### Micro-Influencer Program Without Founder Logistics

Use discount codes, affiliate codes, and digital previews before sending physical books.

Remote-first flow:
1. Outreach to micro-influencers with a one-page brief.
2. They fill a form with child details.
3. meapica generates a digital preview or full sample PDF.
4. Creator posts reaction to the preview first.
5. Only creators with good engagement receive a physical book through automated fulfillment.

Why this is better:
- Avoids paying/printing for creators who will not perform.
- Tests emotional response before physical cost.
- Creates content even before shipping is fully operational.

Preferred creator types:
- Parenting accounts with 2K-30K followers and strong comments.
- Teachers and children's librarians.
- Family gift accounts.
- Local motherhood accounts in Spain/Catalunya.
- Bookstagram accounts focused on children's books.

Bad creator types:
- Large lifestyle influencers with low parent density.
- Accounts with generic giveaway audiences.
- Creators who only post polished ads.
- Anyone who asks for a high fee before showing relevant audience proof.

### AI-Generated Engagement Plays

These are cheap and remote-friendly:

- **Name series:** "If your child is called Martina, this is how her pirate adventure starts." Publish for common names in Spain and Catalunya.
- **Interest series:** "A bedtime story for a child who loves dinosaurs / football / space / cooking."
- **City series:** "A magical adventure beginning in Barcelona / Girona / Tarragona / Sabadell." Use only if the city is meaningfully woven into the story.
- **Comment-to-preview:** Users comment a name + interest; meapica replies with a short custom opening line or image mockup.
- **Weekly story challenge:** Parents vote in comments on hero, place, friend, and challenge. The final story becomes a carousel/video.
- **Grandparent hook:** Create posts from the buyer perspective: "What to give a grandchild when toys feel disposable."
- **Before/after personalization:** Generic story prompt vs. meapica personalized version.
- **Personalized audio teaser:** A short narrated intro with the child's name to drive shares before purchase.

### The First 90 Days Should Measure

- Cost per checkout start, not only follower growth.
- Creator response rate.
- Creator post engagement quality: comments from parents, not empty likes.
- Conversion rate from personalized preview to checkout.
- Number of user comments that include a child name/interest.
- Number of warm leads captured by gift occasion.
- Repeat purchase/referral intent after first order.

## Influencer Partner Strategy

An influencer partner can be better than hiring a community manager if they bring distribution, credibility, and founder-like commitment. It is also much riskier because equity is expensive and hard to unwind.

### When It Makes Sense

Offer a partner-style deal only if the influencer already has:

- A concentrated parent/family/education/children's-books audience.
- Repeated content around reading, gifts, childhood, screen-free activities, parenting, teaching, or children's creativity.
- High-quality comments from real parents, not only likes.
- A trustworthy personal brand that can carry an emotional product.
- Willingness to publish consistently, not just post occasional promotions.
- Enough business maturity to understand revenue, attribution, deadlines, and brand positioning.

### When It Does Not Make Sense

Do not offer equity if:

- The influencer only has reach, not niche trust.
- Their audience is too broad or too young.
- Their content style is incompatible with premium/artisanal positioning.
- They want equity for one announcement or a few posts.
- They cannot commit to measurable weekly output.
- They refuse performance tracking.

### Recommended Deal Structure

Avoid giving real company equity upfront. Start with an earn-in structure:

1. **Trial phase:** 60-90 days, no equity. Fixed small fee or no fee + high commission.
2. **Performance phase:** commission per sale, tracked by code/link and checkout attribution.
3. **Advisor/ambassador warrants:** only if legal setup supports it, and only vesting over time.
4. **Equity trigger:** small equity only after measurable traction, such as revenue, qualified leads, or repeatable content output.

Suggested starting economics:

- 10-20% commission on first customer purchase attributed to them.
- Bonus for reaching monthly sales thresholds.
- Optional founder-advisor upside after 3 months if they deliver.
- Never grant meaningful ownership for promises.

### What They Should Own

The influencer partner should not merely "manage social." Their responsibility should be acquisition:

- Publish weekly content from their own account.
- Be the visible trusted voice of meapica.
- Co-create story examples with their audience.
- Bring creators, teachers, parent communities, or book accounts.
- Host periodic live story creation sessions.
- Help shape offers for parents and gift buyers.
- Generate qualified comments, preview requests, checkout starts, and sales.

### Best Candidate Profiles

- Parenting creator with children aged 2-8.
- Children's literature/bookstagram creator.
- Teacher, educator, or Montessori-style creator.
- Family plans creator in Spain/Catalunya.
- Children's storyteller/cuentacuentos.
- Trusted local motherhood account with strong WhatsApp-like community energy.

### Critical Guardrail

The right influencer partner is not the biggest profile. It is the person whose audience would naturally buy a premium personalized children's book and whose voice can make the product feel emotionally trustworthy.
