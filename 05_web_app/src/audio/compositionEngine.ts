import { CATEGORY_META, SCALE_META, getCardById } from '../data/soundCards.ts';
import type {
  BeatPhraseId,
  BeatPhraseLoop,
  BeatSnapshot,
  CompositionSnapshot,
  PerformanceEvent,
  PinballQuantizePreview,
  PinballRecordedEvent,
  PinballSceneSnapshot,
  PlacedSticker,
  ScaleId,
  StepCell,
  TrackCategory,
  TrackState,
  VariationKind,
} from '../types/holo';

export const SCHEMA_VERSION = 3;
export const RENDERER_VERSION = 'holobeat-dsp-3';
export const ASSET_VERSION = 'assets-v3';

/**
 * Curated 32-step (Phrase A 0..15 + Phrase B 16..31) musical hook contours
 * indexing into SCALE_META[scale].notes (0..9).
 * Shared identically by live Beat playback, Choreographed Pinball Show & Offline WAV export.
 */
export const MELODY_CONTOUR: Record<ScaleId, number[]> = {
  PENTA_C: [
    // Phrase A (Question)
    5, 7, 8, 7, 5, 4, 5, 7, 8, 9, 8, 7, 5, 4, 3, 5,
    // Phrase B (Answer / Resolution)
    7, 8, 9, 8, 7, 5, 7, 8, 9, 7, 8, 5, 4, 5, 7, 5,
  ],
  MINOR_C: [
    5, 6, 7, 8, 7, 6, 5, 4, 5, 7, 9, 8, 7, 6, 4, 5,
    7, 8, 9, 7, 8, 6, 5, 7, 8, 9, 7, 6, 5, 4, 3, 5,
  ],
  DORIAN_C: [
    5, 6, 8, 7, 5, 3, 4, 6, 8, 9, 7, 6, 5, 4, 3, 5,
    6, 8, 9, 8, 6, 5, 6, 8, 7, 6, 5, 4, 5, 6, 4, 5,
  ],
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

export function fnv1aHash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function defaultVelocityForStep(stepIndex: number, accented = false): number {
  const s = stepIndex % 16;
  const baseVel = s % 4 === 0 ? 0.92 : s % 2 === 0 ? 0.8 : 0.72;
  return Math.min(1, accented ? Math.max(0.95, baseVel + 0.14) : baseVel);
}

export function makeDefaultStepCell(
  on: boolean,
  stepIndex: number,
  accented = false,
  pitchOffset = 0,
  lengthSteps: 1 | 2 | 4 = 1
): StepCell {
  return {
    on,
    velocity: defaultVelocityForStep(stepIndex, accented),
    pitchOffset: Math.max(-4, Math.min(4, Math.round(pitchOffset))),
    lengthSteps,
  };
}

/**
 * Safely migrate/normalize any TrackState (including legacy 16-step projects) to a canonical
 * 32-step representation (`0..15` Phrase A, `16..31` Phrase B) while preserving original sound!
 */
export function normalizeTrackState(track: TrackState, bars: 1 | 2 = 2): TrackState {
  const rawSteps = Array.isArray(track.steps) ? track.steps : [];
  const rawAccents = Array.isArray(track.accents) ? track.accents : [];
  const rawCells = Array.isArray(track.stepCells) ? track.stepCells : [];
  const isLegacy16 = rawSteps.length <= 16;

  const steps: boolean[] = Array.from({ length: 32 }, (_, i) => {
    if (i < rawSteps.length) return Boolean(rawSteps[i]);
    if (isLegacy16 && bars === 2) return Boolean(rawSteps[i % 16]);
    return false;
  });

  const accents: boolean[] = Array.from({ length: 32 }, (_, i) => {
    if (i < rawAccents.length) return Boolean(rawAccents[i]);
    if (isLegacy16 && bars === 2) return Boolean(rawAccents[i % 16]);
    return false;
  });

  const stepCells: StepCell[] = Array.from({ length: 32 }, (_, i) => {
    const srcCell =
      rawCells[i] ?? (isLegacy16 && bars === 2 ? rawCells[i % 16] : undefined);
    if (srcCell && typeof srcCell === 'object') {
      const clampedLen: 1 | 2 | 4 =
        srcCell.lengthSteps === 4 ? 4 : srcCell.lengthSteps === 2 ? 2 : 1;
      return {
        on: steps[i],
        velocity: Math.min(1, Math.max(0.35, Number(srcCell.velocity) || defaultVelocityForStep(i, accents[i]))),
        pitchOffset: Math.max(-4, Math.min(4, Math.round(Number(srcCell.pitchOffset) || 0))),
        lengthSteps: clampedLen,
      };
    }
    return makeDefaultStepCell(steps[i], i, accents[i]);
  });

  return {
    ...track,
    steps,
    accents,
    stepCells,
    volume: Math.min(1, Math.max(0, Number.isFinite(track.volume) ? track.volume : 0.8)),
    tone: Math.min(1, Math.max(0, Number.isFinite(track.tone) ? track.tone : 0.5)),
    mute: Boolean(track.mute),
    solo: Boolean(track.solo),
  };
}

export function resolveNoteForStep(
  scaleId: ScaleId,
  stepIndex: number,
  tone = 0.5,
  pitchOffset = 0
): string {
  const scaleNotes = SCALE_META[scaleId].notes;
  const contour = MELODY_CONTOUR[scaleId];
  const contourDeg = contour[((stepIndex % contour.length) + contour.length) % contour.length];
  const toneOffset = Math.round((tone - 0.5) * 4);
  const noteIdx = Math.min(
    scaleNotes.length - 1,
    Math.max(0, contourDeg + toneOffset + Math.round(pitchOffset))
  );
  return scaleNotes[noteIdx];
}

/**
 * Canonical 16th-note swing offset in milliseconds.
 * Shared identically by Beat compilation, live Holo Motion, Choreographed Show, and Offline WAV!
 */
export function getSwingOffsetMs(stepIndex: number, bpm: number, swing: number): number {
  const safeBpm = Math.max(40, bpm || 116);
  const safeSwing = Math.min(0.6, Math.max(0, swing || 0));
  const stepMs = (60 / safeBpm / 4) * 1000;
  return stepIndex % 2 === 1 ? safeSwing * stepMs * 0.5 : 0;
}

/** Exact millisecond onset for any step index (0..31) including Swing! */
export function getStepTimeMs(stepIndex: number, bpm: number, swing: number): number {
  const safeBpm = Math.max(40, bpm || 116);
  const stepMs = (60 / safeBpm / 4) * 1000;
  return stepIndex * stepMs + getSwingOffsetMs(stepIndex, safeBpm, swing);
}

/** Exact musical loop duration in milliseconds (respects exact 1-bar or 2-bar length!). */
export function computeBeatDurationMs(bpm: number, bars: 1 | 2): number {
  const safeBpm = Math.max(40, bpm || 116);
  const stepMs = (60 / safeBpm / 4) * 1000;
  return Math.round(16 * (bars === 1 ? 1 : 2) * stepMs);
}

/** Exact acoustic tail duration in milliseconds based on active FX. */
export function computeBeatTailMs(liveFx: { echo: boolean }): number {
  return liveFx.echo ? 1450 : 880;
}

/**
 * Compile a BeatSnapshot into a canonical, sorted PerformanceEvent[] stream.
 * Respects exact 1-bar (16 steps) or 2-bar independent A+B (32 steps), swing timing,
 * per-step velocity/pitchOffset/lengthSteps, accents, Mute/Solo, and Stutter FX.
 */
export function compileBeatToEvents(snapshot: BeatSnapshot): PerformanceEvent[] {
  const safeBpm = Math.max(40, snapshot.bpm || 116);
  const stepMs = (60 / safeBpm / 4) * 1000;
  const bars: 1 | 2 = snapshot.bars === 1 ? 1 : 2;
  const phraseLoop: BeatPhraseLoop = snapshot.activePhraseLoop ?? (bars === 1 ? 'A' : 'AB');
  const startStep = phraseLoop === 'B' && bars === 2 ? 16 : 0;
  const totalSteps = bars === 1 || phraseLoop === 'A' || phraseLoop === 'B' ? 16 : 32;

  const normalizedTracks = snapshot.tracks.map((t) => normalizeTrackState(t, bars));
  const anySolo = normalizedTracks.some((t) => t.solo);
  const events: PerformanceEvent[] = [];

  normalizedTracks.forEach((track, trackIdx) => {
    const isMuted = track.mute || (anySolo && !track.solo);
    if (isMuted) return;

    const catMeta = CATEGORY_META[track.category];
    for (let relIdx = 0; relIdx < totalSteps; relIdx++) {
      const stepIdx = startStep + relIdx;
      if (!track.steps[stepIdx]) continue;

      const cell = track.stepCells?.[stepIdx];
      const isAccented = Boolean(track.accents?.[stepIdx]);
      const swingOffsetMs = getSwingOffsetMs(relIdx, safeBpm, snapshot.swing);
      const timeOffsetMs = Math.round(relIdx * stepMs + swingOffsetMs);

      const baseVel = cell?.velocity ?? defaultVelocityForStep(stepIdx, isAccented);
      const velocity = Math.min(1, isAccented ? Math.max(0.95, baseVel) : baseVel);
      const pitchOffset = cell?.pitchOffset ?? 0;
      const lenMult = cell?.lengthSteps ?? 1;

      const pitch =
        track.category === 'MELODY'
          ? resolveNoteForStep(snapshot.scale, stepIdx, track.tone, pitchOffset)
          : track.category === 'VIBE'
            ? CHORD_PROGRESSIONS[snapshot.scale][Math.floor((stepIdx % 16) / 4) % 4][0]
            : track.category === 'PERC'
              ? stepIdx % 4 === 0
                ? 'G5'
                : 'D6'
              : 'C3';

      const baseDurMult =
        track.category === 'VIBE' ? 2.4 : track.category === 'MELODY' ? 1.35 : 0.85;
      const durationMs = Math.round(stepMs * baseDurMult * lenMult);

      events.push({
        id: `ev-${trackIdx}-${relIdx}`,
        timeOffsetMs,
        durationMs,
        pitch,
        velocity,
        cardId: track.cardId,
        trackCategory: track.category,
        trackIndex: trackIdx,
        stepIndex: stepIdx,
        tone: track.tone,
        color: catMeta.color,
      });

      if (snapshot.liveFx.stutter) {
        events.push({
          id: `ev-${trackIdx}-${relIdx}-stut`,
          timeOffsetMs: Math.round(timeOffsetMs + stepMs * 0.5),
          durationMs: Math.round(stepMs * 0.45),
          pitch,
          velocity: Math.max(0.35, velocity * 0.68),
          cardId: track.cardId,
          trackCategory: track.category,
          trackIndex: trackIdx,
          stepIndex: stepIdx,
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
 * Deterministic signature of musical content & DSP render parameters (independent of visual title/stickers).
 * Guarantees that changing a card's title or stickers NEVER invalidates or re-generates its rendered audio!
 */
export function computeCompositionContentSignature(snapshot: Pick<
  CompositionSnapshot,
  'sourceType' | 'bpm' | 'swing' | 'scale' | 'bars' | 'durationMs' | 'beatSnapshot' | 'events'
>): string {
  const fxPart = snapshot.beatSnapshot
    ? [
        snapshot.beatSnapshot.liveFx.bitcrush ? 1 : 0,
        snapshot.beatSnapshot.liveFx.echo ? 1 : 0,
        snapshot.beatSnapshot.liveFx.stutter ? 1 : 0,
        ...snapshot.beatSnapshot.tracks.map(
          (t) => `${t.cardId}:${t.volume.toFixed(2)}:${t.tone.toFixed(2)}:${t.mute ? 1 : 0}:${t.solo ? 1 : 0}`
        ),
      ].join(',')
    : 'pb';

  const evPart = snapshot.events
    .map(
      (e) =>
        `${e.trackIndex}@${e.timeOffsetMs}:${e.durationMs}:${e.pitch}:${e.velocity.toFixed(2)}:${e.cardId}`
    )
    .join(';');

  const raw = [
    RENDERER_VERSION,
    snapshot.sourceType,
    snapshot.bpm,
    (snapshot.swing ?? 0).toFixed(3),
    snapshot.scale,
    snapshot.bars ?? 1,
    snapshot.durationMs,
    fxPart,
    evPart,
  ].join('|');

  return `sig-${fnv1aHash32(raw).toString(16).padStart(8, '0')}-${snapshot.events.length}`;
}

export function buildAudioCacheKey(snapshot: CompositionSnapshot): string {
  const sig = snapshot.contentSignature ?? computeCompositionContentSignature(snapshot);
  const rv = snapshot.rendererVersion ?? RENDERER_VERSION;
  return `${rv}::${sig}`;
}

/**
 * Freeze a Beat Deck state into a strictly immutable CompositionSnapshot (deep-cloned!).
 */
export function createBeatCompositionSnapshot(
  beat: BeatSnapshot,
  opts: { isDemo?: boolean; title?: string } = {}
): CompositionSnapshot {
  const bars: 1 | 2 = beat.bars === 1 ? 1 : 2;
  const activePhraseLoop: BeatPhraseLoop = beat.activePhraseLoop ?? (bars === 1 ? 'A' : 'AB');
  const effectiveBars: 1 | 2 = activePhraseLoop === 'AB' && bars === 2 ? 2 : 1;

  const clonedBeat: BeatSnapshot = {
    bpm: Math.min(180, Math.max(60, Math.round(beat.bpm))),
    swing: Math.min(0.6, Math.max(0, beat.swing)),
    scale: beat.scale,
    bars,
    activePhraseLoop,
    liveFx: { ...beat.liveFx },
    tracks: beat.tracks.map((t) => {
      const norm = normalizeTrackState(t, bars);
      return {
        ...norm,
        steps: [...norm.steps],
        accents: norm.accents ? [...norm.accents] : Array<boolean>(32).fill(false),
        stepCells: norm.stepCells ? norm.stepCells.map((c) => ({ ...c })) : undefined,
      };
    }),
  };

  const events = compileBeatToEvents(clonedBeat);
  const durationMs = computeBeatDurationMs(clonedBeat.bpm, effectiveBars);
  const tailMs = computeBeatTailMs(clonedBeat.liveFx);

  const partial: CompositionSnapshot = {
    id: createStableId('snap-beat'),
    schemaVersion: SCHEMA_VERSION,
    rendererVersion: RENDERER_VERSION,
    assetVersion: ASSET_VERSION,
    title: opts.title,
    sourceType: 'beat',
    isDemo: opts.isDemo,
    capturedAt: Date.now(),
    durationMs,
    tailMs,
    bpm: clonedBeat.bpm,
    swing: clonedBeat.swing,
    scale: clonedBeat.scale,
    bars: effectiveBars,
    beatSnapshot: clonedBeat,
    events,
  };
  partial.contentSignature = computeCompositionContentSignature(partial);
  partial.soundSeed = fnv1aHash32(partial.contentSignature);
  return partial;
}

/**
 * Freeze a real Pinball recording + recoverable scene into an immutable CompositionSnapshot.
 */
export function createPinballCompositionSnapshot(
  rawEvents: PinballRecordedEvent[],
  scene: PinballSceneSnapshot,
  bpm: number,
  opts: { isDemo?: boolean; title?: string } = {}
): CompositionSnapshot {
  const events = normalizePinballEvents(rawEvents);
  const maxMs = events.reduce((m, e) => Math.max(m, e.timeOffsetMs), 0);
  const durationMs = Math.max(1200, maxMs + 400);
  const tailMs = 950;

  const partial: CompositionSnapshot = {
    id: createStableId('snap-pb'),
    schemaVersion: SCHEMA_VERSION,
    rendererVersion: RENDERER_VERSION,
    assetVersion: ASSET_VERSION,
    title: opts.title,
    sourceType: 'pinball',
    isDemo: opts.isDemo,
    capturedAt: Date.now(),
    durationMs,
    tailMs,
    bpm,
    swing: 0,
    scale: scene.scale,
    bars: durationMs > 3200 ? 2 : 1,
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
  partial.contentSignature = computeCompositionContentSignature(partial);
  partial.soundSeed = fnv1aHash32(partial.contentSignature);
  return partial;
}

/**
 * Quantize a Pinball recorded phrase into a 4 x (16 or 32) Beat Deck ghost preview without
 * destroying the original unquantized pinball events — and report exact quantization loss metrics!
 */
export function quantizePinballToBeatPreview(
  rawEvents: PinballRecordedEvent[],
  bpm: number,
  options: {
    startMs?: number;
    endMs?: number;
    targetBars?: 1 | 2;
  } = {}
): PinballQuantizePreview {
  const normalized = normalizePinballEvents(rawEvents);
  const maxAllMs = normalized.reduce((m, e) => Math.max(m, e.timeOffsetMs), 0);
  const selectedStartMs = Math.max(0, options.startMs ?? 0);
  const selectedEndMs = Math.max(selectedStartMs, options.endMs ?? maxAllMs);
  const targetBars: 1 | 2 = options.targetBars === 2 ? 2 : 1;
  const targetSteps = targetBars * 16;

  const selected = normalized.filter(
    (e) => e.timeOffsetMs >= selectedStartMs && e.timeOffsetMs <= selectedEndMs
  );

  const ghostSteps: boolean[][] = Array.from({ length: 4 }, () => Array<boolean>(32).fill(false));
  const cardCounts: Map<string, number>[] = Array.from({ length: 4 }, () => new Map());

  const stepMs = (60 / Math.max(40, bpm) / 4) * 1000;
  const loopMs = stepMs * targetSteps;
  let mappedCount = 0;
  let mergedCollisions = 0;
  let totalShiftMs = 0;
  let maxShiftMs = 0;

  selected.forEach((ev) => {
    const relMs = Math.max(0, ev.timeOffsetMs - selectedStartMs);
    const wrappedMs = relMs % loopMs;
    const rawStepFloat = wrappedMs / stepMs;
    const snappedStep = Math.round(rawStepFloat);
    const stepIdx = snappedStep % targetSteps;
    const idealMs = snappedStep * stepMs;
    const shiftMs = Math.abs(wrappedMs - idealMs);
    totalShiftMs += shiftMs;
    if (shiftMs > maxShiftMs) maxShiftMs = shiftMs;

    const tIdx = ev.trackIndex;
    if (!ghostSteps[tIdx][stepIdx]) {
      ghostSteps[tIdx][stepIdx] = true;
      mappedCount++;
    } else {
      mergedCollisions++;
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

  const avgShiftMs = selected.length > 0 ? Math.round(totalShiftMs / selected.length) : 0;

  return {
    sourceEvents: rawEvents.map((e) => ({ ...e })),
    selectedStartMs,
    selectedEndMs,
    targetBars,
    ghostSteps,
    trackCardIds,
    totalSourceEvents: normalized.length,
    selectedSourceEvents: selected.length,
    mappedCount,
    mergedCollisions,
    avgShiftMs,
    maxShiftMs: Math.round(maxShiftMs),
    durationMs: Math.max(0, selectedEndMs - selectedStartMs),
    bpm,
  };
}

/**
 * Musically constrained variations for Beat Deck (疏密 / 重拍 / 留白 / 问答).
 * Never explodes volume or creates chaotic noise; always undoable!
 */
export function applyMusicalVariationToTracks(
  tracks: TrackState[],
  kind: VariationKind,
  activePhrase: BeatPhraseId,
  bars: 1 | 2
): TrackState[] {
  const normTracks = tracks.map((t) => normalizeTrackState(t, bars));
  const phraseOffset = bars === 2 && activePhrase === 'B' ? 16 : 0;

  if (kind === 'call_response') {
    // Craft an answering Phrase B (16..31) that echoes Phrase A (0..15) with a turnaround & lift!
    return normTracks.map((t, idx) => {
      const steps = [...t.steps];
      const accents = [...(t.accents ?? Array<boolean>(32).fill(false))];
      const cells = (t.stepCells ?? []).map((c) => ({ ...c }));

      for (let s = 0; s < 16; s++) {
        const b = 16 + s;
        steps[b] = steps[s];
        accents[b] = accents[s];
        cells[b] = { ...(cells[s] ?? makeDefaultStepCell(steps[s], b, accents[s])) };
      }

      if (idx === 0) {
        // BEAT: add upbeat pickup on step 30 (beat 4.5 of bar 2) for rhythmic turnaround
        steps[30] = true;
        accents[30] = false;
        cells[30] = makeDefaultStepCell(true, 30, false, 0, 1);
        cells[30].velocity = 0.76;
      } else if (idx === 1) {
        // PERC: crisp double turnaround at steps 29 & 31
        steps[29] = true;
        steps[31] = true;
        accents[28] = true;
        cells[29] = makeDefaultStepCell(true, 29, false, 0, 1);
        cells[31] = makeDefaultStepCell(true, 31, true, 0, 1);
      } else if (idx === 2) {
        // MELODY: lift Phrase B ending up +1 scale degree and resolve cleanly on step 28
        for (let s = 16; s < 32; s++) {
          if (steps[s] && s >= 24) {
            cells[s].pitchOffset = Math.min(3, (cells[s].pitchOffset || 0) + 1);
          }
        }
        steps[28] = true;
        steps[30] = false;
        steps[31] = false;
        cells[28] = makeDefaultStepCell(true, 28, true, 0, 2);
        cells[30].on = false;
        cells[31].on = false;
      } else if (idx === 3) {
        // VIBE: breathe on step 28
        steps[28] = false;
        cells[28].on = false;
      }

      return { ...t, steps, accents, stepCells: cells };
    });
  }

  return normTracks.map((t, idx) => {
    const steps = [...t.steps];
    const accents = [...(t.accents ?? Array<boolean>(32).fill(false))];
    const cells = (t.stepCells ?? []).map((c) => ({ ...c }));

    if (kind === 'density_up') {
      const candidates =
        idx === 0
          ? [6, 10, 14]
          : idx === 1
            ? [2, 6, 10, 14, 15]
            : idx === 2
              ? [2, 5, 10, 13]
              : [4, 12];
      let added = 0;
      for (const rel of candidates) {
        const i = phraseOffset + rel;
        if (!steps[i] && added < 2) {
          steps[i] = true;
          cells[i] = makeDefaultStepCell(true, i, false, idx === 2 ? 1 : 0, 1);
          cells[i].velocity = 0.7;
          added++;
        }
      }
    } else if (kind === 'density_down') {
      // Preserve primary structural anchors (0, 4, 8, 12); trim secondary steps
      let removed = 0;
      for (let rel = 15; rel >= 0 && removed < 2; rel--) {
        if (rel === 0 || rel === 8 || (idx === 1 && (rel === 4 || rel === 12))) continue;
        const i = phraseOffset + rel;
        if (steps[i]) {
          steps[i] = false;
          accents[i] = false;
          cells[i].on = false;
          removed++;
        }
      }
    } else if (kind === 'accent_groove') {
      const accentTargets = idx === 0 ? [0, 8] : idx === 1 ? [4, 12] : idx === 2 ? [0, 6, 10] : [0];
      for (let rel = 0; rel < 16; rel++) {
        const i = phraseOffset + rel;
        const hitAccent = steps[i] && accentTargets.includes(rel);
        accents[i] = hitAccent;
        if (steps[i]) {
          cells[i].velocity = hitAccent ? 0.98 : rel % 2 === 1 ? 0.62 : 0.78;
        }
      }
    } else if (kind === 'breathing_space') {
      // Musical breath on beat 4 (steps 12..15 of active phrase), leaving only Beat/Perc anchor
      for (let rel = 12; rel < 16; rel++) {
        const i = phraseOffset + rel;
        if (idx === 1 && rel === 12) continue; // Keep crisp backbeat snare/bell on 13
        steps[i] = false;
        accents[i] = false;
        cells[i].on = false;
      }
    }

    return { ...t, steps, accents, stepCells: cells };
  });
}

/**
 * Extract REAL PCM RMS + peak waveform bars directly from a rendered AudioBuffer.
 * Returns normalized 0.1..1.0 envelope + actual peak amplitude (0..1).
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
 * always produce the exact same artistic Sound Sigil emblem (声音纹章).
 */
export function computeSoundSigilSeed(snapshot: CompositionSnapshot): number {
  const sig = [
    snapshot.sourceType,
    snapshot.bpm,
    snapshot.scale,
    snapshot.events.length,
    ...snapshot.events.slice(0, 48).map((e) => `${e.trackIndex}:${e.timeOffsetMs}:${e.pitch}:${e.cardId}`),
  ].join('|');

  return fnv1aHash32(sig);
}

export interface SoundSigilData {
  seed: number;
  spokes: { angle: number; length: number; color: string; dot: boolean }[];
  rings: number[];
  trackRatios: number[]; // [beat, perc, melody, vibe]
}

/**
 * Generate a unique artistic Sound Sigil (声音纹章) driven purely by the composition's
 * track balance, temporal density, and stable seed. (Artistic visual emblem, distinct from PCM waveform!)
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

/**
 * Canonical full-design Mint Content Hash!
 * Distinguishes ANY change to snapshot, title, rarity, foil, artwork, assetVersion,
 * or ANY sticker's type, normalized position, scale, rotation, or zIndex!
 */
export function buildMintIdempotencyKey(params: {
  snapshotId: string;
  contentSignature?: string;
  title: string;
  rarity: string;
  foil: string;
  artId: string;
  assetVersion?: string;
  stickers?: PlacedSticker[];
  /** Legacy fallback only when stickers array is not passed */
  stickerCount?: number;
}): string {
  const stickersSig = params.stickers
    ? [...params.stickers]
        .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0) || a.uid.localeCompare(b.uid))
        .map((st, idx) => {
          const rot = ((Math.round(st.rotation) % 360) + 360) % 360;
          return `${idx}:${st.stickerId}@${st.x.toFixed(1)},${st.y.toFixed(1)},s${st.scale.toFixed(2)},r${rot},z${st.zIndex ?? idx}`;
        })
        .join('|')
    : `cnt:${params.stickerCount ?? 0}`;

  const designHash = fnv1aHash32(stickersSig).toString(16).padStart(8, '0');

  return [
    params.snapshotId,
    params.contentSignature ?? 'nosig',
    params.title.trim().toUpperCase(),
    params.rarity,
    params.foil,
    params.artId,
    params.assetVersion ?? ASSET_VERSION,
    `stk-${designHash}`,
  ].join('::');
}
