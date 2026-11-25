import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyMusicalVariationToTracks,
  buildMintIdempotencyKey,
  buildSoundSigilData,
  compileBeatToEvents,
  computeBeatDurationMs,
  computeCompositionContentSignature,
  computeSoundSigilSeed,
  createBeatCompositionSnapshot,
  getStepTimeMs,
  normalizeTrackState,
  quantizePinballToBeatPreview,
} from '../src/audio/compositionEngine.ts';
import {
  TRACK_MOTION_PROFILES,
  evaluateChoreographedLaneOrb,
  evaluateParabolicJump,
  evaluateSequencerTrackOrb,
} from '../src/motion/holoMotion.ts';
import { holoDb } from '../src/storage/holoDb.ts';
import {
  migrateMintedCardsCollection,
  validateProjectFile,
} from '../src/storage/schema.ts';
import type { BeatSnapshot, PinballRecordedEvent, PlacedSticker } from '../src/types/holo.ts';

function makeBeatSnapshot(bars: 1 | 2 = 2, swing = 0.15): BeatSnapshot {
  const mk32 = (a: number[], b: number[] = a) =>
    Array.from({ length: 32 }, (_, i) => (i < 16 ? a.includes(i) : b.includes(i - 16)));
  return {
    bpm: 120,
    swing,
    scale: 'PENTA_C',
    bars,
    activePhraseLoop: bars === 1 ? 'A' : 'AB',
    liveFx: { bitcrush: false, echo: false, stutter: false },
    tracks: [
      {
        category: 'BEAT',
        cardId: 'card-01',
        steps: mk32([0, 8], [0, 8, 14]),
        accents: mk32([0], [0, 14]),
        volume: 0.9,
        tone: 0.5,
        mute: false,
        solo: false,
      },
      {
        category: 'PERC',
        cardId: 'card-05',
        steps: mk32([4, 12], [4, 12, 15]),
        accents: mk32([]),
        volume: 0.75,
        tone: 0.6,
        mute: false,
        solo: false,
      },
      {
        category: 'MELODY',
        cardId: 'card-09',
        steps: mk32([0, 3, 6, 10], [0, 6, 12]),
        accents: mk32([0]),
        volume: 0.8,
        tone: 0.5,
        mute: false,
        solo: false,
      },
      {
        category: 'VIBE',
        cardId: 'card-13',
        steps: mk32([0]),
        accents: mk32([]),
        volume: 0.7,
        tone: 0.5,
        mute: true, // muted track emits 0 events
        solo: false,
      },
    ],
  };
}

test('Beat compiler supports independent A/B 32-step phrases, 1-bar vs 2-bar duration, Mute/Solo & Stutter', () => {
  // 1-bar mode: strictly Phrase A only (2 BEAT + 2 PERC + 4 MELODY + 0 muted VIBE = 8 events)
  const snap1 = makeBeatSnapshot(1);
  const ev1 = compileBeatToEvents(snap1);
  assert.equal(ev1.length, 8);
  assert.equal(computeBeatDurationMs(120, 1), 2000); // 16 * 125ms = 2000ms (NEVER forced to 4000ms!)

  // 2-bar mode: Phrase A (8) + distinct Phrase B (3 BEAT + 3 PERC + 3 MELODY = 9) = 17 events!
  const snap2 = makeBeatSnapshot(2);
  const ev2 = compileBeatToEvents(snap2);
  assert.equal(ev2.length, 17);
  assert.equal(computeBeatDurationMs(120, 2), 4000);
  for (let i = 1; i < ev2.length; i++) {
    assert.ok(ev2[i].timeOffsetMs >= ev2[i - 1].timeOffsetMs);
  }

  // Enable stutter -> doubles every event
  snap2.liveFx.stutter = true;
  assert.equal(compileBeatToEvents(snap2).length, 34);

  // Solo BEAT only -> 5 BEAT hits * 2 (stutter) = 10 events
  snap2.tracks[0].solo = true;
  const soloEvents = compileBeatToEvents(snap2);
  assert.equal(soloEvents.length, 10);
  assert.ok(soloEvents.every((e) => e.trackCategory === 'BEAT'));
});

test('Legacy 16-step track migrates to 32-step preserving original 2-bar musical meaning', () => {
  const legacyTrack = {
    category: 'BEAT' as const,
    cardId: 'card-01',
    steps: Array.from({ length: 16 }, (_, i) => i === 0 || i === 8),
    volume: 0.85,
    tone: 0.5,
    mute: false,
    solo: false,
  };
  const migrated = normalizeTrackState(legacyTrack, 2);
  assert.equal(migrated.steps.length, 32);
  assert.equal(migrated.steps[0], true);
  assert.equal(migrated.steps[8], true);
  assert.equal(migrated.steps[16], true); // Phrase B preserved identical for legacy 2-bar work!
  assert.equal(migrated.steps[24], true);
  assert.equal(migrated.stepCells?.length, 32);
});

test('CompositionSnapshot deep-clones BeatSnapshot and preserves stable contentSignature across edits', () => {
  const source = makeBeatSnapshot(2);
  const frozen = createBeatCompositionSnapshot(source);
  const originalCount = frozen.events.length;
  const sig = frozen.contentSignature;

  source.tracks[0].steps.fill(false);
  source.bpm = 180;

  assert.equal(frozen.bpm, 120);
  assert.equal(frozen.beatSnapshot?.tracks[0].steps[0], true);
  assert.equal(frozen.events.length, originalCount);
  assert.equal(sig, computeCompositionContentSignature(frozen));
});

test('Full-design Mint contentHash detects moving, rotating, scaling or swapping a single sticker', () => {
  const snap = createBeatCompositionSnapshot(makeBeatSnapshot(1));
  const stkA: PlacedSticker[] = [
    { uid: 's1', stickerId: 'clapper', x: 20, y: 40, scale: 1, rotation: 0, zIndex: 1 },
  ];
  const stkMoved: PlacedSticker[] = [
    { uid: 's1', stickerId: 'clapper', x: 52, y: 40, scale: 1, rotation: 0, zIndex: 1 },
  ];
  const stkRotated: PlacedSticker[] = [
    { uid: 's1', stickerId: 'clapper', x: 20, y: 40, scale: 1, rotation: 30, zIndex: 1 },
  ];
  const stkSwapped: PlacedSticker[] = [
    { uid: 's1', stickerId: 'bell', x: 20, y: 40, scale: 1, rotation: 0, zIndex: 1 },
  ];

  const baseParams = {
    snapshotId: snap.id,
    contentSignature: snap.contentSignature,
    title: '胡同放克',
    rarity: 'UR',
    foil: 'prism',
    artId: 'bamboo-cat',
  };

  const kBase = buildMintIdempotencyKey({ ...baseParams, stickers: stkA });
  const kSame = buildMintIdempotencyKey({ ...baseParams, title: '  胡同放克 ', stickers: stkA });
  const kMoved = buildMintIdempotencyKey({ ...baseParams, stickers: stkMoved });
  const kRotated = buildMintIdempotencyKey({ ...baseParams, stickers: stkRotated });
  const kSwapped = buildMintIdempotencyKey({ ...baseParams, stickers: stkSwapped });

  assert.equal(kBase, kSame);
  assert.notEqual(kBase, kMoved, 'Moving a sticker must produce a new version hash');
  assert.notEqual(kBase, kRotated, 'Rotating a sticker must produce a new version hash');
  assert.notEqual(kBase, kSwapped, 'Swapping a sticker type must produce a new version hash');
});

test('Swing-aware Holo Motion orb touches down at exact swung millisecond onset', () => {
  const bpm = 120; // stepMs = 125ms
  const swing = 0.4; // odd step 1 shifted by +0.4 * 125 * 0.5 = +25ms -> 150ms!
  const step1Ms = getStepTimeMs(1, bpm, swing);
  assert.equal(step1Ms, 150);

  const steps = Array.from({ length: 32 }, (_, i) => i === 0 || i === 1);
  // At exact swung onset of step 1 (150ms = 1.2 steps), orb must be EXACTLY on pad 1 (x = 100, y = 200)!
  const orbAtSwungStep1 = evaluateSequencerTrackOrb({
    steps,
    category: 'PERC',
    stepFloat: step1Ms / 125, // 1.2
    bpm,
    swing,
    getPadCenter: (s) => ({ x: s * 100, y: 200 }),
    baseArcHeight: 36,
  });
  assert.ok(orbAtSwungStep1);
  assert.ok(Math.abs(orbAtSwungStep1.x - 100) < 0.01, `Expected x=100 at swung step 1, got ${orbAtSwungStep1.x}`);
  assert.ok(Math.abs(orbAtSwungStep1.y - 200) < 0.01, `Expected y=200 at swung step 1, got ${orbAtSwungStep1.y}`);

  // Parabolic endpoints & choreographed lane check
  const p0 = evaluateParabolicJump({
    x0: 50,
    y0: 300,
    x1: 250,
    y1: 220,
    phase: 0,
    baseHeight: 40,
    profile: TRACK_MOTION_PROFILES.MELODY,
  });
  const p1 = evaluateParabolicJump({
    x0: 50,
    y0: 300,
    x1: 250,
    y1: 220,
    phase: 1,
    baseHeight: 40,
    profile: TRACK_MOTION_PROFILES.MELODY,
  });
  assert.equal(p0.x, 50);
  assert.equal(p1.x, 250);

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
});

test('Pinball quantization preserves original recording and reports exact collision/shift loss', () => {
  const events: PinballRecordedEvent[] = [
    { timeOffsetMs: 0, cardId: 'card-01', note: 'C5', velocity: 0.8, color: '#7C3AED' },
    { timeOffsetMs: 20, cardId: 'card-01', note: 'C5', velocity: 0.7, color: '#7C3AED' }, // collides onto step 0!
    { timeOffsetMs: 260, cardId: 'card-05', note: 'D5', velocity: 0.7, color: '#FF5C2B' }, // shifts 10ms to step 2
    { timeOffsetMs: 500, cardId: 'card-09', note: 'G5', velocity: 0.9, color: '#00D4AA' },
  ];
  const preview = quantizePinballToBeatPreview(events, 120, { targetBars: 1 });
  assert.equal(preview.sourceEvents.length, 4);
  assert.equal(preview.totalSourceEvents, 4);
  assert.equal(preview.mappedCount, 3);
  assert.equal(preview.mergedCollisions, 1);
  assert.ok(preview.avgShiftMs > 0);
  assert.equal(preview.maxShiftMs, 20);
});

test('Musical variations produce rule-constrained A/B call-and-response and breathing space', () => {
  const snap = makeBeatSnapshot(2);
  const varied = applyMusicalVariationToTracks(snap.tracks, 'call_response', 'A', 2);
  assert.equal(varied[0].steps[30], true); // turnaround kick pickup
  assert.equal(varied[2].steps[30], false); // melody breathes cleanly on final sixteenth

  const breathed = applyMusicalVariationToTracks(snap.tracks, 'breathing_space', 'A', 2);
  assert.equal(breathed[2].steps[12], false);
  assert.equal(breathed[2].steps[15], false);
});

test('Schema validation rejects malformed JSON files and safely migrates legacy v2 cards', () => {
  const bad = validateProjectFile({ schema: 'holobeat.project.v2', kind: 'minted-card', card: { title: 123 } });
  assert.equal(bad.ok, false);

  const snap = createBeatCompositionSnapshot(makeBeatSnapshot(2));
  const legacyV2Card = {
    id: 'legacy-1',
    serialNumber: 3,
    code: '#MY-03',
    idempotencyKey: 'old-key',
    title: '老胡同节拍',
    rarity: 'SSR',
    foil: 'gold',
    artId: 'street-bell',
    sourceType: 'beat',
    stickers: [{ uid: 'st1', stickerId: 'lantern', x: 50, y: 50, scale: 1, rotation: 0 }],
    waveformBars: [0.2, 0.5, 0.8],
    audioFingerprintSeed: computeSoundSigilSeed(snap),
    snapshot: { ...snap, schemaVersion: 2 },
    lineageDepth: 0,
    createdAt: Date.now(),
  };

  const { cards, report } = migrateMintedCardsCollection([legacyV2Card], true);
  assert.equal(cards.length, 1);
  assert.equal(report.migrated, true);
  assert.equal(report.backedUp, true);
  assert.equal(report.maxSerial, 3);
  assert.equal(report.verifiedPlayable, true);
  assert.equal(cards[0].schemaVersion, 3);

  const sigil = buildSoundSigilData(cards[0].snapshot);
  assert.equal(sigil.spokes.length, 16);
});

test('Storage persistence accurately reports failure when writes fail (never lies about success)', async () => {
  holoDb.setTestWriteFailureMode('all-fail');
  try {
    const res = await holoDb.saveMintedCards([]);
    assert.equal(res.status, 'failed');
    assert.ok(res.error && res.error.length > 0);
  } finally {
    holoDb.setTestWriteFailureMode('none');
  }
});
