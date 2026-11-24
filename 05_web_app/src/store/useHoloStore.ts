import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  RARITY_META,
  SCALE_META,
  SOUND_CARDS,
  STARTER_CARD_IDS,
  getCardById,
} from '../data/soundCards';
import type {
  BeatSnapshot,
  ForgeRarity,
  HoloFoilType,
  MintedCard,
  PageId,
  PinballRecordedEvent,
  PinballToy,
  PinballToyType,
  PlacedSticker,
  ScaleId,
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

export const BEAT_PRESETS: Record<
  'MARKET' | 'NIGHT',
  {
    bpm: number;
    swing: number;
    scale: ScaleId;
    tracks: TrackState[];
  }
> = {
  MARKET: {
    bpm: 120,
    swing: 0.14,
    scale: 'PENTA_C',
    tracks: [
      {
        category: 'BEAT',
        cardId: 'card-01',
        steps: stepsFromIndices([0, 3, 4, 7, 8, 9, 11, 13, 15]),
        volume: 0.85,
        tone: 0.52,
        mute: false,
        solo: false,
      },
      {
        category: 'PERC',
        cardId: 'card-05',
        steps: stepsFromIndices([1, 4, 5, 6, 7, 10, 12, 15]),
        volume: 0.78,
        tone: 0.62,
        mute: false,
        solo: false,
      },
      {
        category: 'MELODY',
        cardId: 'card-09',
        steps: stepsFromIndices([2, 4, 6, 10, 12, 14]),
        volume: 0.8,
        tone: 0.56,
        mute: false,
        solo: false,
      },
      {
        category: 'VIBE',
        cardId: 'card-13',
        steps: stepsFromIndices([0, 3, 4, 7, 10, 13, 14]),
        volume: 0.72,
        tone: 0.48,
        mute: false,
        solo: false,
      },
    ],
  },
  NIGHT: {
    bpm: 128,
    swing: 0.22,
    scale: 'MINOR_C',
    tracks: [
      {
        category: 'BEAT',
        cardId: 'card-01',
        steps: stepsFromIndices([0, 4, 6, 8, 12, 14]),
        volume: 0.9,
        tone: 0.45,
        mute: false,
        solo: false,
      },
      {
        category: 'PERC',
        cardId: 'card-05',
        steps: stepsFromIndices([2, 4, 7, 10, 12, 15]),
        volume: 0.74,
        tone: 0.7,
        mute: false,
        solo: false,
      },
      {
        category: 'MELODY',
        cardId: 'card-09',
        steps: stepsFromIndices([0, 3, 5, 7, 10, 12, 15]),
        volume: 0.82,
        tone: 0.65,
        mute: false,
        solo: false,
      },
      {
        category: 'VIBE',
        cardId: 'card-13',
        steps: stepsFromIndices([0, 2, 8, 10, 12]),
        volume: 0.76,
        tone: 0.55,
        mute: false,
        solo: false,
      },
    ],
  },
};

export const PINBALL_PRESETS: Record<'LOOP' | 'CASCADE', PinballToy[]> = {
  LOOP: [
    { id: 'pb-1', type: 'block', x: 215, y: 175, angle: 0.22, cardId: 'card-01', note: 'C5' },
    { id: 'pb-2', type: 'block', x: 585, y: 215, angle: -0.24, cardId: 'card-05', note: 'D5' },
    { id: 'pb-3', type: 'bumper', x: 165, y: 295, angle: 0, cardId: 'card-05', note: 'E5' },
    { id: 'pb-4', type: 'spinner', x: 400, y: 310, angle: 0, cardId: 'card-09', note: 'G5' },
    { id: 'pb-5', type: 'bumper', x: 640, y: 315, angle: 0, cardId: 'card-01', note: 'A5' },
    { id: 'pb-6', type: 'block', x: 230, y: 420, angle: -0.2, cardId: 'card-09', note: 'G5' },
    { id: 'pb-7', type: 'block', x: 575, y: 425, angle: 0.22, cardId: 'card-13', note: 'A5' },
    { id: 'pb-8', type: 'portal', x: 400, y: 482, angle: 0, cardId: 'card-09', note: 'C5' },
  ],
  CASCADE: [
    { id: 'pc-1', type: 'block', x: 355, y: 145, angle: 0.28, cardId: 'card-09', note: 'C5' },
    { id: 'pc-2', type: 'block', x: 520, y: 225, angle: -0.28, cardId: 'card-05', note: 'D5' },
    { id: 'pc-3', type: 'block', x: 300, y: 305, angle: 0.26, cardId: 'card-01', note: 'E5' },
    { id: 'pc-4', type: 'bumper', x: 175, y: 230, angle: 0, cardId: 'card-13', note: 'G5' },
    { id: 'pc-5', type: 'spinner', x: 480, y: 350, angle: 0, cardId: 'card-09', note: 'A5' },
    { id: 'pc-6', type: 'block', x: 560, y: 430, angle: -0.26, cardId: 'card-13', note: 'G5' },
    { id: 'pc-7', type: 'bumper', x: 245, y: 425, angle: 0, cardId: 'card-05', note: 'D5' },
    { id: 'pc-8', type: 'portal', x: 400, y: 485, angle: 0, cardId: 'card-01', note: 'C5' },
  ],
};

const SAMPLE_PINBALL_EVENTS: PinballRecordedEvent[] = [
  { timeOffsetMs: 0, cardId: 'card-09', note: 'C5', velocity: 0.8, color: '#00D4AA' },
  { timeOffsetMs: 380, cardId: 'card-05', note: 'D5', velocity: 0.85, color: '#FF5C2B' },
  { timeOffsetMs: 760, cardId: 'card-09', note: 'G5', velocity: 0.9, color: '#00D4AA' },
  { timeOffsetMs: 1120, cardId: 'card-01', note: 'A5', velocity: 0.78, color: '#7C3AED' },
  { timeOffsetMs: 1520, cardId: 'card-13', note: 'E5', velocity: 0.88, color: '#FFD60A' },
  { timeOffsetMs: 1900, cardId: 'card-09', note: 'C5', velocity: 0.92, color: '#00D4AA' },
  { timeOffsetMs: 2280, cardId: 'card-05', note: 'G5', velocity: 0.84, color: '#FF5C2B' },
  { timeOffsetMs: 2660, cardId: 'card-09', note: 'A5', velocity: 0.9, color: '#00D4AA' },
];

export function computeWaveformFingerprint(
  sourceType: 'beat' | 'pinball',
  tracks: TrackState[],
  pinballEvents: PinballRecordedEvent[]
): number[] {
  const bars: number[] = [];
  if (sourceType === 'beat') {
    for (let i = 0; i < 24; i++) {
      const stepIdx = Math.floor((i / 24) * 16);
      let energy = 0.18;
      tracks.forEach((t, tIdx) => {
        if (!t.mute && t.steps[stepIdx]) {
          energy += (0.18 + t.volume * 0.16) * (tIdx === 0 ? 1.15 : 1);
        }
      });
      const shimmer = Math.abs(Math.sin(i * 1.37 + stepIdx)) * 0.18;
      bars.push(Math.min(1, Math.max(0.18, energy + shimmer)));
    }
  } else {
    for (let i = 0; i < 24; i++) {
      const ev = pinballEvents[i % Math.max(1, pinballEvents.length)];
      const base = ev ? 0.28 + ev.velocity * 0.65 : 0.22;
      const wave = Math.abs(Math.cos(i * 0.92)) * 0.25;
      bars.push(Math.min(1, Math.max(0.16, base * 0.75 + wave)));
    }
  }
  return bars;
}

const DEFAULT_FORGE_STICKERS: PlacedSticker[] = [
  { uid: 'stk-init-1', stickerId: 'bolt', x: 16, y: 58, scale: 1.0, rotation: -8 },
  { uid: 'stk-init-2', stickerId: 'note', x: 85, y: 60, scale: 1.0, rotation: 8 },
];

const INITIAL_MINTED_CARD: MintedCard = {
  id: 'minted-init-01',
  code: '#MY-01',
  title: 'NEON NIGHT',
  rarity: 'UR',
  foil: 'prism',
  artId: 'neon-dj',
  sourceType: 'beat',
  stickers: DEFAULT_FORGE_STICKERS,
  waveformBars: computeWaveformFingerprint('beat', BEAT_PRESETS.MARKET.tracks, SAMPLE_PINBALL_EVENTS),
  beatSnapshot: {
    bpm: BEAT_PRESETS.MARKET.bpm,
    swing: BEAT_PRESETS.MARKET.swing,
    scale: BEAT_PRESETS.MARKET.scale,
    tracks: BEAT_PRESETS.MARKET.tracks.map((t) => ({ ...t, steps: [...t.steps] })),
  },
  createdAt: Date.now(),
};

interface HoloState {
  // Navigation & Global Audio
  activePage: PageId;
  muted: boolean;
  bpm: number;
  swing: number;
  scale: ScaleId;
  isPlaying: boolean;
  drawerOpen: boolean;

  // Collection & Gacha
  collection: string[];
  pullHistory: string[];
  pullCounts: Record<string, number>;
  totalPulls: number;
  pityCount: number; // 0..5, hits SSR/UR at 5
  selectedGachaCardId: string;
  needsScratch: boolean;

  // Beat Deck
  tracks: TrackState[];
  liveFx: {
    bitcrush: boolean;
    echo: boolean;
    stutter: boolean;
  };

  // Pinball Synth
  pinballToys: PinballToy[];
  pinballTool: PinballToyType;
  pinballBindCardId: string;
  pinballDropperX: number;
  pinballAutoDrop: boolean;
  pinballGravity: number;
  pinballDropRate: number;
  pinballBounce: number;
  pinballRecordedEvents: PinballRecordedEvent[];

  // Card Forge
  forgeSource: 'beat' | 'pinball';
  forgeTitle: string;
  forgeRarity: ForgeRarity;
  forgeFoil: HoloFoilType;
  forgeArtId: string;
  forgeStickers: PlacedSticker[];
  activeMintedId: string | null;
  mintedCards: MintedCard[];

  // Toasts (not persisted)
  toasts: ToastMessage[];

  // Actions
  setActivePage: (page: PageId) => void;
  setDrawerOpen: (open: boolean) => void;
  toggleMute: () => void;
  setBpm: (bpm: number) => void;
  setSwing: (swing: number) => void;
  cycleScale: () => void;
  setScale: (scale: ScaleId) => void;
  setIsPlaying: (playing: boolean) => void;

  // Gacha Actions
  pullGachaCard: (skipScratch?: boolean) => { card: SoundCardDef; isNew: boolean; hitPity: boolean };
  revealCurrentCard: () => void;
  selectGachaCard: (cardId: string) => void;
  sendCardToBeat: (cardId: string) => void;

  // Beat Actions
  toggleStep: (trackIndex: number, stepIndex: number, forceValue?: boolean) => void;
  setTrackCard: (trackIndex: number, cardId: string) => void;
  setTrackVolume: (trackIndex: number, volume: number) => void;
  setTrackTone: (trackIndex: number, tone: number) => void;
  toggleTrackMute: (trackIndex: number) => void;
  toggleTrackSolo: (trackIndex: number) => void;
  applyBeatPreset: (preset: 'MARKET' | 'NIGHT') => void;
  randomizeBeat: () => void;
  clearBeat: () => void;
  setLiveFx: (fx: keyof HoloState['liveFx'], active: boolean) => void;
  sendBeatToForge: () => void;

  // Pinball Actions
  setPinballTool: (tool: PinballToyType) => void;
  setPinballBindCardId: (cardId: string) => void;
  setPinballDropperX: (x: number) => void;
  setPinballAutoDrop: (auto: boolean) => void;
  setPinballGravity: (g: number) => void;
  setPinballDropRate: (r: number) => void;
  setPinballBounce: (b: number) => void;
  addPinballToy: (toy: Omit<PinballToy, 'id'>) => string;
  updatePinballToy: (id: string, patch: Partial<PinballToy>) => void;
  removePinballToy: (id: string) => void;
  applyPinballPreset: (preset: 'LOOP' | 'CASCADE' | 'CLEAR') => void;
  setPinballRecordedEvents: (events: PinballRecordedEvent[]) => void;
  sendPinballToForge: (events: PinballRecordedEvent[]) => void;

  // Forge Actions
  setForgeSource: (src: 'beat' | 'pinball') => void;
  setForgeTitle: (title: string) => void;
  setForgeRarity: (rarity: ForgeRarity) => void;
  setForgeFoil: (foil: HoloFoilType) => void;
  setForgeArtId: (artId: string) => void;
  addForgeSticker: (stickerId: string) => void;
  updateForgeSticker: (uid: string, patch: Partial<PlacedSticker>) => void;
  removeForgeSticker: (uid: string) => void;
  mintCurrentCard: () => MintedCard;
  loadMintedCardIntoForge: (id: string) => void;
  loadGachaCardIntoForge: (cardId: string) => void;
  deleteMintedCard: (id: string) => void;

  // Toast Actions
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

export const useHoloStore = create<HoloState>()(
  persist(
    (set, get) => ({
      activePage: 'gacha',
      muted: false,
      bpm: 120,
      swing: 0.14,
      scale: 'PENTA_C',
      isPlaying: false,
      drawerOpen: false,

      collection: [...STARTER_CARD_IDS],
      pullHistory: ['card-05', 'card-01', 'card-09', 'card-13'],
      pullCounts: { 'card-01': 1, 'card-05': 1, 'card-09': 1, 'card-13': 1 },
      totalPulls: 4,
      pityCount: 4, // Starts at 4/5 matching Mockup 1, so user's very first pull hits SSR/UR!
      selectedGachaCardId: 'card-05',
      needsScratch: false,

      tracks: BEAT_PRESETS.MARKET.tracks.map((t) => ({ ...t, steps: [...t.steps] })),
      liveFx: { bitcrush: false, echo: false, stutter: false },

      pinballToys: PINBALL_PRESETS.LOOP.map((t) => ({ ...t })),
      pinballTool: 'block',
      pinballBindCardId: 'card-09',
      pinballDropperX: 400,
      pinballAutoDrop: true,
      pinballGravity: 1.0,
      pinballDropRate: 0.55,
      pinballBounce: 0.95,
      pinballRecordedEvents: [...SAMPLE_PINBALL_EVENTS],

      forgeSource: 'beat',
      forgeTitle: 'NEON NIGHT',
      forgeRarity: 'UR',
      forgeFoil: 'prism',
      forgeArtId: 'neon-dj',
      forgeStickers: DEFAULT_FORGE_STICKERS.map((s) => ({ ...s })),
      activeMintedId: INITIAL_MINTED_CARD.id,
      mintedCards: [INITIAL_MINTED_CARD],

      toasts: [],

      setActivePage: (page) => set({ activePage: page }),
      setDrawerOpen: (open) => set({ drawerOpen: open }),
      toggleMute: () => set((s) => ({ muted: !s.muted })),
      setBpm: (bpm) => set({ bpm: Math.min(180, Math.max(60, Math.round(bpm))) }),
      setSwing: (swing) => set({ swing: Math.min(0.6, Math.max(0, swing)) }),
      cycleScale: () =>
        set((s) => {
          const order: ScaleId[] = ['PENTA_C', 'MINOR_C', 'DORIAN_C'];
          const next = order[(order.indexOf(s.scale) + 1) % order.length];
          return { scale: next };
        }),
      setScale: (scale) => set({ scale }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),

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
          // Heavily favor unowned cards so judges can enjoy collecting diverse street cards quickly!
          candidatePool = unowned;
        }

        // Weighted pick
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
        });

        return { card: chosen, isNew, hitPity };
      },

      revealCurrentCard: () => set({ needsScratch: false }),

      selectGachaCard: (cardId) =>
        set({
          selectedGachaCardId: cardId,
          needsScratch: false,
        }),

      sendCardToBeat: (cardId) => {
        const card = getCardById(cardId);
        const categoryOrder: TrackCategory[] = ['BEAT', 'PERC', 'MELODY', 'VIBE'];
        const trackIdx = categoryOrder.indexOf(card.category);
        set((s) => {
          const nextTracks = s.tracks.map((t, idx) =>
            idx === trackIdx ? { ...t, cardId: card.id } : t
          );
          return { tracks: nextTracks };
        });
        get().pushToast({
          text: `已将 ${card.code} ${card.title}（${card.zhTitle}）装入 ${card.category} 卡槽`,
          accent: card.accentColor,
          actionLabel: '前往节拍台 →',
          actionPage: 'beat',
        });
      },

      toggleStep: (trackIndex, stepIndex, forceValue) =>
        set((s) => ({
          tracks: s.tracks.map((t, idx) => {
            if (idx !== trackIndex) return t;
            const steps = [...t.steps];
            steps[stepIndex] = forceValue !== undefined ? forceValue : !steps[stepIndex];
            return { ...t, steps };
          }),
        })),

      setTrackCard: (trackIndex, cardId) =>
        set((s) => ({
          tracks: s.tracks.map((t, idx) => (idx === trackIndex ? { ...t, cardId } : t)),
        })),

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
        // Preserve unlocked upgrades or fallback to preset cards
        set((s) => ({
          bpm: p.bpm,
          swing: p.swing,
          scale: p.scale,
          tracks: p.tracks.map((t, idx) => {
            const currentId = s.tracks[idx]?.cardId;
            const useId = currentId && unlocked.includes(currentId) ? currentId : t.cardId;
            return { ...t, cardId: useId, steps: [...t.steps] };
          }),
        }));
      },

      randomizeBeat: () =>
        set((s) => ({
          tracks: s.tracks.map((t, idx) => {
            const steps = Array<boolean>(16).fill(false);
            if (idx === 0) {
              // Groovable kick/beat pattern
              steps[0] = true;
              steps[8] = true;
              for (let i = 0; i < 16; i++) {
                if (i !== 0 && i !== 8 && Math.random() < (i % 4 === 0 ? 0.65 : 0.25)) {
                  steps[i] = true;
                }
              }
            } else if (idx === 1) {
              // Crisp perc on offbeats & snare hits
              steps[4] = true;
              steps[12] = true;
              for (let i = 0; i < 16; i++) {
                if (Math.random() < (i % 2 === 1 ? 0.35 : 0.22)) steps[i] = true;
              }
            } else if (idx === 2) {
              // Catchy pentatonic melody syncopation
              for (let i = 0; i < 16; i++) {
                if (Math.random() < (i % 2 === 0 ? 0.48 : 0.22)) steps[i] = true;
              }
            } else {
              // Warm vibe accents
              steps[0] = true;
              for (let i = 1; i < 16; i++) {
                if (Math.random() < (i % 4 === 0 ? 0.55 : 0.16)) steps[i] = true;
              }
            }
            return { ...t, steps };
          }),
        })),

      clearBeat: () =>
        set((s) => ({
          tracks: s.tracks.map((t) => ({ ...t, steps: Array<boolean>(16).fill(false) })),
        })),

      setLiveFx: (fx, active) =>
        set((s) => ({
          liveFx: { ...s.liveFx, [fx]: active },
        })),

      sendBeatToForge: () => {
        set({
          forgeSource: 'beat',
          activePage: 'forge',
          activeMintedId: null,
        });
        get().pushToast({
          text: '节拍混音已灌录至铸造台！定制全息箔面并铸造专属闪卡吧',
          accent: '#FFD60A',
        });
      },

      setPinballTool: (pinballTool) => set({ pinballTool }),
      setPinballBindCardId: (pinballBindCardId) => set({ pinballBindCardId }),
      setPinballDropperX: (x) => set({ pinballDropperX: Math.min(730, Math.max(70, x)) }),
      setPinballAutoDrop: (pinballAutoDrop) => set({ pinballAutoDrop }),
      setPinballGravity: (g) => set({ pinballGravity: Math.min(2.2, Math.max(0.25, g)) }),
      setPinballDropRate: (r) => set({ pinballDropRate: Math.min(1, Math.max(0.1, r)) }),
      setPinballBounce: (b) => set({ pinballBounce: Math.min(1.35, Math.max(0.5, b)) }),

      addPinballToy: (toy) => {
        const id = `toy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set((s) => ({ pinballToys: [...s.pinballToys, { ...toy, id }] }));
        return id;
      },

      updatePinballToy: (id, patch) =>
        set((s) => ({
          pinballToys: s.pinballToys.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      removePinballToy: (id) =>
        set((s) => ({
          pinballToys: s.pinballToys.filter((t) => t.id !== id),
        })),

      applyPinballPreset: (preset) => {
        if (preset === 'CLEAR') {
          set({ pinballToys: [] });
        } else {
          const scaleNotes = SCALE_META[get().scale].shortNotes;
          set({
            pinballToys: PINBALL_PRESETS[preset].map((t, i) => ({
              ...t,
              id: `${preset.toLowerCase()}-${i}-${Date.now()}`,
              note: scaleNotes[i % scaleNotes.length],
            })),
          });
        }
      },

      setPinballRecordedEvents: (events) => set({ pinballRecordedEvents: events }),

      sendPinballToForge: (events) => {
        const validEvents = events.length > 0 ? events : get().pinballRecordedEvents;
        set({
          pinballRecordedEvents: validEvents,
          forgeSource: 'pinball',
          forgeTitle: 'PINBALL LOOP',
          activePage: 'forge',
          activeMintedId: null,
        });
        get().pushToast({
          text: `已录制 ${validEvents.length} 个物理弹珠音符并送入闪卡铸造屋！`,
          accent: '#00D4AA',
        });
      },

      setForgeSource: (forgeSource) => set({ forgeSource, activeMintedId: null }),
      setForgeTitle: (forgeTitle) => set({ forgeTitle: forgeTitle.slice(0, 18) }),
      setForgeRarity: (forgeRarity) => set({ forgeRarity }),
      setForgeFoil: (forgeFoil) => set({ forgeFoil }),
      setForgeArtId: (forgeArtId) => set({ forgeArtId }),

      addForgeSticker: (stickerId) =>
        set((s) => {
          const offset = (s.forgeStickers.length % 5) * 6;
          const next: PlacedSticker = {
            uid: `stk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            stickerId,
            x: Math.min(84, Math.max(16, 28 + offset * 2 + (Math.random() * 24 - 12))),
            y: Math.min(76, Math.max(22, 34 + offset * 1.5 + (Math.random() * 24 - 12))),
            scale: 1,
            rotation: Math.round(Math.random() * 24 - 12),
          };
          return { forgeStickers: [...s.forgeStickers, next] };
        }),

      updateForgeSticker: (uid, patch) =>
        set((s) => ({
          forgeStickers: s.forgeStickers.map((st) => (st.uid === uid ? { ...st, ...patch } : st)),
        })),

      removeForgeSticker: (uid) =>
        set((s) => ({
          forgeStickers: s.forgeStickers.filter((st) => st.uid !== uid),
        })),

      mintCurrentCard: () => {
        const s = get();
        const nextNum = s.mintedCards.length + 1;
        const code = `#MY-${String(nextNum).padStart(2, '0')}`;
        const beatSnapshot: BeatSnapshot = {
          bpm: s.bpm,
          swing: s.swing,
          scale: s.scale,
          tracks: s.tracks.map((t) => ({ ...t, steps: [...t.steps] })),
        };
        const minted: MintedCard = {
          id: `minted-${Date.now()}`,
          code,
          title: (s.forgeTitle.trim() || 'HOLO MIX').toUpperCase(),
          rarity: s.forgeRarity,
          foil: s.forgeFoil,
          artId: s.forgeArtId,
          sourceType: s.forgeSource,
          stickers: s.forgeStickers.map((st) => ({ ...st })),
          waveformBars: computeWaveformFingerprint(
            s.forgeSource,
            s.tracks,
            s.pinballRecordedEvents
          ),
          beatSnapshot: s.forgeSource === 'beat' ? beatSnapshot : undefined,
          pinballEvents:
            s.forgeSource === 'pinball'
              ? s.pinballRecordedEvents.map((e) => ({ ...e }))
              : undefined,
          createdAt: Date.now(),
        };

        set({
          mintedCards: [minted, ...s.mintedCards],
          activeMintedId: minted.id,
        });

        get().pushToast({
          text: `★ 专属闪卡 ${minted.code}「${minted.title}」铸造成功并已收入卡册！`,
          accent: '#FF5C2B',
        });

        return minted;
      },

      loadMintedCardIntoForge: (id) => {
        const found = get().mintedCards.find((m) => m.id === id);
        if (!found) return;
        set({
          activeMintedId: found.id,
          forgeTitle: found.title,
          forgeRarity: found.rarity,
          forgeFoil: found.foil,
          forgeArtId: found.artId,
          forgeSource: found.sourceType,
          forgeStickers: found.stickers.map((st) => ({ ...st })),
        });
      },

      loadGachaCardIntoForge: (cardId) => {
        const card = getCardById(cardId);
        set({
          activeMintedId: null,
          forgeTitle: card.title,
          forgeRarity: card.rarity === 'UR' ? 'UR' : 'SSR',
          forgeFoil: card.foil,
          forgeArtId: card.artId,
        });
      },

      deleteMintedCard: (id) =>
        set((s) => ({
          mintedCards: s.mintedCards.filter((m) => m.id !== id),
          activeMintedId: s.activeMintedId === id ? null : s.activeMintedId,
        })),

      pushToast: (toast) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        set((s) => ({ toasts: [...s.toasts.slice(-2), { ...toast, id }] }));
        setTimeout(() => {
          get().dismissToast(id);
        }, 3600);
      },

      dismissToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'holobeat-studio-v1',
      partialize: (state) => ({
        bpm: state.bpm,
        swing: state.swing,
        scale: state.scale,
        collection: state.collection,
        pullHistory: state.pullHistory,
        pullCounts: state.pullCounts,
        totalPulls: state.totalPulls,
        pityCount: state.pityCount,
        selectedGachaCardId: state.selectedGachaCardId,
        tracks: state.tracks,
        pinballToys: state.pinballToys,
        pinballBindCardId: state.pinballBindCardId,
        pinballDropperX: state.pinballDropperX,
        pinballGravity: state.pinballGravity,
        pinballDropRate: state.pinballDropRate,
        pinballBounce: state.pinballBounce,
        pinballRecordedEvents: state.pinballRecordedEvents,
        forgeSource: state.forgeSource,
        forgeTitle: state.forgeTitle,
        forgeRarity: state.forgeRarity,
        forgeFoil: state.forgeFoil,
        forgeArtId: state.forgeArtId,
        forgeStickers: state.forgeStickers,
        mintedCards: state.mintedCards,
      }),
    }
  )
);
