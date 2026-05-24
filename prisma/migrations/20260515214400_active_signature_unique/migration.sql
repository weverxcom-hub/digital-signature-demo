-- Note: this index is also created by 20260513233000_signature_active_unique
-- when both branches are merged together (the two migrations were authored
-- in parallel on separate branches). IF NOT EXISTS makes this migration
-- idempotent so the second one to run does not crash with "relation already
-- exists" on fresh databases.
CREATE UNIQUE INDEX IF NOT EXISTS "ArchiveSignature_archiveId_signatoryId_active_key"
    ON "ArchiveSignature"("archiveId", "signatoryId")
    WHERE "revokedAt" IS NULL;
