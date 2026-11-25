import * as Tone from 'tone';
import { createVoiceRack, triggerCardOnRack } from './HoloAudioEngine';
import {
  RENDERER_VERSION,
  buildAudioCacheKey,
  compileBeatToEvents,
  computeBeatDurationMs,
  computeBeatTailMs,
  computeCompositionContentSignature,
  extractRealWaveformBars,
  normalizeTrackState,
} from './compositionEngine';
import { holoDb } from '../storage/holoDb';
import type {
  BeatSnapshot,
  CompositionSnapshot,
  PinballRecordedEvent,
  RenderArtifact,
  ScaleId,
} from '../types/holo';

export interface RenderedAudioResult {
  wavBlob: Blob;
  waveformBars: number[];
  durationSec: number;
  musicDurationSec: number;
  tailSec: number;
  sampleRate: number;
  peakAmplitude: number;
}

export function audioBufferToWavBlob(buffer: AudioBuffer): { blob: Blob; peakAmplitude: number } {
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  let peakAbs = 0;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      const abs = Math.abs(sample);
      if (abs > peakAbs) peakAbs = abs;
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return {
    blob: new Blob([arrayBuffer], { type: 'audio/wav' }),
    peakAmplitude: Math.round(peakAbs * 32767),
  };
}

/**
 * Render a frozen BeatSnapshot with exact bar count (respects 1-bar OR 2-bar A/B length!),
 * exact Swing, per-step velocity/pitchOffset/lengthSteps, Mute/Solo, BitCrusher, Street Echo & Stutter.
 */
export async function renderBeatMixToAudioResult(
  snapshot: BeatSnapshot,
  barsOverride?: 1 | 2
): Promise<RenderedAudioResult> {
  const bars: 1 | 2 = barsOverride ?? (snapshot.bars === 1 ? 1 : 2);
  const phraseLoop = snapshot.activePhraseLoop ?? (bars === 1 ? 'A' : 'AB');
  const effectiveBars: 1 | 2 = phraseLoop === 'AB' && bars === 2 ? 2 : 1;

  const effectiveSnap: BeatSnapshot = {
    ...snapshot,
    bars,
    activePhraseLoop: phraseLoop,
    tracks: snapshot.tracks.map((t) => normalizeTrackState(t, bars)),
  };

  const events = compileBeatToEvents(effectiveSnap);
  const musicDurationSec = computeBeatDurationMs(effectiveSnap.bpm, effectiveBars) / 1000;
  const tailSec = computeBeatTailMs(effectiveSnap.liveFx) / 1000;
  const stepSec = 60 / Math.max(40, effectiveSnap.bpm) / 4;
  const durationSec = musicDurationSec + tailSec;

  const toneBuffer = await Tone.Offline(({ destination }) => {
    const limiter = new Tone.Limiter(-1).connect(destination);
    const compressor = new Tone.Compressor({
      threshold: -15,
      ratio: 3.2,
      attack: 0.008,
      release: 0.14,
    }).connect(limiter);
    const reverb = new Tone.Freeverb({
      roomSize: 0.28,
      dampening: 4200,
      wet: 0.12,
    }).connect(compressor);

    const echo = new Tone.FeedbackDelay({
      delayTime: stepSec * 3, // exact dotted 8th at snapshot BPM
      feedback: 0.42,
      wet: effectiveSnap.liveFx.echo ? 0.48 : 0,
    }).connect(reverb);

    const bitCrusher = new Tone.BitCrusher(4).connect(echo);
    bitCrusher.wet.value = effectiveSnap.liveFx.bitcrush ? 0.8 : 0;

    const masterBus = new Tone.Gain(0.96).connect(bitCrusher);

    const trackRacks = effectiveSnap.tracks.map((track) => {
      const ch = new Tone.Channel(
        track.volume <= 0.01 ? -60 : Tone.gainToDb(track.volume),
        0
      ).connect(masterBus);
      const filt = new Tone.Filter(650 * Math.pow(21.5, track.tone), 'lowpass').connect(ch);
      return createVoiceRack(filt);
    });

    events.forEach((ev) => {
      const rack = trackRacks[ev.trackIndex];
      if (!rack) return;
      const time = 0.03 + ev.timeOffsetMs / 1000;
      if (time >= durationSec - 0.04) return;
      const useExplicitNote = ev.trackCategory === 'MELODY' || ev.trackCategory === 'PERC';
      triggerCardOnRack(rack, ev.cardId, {
        time,
        note: useExplicitNote ? ev.pitch : undefined,
        velocity: ev.velocity,
        tone: ev.tone ?? effectiveSnap.tracks[ev.trackIndex]?.tone ?? 0.5,
        stepIndex: ev.stepIndex ?? 0,
        durationSec: Math.max(0.05, ev.durationMs / 1000),
        scale: effectiveSnap.scale,
      });
    });
  }, durationSec);

  const audioBuffer = toneBuffer.get() as AudioBuffer;
  const { blob, peakAmplitude } = audioBufferToWavBlob(audioBuffer);
  return {
    wavBlob: blob,
    waveformBars: extractRealWaveformBars(audioBuffer, 28),
    durationSec,
    musicDurationSec,
    tailSec,
    sampleRate: audioBuffer.sampleRate,
    peakAmplitude,
  };
}

export async function renderPinballToAudioResult(
  events: PinballRecordedEvent[],
  scale: ScaleId
): Promise<RenderedAudioResult> {
  const maxMs = events.reduce((m, e) => Math.max(m, e.timeOffsetMs), 800);
  const musicDurationSec = Math.max(1.2, (maxMs + 400) / 1000);
  const tailSec = 0.95;
  const durationSec = Math.min(20, musicDurationSec + tailSec);

  const toneBuffer = await Tone.Offline(({ destination }) => {
    const limiter = new Tone.Limiter(-1).connect(destination);
    const compressor = new Tone.Compressor({
      threshold: -15,
      ratio: 3.2,
      attack: 0.008,
      release: 0.14,
    }).connect(limiter);
    const reverb = new Tone.Freeverb({
      roomSize: 0.3,
      dampening: 4400,
      wet: 0.14,
    }).connect(compressor);
    const rack = createVoiceRack(reverb);

    events.forEach((ev) => {
      const time = 0.04 + ev.timeOffsetMs / 1000;
      if (time < durationSec - 0.1) {
        triggerCardOnRack(rack, ev.cardId, {
          time,
          note: ev.note,
          velocity: ev.velocity,
          scale,
        });
      }
    });
  }, durationSec);

  const audioBuffer = toneBuffer.get() as AudioBuffer;
  const { blob, peakAmplitude } = audioBufferToWavBlob(audioBuffer);
  return {
    wavBlob: blob,
    waveformBars: extractRealWaveformBars(audioBuffer, 28),
    durationSec,
    musicDurationSec,
    tailSec,
    sampleRate: audioBuffer.sampleRate,
    peakAmplitude,
  };
}

/**
 * In-memory deduplication map so concurrent callers (Forge waveform + Audition + Mint + Export)
 * share the exact same single Tone.Offline render promise!
 */
const inFlightRenders = new Map<string, Promise<RenderArtifact>>();

/**
 * Canonical Snapshot Renderer with content-addressed IndexedDB Audio Cache!
 * - Respects exact 1-bar OR 2-bar length (NEVER forces 1-bar into 2 bars!)
 * - Keyed by musical contentSignature + rendererVersion: editing title or stickers
 *   reuses the EXACT same rendered WAV artifact without re-synthesizing random noise!
 * - Shared identically by Forge Audition, Real PCM Waveform, WAV Export & Motion Card Export!
 */
export async function renderCompositionSnapshotCached(
  snapshot: CompositionSnapshot,
  forceRerender = false
): Promise<RenderArtifact> {
  const contentSignature =
    snapshot.contentSignature ?? computeCompositionContentSignature(snapshot);
  const cacheKey = buildAudioCacheKey({ ...snapshot, contentSignature });

  if (!forceRerender) {
    const existingPromise = inFlightRenders.get(cacheKey);
    if (existingPromise) return existingPromise;

    const cached = await holoDb.getAudioCache(cacheKey, snapshot.id);
    if (cached && cached.wavBlob && cached.wavBlob.size > 44) {
      return cached;
    }
  }

  const job = (async (): Promise<RenderArtifact> => {
    let result: RenderedAudioResult;
    if (snapshot.sourceType === 'beat' && snapshot.beatSnapshot) {
      // Strictly respect user's selected bars (1 or 2) — NEVER override with Math.max(2, ...)
      const exactBars: 1 | 2 = snapshot.beatSnapshot.bars === 1 ? 1 : 2;
      result = await renderBeatMixToAudioResult(snapshot.beatSnapshot, exactBars);
    } else {
      const evs = snapshot.pinballEvents ?? [];
      result = await renderPinballToAudioResult(evs, snapshot.scale);
    }

    const artifact: RenderArtifact = {
      cacheKey,
      snapshotId: snapshot.id,
      contentSignature,
      rendererVersion: snapshot.rendererVersion ?? RENDERER_VERSION,
      wavBlob: result.wavBlob,
      waveformBars: result.waveformBars,
      durationSec: result.durationSec,
      musicDurationSec: result.musicDurationSec,
      tailSec: result.tailSec,
      sampleRate: result.sampleRate,
      peakAmplitude: result.peakAmplitude,
      cachedAt: Date.now(),
    };

    await holoDb.saveAudioCache(artifact);
    return artifact;
  })();

  inFlightRenders.set(cacheKey, job);
  try {
    return await job;
  } finally {
    inFlightRenders.delete(cacheKey);
  }
}

export async function renderBeatMixToWav(snapshot: BeatSnapshot, bars?: 1 | 2): Promise<Blob> {
  const res = await renderBeatMixToAudioResult(snapshot, bars);
  return res.wavBlob;
}

export async function renderPinballToWav(
  events: PinballRecordedEvent[],
  scale: ScaleId
): Promise<Blob> {
  const res = await renderPinballToAudioResult(events, scale);
  return res.wavBlob;
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
