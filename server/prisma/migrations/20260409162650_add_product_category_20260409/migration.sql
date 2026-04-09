-- AlterTable
ALTER TABLE "CommunityProduct" ADD COLUMN     "category" TEXT;

-- CreateIndex
CREATE INDEX "CommunityProduct_category_idx" ON "CommunityProduct"("category");
