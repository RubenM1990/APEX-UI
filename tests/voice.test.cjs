const assert = require("node:assert/strict");
const test = require("node:test");
const { transcribeAudio } = require("../electron/voice.cjs");

test("sends recorded audio to OpenAI and returns the trimmed transcript", async () => {
  let request;
  const result = await transcribeAudio({
    apiKey: "test-openai-key",
    audio: new Uint8Array([1, 2, 3]),
    mimeType: "audio/webm;codecs=opus",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ text: "  open folder Documents  " }) };
    },
  });

  assert.equal(request.url, "https://api.openai.com/v1/audio/transcriptions");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer test-openai-key");
  assert.equal(request.options.body.get("model"), "gpt-4o-mini-transcribe");
  assert.equal(request.options.body.get("file").type, "audio/webm");
  assert.deepEqual(Array.from(new Uint8Array(await request.options.body.get("file").arrayBuffer())), [1, 2, 3]);
  assert.deepEqual(result, { text: "open folder Documents" });
});

test("reports transcription failures and rejects unsupported or oversized recordings", async () => {
  await assert.rejects(
    transcribeAudio({ apiKey: "key", audio: new Uint8Array([1]), mimeType: "audio/unknown" }),
    /format is not supported/,
  );
  await assert.rejects(
    transcribeAudio({ apiKey: "key", audio: new Uint8Array(20 * 1024 * 1024 + 1), mimeType: "audio/webm" }),
    /larger than 20 MB/,
  );
  await assert.rejects(
    transcribeAudio({
      apiKey: "key",
      audio: new Uint8Array([1]),
      mimeType: "audio/webm",
      fetchImpl: async () => ({ ok: false, status: 429 }),
    }),
    /rate limit reached/,
  );
});
