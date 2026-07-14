ALTER TABLE channels
  ADD COLUMN template TEXT NOT NULL DEFAULT 'chat'
  CHECK (template IN ('chat', 'code'));

ALTER TABLE channels
  ADD COLUMN code_mode TEXT NOT NULL DEFAULT 'single_user'
  CHECK (code_mode IN ('single_user', 'multi_user'));
