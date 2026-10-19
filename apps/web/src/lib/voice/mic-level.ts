/**
 * Live microphone level for the visualiser, from a Web Audio AnalyserNode.
 * Only levels are computed; no audio is recorded or sent anywhere by this module.
 */

export interface MicMeter {
  /** 0..1, smoothed loudness of the caller's voice right now. */
  level(): number;
  /** 0..1 per band (low to high), for richer visuals. */
  bands(count: number): number[];
  setMuted(muted: boolean): void;
  close(): void;
}

export type MicError = "not-allowed" | "not-found" | "unsupported" | "other";

export async function openMicMeter(): Promise<MicMeter | { error: MicError }> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { error: "unsupported" };
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (err) {
    const name = (err as { name?: string }).name;
    if (name === "NotAllowedError" || name === "SecurityError") return { error: "not-allowed" };
    if (name === "NotFoundError" || name === "OverconstrainedError") return { error: "not-found" };
    return { error: "other" };
  }

  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    for (const track of stream.getTracks()) track.stop();
    return { error: "unsupported" };
  }
  const context = new AudioCtx();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.75;
  source.connect(analyser);

  const time = new Uint8Array(analyser.fftSize);
  const freq = new Uint8Array(analyser.frequencyBinCount);
  let smoothed = 0;
  let muted = false;

  return {
    level() {
      if (muted) return 0;
      analyser.getByteTimeDomainData(time);
      let sum = 0;
      for (const sample of time) {
        const centred = (sample - 128) / 128;
        sum += centred * centred;
      }
      const rms = Math.sqrt(sum / time.length);
      // Map typical speech RMS (~0.02-0.25) onto 0..1 and smooth it.
      const target = Math.min(1, Math.max(0, (rms - 0.015) * 5));
      smoothed += (target - smoothed) * (target > smoothed ? 0.5 : 0.12);
      return smoothed;
    },
    bands(count) {
      if (muted) return Array.from({ length: count }, () => 0);
      analyser.getByteFrequencyData(freq);
      // Voice energy lives in the lower part of the spectrum; use the first ~60% of bins.
      const usable = Math.floor(freq.length * 0.6);
      const size = Math.max(1, Math.floor(usable / count));
      return Array.from({ length: count }, (_, i) => {
        let sum = 0;
        for (let j = i * size; j < (i + 1) * size; j++) sum += freq[j] ?? 0;
        return sum / size / 255;
      });
    },
    setMuted(value) {
      muted = value;
      for (const track of stream.getAudioTracks()) track.enabled = !value;
    },
    close() {
      for (const track of stream.getTracks()) track.stop();
      source.disconnect();
      void context.close();
    },
  };
}
