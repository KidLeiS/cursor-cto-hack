import { Buffer } from "node:buffer";

export const CLOUDFLARE_TRANSCRIPTION_MODEL =
  "@cf/openai/whisper-large-v3-turbo";

type FetchLike = typeof fetch;

export class CloudflareTranscriptionError extends Error {
  constructor(
    message: string,
    readonly code: "not_configured" | "provider" | "invalid_output",
  ) {
    super(message);
    this.name = "CloudflareTranscriptionError";
  }
}

export async function transcribeWithCloudflare(
  audio: Uint8Array,
  options: {
    accountId?: string;
    apiToken?: string;
    fetchImpl?: FetchLike;
  } = {},
): Promise<{ text: string; model: string }> {
  const accountId = options.accountId ?? process.env.CF_ACC;
  const apiToken = options.apiToken ?? process.env.CF_API;
  if (!accountId || !apiToken) {
    throw new CloudflareTranscriptionError(
      "Speech input is not configured. Set CF_ACC and CF_API in Vercel.",
      "not_configured",
    );
  }
  if (audio.byteLength === 0) {
    throw new CloudflareTranscriptionError(
      "The recording contained no audio.",
      "invalid_output",
    );
  }

  const endpoint = [
    "https://api.cloudflare.com/client/v4/accounts",
    encodeURIComponent(accountId),
    "ai/run/@cf/openai/whisper-large-v3-turbo",
  ].join("/");

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio: Buffer.from(audio).toString("base64"),
        task: "transcribe",
        vad_filter: true,
        initial_prompt:
          "A product manager is describing client tasks, deadlines, priorities, owners, and deliverables.",
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    throw new CloudflareTranscriptionError(
      timedOut
        ? "Cloudflare speech recognition timed out."
        : "Cloudflare speech recognition could not be reached.",
      "provider",
    );
  }

  if (!response.ok) {
    throw new CloudflareTranscriptionError(
      `Cloudflare rejected the recording (${response.status}).`,
      "provider",
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new CloudflareTranscriptionError(
      "Cloudflare returned an unreadable transcription.",
      "provider",
    );
  }

  const wrapper = payload as {
    success?: boolean;
    result?: {
      text?: unknown;
      transcription_info?: { text?: unknown };
    };
    text?: unknown;
    transcription_info?: { text?: unknown };
  };
  if (wrapper.success === false) {
    throw new CloudflareTranscriptionError(
      "Cloudflare could not transcribe the recording.",
      "provider",
    );
  }
  const result = wrapper.result ?? wrapper;
  const text =
    typeof result.text === "string"
      ? result.text.trim()
      : typeof result.transcription_info?.text === "string"
        ? result.transcription_info.text.trim()
        : "";
  if (!text) {
    throw new CloudflareTranscriptionError(
      "No speech was detected. Try again closer to the microphone.",
      "invalid_output",
    );
  }

  return { text, model: CLOUDFLARE_TRANSCRIPTION_MODEL };
}
