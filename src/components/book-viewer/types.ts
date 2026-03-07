import type { GeneratedScene } from "@/lib/ai/story-generator";

export type BookPage =
  | { type: "cover"; title: string; characterName: string; templateId: string }
  | { type: "dedication"; text: string; senderName: string | null }
  | {
      type: "scene";
      scene: GeneratedScene;
      imageUrl: string | null;
      locked: boolean;
    }
  | { type: "final"; message: string; characterName: string }
  | { type: "back"; characterName: string };

export interface BookViewerProps {
  pages: BookPage[];
  templateId: string;
  currentPage: number;
  onPageChange: (pageIndex: number) => void;
}

