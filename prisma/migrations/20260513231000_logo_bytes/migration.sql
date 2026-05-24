-- Allow uploading a logo file in addition to an external URL.
-- Storing the bytes (typically <100KB) directly in the singleton
-- OrganizationProfile row keeps storage trivial and avoids any
-- external dependency (S3, Vercel Blob, etc.). The image is served
-- through /api/profile/logo with proper Content-Type + Cache-Control.

ALTER TABLE "OrganizationProfile"
  ADD COLUMN "logoBytes" BYTEA,
  ADD COLUMN "logoMimeType" TEXT,
  ADD COLUMN "logoUpdatedAt" TIMESTAMP(3);
