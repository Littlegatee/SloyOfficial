-- Profile privacy fields were in schema but never migrated; Prisma INSERT expects these columns.

-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'FRIENDS_ONLY', 'PRIVATE');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "profile_visibility" "ProfileVisibility" NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "Profile" ADD COLUMN "allow_friend_requests" BOOLEAN NOT NULL DEFAULT true;
