-- PsiClawOps fork migration. Idempotent-backfill bookkeeping: legacy source ids
-- make the ClawCanvas history import re-runnable (UPSERT key) and auditable.
ALTER TABLE messages ADD COLUMN legacy_source TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN legacy_id     TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_legacy
  ON messages(legacy_source, legacy_id) WHERE legacy_id <> '';
