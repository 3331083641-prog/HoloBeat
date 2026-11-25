import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  buildMintIdempotencyKey,
  computeEventWaveformBars,
  computeSoundSigilSeed,
  createBeatCompositionSnapshot,
  createPinballCompositionSnapshot,
  createStableId,
  quantizePinballToBeatPreview,
} from '../audio/compositionEngine';
import {
  RARITY_META,
  SCALE_META,
  SOUND_CARDS,
  STARTER_CARD_IDS,
  getCardById,
} from '../data/soundCards';
import { holoDb } from '../storage/holoDb';
import type {
  BeatPresetId,
  BeatSnapshot,
  CompositionSnapshot,
  ForgeDraft,
  ForgeRarity,
  HoloBeatProjectFile,
  HoloFoilType,
  LiveFxConfig,
  MintedCard,
  OnboardingProgress,
  PageId,
  PinballMode,
  PinballQuantizePreview,
  PinballRecordedEvent,
  PinballToy,
  PinballToyType,
  PlacedSticker,
  RemixOrigin,
  ScaleId,
  SharedCardTransition,
  SoundCardDef,
  ToastMessage,
  TrackCategory,
  TrackState,
} from '../types/holo';

function stepsFromIndices(indices: number[]): boolean[] {
  const arr = Array<boolean>(16).fill(false);
  indices.forEach((i) => {
    if (i >= 0 && i < 16) arr[i] = true;
  });
  return arr;
}

function cloneTracks(tracks: TrackState[]): TrackState[] {
  return tracks.map((t) => ({
    ...t,
    steps: [...t.steps],
    accents: t.accents ? [...t.accents] : Array<boolean>(16).fill(false),
  }));
}

export const BEAT_PRESETS: Record<
  BeatPresetId,
  {
    label: string;
    zhTitle: string;
    bpm: number;
    swing: number;
    scale: ScaleId;
    liveFx: LiveFxConfig;
    tracks: TrackState[];
  }
> = {
  MARKET: {
    label: 'MARKET',
    zhTitle: '胡同早市 Funk',
    bpm: 116,
    swing: 0.16,
    scale: 'PENTA_C',
    liveFx: { bitcrush: false, echo: false, stutter: false },
    tracks: [
      {
        category: 'BEAT',
        cardId: 'card-01',
        steps: stepsFromIndices([0, 6, 8, 14]),
        accents: stepsFromIndices([0, 8]),
        volume: 0.88,
        tone: 0.5,
        mute: false,
        solo: false,
      },
      {
        category: 'PERC',
        cardId: 'card-05',
        steps: stepsFromIndices([2, 4, 10, 12, 15]),
        accents: stepsFromIndices([4, 12]),
        volume: 0.72,
        tone: 0.58,
        mute: false,
        solo: false,
      },
      {
        category: 'MELODY',
        cardId: 'card-09',
        steps: stepsFromIndices([0, 3, 6, 8, 11, 14]),
        accents: stepsFromIndices([0, 8]),
        volume: 0.78,
        tone: 0.54,
        mute: false,
        solo: false,
      },
      {
        category: 'VIBE',
        cardId: 'card-13',
        steps: stepsFromIndices([0, 4, 8, 12]),
        accents: stepsFromIndices([0]),
        volume: 0.74,
        tone: 0.52,
        mute: false,
        solo: false,
      },
    ],
  },
  NIGHT: {
    label: 'NIGHT',
    zhTitle: '霓虹夜市 Groove',
    bpm: 126,
    swing: 0.1,
    scale: 'MINOR_C',
    liveFx: { bitcrush: false, echo: true, stutter: false },
    tracks: [
      {
        category: 'BEAT',
        cardId: 'card-01',
        steps: stepsFromIndices([0, 4, 8, 12, 14]),
        accents: stepsFromIndices([0, 8]),
        volume: 0.92,
        tone: 0.44,
        mute: false,
        solo: false,
      },
      {
        category: 'PERC',
        cardId: 'card-05',
        steps: stepsFromIndices([2, 6, 10, 12, 15]),
        accents: stepsFromIndices([12]),
        volume: 0.72,
        tone: 0.68,
        mute: false,
        solo: false,
      },
      {
        category: 'MELODY',
        cardId: 'card-09',
        steps: stepsFromIndices([0, 2, 5, 7, 10, 12, 15]),
        accents: stepsFromIndices([0, 10]),
        volume: 0.8,
        tone: 0.62,
        mute: false,
        solo: false,
      },
      {
        category: 'VIBE',
        cardId: 'card-13',
        steps: stepsFromIndices([0, 6, 12]),
        accents: stepsFromIndices([0]),
        volume: 0.76,
        tone: 0.58,
        mute: false,
        solo: false,
      },
    ],
  },
  LOFI: {
    label: 'LO-FI',
    zhTitle: '茶馆 Lo-Fi',
    bpm: 92,
    swing: 0.34,
    scale: 'DORIAN_C',
    liveFx: { bitcrush: false, echo: false, stutter: false },
    tracks: [
      {
        category: 'BEAT',
        cardId: 'card-01',
        steps: stepsFromIndices([0, 7, 10]),
        accents: stepsFromIndices([0]),
        volume: 0.86,
        tone: 0.38,
        mute: false,
        solo: false,
      },
      {
        category: 'PERC',
        cardId: 'card-05',
        steps: stepsFromIndices([4, 12, 15]),
        accents: stepsFromIndices([4, 12]),
        volume: 0.68,
        tone: 0.46,
        mute: false,
        solo: false,
      },
      {
        category: 'MELODY',
        cardId: 'card-09',
        steps: stepsFromIndices([0, 3, 6, 11, 14]),
        accents: stepsFromIndices([0]),
        volume: 0.76,
        tone: 0.48,
        mute: false,
        solo: false,
      },
      {
        category: 'VIBE',
        cardId: 'card-13',
        steps: stepsFromIndices([0, 8]),
        accents: stepsFromIndices([0]),
        volume: 0.8,
        tone: 0.42,
        mute: false,
        solo: false,
      },
    ],
  },
  RAIN: {
    label: 'RAIN',
    zhTitle: '雨巷 Ambient',
    bpm: 84,
    swing: 0.22,
    scale: 'DORIAN_C',
    liveFx: { bitcrush: false, echo: true, stutter: false },
    tracks: [
      {
        category: 'BEAT',
        cardId: 'card-01',
        steps: stepsFromIndices([0, 10]),
        accents: stepsFromIndices([0]),
        volume: 0.72,
        tone: 0.32,
        mute: false,
        solo: false,
      },
      {
        category: 'PERC',
        cardId: 'card-05',
        steps: stepsFromIndices([3, 8, 13]),
        accents: stepsFromIndices([]),
        volume: 0.54,
        tone: 0.44,
        mute: false,
        solo: false,
      },
      {
        category: 'MELODY',
        cardId: 'card-09',
        steps: stepsFromIndices([0, 4, 7, 11, 14]),
        accents: stepsFromIndices([4, 11]),
        volume: 0.7,
        tone: 0.4,
        mute: false,
        solo: false,
      },
      {
        category: 'VIBE',
        cardId: 'card-13',
        steps: stepsFromIndices([0, 4, 8, 12]),
        accents: stepsFromIndices([0, 8]),
        volume: 0.84,
        tone: 0.36,
        mute: false,
        solo: false,
      },
    ],
  },
  LION: {
    label: 'LION',
    zhTitle: '街头舞狮 Percussion',
    bpm: 132,
    swing: 0.08,
    scale: 'PENTA_C',
    liveFx: { bitcrush: false, echo: false, stutter: false },
    tracks: [
      {
        category: 'BEAT',
        cardId: 'card-01',
        steps: stepsFromIndices([0, 2, 4, 7, 8, 10, 12, 14]),
        accents: stepsFromIndices([0, 4, 8, 12]),
        volume: 0.94,
        tone: 0.56,
        mute: false,
        solo: false,
      },
      {
        category: 'PERC',
        cardId: 'card-05',
        steps: stepsFromIndices([1, 4, 6, 9, 12, 14, 15]),
        accents: stepsFromIndices([4, 12]),
        volume: 0.82,
        tone: 0.72,
        mute: false,
        solo: false,
      },
      {
        category: 'MELODY',
        cardId: 'card-09',
        steps: stepsFromIndices([0, 4, 6, 8, 12, 14]),
        accents: stepsFromIndices([0, 8]),
        volume: 0.76,
        tone: 0.66,
        mute: false,
        solo: false,
      },
      {
        category: 'VIBE',
        cardId: 'card-13',
        steps: stepsFromIndices([0, 8]),
        accents: stepsFromIndices([0]),
        volume: 0.68,
        tone: 0.6,
        mute: false,
        solo: false,
      },
    ],
  },
};

export const PINBALL_PRESETS: Record<'LOOP' | 'CASCADE', PinballToy[]> = {
  LOOP: [
    { id: 'pb-1', type: 'block', x: 220, y: 185, angle: 0.24, cardId: 'card-01', note: 'C5' },
    { id: 'pb-2', type: 'block', x: 580, y: 230, angle: -0.24, cardId: 'card-05', note: 'D5' },
    { id: 'pb-3', type: 'bumper', x: 165, y: 365, angle: 0, cardId: 'card-05', note: 'E5' },
    { id: 'pb-4', type: 'spinner', x: 400, y: 380, angle: 0, cardId: 'card-09', note: 'G5' },
    { id: 'pb-5', type: 'bumper', x: 640, y: 375, angle: 0, cardId: 'card-01', note: 'A5' },
    { id: 'pb-6', type: 'block', x: 235, y: 535, angle: 0.22, cardId: 'card-09', note: 'G5' },
    { id: 'pb-7', type: 'block', x: 565, y: 535, angle: -0.22, cardId: 'card-13', note: 'A5' },
    { id: 'pb-8', type: 'portal', x: 400, y: 632, angle: 0, cardId: 'card-09', note: 'C5' },
  ],
  CASCADE: [
    { id: 'pc-1', type: 'block', x: 355, y: 170, angle: 0.28, cardId: 'card-09', note: 'C5' },
    { id: 'pc-2', type: 'block', x: 530, y: 270, angle: -0.28, cardId: 'card-05', note: 'D5' },
    { id: 'pc-3', type: 'block', x: 295, y: 375, angle: 0.26, cardId: 'card-01', note: 'E5' },
    { id: 'pc-4', type: 'bumper', x: 175, y: 270, angle: 0, cardId: 'card-13', note: 'G5' },
    { id: 'pc-5', type: 'spinner', x: 485, y: 445, angle: 0, cardId: 'card-09', note: 'A5' },
    { id: 'pc-6', type: 'block', x: 565, y: 555, angle: -0.26, cardId: 'card-13', note: 'G5' },
    { id: 'pc-7', type: 'bumper', x: 235, y: 545, angle: 0, cardId: 'card-05', note: 'D5' },
    { id: 'pc-8', type: 'portal', x: 400, y: 632, angle: 0, cardId: 'card-01', note: 'C5' },
  ],
};

const DEFAULT_FORGE_STICKERS: PlacedSticker[] = [
  { uid: 'stk-init-1', stickerId: 'bolt', x: 16, y: 58, scale: 1.0, rotation: -8, zIndex: 1 },
  { uid: 'stk-init-2', stickerId: 'note', x: 85, y: 60, scale: 1.0, rotation: 8, zIndex: 2 },
];

const DEMO_BEAT_SNAPSHOT: CompositionSnapshot = createBeatCompositionSnapshot(
  {
    bpm: BEAT_PRESETS.MARKET.bpm,
    swing: BEAT_PRESETS.MARKET.swing,
    scale: BEAT_PRESETS.MARKET.scale,
    bars: 2,
    liveFx: { ...BEAT_PRESETS.MARKET.liveFx },
    tracks: cloneTracks(BEAT_PRESETS.MARKET.tracks),
  },
  { isDemo: true }
);

/** Clearly marked DEMO collectible card so sample music is never misrepresented as user work! */
const INITIAL_DEMO_CARD: MintedCard = {
  id: 'demo-card-neon-night',
  serialNumber: 0,
  code: '#DEMO-01',
  idempotencyKey: 'demo::neon-night',
  title: 'NEON NIGHT',
  rarity: 'UR',
  foil: 'prism',
  artId: 'neon-dj',
  sourceType: 'beat',
  isDemo: true,
  stickers: DEFAULT_FORGE_STICKERS,
  waveformBars: computeEventWaveformBars(DEMO_BEAT_SNAPSHOT.events, DEMO_BEAT_SNAPSHOT.durationMs),
  waveformIsRealPcm: false,
  audioFingerprintSeed: computeSoundSigilSeed(DEMO_BEAT_SNAPSHOT),
  snapshot: DEMO_BEAT_SNAPSHOT,
  lineageDepth: 0,
  createdAt: 1735689600000,
};

const INITIAL_FORGE_DRAFT: ForgeDraft = {
  snapshot: DEMO_BEAT_SNAPSHOT,
  sourceType: 'beat',
  title: 'HUTONG FUNK',
  rarity: 'UR',
  foil: 'prism',
  artId: 'neon-dj',
  stickers: DEFAULT_FORGE_STICKERS.map((s) => ({ ...s })),
  remixOrigin: null,
};

interface BeatHistoryEntry {
  bpm: number;
  swing: number;
  scale: ScaleId;
  bars: number;
  liveFx: LiveFxConfig;
  tracks: TrackState[];
}

interface HoloState {
  // Navigation & Global Audio
  activePage: PageId;
  audioUnlocked: boolean;
  muted: boolean;
  bpm: number;
  swing: number;
  scale: ScaleId;
  beatBars: number;
  isPlaying: boolean;
  drawerOpen: boolean;
  sharedCardTransition: SharedCardTransition | null;
  onboarding: OnboardingProgress;
  dbHydrated: boolean;

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
  /** Strictly user-recorded collisions (empty by default — NEVER silently backfilled with fake demo notes!) */
  pinballRecordedEvents: PinballRecordedEvent[];
  pinballRemixOrigin: RemixOrigin | null;

  // Card Forge (Clean Isolation: Draft Mode vs. Inspect Archive Mode!)
  forgeDraft: ForgeDraft;
  inspectMintedId: string | null;
  mintedCards: MintedCard[];
  nextMintSerial: number;
  mintInFlight: boolean;
  stickerUndoStack: PlacedSticker[][];
  stickerRedoStack: PlacedSticker[][];

  // Toasts (transient)
  toasts: ToastMessage[];

  // Core Actions
  hydrateFromIndexedDb: () => Promise<void>;
  setActivePage: (page: PageId) => void;
  setAudioUnlocked: (unlocked: boolean) => void;
  setDrawerOpen: (open: boolean) => void;
  toggleMute: () => void;
  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  setBeatBars: (bars: number) => void;
  cycleScale: () => void;
  setScale: (scale: ScaleId) => void;
  setIsPlaying: (playing: boolean) => void;
  dismissOnboarding: () => void;
  triggerSharedTransition: (cardId: string, targetPage: PageId, targetTrackIndex?: number) => void;

  // Gacha Actions
  pullGachaCard: (skipScratch?: boolean) => { card: SoundCardDef; isNew: boolean; hitPity: boolean };
  revealCurrentCard: () => void;
  selectGachaCard: (cardId: string) => void;
  sendCardToBeat: (cardId: string, targetTrackIdx?: number, navigate?: boolean) => void;
  sendCardToPinball: (cardId: string, navigate?: boolean) => void;

  // Beat Actions
  pushBeatUndo: () => void;
  undoBeat: () => void;
  redoBeat: () => void;
  toggleStep: (trackIndex: number, stepIndex: number, forceValue?: boolean) => void;
  toggleStepAccent: (trackIndex: number, stepIndex: number) => void;
  setTrackCard: (trackIndex: number, cardId: string) => void;
  setTrackVolume: (trackIndex: number, volume: number) => void;
  setTrackTone: (trackIndex: number, tone: number) => void;
  toggleTrackMute: (trackIndex: number) => void;
  toggleTrackSolo: (trackIndex: number) => void;
  applyBeatPreset: (preset: BeatPresetId) => void;
  randomizeBeat: () => void;
  clearBeat: () => void;
  setLiveFx: (fx: keyof LiveFxConfig, active: boolean) => void;
  setBeatBounceMode: (on: boolean) => void;
  setBeatStageMode: (on: boolean) => void;
  sendBeatToForge: () => CompositionSnapshot;
  performBeatInPinball: () => CompositionSnapshot;
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
  applyPinballPreset: (preset: 'LOOP' | 'CASCADE' | 'CLEAR') => void;
  setPinballRecordedEvents: (events: PinballRecordedEvent[]) => void;
  sendPinballToForge: (events: PinballRecordedEvent[]) => boolean;
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
  mintCurrentCard: (realWaveformBars?: number[]) => Promise<MintedCard | null>;
  unsealAndRemixCard: (cardId: string) => void;
  deleteMintedCard: (id: string) => Promise<void>;
  importProjectFile: (project: HoloBeatProjectFile) => Promise<boolean>;

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
      bpm: BEAT_PRESETS.MARKET.bpm,
      swing: BEAT_PRESETS.MARKET.swing,
      scale: BEAT_PRESETS.MARKET.scale,
      beatBars: 2,
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

      collection: [...STARTER_CARD_IDS],
      pullHistory: ['card-05', 'card-01', 'card-09', 'card-13'],
      pullCounts: { 'card-01': 1, 'card-05': 1, 'card-09': 1, 'card-13': 1 },
      totalPulls: 4,
      pityCount: 4,
      selectedGachaCardId: 'card-05',
      needsScratch: false,

      tracks: cloneTracks(BEAT_PRESETS.MARKET.tracks),
      liveFx: { ...BEAT_PRESETS.MARKET.liveFx },
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
      mintedCards: [INITIAL_DEMO_CARD],
      nextMintSerial: 1,
      mintInFlight: false,
      stickerUndoStack: [],
      stickerRedoStack: [],

      toasts: [],

      hydrateFromIndexedDb: async () => {
        if (get().dbHydrated) return;
        holoDb.backupLegacyLocalStorage();
        const [savedCards, savedDraft] = await Promise.all([
          holoDb.loadMintedCards(),
          holoDb.loadForgeDraft(),
        ]);

        const patch: Partial<HoloState> = { dbHydrated: true };
        if (savedCards && savedCards.length > 0) {
          const maxSerial = savedCards.reduce((m, c) => Math.max(m, c.serialNumber ?? 0), 0);
          patch.mintedCards = savedCards;
          patch.nextMintSerial = Math.max(get().nextMintSerial, maxSerial + 1);
        }
        if (savedDraft) {
          patch.forgeDraft = savedDraft;
        }
        set(patch);
      },

      setActivePage: (page) => set({ activePage: page }),
      setAudioUnlocked: (audioUnlocked) => set({ audioUnlocked }),
      setDrawerOpen: (open) => set({ drawerOpen: open }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      setBpm: (bpm) => set({ bpm: Math.min(180, Math.max(60, Math.round(bpm))) }),
      setSwing: (swing) => set({ swing: Math.min(0.6, Math.max(0, swing)) }),
      setBeatBars: (bars) => set({ beatBars: bars === 1 ? 1 : 2 }),
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

      triggerSharedTransition: (cardId, targetPage, targetTrackIndex) => {
        set({
          sharedCardTransition: {
            cardId,
            targetPage,
            targetTrackIndex,
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
          const srPlusUnowned = unowned.filter((c) =>
            ['SR', 'SSR', 'UR'].includes(c.rarity)
          );
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

      sendCardToBeat: (cardId, targetTrackIdx, navigate = true) => {
        const card = getCardById(cardId);
        const categoryOrder: TrackCategory[] = ['BEAT', 'PERC', 'MELODY', 'VIBE'];
        const trackIdx =
          targetTrackIdx !== undefined && targetTrackIdx >= 0 && targetTrackIdx < 4
            ? targetTrackIdx
            : categoryOrder.indexOf(card.category);

        get().pushBeatUndo();
        set((s) => ({
          tracks: s.tracks.map((t, idx) =>
            idx === trackIdx ? { ...t, cardId: card.id } : t
          ),
          onboarding: { ...s.onboarding, sentToBeat: true },
        }));

        if (navigate) {
          get().triggerSharedTransition(card.id, 'beat', trackIdx);
        }

        get().pushToast({
          text: `已将 ${card.code} ${card.title}（${card.zhTitle}）真实装入 ${categoryOrder[trackIdx]} 轨道卡槽`,
          accent: card.accentColor,
          actionLabel: navigate ? undefined : '前往节拍台 →',
          actionPage: navigate ? undefined : 'beat',
        });
      },

      sendCardToPinball: (cardId, navigate = true) => {
        const card = getCardById(cardId);
        set({
          pinballBindCardId: card.id,
          pinballMode: 'free',
        });
        if (navigate) {
          get().triggerSharedTransition(card.id, 'pinball');
        }
        get().pushToast({
          text: `已绑定 ${card.code} ${card.title} 至物理弹珠台音色槽`,
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
              liveFx: { ...s.liveFx },
              tracks: cloneTracks(s.tracks),
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
            liveFx: { ...s.liveFx },
            tracks: cloneTracks(s.tracks),
          };
          return {
            bpm: prev.bpm,
            swing: prev.swing,
            scale: prev.scale,
            beatBars: prev.bars,
            liveFx: { ...prev.liveFx },
            tracks: cloneTracks(prev.tracks),
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
            liveFx: { ...s.liveFx },
            tracks: cloneTracks(s.tracks),
          };
          return {
            bpm: next.bpm,
            swing: next.swing,
            scale: next.scale,
            beatBars: next.bars,
            liveFx: { ...next.liveFx },
            tracks: cloneTracks(next.tracks),
            beatRedoStack: s.beatRedoStack.slice(0, -1),
            beatUndoStack: [...s.beatUndoStack.slice(-19), current],
          };
        }),

      toggleStep: (trackIndex, stepIndex, forceValue) =>
        set((s) => ({
          tracks: s.tracks.map((t, idx) => {
            if (idx !== trackIndex) return t;
            const steps = [...t.steps];
            steps[stepIndex] = forceValue !== undefined ? forceValue : !steps[stepIndex];
            return { ...t, steps };
          }),
          onboarding: { ...s.onboarding, editedOrPlayedBeat: true },
        })),

      toggleStepAccent: (trackIndex, stepIndex) =>
        set((s) => ({
          tracks: s.tracks.map((t, idx) => {
            if (idx !== trackIndex) return t;
            const steps = [...t.steps];
            const accents = t.accents ? [...t.accents] : Array<boolean>(16).fill(false);
            if (!steps[stepIndex]) steps[stepIndex] = true;
            accents[stepIndex] = !accents[stepIndex];
            return { ...t, steps, accents };
          }),
        })),

      setTrackCard: (trackIndex, cardId) => {
        get().pushBeatUndo();
        set((s) => ({
          tracks: s.tracks.map((t, idx) => (idx === trackIndex ? { ...t, cardId } : t)),
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
          liveFx: { ...p.liveFx },
          tracks: p.tracks.map((t, idx) => {
            const currentId = s.tracks[idx]?.cardId;
            const useId = currentId && unlocked.includes(currentId) ? currentId : t.cardId;
            return {
              ...t,
              cardId: useId,
              steps: [...t.steps],
              accents: t.accents ? [...t.accents] : Array<boolean>(16).fill(false),
            };
          }),
        }));
      },

      randomizeBeat: () => {
        get().pushBeatUndo();
        set((s) => ({
          tracks: s.tracks.map((t, idx) => {
            const steps = Array<boolean>(16).fill(false);
            const accents = Array<boolean>(16).fill(false);
            if (idx === 0) {
              steps[0] = true;
              accents[0] = true;
              steps[8] = true;
              for (let i = 0; i < 16; i++) {
                if (i !== 0 && i !== 8 && Math.random() < (i % 4 === 0 ? 0.55 : 0.22)) {
                  steps[i] = true;
                }
              }
            } else if (idx === 1) {
              steps[4] = true;
              steps[12] = true;
              accents[4] = true;
              for (let i = 0; i < 16; i++) {
                if (Math.random() < (i % 2 === 1 ? 0.3 : 0.18)) steps[i] = true;
              }
            } else if (idx === 2) {
              for (let i = 0; i < 16; i++) {
                if (Math.random() < (i % 2 === 0 ? 0.45 : 0.22)) steps[i] = true;
              }
            } else {
              steps[0] = true;
              for (let i = 1; i < 16; i++) {
                if (Math.random() < (i % 4 === 0 ? 0.55 : 0.12)) steps[i] = true;
              }
            }
            return { ...t, steps, accents };
          }),
        }));
      },

      clearBeat: () => {
        get().pushBeatUndo();
        set((s) => ({
          tracks: s.tracks.map((t) => ({
            ...t,
            steps: Array<boolean>(16).fill(false),
            accents: Array<boolean>(16).fill(false),
          })),
        }));
      },

      setLiveFx: (fx, active) =>
        set((s) => ({
          liveFx: { ...s.liveFx, [fx]: active },
        })),

      setBeatBounceMode: (beatBounceMode) => set({ beatBounceMode }),
      setBeatStageMode: (beatStageMode) => set({ beatStageMode }),

      /** Immediately freeze an immutable Beat CompositionSnapshot and load it into Forge Draft */
      sendBeatToForge: () => {
        const s = get();
        const frozen = createBeatCompositionSnapshot({
          bpm: s.bpm,
          swing: s.swing,
          scale: s.scale,
          bars: s.beatBars,
          liveFx: { ...s.liveFx },
          tracks: cloneTracks(s.tracks),
        });

        const nextDraft: ForgeDraft = {
          ...s.forgeDraft,
          snapshot: frozen,
          sourceType: 'beat',
          remixOrigin: s.beatRemixOrigin,
          title:
            s.beatRemixOrigin
              ? `${s.beatRemixOrigin.parentTitle.slice(0, 13)} V${s.beatRemixOrigin.lineageDepth}`
              : s.forgeDraft.title || 'STREET GROOVE',
        };

        void holoDb.saveForgeDraft(nextDraft);

        set({
          forgeDraft: nextDraft,
          inspectMintedId: null,
          activePage: 'forge',
        });

        get().pushToast({
          text: `已冻结当前节拍作品快照（${frozen.events.length} 个音符 · ${frozen.bpm} BPM），后续修改编曲不会影响此草稿！`,
          accent: '#FFD60A',
        });

        return frozen;
      },

      performBeatInPinball: () => {
        const s = get();
        const frozen = createBeatCompositionSnapshot({
          bpm: s.bpm,
          swing: s.swing,
          scale: s.scale,
          bars: s.beatBars,
          liveFx: { ...s.liveFx },
          tracks: cloneTracks(s.tracks),
        });

        set({
          pinballShowSnapshot: frozen,
          pinballMode: 'show',
          activePage: 'pinball',
          onboarding: { ...s.onboarding, watchedPinballShow: true },
        });

        get().pushToast({
          text: `✦ 已冻结 ${frozen.events.length} 个音符事件送入弹珠剧场 · 即将开始音画同步演出！`,
          accent: '#00D4AA',
        });

        return frozen;
      },

      applyPinballQuantize: (mode) => {
        const s = get();
        const preview = s.pinballQuantizePreview;
        if (!preview || mode === 'cancel') {
          set({ pinballQuantizePreview: null });
          return;
        }
        get().pushBeatUndo();
        set((curr) => ({
          tracks: curr.tracks.map((track, tIdx) => {
            const ghostRow = preview.ghostSteps[tIdx] ?? Array<boolean>(16).fill(false);
            const steps =
              mode === 'replace'
                ? [...ghostRow]
                : track.steps.map((v, i) => v || ghostRow[i]);
            const suggestedCard = preview.trackCardIds[tIdx];
            return {
              ...track,
              cardId:
                suggestedCard && curr.collection.includes(suggestedCard)
                  ? suggestedCard
                  : track.cardId,
              steps,
            };
          }),
          pinballQuantizePreview: null,
        }));
        get().pushToast({
          text:
            mode === 'replace'
              ? `已将弹珠量化节奏替换至节拍台（保留原始弹珠录音可随时铸卡）`
              : `已将弹珠量化音符合并至当前节拍轨道`,
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

      /** Strictly rejects empty recordings — NEVER silently substitutes fake sample audio! */
      sendPinballToForge: (events) => {
        const s = get();
        const validEvents = events.length > 0 ? events : s.pinballRecordedEvents;
        if (validEvents.length === 0) {
          get().pushToast({
            text: '尚未录制到有效碰撞音符！请先投放弹珠撞击音块后再捕获作品。',
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
          s.bpm
        );

        const nextDraft: ForgeDraft = {
          ...s.forgeDraft,
          snapshot: frozen,
          sourceType: 'pinball',
          title:
            s.pinballRemixOrigin
              ? `${s.pinballRemixOrigin.parentTitle.slice(0, 13)} V${s.pinballRemixOrigin.lineageDepth}`
              : 'PINBALL LOOP',
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
        const preview = quantizePinballToBeatPreview(validEvents, s.bpm);
        set({
          pinballRecordedEvents: validEvents.map((e) => ({ ...e })),
          pinballQuantizePreview: preview,
          activePage: 'beat',
        });
        get().pushToast({
          text: `已生成 ${preview.mappedCount} 个幽灵量化节拍预览，可对比原录音后选择合并、替换或取消！`,
          accent: '#00D4AA',
        });
        return true;
      },

      setForgeSource: (sourceType) => {
        const s = get();
        if (sourceType === 'pinball') {
          if (s.pinballRecordedEvents.length === 0 && s.forgeDraft.snapshot?.sourceType !== 'pinball') {
            get().pushToast({
              text: '当前暂无已录制的弹珠作品，请先前往 03 PINBALL 录制真实碰撞音乐！',
              accent: '#FF5C2B',
              actionLabel: '去弹珠台 →',
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

        // Capture current live Beat Deck cleanly into draft snapshot
        const snap = createBeatCompositionSnapshot({
          bpm: s.bpm,
          swing: s.swing,
          scale: s.scale,
          bars: s.beatBars,
          liveFx: { ...s.liveFx },
          tracks: cloneTracks(s.tracks),
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
          const offset = (prev.length % 5) * 6;
          const maxZ = prev.reduce((m, st) => Math.max(m, st.zIndex ?? 1), 1);
          const nextSticker: PlacedSticker = {
            uid: createStableId('stk'),
            stickerId,
            x: Math.min(84, Math.max(16, 26 + offset * 2 + (Math.random() * 20 - 10))),
            y: Math.min(74, Math.max(22, 32 + offset * 1.5 + (Math.random() * 20 - 10))),
            scale: 1,
            rotation: Math.round(Math.random() * 22 - 11),
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

      /** Open an existing MintedCard in read-only Inspect Archive mode WITHOUT overwriting ForgeDraft! */
      inspectMintedCard: (id) => set({ inspectMintedId: id }),

      returnToForgeDraft: () => set({ inspectMintedId: null }),

      loadGachaCardIntoForgeDraft: (cardId) => {
        const card = getCardById(cardId);
        set((s) => {
          const forgeDraft: ForgeDraft = {
            ...s.forgeDraft,
            title: card.title,
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

      /**
       * Strictly idempotent, monotonic-serial, persistence-first Minting!
       * Guarantees:
       * 1. No duplicate serial numbers after deletions (uses `nextMintSerial`)
       * 2. No duplicate cards on double-click (uses `mintInFlight` + `idempotencyKey`)
       * 3. Only commits UI success after storage persistence succeeds!
       */
      mintCurrentCard: async (realWaveformBars) => {
        const s = get();
        if (s.mintInFlight) return null;

        let snapshot = s.forgeDraft.snapshot;
        if (!snapshot) {
          snapshot = createBeatCompositionSnapshot({
            bpm: s.bpm,
            swing: s.swing,
            scale: s.scale,
            bars: s.beatBars,
            liveFx: { ...s.liveFx },
            tracks: cloneTracks(s.tracks),
          });
        }

        if (snapshot.events.length === 0) {
          get().pushToast({
            text: '当前草稿尚未包含任何有效音符，请先在节拍台点亮打击垫或录制弹珠声音！',
            accent: '#FF5C2B',
          });
          return null;
        }

        const cleanTitle = (s.forgeDraft.title.trim() || 'HOLO MIX').toUpperCase();
        const idempotencyKey = buildMintIdempotencyKey({
          snapshotId: snapshot.id,
          title: cleanTitle,
          rarity: s.forgeDraft.rarity,
          foil: s.forgeDraft.foil,
          artId: s.forgeDraft.artId,
          stickerCount: s.forgeDraft.stickers.length,
        });

        // Idempotent guard: if an identical work was just minted, return it instead of duplicating!
        const duplicate = s.mintedCards.find((m) => m.idempotencyKey === idempotencyKey);
        if (duplicate) {
          set({ inspectMintedId: duplicate.id });
          get().pushToast({
            text: `作品 ${duplicate.code}「${duplicate.title}」已在卡册中，已防止重复铸造（修改标题/箔面/贴纸或编曲即可铸造新版本）`,
            accent: '#FFD60A',
          });
          return duplicate;
        }

        set({ mintInFlight: true });
        try {
          const serial = s.nextMintSerial;
          const code = `#MY-${String(serial).padStart(2, '0')}`;
          const waveformBars =
            realWaveformBars && realWaveformBars.length > 0
              ? realWaveformBars
              : computeEventWaveformBars(snapshot.events, snapshot.durationMs);

          const minted: MintedCard = {
            id: createStableId('minted'),
            serialNumber: serial,
            code,
            idempotencyKey,
            title: cleanTitle,
            rarity: s.forgeDraft.rarity,
            foil: s.forgeDraft.foil,
            artId: s.forgeDraft.artId,
            sourceType: snapshot.sourceType,
            isDemo: false,
            stickers: s.forgeDraft.stickers.map((st) => ({ ...st })),
            waveformBars,
            waveformIsRealPcm: Boolean(realWaveformBars && realWaveformBars.length > 0),
            audioFingerprintSeed: computeSoundSigilSeed(snapshot),
            snapshot,
            parentCardId: s.forgeDraft.remixOrigin?.parentCardId,
            parentCode: s.forgeDraft.remixOrigin?.parentCode,
            parentTitle: s.forgeDraft.remixOrigin?.parentTitle,
            lineageDepth: s.forgeDraft.remixOrigin?.lineageDepth ?? 0,
            createdAt: Date.now(),
          };

          const updatedCards = [minted, ...s.mintedCards];
          await holoDb.saveMintedCards(updatedCards);

          set({
            mintedCards: updatedCards,
            nextMintSerial: serial + 1,
            inspectMintedId: minted.id,
            mintInFlight: false,
            onboarding: { ...s.onboarding, mintedFirstCard: true },
          });

          get().pushToast({
            text: `★ 藏品闪卡 ${minted.code}「${minted.title}」已永久封存并收入个人卡册！`,
            accent: '#FF5C2B',
          });

          return minted;
        } catch {
          set({ mintInFlight: false });
          get().pushToast({
            text: '本地持久保存失败，草稿已安全保留，请重试铸造。',
            accent: '#FF5C2B',
          });
          return null;
        }
      },

      /**
       * UNSEAL & REMIX — Core Creative Loop Closer!
       * Restores a collected MintedCard's frozen Beat or Pinball composition back into the
       * live workbench as a new derivative child version while keeping the original 100% immutable!
       */
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
          get().pushBeatUndo();
          set({
            bpm: b.bpm,
            swing: b.swing,
            scale: b.scale,
            beatBars: b.bars || 2,
            liveFx: { ...b.liveFx },
            tracks: cloneTracks(b.tracks),
            beatRemixOrigin: remixOrigin,
            activePage: 'beat',
          });
          get().pushToast({
            text: `🔓 已拆封 ${found.code}「${found.title}」进入重混（第 ${remixOrigin.lineageDepth} 代变奏 · 原版藏品保持完好）`,
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
            text: `🔓 已拆封弹珠藏品 ${found.code}「${found.title}」恢复原始场景与录音（第 ${remixOrigin.lineageDepth} 代变奏）`,
            accent: '#00D4AA',
          });
        }
      },

      deleteMintedCard: async (id) => {
        const s = get();
        const target = s.mintedCards.find((m) => m.id === id);
        const updated = s.mintedCards.filter((m) => m.id !== id);
        await holoDb.saveMintedCards(updated);
        if (target) {
          void holoDb.deleteAudioCache(target.snapshot.id);
        }
        set({
          mintedCards: updated,
          inspectMintedId: s.inspectMintedId === id ? null : s.inspectMintedId,
        });
      },

      importProjectFile: async (project) => {
        if (!project || project.schema !== 'holobeat.project.v2') {
          get().pushToast({ text: '无效的 .holobeat.json 工程文件格式', accent: '#FF5C2B' });
          return false;
        }
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
          await holoDb.saveMintedCards(updated);
          set({
            mintedCards: updated,
            nextMintSerial: serial + 1,
            inspectMintedId: importedCard.id,
            activePage: 'forge',
          });
          get().pushToast({
            text: `✓ 已导入工程闪卡 ${importedCard.code}「${importedCard.title}」并载入鉴赏台！`,
            accent: '#00D4AA',
          });
          return true;
        }
        if (project.kind === 'forge-draft' && project.draft) {
          await holoDb.saveForgeDraft(project.draft);
          set({
            forgeDraft: project.draft,
            inspectMintedId: null,
            activePage: 'forge',
          });
          get().pushToast({
            text: `✓ 已导入工程草稿「${project.draft.title}」至闪卡铸造屋！`,
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
        }, 3800);
      },

      dismissToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'holobeat-studio-v3',
      partialize: (state) => ({
        bpm: state.bpm,
        swing: state.swing,
        scale: state.scale,
        beatBars: state.beatBars,
        collection: state.collection,
        pullHistory: state.pullHistory,
        pullCounts: state.pullCounts,
        totalPulls: state.totalPulls,
        pityCount: state.pityCount,
        selectedGachaCardId: state.selectedGachaCardId,
        tracks: state.tracks,
        liveFx: state.liveFx,
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
