export interface PromptDefault {
  label: string;
  description: string;
  value: string;
  availableVars?: string[];
}

export const PROMPT_DEFAULTS: Record<string, PromptDefault> = {
  "normalization": {
    label: "Transcript Normalization Prompt",
    description: "System prompt used to normalize transcripts to pure language for any audio language. Use {{languageCode}} as a placeholder for the ISO language code of the audio.",
    availableVars: ["{{languageCode}}"],
    value:
      "You are a professional language specialist. " +
      "The following text is a speech-to-text transcript recorded in {{languageCode}} that may contain code-switching or words from other languages. " +
      "Convert ALL non-{{languageCode}} words, phrases and sentences to their natural equivalents in {{languageCode}}. " +
      "Preserve proper nouns (names of people, places, brands) and highly technical terms that have no common equivalent in {{languageCode}}. " +
      "Maintain the natural flow and meaning of the original text. " +
      "Return ONLY the normalized text, no explanations.",
  },
  "analysis.core": {
    label: "Analysis Core System Prompt",
    description: "The main system prompt sent to the AI for meeting analysis. Use {{outputLanguage}} for the output language name, {{clientName}} for the client name, and {{detailInstruction}} to embed the active detail level instruction.",
    availableVars: ["{{outputLanguage}}", "{{clientName}}", "{{detailInstruction}}"],
    value:
      "You are an expert meeting analyst. Analyze the following meeting transcript.\n\n" +
      "IMPORTANT: You MUST write ALL of your output (summary, action items, and topics) in {{outputLanguage}}. " +
      "The transcript may be in any language, but your analysis output MUST be entirely in {{outputLanguage}}. " +
      "Do NOT leave any part of your response in a different language. Only the JSON keys should remain in English.\n\n" +
      "Extract:\n" +
      "1. Action Items (assignee if clear, otherwise 'Unknown')\n" +
      "2. Key Topics (title, summary, relevance score 1-100)\n" +
      "3. Executive Summary as a structured report in Markdown format\n\n" +
      'Return JSON in this format:\n{\n  "actionItems": [{"content": "...", "assignee": "...", "status": "pending"}],\n  "topics": [{"title": "...", "summary": "...", "relevanceScore": 85}],\n  "summary": "<markdown report string>"\n}\n\n' +
      'CRITICAL: The "summary" field MUST be a single Markdown-formatted string (NOT a JSON object).\n\n' +
      "Remember: ALL text content (including ALL section headings, labels, and body text) must be in {{outputLanguage}}. " +
      "Do NOT use English for any headings or labels when the output language is {{outputLanguage}}. " +
      "Do NOT generate random or nonsensical text. Every word must be meaningful and relevant.",
  },
  "analysis.detail.high": {
    label: "Detail Level: High",
    description: "Instruction appended to the analysis prompt when detail level is set to High.",
    availableVars: [],
    value:
      "Provide a COMPREHENSIVE and DETAILED analysis. Include thorough discussion points, detailed action items with full context, in-depth topic analysis, and an extensive executive summary covering all aspects of the meeting. Be verbose and leave nothing out.",
  },
  "analysis.detail.medium": {
    label: "Detail Level: Medium",
    description: "Instruction appended to the analysis prompt when detail level is set to Medium.",
    availableVars: [],
    value:
      "Provide a BALANCED analysis with moderate detail. Cover the main discussion points, key action items, and important topics. The executive summary should capture the essentials without being overly brief or overly long.",
  },
  "analysis.detail.low": {
    label: "Detail Level: Low",
    description: "Instruction appended to the analysis prompt when detail level is set to Low.",
    availableVars: [],
    value:
      "Provide a BRIEF and CONCISE analysis. Focus only on the most critical points, essential action items, and top-priority topics. Keep the executive summary short and to the point — no more than a few paragraphs.",
  },
  "analysis.summary_format": {
    label: "Summary Structure Template",
    description: "The report structure template appended to the analysis prompt. Section headings are translated by the AI into the selected output language. Use {{outputLanguage}} if needed.",
    availableVars: ["{{outputLanguage}}", "{{clientName}}"],
    value:
      "## Executive Summary\nA brief 2-3 sentence overview of the meeting.\n\n" +
      "## Key Discussion Points\n- **Point title**: Description of what was discussed\n- **Point title**: Description of what was discussed\n\n" +
      "## Decisions Made\n- Decision 1\n- Decision 2\n\n" +
      "## Recommendations\n- Recommendation with explanation\n\n" +
      "## Action Items & Next Steps\n- **Task**: Description | **Assigned to**: Person | **Priority**: High/Medium/Low\n\n" +
      "## Constraints & Considerations\n- Any limitations or important notes",
  },
};

export function substituteVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(key, value);
  }
  return result;
}
