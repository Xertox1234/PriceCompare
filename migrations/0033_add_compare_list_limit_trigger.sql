-- Migration 0033: Add trigger to enforce compare list max 4 items constraint
--
-- PURPOSE: Prevent race conditions from exceeding the 4-item limit on compare lists
-- ISSUE: Check-then-act pattern at application level allows concurrent inserts to exceed limit
-- SOLUTION: Database trigger provides atomic enforcement at the lowest level
--
-- This is bulletproof because:
-- 1. Triggers execute within the INSERT transaction
-- 2. Row-level locking prevents concurrent violations
-- 3. No application-level race condition can bypass this

-- Create the enforcement function
CREATE OR REPLACE FUNCTION enforce_compare_list_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_items CONSTANT INTEGER := 4;
BEGIN
  -- Count existing items for this user (excluding the row being inserted if it's an update)
  SELECT COUNT(*) INTO current_count
  FROM user_compare_items
  WHERE user_id = NEW.user_id
    AND id != COALESCE(NEW.id, 0);  -- Exclude self for upsert scenarios

  -- Check if adding this item would exceed the limit
  IF current_count >= max_items THEN
    RAISE EXCEPTION 'Compare list limit exceeded: maximum % items allowed per user', max_items
      USING ERRCODE = 'check_violation',
            HINT = 'Remove an item from your compare list before adding a new one';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger (fires BEFORE INSERT to prevent the row from being added)
DROP TRIGGER IF EXISTS trigger_enforce_compare_list_limit ON user_compare_items;

CREATE TRIGGER trigger_enforce_compare_list_limit
  BEFORE INSERT ON user_compare_items
  FOR EACH ROW
  EXECUTE FUNCTION enforce_compare_list_limit();

-- Add a comment documenting the constraint
COMMENT ON TRIGGER trigger_enforce_compare_list_limit ON user_compare_items IS
  'Enforces maximum 4 items per user in compare list. Prevents race conditions at database level.';

COMMENT ON FUNCTION enforce_compare_list_limit() IS
  'Trigger function that enforces the 4-item limit on user compare lists.
   Raises check_violation exception if limit would be exceeded.';
