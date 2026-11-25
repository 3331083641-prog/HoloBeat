import { CATEGORY_META, SCALE_META, getCardById } from '../data/soundCards.ts';
import type {
  BeatSnapshot,
  CompositionSnapshot,
  PerformanceEvent,
  PinballQuantizePreview,
  PinballRecordedEvent,
  PinballSceneSnapshot,
  ScaleId,
  TrackCategory,
  TrackState,
} from '../types/holo';

/**
 * Curated 16-step musical hook contours (indices into SCALE_META[scale].notes 0..9).
 * Shared identically by live playback, Choreographed Pinball Show, and Offline WAV export!
 */
export const MELODY_CONTOUR: Record<ScaleId, number[]> = {
  PENTA_C: [5, 7, 8, 7, 5, 4, 5, 7, 8, 9, 8, 7, 5, 4, 3, 5],
  MINOR_C: [5, 6, 7, 8, 7, 6, 5, 4, 5, 7, 9, 8, 7, 6, 4, 5],
  DORIAN_C: [5, 6, 8, 7, 5, 3, 4, 6, 8, 9, 7, 6, 5, 4, 3, 5],
};

export const CHORD_PROGRESSIONS: Record<ScaleId, [string, string, string][]> = {
  PENTA_C: [
    ['C4', 'G4', 'D5'],
    ['A3', 'E4', 'C5'],
    ['F3', 'C4', 'A4'],
    ['G3', 'D4', 'A4'],
  ],
  MINOR_C: [
    ['C4', 'Eb4', 'Bb4'],
    ['Ab3', 'Eb4', 'G4'],
    ['F3', 'C4', 'Eb4'],
    ['G3', 'D4', 'F4'],
  ],
  DORIAN_C: [
    ['C4', 'Eb4', 'G4'],
    ['F3', 'A3', 'D4'],
    ['Bb3', 'D4', 'A4'],
    ['G3', 'C4', 'F4'],
  ],
};

const CATEGORY_ORDER: TrackCategory[] = ['BEAT', 'PERC', 'MELODY', 'VIBE'];

export function createStableId(prefix = 'hb'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function resolveNoteForStep(
  scaleId: ScaleId,
  stepIndex: number,
  tone = 0.5
): string {
  const scaleNotes = SCALE_META[scaleId].notes;
  const contourDeg = MELODY_CONTOUR[scaleId][stepIndex % 16];
  const toneOffset = Math.round((tone - 0.5) * 4);
  const noteIdx = Math.min(scaleNotes.length - 1, Math.max(0, contourDeg + toneOffset));
  return scaleNotes[noteIdx];
}

/**
 * Compile a BeatSnapshot into a canonical, sorted PerformanceEvent[] stream.
 * Guarantees 100% deterministic timing between Live Beat, Holo Motion, Choreographed Show & WAV Export.
 */
export function compileBeatToEvents(snapshot: BeatSnapshot): PerformanceEvent[] {
  const stepMs = (60 / snapshot.bpm / 4) * 1000;
  const bars = Math.max(1, snapshot.bars || 1);
  const totalSteps = 16 * bars;
  const anySolo = snapshot.tracks.some((t) => t.solo);
  const events: PerformanceEvent[] = [];

  snapshot.tracks.forEach((track, trackIdx) => {
    const isMuted = track.mute || (anySolo && !track.solo);
    if (isMuted) return;

    const catMeta = CATEGORY_META[track.category];
    for (let i = 0; i < totalSteps; i++) {
      const step = i % 16;
      if (!track.steps[step]) continue;

      const swingOffsetMs = step % 2 === 1 ? snapshot.swing * stepMs * 0.5 : 0;
      const timeOffsetMs = Math.round(i * stepMs + swingOffsetMs);
      const isAccented = Boolean(track.accents?.[step]);
      const baseVel = step % 4 === 0 ? 0.92 : step % 2 === 0 ? 0.8 : 0.72;
      const velocity = Math.min(1, isAccented ? Math.max(0.95, baseVel + 0.14) : baseVel);

      const pitch =
        track.category === 'MELODY'
          ? resolveNoteForStep(snapshot.scale, step, track.tone)
          : track.category === 'VIBE'
            ? CHORD_PROGRESSIONS[snapshot.scale][Math.floor(step / 4) % 4][0]
            : track.category === 'PERC'
              ? step % 4 === 0
                ? 'G5'
                : 'D6'
              : 'C3';

      const durationMs = Math.round(
        track.category === 'VIBE' ? stepMs * 2.4 : track.category === 'MELODY' ? stepMs * 1.4 : stepMs * 0.85
      );

      events.push({
        id: `ev-${trackIdx}-${i}`,
        timeOffsetMs,
        durationMs,
        pitch,
        velocity,
        cardId: track.cardId,
        trackCategory: track.category,
        trackIndex: trackIdx,
        stepIndex: step,
        tone: track.tone,
        color: catMeta.color,
      });

      // Live STUTTER FX adds a 32nd-note echo hit cleanly into the canonical event list
      if (snapshot.liveFx.stutter) {
        events.push({
          id: `ev-${trackIdx}-${i}-stut`,
          timeOffsetMs: Math.round(timeOffsetMs + stepMs * 0.5),
          durationMs: Math.round(stepMs * 0.45),
          pitch,
          velocity: Math.max(0.35, velocity * 0.68),
          cardId: track.cardId,
          trackCategory: track.category,
          trackIndex: trackIdx,
          stepIndex: step,
          tone: Math.min(1, track.tone + 0.14),
          color: catMeta.color,
        });
      }
    }
  });

  events.sort((a, b) => a.timeOffsetMs - b.timeOffsetMs || a.trackIndex - b.trackIndex);
  return events;
}

export function normalizePinballEvents(
  rawEvents: PinballRecordedEvent[]
): PerformanceEvent[] {
  if (rawEvents.length === 0) return [];
  const minTime = rawEvents.reduce((m, e) => Math.min(m, e.timeOffsetMs), rawEvents[0].timeOffsetMs);

  return rawEvents
    .map((ev, idx) => {
      const card = getCardById(ev.cardId);
      const trackIndex = Math.max(0, CATEGORY_ORDER.indexOf(card.category));
      return {
        id: ev.id ?? `pb-ev-${idx}-${ev.timeOffsetMs}`,
        timeOffsetMs: Math.max(0, Math.round(ev.timeOffsetMs - minTime)),
        durationMs: ev.durationMs ?? 260,
        pitch: ev.note,
        velocity: Math.min(1, Math.max(0.2, ev.velocity)),
        cardId: ev.cardId,
        trackCategory: card.category,
        trackIndex,
        sourceX: ev.sourceX,
        sourceY: ev.sourceY,
        color: ev.color || CATEGORY_META[card.category].color,
      };
    })
    .sort((a, b) => a.timeOffsetMs - b.timeOffsetMs);
}

/**
 * Freeze a Beat Deck state into a strictly immutable CompositionSnapshot (deep-cloned!).
 */
export function createBeatCompositionSnapshot(
  beat: BeatSnapshot,
  opts: { isDemo?: boolean } = {}
): CompositionSnapshot {
  const clonedBeat: BeatSnapshot = {
    bpm: beat.bpm,
    swing: beat.swing,
    scale: beat.scale,
    bars: Math.max(1, beat.bars || 1),
    liveFx: { ...beat.liveFx },
    tracks: beat.tracks.map((t) => ({
      ...t,
      steps: [...t.steps],
      accents: t.accents ? [...t.accents] : Array<boolean>(16).fill(false),
    })),
  };

  const events = compileBeatToEvents(clonedBeat);
  const stepMs = (60 / clonedBeat.bpm / 4) * 1000;
  const durationMs = Math.round(16 * clonedBeat.bars * stepMs);

  return {
    id: createStableId('snap-beat'),
    sourceType: 'beat',
    isDemo: opts.isDemo,
    capturedAt: Date.now(),
    durationMs,
    bpm: clonedBeat.bpm,
    scale: clonedBeat.scale,
    beatSnapshot: clonedBeat,
    events,
  };
}

/**
 * Freeze a real Pinball recording + recoverable scene into an immutable CompositionSnapshot.
 */
export function createPinballCompositionSnapshot(
  rawEvents: PinballRecordedEvent[],
  scene: PinballSceneSnapshot,
  bpm: number,
  opts: { isDemo?: boolean } = {}
): CompositionSnapshot {
  const events = normalizePinballEvents(rawEvents);
  const maxMs = events.reduce((m, e) => Math.max(m, e.timeOffsetMs), 0);
  const durationMs = Math.max(1200, maxMs + 600);

  return {
    id: createStableId('snap-pb'),
    sourceType: 'pinball',
    isDemo: opts.isDemo,
    capturedAt: Date.now(),
    durationMs,
    bpm,
    scale: scene.scale,
    pinballEvents: events.map((ev) => ({
      id: ev.id,
      timeOffsetMs: ev.timeOffsetMs,
      durationMs: ev.durationMs,
      cardId: ev.cardId,
      note: ev.pitch,
      velocity: ev.velocity,
      color: ev.color,
      sourceX: ev.sourceX,
      sourceY: ev.sourceY,
    })),
    pinballScene: {
      ...scene,
      toys: scene.toys.map((t) => ({ ...t })),
    },
    events,
  };
}

/**
 * Quantize a Pinball recorded phrase into a 4x16 Beat Deck ghost preview without
 * destroying the original unquantized pinball events!
 */
export function quantizePinballToBeatPreview(
  rawEvents: PinballRecordedEvent[],
  bpm: number
): PinballQuantizePreview {
  const normalized = normalizePinballEvents(rawEvents);
  const ghostSteps: boolean[][] = Array.from({ length: 4 }, () => Array<boolean>(16).fill(false));
  const cardCounts: Map<string, number>[] = Array.from({ length: 4 }, () => new Map());

  const stepMs = (60 / bpm / 4) * 1000;
  const loopMs = stepMs * 16;
  let mappedCount = 0;

  normalized.forEach((ev) => {
    // Wrap events modulo 1-bar loop duration into nearest 16th-note step
    const wrappedMs = ev.timeOffsetMs % loopMs;
    const stepIdx = Math.round(wrappedMs / stepMs) % 16;
    const tIdx = ev.trackIndex;
    if (!ghostSteps[tIdx][stepIdx]) {
      ghostSteps[tIdx][stepIdx] = true;
      mappedCount++;
    }
    const prev = cardCounts[tIdx].get(ev.cardId) ?? 0;
    cardCounts[tIdx].set(ev.cardId, prev + 1);
  });

  const trackCardIds = cardCounts.map((map) => {
    let bestId: string | null = null;
    let bestCount = 0;
    map.forEach((cnt, cid) => {
      if (cnt > bestCount) {
        bestCount = cnt;
        bestId = cid;
      }
    });
    return bestId;
  });

  const maxMs = normalized.reduce((m, e) => Math.max(m, e.timeOffsetMs), 0);

  return {
    sourceEvents: rawEvents.map((e) => ({ ...e })),
    ghostSteps,
    trackCardIds,
    mappedCount,
    durationMs: maxMs,
    bpm,
  };
}

/**
 * Extract REAL PCM RMS + peak waveform bars directly from a rendered AudioBuffer.
 * Zero fake/decorative curves — true audio amplitude envelope!
 */
export function extractRealWaveformBars(buffer: AudioBuffer, barCount = 28): number[] {
  const ch0 = buffer.getChannelData(0);
  const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : ch0;
  const totalSamples = ch0.length;
  if (totalSamples === 0) return Array<number>(barCount).fill(0.12);

  const sliceLen = Math.max(1, Math.floor(totalSamples / barCount));
  const rawLevels: number[] = [];
  let maxLvl = 0.001;

  for (let i = 0; i < barCount; i++) {
    const start = i * sliceLen;
    const end = Math.min(totalSamples, start + sliceLen);
    let sumSq = 0;
    let peak = 0;
    const step = Math.max(1, Math.floor((end - start) / 256));
    let n = 0;
    for (let s = start; s < end; s += step) {
      const sample = (Math.abs(ch0[s]) + Math.abs(ch1[s])) * 0.5;
      sumSq += sample * sample;
      if (sample > peak) peak = sample;
      n++;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, n));
    const combined = rms * 0.55 + peak * 0.45;
    if (combined > maxLvl) maxLvl = combined;
    rawLevels.push(combined);
  }

  return rawLevels.map((v) => Math.min(1, Math.max(0.1, +(v / maxLvl).toFixed(3))));
}

/**
 * Deterministic event-energy waveform preview (used synchronously before async PCM render completes).
 */
export function computeEventWaveformBars(
  events: PerformanceEvent[],
  durationMs: number,
  barCount = 28
): number[] {
  const safeDur = Math.max(800, durationMs);
  const buckets = Array<number>(barCount).fill(0);

  events.forEach((ev) => {
    const idx = Math.min(barCount - 1, Math.max(0, Math.floor((ev.timeOffsetMs / safeDur) * barCount)));
    const weight = ev.trackCategory === 'BEAT' ? 1.2 : ev.trackCategory === 'VIBE' ? 0.95 : 1.0;
    buckets[idx] += ev.velocity * weight;
  });

  const maxBucket = Math.max(0.01, ...buckets);
  return buckets.map((b) =>
    b <= 0 ? 0.1 : Math.min(1, Math.max(0.18, +(b / maxBucket).toFixed(3)))
  );
}

/**
 * Deterministic FNV-1a 32-bit hash seed from a CompositionSnapshot so identical works
 * always produce the exact same Generative Sound Sigil emblem!
 */
export function computeSoundSigilSeed(snapshot: CompositionSnapshot): number {
  const sig = [
    snapshot.sourceType,
    snapshot.bpm,
    snapshot.scale,
    snapshot.events.length,
    ...snapshot.events.slice(0, 48).map((e) => `${e.trackIndex}:${e.timeOffsetMs}:${e.pitch}:${e.cardId}`),
  ].join('|');

  let h = 2166136261;
  for (let i = 0; i < sig.length; i++) {
    h ^= sig.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface SoundSigilData {
  seed: number;
  spokes: { angle: number; length: number; color: string; dot: boolean }[];
  rings: number[];
  trackRatios: number[]; // [beat, perc, melody, vibe]
}

/**
 * Generate a unique artistic Sound Sigil (声音纹章) driven purely by the composition's
 * track balance, temporal density, and stable seed.
 */
export function buildSoundSigilData(snapshot: CompositionSnapshot): SoundSigilData {
  const seed = computeSoundSigilSeed(snapshot);
  const counts = [0, 0, 0, 0];
  snapshot.events.forEach((ev) => {
    if (ev.trackIndex >= 0 && ev.trackIndex < 4) counts[ev.trackIndex]++;
  });
  const total = Math.max(1, counts.reduce((a, b) => a + b, 0));
  const trackRatios = counts.map((c) => c / total);

  const spokeCount = 16;
  const safeDur = Math.max(1000, snapshot.durationMs);
  const palette = ['#7C3AED', '#FF5C2B', '#00D4AA', '#FFD60A'];

  const spokes = Array.from({ length: spokeCount }, (_, i) => {
    const startMs = (i / spokeCount) * safeDur;
    const endMs = ((i + 1) / spokeCount) * safeDur;
    const slice = snapshot.events.filter((e) => e.timeOffsetMs >= startMs && e.timeOffsetMs < endMs);
    const energy = slice.reduce((acc, e) => acc + e.velocity, 0);
    const dominantTrack = slice[0]?.trackIndex ?? ((seed + i) % 4);
    return {
      angle: (i / spokeCount) * Math.PI * 2 - Math.PI / 2,
      length: Math.min(1, 0.24 + Math.min(0.76, energy * 0.34)),
      color: palette[dominantTrack] ?? '#00D4AA',
      dot: slice.length > 0,
    };
  });

  const rings = [
    0.32 + trackRatios[0] * 0.14,
    0.58 + trackRatios[2] * 0.16,
    0.84,
  ];

  return { seed, spokes, rings, trackRatios };
}

export function buildMintIdempotencyKey(params: {
  snapshotId: string;
  title: string;
  rarity: string;
  foil: string;
  artId: string;
  stickerCount: number;
}): string {
  return [
    params.snapshotId,
    params.title.trim().toUpperCase(),
    params.rarity,
    params.foil,
    params.artId,
    params.stickerCount,
  ].join('::');
}
