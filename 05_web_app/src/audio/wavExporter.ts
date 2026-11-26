import * as Tone from 'tone';
import { audioBufferToWavBlob } from './pcm';
export { audioBufferToWavBlob } from './pcm';
import { createVoiceRack, triggerCardOnRack } from './HoloAudioEngine';
import {
  RENDERER_VERSION,
  buildAudioCacheKey, compositionRenderSeconds, createBeatCompositionSnapshot, createPinballCompositionSnapshot,
  computeCompositionContentSignature,
} from './compositionEngine';
import { contentDigest } from '../../../shared/card-content.ts';
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

const format = {
  rendererVersion: RENDERER_VERSION,
  audioAssetVersion: 'street-racks-v3',
  fxVersion: 'room-delay-v2',
  sampleRate: 48000,
  channelCount: 2,
};

async function digestBlob(blob: Blob) {
  const bytes = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

async function renderSnapshot(snapshot: CompositionSnapshot) {
  const duration = compositionRenderSeconds(snapshot);
  if (!Number.isFinite(duration) || duration <= 0 || duration > 180) {
    throw new Error('导出支持含尾音在内最长 180 秒的作品');
  }
  const context = new Tone.OfflineContext(format.channelCount, duration, format.sampleRate);
  const resources: { dispose(): unknown }[] = [];
  function own<T extends { dispose(): unknown }>(node: T): T {
    resources.push(node);
    return node;
  }
  try {
    context.transport.bpm.value = snapshot.bpm;
    const limiter = own(new Tone.Limiter({ context, threshold: -1 })).connect(context.destination);
    const compressor = own(new Tone.Compressor({ context, threshold: -15, ratio: 3.2,
      attack: 0.008, release: 0.14 })).connect(limiter);
    const room = own(new Tone.Freeverb({ context, roomSize: 0.28, dampening: 4200, wet: 0.12 })).connect(compressor);
    const fx = snapshot.beatSnapshot?.liveFx;
    const delay = fx?.echo
      ? own(new Tone.FeedbackDelay({ context, delayTime: 45 / snapshot.bpm, feedback: 0.42, wet: 0.48 })).connect(room)
      : room;
    const bus = fx?.bitcrush ? own(new Tone.BitCrusher({ context, bits: 4 })).connect(delay) : delay;
    if (bus instanceof Tone.BitCrusher) bus.wet.value = 0.8;
    const master = own(new Tone.Gain({ context, gain: 0.96 })).connect(bus);
    const lanes = new Map<number, { filter: Tone.Filter; racks: { rack: ReturnType<typeof createVoiceRack>; busyUntil: number }[] }>();
    for (const ev of snapshot.events) {
      let lane = lanes.get(ev.trackIndex);
      if (!lane) {
        const track = snapshot.beatSnapshot?.tracks[ev.trackIndex];
        const gain = own(new Tone.Gain({ context, gain: track?.volume ?? 1 })).connect(master);
        const filter = own(new Tone.Filter({ context, frequency: 650 * Math.pow(21.5, track?.tone ?? 1), type: 'lowpass' })).connect(gain);
        lane = { filter, racks: [] };
        lanes.set(ev.trackIndex, lane);
      }
      let voice = lane.racks.find(candidate => candidate.busyUntil <= ev.timeOffsetMs);
      if (!voice) {
        if (lane.racks.length >= 32) throw new Error('同轨同时发声超过 32 个音，无法完整渲染');
        voice = { rack: own(createVoiceRack(lane.filter, context)), busyUntil: 0 };
        lane.racks.push(voice);
      }
      voice.busyUntil = ev.timeOffsetMs + 60;
      triggerCardOnRack(voice.rack, ev.cardId, { time: ev.timeOffsetMs / 1000,
        durationSec: ev.durationMs / 1000, velocity: ev.velocity, tone: ev.tone, note: ev.pitch,
        stepIndex: ev.stepIndex, scale: snapshot.scale });
    }
    const buffer = (await context.render()).get();
    if (!buffer) throw new Error('未能渲染 PCM 音频');
    const { blob, peakAmplitude, waveformBars } = audioBufferToWavBlob(buffer);
    const musicDurationSec = snapshot.durationMs / 1000;
    return { wavBlob: blob, waveformBars, durationSec: buffer.duration,
      peakAmplitude, sampleRate: format.sampleRate, musicDurationSec, tailSec: Math.max(0, buffer.duration - musicDurationSec) };
  } finally {
    for (const node of resources.reverse()) node.dispose();
    context.dispose();
  }
}

const inFlight = new Map<string, Promise<RenderArtifact>>();

export async function renderCompositionSnapshotCached(snapshot: CompositionSnapshot, forceRerender = false): Promise<RenderArtifact> {
  const contentHash = await contentDigest({ events: snapshot.events, bpm: snapshot.bpm, scale: snapshot.scale,
    durationMs: snapshot.durationMs, beat: snapshot.beatSnapshot, sourceType: snapshot.sourceType });
  const cacheKey = buildAudioCacheKey(snapshot);
  const jobKey = cacheKey + ':' + contentHash + ':' + forceRerender;
  const pending = inFlight.get(jobKey);
  if (pending) return pending;
  const work = async (): Promise<RenderArtifact> => {
    if (!forceRerender) {
      const cached = await holoDb.getAudioCache(cacheKey);
      if (cached && cached.contentHash === contentHash && cached.cacheKey === cacheKey && cached.snapshotId === snapshot.id &&
          Object.entries(format).every(([k,v]) => cached[k as keyof typeof format] === v) &&
          cached.wavBlob instanceof Blob && Array.isArray(cached.waveformBars) &&
          cached.waveformBars.length === 28 && cached.waveformBars.every(n => Number.isFinite(n) && n >= 0 && n <= 1) &&
          Math.abs(cached.durationSec - compositionRenderSeconds(snapshot)) <= 1 / format.sampleRate &&
          cached.wavBlob.size === 44 + 4 * Math.round(cached.durationSec * format.sampleRate) &&
          cached.pcmHash === await contentDigest([await digestBlob(cached.wavBlob), cached.waveformBars, cached.peakAmplitude])) {
        return { ...cached, snapshotId: snapshot.id, cacheStatus: 'hit' };
      }
    }
    const rendered = await renderSnapshot(snapshot);
    const pcmHash = await contentDigest([await digestBlob(rendered.wavBlob), rendered.waveformBars, rendered.peakAmplitude]);
    const artifact = { ...format, ...rendered, cacheKey, snapshotId: snapshot.id,
      contentSignature: computeCompositionContentSignature(snapshot), contentHash, pcmHash, cachedAt: Date.now() };
    const saved = await holoDb.saveAudioCache(artifact);
    return { ...artifact, cacheStatus: saved ? 'stored' : 'unavailable' };
  };
  const promise = work();
  inFlight.set(jobKey, promise);
  try { return await promise; } finally { inFlight.delete(jobKey); }
}

export function renderBeatMixToAudioResult(beat: BeatSnapshot, bars = beat.bars): Promise<RenderedAudioResult> {
  return renderSnapshot(createBeatCompositionSnapshot({ ...beat, bars }));
}

export function renderPinballToAudioResult(events: PinballRecordedEvent[], scale: ScaleId): Promise<RenderedAudioResult> {
  return renderSnapshot(createPinballCompositionSnapshot(events,
    { toys: [], scale, dropperX: 400, gravity: 1, dropRate: 1, bounce: 1 }, 120));
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
