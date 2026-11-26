import { randomUUID } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { isDeepStrictEqual } from 'node:util';
import { buildMintIdempotencyKey } from '../../shared/card-content.ts';
import type { MintedCard } from '../../05_web_app/src/types/holo.ts';

const SCHEMA_VERSION = 2;
const schemaSql = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');

export class ArchiveError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function decode(payload: unknown): MintedCard {
  try {
    const parsed: unknown = JSON.parse(String(payload));
    if (!parsed || typeof parsed !== 'object' || !('id' in parsed)) throw Error();
    return parsed as MintedCard;
  } catch {
    throw new ArchiveError(500, 'CORRUPT_ARCHIVE', 'Invalid card payload in archive');
  }
}

// Device persistence and waveform caches can change after the creative work is frozen.
function archivedWork(card: MintedCard) {
  const { storageStatus, waveformBars, waveformIsRealPcm, audioCacheKey, contentHash, ...work } = card;
  return work;
}

function isArchiveRetry(stored: MintedCard, submitted: MintedCard) {
  if (stored.contentHash && submitted.contentHash && stored.contentHash !== submitted.contentHash) return false;
  const existing = archivedWork(stored);
  const incoming = archivedWork(submitted);
  if (isDeepStrictEqual(existing, incoming)) return true;

  // The original V3 API stripped these specific snapshot/event fields when saving a row.
  // Compare exactly what that writer could persist. Preserve its original archive bytes.
  if (stored.schemaVersion !== 3 || stored.contentHash || !stored.snapshot ||
      stored.snapshot.capturedAt !== undefined || !incoming.snapshot) return false;
  const { capturedAt, rendererVersion, assetVersion, soundSeed, pinballEvents, pinballScene,
    events, ...oldSnapshot } = incoming.snapshot;
  const oldEvents = events.map(({ sourceX, sourceY, color, ...event }) => event);
  return isDeepStrictEqual(existing, { ...incoming, snapshot: { ...oldSnapshot, events: oldEvents } });
}

export class ArchiveDatabase {
  private db: DatabaseSync;
  private closed = false;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(dbPath);
    try {
      if (dbPath !== ':memory:' && process.platform !== 'win32') chmodSync(dbPath, 0o600);
      this.db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000');
      if (this.db.prepare('PRAGMA quick_check').get()?.quick_check !== 'ok') throw Error('SQLite integrity check failed');
      const version = Number(this.db.prepare('PRAGMA user_version').get()?.user_version);
      if (version > SCHEMA_VERSION) throw Error('Unsupported future archive schema');
      if (version < SCHEMA_VERSION) this.migrate(dbPath);
      // This single-process archive uses short transactions. Keep the default rollback
      // journal so copying a closed archive needs only one file.
    } catch (error) {
      this.close();
      throw error;
    }
  }

  private migrate(dbPath: string) {
    const existing = this.db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='minted_cards'").get();
    if (existing && dbPath !== ':memory:') {
      const backup = dbPath + '.pre-v2-' + randomUUID() + '.sqlite';
      this.db.prepare('VACUUM INTO ?').run(backup);
      if (process.platform !== 'win32') chmodSync(backup, 0o600);
    }
    this.transaction(() => {
      if (Number(this.db.prepare('PRAGMA user_version').get()?.user_version) === SCHEMA_VERSION) return;
      const columns = this.db.prepare('PRAGMA table_info(share_links)').all();
      if (columns.length && !columns.some(c => c.name === 'expires_at'))
        this.db.exec('ALTER TABLE share_links ADD COLUMN expires_at INTEGER');
      this.db.exec(schemaSql);
      const invalid = this.db.prepare(`SELECT 1 FROM minted_cards c LEFT JOIN minted_cards p ON p.id=c.parent_card_id
        WHERE (c.parent_card_id IS NULL AND c.lineage_depth != 0) OR (c.parent_card_id IS NOT NULL AND
        (p.id IS NULL OR p.lineage_depth+1 != c.lineage_depth OR p.title IS NOT c.parent_title OR p.code IS NOT c.parent_code)) LIMIT 1`).get();
      if (invalid || this.db.prepare('PRAGMA foreign_key_check').get())
        throw Error('Archive contains unresolved historical references. Repair a copy before migration.');
      this.db.exec('PRAGMA user_version=2');
    });
  }

  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const value = work();
      this.db.exec('COMMIT');
      return value;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    if (!this.closed) { this.db.close(); this.closed = true; }
  }

  countCards() { return Number(this.db.prepare('SELECT COUNT(*) AS n FROM minted_cards').get()?.n); }
  listCards() {
    return this.db.prepare('SELECT payload_json FROM minted_cards ORDER BY created_at DESC').all().map(row => decode(row.payload_json));
  }
  getCardById(id: string) {
    const row = this.db.prepare('SELECT payload_json FROM minted_cards WHERE id=?').get(id);
    return row ? decode(row.payload_json) : null;
  }

  async upsertCardIdempotent(card: MintedCard) {
    if (card.contentHash !== undefined && card.contentHash !== await buildMintIdempotencyKey(card)) {
      throw new ArchiveError(400, 'CONTENT_HASH_MISMATCH', 'Content digest does not match this work');
    }
    return this.transaction(() => {
      const rows = this.db.prepare(`SELECT payload_json FROM minted_cards WHERE id=? OR idempotency_key=?
        OR json_extract(payload_json,'$.requestId')=? OR json_extract(payload_json,'$.contentHash')=?`)
        .all(card.id, card.idempotencyKey, card.requestId ?? null, card.contentHash ?? null);
      if (rows.length) {
        const existing = decode(rows[0].payload_json);
        if (rows.length === 1 && isArchiveRetry(existing, card)) return { created: false, card: existing };
        throw new ArchiveError(409, 'ARCHIVE_CONFLICT', 'Request, content or card identity already exists with different data');
      }
      this.db.prepare(`INSERT INTO minted_cards(id,serial_number,code,idempotency_key,title,rarity,foil,art_id,
        source_type,is_demo,parent_card_id,parent_code,parent_title,lineage_depth,payload_json,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(card.id,card.serialNumber,card.code,card.idempotencyKey,card.title,card.rarity,card.foil,card.artId,
          card.sourceType,Number(Boolean(card.isDemo)),card.parentCardId ?? null,card.parentCode ?? null,
          card.parentTitle ?? null,card.lineageDepth,JSON.stringify(card),card.createdAt);
      return { created: true, card };
    });
  }

  deleteCard(id: string) {
    return Number(this.db.prepare('DELETE FROM minted_cards WHERE id=?').run(id).changes) > 0;
  }

  createShareLink(token: string, cardId: string, expiresAt: number | null) {
    return this.transaction(() => {
      if (!this.getCardById(cardId)) return null;
      const now = Date.now();
      if (expiresAt !== null && expiresAt <= now) throw new ArchiveError(400, 'EXPIRED', 'Expiry must be in the future');
      const prev = this.db.prepare(`SELECT token, created_at FROM share_links WHERE card_id=? AND revoked=0
        AND expires_at IS ? AND (expires_at IS NULL OR expires_at>?) ORDER BY created_at DESC LIMIT 1`).get(cardId, expiresAt, now);
      if (prev) return { created: false, token: String(prev.token), createdAt: Number(prev.created_at), expiresAt };
      this.db.prepare('UPDATE share_links SET revoked=1 WHERE card_id=? AND revoked=0').run(cardId);
      this.db.prepare('INSERT INTO share_links(token,card_id,created_at,expires_at) VALUES(?,?,?,?)').run(token,cardId,now,expiresAt);
      return { created: true, token, createdAt: now, expiresAt };
    });
  }

  getSharedCard(token: string) {
    const row = this.db.prepare(`SELECT payload_json, s.created_at, s.expires_at FROM share_links s JOIN minted_cards c ON c.id=s.card_id
      WHERE s.token=? AND s.revoked=0 AND (s.expires_at IS NULL OR s.expires_at>?)`).get(token,Date.now());
    return row ? { card: decode(row.payload_json), createdAt: Number(row.created_at), expiresAt: row.expires_at } : null;
  }

  revokeShareLink(token: string) {
    return Number(this.db.prepare('UPDATE share_links SET revoked=1 WHERE token=? AND revoked=0').run(token).changes) > 0;
  }

  getLineage(id: string) {
    const ancestors: MintedCard[] = [];
    let parentId = this.getCardById(id)?.parentCardId;
    const visited = new Set([id]);
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = this.getCardById(parentId);
      if (!parent) break;
      ancestors.push(parent);
      parentId = parent.parentCardId;
    }
    const children = this.db.prepare('SELECT payload_json FROM minted_cards WHERE parent_card_id=? ORDER BY created_at DESC')
      .all(id).map(row => decode(row.payload_json));
    return { ancestors, children };
  }
}
