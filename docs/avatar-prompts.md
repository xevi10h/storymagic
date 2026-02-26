# Avatar Generation Prompts

## Style Anchor (ALWAYS include this)

```
Children's book watercolor illustration portrait of a [AGE] [GENDER] child.
Soft warm palette, gentle brushstrokes, slightly whimsical proportions
(larger head, expressive eyes). Circular crop, solid pastel [BG_COLOR]
background. No text, no frame, no decorations outside the character.
Consistent style: Studio Ghibli meets Beatrix Potter watercolor.
Clean lines with soft watercolor fill. Front-facing, chest up, friendly smile.
```

## Variables

### Gender
- `boy child` / `girl child` / `child` (neutral)

### Age descriptions
| Age range | Description |
|-----------|-------------|
| 1-3 | `toddler` (round cheeks, very small, baby features) |
| 4-6 | `young` (small, round face, big curious eyes) |
| 7-9 | `school-age` (slightly more defined features, confident look) |
| 10-12 | `pre-teen` (more mature face, taller proportions) |

### Skin tones
| ID | Prompt description |
|----|-------------------|
| light | `very fair/light skin` |
| medium-light | `light olive/warm beige skin` |
| medium-dark | `golden brown/caramel skin` |
| dark | `rich brown skin` |
| very-dark | `deep dark brown skin` |

### Hair colors
| ID | Prompt description |
|----|-------------------|
| black | `jet black hair` |
| brown-dark | `dark brown hair` |
| brown | `medium brown/chestnut hair` |
| blonde | `golden blonde hair` |
| red | `bright auburn/red hair` |

### Hairstyles — Boys
| ID | Prompt description |
|----|-------------------|
| short | `short neat hair` |
| curly | `short curly hair` |
| spiky | `spiky/messy hair pointing up` |
| buzz | `very short buzzcut hair` |

### Hairstyles — Girls
| ID | Prompt description |
|----|-------------------|
| long | `long straight hair` |
| curly | `curly shoulder-length hair` |
| pigtails | `hair in two braids/pigtails` |
| bob | `short bob haircut` |

### Hairstyles — Neutral
| ID | Prompt description |
|----|-------------------|
| medium | `medium-length tousled hair` |
| curly | `curly medium hair` |
| short | `short simple hair` |

### Background colors (by interest)
| Interest | BG color description |
|----------|---------------------|
| none | `warm cream/peach` |
| space | `soft lavender/light indigo` |
| animals | `soft mint green` |
| sports | `soft sky blue` |
| castles | `soft lilac/light purple` |
| dinosaurs | `soft sage/light lime` |
| music | `soft warm yellow/amber` |

---

## Priority Order (generate these first)

### Batch 1: Core set (24 images)
The minimum viable set. 2 genders × 3 skin groups × 4 hairstyles.

Use age group `young` (4-6) as the default since it's the middle of the slider.

### Batch 2: Age variations (24 images)
Same 24 characters but at `toddler` and `pre-teen` ages (12 + 12).

### Batch 3: Hair colors (expand)
Re-generate Batch 1 with different hair colors.

---

## Complete Prompt Examples

### Example 1: Girl, light skin, braids, young
```
Children's book watercolor illustration portrait of a young girl child
(age 5-6). Very fair/light skin, dark brown hair in two braids/pigtails.
Soft warm palette, gentle brushstrokes, slightly whimsical proportions
(larger head, expressive eyes). Circular crop, solid warm cream/peach
background. No text, no frame, no decorations outside the character.
Consistent style: Studio Ghibli meets Beatrix Potter watercolor.
Clean lines with soft watercolor fill. Front-facing, chest up, friendly smile.
```

### Example 2: Boy, dark skin, curly hair, pre-teen, space interest
```
Children's book watercolor illustration portrait of a pre-teen boy child
(age 10-12). Rich brown skin, jet black short curly hair.
Soft warm palette, gentle brushstrokes, slightly whimsical proportions
(larger head, expressive eyes). Circular crop, solid soft lavender/light
indigo background. No text, no frame, no decorations outside the character.
Consistent style: Studio Ghibli meets Beatrix Potter watercolor.
Clean lines with soft watercolor fill. Front-facing, chest up, friendly smile.
```

### Example 3: Girl, caramel skin, bob, toddler, animals interest
```
Children's book watercolor illustration portrait of a toddler girl child
(age 2-3). Golden brown/caramel skin, medium brown/chestnut short bob
haircut. Round baby cheeks, very small.
Soft warm palette, gentle brushstrokes, slightly whimsical proportions
(larger head, expressive eyes). Circular crop, solid soft mint green
background. No text, no frame, no decorations outside the character.
Consistent style: Studio Ghibli meets Beatrix Potter watercolor.
Clean lines with soft watercolor fill. Front-facing, chest up, friendly smile.
```

### Example 4: Neutral child, olive skin, medium hair, school-age
```
Children's book watercolor illustration portrait of a school-age child
(age 7-9, gender-neutral appearance). Light olive/warm beige skin,
golden blonde medium-length tousled hair.
Soft warm palette, gentle brushstrokes, slightly whimsical proportions
(larger head, expressive eyes). Circular crop, solid warm cream/peach
background. No text, no frame, no decorations outside the character.
Consistent style: Studio Ghibli meets Beatrix Potter watercolor.
Clean lines with soft watercolor fill. Front-facing, chest up, friendly smile.
```

---

## File Naming Convention

When saving generated images, use this format:
```
avatar-{gender}-{skinTone}-{hairstyle}-{ageGroup}.png
```

Examples:
- `avatar-girl-light-pigtails-young.png`
- `avatar-boy-dark-curly-preteen.png`
- `avatar-neutral-medium-light-short-toddler.png`

---

## Tips for Consistency

1. **Same session**: Generate all images in one session/batch to keep the style consistent.
2. **Seed/reference**: If the tool supports it (Midjourney --sref, Flux img2img), use the first good result as a style reference for all others.
3. **Square format**: Generate at 1:1 aspect ratio, 512×512px minimum.
4. **Midjourney flags**: Add `--ar 1:1 --s 250 --style raw` for cleaner results.
5. **DALL-E tip**: Start with "In the exact same illustration style as the reference:" when using ChatGPT with a reference image.
6. **Flux tip**: Use img2img with strength 0.3-0.5 to maintain style from a reference.
7. **Post-process**: Remove background if needed, ensure circular crop works.

## Integration

Once generated, place images in `/public/avatars/` and update `AVATAR_OVERRIDES` in `src/lib/avatar-library.ts`. The override system already supports matching by gender, skin tone group, and hairstyle.
