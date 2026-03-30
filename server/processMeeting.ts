import { storage } from "./storage";
import { transcribeLongAudio } from "./replit_integrations/audio";
import { downloadBufferFromObjectStorage } from "./objectStorageHelper";
import { sendMeetingCompletedEmail } from "./email";
import { PROMPT_DEFAULTS, substituteVars } from "./promptDefaults";
import { transcribeWithSoniox } from "./soniox";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

async function getSystemSettingValue(key: string, fallback: string): Promise<string> {
  try {
    const row = await storage.getSystemSettingByKey(key);
    if (row?.value) return row.value;
  } catch (_) {}
  return fallback;
}

async function runAnalysisWithModel(
  modelId: string,
  systemPrompt: string,
  userContent: string
): Promise<string> {
  if (modelId.startsWith("anthropic-")) {
    const modelMap: Record<string, string> = {
      "anthropic-claude-sonnet-4-6": "claude-sonnet-4-6",
      "anthropic-claude-haiku-4-5": "claude-haiku-4-5",
    };
    const anthropicModel = modelMap[modelId] || "claude-sonnet-4-6";
    const message = await anthropic.messages.create({
      model: anthropicModel,
      max_tokens: 4096,
      system: systemPrompt + "\n\nYou MUST respond with a valid JSON object only — no markdown fences, no extra text.",
      messages: [{ role: "user", content: userContent }],
      temperature: 0.3,
    });
    const text = message.content[0].type === "text" ? message.content[0].text : "{}";
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    return cleaned;
  }

  const openaiModelMap: Record<string, string> = {
    "openai-gpt-4o": "gpt-4o",
    "openai-gpt-4o-mini": "gpt-4o-mini",
  };
  const openaiModel = openaiModelMap[modelId];
  if (!openaiModel) {
    throw new Error(`Unsupported analysis model: "${modelId}". Valid values: openai-gpt-4o, openai-gpt-4o-mini, anthropic-claude-sonnet-4-6, anthropic-claude-haiku-4-5.`);
  }
  const response = await openai.chat.completions.create({
    model: openaiModel,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });
  return response.choices[0].message.content || "{}";
}

async function getPromptValue(key: string, vars: Record<string, string> = {}): Promise<string> {
  try {
    const row = await storage.getPromptSettingByKey(key);
    if (row) return substituteVars(row.value, vars);
  } catch (_) {}
  const def = PROMPT_DEFAULTS[key];
  if (!def) throw new Error(`No prompt default found for key: ${key}`);
  return substituteVars(def.value, vars);
}

async function buildNormalizationPrompt(languageCode: string, langOptionOverride?: string | null, vars: Record<string, string> = {}): Promise<string> {
  const allVars = { "{{languageCode}}": languageCode, ...vars };
  if (langOptionOverride && langOptionOverride.trim()) {
    return substituteVars(langOptionOverride.trim(), allVars);
  }
  return await getPromptValue("normalization", allVars);
}

async function normalizeTranscriptToPureLanguage(text: string, audioLanguage: string): Promise<string> {
  const langOption = await storage.getAudioLanguageOptionByCode(audioLanguage);
  const shouldNormalize = langOption ? langOption.normalize : false;
  if (!shouldNormalize) return text;

  const systemPrompt = await buildNormalizationPrompt(audioLanguage, langOption?.normalizationPrompt);
  console.log(`[process] Normalizing transcript to pure language: ${audioLanguage}...`);

  const CHUNK_CHARS = 8000;
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length > CHUNK_CHARS && current.length > 0) {
      chunks.push(current.trim());
      current = "";
    }
    current += (current ? "\n\n" : "") + para;
  }
  if (current.trim()) chunks.push(current.trim());

  const normalized: string[] = [];
  for (const chunk of chunks) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: chunk },
      ],
      temperature: 0.1,
    });
    normalized.push(completion.choices[0].message.content?.trim() || chunk);
  }

  return normalized.join("\n\n");
}

function cleanAiOutput(text: string): string {
  const lines = text.split('\n');
  const cleanedLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      cleanedLines.push(line);
      continue;
    }
    const words = trimmed.split(/\s+/);
    const uniqueWords = new Set(words.map(w => w.toLowerCase()));
    if (uniqueWords.size < words.length * 0.3 && words.length > 10) {
      continue;
    }
    cleanedLines.push(line);
  }
  
  return cleanedLines.join('\n').replace(/\n{4,}/g, '\n\n\n').trim();
}

function formatSummaryToMarkdown(summary: any): string {
  if (typeof summary === "string") return summary;
  if (typeof summary === "object" && summary !== null) {
    let md = "";
    for (const [key, value] of Object.entries(summary)) {
      const heading = key.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase()).trim();
      md += `## ${heading}\n\n`;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string") {
            md += `- ${item}\n`;
          } else if (typeof item === "object" && item !== null) {
            md += `- ${Object.values(item).join(" | ")}\n`;
          }
        }
      } else if (typeof value === "string") {
        md += `${value}\n`;
      }
      md += "\n";
    }
    return md.trim();
  }
  return String(summary);
}

export async function processMeetingCore(meetingId: number): Promise<void> {
  const meeting = await storage.getMeeting(meetingId);
  if (!meeting) {
    throw new Error(`Meeting ${meetingId} not found`);
  }

  const existingTranscript = await storage.getTranscript(meetingId);
  const hasTranscript = !!existingTranscript;

  if (!meeting.audioUrl && !hasTranscript) {
    await storage.updateMeetingStatus(meetingId, "failed");
    throw new Error(`Meeting ${meetingId} has no audio or transcript`);
  }

  await storage.clearMeetingAnalysis(meetingId);
  if (!hasTranscript) {
    await storage.clearTranscript(meetingId);
  }

  await storage.updateMeetingStatus(meetingId, "processing");

  let transcriptText: string;

  if (hasTranscript) {
    transcriptText = existingTranscript.content;
  } else {
    let audioBuffer: Buffer;
    if (meeting.audioUrl!.startsWith("/objects/")) {
      audioBuffer = await downloadBufferFromObjectStorage(meeting.audioUrl!);
    } else {
      audioBuffer = fs.readFileSync(meeting.audioUrl!);
    }
    const audioExt = path.extname(meeting.audioUrl!).toLowerCase();
    const rawFormat: "wav" | "mp3" | "webm" = audioExt === ".mp3" ? "mp3" : audioExt === ".webm" ? "webm" : "wav";
    const langHint = meeting.audioLanguage && meeting.audioLanguage !== "auto" ? meeting.audioLanguage : undefined;
    const transcriptionModel = await getSystemSettingValue("transcription_model", "openai-whisper");
    if (transcriptionModel === "soniox") {
      transcriptText = await transcribeWithSoniox(audioBuffer, rawFormat, langHint);
    } else if (transcriptionModel === "openai-whisper") {
      transcriptText = await transcribeLongAudio(audioBuffer, rawFormat, langHint);
    } else {
      throw new Error(`Unsupported transcription model: "${transcriptionModel}". Valid values: openai-whisper, soniox.`);
    }
    transcriptText = await normalizeTranscriptToPureLanguage(transcriptText, meeting.audioLanguage ?? "auto");

    await storage.createTranscript({
      meetingId,
      content: transcriptText,
      language: meeting.audioLanguage && meeting.audioLanguage !== "auto" ? meeting.audioLanguage : "en",
    });
  }

  let templateFormatInstructions = "";
  if (meeting.templateId) {
    const template = await storage.getTemplate(meeting.templateId);
    if (template) {
      templateFormatInstructions = `\n\nIMPORTANT - Use the following format/style for the summary:\n${template.formatPrompt}`;
    }
  }

  let clientName = "";
  if (meeting.clientId) {
    const client = await storage.getClient(meeting.clientId);
    if (client) clientName = client.name;
  }

  let contextSection = "";
  if (meeting.userRole) {
    contextSection += `\n\nThe person who recorded this meeting has the following role/position: ${meeting.userRole}`;
  }
  if (clientName) {
    contextSection += `\n\nClient name: ${clientName}`;
  }
  if (meeting.contextText) {
    contextSection += `\n\nAdditional context provided by the user:\n${meeting.contextText}`;
  }
  if (meeting.contextFileUrl && meeting.contextFileName) {
    try {
      let fileContent: string;
      if (meeting.contextFileUrl.startsWith("/objects/")) {
        const buf = await downloadBufferFromObjectStorage(meeting.contextFileUrl);
        fileContent = buf.toString("utf-8");
      } else {
        fileContent = fs.readFileSync(meeting.contextFileUrl, "utf-8");
      }
      contextSection += `\n\nContent from attached file (${meeting.contextFileName}):\n${fileContent}`;
    } catch (fileErr) {
      console.error("Failed to read context file:", fileErr);
    }
  }

  if (meeting.includePreviousContext && meeting.clientId) {
    try {
      const previousSummaries = await storage.getPreviousClientMeetingSummaries(meeting.clientId, meetingId);
      if (previousSummaries.length > 0) {
        contextSection += `\n\n--- PREVIOUS MEETING SUMMARIES WITH THIS CLIENT ---\nThe transcript you are about to analyse is from the MOST RECENT meeting with this client. Below are notes and summaries from earlier meetings, listed from most recent to oldest. Use them to provide continuity, track progress on action items, and reference prior discussions:\n`;
        for (const prev of previousSummaries) {
          contextSection += `\n### Earlier Meeting: "${prev.title}" (${prev.date.toLocaleDateString()})\n${prev.summary}\n`;
        }
      }
    } catch (prevErr) {
      console.error("Failed to fetch previous meeting summaries:", prevErr);
    }
  }

  const linkedPolicies = await storage.getMeetingPolicies(meetingId);
  let policyPromptSection = "";
  if (linkedPolicies.length > 0) {
    contextSection += `\n\n--- LINKED INSURANCE POLICIES ---\nThe following insurance policies are relevant to this meeting. Reference them in your analysis where applicable:\n`;
    for (const pol of linkedPolicies) {
      contextSection += `- ${pol.type} | Insurer: ${pol.insurer} | Policy Number: ${pol.policyNumber}\n`;
    }
    policyPromptSection = `\n\n            IMPORTANT: This meeting has linked insurance policies. You MUST begin the summary with a "## Applicable Policies" section that lists each linked policy in this format:\n            ## Applicable Policies\n`;
    for (const pol of linkedPolicies) {
      policyPromptSection += `            - **${pol.type}** | Insurer: ${pol.insurer} | Policy Number: ${pol.policyNumber}\n`;
    }
    policyPromptSection += `\n            This section MUST appear FIRST in the summary, before the Executive Summary section. Then continue with the rest of the report structure below.`;
  }

  const outputLangMap: Record<string, string> = { en: "English", af: "Afrikaans" };
  const outputLangName = outputLangMap[meeting.outputLanguage] || "English";

  const internalMeetingInstruction = meeting.isInternal
    ? `\n\nIMPORTANT CONTEXT: This is an INTERNAL meeting — an internal discussion or dictation where the client was NOT present. The transcript contains ONLY the user's own notes, thoughts, or internal team discussion. Do NOT look for or reference client responses, client questions, or client statements in the transcript. Treat everything as internal notes or dictation. Frame the summary accordingly as internal notes/observations rather than a client-facing meeting recap.`
    : "";

  let consentInstruction = "";
  if (meeting.clientRecordingConsent === "yes") {
    consentInstruction = `\n\nRECORDING CONSENT: The user has confirmed that explicit consent was obtained from the client to record this meeting. Include a note in the summary under a "## Recording Consent" section stating: "Client consent to record this meeting was obtained."`;
  } else if (meeting.clientRecordingConsent === "no") {
    consentInstruction = `\n\nRECORDING CONSENT: The user has indicated that explicit consent was NOT obtained from the client to record this meeting. Include a note in the summary under a "## Recording Consent" section stating: "Note: Explicit consent to record this meeting was not obtained from the client."`;
  }

  const detailKey = `analysis.detail.${meeting.detailLevel || "high"}`;

  const runtimeVars: Record<string, string> = {
    "{{outputLanguage}}": outputLangName,
    "{{clientName}}": clientName || "",
    "{{languageCode}}": meeting.audioLanguage && meeting.audioLanguage !== "auto" ? meeting.audioLanguage : "en",
  };

  const detailInstruction = await getPromptValue(detailKey, runtimeVars).catch(() =>
    substituteVars(PROMPT_DEFAULTS["analysis.detail.high"].value, runtimeVars)
  );

  const corePrompt = await getPromptValue("analysis.core", { ...runtimeVars, "{{detailInstruction}}": detailInstruction });

  let summaryStructure = "";
  if (!templateFormatInstructions) {
    summaryStructure = await getPromptValue("analysis.summary_format", runtimeVars).catch(() =>
      substituteVars(PROMPT_DEFAULTS["analysis.summary_format"].value, runtimeVars)
    );
  }

  const systemPrompt = `
            ${corePrompt}
            ${internalMeetingInstruction}
            ${consentInstruction}

            DETAIL LEVEL: ${detailInstruction}
            ${contextSection ? `\nTake the following context into account when generating your analysis:${contextSection}` : ""}
            CRITICAL: The "summary" field MUST be a single Markdown-formatted string (NOT a JSON object).
            ${clientName ? `\n            CLIENT NAME INSTRUCTION: The very first line of the summary MUST be "# ${clientName}" as a top-level heading, followed by a blank line, before any other content. This ensures the client is clearly identified at the top of every report.` : ""}
            ${policyPromptSection}
            ${templateFormatInstructions ? `
            SUMMARY FORMAT INSTRUCTIONS (from selected template — follow these closely):
            ${templateFormatInstructions}

            Structure the summary using the template instructions above. Use clear Markdown formatting with headings (##), sub-headings (###), bullet points (-), and bold text (**). The summary MUST be a string value in the JSON, not a nested object.
            ${outputLangName !== "English" ? `IMPORTANT: Translate ALL section headings, labels, and content from the template into ${outputLangName}. Do NOT keep any English headings or labels.` : ""}
            ` : `
            Structure it as a professional report with the following format${outputLangName !== "English" ? ` (ALL headings and content MUST be in ${outputLangName})` : ""}:

            ${summaryStructure}

            Use clear headings (##), sub-headings (###), bullet points (-), and bold text (**) throughout. The summary MUST be a string value in the JSON, not a nested object.
            `}
          `;

  const defaultAnalysisModel = await getSystemSettingValue("default_analysis_model", "openai-gpt-4o");
  let analysisModel = defaultAnalysisModel;
  if (meeting.templateId) {
    const template = await storage.getTemplate(meeting.templateId);
    if (template?.analysisModel) analysisModel = template.analysisModel;
  }

  const rawAnalysisJson = await runAnalysisWithModel(analysisModel, systemPrompt, transcriptText);
  const analysis = JSON.parse(rawAnalysisJson);

  if (analysis.actionItems) {
    for (const item of analysis.actionItems) {
      await storage.createActionItem({
        meetingId,
        content: item.content,
        assignee: item.assignee,
        status: "pending"
      });
    }
  }

  if (analysis.topics) {
    for (const topic of analysis.topics) {
      await storage.createTopic({
        meetingId,
        title: topic.title,
        summary: topic.summary,
        relevanceScore: topic.relevanceScore
      });
    }
  }

  if (analysis.summary) {
    const rawSummary = formatSummaryToMarkdown(analysis.summary);
    await storage.createSummary({
      meetingId,
      content: cleanAiOutput(rawSummary)
    });
  }

  await storage.updateMeetingStatus(meetingId, "completed");

  const meetingOwner = await storage.getUserById(meeting.userId);
  if (meetingOwner) {
    sendMeetingCompletedEmail(
      meetingOwner.email,
      meetingOwner.firstName || meetingOwner.email,
      meeting.title || "Untitled Meeting",
      meeting.date,
      meetingId,
      (analysis.actionItems || []).map((a: any) => ({ content: a.content, assignee: a.assignee }))
    ).catch(err => console.error("[email] Meeting completed email failed:", err));
  }
}
