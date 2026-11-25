import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, '..', 'schema.sql');

export interface StoredCardRow {
  id: string;
  serial_number: number;
  code: string;
  idempotency_key: string;
  title: string;
  rarity: string;
  foil: string;
  art_id: string;
  source_type: string;
  is_demo: number;
  parent_card_id: string | null;
  parent_code: string | null;
  parent_title: string | null;
  lineage_depth: number;
  payload_json: string;
  created_at: number;
}

export class ArchiveDatabase {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      mkdirSync(path.dirname(dbPath), { recursive: true });
    }
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    const schemaSql = readFileSync(SCHEMA_PATH, 'utf-8');
    this.db.exec(schemaSql);
  }

  close() {
    this.db.close();
  }

  countCards(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS count FROM minted_cards').get() as {
      count: number;
    };
    return Number(row?.count ?? 0);
  }

  listCards(): unknown[] {
    const rows = this.db
      .prepare('SELECT payload_json FROM minted_cards ORDER BY created_at DESC')
      .all() as { payload_json: string }[];
    return rows.map((r) => JSON.parse(r.payload_json));
  }

  getCardById(id: string): unknown | null {
    const row = this.db
      .prepare('SELECT payload_json FROM minted_cards WHERE id = ?')
      .get(id) as { payload_json: string } | undefined;
    return row ? JSON.parse(row.payload_json) : null;
  }

  upsertCardIdempotent(card: {
    id: string;
    serialNumber: number;
    code: string;
    idempotencyKey: string;
    title: string;
    rarity: string;
    foil: string;
    artId: string;
    sourceType: string;
    isDemo?: boolean;
    parentCardId?: string;
    parentCode?: string;
    parentTitle?: string;
    lineageDepth: number;
    createdAt: number;
  }): { created: boolean; card: unknown } {
    const existing = this.db
      .prepare('SELECT payload_json FROM minted_cards WHERE idempotency_key = ? OR id = ?')
      .get(card.idempotencyKey, card.id) as { payload_json: string } | undefined;

    if (existing) {
      return { created: false, card: JSON.parse(existing.payload_json) };
    }

    this.db
      .prepare(
        `INSERT INTO minted_cards (
          id, serial_number, code, idempotency_key, title, rarity, foil, art_id,
          source_type, is_demo, parent_card_id, parent_code, parent_title,
          lineage_depth, payload_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        card.id,
        card.serialNumber,
        card.code,
        card.idempotencyKey,
        card.title,
        card.rarity,
        card.foil,
        card.artId,
        card.sourceType,
        card.isDemo ? 1 : 0,
        card.parentCardId ?? null,
        card.parentCode ?? null,
        card.parentTitle ?? null,
        card.lineageDepth ?? 0,
        JSON.stringify(card),
        card.createdAt
      );

    return { created: true, card };
  }

  deleteCard(id: string): boolean {
    const info = this.db.prepare('DELETE FROM minted_cards WHERE id = ?').run(id);
    return Number(info.changes ?? 0) > 0;
  }

  createShareLink(token: string, cardId: string): { token: string; cardId: string; createdAt: number } | null {
    const exists = this.getCardById(cardId);
    if (!exists) return null;
    const createdAt = Date.now();
    this.db
      .prepare('INSERT INTO share_links (token, card_id, revoked, created_at) VALUES (?, ?, 0, ?)')
      .run(token, cardId, createdAt);
    return { token, cardId, createdAt };
  }

  getSharedCard(token: string): { card: unknown; createdAt: number } | null {
    const row = this.db
      .prepare(
        `SELECT c.payload_json, s.created_at
         FROM share_links s
         JOIN minted_cards c ON c.id = s.card_id
         WHERE s.token = ? AND s.revoked = 0`
      )
      .get(token) as { payload_json: string; created_at: number } | undefined;
    if (!row) return null;
    return { card: JSON.parse(row.payload_json), createdAt: row.created_at };
  }

  revokeShareLink(token: string): boolean {
    const info = this.db
      .prepare('UPDATE share_links SET revoked = 1 WHERE token = ?')
      .run(token);
    return Number(info.changes ?? 0) > 0;
  }

  getLineage(cardId: string): { ancestors: unknown[]; children: unknown[] } {
    const ancestors: unknown[] = [];
    let currId: string | null = cardId;
    const visited = new Set<string>();

    while (currId && !visited.has(currId)) {
      visited.add(currId);
      const row = this.db
        .prepare('SELECT parent_card_id, payload_json FROM minted_cards WHERE id = ?')
        .get(currId) as { parent_card_id: string | null; payload_json: string } | undefined;
      if (!row) break;
      if (currId !== cardId) ancestors.push(JSON.parse(row.payload_json));
      currId = row.parent_card_id;
    }

    const childRows = this.db
      .prepare('SELECT payload_json FROM minted_cards WHERE parent_card_id = ? ORDER BY created_at DESC')
      .all(cardId) as { payload_json: string }[];

    return {
      ancestors,
      children: childRows.map((r) => JSON.parse(r.payload_json)),
    };
  }
}
