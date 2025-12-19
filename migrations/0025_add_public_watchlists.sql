-- Add public watchlist sharing via token
-- This enables generating a shareable link that can be accessed without authentication.

ALTER TABLE watch_lists
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_share_token varchar(64);

CREATE INDEX IF NOT EXISTS watch_lists_public_share_token_idx
  ON watch_lists(public_share_token);

-- Ensure tokens are unique when present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'watch_lists_public_share_token_unique'
  ) THEN
    ALTER TABLE watch_lists
      ADD CONSTRAINT watch_lists_public_share_token_unique
      UNIQUE (public_share_token);
  END IF;
END $$;
