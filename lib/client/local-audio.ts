export type RussianVoice = "svetlana" | "dmitry";
export type LocalAudioLanguage = "RU" | "KG" | "EN";

export type ActiveAudioRecording = {
  recorder: MediaRecorder;
  stream: MediaStream;
  completed: Promise<Blob>;
  stop: () => void;
};

export const MAX_RECORDING_BYTES = 10 * 1024 * 1024;
export const MAX_RECORDING_SECONDS = 60;

export async function synthesizeRussianSpeech(
  text: string,
  voice: RussianVoice,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await fetch("/local-ai/v1/audio/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice }),
    signal,
  });

  if (!response.ok) throw new Error("local_voice_unavailable");

  const audio = await response.blob();
  if (audio.size === 0) throw new Error("local_voice_unavailable");
  return audio;
}

export async function transcribeRecording(
  blob: Blob,
  language: LocalAudioLanguage,
  signal?: AbortSignal,
): Promise<string> {
  if (blob.size === 0) throw new Error("recording_empty");
  if (blob.size > MAX_RECORDING_BYTES) throw new Error("recording_too_large");

  const form = new FormData();
  form.append("audio", blob, "ademi-recording.webm");
  form.append("language", language);

  const response = await fetch("/local-ai/v1/audio/transcribe", {
    method: "POST",
    body: form,
    signal,
  });
  if (!response.ok) throw new Error("local_transcription_unavailable");

  const payload = (await response.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof payload?.text === "string" ? payload.text.trim() : "";
  if (!text) throw new Error("recording_empty");
  return text;
}

export async function startAudioRecording(): Promise<ActiveAudioRecording> {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === "undefined"
  ) {
    throw new Error("recording_unsupported");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : undefined;
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }

  const chunks: BlobPart[] = [];
  let stopped = false;
  const stopTracks = () => stream.getTracks().forEach((track) => track.stop());
  const completed = new Promise<Blob>((resolve, reject) => {
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });
    recorder.addEventListener(
      "stop",
      () => {
        stopTracks();
        resolve(new Blob(chunks, { type: recorder.mimeType || "audio/webm" }));
      },
      { once: true },
    );
    recorder.addEventListener(
      "error",
      () => {
        stopTracks();
        reject(new Error("recording_failed"));
      },
      { once: true },
    );
  });

  try {
    recorder.start(250);
  } catch (error) {
    stopTracks();
    throw error;
  }

  return {
    recorder,
    stream,
    completed,
    stop() {
      if (stopped) return;
      stopped = true;
      if (recorder.state !== "inactive") recorder.stop();
      else stopTracks();
    },
  };
}

export function createAudioObjectUrl(audio: Blob) {
  return URL.createObjectURL(audio);
}

export function revokeAudioObjectUrl(url: string | null) {
  if (url) URL.revokeObjectURL(url);
}
