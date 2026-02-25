"use client";

import type { CreationMode, StoryDecisions } from "@/lib/create-store";
import Step4Juntos from "./Step4Juntos";
import Step4Solo from "./Step4Solo";

interface Step4Props {
  mode: CreationMode;
  decisions: StoryDecisions;
  characterName: string;
  onUpdateDecisions: (updates: Partial<StoryDecisions>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step4Decisions({
  mode,
  decisions,
  characterName,
  onUpdateDecisions,
  onNext,
  onBack,
}: Step4Props) {
  if (mode === "juntos") {
    return (
      <Step4Juntos
        decisions={decisions}
        characterName={characterName}
        onUpdateDecisions={onUpdateDecisions}
        onNext={onNext}
        onBack={onBack}
      />
    );
  }

  return (
    <Step4Solo
      decisions={decisions}
      characterName={characterName}
      onUpdateDecisions={onUpdateDecisions}
      onNext={onNext}
      onBack={onBack}
    />
  );
}
