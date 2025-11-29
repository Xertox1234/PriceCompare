-- Migration: Fix product_watches unique constraint to handle NULL watch_list_id
-- Problem: The current UNIQUE(user_id, product_id, watch_list_id) constraint
--          allows duplicate products when watch_list_id IS NULL because
--          PostgreSQL treats NULL as distinct values.
-- Solution: Use partial unique index for NULL case + standard constraint for non-NULL case

-- Drop the flawed three-column constraint
ALTER TABLE product_watches DROP CONSTRAINT IF EXISTS unique_user_product_list;

-- Create partial unique index for NULL watch_list_id case
-- This prevents duplicate (user_id, product_id) when watch_list_id IS NULL
CREATE UNIQUE INDEX unique_user_product_no_list
  ON product_watches(user_id, product_id)
  WHERE watch_list_id IS NULL;

-- Create standard unique constraint for non-NULL watch_list_id
-- This prevents duplicate (user_id, product_id, watch_list_id) when watch_list_id is set
ALTER TABLE product_watches
  ADD CONSTRAINT unique_user_product_list
  UNIQUE(user_id, product_id, watch_list_id);

COMMENT ON INDEX unique_user_product_no_list IS 'Prevents duplicate products in user watches when not assigned to a list';
COMMENT ON CONSTRAINT unique_user_product_list ON product_watches IS 'Prevents duplicate products within the same watch list';
