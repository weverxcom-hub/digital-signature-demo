-- Multi-signer + archive status refactor.
--
-- Drops the 1:1 unique constraint on `ArchiveSignature.archiveId` so an
-- archive can hold multiple signatures. Adds an `Archive.status` enum
-- (DRAFT / PENDING / FULLY_SIGNED / REVOKED) and backfills it for
-- existing rows based on each archive's current signatures.

-- 1. Create the new enum.
CREATE TYPE "ArchiveStatus" AS ENUM ('DRAFT', 'PENDING', 'FULLY_SIGNED', 'REVOKED');

-- 2. Drop the 1:1 unique index on ArchiveSignature.archiveId.
DROP INDEX "ArchiveSignature_archiveId_key";

-- 3. Add the status column to Archive (with a temporary default for
--    the NOT NULL add; we backfill more accurate values below).
ALTER TABLE "Archive" ADD COLUMN "status" "ArchiveStatus" NOT NULL DEFAULT 'DRAFT';

-- 4. Backfill status for existing archives from their current signatures:
--      - any non-revoked signature  -> FULLY_SIGNED
--      - has signatures, all revoked -> REVOKED
--      - no signatures              -> DRAFT (already the default)
UPDATE "Archive" a
SET "status" = 'FULLY_SIGNED'::"ArchiveStatus"
WHERE EXISTS (
  SELECT 1 FROM "ArchiveSignature" s
  WHERE s."archiveId" = a."id" AND s."revokedAt" IS NULL
);

UPDATE "Archive" a
SET "status" = 'REVOKED'::"ArchiveStatus"
WHERE NOT EXISTS (
  SELECT 1 FROM "ArchiveSignature" s
  WHERE s."archiveId" = a."id" AND s."revokedAt" IS NULL
)
AND EXISTS (
  SELECT 1 FROM "ArchiveSignature" s
  WHERE s."archiveId" = a."id"
);

-- 5. New indexes.
CREATE INDEX "Archive_status_idx" ON "Archive"("status");
CREATE INDEX "ArchiveSignature_archiveId_idx" ON "ArchiveSignature"("archiveId");
CREATE INDEX "ArchiveSignature_archiveId_revokedAt_idx" ON "ArchiveSignature"("archiveId", "revokedAt");
