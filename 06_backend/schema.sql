-- Executed inside the user_version migration transaction.
CREATE TABLE IF NOT EXISTS minted_cards (
  id TEXT PRIMARY KEY NOT NULL,
  serial_number INTEGER NOT NULL CHECK(serial_number >= 0),
  code TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  rarity TEXT NOT NULL,
  foil TEXT NOT NULL,
  art_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0,
  parent_card_id TEXT REFERENCES minted_cards(id) ON DELETE RESTRICT,
  parent_code TEXT,
  parent_title TEXT,
  lineage_depth INTEGER NOT NULL DEFAULT 0,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_archive_serial ON minted_cards(serial_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_archive_code ON minted_cards(code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_archive_content ON minted_cards(json_extract(payload_json, '$.contentHash'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_archive_request ON minted_cards(json_extract(payload_json, '$.requestId'));
CREATE INDEX IF NOT EXISTS idx_minted_cards_created ON minted_cards(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_minted_cards_parent ON minted_cards(parent_card_id);

CREATE TABLE IF NOT EXISTS share_links (
  token TEXT PRIMARY KEY NOT NULL,
  card_id TEXT NOT NULL REFERENCES minted_cards(id) ON DELETE CASCADE,
  revoked INTEGER NOT NULL DEFAULT 0 CHECK(revoked IN (0,1)),
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_share_links_card ON share_links(card_id);

-- Also apply parent/JSON constraints to the original v0 table, without rewriting works.
CREATE TRIGGER IF NOT EXISTS archive_parent_insert BEFORE INSERT ON minted_cards
WHEN (NEW.parent_card_id IS NULL AND NEW.lineage_depth != 0)
  OR (NEW.parent_card_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM minted_cards p WHERE p.id = NEW.parent_card_id
      AND p.lineage_depth + 1 = NEW.lineage_depth AND p.code = NEW.parent_code AND p.title = NEW.parent_title
  ))
BEGIN SELECT RAISE(ABORT, 'Invalid archive parent'); END;
CREATE TRIGGER IF NOT EXISTS archive_parent_delete BEFORE DELETE ON minted_cards
WHEN EXISTS(SELECT 1 FROM minted_cards WHERE parent_card_id = OLD.id)
BEGIN SELECT RAISE(ABORT, 'Archive parent has children'); END;
CREATE TRIGGER IF NOT EXISTS archive_immutable BEFORE UPDATE ON minted_cards
BEGIN SELECT RAISE(ABORT, 'Archived works are immutable'); END;
