# Product Specification

## Book Format

| Attribute | Value |
|-----------|-------|
| Size | 21x21 cm (square, children's standard) |
| Pages | 24-32 pages (12-16 double spreads) |
| Binding | Softcover (~3-4 EUR cost) or Hardcover Premium (~6-8 EUR cost) |
| Interior | Full color, Munken 170g minimum paper |
| Print partner | Gelato (print-on-demand, global shipping) |

## Book Layout (24 Pages — Implemented)

| # | Page | Content |
|---|------|---------|
| 1 | Cover | Illustration of the child protagonist + personalized title |
| 2 | Front endpaper | Thematic decorative pattern |
| 3 | Title page | Title + subtitle + Meapica Press imprint |
| 4 | Dedication | "This story is for [name]..." |
| 5–16 | Scenes 1–12 | 12 illustrated scenes, cycling through 4 layout types |
| 17 | Final message | "And so, [name] discovered that..." |
| 18 | Colophon | Meapica Press editorial note |
| 19 | Back endpaper | Thematic decorative pattern |
| 20–24 | (Back matter / cover) | Back cover |

**Scene spread types (cycling for scenes):** galería → pergamino → ventana → repeat
**Bridge spread type:** puente (full-bleed illustration + centered sentence page)

## Narrative Structure (Block-Based, Age-Adaptive)

Always 12 content slots × 2 pages = 24 content pages. Slots are either "scene" (full narrative) or "bridge" (atmospheric transition). The mix depends on the child's age.

### Narrative Blocks

| Block | Name | Purpose |
|-------|------|---------|
| 1 | MI MUNDO | Who I am, where I live, what I love — the reader recognizes themselves |
| 2 | LA LLAMADA | Something changes, the adventure world opens |
| 3 | EL CAMINO | The journey — discoveries, friends, wonders |
| 4 | LA PRUEBA | The great challenge + overcoming it |
| 5 | VOLVER A CASA | Return transformed, carrying the lesson |

### Age-Based Adaptation

| Age Range | Scenes | Bridges | Words/Scene | Text Style | Illustration Style |
|-----------|--------|---------|-------------|------------|-------------------|
| 2-4 years | 8 | 4 | 50-80 | Simple sentences, onomatopoeia, repetition, sensory | `child_book` — watercolor, big shapes |
| 5-7 years | 10 | 2 | 100-140 | Playful dialogues, humor, wonder, mild suspense | `child_book` — detailed backgrounds |
| 8-12 years | 12 | 0 | 150-200 | Rich prose, inner monologue, metaphors, complex emotions | `hand_drawn` — editorial, cinematic |

### Bridge Pages

Atmospheric transitions between narrative blocks. One evocative sentence (max 25 words) + mood illustration. Examples:
- "Pero algo estaba a punto de cambiar..."
- "Y entonces, el mundo se llenó de estrellas."
- "Nadie imaginaba lo que vendría después."

For ages 2-4, bridges also serve as parent reading pauses.

## Story Templates (10 templates)

Each template is identified by an English slug and is backed by a branching story-tree in `src/lib/story-trees/` (14 nodes / 39 options / 4 locales each). The template is chosen as the first fork ("world" beat) of the adventure path.

| Slug | Title | Theme |
|------|-------|-------|
| `space` | La Gran Aventura Espacial | Space travel, planets, alien friends |
| `forest` | El Bosque Mágico | Fantastic animals, nature, ancient trees |
| `pirates` | Piratas del Mar de [city] | Pirate adventure, hidden treasure |
| `dinosaurs` | Dinosaurios | Prehistoric world, dino friends |
| `superhero` | Superhéroe por un Día | Save the city, hidden superpowers |
| `chef` | El Chef Más Pequeño del Mundo | Magical kitchen, living ingredients |
| `castle` | Castillo | Medieval castle, knights and quests |
| `safari` | Safari | Wild savanna, animal expedition |
| `inventor` | Inventor | Workshop of fantastical inventions |
| `candy` | Candy | Sweet land of candy and confectionery |

## Personalization Variables (Customer Input)

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `child_name` | string | Yes | Child's first name |
| `gender` | enum | Yes | "boy" / "girl" / "neutral" |
| `age` | number (1-12) | Yes | Child's age |
| `hair_color` | string | Yes | Hair color/style |
| `skin_tone` | string | Yes | Skin tone |
| `eye_color` | string | Yes | Eye color |
| `interests` | string[] (up to 4) | Yes | Child's interests (space, animals, sports, castles, dinosaurs, music) |
| `city` | string | Yes | City where the child lives |
| `favorite_color` | string | No | Favorite color (used as the book's theme accent) |
| `favorite_companion` | string | No | Best friend / companion |
| `sender_name` | string | No | Gift sender's name (if it's a gift) |
| `custom_dedication` | string | No | Custom dedication message |
| `template_id` | string (slug) | Yes | Selected story template (space / forest / pirates / dinosaurs / superhero / chef / castle / safari / inventor / candy) |

## Upsells & Add-ons

| Product | Price | Contents |
|---------|-------|----------|
| Pack Aventura Artesanal | +12.90 EUR | Personalized character letter + matte stickers + wooden bookmark |
| Digital PDF (instant) | +5 EUR | Immediate PDF version of the book |
| Second copy (discounted) | +15 EUR | Additional softcover copy |
| Collection discount | 3 books = -20% | Encourage multi-purchase / saga adoption |

## Illustration Style Guide

**Visual style (consistent across all 12 illustrations):**
- Children's book illustration, soft watercolor textures
- Warm pastel color palette
- Whimsical and dreamy atmosphere
- Rounded shapes, gentle lighting
- Inspired by Oliver Jeffers and Beatrice Alemagna
- High quality print resolution (300 DPI minimum)
- Square format, 21x21cm, full bleed
- NO text in illustrations (text is overlaid separately in layout)
- Leave space for text overlay (position varies by scene)

**Character consistency:**
- Same proportions across all scenes (cartoon style, big expressive eyes)
- Clothing changes only when narratively justified
- Emotional expressions must match scene context
- Character must be recognizable by physical attributes across all pages

## Waitlist (Pre-Launch Gate)

The entire site is gated behind a pre-launch waiting list when `WAITLIST_MODE=true`. This allows building an audience and collecting leads before the product is publicly available.

**How it works:**
- A full-screen waitlist page replaces the normal site content for all visitors
- Users submit their **name + email** to join the waiting list
- On submission, a **confirmation email** is sent via **Resend** (currently sending from `constrack.pro` domain; `meapica.com` DNS records pending configuration)
- Subscriber data is stored in the **`newsletter_subscribers`** table in Supabase
- A **live subscriber counter** is displayed on the waitlist page to create social proof
- Available in all **4 languages** (ES, CA, EN, FR) via next-intl

**Team access bypass:**
- A secret access code can be passed as a query parameter to bypass the waitlist gate
- The code is set via the `WAITLIST_ACCESS_CODE` env var
- Once entered, a cookie is set so the team member can navigate freely without re-entering the code

**Disabling the waitlist:**
- Set `WAITLIST_MODE=false` (or remove the env var) to open the site to all visitors

---

## Saga System (Post-MVP)

Three saga types for returning customers:

| Type | Description | Example |
|------|-------------|---------|
| Linear | Continuous story across multiple books | "The Space Chronicles" parts 1, 2, 3 |
| Episodic | Same character, independent adventures | Different templates with the same hero |
| Progression | Character grows/evolves across books | Hero gains skills, companions, achievements |
