-- Add an optional SHA-256 (lowercase hex, 64 chars) of the bound PDF
-- document. This is independent of the HMAC signature payload; binding
-- (or not binding) a hash never invalidates an existing signature.
-- Existing rows get NULL and continue to verify normally.
ALTER TABLE "Archive" ADD COLUMN "documentSha256" TEXT;
