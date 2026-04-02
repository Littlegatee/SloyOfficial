-- Profile columns from prisma/schema.prisma that were never included in earlier migrations.
-- Fixes: registration (user.create) and login (findUnique + include profile) when DB was created from old migrations only.

ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "language" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "interests" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "gender" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "favorite_movies" TEXT;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "favorite_games" TEXT;

-- Nullable FK target; MusicTrack table may be created in a separate migration. No FK here to avoid deploy failure if "MusicTrack" is missing.
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "pinned_track_id" TEXT;
