import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  ASSET_VERSION,
  RENDERER_VERSION,
  SCHEMA_VERSION,
  applyMusicalVariationToTracks,
  buildAudioCacheKey,
  buildMintIdempotencyKey,
  computeEventWaveformBars,
  computeSoundSigilSeed,
  createBeatCompositionSnapshot,
  createPinballCompositionSnapshot,
  createStableId,
  makeDefaultStepCell,
  normalizeTrackState,
  quantizePinballToBeatPreview,
} from '../audio/compositionEngine';
import {
  CATEGORY_META,
  RARITY_META,
  SCALE_META,
  SOUND_CARDS,
  STARTER_CARD_IDS,
  getCardById,
} from '../data/soundCards';
import { CURATED_SOUNDSCAPES } from '../data/soundscapes';
import { holoDb } from '../storage/holoDb';
import {
  migrateForgeDraft,
  migrateMintedCardsCollection,
  validateProjectFile,
} from '../storage/schema';
import type {
  BeatPhraseId,
  BeatPhraseLoop,
  BeatPresetId,
  CompositionSnapshot,
  ForgeDraft,
  ForgeRarity,
  HoloBeatProjectFile,
  HoloFoilType,
  LiveFxConfig,
  LiveFxMode,
  MigrationReport,
  MintRequest,
  MintedCard,
  OnboardingProgress,
  PageId,
  PinballMode,
  PinballPresetId,
  PinballQuantizePreview,
  PinballRecordedEvent,
  PinballToy,
  PinballToyType,
  PlacedSticker,
  RemixOrigin,
  ScaleId,
  SharedCardTransition,
  SoundCardDef,
  StepCell,
  StorageSaveResult,
  ToastMessage,
  TrackCategory,
  TrackState,
  VariationKind,
} from '../types/holo';

function build32Steps(aIndices: number[], bIndices?: number[]): boolean[] {
  const arr = Array<boolean>(32).fill(false);
  aIndices.forEach((i) => {
    if (i >= 0 && i < 16) arr[i] = true;
  });
  const phraseB = bIndices ?? aIndices;
  phraseB.forEach((i) => {
    if (i >= 0 && i < 16) arr[16 + i] = true;
  });
  return arr;
}

function makePresetTrack(params: {
  category: TrackCategory;
  cardId: string;
  aSteps: number[];
  bSteps?: number[];
  aAccents?: number[];
  bAccents?: number[];
  pitchOffsets?: Record<number, number>;
  lengthSteps?: Record<number, 1 | 2 | 4>;
  volume: number;
  tone: number;
}): TrackState {
  const steps = build32Steps(params.aSteps, params.bSteps);
  const accents = build32Steps(params.aAccents ?? [], params.bAccents ?? params.aAccents ?? []);
  const stepCells: StepCell[] = Array.from({ length: 32 }, (_, i) =>
    makeDefaultStepCell(
      steps[i],
      i,
      accents[i],
      params.pitchOffsets?.[i] ?? 0,
      params.lengthSteps?.[i] ?? 1
    )
  );
  return {
    category: params.category,
    cardId: params.cardId,
    steps,
    accents,
    stepCells,
    volume: params.volume,
    tone: params.tone,
    mute: false,
    solo: false,
  };
}

function cloneTracks(tracks: TrackState[], bars: 1 | 2 = 2): TrackState[] {
  return tracks.map((t) => {
    const norm = normalizeTrackState(t, bars);
    return {
      ...norm,
      steps: [...norm.steps],
      accents: norm.accents ? [...norm.accents] : Array<boolean>(32).fill(false),
      stepCells: norm.stepCells ? norm.stepCells.map((c) => ({ ...c })) : undefined,
    };
  });
}

/**
 * 6 curated presets including 3 flagship 2-bar A/B short works (MARKET / ARCADE / NIGHT)
 * sculpted with distinct Phrase A (question) vs Phrase B (answer & turnaround), gravity, and breathing room!
 */
export const BEAT_PRESETS: Record<
  BeatPresetId,
  {
    label: string;
    zhTitle: string;
    bpm: number;
    swing: number;
    scale: ScaleId;
    bars: 1 | 2;
    liveFx: LiveFxConfig;
    tracks: TrackState[];
  }
> = {
  // Flagship #1: 胡同早市 — C 五声 116 BPM · A段轻快提问 / B段铜铃回应 + 第4拍留白
  MARKET: {
    label: '早市',
    zhTitle: '清晨弄堂 · 胡同放克',
    bpm: 116,
    swing: 0.16,
    scale: 'PENTA_C',
    bars: 2,
    liveFx: { bitcrush: false, echo: false, stutter: false },
    tracks: [
      makePresetTrack({
        category: 'BEAT',
        cardId: 'card-01',
        aSteps: [0, 6, 8, 14],
        bSteps: [0, 6, 8, 11, 14],
        aAccents: [0, 8],
        bAccents: [0, 8, 14],
        volume: 0.88,
        tone: 0.5,
      }),
      makePresetTrack({
        category: 'PERC',
        cardId: 'card-05',
        aSteps: [4, 10, 12],
        bSteps: [2, 4, 10, 12, 15],
        aAccents: [4, 12],
        bAccents: [4, 12, 15],
        volume: 0.72,
        tone: 0.58,
      }),
      makePresetTrack({
        category: 'MELODY',
        cardId: 'card-09',
        aSteps: [0, 3, 6, 8, 11], // Intentional breath at 12..15
        bSteps: [0, 2, 6, 8, 10, 12], // Answering phrase resolves cleanly on beat 4
        aAccents: [0, 8],
        bAccents: [0, 6, 12],
        pitchOffsets: { 11: 1, 22: 1, 26: 2, 28: 0 },
        lengthSteps: { 11: 2, 28: 2 },
        volume: 0.78,
        tone: 0.54,
      }),
      makePresetTrack({
        category: 'VIBE',
        cardId: 'card-13',
        aSteps: [0, 8],
        bSteps: [0, 6, 12],
        aAccents: [0],
        bAccents: [0],
        volume: 0.72,
        tone: 0.52,
      }),
    ],
  },

  // Flagship #2: 午后街机 — C 小调 124 BPM · 弹性微动四拍 + 硬币像素对话
  ARCADE: {
    label: '街机',
    zhTitle: '午后街机 · 像素投币',
    bpm: 124,
    swing: 0.1,
    scale: 'MINOR_C',
    bars: 2,
    liveFx: { bitcrush: false, echo: false, stutter: false },
    tracks: [
      makePresetTrack({
        category: 'BEAT',
        cardId: 'card-02',
        aSteps: [0, 4, 8, 12],
        bSteps: [0, 4, 8, 10, 12, 15],
        aAccents: [0, 8],
        bAccents: [0, 8, 15],
        volume: 0.9,
        tone: 0.48,
      }),
      makePresetTrack({
        category: 'PERC',
        cardId: 'card-06',
        aSteps: [2, 6, 10, 14],
        bSteps: [2, 6, 10, 12, 14, 15],
        aAccents: [6, 14],
        bAccents: [12, 15],
        volume: 0.68,
        tone: 0.66,
      }),
      makePresetTrack({
        category: 'MELODY',
        cardId: 'card-09',
        aSteps: [0, 2, 5, 8, 10],
        bSteps: [0, 3, 6, 8, 11, 13],
        aAccents: [0, 5],
        bAccents: [0, 8, 13],
        pitchOffsets: { 5: 1, 24: 1, 29: 2 },
        volume: 0.8,
        tone: 0.6,
      }),
      makePresetTrack({
        category: 'VIBE',
        cardId: 'card-15',
        aSteps: [0, 8],
        bSteps: [0, 12],
        aAccents: [0],
        bAccents: [0],
        lengthSteps: { 0: 2, 8: 2, 16: 2, 28: 2 },
        volume: 0.74,
        tone: 0.56,
      }),
    ],
  },

  // Flagship #3: 夜市灯火 — C 小调 126 BPM · 铁板烟火切分 + 回声留白
  NIGHT: {
    label: '夜市',
    zhTitle: '夜市灯火 · 霓虹夜排档',
    bpm: 126,
    swing: 0.12,
    scale: 'MINOR_C',
    bars: 2,
    liveFx: { bitcrush: false, echo: true, stutter: false },
    tracks: [
      makePresetTrack({
        category: 'BEAT',
        cardId: 'card-04',
        aSteps: [0, 4, 8, 14],
        bSteps: [0, 4, 7, 8, 12, 14],
        aAccents: [0, 8],
        bAccents: [0, 8, 12],
        volume: 0.9,
        tone: 0.44,
      }),
      makePresetTrack({
        category: 'PERC',
        cardId: 'card-07',
        aSteps: [4, 12],
        bSteps: [4, 10, 12, 15],
        aAccents: [4, 12],
        bAccents: [4, 12],
        volume: 0.74,
        tone: 0.66,
      }),
      makePresetTrack({
        category: 'MELODY',
        cardId: 'card-11',
        aSteps: [0, 3, 7, 10], // Spacious call
        bSteps: [0, 2, 5, 7, 10, 12], // Energetic answer
        aAccents: [0, 10],
        bAccents: [0, 7, 12],
        pitchOffsets: { 10: 1, 23: 1, 28: 0 },
        lengthSteps: { 10: 2, 28: 2 },
        volume: 0.8,
        tone: 0.62,
      }),
      makePresetTrack({
        category: 'VIBE',
        cardId: 'card-13',
        aSteps: [0, 6],
        bSteps: [0, 8, 12],
        aAccents: [0],
        bAccents: [0],
        volume: 0.76,
        tone: 0.58,
      }),
    ],
  },

  LOFI: {
    label: '茶馆',
    zhTitle: '茶馆午后慢拍',
    bpm: 92,
    swing: 0.34,
    scale: 'DORIAN_C',
    bars: 2,
    liveFx: { bitcrush: false, echo: false, stutter: false },
    tracks: [
      makePresetTrack({
        category: 'BEAT',
        cardId: 'card-01',
        aSteps: [0, 7, 10],
        bSteps: [0, 7, 10, 14],
        aAccents: [0],
        bAccents: [0],
        volume: 0.86,
        tone: 0.38,
      }),
      makePresetTrack({
        category: 'PERC',
        cardId: 'card-07',
        aSteps: [4, 12],
        bSteps: [4, 12, 15],
        aAccents: [4, 12],
        bAccents: [4, 12],
        volume: 0.68,
        tone: 0.46,
      }),
      makePresetTrack({
        category: 'MELODY',
        cardId: 'card-10',
        aSteps: [0, 3, 6, 11],
        bSteps: [0, 4, 6, 10, 14],
        aAccents: [0],
        bAccents: [0, 10],
        volume: 0.76,
        tone: 0.48,
      }),
      makePresetTrack({
        category: 'VIBE',
        cardId: 'card-14',
        aSteps: [0, 8],
        bSteps: [0, 8],
        aAccents: [0],
        bAccents: [0],
        volume: 0.8,
        tone: 0.42,
      }),
    ],
  },

  RAIN: {
    label: '雨巷',
    zhTitle: '雨巷氛围小品',
    bpm: 84,
    swing: 0.22,
    scale: 'DORIAN_C',
    bars: 2,
    liveFx: { bitcrush: false, echo: true, stutter: false },
    tracks: [
      makePresetTrack({
        category: 'BEAT',
        cardId: 'card-03',
        aSteps: [0, 10],
        bSteps: [0, 10, 14],
        aAccents: [0],
        bAccents: [0],
        volume: 0.72,
        tone: 0.32,
      }),
      makePresetTrack({
        category: 'PERC',
        cardId: 'card-05',
        aSteps: [3, 8, 13],
        bSteps: [3, 12],
        aAccents: [],
        bAccents: [12],
        volume: 0.54,
        tone: 0.44,
      }),
      makePresetTrack({
        category: 'MELODY',
        cardId: 'card-12',
        aSteps: [0, 4, 7, 11],
        bSteps: [0, 4, 8, 11, 14],
        aAccents: [4, 11],
        bAccents: [4, 14],
        volume: 0.7,
        tone: 0.4,
      }),
      makePresetTrack({
        category: 'VIBE',
        cardId: 'card-14',
        aSteps: [0, 8],
        bSteps: [0, 4, 8],
        aAccents: [0, 8],
        bAccents: [0],
        volume: 0.84,
        tone: 0.36,
      }),
    ],
  },

  LION: {
    label: '舞狮',
    zhTitle: '街头舞狮鼓阵',
    bpm: 132,
    swing: 0.08,
    scale: 'PENTA_C',
    bars: 2,
    liveFx: { bitcrush: false, echo: false, stutter: false },
    tracks: [
      makePresetTrack({
        category: 'BEAT',
        cardId: 'card-04',
        aSteps: [0, 2, 4, 8, 10, 12],
        bSteps: [0, 2, 4, 7, 8, 10, 12, 14],
        aAccents: [0, 4, 8, 12],
        bAccents: [0, 4, 8, 12, 14],
        volume: 0.94,
        tone: 0.56,
      }),
      makePresetTrack({
        category: 'PERC',
        cardId: 'card-08',
        aSteps: [4, 6, 12, 14],
        bSteps: [1, 4, 6, 9, 12, 14, 15],
        aAccents: [4, 12],
        bAccents: [4, 12, 15],
        volume: 0.82,
        tone: 0.72,
      }),
      makePresetTrack({
        category: 'MELODY',
        cardId: 'card-11',
        aSteps: [0, 4, 8, 12],
        bSteps: [0, 4, 6, 8, 12, 14],
        aAccents: [0, 8],
        bAccents: [0, 8, 14],
        volume: 0.76,
        tone: 0.66,
      }),
      makePresetTrack({
        category: 'VIBE',
        cardId: 'card-13',
        aSteps: [0, 8],
        bSteps: [0, 8],
        aAccents: [0],
        bAccents: [0],
        volume: 0.68,
        tone: 0.6,
      }),
    ],
  },
};

export const PINBALL_PRESETS: Record<PinballPresetId, PinballToy[]> = {
  LOOP: [
    { id: 'pb-1', type: 'block', x: 225, y: 185, angle: 0.24, cardId: 'card-01', note: 'C5' },
    { id: 'pb-2', type: 'block', x: 575, y: 230, angle: -0.24, cardId: 'card-05', note: 'D5' },
    { id: 'pb-3', type: 'bumper', x: 170, y: 365, angle: 0, cardId: 'card-05', note: 'E5' },
    { id: 'pb-4', type: 'spinner', x: 400, y: 380, angle: 0, cardId: 'card-09', note: 'G5' },
    { id: 'pb-5', type: 'bumper', x: 635, y: 375, angle: 0, cardId: 'card-01', note: 'A5' },
    { id: 'pb-6', type: 'block', x: 235, y: 535, angle: 0.22, cardId: 'card-09', note: 'G5' },
    { id: 'pb-7', type: 'block', x: 565, y: 535, angle: -0.22, cardId: 'card-13', note: 'A5' },
    { id: 'pb-8', type: 'portal', x: 400, y: 626, angle: 0, cardId: 'card-09', note: 'C5' },
  ],
  CASCADE: [
    { id: 'pc-1', type: 'block', x: 355, y: 170, angle: 0.28, cardId: 'card-09', note: 'C5' },
    { id: 'pc-2', type: 'block', x: 530, y: 268, angle: -0.28, cardId: 'card-05', note: 'D5' },
    { id: 'pc-3', type: 'block', x: 295, y: 370, angle: 0.26, cardId: 'card-01', note: 'E5' },
    { id: 'pc-4', type: 'bumper', x: 175, y: 270, angle: 0, cardId: 'card-13', note: 'G5' },
    { id: 'pc-5', type: 'spinner', x: 485, y: 445, angle: 0, cardId: 'card-09', note: 'A5' },
    { id: 'pc-6', type: 'block', x: 565, y: 548, angle: -0.26, cardId: 'card-13', note: 'G5' },
    { id: 'pc-7', type: 'bumper', x: 235, y: 540, angle: 0, cardId: 'card-05', note: 'D5' },
    { id: 'pc-8', type: 'portal', x: 400, y: 626, angle: 0, cardId: 'card-01', note: 'C5' },
  ],
  // 问答 (Call & Response): left street-beat tower dialogues with right melody-bell stairs!
  CALL_RESPONSE: [
    { id: 'cr-1', type: 'block', x: 335, y: 165, angle: -0.22, cardId: 'card-01', note: 'C5' },
    { id: 'cr-2', type: 'block', x: 470, y: 225, angle: 0.22, cardId: 'card-09', note: 'G5' },
    { id: 'cr-3', type: 'bumper', x: 215, y: 295, angle: 0, cardId: 'card-01', note: 'C5' },
    { id: 'cr-4', type: 'bumper', x: 590, y: 325, angle: 0, cardId: 'card-05', note: 'E5' },
    { id: 'cr-5', type: 'block', x: 255, y: 430, angle: 0.26, cardId: 'card-13', note: 'D5' },
    { id: 'cr-6', type: 'block', x: 545, y: 465, angle: -0.26, cardId: 'card-09', note: 'A5' },
    { id: 'cr-7', type: 'spinner', x: 400, y: 525, angle: 0, cardId: 'card-05', note: 'G5' },
    { id: 'cr-8', type: 'portal', x: 400, y: 626, angle: 0, cardId: 'card-13', note: 'C5' },
  ],
};

const DEFAULT_FORGE_STICKERS: PlacedSticker[] = [
  { uid: 'stk-init-1', stickerId: 'clapper', x: 16, y: 58, scale: 1.0, rotation: -8, zIndex: 1 },
  { uid: 'stk-init-2', stickerId: 'bell', x: 84, y: 60, scale: 1.0, rotation: 8, zIndex: 2 },
];

const DEMO_BEAT_SNAPSHOT: CompositionSnapshot = createBeatCompositionSnapshot(
  {
    bpm: BEAT_PRESETS.MARKET.bpm,
    swing: BEAT_PRESETS.MARKET.swing,
    scale: BEAT_PRESETS.MARKET.scale,
    bars: 2,
    activePhraseLoop: 'AB',
    liveFx: { ...BEAT_PRESETS.MARKET.liveFx },
    tracks: cloneTracks(BEAT_PRESETS.MARKET.tracks, 2),
  },
  { isDemo: true, title: '清晨弄堂 · 胡同放克' }
);

const INITIAL_DEMO_CARD: MintedCard = {
  id: 'demo-card-neon-night',
  schemaVersion: SCHEMA_VERSION,
  assetVersion: ASSET_VERSION,
  rendererVersion: RENDERER_VERSION,
  serialNumber: 0,
  code: '#示例-01',
  idempotencyKey: buildMintIdempotencyKey({
    snapshotId: DEMO_BEAT_SNAPSHOT.id,
    contentSignature: DEMO_BEAT_SNAPSHOT.contentSignature,
    title: '霓虹之夜',
    rarity: 'UR',
    foil: 'cyber',
    artId: 'night-sizzle',
    stickers: DEFAULT_FORGE_STICKERS,
  }),
  title: '霓虹之夜',
  rarity: 'UR',
  foil: 'cyber',
  artId: 'night-sizzle',
  sourceType: 'beat',
  isDemo: true,
  stickers: DEFAULT_FORGE_STICKERS,
  waveformBars: computeEventWaveformBars(DEMO_BEAT_SNAPSHOT.events, DEMO_BEAT_SNAPSHOT.durationMs),
  waveformIsRealPcm: false,
  audioCacheKey: buildAudioCacheKey(DEMO_BEAT_SNAPSHOT),
  audioFingerprintSeed: computeSoundSigilSeed(DEMO_BEAT_SNAPSHOT),
  snapshot: DEMO_BEAT_SNAPSHOT,
  lineageDepth: 0,
  storageStatus: 'primary',
  createdAt: 1735689600000,
};

const INITIAL_FORGE_DRAFT: ForgeDraft = {
  snapshot: DEMO_BEAT_SNAPSHOT,
  sourceType: 'beat',
  title: '胡同放克',
  rarity: 'UR',
  foil: 'prism',
  artId: 'bamboo-cat',
  stickers: DEFAULT_FORGE_STICKERS.map((s) => ({ ...s })),
  remixOrigin: null,
};

interface BeatHistoryEntry {
  bpm: number;
  swing: number;
  scale: ScaleId;
  bars: 1 | 2;
  activePhrase: BeatPhraseId;
  beatPhraseLoop: BeatPhraseLoop;
  liveFx: LiveFxConfig;
  tracks: TrackState[];
}

interface HoloState {
  // Navigation & Global Audio / Accessibility
  activePage: PageId;
  audioUnlocked: boolean;
  muted: boolean;
  reducedMotion: boolean;
  bpm: number;
  swing: number;
  scale: ScaleId;
  beatBars: 1 | 2;
  activePhrase: BeatPhraseId;
  beatPhraseLoop: BeatPhraseLoop;
  isPlaying: boolean;
  drawerOpen: boolean;
  sharedCardTransition: SharedCardTransition | null;
  onboarding: OnboardingProgress;
  dbHydrated: boolean;
  migrationReport: MigrationReport | null;

  // Collection & Gacha
  collection: string[];
  pullHistory: string[];
  pullCounts: Record<string, number>;
  totalPulls: number;
  pityCount: number;
  selectedGachaCardId: string;
  needsScratch: boolean;

  // Beat Deck
  tracks: TrackState[];
  liveFx: LiveFxConfig;
  liveFxMode: LiveFxMode;
  beatUndoStack: BeatHistoryEntry[];
  beatRedoStack: BeatHistoryEntry[];
  beatBounceMode: boolean;
  beatStageMode: boolean;
  beatRemixOrigin: RemixOrigin | null;
  pinballQuantizePreview: PinballQuantizePreview | null;

  // Pinball Synth (Dual Mode: FREE JAM + CHOREOGRAPHED SHOW)
  pinballMode: PinballMode;
  pinballShowSnapshot: CompositionSnapshot | null;
  pinballToys: PinballToy[];
  pinballUndoStack: PinballToy[][];
  pinballRedoStack: PinballToy[][];
  pinballTool: PinballToyType;
  pinballBindCardId: string;
  pinballDropperX: number;
  pinballAutoDrop: boolean;
  pinballGravity: number;
  pinballDropRate: number;
  pinballBounce: number;
  pinballRecordedEvents: PinballRecordedEvent[];
  pinballRemixOrigin: RemixOrigin | null;

  // Card Forge (Isolated Draft vs Inspect Archive + Atomic MintRequest)
  forgeDraft: ForgeDraft;
  inspectMintedId: string | null;
  lastMintedCardId: string | null;
  lastStorageError: string | null;
  mintedCards: MintedCard[];
  nextMintSerial: number;
  mintInFlight: boolean;
  stickerUndoStack: PlacedSticker[][];
  stickerRedoStack: PlacedSticker[][];

  // Toasts
  toasts: ToastMessage[];

  // Core Actions
  hydrateFromIndexedDb: () => Promise<void>;
  setActivePage: (page: PageId) => void;
  setAudioUnlocked: (unlocked: boolean) => void;
  setDrawerOpen: (open: boolean) => void;
  toggleMute: () => void;
  setReducedMotion: (on: boolean) => void;
  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  setBeatBars: (bars: 1 | 2) => void;
  setActivePhrase: (phrase: BeatPhraseId) => void;
  setBeatPhraseLoop: (loop: BeatPhraseLoop) => void;
  copyPhraseAToB: () => void;
  copyPhraseBToA: () => void;
  cycleScale: () => void;
  setScale: (scale: ScaleId) => void;
  setIsPlaying: (playing: boolean) => void;
  dismissOnboarding: () => void;
  triggerSharedTransition: (
    cardId: string,
    targetPage: PageId,
    targetTrackIndex?: number,
    sourceRect?: { x: number; y: number; w: number; h: number }
  ) => void;

  // Gacha Actions
  pullGachaCard: (skipScratch?: boolean) => { card: SoundCardDef; isNew: boolean; hitPity: boolean };
  revealCurrentCard: () => void;
  selectGachaCard: (cardId: string) => void;
  loadSoundscape: (soundscapeId: string) => void;
  sendCardToBeat: (
    cardId: string,
    targetTrackIdx?: number,
    navigate?: boolean,
    sourceRect?: { x: number; y: number; w: number; h: number }
  ) => void;
  sendCardToPinball: (
    cardId: string,
    navigate?: boolean,
    sourceRect?: { x: number; y: number; w: number; h: number }
  ) => void;

  // Beat Actions
  pushBeatUndo: () => void;
  undoBeat: () => void;
  redoBeat: () => void;
  toggleStep: (trackIndex: number, stepIndex: number, forceValue?: boolean) => void;
  toggleStepAccent: (trackIndex: number, stepIndex: number) => void;
  updateStepCell: (trackIndex: number, stepIndex: number, patch: Partial<StepCell>) => void;
  setTrackCard: (trackIndex: number, cardId: string) => void;
  setTrackVolume: (trackIndex: number, volume: number) => void;
  setTrackTone: (trackIndex: number, tone: number) => void;
  toggleTrackMute: (trackIndex: number) => void;
  toggleTrackSolo: (trackIndex: number) => void;
  applyBeatPreset: (preset: BeatPresetId) => void;
  applyBeatVariation: (kind: VariationKind) => void;
  randomizeBeat: () => void;
  clearBeat: () => void;
  setLiveFx: (fx: keyof LiveFxConfig, active: boolean) => void;
  setLiveFxMode: (mode: LiveFxMode) => void;
  resetMomentaryFx: () => void;
  setBeatBounceMode: (on: boolean) => void;
  setBeatStageMode: (on: boolean) => void;
  sendBeatToForge: () => CompositionSnapshot;
  performBeatInPinball: () => CompositionSnapshot;
  updatePinballQuantizeOptions: (opts: {
    startMs?: number;
    endMs?: number;
    targetBars?: 1 | 2;
  }) => void;
  applyPinballQuantize: (mode: 'merge' | 'replace' | 'cancel') => void;

  // Pinball Actions
  setPinballMode: (mode: PinballMode) => void;
  setPinballTool: (tool: PinballToyType) => void;
  setPinballBindCardId: (cardId: string) => void;
  setPinballDropperX: (x: number) => void;
  setPinballAutoDrop: (auto: boolean) => void;
  setPinballGravity: (g: number) => void;
  setPinballDropRate: (r: number) => void;
  setPinballBounce: (b: number) => void;
  undoPinball: () => void;
  redoPinball: () => void;
  addPinballToy: (toy: Omit<PinballToy, 'id'>) => string;
  updatePinballToy: (id: string, patch: Partial<PinballToy>, recordUndo?: boolean) => void;
  removePinballToy: (id: string) => void;
  applyPinballPreset: (preset: PinballPresetId | 'CLEAR') => void;
  setPinballRecordedEvents: (events: PinballRecordedEvent[]) => void;
  sendPinballToForge: (events: PinballRecordedEvent[]) => boolean;
  /** Strictly freezes & sends the exact Choreographed Show snapshot into Forge Draft! */
  sendPinballShowToForge: () => CompositionSnapshot | null;
  sendPinballToBeatQuantize: (events: PinballRecordedEvent[]) => boolean;

  // Forge Actions
  setForgeSource: (src: 'beat' | 'pinball') => void;
  setForgeTitle: (title: string) => void;
  setForgeRarity: (rarity: ForgeRarity) => void;
  setForgeFoil: (foil: HoloFoilType) => void;
  setForgeArtId: (artId: string) => void;
  addForgeSticker: (stickerId: string) => void;
  updateForgeSticker: (uid: string, patch: Partial<PlacedSticker>) => void;
  bringStickerToFront: (uid: string) => void;
  removeForgeSticker: (uid: string) => void;
  clearForgeStickers: () => void;
  undoForgeStickers: () => void;
  redoForgeStickers: () => void;
  inspectMintedCard: (id: string | null) => void;
  returnToForgeDraft: () => void;
  loadGachaCardIntoForgeDraft: (cardId: string) => void;
  updateMintedCardWaveform: (cardId: string, bars: number[], isRealPcm: boolean) => void;
  /** Create an immutable MintRequest snapshot immediately on user mint trigger */
  createMintRequest: () => MintRequest | null;
  /** Execute persistence-gated atomic mint consuming a frozen MintRequest */
  commitMintRequest: (
    request: MintRequest,
    realWaveformBars?: number[]
  ) => Promise<{ card: MintedCard | null; duplicate: boolean; saveResult: StorageSaveResult }>;
  /** Convenience wrapper preserving compatibility with callers */
  mintCurrentCard: (realWaveformBars?: number[]) => Promise<MintedCard | null>;
  unsealAndRemixCard: (cardId: string) => void;
  deleteMintedCard: (id: string) => Promise<boolean>;
  importProjectFile: (project: unknown) => Promise<boolean>;

  // Toast Actions
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

export const useHoloStore = create<HoloState>()(
  persist(
    (set, get) => ({
      activePage: 'gacha',
      audioUnlocked: false,
      muted: false,
      reducedMotion: false,
      bpm: BEAT_PRESETS.MARKET.bpm,
      swing: BEAT_PRESETS.MARKET.swing,
      scale: BEAT_PRESETS.MARKET.scale,
      beatBars: 2,
      activePhrase: 'A',
      beatPhraseLoop: 'AB',
      isPlaying: false,
      drawerOpen: false,
      sharedCardTransition: null,
      onboarding: {
        dismissed: false,
        pulledCard: false,
        sentToBeat: false,
        editedOrPlayedBeat: false,
        watchedPinballShow: false,
        mintedFirstCard: false,
      },
      dbHydrated: false,
      migrationReport: null,

      collection: [...STARTER_CARD_IDS],
      pullHistory: ['card-05', 'card-01', 'card-09', 'card-13'],
      pullCounts: { 'card-01': 1, 'card-05': 1, 'card-09': 1, 'card-13': 1 },
      totalPulls: 4,
      pityCount: 4,
      selectedGachaCardId: 'card-05',
      needsScratch: false,

      tracks: cloneTracks(BEAT_PRESETS.MARKET.tracks, 2),
      liveFx: { ...BEAT_PRESETS.MARKET.liveFx },
      liveFxMode: 'latch',
      beatUndoStack: [],
      beatRedoStack: [],
      beatBounceMode: true,
      beatStageMode: false,
      beatRemixOrigin: null,
      pinballQuantizePreview: null,

      pinballMode: 'free',
      pinballShowSnapshot: DEMO_BEAT_SNAPSHOT,
      pinballToys: PINBALL_PRESETS.LOOP.map((t) => ({ ...t })),
      pinballUndoStack: [],
      pinballRedoStack: [],
      pinballTool: 'block',
      pinballBindCardId: 'card-09',
      pinballDropperX: 400,
      pinballAutoDrop: true,
      pinballGravity: 1.0,
      pinballDropRate: 0.55,
      pinballBounce: 0.95,
      pinballRecordedEvents: [],
      pinballRemixOrigin: null,

      forgeDraft: {
        ...INITIAL_FORGE_DRAFT,
        stickers: INITIAL_FORGE_DRAFT.stickers.map((s) => ({ ...s })),
      },
      inspectMintedId: null,
      lastMintedCardId: null,
      lastStorageError: null,
      mintedCards: [INITIAL_DEMO_CARD],
      nextMintSerial: 1,
      mintInFlight: false,
      stickerUndoStack: [],
      stickerRedoStack: [],

      toasts: [],

      hydrateFromIndexedDb: async () => {
        if (get().dbHydrated) return;
        const backedUp = holoDb.backupLegacyLocalStorage();
        const [savedCards, savedDraft] = await Promise.all([
          holoDb.loadMintedCards(),
          holoDb.loadForgeDraft(),
        ]);

        // Also normalize persisted localStorage tracks from legacy 16-step to 32-step
        const currentTracks = cloneTracks(get().tracks, get().beatBars);
        const patch: Partial<HoloState> = {
          dbHydrated: true,
          tracks: currentTracks,
        };

        if (savedCards && savedCards.length > 0) {
          const { cards, report } = migrateMintedCardsCollection(savedCards, backedUp);
          if (cards.length > 0) {
            patch.mintedCards = cards;
            patch.nextMintSerial = Math.max(get().nextMintSerial, report.maxSerial + 1);
            patch.migrationReport = report;
            if (report.migrated) {
              void holoDb.saveMintedCards(cards);
            }
          }
        }
        if (savedDraft) {
          const migratedDraft = migrateForgeDraft(savedDraft);
          if (migratedDraft) {
            patch.forgeDraft = migratedDraft;
          }
        }
        set(patch);
      },

      setActivePage: (page) => {
        if (get().liveFxMode === 'momentary') {
          set({ activePage: page, liveFx: { bitcrush: false, echo: false, stutter: false } });
        } else {
          set({ activePage: page });
        }
      },
      setAudioUnlocked: (audioUnlocked) => set({ audioUnlocked }),
      setDrawerOpen: (open) => set({ drawerOpen: open }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setBpm: (bpm) => set({ bpm: Math.min(180, Math.max(60, Math.round(bpm))) }),
      setSwing: (swing) => set({ swing: Math.min(0.6, Math.max(0, swing)) }),
      setBeatBars: (bars) =>
        set((s) => {
          const nextBars: 1 | 2 = bars === 1 ? 1 : 2;
          return {
            beatBars: nextBars,
            activePhrase: nextBars === 1 ? 'A' : s.activePhrase,
            beatPhraseLoop: nextBars === 1 ? 'A' : 'AB',
          };
        }),
      setActivePhrase: (activePhrase) => set({ activePhrase }),
      setBeatPhraseLoop: (beatPhraseLoop) => set({ beatPhraseLoop }),

      copyPhraseAToB: () => {
        get().pushBeatUndo();
        set((s) => ({
          beatBars: 2,
          activePhrase: 'B',
          tracks: cloneTracks(s.tracks, 2).map((t) => {
            const steps = [...t.steps];
            const accents = [...(t.accents ?? Array<boolean>(32).fill(false))];
            const cells = (t.stepCells ?? []).map((c) => ({ ...c }));
            for (let i = 0; i < 16; i++) {
              steps[16 + i] = steps[i];
              accents[16 + i] = accents[i];
              cells[16 + i] = { ...(cells[i] ?? makeDefaultStepCell(steps[i], 16 + i, accents[i])) };
            }
            return { ...t, steps, accents, stepCells: cells };
          }),
        }));
        get().pushToast({ text: '已复制 A 段到 B 段，现在可独立改编 B 段回应乐句', accent: '#00D4AA' });
      },

      copyPhraseBToA: () => {
        get().pushBeatUndo();
        set((s) => ({
          activePhrase: 'A',
          tracks: cloneTracks(s.tracks, 2).map((t) => {
            const steps = [...t.steps];
            const accents = [...(t.accents ?? Array<boolean>(32).fill(false))];
            const cells = (t.stepCells ?? []).map((c) => ({ ...c }));
            for (let i = 0; i < 16; i++) {
              steps[i] = steps[16 + i];
              accents[i] = accents[16 + i];
              cells[i] = { ...(cells[16 + i] ?? makeDefaultStepCell(steps[16 + i], i, accents[16 + i])) };
            }
            return { ...t, steps, accents, stepCells: cells };
          }),
        }));
        get().pushToast({ text: '已将 B 段乐句同步回 A 段', accent: '#00D4AA' });
      },

      cycleScale: () =>
        set((s) => {
          const order: ScaleId[] = ['PENTA_C', 'MINOR_C', 'DORIAN_C'];
          const next = order[(order.indexOf(s.scale) + 1) % order.length];
          return { scale: next };
        }),
      setScale: (scale) => set({ scale }),
      setIsPlaying: (isPlaying) =>
        set((s) => ({
          isPlaying,
          onboarding: isPlaying ? { ...s.onboarding, editedOrPlayedBeat: true } : s.onboarding,
        })),
      dismissOnboarding: () =>
        set((s) => ({ onboarding: { ...s.onboarding, dismissed: true } })),

      triggerSharedTransition: (cardId, targetPage, targetTrackIndex, sourceRect) => {
        const reduced =
          get().reducedMotion ||
          (typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

        if (reduced) {
          set({ activePage: targetPage, sharedCardTransition: null });
          return;
        }

        set({
          sharedCardTransition: {
            cardId,
            targetPage,
            targetTrackIndex,
            sourceRect,
            startedAt: Date.now(),
          },
        });
        window.setTimeout(() => {
          set({ activePage: targetPage });
        }, 210);
        window.setTimeout(() => {
          set({ sharedCardTransition: null });
        }, 560);
      },

      pullGachaCard: (skipScratch = false) => {
        const state = get();
        const nextPullNum = state.totalPulls + 1;
        const nextPity = state.pityCount + 1;
        let hitPity = false;

        let candidatePool: SoundCardDef[] = SOUND_CARDS;
        const unowned = SOUND_CARDS.filter((c) => !state.collection.includes(c.id));

        if (nextPity >= 5) {
          hitPity = true;
          const highUnowned = unowned.filter((c) => c.rarity === 'SSR' || c.rarity === 'UR');
          candidatePool =
            highUnowned.length > 0
              ? highUnowned
              : SOUND_CARDS.filter((c) => c.rarity === 'SSR' || c.rarity === 'UR');
        } else if (nextPullNum % 3 === 0) {
          const srPlusUnowned = unowned.filter((c) => ['SR', 'SSR', 'UR'].includes(c.rarity));
          candidatePool =
            srPlusUnowned.length > 0
              ? srPlusUnowned
              : SOUND_CARDS.filter((c) => ['SR', 'SSR', 'UR'].includes(c.rarity));
        } else if (unowned.length > 0 && Math.random() < 0.78) {
          candidatePool = unowned;
        }

        const totalWeight = candidatePool.reduce(
          (acc, c) => acc + Math.max(5, RARITY_META[c.rarity].weight),
          0
        );
        let roll = Math.random() * totalWeight;
        let chosen = candidatePool[candidatePool.length - 1];
        for (const card of candidatePool) {
          roll -= Math.max(5, RARITY_META[card.rarity].weight);
          if (roll <= 0) {
            chosen = card;
            break;
          }
        }

        const isNew = !state.collection.includes(chosen.id);
        const isHigh = chosen.rarity === 'SSR' || chosen.rarity === 'UR';
        const updatedCollection = isNew ? [...state.collection, chosen.id] : state.collection;
        const updatedHistory = [
          chosen.id,
          ...state.pullHistory.filter((id) => id !== chosen.id),
        ].slice(0, 16);

        set({
          collection: updatedCollection,
          pullHistory: updatedHistory,
          pullCounts: {
            ...state.pullCounts,
            [chosen.id]: (state.pullCounts[chosen.id] ?? 0) + 1,
          },
          totalPulls: nextPullNum,
          pityCount: isHigh ? 0 : Math.min(4, nextPity),
          selectedGachaCardId: chosen.id,
          needsScratch: !skipScratch,
          onboarding: { ...state.onboarding, pulledCard: true },
        });

        return { card: chosen, isNew, hitPity };
      },

      revealCurrentCard: () => set({ needsScratch: false }),

      selectGachaCard: (cardId) =>
        set({
          selectedGachaCardId: cardId,
          needsScratch: false,
        }),

      loadSoundscape: (soundscapeId) => {
        const scene = CURATED_SOUNDSCAPES.find((sc) => sc.id === soundscapeId);
        if (!scene) return;
        const preset = BEAT_PRESETS[scene.beatPreset];
        const s = get();
        const mergedCollection = Array.from(new Set([...s.collection, ...scene.cardIds]));
        const nextPullCounts = { ...s.pullCounts };
        scene.cardIds.forEach((cid) => {
          nextPullCounts[cid] = Math.max(1, nextPullCounts[cid] ?? 0);
        });

        get().pushBeatUndo();
        set({
          collection: mergedCollection,
          pullCounts: nextPullCounts,
          selectedGachaCardId: scene.cardIds[0],
          needsScratch: false,
          bpm: scene.bpm,
          swing: preset.swing,
          scale: scene.scale,
          beatBars: preset.bars,
          activePhrase: 'A',
          beatPhraseLoop: preset.bars === 2 ? 'AB' : 'A',
          liveFx: { ...preset.liveFx },
          tracks: cloneTracks(preset.tracks, preset.bars).map((t, idx) => ({
            ...t,
            cardId: scene.cardIds[idx] ?? t.cardId,
          })),
          activePage: 'beat',
          onboarding: { ...s.onboarding, pulledCard: true, sentToBeat: true },
        });
        get().pushToast({
          text: `已进入策展声景「${scene.title}」：装入 4 张主题声卡与 A/B 示范乐句`,
          accent: scene.accentColor,
        });
      },

      sendCardToBeat: (cardId, targetTrackIdx, navigate = true, sourceRect) => {
        const card = getCardById(cardId);
        const categoryOrder: TrackCategory[] = ['BEAT', 'PERC', 'MELODY', 'VIBE'];
        const trackIdx =
          targetTrackIdx !== undefined && targetTrackIdx >= 0 && targetTrackIdx < 4
            ? targetTrackIdx
            : categoryOrder.indexOf(card.category);

        get().pushBeatUndo();
        set((s) => ({
          tracks: cloneTracks(s.tracks, s.beatBars).map((t, idx) =>
            idx === trackIdx ? { ...t, cardId: card.id } : t
          ),
          onboarding: { ...s.onboarding, sentToBeat: true },
        }));

        if (navigate) {
          get().triggerSharedTransition(card.id, 'beat', trackIdx, sourceRect);
        }

        get().pushToast({
          text: `已将 ${card.code}「${card.zhTitle}」装入「${CATEGORY_META[categoryOrder[trackIdx]].zhLabel}」轨道（原有节奏完整保留）`,
          accent: card.accentColor,
          actionLabel: navigate ? undefined : '前往编曲台 →',
          actionPage: navigate ? undefined : 'beat',
        });
      },

      sendCardToPinball: (cardId, navigate = true, sourceRect) => {
        const card = getCardById(cardId);
        set({
          pinballBindCardId: card.id,
          pinballMode: 'free',
        });
        if (navigate) {
          get().triggerSharedTransition(card.id, 'pinball', undefined, sourceRect);
        }
        get().pushToast({
          text: `已将 ${card.code}「${card.zhTitle}」绑定至弹珠剧场音色槽`,
          accent: '#00D4AA',
        });
      },

      pushBeatUndo: () =>
        set((s) => ({
          beatUndoStack: [
            ...s.beatUndoStack.slice(-19),
            {
              bpm: s.bpm,
              swing: s.swing,
              scale: s.scale,
              bars: s.beatBars,
              activePhrase: s.activePhrase,
              beatPhraseLoop: s.beatPhraseLoop,
              liveFx: { ...s.liveFx },
              tracks: cloneTracks(s.tracks, s.beatBars),
            },
          ],
          beatRedoStack: [],
        })),

      undoBeat: () =>
        set((s) => {
          const prev = s.beatUndoStack[s.beatUndoStack.length - 1];
          if (!prev) return s;
          const current: BeatHistoryEntry = {
            bpm: s.bpm,
            swing: s.swing,
            scale: s.scale,
            bars: s.beatBars,
            activePhrase: s.activePhrase,
            beatPhraseLoop: s.beatPhraseLoop,
            liveFx: { ...s.liveFx },
            tracks: cloneTracks(s.tracks, s.beatBars),
          };
          return {
            bpm: prev.bpm,
            swing: prev.swing,
            scale: prev.scale,
            beatBars: prev.bars,
            activePhrase: prev.activePhrase,
            beatPhraseLoop: prev.beatPhraseLoop,
            liveFx: { ...prev.liveFx },
            tracks: cloneTracks(prev.tracks, prev.bars),
            beatUndoStack: s.beatUndoStack.slice(0, -1),
            beatRedoStack: [...s.beatRedoStack.slice(-19), current],
          };
        }),

      redoBeat: () =>
        set((s) => {
          const next = s.beatRedoStack[s.beatRedoStack.length - 1];
          if (!next) return s;
          const current: BeatHistoryEntry = {
            bpm: s.bpm,
            swing: s.swing,
            scale: s.scale,
            bars: s.beatBars,
            activePhrase: s.activePhrase,
            beatPhraseLoop: s.beatPhraseLoop,
            liveFx: { ...s.liveFx },
            tracks: cloneTracks(s.tracks, s.beatBars),
          };
          return {
            bpm: next.bpm,
            swing: next.swing,
            scale: next.scale,
            beatBars: next.bars,
            activePhrase: next.activePhrase,
            beatPhraseLoop: next.beatPhraseLoop,
            liveFx: { ...next.liveFx },
            tracks: cloneTracks(next.tracks, next.bars),
            beatRedoStack: s.beatRedoStack.slice(0, -1),
            beatUndoStack: [...s.beatUndoStack.slice(-19), current],
          };
        }),

      toggleStep: (trackIndex, stepIndex, forceValue) =>
        set((s) => ({
          tracks: cloneTracks(s.tracks, s.beatBars).map((t, idx) => {
            if (idx !== trackIndex) return t;
            const steps = [...t.steps];
            const cells = (t.stepCells ?? []).map((c) => ({ ...c }));
            const nextVal = forceValue !== undefined ? forceValue : !steps[stepIndex];
            steps[stepIndex] = nextVal;
            if (cells[stepIndex]) {
              cells[stepIndex] = { ...cells[stepIndex], on: nextVal };
            }
            return { ...t, steps, stepCells: cells };
          }),
          onboarding: { ...s.onboarding, editedOrPlayedBeat: true },
        })),

      toggleStepAccent: (trackIndex, stepIndex) =>
        set((s) => ({
          tracks: cloneTracks(s.tracks, s.beatBars).map((t, idx) => {
            if (idx !== trackIndex) return t;
            const steps = [...t.steps];
            const accents = t.accents ? [...t.accents] : Array<boolean>(32).fill(false);
            const cells = (t.stepCells ?? []).map((c) => ({ ...c }));
            if (!steps[stepIndex]) steps[stepIndex] = true;
            accents[stepIndex] = !accents[stepIndex];
            if (cells[stepIndex]) {
              cells[stepIndex] = {
                ...cells[stepIndex],
                on: true,
                velocity: accents[stepIndex] ? 0.98 : 0.78,
              };
            }
            return { ...t, steps, accents, stepCells: cells };
          }),
        })),

      updateStepCell: (trackIndex, stepIndex, patch) =>
        set((s) => ({
          tracks: cloneTracks(s.tracks, s.beatBars).map((t, idx) => {
            if (idx !== trackIndex) return t;
            const steps = [...t.steps];
            const accents = t.accents ? [...t.accents] : Array<boolean>(32).fill(false);
            const cells = (t.stepCells ?? []).map((c) => ({ ...c }));
            const prev = cells[stepIndex] ?? makeDefaultStepCell(steps[stepIndex], stepIndex);
            const nextCell: StepCell = {
              ...prev,
              ...patch,
              velocity: Math.min(1, Math.max(0.35, patch.velocity ?? prev.velocity)),
              pitchOffset: Math.max(-4, Math.min(4, Math.round(patch.pitchOffset ?? prev.pitchOffset))),
              lengthSteps:
                patch.lengthSteps === 4 ? 4 : patch.lengthSteps === 2 ? 2 : patch.lengthSteps === 1 ? 1 : prev.lengthSteps,
            };
            steps[stepIndex] = nextCell.on;
            accents[stepIndex] = nextCell.on && nextCell.velocity >= 0.94;
            cells[stepIndex] = nextCell;
            return { ...t, steps, accents, stepCells: cells };
          }),
        })),

      setTrackCard: (trackIndex, cardId) => {
        get().pushBeatUndo();
        set((s) => ({
          tracks: cloneTracks(s.tracks, s.beatBars).map((t, idx) =>
            idx === trackIndex ? { ...t, cardId } : t
          ),
        }));
      },

      setTrackVolume: (trackIndex, volume) =>
        set((s) => ({
          tracks: s.tracks.map((t, idx) =>
            idx === trackIndex ? { ...t, volume: Math.min(1, Math.max(0, volume)) } : t
          ),
        })),

      setTrackTone: (trackIndex, tone) =>
        set((s) => ({
          tracks: s.tracks.map((t, idx) =>
            idx === trackIndex ? { ...t, tone: Math.min(1, Math.max(0, tone)) } : t
          ),
        })),

      toggleTrackMute: (trackIndex) =>
        set((s) => ({
          tracks: s.tracks.map((t, idx) => (idx === trackIndex ? { ...t, mute: !t.mute } : t)),
        })),

      toggleTrackSolo: (trackIndex) =>
        set((s) => ({
          tracks: s.tracks.map((t, idx) => (idx === trackIndex ? { ...t, solo: !t.solo } : t)),
        })),

      applyBeatPreset: (preset) => {
        const p = BEAT_PRESETS[preset];
        const unlocked = get().collection;
        get().pushBeatUndo();
        set((s) => ({
          bpm: p.bpm,
          swing: p.swing,
          scale: p.scale,
          beatBars: p.bars,
          activePhrase: 'A',
          beatPhraseLoop: p.bars === 2 ? 'AB' : 'A',
          liveFx: { ...p.liveFx },
          tracks: cloneTracks(p.tracks, p.bars).map((t, idx) => {
            const currentId = s.tracks[idx]?.cardId;
            const useId = currentId && unlocked.includes(currentId) ? currentId : t.cardId;
            return { ...t, cardId: useId };
          }),
        }));
      },

      applyBeatVariation: (kind) => {
        const s = get();
        get().pushBeatUndo();
        const nextBars: 1 | 2 = kind === 'call_response' ? 2 : s.beatBars;
        const nextTracks = applyMusicalVariationToTracks(s.tracks, kind, s.activePhrase, nextBars);
        set({
          beatBars: nextBars,
          activePhrase: kind === 'call_response' ? 'B' : s.activePhrase,
          beatPhraseLoop: kind === 'call_response' ? 'AB' : s.beatPhraseLoop,
          tracks: nextTracks,
        });
        const labelMap: Record<VariationKind, string> = {
          density_up: '加密律动（增加反拍切分 · 支持 Ctrl+Z 撤销对比）',
          density_down: '精简节奏（保留正拍重心 · 支持 Ctrl+Z 撤销对比）',
          accent_groove: '强化重拍（突出律动轻重对比）',
          breathing_space: '第 4 拍留白（为乐句制造呼吸感）',
          call_response: '生成 B 段问答回应乐句（已切换至 B 段预览）',
        };
        get().pushToast({ text: `♪ 变奏：${labelMap[kind]}`, accent: '#7C3AED' });
      },

      randomizeBeat: () => {
        get().pushBeatUndo();
        set((s) => {
          const offset = s.beatBars === 2 && s.activePhrase === 'B' ? 16 : 0;
          return {
            tracks: cloneTracks(s.tracks, s.beatBars).map((t, idx) => {
              const steps = [...t.steps];
              const accents = [...(t.accents ?? Array<boolean>(32).fill(false))];
              const cells = (t.stepCells ?? []).map((c) => ({ ...c }));

              for (let rel = 0; rel < 16; rel++) {
                const i = offset + rel;
                let on = false;
                let acc = false;
                if (idx === 0) {
                  on = rel === 0 || rel === 8 || Math.random() < (rel % 4 === 0 ? 0.45 : 0.18);
                  acc = rel === 0;
                } else if (idx === 1) {
                  on = rel === 4 || rel === 12 || Math.random() < (rel % 2 === 1 ? 0.24 : 0.12);
                  acc = rel === 4 || rel === 12;
                } else if (idx === 2) {
                  // Controlled musical density (max ~6 notes per bar, breathing space near beat 4)
                  on = rel < 14 && Math.random() < (rel % 2 === 0 ? 0.38 : 0.18);
                  acc = on && rel === 0;
                } else {
                  on = rel === 0 || (rel === 8 && Math.random() < 0.72);
                  acc = rel === 0;
                }
                steps[i] = on;
                accents[i] = acc;
                cells[i] = makeDefaultStepCell(on, i, acc, idx === 2 ? Math.floor(Math.random() * 3) - 1 : 0, 1);
              }
              return { ...t, steps, accents, stepCells: cells };
            }),
          };
        });
      },

      clearBeat: () => {
        get().pushBeatUndo();
        set((s) => ({
          tracks: cloneTracks(s.tracks, s.beatBars).map((t) => ({
            ...t,
            steps: Array<boolean>(32).fill(false),
            accents: Array<boolean>(32).fill(false),
            stepCells: Array.from({ length: 32 }, (_, i) => makeDefaultStepCell(false, i)),
          })),
        }));
      },

      setLiveFx: (fx, active) =>
        set((s) => ({
          liveFx: { ...s.liveFx, [fx]: active },
        })),

      setLiveFxMode: (liveFxMode) =>
        set((s) => ({
          liveFxMode,
          liveFx: liveFxMode === 'momentary' ? { bitcrush: false, echo: false, stutter: false } : s.liveFx,
        })),

      resetMomentaryFx: () =>
        set((s) =>
          s.liveFxMode === 'momentary'
            ? { liveFx: { bitcrush: false, echo: false, stutter: false } }
            : s
        ),

      setBeatBounceMode: (beatBounceMode) => set({ beatBounceMode }),
      setBeatStageMode: (beatStageMode) => set({ beatStageMode }),

      sendBeatToForge: () => {
        const s = get();
        const frozen = createBeatCompositionSnapshot(
          {
            bpm: s.bpm,
            swing: s.swing,
            scale: s.scale,
            bars: s.beatBars,
            activePhraseLoop: s.beatPhraseLoop,
            liveFx: { ...s.liveFx },
            tracks: cloneTracks(s.tracks, s.beatBars),
          },
          { title: s.forgeDraft.title || '胡同放克' }
        );

        const nextDraft: ForgeDraft = {
          ...s.forgeDraft,
          snapshot: frozen,
          sourceType: 'beat',
          remixOrigin: s.beatRemixOrigin,
          title: s.beatRemixOrigin
            ? `${s.beatRemixOrigin.parentTitle.slice(0, 12)} 变奏${s.beatRemixOrigin.lineageDepth}`
            : s.forgeDraft.title || '胡同放克',
        };

        void holoDb.saveForgeDraft(nextDraft);

        set({
          forgeDraft: nextDraft,
          inspectMintedId: null,
          activePage: 'forge',
        });

        get().pushToast({
          text: `已冻结当前节拍作品（${frozen.bars} 小节 · ${(frozen.durationMs / 1000).toFixed(1)}s · ${frozen.events.length} 音符），后续编辑不会改变此快照`,
          accent: '#FFD60A',
        });

        return frozen;
      },

      performBeatInPinball: () => {
        const s = get();
        const frozen = createBeatCompositionSnapshot(
          {
            bpm: s.bpm,
            swing: s.swing,
            scale: s.scale,
            bars: s.beatBars,
            activePhraseLoop: s.beatPhraseLoop,
            liveFx: { ...s.liveFx },
            tracks: cloneTracks(s.tracks, s.beatBars),
          },
          { title: s.forgeDraft.title || '胡同放克' }
        );

        set({
          pinballShowSnapshot: frozen,
          pinballMode: 'show',
          activePage: 'pinball',
          onboarding: { ...s.onboarding, watchedPinballShow: true },
        });

        get().pushToast({
          text: `已冻结 ${frozen.events.length} 个音符事件（${(frozen.durationMs / 1000).toFixed(1)}s）送入弹珠剧场演出`,
          accent: '#00D4AA',
        });

        return frozen;
      },

      updatePinballQuantizeOptions: (opts) => {
        const s = get();
        const prev = s.pinballQuantizePreview;
        if (!prev) return;
        const nextPreview = quantizePinballToBeatPreview(prev.sourceEvents, prev.bpm, {
          startMs: opts.startMs ?? prev.selectedStartMs,
          endMs: opts.endMs ?? prev.selectedEndMs,
          targetBars: opts.targetBars ?? prev.targetBars,
        });
        set({ pinballQuantizePreview: nextPreview });
      },

      applyPinballQuantize: (mode) => {
        const s = get();
        const preview = s.pinballQuantizePreview;
        if (!preview || mode === 'cancel') {
          set({ pinballQuantizePreview: null });
          return;
        }
        get().pushBeatUndo();
        const targetBars = preview.targetBars;
        set((curr) => ({
          beatBars: targetBars,
          activePhrase: 'A',
          beatPhraseLoop: targetBars === 2 ? 'AB' : 'A',
          tracks: cloneTracks(curr.tracks, targetBars).map((track, tIdx) => {
            const ghostRow = preview.ghostSteps[tIdx] ?? Array<boolean>(32).fill(false);
            const steps =
              mode === 'replace'
                ? [...ghostRow]
                : track.steps.map((v, i) => v || ghostRow[i]);
            const cells = steps.map((on, i) =>
              track.stepCells?.[i]
                ? { ...track.stepCells[i], on }
                : makeDefaultStepCell(on, i)
            );
            const suggestedCard = preview.trackCardIds[tIdx];
            return {
              ...track,
              cardId:
                suggestedCard && curr.collection.includes(suggestedCard)
                  ? suggestedCard
                  : track.cardId,
              steps,
              stepCells: cells,
            };
          }),
          pinballQuantizePreview: null,
        }));
        get().pushToast({
          text:
            mode === 'replace'
              ? `已替换为 ${targetBars} 小节量化轨（原弹珠录音仍保留在弹珠剧场）`
              : `已合并 ${preview.mappedCount} 步量化音符至当前节拍轨`,
          accent: '#00D4AA',
        });
      },

      setPinballMode: (pinballMode) =>
        set((s) => ({
          pinballMode,
          onboarding:
            pinballMode === 'show' ? { ...s.onboarding, watchedPinballShow: true } : s.onboarding,
        })),
      setPinballTool: (pinballTool) => set({ pinballTool }),
      setPinballBindCardId: (pinballBindCardId) => set({ pinballBindCardId }),
      setPinballDropperX: (x) => set({ pinballDropperX: Math.min(730, Math.max(70, x)) }),
      setPinballAutoDrop: (pinballAutoDrop) => set({ pinballAutoDrop }),
      setPinballGravity: (g) => set({ pinballGravity: Math.min(2.2, Math.max(0.25, g)) }),
      setPinballDropRate: (r) => set({ pinballDropRate: Math.min(1, Math.max(0.1, r)) }),
      setPinballBounce: (b) => set({ pinballBounce: Math.min(1.35, Math.max(0.5, b)) }),

      undoPinball: () =>
        set((s) => {
          const prev = s.pinballUndoStack[s.pinballUndoStack.length - 1];
          if (!prev) return s;
          return {
            pinballToys: prev.map((t) => ({ ...t })),
            pinballUndoStack: s.pinballUndoStack.slice(0, -1),
            pinballRedoStack: [...s.pinballRedoStack.slice(-19), s.pinballToys.map((t) => ({ ...t }))],
          };
        }),

      redoPinball: () =>
        set((s) => {
          const next = s.pinballRedoStack[s.pinballRedoStack.length - 1];
          if (!next) return s;
          return {
            pinballToys: next.map((t) => ({ ...t })),
            pinballRedoStack: s.pinballRedoStack.slice(0, -1),
            pinballUndoStack: [...s.pinballUndoStack.slice(-19), s.pinballToys.map((t) => ({ ...t }))],
          };
        }),

      addPinballToy: (toy) => {
        const id = createStableId('toy');
        set((s) => ({
          pinballUndoStack: [...s.pinballUndoStack.slice(-19), s.pinballToys.map((t) => ({ ...t }))],
          pinballRedoStack: [],
          pinballToys: [...s.pinballToys, { ...toy, id }],
        }));
        return id;
      },

      updatePinballToy: (id, patch, recordUndo = false) =>
        set((s) => ({
          pinballUndoStack: recordUndo
            ? [...s.pinballUndoStack.slice(-19), s.pinballToys.map((t) => ({ ...t }))].slice(-20)
            : s.pinballUndoStack,
          pinballRedoStack: recordUndo ? [] : s.pinballRedoStack,
          pinballToys: s.pinballToys.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      removePinballToy: (id) =>
        set((s) => ({
          pinballUndoStack: [...s.pinballUndoStack.slice(-19), s.pinballToys.map((t) => ({ ...t }))],
          pinballRedoStack: [],
          pinballToys: s.pinballToys.filter((t) => t.id !== id),
        })),

      applyPinballPreset: (preset) => {
        set((s) => {
          const undo = [...s.pinballUndoStack.slice(-19), s.pinballToys.map((t) => ({ ...t }))];
          if (preset === 'CLEAR') {
            return { pinballUndoStack: undo, pinballRedoStack: [], pinballToys: [] };
          }
          const scaleNotes = SCALE_META[s.scale].shortNotes;
          return {
            pinballUndoStack: undo,
            pinballRedoStack: [],
            pinballToys: PINBALL_PRESETS[preset].map((t, i) => ({
              ...t,
              id: createStableId(preset.toLowerCase()),
              note: scaleNotes[i % scaleNotes.length],
            })),
          };
        });
      },

      setPinballRecordedEvents: (events) => set({ pinballRecordedEvents: events }),

      sendPinballToForge: (events) => {
        const s = get();
        const validEvents = events.length > 0 ? events : s.pinballRecordedEvents;
        if (validEvents.length === 0) {
          get().pushToast({
            text: '尚未录制到有效碰撞音符！请先投掷弹珠撞击机关后再捕获作品。',
            accent: '#FF5C2B',
          });
          return false;
        }

        const frozen = createPinballCompositionSnapshot(
          validEvents,
          {
            toys: s.pinballToys.map((t) => ({ ...t })),
            dropperX: s.pinballDropperX,
            gravity: s.pinballGravity,
            dropRate: s.pinballDropRate,
            bounce: s.pinballBounce,
            scale: s.scale,
          },
          s.bpm,
          { title: '弹珠回响' }
        );

        const nextDraft: ForgeDraft = {
          ...s.forgeDraft,
          snapshot: frozen,
          sourceType: 'pinball',
          title: s.pinballRemixOrigin
            ? `${s.pinballRemixOrigin.parentTitle.slice(0, 12)} 变奏${s.pinballRemixOrigin.lineageDepth}`
            : '弹珠回响',
          remixOrigin: s.pinballRemixOrigin,
        };

        void holoDb.saveForgeDraft(nextDraft);

        set({
          pinballRecordedEvents: validEvents.map((e) => ({ ...e })),
          forgeDraft: nextDraft,
          inspectMintedId: null,
          activePage: 'forge',
        });

        get().pushToast({
          text: `已冻结 ${validEvents.length} 个真实弹珠碰撞音符与场景快照，直送闪卡铸造屋！`,
          accent: '#00D4AA',
        });
        return true;
      },

      /**
       * FIX #3: Strictly sends the exact frozen Choreographed Show snapshot (the one user
       * actually watched and heard on stage!) into Forge Draft — NEVER re-reads mutable Beat editor!
       */
      sendPinballShowToForge: () => {
        const s = get();
        const showSnap = s.pinballShowSnapshot;
        if (!showSnap || showSnap.events.length === 0) {
          get().pushToast({
            text: '当前剧场暂无可铸造的演出快照，请先从 02 插卡编曲送入演出',
            accent: '#FF5C2B',
          });
          return null;
        }

        const frozenCopy: CompositionSnapshot = {
          ...showSnap,
          events: showSnap.events.map((e) => ({ ...e })),
          beatSnapshot: showSnap.beatSnapshot
            ? {
                ...showSnap.beatSnapshot,
                liveFx: { ...showSnap.beatSnapshot.liveFx },
                tracks: cloneTracks(showSnap.beatSnapshot.tracks, showSnap.beatSnapshot.bars),
              }
            : undefined,
        };

        const nextDraft: ForgeDraft = {
          ...s.forgeDraft,
          snapshot: frozenCopy,
          sourceType: frozenCopy.sourceType,
          title: frozenCopy.title || s.forgeDraft.title || '胡同放克',
          remixOrigin: s.beatRemixOrigin,
        };

        void holoDb.saveForgeDraft(nextDraft);

        set({
          forgeDraft: nextDraft,
          inspectMintedId: null,
          activePage: 'forge',
        });

        get().pushToast({
          text: `已锁定当前剧场演出版本（${frozenCopy.events.length} 音符 · ${(frozenCopy.durationMs / 1000).toFixed(1)}s）直送闪卡铸造！`,
          accent: '#FFD60A',
        });

        return frozenCopy;
      },

      sendPinballToBeatQuantize: (events) => {
        const s = get();
        const validEvents = events.length > 0 ? events : s.pinballRecordedEvents;
        if (validEvents.length === 0) {
          get().pushToast({
            text: '尚未录制到有效弹珠碰撞音符，无法量化转换至节拍台。',
            accent: '#FF5C2B',
          });
          return false;
        }
        const preview = quantizePinballToBeatPreview(validEvents, s.bpm, {
          targetBars: s.beatBars,
        });
        set({
          pinballRecordedEvents: validEvents.map((e) => ({ ...e })),
          pinballQuantizePreview: preview,
          activePage: 'beat',
        });
        get().pushToast({
          text: `已生成量化预览：${preview.selectedSourceEvents} 个原音符 → ${preview.mappedCount} 步（合并 ${preview.mergedCollisions} 处重叠）`,
          accent: '#00D4AA',
        });
        return true;
      },

      setForgeSource: (sourceType) => {
        const s = get();
        if (sourceType === 'pinball') {
          if (s.pinballRecordedEvents.length === 0 && s.forgeDraft.snapshot?.sourceType !== 'pinball') {
            get().pushToast({
              text: '当前暂无已录制的弹珠作品，请先前往 03 弹珠剧场录制真实碰撞音符',
              accent: '#FF5C2B',
              actionLabel: '去弹珠剧场 →',
              actionPage: 'pinball',
            });
            return;
          }
          const snap =
            s.pinballRecordedEvents.length > 0
              ? createPinballCompositionSnapshot(
                  s.pinballRecordedEvents,
                  {
                    toys: s.pinballToys.map((t) => ({ ...t })),
                    dropperX: s.pinballDropperX,
                    gravity: s.pinballGravity,
                    dropRate: s.pinballDropRate,
                    bounce: s.pinballBounce,
                    scale: s.scale,
                  },
                  s.bpm
                )
              : s.forgeDraft.snapshot;
          const nextDraft: ForgeDraft = { ...s.forgeDraft, sourceType: 'pinball', snapshot: snap };
          void holoDb.saveForgeDraft(nextDraft);
          set({ forgeDraft: nextDraft, inspectMintedId: null });
          return;
        }

        const snap = createBeatCompositionSnapshot({
          bpm: s.bpm,
          swing: s.swing,
          scale: s.scale,
          bars: s.beatBars,
          activePhraseLoop: s.beatPhraseLoop,
          liveFx: { ...s.liveFx },
          tracks: cloneTracks(s.tracks, s.beatBars),
        });
        const nextDraft: ForgeDraft = { ...s.forgeDraft, sourceType: 'beat', snapshot: snap };
        void holoDb.saveForgeDraft(nextDraft);
        set({ forgeDraft: nextDraft, inspectMintedId: null });
      },

      setForgeTitle: (title) =>
        set((s) => {
          const forgeDraft = { ...s.forgeDraft, title: title.slice(0, 18) };
          void holoDb.saveForgeDraft(forgeDraft);
          return { forgeDraft, inspectMintedId: null };
        }),

      setForgeRarity: (rarity) =>
        set((s) => {
          const forgeDraft = { ...s.forgeDraft, rarity };
          void holoDb.saveForgeDraft(forgeDraft);
          return { forgeDraft, inspectMintedId: null };
        }),

      setForgeFoil: (foil) =>
        set((s) => {
          const forgeDraft = { ...s.forgeDraft, foil };
          void holoDb.saveForgeDraft(forgeDraft);
          return { forgeDraft, inspectMintedId: null };
        }),

      setForgeArtId: (artId) =>
        set((s) => {
          const forgeDraft = { ...s.forgeDraft, artId };
          void holoDb.saveForgeDraft(forgeDraft);
          return { forgeDraft, inspectMintedId: null };
        }),

      addForgeSticker: (stickerId) =>
        set((s) => {
          const prev = s.forgeDraft.stickers;
          const maxZ = prev.reduce((m, st) => Math.max(m, st.zIndex ?? 1), 1);
          // Frame-edge safe anchor slots so newly added stickers decorate margins without blocking the hero face!
          const safeAnchors = [
            { x: 18, y: 34, rot: -9 },
            { x: 82, y: 34, rot: 9 },
            { x: 18, y: 66, rot: -6 },
            { x: 82, y: 66, rot: 7 },
            { x: 24, y: 24, rot: -12 },
            { x: 76, y: 24, rot: 11 },
          ];
          const slot = safeAnchors[prev.length % safeAnchors.length];
          const nextSticker: PlacedSticker = {
            uid: createStableId('stk'),
            stickerId,
            x: slot.x,
            y: slot.y,
            scale: 1,
            rotation: slot.rot,
            zIndex: maxZ + 1,
          };
          const forgeDraft = { ...s.forgeDraft, stickers: [...prev, nextSticker] };
          void holoDb.saveForgeDraft(forgeDraft);
          return {
            forgeDraft,
            inspectMintedId: null,
            stickerUndoStack: [...s.stickerUndoStack.slice(-19), prev.map((x) => ({ ...x }))],
            stickerRedoStack: [],
          };
        }),

      updateForgeSticker: (uid, patch) =>
        set((s) => {
          const forgeDraft = {
            ...s.forgeDraft,
            stickers: s.forgeDraft.stickers.map((st) =>
              st.uid === uid ? { ...st, ...patch } : st
            ),
          };
          void holoDb.saveForgeDraft(forgeDraft);
          return { forgeDraft };
        }),

      bringStickerToFront: (uid) =>
        set((s) => {
          const maxZ = s.forgeDraft.stickers.reduce((m, st) => Math.max(m, st.zIndex ?? 1), 1);
          const forgeDraft = {
            ...s.forgeDraft,
            stickers: s.forgeDraft.stickers.map((st) =>
              st.uid === uid ? { ...st, zIndex: maxZ + 1 } : st
            ),
          };
          void holoDb.saveForgeDraft(forgeDraft);
          return { forgeDraft };
        }),

      removeForgeSticker: (uid) =>
        set((s) => {
          const prev = s.forgeDraft.stickers;
          const forgeDraft = {
            ...s.forgeDraft,
            stickers: prev.filter((st) => st.uid !== uid),
          };
          void holoDb.saveForgeDraft(forgeDraft);
          return {
            forgeDraft,
            stickerUndoStack: [...s.stickerUndoStack.slice(-19), prev.map((x) => ({ ...x }))],
            stickerRedoStack: [],
          };
        }),

      clearForgeStickers: () =>
        set((s) => {
          if (s.forgeDraft.stickers.length === 0) return s;
          const prev = s.forgeDraft.stickers;
          const forgeDraft = { ...s.forgeDraft, stickers: [] };
          void holoDb.saveForgeDraft(forgeDraft);
          return {
            forgeDraft,
            stickerUndoStack: [...s.stickerUndoStack.slice(-19), prev.map((x) => ({ ...x }))],
            stickerRedoStack: [],
          };
        }),

      undoForgeStickers: () =>
        set((s) => {
          const prev = s.stickerUndoStack[s.stickerUndoStack.length - 1];
          if (!prev) return s;
          const forgeDraft = { ...s.forgeDraft, stickers: prev.map((x) => ({ ...x })) };
          void holoDb.saveForgeDraft(forgeDraft);
          return {
            forgeDraft,
            stickerUndoStack: s.stickerUndoStack.slice(0, -1),
            stickerRedoStack: [
              ...s.stickerRedoStack.slice(-19),
              s.forgeDraft.stickers.map((x) => ({ ...x })),
            ],
          };
        }),

      redoForgeStickers: () =>
        set((s) => {
          const next = s.stickerRedoStack[s.stickerRedoStack.length - 1];
          if (!next) return s;
          const forgeDraft = { ...s.forgeDraft, stickers: next.map((x) => ({ ...x })) };
          void holoDb.saveForgeDraft(forgeDraft);
          return {
            forgeDraft,
            stickerRedoStack: s.stickerRedoStack.slice(0, -1),
            stickerUndoStack: [
              ...s.stickerUndoStack.slice(-19),
              s.forgeDraft.stickers.map((x) => ({ ...x })),
            ],
          };
        }),

      inspectMintedCard: (id) => set({ inspectMintedId: id }),

      returnToForgeDraft: () => set({ inspectMintedId: null }),

      loadGachaCardIntoForgeDraft: (cardId) => {
        const card = getCardById(cardId);
        set((s) => {
          const forgeDraft: ForgeDraft = {
            ...s.forgeDraft,
            title: card.zhTitle,
            rarity: card.rarity === 'UR' ? 'UR' : 'SSR',
            foil: card.foil,
            artId: card.artId,
          };
          void holoDb.saveForgeDraft(forgeDraft);
          return { forgeDraft, inspectMintedId: null };
        });
      },

      updateMintedCardWaveform: (cardId, bars, isRealPcm) => {
        set((s) => {
          const updated = s.mintedCards.map((m) =>
            m.id === cardId ? { ...m, waveformBars: bars, waveformIsRealPcm: isRealPcm } : m
          );
          void holoDb.saveMintedCards(updated);
          return { mintedCards: updated };
        });
      },

      /** Freeze an immutable MintRequest the exact instant user initiates Minting */
      createMintRequest: () => {
        const s = get();
        let snapshot = s.forgeDraft.snapshot;
        if (!snapshot) {
          snapshot = createBeatCompositionSnapshot({
            bpm: s.bpm,
            swing: s.swing,
            scale: s.scale,
            bars: s.beatBars,
            activePhraseLoop: s.beatPhraseLoop,
            liveFx: { ...s.liveFx },
            tracks: cloneTracks(s.tracks, s.beatBars),
          });
        }
        if (snapshot.events.length === 0) {
          get().pushToast({
            text: '当前草稿尚未包含任何有效音符，请先在编曲台点亮打击垫或录制弹珠声音！',
            accent: '#FF5C2B',
          });
          return null;
        }

        const title = s.forgeDraft.title.trim() || '胡同放克';
        const stickers = s.forgeDraft.stickers.map((st) => ({ ...st }));
        const contentHash = buildMintIdempotencyKey({
          snapshotId: snapshot.id,
          contentSignature: snapshot.contentSignature,
          title,
          rarity: s.forgeDraft.rarity,
          foil: s.forgeDraft.foil,
          artId: s.forgeDraft.artId,
          assetVersion: ASSET_VERSION,
          stickers,
        });

        return {
          requestId: createStableId('mint-req'),
          snapshot,
          title,
          rarity: s.forgeDraft.rarity,
          foil: s.forgeDraft.foil,
          artId: s.forgeDraft.artId,
          stickers,
          remixOrigin: s.forgeDraft.remixOrigin ? { ...s.forgeDraft.remixOrigin } : null,
          contentHash,
          assetVersion: ASSET_VERSION,
          createdAt: Date.now(),
        };
      },

      /**
       * FIX #1 & #2: Atomic Mint Transaction!
       * Consumes ONLY the frozen MintRequest; checks full-sticker contentHash;
       * strictly awaits StorageSaveResult and rolls back completely if save fails!
       */
      commitMintRequest: async (request, realWaveformBars) => {
        const s = get();
        if (s.mintInFlight) {
          return {
            card: null,
            duplicate: false,
            saveResult: { status: 'failed', storageLabel: '压印正在进行中' },
          };
        }

        const duplicate = s.mintedCards.find((m) => m.idempotencyKey === request.contentHash);
        if (duplicate) {
          set({ inspectMintedId: duplicate.id, lastMintedCardId: duplicate.id });
          get().pushToast({
            text: `作品 ${duplicate.code}「${duplicate.title}」已在卡册中（移动贴纸、更改箔面/标题或修改编曲即可压印新版本）`,
            accent: '#FFD60A',
          });
          return {
            card: duplicate,
            duplicate: true,
            saveResult: { status: 'primary', storageLabel: '已存在于此设备卡册' },
          };
        }

        set({ mintInFlight: true, lastStorageError: null });
        try {
          const serial = get().nextMintSerial;
          const code = `#MY-${String(serial).padStart(2, '0')}`;
          const waveformBars =
            realWaveformBars && realWaveformBars.length > 0
              ? realWaveformBars
              : computeEventWaveformBars(request.snapshot.events, request.snapshot.durationMs);

          const minted: MintedCard = {
            id: createStableId('minted'),
            schemaVersion: SCHEMA_VERSION,
            assetVersion: request.assetVersion,
            rendererVersion: request.snapshot.rendererVersion ?? RENDERER_VERSION,
            serialNumber: serial,
            code,
            idempotencyKey: request.contentHash,
            title: request.title,
            rarity: request.rarity,
            foil: request.foil,
            artId: request.artId,
            sourceType: request.snapshot.sourceType,
            isDemo: false,
            stickers: request.stickers.map((st) => ({ ...st })),
            waveformBars,
            waveformIsRealPcm: Boolean(realWaveformBars && realWaveformBars.length > 0),
            audioCacheKey: buildAudioCacheKey(request.snapshot),
            audioFingerprintSeed: computeSoundSigilSeed(request.snapshot),
            snapshot: request.snapshot,
            parentCardId: request.remixOrigin?.parentCardId,
            parentCode: request.remixOrigin?.parentCode,
            parentTitle: request.remixOrigin?.parentTitle,
            lineageDepth: request.remixOrigin?.lineageDepth ?? 0,
            createdAt: Date.now(),
          };

          const updatedCards = [minted, ...get().mintedCards];
          const saveResult = await holoDb.saveMintedCards(updatedCards);

          // STRICT PERSISTENCE GATE: NEVER fake success or increment serial if storage failed!
          if (saveResult.status === 'failed') {
            set({
              mintInFlight: false,
              lastStorageError: saveResult.error ?? '本地设备存储空间不足或权限受限',
            });
            get().pushToast({
              text: `压印保存失败：${saveResult.error ?? '本地存储不可用'}。草稿已完整保留，可重试或导出 JSON 备份。`,
              accent: '#FF5C2B',
            });
            return { card: null, duplicate: false, saveResult };
          }

          const finalMinted: MintedCard = {
            ...minted,
            storageStatus: saveResult.status,
          };
          const finalCards = [finalMinted, ...get().mintedCards];

          set({
            mintedCards: finalCards,
            nextMintSerial: serial + 1,
            inspectMintedId: finalMinted.id,
            lastMintedCardId: finalMinted.id,
            mintInFlight: false,
            lastStorageError: null,
            onboarding: { ...get().onboarding, mintedFirstCard: true },
          });

          get().pushToast({
            text:
              saveResult.status === 'fallback'
                ? `藏品 ${finalMinted.code}「${finalMinted.title}」已降级保存至此设备（建议同时导出 JSON 备份）`
                : `★ 藏品 ${finalMinted.code}「${finalMinted.title}」已压印并保存至此设备卡册！`,
            accent: saveResult.status === 'fallback' ? '#FFD60A' : '#00D4AA',
          });

          return { card: finalMinted, duplicate: false, saveResult };
        } catch (err) {
          const msg = err instanceof Error ? err.message : '未知存储异常';
          set({ mintInFlight: false, lastStorageError: msg });
          get().pushToast({
            text: `压印保存失败（${msg}），草稿已安全保留，可重试或导出 JSON 备份。`,
            accent: '#FF5C2B',
          });
          return {
            card: null,
            duplicate: false,
            saveResult: { status: 'failed', storageLabel: '设备存储写入失败', error: msg },
          };
        }
      },

      mintCurrentCard: async (realWaveformBars) => {
        const req = get().createMintRequest();
        if (!req) return null;
        const res = await get().commitMintRequest(req, realWaveformBars);
        return res.card;
      },

      unsealAndRemixCard: (cardId) => {
        const s = get();
        const found = s.mintedCards.find((m) => m.id === cardId);
        if (!found) return;

        const remixOrigin: RemixOrigin = {
          parentCardId: found.id,
          parentCode: found.code,
          parentTitle: found.title,
          lineageDepth: found.lineageDepth + 1,
        };

        if (found.sourceType === 'beat' && found.snapshot.beatSnapshot) {
          const b = found.snapshot.beatSnapshot;
          const bars: 1 | 2 = b.bars === 1 ? 1 : 2;
          get().pushBeatUndo();
          set({
            bpm: b.bpm,
            swing: b.swing,
            scale: b.scale,
            beatBars: bars,
            activePhrase: 'A',
            beatPhraseLoop: b.activePhraseLoop ?? (bars === 2 ? 'AB' : 'A'),
            liveFx: { ...b.liveFx },
            tracks: cloneTracks(b.tracks, bars),
            beatRemixOrigin: remixOrigin,
            activePage: 'beat',
          });
          get().pushToast({
            text: `已拆封 ${found.code}「${found.title}」进入重混（第 ${remixOrigin.lineageDepth} 代变奏 · 原版藏品完好保留）`,
            accent: '#7C3AED',
          });
        } else if (found.sourceType === 'pinball') {
          const scene = found.snapshot.pinballScene;
          const evs = found.snapshot.pinballEvents ?? [];
          set({
            pinballMode: 'free',
            pinballRecordedEvents: evs.map((e) => ({ ...e })),
            pinballToys: scene ? scene.toys.map((t) => ({ ...t })) : s.pinballToys,
            pinballDropperX: scene?.dropperX ?? s.pinballDropperX,
            pinballGravity: scene?.gravity ?? s.pinballGravity,
            pinballDropRate: scene?.dropRate ?? s.pinballDropRate,
            pinballBounce: scene?.bounce ?? s.pinballBounce,
            scale: scene?.scale ?? found.snapshot.scale,
            pinballRemixOrigin: remixOrigin,
            activePage: 'pinball',
          });
          get().pushToast({
            text: `已拆封弹珠藏品 ${found.code}「${found.title}」恢复场景与录音（第 ${remixOrigin.lineageDepth} 代变奏）`,
            accent: '#00D4AA',
          });
        }
      },

      deleteMintedCard: async (id) => {
        const s = get();
        const target = s.mintedCards.find((m) => m.id === id);
        if (!target) return false;
        const updated = s.mintedCards.filter((m) => m.id !== id);
        const saveRes = await holoDb.saveMintedCards(updated);
        if (saveRes.status === 'failed') {
          get().pushToast({
            text: `删除藏品失败（${saveRes.error ?? '本地存储写入失败'}），已保持原卡册状态`,
            accent: '#FF5C2B',
          });
          return false;
        }
        const cacheKey = target.audioCacheKey ?? buildAudioCacheKey(target.snapshot);
        void holoDb.deleteAudioCacheIfUnused(cacheKey, updated, s.forgeDraft);

        set({
          mintedCards: updated,
          inspectMintedId: s.inspectMintedId === id ? null : s.inspectMintedId,
          lastMintedCardId: s.lastMintedCardId === id ? null : s.lastMintedCardId,
        });
        return true;
      },

      importProjectFile: async (rawProject) => {
        const validation = validateProjectFile(rawProject);
        if (!validation.ok || !validation.project) {
          get().pushToast({
            text: `导入失败：${validation.error ?? '无效的工程 JSON 文件'}（已有作品未受影响）`,
            accent: '#FF5C2B',
          });
          return false;
        }

        const project = validation.project;
        const s = get();

        if (project.kind === 'minted-card' && project.card) {
          const serial = s.nextMintSerial;
          const importedCard: MintedCard = {
            ...project.card,
            id: createStableId('imported'),
            serialNumber: serial,
            code: `#MY-${String(serial).padStart(2, '0')}`,
            idempotencyKey: createStableId('imp-key'),
            createdAt: Date.now(),
          };
          const updated = [importedCard, ...s.mintedCards];
          const saveRes = await holoDb.saveMintedCards(updated);
          if (saveRes.status === 'failed') {
            get().pushToast({
              text: `导入保存失败：${saveRes.error ?? '设备存储写入失败'}`,
              accent: '#FF5C2B',
            });
            return false;
          }
          set({
            mintedCards: updated,
            nextMintSerial: serial + 1,
            inspectMintedId: importedCard.id,
            lastMintedCardId: importedCard.id,
            activePage: 'forge',
          });
          const warnText =
            validation.warnings.length > 0 ? `（注：${validation.warnings[0]}）` : '';
          get().pushToast({
            text: `已导入工程闪卡 ${importedCard.code}「${importedCard.title}」并载入鉴赏台${warnText}`,
            accent: '#00D4AA',
          });
          return true;
        }

        if (project.kind === 'forge-draft' && project.draft) {
          const saveRes = await holoDb.saveForgeDraft(project.draft);
          if (saveRes.status === 'failed') {
            get().pushToast({ text: '导入草稿写入存储失败', accent: '#FF5C2B' });
            return false;
          }
          set({
            forgeDraft: project.draft,
            inspectMintedId: null,
            activePage: 'forge',
          });
          get().pushToast({
            text: `已导入工程草稿「${project.draft.title}」至闪卡铸造屋！`,
            accent: '#00D4AA',
          });
          return true;
        }
        return false;
      },

      pushToast: (toast) => {
        const id = createStableId('toast');
        set((s) => ({ toasts: [...s.toasts.slice(-2), { ...toast, id }] }));
        setTimeout(() => {
          get().dismissToast(id);
        }, 4000);
      },

      dismissToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'holobeat-studio-v3',
      partialize: (state) => ({
        reducedMotion: state.reducedMotion,
        bpm: state.bpm,
        swing: state.swing,
        scale: state.scale,
        beatBars: state.beatBars,
        activePhrase: state.activePhrase,
        beatPhraseLoop: state.beatPhraseLoop,
        collection: state.collection,
        pullHistory: state.pullHistory,
        pullCounts: state.pullCounts,
        totalPulls: state.totalPulls,
        pityCount: state.pityCount,
        selectedGachaCardId: state.selectedGachaCardId,
        tracks: state.tracks,
        liveFx: state.liveFx,
        liveFxMode: state.liveFxMode,
        beatBounceMode: state.beatBounceMode,
        pinballToys: state.pinballToys,
        pinballBindCardId: state.pinballBindCardId,
        pinballDropperX: state.pinballDropperX,
        pinballGravity: state.pinballGravity,
        pinballDropRate: state.pinballDropRate,
        pinballBounce: state.pinballBounce,
        pinballRecordedEvents: state.pinballRecordedEvents,
        nextMintSerial: state.nextMintSerial,
        onboarding: state.onboarding,
      }),
    }
  )
);
