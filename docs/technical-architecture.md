# Technical Architecture

## Stack Overview

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js (App Router) | Web application, SSR, SEO |
| Hosting | Vercel | Frontend deployment, edge functions |
| Database | Supabase (PostgreSQL) | Data storage, auth, real-time |
| Auth | Supabase Auth | User authentication |
| Payments | Stripe | Checkout, subscriptions |
| Story AI | Claude API (Anthropic) | Text generation for stories |
| Image AI | DALL-E 3 | Illustration generation |
| Book Layout | Node.js (pdf-lib / pdfkit) | PDF composition from text + images |
| Printing | Gelato API | Print-on-demand, global fulfillment |
| Automation | Make.com | Orchestration of the generation pipeline |
| Domain | TBD | storymagic.es or similar |

## Supabase Project

- **Project ref:** `rmxjtugoyfaxxkiiayss`
- **MCP configured:** Yes (in `.mcp.json`)

## Data Model (Draft)

```
users
├── id (uuid, PK)
├── email
├── name
├── created_at
└── updated_at

characters (saved hero profiles)
├── id (uuid, PK)
├── user_id (FK → users)
├── name
├── gender (boy / girl / neutral)
├── age
├── hair_color
├── skin_tone
├── eye_color
├── interests (text[])
├── city
├── avatar_url (generated preview)
├── created_at
└── updated_at

stories
├── id (uuid, PK)
├── user_id (FK → users)
├── character_id (FK → characters)
├── template_id (1-5)
├── creation_mode (solo / together)
├── story_decisions (jsonb — choices made during Step 4)
├── dedication_text
├── sender_name
├── ending_choice
├── generated_text (jsonb — all scenes with text)
├── status (draft / generating / ready / ordered / shipped)
├── saga_id (FK → sagas, nullable)
├── saga_order (integer, nullable)
├── created_at
└── updated_at

story_illustrations
├── id (uuid, PK)
├── story_id (FK → stories)
├── scene_number (1-12)
├── prompt_used (text)
├── image_url (text)
├── status (pending / generating / ready / failed)
├── created_at
└── updated_at

orders
├── id (uuid, PK)
├── user_id (FK → users)
├── story_id (FK → stories)
├── stripe_payment_id
├── stripe_checkout_session_id
├── format (softcover / hardcover)
├── addons (jsonb — pack aventura, digital pdf, etc.)
├── subtotal (decimal)
├── total (decimal)
├── currency (EUR)
├── shipping_name
├── shipping_address (jsonb)
├── gelato_order_id
├── tracking_number
├── status (pending / paid / producing / shipped / delivered)
├── pdf_url (generated book PDF)
├── created_at
└── updated_at

sagas
├── id (uuid, PK)
├── user_id (FK → users)
├── character_id (FK → characters)
├── title
├── type (linear / episodic / progression)
├── created_at
└── updated_at
```

## Automated Pipeline

```
Customer completes checkout (Stripe)
  │
  ├─→ Webhook to Make.com (or Vercel serverless function)
  │
  ├─→ 1. Call Claude API
  │      Input: character data + template + decisions + dedication
  │      Output: 10 scenes (title + text + image prompt each)
  │
  ├─→ 2. Call Image API (Flux/DALL-E) × 12
  │      Input: image prompts with consistent style reference
  │      Output: 12 illustrations (PNG, 300 DPI, 21×21cm)
  │      Note: This is the bottleneck — ~2-5 min total
  │
  ├─→ 3. Run PDF Layout Script (Python/ReportLab)
  │      Input: text + images + template layout
  │      Output: Print-ready PDF (CMYK, bleed marks, correct margins)
  │
  ├─→ 4. Upload PDF to Gelato API
  │      Creates print order with shipping address
  │
  ├─→ 5. Send confirmation email to customer
  │      Include: order summary, estimated delivery, digital preview
  │
  └─→ 6. Poll Gelato for tracking number
         Update order status + send shipping notification email
```

## Key Technical Challenges

### 1. Illustration Consistency (CRITICAL)
The #1 technical risk. 12 illustrations of the same character must look consistent across scenes. Approaches:
- **Character reference images:** Generate a reference sheet first, use as style anchor
- **Seed locking:** Use consistent seeds where the API supports it
- **Style LoRA/fine-tuning:** Train a small model on the desired illustration style (post-MVP, if switching from DALL-E)
- **Manual QC pipeline:** Review illustrations before sending to print (MVP safety net)

### 2. PDF Layout Quality
- Must handle variable text lengths gracefully
- Bleed areas, safe zones, spine calculations
- CMYK color conversion for print accuracy
- Test with actual Gelato print runs before launch

### 3. Generation Time
- Full book generation: 2-5 minutes (12 images + text)
- Need engaging wait experience (Step 6 animation)
- Consider pre-generating popular template elements
- Email notification as fallback for slow generations

### 4. Multi-language Support
- Stories must be generated in ES, CA, EN
- UI must support language switching
- Image prompts always in English (better AI results)
- Supabase i18n strategy: next-intl or similar

## API Cost Per Book

| Service | Cost | Notes |
|---------|------|-------|
| Claude API (story text) | ~0.10-0.30 EUR | ~2K input tokens, ~3K output tokens |
| Image API (12 illustrations) | ~1.00-2.00 EUR | Depends on provider and resolution |
| **Total AI cost per book** | **~1.50 EUR** | |

## Infrastructure Cost (Monthly Fixed)

| Service | Cost |
|---------|------|
| Vercel (Pro) | ~20 EUR/month |
| Supabase (Free → Pro) | 0-25 EUR/month |
| Make.com (Core) | ~9 EUR/month |
| Domain | ~1 EUR/month (12 EUR/year) |
| **Total fixed** | **~30-55 EUR/month** |
