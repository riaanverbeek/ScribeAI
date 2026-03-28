export interface PromptDefault {
  label: string;
  description: string;
  value: string;
  availableVars?: string[];
}

export const PROMPT_DEFAULTS: Record<string, PromptDefault> = {
  "normalization.af": {
    label: "Afrikaans Normalization Prompt",
    description: "System prompt used to normalize transcripts to pure Afrikaans when the audio language is Afrikaans.",
    availableVars: [],
    value:
      "Jy is 'n Suid-Afrikaanse Afrikaanse taalverskaffer. " +
      "Die volgende teks is 'n spraak-na-teks transkripsie van 'n spreker wat moontlik tale meng. " +
      "Skakel ALLE nie-Afrikaanse woorde, frases en sinne om na hul natuurlike Afrikaanse eweknieë. " +
      "Behou eiename (mense, plekke, handelsmerke) en hoogs tegniese terme wat geen algemene Afrikaanse ekwivalent het nie. " +
      "Handhaaf die natuurlike vloei en betekenis van die oorspronklike teks. " +
      "Gee SLEGS die genormaliseerde Afrikaanse teks terug, geen verduidelikings nie.",
  },
  "normalization.generic": {
    label: "Generic Normalization Prompt",
    description: "System prompt template used to normalize transcripts for any non-Afrikaans language. Use {{languageCode}} as a placeholder for the ISO language code.",
    availableVars: ["{{languageCode}}"],
    value:
      'You are a professional language specialist for the language with ISO code "{{languageCode}}". ' +
      "The following text is a speech-to-text transcript that may contain code-switching or words in other languages. " +
      "Convert ALL non-{{languageCode}} words, phrases and sentences to their natural equivalents in this language. " +
      "Preserve proper nouns (names of people, places, brands) and highly technical terms that have no common equivalent. " +
      "Maintain the natural flow and meaning of the original text. " +
      "Return ONLY the normalized text, no explanations.",
  },
  "analysis.core": {
    label: "Analysis Core System Prompt",
    description: "The main system prompt sent to the AI for meeting analysis. Use {{outputLanguage}} for the output language name.",
    availableVars: ["{{outputLanguage}}"],
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
  "analysis.summary_format.en": {
    label: "Summary Structure: English",
    description: "The report structure template appended to the analysis prompt when output language is English.",
    availableVars: [],
    value:
      "## Executive Summary\nA brief 2-3 sentence overview of the meeting.\n\n" +
      "## Key Discussion Points\n- **Point title**: Description of what was discussed\n- **Point title**: Description of what was discussed\n\n" +
      "## Decisions Made\n- Decision 1\n- Decision 2\n\n" +
      "## Recommendations\n- Recommendation with explanation\n\n" +
      "## Action Items & Next Steps\n- **Task**: Description | **Assigned to**: Person | **Priority**: High/Medium/Low\n\n" +
      "## Constraints & Considerations\n- Any limitations or important notes",
  },
  "analysis.summary_format.af": {
    label: "Summary Structure: Afrikaans",
    description: "The report structure template appended to the analysis prompt when output language is Afrikaans.",
    availableVars: [],
    value:
      "## Uitvoerende Opsomming\n'n Kort 2-3 sin oorsig van die vergadering.\n\n" +
      "## Sleutel Besprekingspunte\n- **Punttitel**: Beskrywing van wat bespreek is\n- **Punttitel**: Beskrywing van wat bespreek is\n\n" +
      "## Besluite Geneem\n- Besluit 1\n- Besluit 2\n\n" +
      "## Aanbevelings\n- Aanbeveling met verduideliking\n\n" +
      "## Aksie-items & Volgende Stappe\n- **Taak**: Beskrywing | **Toegewys aan**: Persoon | **Prioriteit**: Hoog/Medium/Laag\n\n" +
      "## Beperkings & Oorwegings\n- Enige beperkings of belangrike notas",
  },
};

export function substituteVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(key, value);
  }
  return result;
}
