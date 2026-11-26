export type PageId = 'gacha' | 'beat' | 'pinball' | 'forge';

export type TrackCategory = 'BEAT' | 'PERC' | 'MELODY' | 'VIBE';

export type Rarity = 'N' | 'R' | 'SR' | 'SSR' | 'UR' | 'LTD';

export type ForgeRarity = 'SSR' | 'UR' | 'LTD';

export type HoloFoilType = 'prism' | 'spark' | 'cyber' | 'chrome' | 'gold';

export type ScaleId = 'PENTA_C' | 'MINOR_C' | 'DORIAN_C';

export type BeatPresetId = 'MARKET' | 'ARCADE' | 'NIGHT' | 'LOFI' | 'RAIN' | 'LION';

export type BeatPhraseId = 'A' | 'B';

export type BeatPhraseLoop = 'AB' | 'A' | 'B';

export type VariationKind =
  | 'density_up'
  | 'density_down'
  | 'accent_groove'
  | 'breathing_space'
  | 'call_response';

export type PinballMode = 'free' | 'show';

export type PinballPresetId = 'LOOP' | 'CASCADE' | 'CALL_RESPONSE';

export type LiveFxMode = 'latch' | 'momentary';

export type MotionShapeMotif = 'rounded-square' | 'ring' | 'diamond-star' | 'cloud-wave';

export interface LiveFxConfig {
  bitcrush: boolean;
  echo: boolean;
  stutter: boolean;
}

export interface StepCell {
  on: boolean;
  /** 0.35..1.0 expressive velocity */
  velocity: number;
  /** -4..+4 scale degree offset (used by MELODY / pitched synth) */
  pitchOffset: number;
  /** 1 = 16th, 2 = 8th, 4 = quarter */
  lengthSteps: 1 | 2 | 4;
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
  /** 艺术音色气质标签（0-100 创作风格倾向，非真实声学仪器测量值） */
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
  /**
   * 32-step boolean trigger array: indices 0..15 = Phrase A (Bar 1), 16..31 = Phrase B (Bar 2).
   * Legacy 16-step arrays are automatically migrated via normalizeTrackState.
   */
  steps: boolean[];
  /** Per-step accent flag (length 32) */
  accents?: boolean[];
  /** Expressive per-step velocity / pitchOffset / duration cells (length 32) */
  stepCells?: StepCell[];
  volume: number; // 0..1
  tone: number; // 0..1
  mute: boolean;
  solo: boolean;
}

export interface BeatSnapshot {
  bpm: number;
  swing: number;
  scale: ScaleId;
  bars: 1 | 2;
  activePhraseLoop?: BeatPhraseLoop;
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
 * Canonical Unified Music Event shared by Live Beat, Holo Motion, Choreographed Pinball Show,
 * Real Audio Waveform Extraction, and Offline WAV / Motion Card Export.
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
  stepIndex?: number; // 0..31
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
  schemaVersion?: number;
  rendererVersion?: string;
  assetVersion?: string;
  /** Deterministic hash of musical content + DSP config (independent of title/stickers) */
  contentSignature?: string;
  /** Reproducible seed for procedural noise voices */
  soundSeed?: number;
  title?: string;
  sourceType: 'beat' | 'pinball';
  isDemo?: boolean;
  capturedAt: number;
  /** Pure musical loop/phrase length in ms (excluding reverb/echo tail) */
  durationMs: number;
  /** Reverb/echo acoustic tail duration in ms */
  tailMs?: number;
  bpm: number;
  swing?: number;
  scale: ScaleId;
  bars?: 1 | 2;
  beatSnapshot?: BeatSnapshot;
  pinballEvents?: PinballRecordedEvent[];
  pinballScene?: PinballSceneSnapshot;
  events: PerformanceEvent[];
}

export interface RenderArtifact {
  contentHash?: string;
  pcmHash?: string;
  fxVersion?: string;
  audioAssetVersion?: string;
  channelCount?: number;
  cacheStatus?: 'hit' | 'stored' | 'unavailable';
  cacheKey: string;
  snapshotId: string;
  contentSignature: string;
  rendererVersion: string;
  wavBlob: Blob;
  waveformBars: number[];
  durationSec: number;
  musicDurationSec: number;
  tailSec: number;
  sampleRate: number;
  peakAmplitude: number;
  cachedAt: number;
}

export interface PlacedSticker {
  uid: string;
  stickerId: string;
  x: number; // normalized 0..100 %
  y: number; // normalized 0..100 %
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

/**
 * Frozen atomic transaction payload created the instant the user clicks "压印入册".
 * All async rendering, idempotency checks, persistence, and completion ceremony consume this
 * frozen request — never re-reading mutable global forgeDraft state!
 */
export interface MintRequest {
  requestId: string;
  snapshot: CompositionSnapshot;
  title: string;
  rarity: ForgeRarity;
  foil: HoloFoilType;
  artId: string;
  stickers: PlacedSticker[];
  remixOrigin: RemixOrigin | null;
  contentHash: Promise<string>;
  assetVersion: string;
  createdAt: number;
}

export interface StorageSaveResult {
  status: 'primary' | 'fallback' | 'failed';
  storageLabel: string;
  error?: string;
}

export interface MintedCard {
  id: string; // Stable UUID
  schemaVersion?: number;
  assetVersion?: string;
  rendererVersion?: string;
  serialNumber: number; // Strictly monotonic integer
  code: string; // e.g. "#MY-01" or "#示例-01"
  requestId?: string;
  contentHash?: string;
  designVersion?: number;
  idempotencyKey: string; // Full contentHash (musical snapshot + title + rarity + foil + art + stickers)
  title: string;
  rarity: ForgeRarity;
  foil: HoloFoilType;
  artId: string;
  sourceType: 'beat' | 'pinball';
  isDemo?: boolean;
  stickers: PlacedSticker[];
  waveformBars: number[];
  waveformIsRealPcm?: boolean;
  audioCacheKey?: string;
  audioFingerprintSeed: number;
  snapshot: CompositionSnapshot;
  parentCardId?: string;
  parentCode?: string;
  parentTitle?: string;
  lineageDepth: number; // 0 = Original, 1 = Remix Gen 1, ...
  storageStatus?: 'primary' | 'fallback';
  createdAt: number;
}

export interface PinballQuantizePreview {
  sourceEvents: PinballRecordedEvent[];
  selectedStartMs: number;
  selectedEndMs: number;
  targetBars: 1 | 2;
  ghostSteps: boolean[][]; // 4 x 32 preview matrix
  trackCardIds: (string | null)[];
  totalSourceEvents: number;
  cells: (StepCell | null)[][];
  grid: '1/16';
  movedCount: number;
  velocityChangedCount: number;
  pitchMappedCount: number;
  lengthChangedCount: number;
  invalidEvents?: number;
  selectedSourceEvents: number;
  mappedCount: number;
  mergedCollisions: number;
  avgShiftMs: number;
  maxShiftMs: number;
  durationMs: number;
  bpm: number;
}

export interface SharedCardTransition {
  cardId: string;
  targetPage: PageId;
  targetTrackIndex?: number;
  sourceRect?: { x: number; y: number; w: number; h: number };
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
  schema: 'holobeat.project.v2' | 'holobeat.project.v3';
  exportedAt: number;
  assetVersion?: string;
  rendererVersion?: string;
  kind: 'minted-card' | 'forge-draft';
  card?: MintedCard;
  draft?: ForgeDraft;
}

export interface MigrationReport {
  migrated: boolean;
  backedUp: boolean;
  fromVersion: number;
  toVersion: number;
  cardCount: number;
  maxSerial: number;
  verifiedPlayable: boolean;
  warnings: string[];
}

export interface ToastMessage {
  id: string;
  text: string;
  accent?: string;
  actionLabel?: string;
  actionPage?: PageId;
}
