-- PsiClawOps fork migration (0900 namespace; upstream numbering stays below).
-- Per-message model/runtime provenance for agent-authored posts. Nullable-with-
-- default so existing rows and human messages are untouched.
ALTER TABLE messages ADD COLUMN author_model    TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN author_thinking TEXT NOT NULL DEFAULT '';
ALTER TABLE messages ADD COLUMN author_runtime  TEXT NOT NULL DEFAULT '';
