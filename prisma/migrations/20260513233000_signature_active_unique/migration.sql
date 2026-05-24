-- Prevent two concurrent transactions from creating two ACTIVE (non-revoked)
-- signatures by the same signatory on the same archive. The application
-- layer already guards against this with a SELECT-then-INSERT check, but
-- that pattern is racy without a row lock. A partial unique index makes
-- the constraint atomic and survives any future code path that bypasses
-- the explicit check.
--
-- Existing rows are unaffected because:
--   1) Revoked signatures are excluded by the partial predicate, and
--   2) Before PR #4 the schema enforced at most one signature per archive
--      anyway, so there are no historical duplicates to clean up.
CREATE UNIQUE INDEX IF NOT EXISTS "ArchiveSignature_archiveId_signatoryId_active_key"
  ON "ArchiveSignature" ("archiveId", "signatoryId")
  WHERE "revokedAt" IS NULL;
