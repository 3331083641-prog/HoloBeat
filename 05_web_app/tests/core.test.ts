import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMintIdempotencyKey,
  buildSoundSigilData,
  compileBeatToEvents,
  computeSoundSigilSeed,
  createBeatCompositionSnapshot,
  quantizePinballToBeatPreview,
} from '../src/audio/compositionEngine.ts';
import {
  evaluateChoreographedLaneOrb,
  evaluateParabolicJump,
  evaluateSequencerTrackOrb,
  TRACK_MOTION_PROFILES,
} from '../src/motion/holoMotion.ts';
import type { BeatSnapshot, PinballRecordedEvent } from '../src/types/holo.ts';

function makeBeatSnapshot(): BeatSnapshot {
  const mkSteps = (on: number[]) =>
    Array.from({ length: 16 }, (_, i) => on.includes(i));
  return {
    bpm: 120,
    swing: 0.15,
    scale: 'PENTA_C',
    bars: 2,
    liveFx: { bitcrush: false, echo: false, stutter: false },
    tracks: [
      {
        category: 'BEAT',
        cardId: 'card-01',
        steps: mkSteps([0, 8]),
        accents: mkSteps([0]),
        volume: 0.9,
        tone: 0.5,
        mute: false,
        solo: false,
      },
      {
        category: 'PERC',
        cardId: 'card-05',
        steps: mkSteps([4, 12]),
        accents: mkSteps([]),
        volume: 0.75,
        tone: 0.6,
        mute: false,
        solo: false,
      },
      {
        category: 'MELODY',
        cardId: 'card-09',
        steps: mkSteps([0, 3, 6, 10]),
        accents: mkSteps([0]),
        volume: 0.8,
        tone: 0.5,
        mute: false,
        solo: false,
      },
      {
        category: 'VIBE',
        cardId: 'card-13',
        steps: mkSteps([0]),
        accents: mkSteps([]),
        volume: 0.7,
        tone: 0.5,
        mute: true, // muted track must emit 0 events
        solo: false,
      },
    ],
  };
}

test('Beat compiler respects Mute/Solo, Stutter doubling, and deterministic sorting', () => {
  const snap = makeBeatSnapshot();
  const baseEvents = compileBeatToEvents(snap);
  // 2 bars * (2 BEAT + 2 PERC + 4 MELODY + 0 muted VIBE) = 16 events
  assert.equal(baseEvents.length, 16);
  for (let i = 1; i < baseEvents.length; i++) {
    assert.ok(baseEvents[i].timeOffsetMs >= baseEvents[i - 1].timeOffsetMs);
  }

  // Enable stutter -> every note gets an echo repeat -> 32 events
  snap.liveFx.stutter = true;
  const stutterEvents = compileBeatToEvents(snap);
  assert.equal(stutterEvents.length, 32);

  // Enable solo on BEAT only -> only BEAT (2*2*2 = 8 events with stutter)
  snap.tracks[0].solo = true;
  const soloEvents = compileBeatToEvents(snap);
  assert.equal(soloEvents.length, 8);
  assert.ok(soloEvents.every((e) => e.trackCategory === 'BEAT'));
});

test('CompositionSnapshot deep-clones BeatSnapshot for strict immutability', () => {
  const source = makeBeatSnapshot();
  const frozen = createBeatCompositionSnapshot(source);
  const originalCount = frozen.events.length;

  // Mutate source tracks after freezing
  source.tracks[0].steps.fill(false);
  source.bpm = 180;

  assert.equal(frozen.bpm, 120);
  assert.equal(frozen.beatSnapshot?.tracks[0].steps[0], true);
  assert.equal(frozen.events.length, originalCount);
});

test('Pinball quantization maps events onto 16 steps while preserving original recording', () => {
  const events: PinballRecordedEvent[] = [
    { timeOffsetMs: 0, cardId: 'card-01', note: 'C5', velocity: 0.8, color: '#7C3AED' },
    { timeOffsetMs: 250, cardId: 'card-05', note: 'D5', velocity: 0.7, color: '#FF5526' },
    { timeOffsetMs: 500, cardId: 'card-09', note: 'G5', velocity: 0.9, color: '#00D4AA' },
  ];
  const preview = quantizePinballToBeatPreview(events, 120); // stepMs = 125ms
  assert.equal(preview.ghostSteps[0][0], true); // 0ms -> step 0
  assert.equal(preview.ghostSteps[1][2], true); // 250ms -> step 2
  assert.equal(preview.ghostSteps[2][4], true); // 500ms -> step 4
  assert.equal(preview.sourceEvents.length, 3);
  assert.equal(preview.mappedCount, 3);
});

test('Holo Motion parabolic trajectory hits exact anchor points at phase=0 and phase=1', () => {
  const profile = TRACK_MOTION_PROFILES.MELODY;
  const startPose = evaluateParabolicJump({
    x0: 100,
    y0: 300,
    x1: 260,
    y1: 240,
    phase: 0,
    baseHeight: 40,
    profile,
  });
  const midPose = evaluateParabolicJump({
    x0: 100,
    y0: 300,
    x1: 260,
    y1: 240,
    phase: 0.5,
    baseHeight: 40,
    profile,
  });
  const endPose = evaluateParabolicJump({
    x0: 100,
    y0: 300,
    x1: 260,
    y1: 240,
    phase: 1,
    baseHeight: 40,
    profile,
  });

  assert.equal(startPose.x, 100);
  assert.equal(startPose.y, 300);
  assert.equal(endPose.x, 260);
  assert.equal(endPose.y, 240);
  assert.ok(midPose.y < 270, 'Mid-flight orb must rise above linear midpoint');

  // Single-note loop & choreographed lead-in
  const steps = Array.from({ length: 16 }, (_, i) => i === 4);
  const singleOrb = evaluateSequencerTrackOrb({
    steps,
    category: 'BEAT',
    stepFloat: 4,
    getPadCenter: (s) => ({ x: s * 30, y: 100 }),
    baseArcHeight: 24,
  });
  assert.ok(singleOrb);
  assert.equal(singleOrb.x, 120);
  assert.equal(singleOrb.y, 100);

  const showOrb = evaluateChoreographedLaneOrb({
    anchors: [
      { id: 'a', timeMs: 500, x: 200, y: 300, velocity: 0.9, pitch: 'C5', color: '#00D4AA' },
      { id: 'b', timeMs: 1000, x: 400, y: 260, velocity: 0.85, pitch: 'G5', color: '#00D4AA' },
    ],
    category: 'MELODY',
    currentTimeMs: 500,
  });
  assert.ok(showOrb);
  assert.equal(showOrb.x, 200);
  assert.equal(showOrb.y, 300);
});

test('Sound Sigil seed and Mint idempotency keys are strictly deterministic', () => {
  const snap = createBeatCompositionSnapshot(makeBeatSnapshot());
  const seedA = computeSoundSigilSeed(snap);
  const seedB = computeSoundSigilSeed(snap);
  assert.equal(seedA, seedB);

  const sigil = buildSoundSigilData(snap);
  assert.equal(sigil.spokes.length, 16);
  assert.equal(sigil.rings.length, 3);

  const k1 = buildMintIdempotencyKey({
    snapshotId: snap.id,
    title: 'Neon Night',
    rarity: 'UR',
    foil: 'prism',
    artId: 'neon-dj',
    stickerCount: 2,
  });
  const k2 = buildMintIdempotencyKey({
    snapshotId: snap.id,
    title: '  NEON NIGHT ',
    rarity: 'UR',
    foil: 'prism',
    artId: 'neon-dj',
    stickerCount: 2,
  });
  assert.equal(k1, k2);
});
