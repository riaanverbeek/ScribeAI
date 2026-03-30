import FormData from "form-data";
import fetch from "node-fetch";

const SONIOX_API_URL = "https://api.soniox.com/v1/transcribe-file";

export async function transcribeWithSoniox(
  audioBuffer: Buffer,
  format: "wav" | "mp3" | "webm",
  languageHint?: string
): Promise<string> {
  const apiKey = process.env.SONIOX_API_KEY;
  if (!apiKey) {
    throw new Error("SONIOX_API_KEY is not configured. Set this environment variable to use Soniox transcription.");
  }

  const mimeMap: Record<string, string> = {
    wav: "audio/wav",
    mp3: "audio/mpeg",
    webm: "audio/webm",
  };

  const form = new FormData();
  form.append("file", audioBuffer, {
    filename: `audio.${format}`,
    contentType: mimeMap[format] || "audio/wav",
  });
  if (languageHint) {
    form.append("language_hints", languageHint);
  }

  const response = await fetch(SONIOX_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "unknown error");
    throw new Error(`Soniox transcription failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as { text?: string; transcript?: string };
  const text = data.text || data.transcript || "";
  if (!text) {
    throw new Error("Soniox returned an empty transcript");
  }
  return text;
}
