export type PageId = 'gacha' | 'beat' | 'pinball' | 'forge';

export type TrackCategory = 'BEAT' | 'PERC' | 'MELODY' | 'VIBE';

export type Rarity = 'N' | 'R' | 'SR' | 'SSR' | 'UR' | 'LTD';

export type ForgeRarity = 'SSR' | 'UR' | 'LTD';

export type HoloFoilType = 'prism' | 'spark' | 'cyber' | 'chrome' | 'gold';

export type ScaleId = 'PENTA_C' | 'MINOR_C' | 'DORIAN_C';

export type BeatPresetId = 'MARKET' | 'NIGHT' | 'LOFI';

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
  stats: {
    punch: number;
    shine: number;
    vibe: number;
  };
  storyZh: string;
  synthFormula: string;
  recommendedBpm: number;
  starter?: boolean;
}

export interface TrackState {
  category: TrackCategory;
  cardId: string;
  steps: boolean[];
  volume: number; // 0..1
  tone: number; // 0..1
  mute: boolean;
  solo: boolean;
}

export interface BeatSnapshot {
  bpm: number;
  swing: number;
  scale: ScaleId;
  tracks: TrackState[];
}

export type PinballToyType = 'block' | 'bumper' | 'spinner' | 'portal';

export interface PinballToy {
  id: string;
  type: PinballToyType;
  x: number; // logical arena coords 0..800
  y: number; // logical arena coords 0..520
  angle: number; // radians
  cardId: string;
  note: string;
}

export interface PinballRecordedEvent {
  timeOffsetMs: number;
  cardId: string;
  note: string;
  velocity: number;
  color: string;
}

export interface PlacedSticker {
  uid: string;
  stickerId: string;
  x: number; // 0..100 %
  y: number; // 0..100 %
  scale: number; // 0.5..2.0
  rotation: number; // degrees
}

export interface MintedCard {
  id: string;
  code: string;
  title: string;
  rarity: ForgeRarity;
  foil: HoloFoilType;
  artId: string;
  sourceType: 'beat' | 'pinball';
  stickers: PlacedSticker[];
  waveformBars: number[];
  beatSnapshot?: BeatSnapshot;
  pinballEvents?: PinballRecordedEvent[];
  createdAt: number;
}

export interface ToastMessage {
  id: string;
  text: string;
  accent?: string;
  actionLabel?: string;
  actionPage?: PageId;
}
