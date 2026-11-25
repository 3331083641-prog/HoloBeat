export type PageId = 'gacha' | 'beat' | 'pinball' | 'forge';

export type TrackCategory = 'BEAT' | 'PERC' | 'MELODY' | 'VIBE';

export type Rarity = 'N' | 'R' | 'SR' | 'SSR' | 'UR' | 'LTD';

export type ForgeRarity = 'SSR' | 'UR' | 'LTD';

export type HoloFoilType = 'prism' | 'spark' | 'cyber' | 'chrome' | 'gold';

export type ScaleId = 'PENTA_C' | 'MINOR_C' | 'DORIAN_C';

export type BeatPresetId = 'MARKET' | 'NIGHT' | 'LOFI' | 'RAIN' | 'LION';

export type PinballMode = 'free' | 'show';

export interface LiveFxConfig {
  bitcrush: boolean;
  echo: boolean;
  stutter: boolean;
}

export interface SoundCardDef {
  id: string;
  code: string;
  title: string;
  shortTitle: string;
  zhTitle: string;
  category: TrackCategory;
  rarity: Rarity;
  foil: HoloFoilType;
  accentColor: string;
  bgGradient: [string, string];
  artId: string;
  /** Artistic sonic character descriptors (0-100 style profile, not acoustic measurements) */
  stats: {
    punch: number;
    shine: number;
    vibe: number;
  };
  storyZh: string;
  pairingHintZh: string;
  synthFormula: string;
  recommendedBpm: number;
  starter?: boolean;
}

export interface TrackState {
  category: TrackCategory;
  cardId: string;
  steps: boolean[];
  /** Optional per-step high-velocity accent flags (Shift+Click / Right-Click) */
  accents?: boolean[];
  volume: number; // 0..1
  tone: number; // 0..1
  mute: boolean;
  solo: boolean;
}

export interface BeatSnapshot {
  bpm: number;
  swing: number;
  scale: ScaleId;
  bars: number;
  liveFx: LiveFxConfig;
  tracks: TrackState[];
}

export type PinballToyType = 'block' | 'bumper' | 'spinner' | 'portal';

export interface PinballToy {
  id: string;
  type: PinballToyType;
  x: number; // logical arena coords 0..800
  y: number; // logical arena coords 0..680
  angle: number; // radians
  cardId: string;
  note: string;
}

export interface PinballSceneSnapshot {
  toys: PinballToy[];
  dropperX: number;
  gravity: number;
  dropRate: number;
  bounce: number;
  scale: ScaleId;
}

export interface PinballRecordedEvent {
  id?: string;
  timeOffsetMs: number;
  durationMs?: number;
  cardId: string;
  note: string;
  velocity: number;
  color: string;
  sourceX?: number;
  sourceY?: number;
}

/**
 * Canonical Unified Music Event across Live Beat, Holo Motion, Choreographed Pinball Show,
 * Real Audio Fingerprint, and Offline WAV Export.
 */
export interface PerformanceEvent {
  id: string;
  timeOffsetMs: number;
  durationMs: number;
  pitch: string;
  velocity: number; // 0..1
  cardId: string;
  trackCategory: TrackCategory;
  trackIndex: number; // 0..3
  stepIndex?: number; // 0..15 (or 0..31 for 2-bar)
  tone?: number;
  sourceX?: number;
  sourceY?: number;
  color: string;
}

/**
 * Immutable frozen musical work snapshot captured at REC / PERFORM / MINT time.
 * Subsequent edits in BEAT or PINBALL never mutate an already captured snapshot.
 */
export interface CompositionSnapshot {
  id: string;
  sourceType: 'beat' | 'pinball';
  isDemo?: boolean;
  capturedAt: number;
  durationMs: number;
  bpm: number;
  scale: ScaleId;
  beatSnapshot?: BeatSnapshot;
  pinballEvents?: PinballRecordedEvent[];
  pinballScene?: PinballSceneSnapshot;
  events: PerformanceEvent[];
}

export interface PlacedSticker {
  uid: string;
  stickerId: string;
  x: number; // 0..100 %
  y: number; // 0..100 %
  scale: number; // 0.5..2.0
  rotation: number; // degrees
  zIndex?: number;
}

export interface RemixOrigin {
  parentCardId: string;
  parentCode: string;
  parentTitle: string;
  lineageDepth: number;
}

export interface ForgeDraft {
  snapshot: CompositionSnapshot | null;
  sourceType: 'beat' | 'pinball';
  title: string;
  rarity: ForgeRarity;
  foil: HoloFoilType;
  artId: string;
  stickers: PlacedSticker[];
  remixOrigin?: RemixOrigin | null;
}

export interface MintedCard {
  id: string; // Stable UUID
  serialNumber: number; // Strictly monotonic integer — deleting never duplicates codes
  code: string; // e.g. "#MY-01" or "#DEMO-01"
  idempotencyKey: string;
  title: string;
  rarity: ForgeRarity;
  foil: HoloFoilType;
  artId: string;
  sourceType: 'beat' | 'pinball';
  isDemo?: boolean;
  stickers: PlacedSticker[];
  waveformBars: number[];
  waveformIsRealPcm?: boolean;
  audioFingerprintSeed: number;
  snapshot: CompositionSnapshot;
  parentCardId?: string;
  parentCode?: string;
  parentTitle?: string;
  lineageDepth: number; // 0 = Original, 1 = Remix Gen 1, ...
  createdAt: number;
}

export interface PinballQuantizePreview {
  sourceEvents: PinballRecordedEvent[];
  ghostSteps: boolean[][]; // 4 x 16 preview matrix
  trackCardIds: (string | null)[];
  mappedCount: number;
  durationMs: number;
  bpm: number;
}

export interface SharedCardTransition {
  cardId: string;
  targetPage: PageId;
  targetTrackIndex?: number;
  startedAt: number;
}

export interface OnboardingProgress {
  dismissed: boolean;
  pulledCard: boolean;
  sentToBeat: boolean;
  editedOrPlayedBeat: boolean;
  watchedPinballShow: boolean;
  mintedFirstCard: boolean;
}

export interface HoloBeatProjectFile {
  schema: 'holobeat.project.v2';
  exportedAt: number;
  kind: 'minted-card' | 'forge-draft';
  card?: MintedCard;
  draft?: ForgeDraft;
}

export interface ToastMessage {
  id: string;
  text: string;
  accent?: string;
  actionLabel?: string;
  actionPage?: PageId;
}
