import { storage } from "./storage";
import { transcribeLongAudio } from "./replit_integrations/audio";
import { downloadBufferFromObjectStorage } from "./objectStorageHelper";
import { sendMeetingCompletedEmail } from "./email";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

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
    transcriptText = await transcribeLongAudio(audioBuffer, rawFormat);

    await storage.createTranscript({
      meetingId,
      content: transcriptText,
      language: "en"
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

  const detailLevelMap: Record<string, string> = {
    high: "Provide a COMPREHENSIVE and DETAILED analysis. Include thorough discussion points, detailed action items with full context, in-depth topic analysis, and an extensive executive summary covering all aspects of the meeting. Be verbose and leave nothing out.",
    medium: "Provide a BALANCED analysis with moderate detail. Cover the main discussion points, key action items, and important topics. The executive summary should capture the essentials without being overly brief or overly long.",
    low: "Provide a BRIEF and CONCISE analysis. Focus only on the most critical points, essential action items, and top-priority topics. Keep the executive summary short and to the point — no more than a few paragraphs.",
  };
  const detailInstruction = detailLevelMap[meeting.detailLevel] || detailLevelMap.high;

  const systemPrompt = `
            You are an expert meeting analyst. Analyze the following meeting transcript.

            IMPORTANT: You MUST write ALL of your output (summary, action items, and topics) in ${outputLangName}. The transcript may be in any language, but your analysis output MUST be entirely in ${outputLangName}. Do NOT leave any part of your response in a different language. Only the JSON keys should remain in English.
            ${internalMeetingInstruction}
            ${consentInstruction}

            DETAIL LEVEL: ${detailInstruction}
            
            Extract:
            1. Action Items (assignee if clear, otherwise 'Unknown')
            2. Key Topics (title, summary, relevance score 1-100)
            3. Executive Summary as a structured report in Markdown format
            ${contextSection ? `\nTake the following context into account when generating your analysis:${contextSection}` : ""}
            
            Return JSON in this format:
            {
                "actionItems": [{"content": "...", "assignee": "...", "status": "pending"}],
                "topics": [{"title": "...", "summary": "...", "relevanceScore": 85}],
                "summary": "<markdown report string>"
            }

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

            ${outputLangName === "Afrikaans" ? `## Uitvoerende Opsomming
            'n Kort 2-3 sin oorsig van die vergadering.

            ## Sleutel Besprekingspunte
            - **Punttitel**: Beskrywing van wat bespreek is
            - **Punttitel**: Beskrywing van wat bespreek is

            ## Besluite Geneem
            - Besluit 1
            - Besluit 2

            ## Aanbevelings
            - Aanbeveling met verduideliking

            ## Aksie-items & Volgende Stappe
            - **Taak**: Beskrywing | **Toegewys aan**: Persoon | **Prioriteit**: Hoog/Medium/Laag

            ## Beperkings & Oorwegings
            - Enige beperkings of belangrike notas` : `## Executive Summary
            A brief 2-3 sentence overview of the meeting.

            ## Key Discussion Points
            - **Point title**: Description of what was discussed
            - **Point title**: Description of what was discussed

            ## Decisions Made
            - Decision 1
            - Decision 2

            ## Recommendations
            - Recommendation with explanation

            ## Action Items & Next Steps
            - **Task**: Description | **Assigned to**: Person | **Priority**: High/Medium/Low

            ## Constraints & Considerations
            - Any limitations or important notes`}

            Use clear headings (##), sub-headings (###), bullet points (-), and bold text (**) throughout. The summary MUST be a string value in the JSON, not a nested object.
            `}
            Remember: ALL text content (including ALL section headings, labels, and body text) must be in ${outputLangName}. Do NOT use English for any headings or labels when the output language is ${outputLangName}. Do NOT generate random or nonsensical text. Every word must be meaningful and relevant.
          `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: transcriptText }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3
  });

  const analysis = JSON.parse(response.choices[0].message.content || "{}");

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
