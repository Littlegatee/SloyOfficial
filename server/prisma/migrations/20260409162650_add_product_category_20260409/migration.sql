-- AlterTable
ALTER TABLE "CommunityProduct" ADD COLUMN IF NOT EXISTS "category" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommunityProduct_category_idx" ON "CommunityProduct"("category");
