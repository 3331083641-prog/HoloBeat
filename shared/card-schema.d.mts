import type { MintedCard, ForgeDraft, CompositionSnapshot, HoloBeatProjectFile } from '../05_web_app/src/types/holo.ts';
interface Schema<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: { issues: unknown[] } };
}
export function createSchemas(zod: object): {
  MintedCardSchema: Schema<MintedCard>;
  ForgeDraftSchema: Schema<ForgeDraft>;
  ProjectSchema: Schema<HoloBeatProjectFile>;
  SnapshotSchema: Schema<CompositionSnapshot>;
};
