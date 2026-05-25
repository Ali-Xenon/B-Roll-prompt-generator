export interface BrollSegment {
  id: number;
  dialogueQuote: string;
  context: string;
  brollPrompt: string;
  generatedImageUrl?: string;
  isGeneratingImage?: boolean;
  generationError?: string;
}

export interface AnalyzeResponse {
  segments: BrollSegment[];
}
