import type { CompositionSnapshot, PlacedSticker } from '../05_web_app/src/types/holo.ts';

/** Hash JSON data independent of property insertion order, with six decimal places of precision. */
export async function contentDigest(value: unknown): Promise<string> {
  function normalize(input: unknown): unknown {
    if (typeof input === 'number') {
      if (!Number.isFinite(input)) throw new Error('Non-finite content value');
      return Number(input.toFixed(6));
    }
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === 'object') {
      return Object.fromEntries(Object.entries(input)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([k, v]) => [k, normalize(v)]));
    }
    return input;
  }
  const data = new TextEncoder().encode(JSON.stringify(normalize(value)));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

export const CARD_DESIGN_VERSION = 1;

export function buildMintIdempotencyKey(params: {
  snapshot: CompositionSnapshot;
  title: string;
  rarity: string;
  foil: string;
  artId: string;
  stickers: PlacedSticker[];
  parentCardId?: string;
  assetVersion?: string;
  designVersion?: number;
}): Promise<string> {
  // Capture IDs and timestamps identify a recording operation, not its musical contents.
  const { id: _id, capturedAt: _time, events, pinballEvents, ...music } = params.snapshot;
  return contentDigest({
    snapshot: { ...music, events: events.map(({ id, ...ev }) => ev),
      pinballEvents: pinballEvents?.map(({ id, ...ev }) => ev) },
    title: params.title.normalize('NFC').trim(),
    rarity: params.rarity, foil: params.foil, artId: params.artId,
    stickers: params.stickers.map(({ uid, ...sticker }) => sticker),
    assetVersion: params.assetVersion,
    parentCardId: params.parentCardId,
    designVersion: params.designVersion ?? CARD_DESIGN_VERSION,
  });
}
