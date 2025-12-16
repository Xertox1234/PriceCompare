-- Add watch list sharing (invite-by-email with view/edit permissions)

CREATE TABLE IF NOT EXISTS watch_list_shares (
  id SERIAL PRIMARY KEY,
  watch_list_id INTEGER NOT NULL REFERENCES watch_lists(id) ON DELETE CASCADE,
  shared_with_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(10) NOT NULL CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_watch_list_share UNIQUE (watch_list_id, shared_with_user_id)
);

CREATE INDEX IF NOT EXISTS watch_list_shares_watch_list_id_idx ON watch_list_shares(watch_list_id);
CREATE INDEX IF NOT EXISTS watch_list_shares_shared_with_user_id_idx ON watch_list_shares(shared_with_user_id);
