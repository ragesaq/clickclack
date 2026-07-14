ALTER TABLE channels
  ADD COLUMN pull_request_url TEXT NOT NULL DEFAULT '';

ALTER TABLE channels
  ADD COLUMN pull_request_title TEXT NOT NULL DEFAULT '';
