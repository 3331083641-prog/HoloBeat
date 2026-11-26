-- HoloBeat Local Archive & Read-Only Share Database Schema (SQLite / Node 24 node:sqlite)

CREATE TABLE IF NOT EXISTS minted_cards (
  id TEXT PRIMARY KEY,
  serial_number INTEGER NOT NULL,
  code TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  rarity TEXT NOT NULL,
  foil TEXT NOT NULL,
  art_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  parent_card_id TEXT,
  parent_code TEXT,
  parent_title TEXT,
  lineage_depth INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_minted_cards_created ON minted_cards (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_minted_cards_parent ON minted_cards (parent_card_id);

CREATE TABLE IF NOT EXISTS share_links (
  token TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (card_id) REFERENCES minted_cards(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_share_links_card ON share_links (card_id);
