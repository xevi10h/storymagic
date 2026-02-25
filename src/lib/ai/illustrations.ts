import crypto from "crypto";

// Mock placeholder images for development
// In production, these will be replaced by actual AI-generated images (Flux Schnell ~$0.002/img)
const MOCK_ILLUSTRATIONS: Record<string, string[]> = {
  space: [
    "https://placehold.co/800x800/1a1a2e/e0e0ff?text=Scene+1:+Home",
    "https://placehold.co/800x800/16213e/e0e0ff?text=Scene+2:+Magic",
    "https://placehold.co/800x800/0f3460/e0e0ff?text=Scene+3:+Adventure",
    "https://placehold.co/800x800/533483/e0e0ff?text=Scene+4:+Challenge",
    "https://placehold.co/800x800/e94560/fff?text=Scene+5:+Friend",
    "https://placehold.co/800x800/1a1a2e/e0e0ff?text=Scene+6:+Danger",
    "https://placehold.co/800x800/16213e/ffd700?text=Scene+7:+Climax",
    "https://placehold.co/800x800/0f3460/90ee90?text=Scene+8:+Home",
  ],
  forest: [
    "https://placehold.co/800x800/2d5016/e8f5e9?text=Scene+1:+Home",
    "https://placehold.co/800x800/1b5e20/e8f5e9?text=Scene+2:+Magic",
    "https://placehold.co/800x800/33691e/e8f5e9?text=Scene+3:+Adventure",
    "https://placehold.co/800x800/4e342e/e8f5e9?text=Scene+4:+Challenge",
    "https://placehold.co/800x800/558b2f/fff?text=Scene+5:+Friend",
    "https://placehold.co/800x800/1b5e20/e8f5e9?text=Scene+6:+Danger",
    "https://placehold.co/800x800/33691e/ffd700?text=Scene+7:+Climax",
    "https://placehold.co/800x800/2d5016/90ee90?text=Scene+8:+Home",
  ],
  superhero: [
    "https://placehold.co/800x800/b71c1c/fff?text=Scene+1:+Home",
    "https://placehold.co/800x800/c62828/fff?text=Scene+2:+Magic",
    "https://placehold.co/800x800/d32f2f/fff?text=Scene+3:+Adventure",
    "https://placehold.co/800x800/e53935/fff?text=Scene+4:+Challenge",
    "https://placehold.co/800x800/1565c0/fff?text=Scene+5:+Friend",
    "https://placehold.co/800x800/b71c1c/fff?text=Scene+6:+Danger",
    "https://placehold.co/800x800/c62828/ffd700?text=Scene+7:+Climax",
    "https://placehold.co/800x800/d32f2f/90ee90?text=Scene+8:+Home",
  ],
  pirates: [
    "https://placehold.co/800x800/0d47a1/e3f2fd?text=Scene+1:+Home",
    "https://placehold.co/800x800/01579b/e3f2fd?text=Scene+2:+Magic",
    "https://placehold.co/800x800/006064/e3f2fd?text=Scene+3:+Adventure",
    "https://placehold.co/800x800/004d40/e3f2fd?text=Scene+4:+Challenge",
    "https://placehold.co/800x800/0d47a1/fff?text=Scene+5:+Friend",
    "https://placehold.co/800x800/01579b/e3f2fd?text=Scene+6:+Danger",
    "https://placehold.co/800x800/006064/ffd700?text=Scene+7:+Climax",
    "https://placehold.co/800x800/004d40/90ee90?text=Scene+8:+Home",
  ],
  chef: [
    "https://placehold.co/800x800/e65100/fff3e0?text=Scene+1:+Home",
    "https://placehold.co/800x800/ef6c00/fff3e0?text=Scene+2:+Magic",
    "https://placehold.co/800x800/f57c00/fff3e0?text=Scene+3:+Adventure",
    "https://placehold.co/800x800/fb8c00/fff3e0?text=Scene+4:+Challenge",
    "https://placehold.co/800x800/ff9800/fff?text=Scene+5:+Friend",
    "https://placehold.co/800x800/e65100/fff3e0?text=Scene+6:+Danger",
    "https://placehold.co/800x800/ef6c00/ffd700?text=Scene+7:+Climax",
    "https://placehold.co/800x800/f57c00/90ee90?text=Scene+8:+Home",
  ],
};

const DEFAULT_MOCK = [
  "https://placehold.co/800x800/5d4037/fff3e0?text=Scene+1",
  "https://placehold.co/800x800/6d4c41/fff3e0?text=Scene+2",
  "https://placehold.co/800x800/795548/fff3e0?text=Scene+3",
  "https://placehold.co/800x800/8d6e63/fff3e0?text=Scene+4",
  "https://placehold.co/800x800/a1887f/fff3e0?text=Scene+5",
  "https://placehold.co/800x800/5d4037/fff3e0?text=Scene+6",
  "https://placehold.co/800x800/6d4c41/ffd700?text=Scene+7",
  "https://placehold.co/800x800/795548/90ee90?text=Scene+8",
];

export function hashDescription(description: string): string {
  return crypto.createHash("sha256").update(description.toLowerCase().trim()).digest("hex");
}

export function getMockIllustration(templateId: string, sceneIndex: number): string {
  const templates = MOCK_ILLUSTRATIONS[templateId] ?? DEFAULT_MOCK;
  return templates[sceneIndex % templates.length];
}

/**
 * Get illustrations for a story. Currently returns mock placeholders.
 * When image generation is enabled, this will:
 * 1. Check illustration_library for cached images matching the prompt
 * 2. If found, return cached image and increment usage_count
 * 3. If not found, generate via Flux Schnell (~$0.002/img) and cache
 */
export function getIllustrationsForStory(
  templateId: string,
  imagePrompts: string[]
): { imageUrl: string; descriptionHash: string }[] {
  return imagePrompts.map((prompt, index) => ({
    imageUrl: getMockIllustration(templateId, index),
    descriptionHash: hashDescription(prompt),
  }));
}
