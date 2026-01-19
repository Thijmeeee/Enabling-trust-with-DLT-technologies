-- Reset batches and witness_proofs to allow re-anchoring with correct batch IDs
-- Run this when batch IDs in database are out of sync with blockchain

-- 1. Clear all existing batches (they have wrong batch IDs)
TRUNCATE TABLE batches CASCADE;

-- 2. Clear witness_proofs from events (so they get re-anchored)
UPDATE events SET witness_proofs = NULL;

-- 3. Clear audit results (they reference old batch IDs)
TRUNCATE TABLE audits;

-- After running this:
-- - The witness service will pick up all events again
-- - It will anchor them with correct batch IDs from the contract
-- - The watcher will then verify correctly
