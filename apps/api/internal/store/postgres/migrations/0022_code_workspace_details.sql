ALTER TABLE channels
  ADD COLUMN plan_body TEXT NOT NULL DEFAULT '',
  ADD COLUMN goal_body TEXT NOT NULL DEFAULT '';

CREATE TABLE bot_runtime_profiles (
  workspace_id TEXT NOT NULL,
  bot_user_id TEXT NOT NULL,
  harness TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  thinking TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, bot_user_id),
  FOREIGN KEY (workspace_id, bot_user_id)
    REFERENCES workspace_members(workspace_id, user_id) ON DELETE CASCADE
);
