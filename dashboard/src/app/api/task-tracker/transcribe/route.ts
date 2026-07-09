import { NextResponse } from "next/server";
import {
  CloudflareTranscriptionError,
  transcribeWithCloudflare,
} from "@/lib/cloudflare-transcription";
import { requireApiUser } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const unauthorized = await requireApiUser();
  if (unauthorized) return unauthorized;
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Upload the recording as multipart form data." },
      { status: 400 },
    );
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "An audio recording is required." },
      { status: 400 },
    );
  }
  if (!audio.type.startsWith("audio/")) {
    return NextResponse.json(
      { ok: false, error: "The uploaded file must be audio." },
      { status: 415 },
    );
  }
  if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Recordings must be between 1 byte and 4 MB." },
      { status: 413 },
    );
  }

  try {
    const result = await transcribeWithCloudflare(
      new Uint8Array(await audio.arrayBuffer()),
    );
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof CloudflareTranscriptionError) {
      const status =
        error.code === "not_configured"
          ? 503
          : error.code === "invalid_output"
            ? 422
            : 502;
      return NextResponse.json(
        { ok: false, code: error.code, error: error.message },
        { status },
      );
    }
    return NextResponse.json(
      { ok: false, error: "The recording could not be transcribed." },
      { status: 500 },
    );
  }
}
