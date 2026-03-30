export interface LlmModel {
  id: string;
  name: string;
  description: string;
  requiresEnvVar: string | null;
  supportsTranscription: boolean;
  supportsAnalysis: boolean;
}

export const LLM_REGISTRY: LlmModel[] = [
  {
    id: "openai-whisper",
    name: "OpenAI Whisper",
    description: "OpenAI audio transcription model",
    requiresEnvVar: "AI_INTEGRATIONS_OPENAI_API_KEY",
    supportsTranscription: true,
    supportsAnalysis: false,
  },
  {
    id: "soniox",
    name: "Soniox",
    description: "Soniox speech-to-text transcription",
    requiresEnvVar: "SONIOX_API_KEY",
    supportsTranscription: true,
    supportsAnalysis: false,
  },
  {
    id: "openai-gpt-4o",
    name: "GPT-4o",
    description: "OpenAI most capable model",
    requiresEnvVar: "AI_INTEGRATIONS_OPENAI_API_KEY",
    supportsTranscription: false,
    supportsAnalysis: true,
  },
  {
    id: "openai-gpt-4o-mini",
    name: "GPT-4o Mini",
    description: "OpenAI efficient and fast model",
    requiresEnvVar: "AI_INTEGRATIONS_OPENAI_API_KEY",
    supportsTranscription: false,
    supportsAnalysis: true,
  },
  {
    id: "anthropic-claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    description: "Anthropic balanced performance model",
    requiresEnvVar: "AI_INTEGRATIONS_ANTHROPIC_API_KEY",
    supportsTranscription: false,
    supportsAnalysis: true,
  },
  {
    id: "anthropic-claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    description: "Anthropic fastest and most compact model",
    requiresEnvVar: "AI_INTEGRATIONS_ANTHROPIC_API_KEY",
    supportsTranscription: false,
    supportsAnalysis: true,
  },
];

export interface LlmModelWithAvailability extends LlmModel {
  available: boolean;
}

export function getLlmRegistryWithAvailability(): LlmModelWithAvailability[] {
  return LLM_REGISTRY.map((model) => ({
    ...model,
    available: model.requiresEnvVar === null || !!process.env[model.requiresEnvVar],
  }));
}

export const SYSTEM_SETTING_DEFAULTS: Record<string, { label: string; description: string; value: string }> = {
  transcription_model: {
    label: "Transcription Model",
    description: "The model used to transcribe audio recordings into text.",
    value: "openai-whisper",
  },
  default_analysis_model: {
    label: "Default Analysis Model",
    description: "The model used to analyse transcripts and generate summaries when no template-specific model is set.",
    value: "openai-gpt-4o",
  },
};

export const SYSTEM_SETTING_CAPABILITIES: Record<string, keyof Pick<LlmModel, "supportsTranscription" | "supportsAnalysis">> = {
  transcription_model: "supportsTranscription",
  default_analysis_model: "supportsAnalysis",
};
