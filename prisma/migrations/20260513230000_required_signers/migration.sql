-- Required signers for multi-signer UI.
--
-- Adds a new join model `ArchiveRequiredSignatory` so that an archive can
-- declare which signatories must sign before it becomes `FULLY_SIGNED`.
-- Without any required signers, an archive keeps the original single-signer
-- semantics (any active signature -> FULLY_SIGNED). With one or more
-- required signers, the archive's status is computed at the application
-- layer (`deriveArchiveStatus`) as:
--
--   FULLY_SIGNED if every required signatory has at least one active sig
--   REVOKED      if all required signatories were once signed and now all
--                signatures are revoked
--   PENDING      otherwise (in progress / partial / never started but
--                required signers are configured)

CREATE TABLE "ArchiveRequiredSignatory" (
    "id" TEXT NOT NULL,
    "archiveId" TEXT NOT NULL,
    "signatoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchiveRequiredSignatory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArchiveRequiredSignatory_archiveId_signatoryId_key" ON "ArchiveRequiredSignatory"("archiveId", "signatoryId");
CREATE INDEX "ArchiveRequiredSignatory_archiveId_idx" ON "ArchiveRequiredSignatory"("archiveId");
CREATE INDEX "ArchiveRequiredSignatory_signatoryId_idx" ON "ArchiveRequiredSignatory"("signatoryId");

ALTER TABLE "ArchiveRequiredSignatory" ADD CONSTRAINT "ArchiveRequiredSignatory_archiveId_fkey"
    FOREIGN KEY ("archiveId") REFERENCES "Archive"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ArchiveRequiredSignatory" ADD CONSTRAINT "ArchiveRequiredSignatory_signatoryId_fkey"
    FOREIGN KEY ("signatoryId") REFERENCES "Signatory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
