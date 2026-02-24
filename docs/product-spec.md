# Product Specification

## Book Format

| Attribute | Value |
|-----------|-------|
| Size | 21x21 cm (square, children's standard) |
| Pages | 24-32 pages (12-16 double spreads) |
| Binding | Softcover (~3-4 EUR cost) or Hardcover Premium (~6-8 EUR cost) |
| Interior | Full color, Munken 170g minimum paper |
| Print partner | Gelato (print-on-demand, global shipping) |

## Story Structure (12 Spreads)

| # | Spread | Content |
|---|--------|---------|
| 1 | Cover | Illustration of the child protagonist + personalized title |
| 2 | Endpapers | Thematic decorative pattern |
| 3 | Dedication | "This story is for [name], the most [adjective] in [city]" |
| 4 | Scene 1 | Introduction: the child in their real environment (city, home) |
| 5 | Scene 2 | Inciting event: something magical happens |
| 6 | Scene 3 | Adventure begins: the child discovers something new |
| 7 | Scene 4 | First challenge: the child uses their interests/skills |
| 8 | Scene 5 | Encounter: meets a friend character |
| 9 | Scene 6 | Greater challenge: more complicated situation |
| 10 | Scene 7 | Climax: the child resolves everything with bravery |
| 11 | Scene 8 | Resolution: return home with lessons learned |
| 12 | Final page | Message: "And so, [name] discovered that [moral]" |
| 13 | Back cover | Illustration + "A story created especially for [name]" |

## Story Templates (MVP: 5 templates)

| # | Title | Theme | Age Range | Moral |
|---|-------|-------|-----------|-------|
| 1 | La Gran Aventura Espacial | Space travel, planets, alien friends | 4-7 | Curiosity takes you far |
| 2 | El Bosque Mágico | Fantastic animals, nature, ancient trees | 3-6 | Taking care of our world |
| 3 | Superhéroe por un Día | Save the city, hidden superpowers | 5-8 | True power is kindness |
| 4 | Piratas del Mar de [city] | Pirate adventure, hidden treasure | 4-8 | The best treasures are friends |
| 5 | El Chef Más Pequeño del Mundo | Magical kitchen, living ingredients | 2-5 | Creating with your hands is magic |

## Personalization Variables (Customer Input)

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `child_name` | string | Yes | Child's first name |
| `gender` | enum | Yes | "boy" / "girl" / "neutral" |
| `age` | number (1-12) | Yes | Child's age |
| `hair_color` | string | Yes | Hair color/style |
| `skin_tone` | string | Yes | Skin tone |
| `eye_color` | string | Yes | Eye color |
| `interests` | string[] (3-5) | Yes | Child's interests (space, animals, sports, castles, dinosaurs, music, etc.) |
| `city` | string | Yes | City where the child lives |
| `sender_name` | string | No | Gift sender's name (if it's a gift) |
| `custom_dedication` | string | No | Custom dedication message |
| `template_id` | number (1-5) | Yes | Selected story template |

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

## Saga System (Post-MVP)

Three saga types for returning customers:

| Type | Description | Example |
|------|-------------|---------|
| Linear | Continuous story across multiple books | "The Space Chronicles" parts 1, 2, 3 |
| Episodic | Same character, independent adventures | Different templates with the same hero |
| Progression | Character grows/evolves across books | Hero gains skills, companions, achievements |
