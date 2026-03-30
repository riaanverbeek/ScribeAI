const SONIOX_BASE = "https://api.soniox.com/v1";
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 5 * 60 * 1_000;

function sonioxHeaders(apiKey: string): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}` };
}

async function sonioxJson<T>(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${SONIOX_BASE}${path}`, {
    method,
    headers: { ...sonioxHeaders(apiKey), "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as T & { status_code?: number; message?: string };
  if (!res.ok) {
    const msg = (json as { message?: string }).message ?? res.statusText;
    throw new Error(`Soniox ${method} ${path} failed (${res.status}): ${msg}`);
  }
  return json;
}

async function uploadFile(
  apiKey: string,
  audioBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([audioBuffer], { type: mimeType }), filename);

  const res = await fetch(`${SONIOX_BASE}/files`, {
    method: "POST",
    headers: sonioxHeaders(apiKey),
    body: form,
  });
  const json = (await res.json()) as { id?: string; message?: string };
  if (!res.ok || !json.id) {
    throw new Error(`Soniox file upload failed (${res.status}): ${json.message ?? res.statusText}`);
  }
  return json.id;
}

async function deleteResource(apiKey: string, path: string): Promise<void> {
  await fetch(`${SONIOX_BASE}${path}`, {
    method: "DELETE",
    headers: sonioxHeaders(apiKey),
  }).catch(() => {});
}

export async function transcribeWithSoniox(
  audioBuffer: Buffer,
  format: "wav" | "mp3" | "webm",
  languageHint?: string
): Promise<string> {
  const apiKey = process.env.SONIOX_API_KEY;
  if (!apiKey) {
    throw new Error(
      "SONIOX_API_KEY is not configured. Set this environment variable to use Soniox transcription."
    );
  }

  const mimeMap: Record<string, string> = {
    wav: "audio/wav",
    mp3: "audio/mpeg",
    webm: "audio/webm",
  };
  const mimeType = mimeMap[format] ?? "audio/wav";
  const filename = `audio.${format}`;

  let fileId: string | undefined;
  let transcriptionId: string | undefined;

  try {
    fileId = await uploadFile(apiKey, audioBuffer, filename, mimeType);

    const createBody: Record<string, unknown> = {
      model: "stt-async-v4",
      file_id: fileId,
    };
    if (languageHint) {
      createBody.language_hints = [languageHint];
    }

    const job = await sonioxJson<{ id: string }>(
      apiKey,
      "POST",
      "/transcriptions",
      createBody
    );
    transcriptionId = job.id;

    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const status = await sonioxJson<{ id: string; status: string }>(
        apiKey,
        "GET",
        `/transcriptions/${transcriptionId}`
      );

      if (status.status === "completed") {
        const transcript = await sonioxJson<{ id: string; text: string }>(
          apiKey,
          "GET",
          `/transcriptions/${transcriptionId}/transcript`
        );
        const text = transcript.text?.trim() ?? "";
        if (!text) {
          throw new Error("Soniox returned an empty transcript");
        }
        return text;
      }

      if (status.status === "error") {
        throw new Error("Soniox transcription job failed with status: error");
      }
    }

    throw new Error(
      `Soniox transcription timed out after ${POLL_TIMEOUT_MS / 1000}s`
    );
  } finally {
    if (transcriptionId) await deleteResource(apiKey, `/transcriptions/${transcriptionId}`);
    if (fileId) await deleteResource(apiKey, `/files/${fileId}`);
  }
}
