"use client";

import type { CreationMode, StoryDecisions, StoryTemplateConfig } from "@/lib/create-store";
import Step4Juntos from "./Step4Juntos";
import Step4Solo from "./Step4Solo";

// Note: This component is a pure router/container — it has no user-visible
// strings of its own. Translations live in Step4Solo and Step4Juntos.

interface Step4Props {
  mode: CreationMode;
  decisions: StoryDecisions;
  characterName: string;
  template: StoryTemplateConfig;
  onUpdateDecisions: (updates: Partial<StoryDecisions>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step4Decisions({
  mode,
  decisions,
  characterName,
  template,
  onUpdateDecisions,
  onNext,
  onBack,
}: Step4Props) {
  if (mode === "juntos") {
    return (
      <Step4Juntos
        decisions={decisions}
        characterName={characterName}
        template={template}
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
      template={template}
      onUpdateDecisions={onUpdateDecisions}
      onNext={onNext}
      onBack={onBack}
    />
  );
}
