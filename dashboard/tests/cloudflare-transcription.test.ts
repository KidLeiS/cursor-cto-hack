import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLOUDFLARE_TRANSCRIPTION_MODEL,
  CloudflareTranscriptionError,
  transcribeWithCloudflare,
} from "../src/lib/cloudflare-transcription";
import { POST as transcribeRecording } from "../src/app/api/task-tracker/transcribe/route";

describe("Cloudflare speech transcription", () => {
  it("sends base64 audio to Whisper Large V3 Turbo", async () => {
    let requestUrl = "";
    let requestBody: Record<string, unknown> | undefined;
    let authorization = "";
    const result = await transcribeWithCloudflare(
      new Uint8Array([1, 2, 3, 4]),
      {
        accountId: "account-id",
        apiToken: "api-token",
        fetchImpl: async (input, init) => {
          requestUrl = String(input);
          authorization = new Headers(init?.headers).get("authorization") ?? "";
          requestBody = JSON.parse(String(init?.body));
          return new Response(
            JSON.stringify({
              success: true,
              result: { text: "Prepare the client launch brief by Friday." },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        },
      },
    );

    assert.match(requestUrl, /account-id\/ai\/run\/@cf\/openai\/whisper-large-v3-turbo$/);
    assert.equal(authorization, "Bearer api-token");
    assert.equal(requestBody?.audio, "AQIDBA==");
    assert.equal(requestBody?.vad_filter, true);
    assert.equal(result.text, "Prepare the client launch brief by Friday.");
    assert.equal(result.model, CLOUDFLARE_TRANSCRIPTION_MODEL);
  });

  it("fails closed when credentials are missing", async () => {
    await assert.rejects(
      transcribeWithCloudflare(new Uint8Array([1]), {
        accountId: "",
        apiToken: "",
      }),
      (error: unknown) =>
        error instanceof CloudflareTranscriptionError &&
        error.code === "not_configured",
    );
  });

  it("rejects provider responses without detected speech", async () => {
    await assert.rejects(
      transcribeWithCloudflare(new Uint8Array([1]), {
        accountId: "account-id",
        apiToken: "api-token",
        fetchImpl: async () =>
          new Response(
            JSON.stringify({ success: true, result: { text: "  " } }),
            { status: 200 },
          ),
      }),
      (error: unknown) =>
        error instanceof CloudflareTranscriptionError &&
        error.code === "invalid_output",
    );
  });
});

describe("speech transcription endpoint", () => {
  it("requires an audio file", async () => {
    const response = await transcribeRecording(
      new Request("http://localhost/api/task-tracker/transcribe", {
        method: "POST",
        body: new FormData(),
      }),
    );
    assert.equal(response.status, 400);
  });

  it("rejects non-audio uploads", async () => {
    const formData = new FormData();
    formData.set(
      "audio",
      new File(["not audio"], "note.txt", { type: "text/plain" }),
    );
    const response = await transcribeRecording(
      new Request("http://localhost/api/task-tracker/transcribe", {
        method: "POST",
        body: formData,
      }),
    );
    assert.equal(response.status, 415);
  });
});
