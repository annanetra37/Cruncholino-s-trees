-- Reachability: how hard the fruit is to actually pick.
--
-- Distinct from fruit_quality, which says whether the fruit is worth picking.
-- A tree can carry a fine crop ten metres up, and for someone planning a route
-- that is the difference between a stop and a detour.

CREATE TYPE "Reachability" AS ENUM ('GROUND', 'LADDER', 'OUT_OF_REACH', 'UNKNOWN');

-- Existing rows were recorded without the question being asked, so UNKNOWN is
-- the honest value for them rather than a guess at ground level.
ALTER TABLE "trees"
  ADD COLUMN "reachability" "Reachability" NOT NULL DEFAULT 'UNKNOWN';

CREATE INDEX "trees_reachability_idx" ON "trees"("reachability");
