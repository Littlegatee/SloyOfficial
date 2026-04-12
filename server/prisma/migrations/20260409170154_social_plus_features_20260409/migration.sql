-- CreateTable
CREATE TABLE IF NOT EXISTS "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostTag" (
    "post_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("post_id","tag_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Bookmark" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "post_id" TEXT,
    "product_id" TEXT,
    "community_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostPoll" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "multiple" BOOLEAN NOT NULL DEFAULT false,
    "closed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PostPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostPollVote" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "option_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostPollVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tag_name_idx" ON "Tag"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostTag_post_id_idx" ON "PostTag"("post_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostTag_tag_id_idx" ON "PostTag"("tag_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Bookmark_user_id_idx" ON "Bookmark"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Bookmark_user_id_post_id_key" ON "Bookmark"("user_id", "post_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Bookmark_user_id_product_id_key" ON "Bookmark"("user_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Bookmark_user_id_community_id_key" ON "Bookmark"("user_id", "community_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PostPoll_post_id_key" ON "PostPoll"("post_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostPollVote_poll_id_idx" ON "PostPollVote"("poll_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostPollVote_user_id_idx" ON "PostPollVote"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PostPollVote_poll_id_user_id_key" ON "PostPollVote"("poll_id", "user_id");

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "CommunityProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPoll" ADD CONSTRAINT "PostPoll_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPollVote" ADD CONSTRAINT "PostPollVote_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "PostPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostPollVote" ADD CONSTRAINT "PostPollVote_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
