const MAX_SPEECH_CHARACTERS = 6_000;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const AUDIO_TYPES = new Map([
  ["audio/webm", "webm"],
  ["audio/ogg", "ogg"],
  ["audio/mp4", "mp4"],
  ["audio/mpeg", "mp3"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
]);

async function synthesizeElevenLabs({ apiKey, voiceId, text, fetchImpl = fetch }) {
  const response = await fetchImpl(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs voice request failed (HTTP ${response.status}). Check your API key, voice ID, and account quota.`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.length === 0) throw new Error("ElevenLabs returned an empty voice recording. Try again.");
  return { provider: "ElevenLabs", audioBase64: audio.toString("base64") };
}

async function transcribeAudio({ apiKey, audio, mimeType, fetchImpl = fetch }) {
  const type = typeof mimeType === "string" ? mimeType.split(";")[0].trim().toLowerCase() : "";
  const extension = AUDIO_TYPES.get(type);
  if (!(audio instanceof ArrayBuffer) && !ArrayBuffer.isView(audio)) {
    throw new Error("Microphone audio is missing or invalid.");
  }
  if (audio.byteLength === 0 || audio.byteLength > MAX_AUDIO_BYTES) {
    throw new Error("The recording is empty or larger than 20 MB. Try a shorter recording.");
  }
  const bytes = Buffer.from(audio);
  if (!extension) throw new Error("This microphone audio format is not supported.");

  const form = new FormData();
  form.append("file", new Blob([Uint8Array.from(bytes)], { type }), `apex-recording.${extension}`);
  form.append("model", "gpt-4o-mini-transcribe");
  const response = await fetchImpl("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("OpenAI rejected the saved API key. Update it in Apex Settings.");
    if (response.status === 429) throw new Error("OpenAI rate limit reached while transcribing. Try again shortly.");
    throw new Error(`OpenAI voice transcription failed (HTTP ${response.status}). Check your account and try again.`);
  }

  const result = await response.json();
  if (typeof result.text !== "string" || !result.text.trim()) {
    throw new Error("OpenAI returned an empty transcription. Try again in a quieter place.");
  }
  return { text: result.text.trim() };
}

module.exports = { MAX_AUDIO_BYTES, MAX_SPEECH_CHARACTERS, synthesizeElevenLabs, transcribeAudio };
