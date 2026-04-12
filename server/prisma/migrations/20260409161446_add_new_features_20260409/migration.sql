-- AlterEnum
DO $$ BEGIN
    ALTER TYPE "CommunityRole" ADD VALUE 'MODERATOR';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
DO $$ BEGIN
    ALTER TYPE "MessageType" ADD VALUE 'POLL';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Community" ADD COLUMN IF NOT EXISTS "category" TEXT,
ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "album_id" TEXT,
ADD COLUMN IF NOT EXISTS "link_preview" JSONB;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "is_promoted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "is_repost" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "original_post_id" TEXT,
ADD COLUMN IF NOT EXISTS "views_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "is_admin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PostView" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChatFolder" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "filters" JSONB NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ChatDraft" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "content_text" TEXT,
    "reply_to_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Poll" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "multiple" BOOLEAN NOT NULL DEFAULT false,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PollVote" (
    "id" TEXT NOT NULL,
    "poll_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "option_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "StickerPack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StickerPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Sticker" (
    "id" TEXT NOT NULL,
    "pack_id" TEXT NOT NULL,
    "media_url" TEXT NOT NULL,
    "emoji" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sticker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "UserChatConfig" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "other_user_id" TEXT NOT NULL,
    "bubble_color" TEXT,
    "text_color" TEXT,
    "notif_sound" TEXT,

    CONSTRAINT "UserChatConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CommunityProduct" (
    "id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "image_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PushSubscription_user_id_idx" ON "PushSubscription"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostView_post_id_idx" ON "PostView"("post_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostView_user_id_idx" ON "PostView"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PostView_post_id_user_id_key" ON "PostView"("post_id", "user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChatFolder_user_id_idx" ON "ChatFolder"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ChatDraft_user_id_idx" ON "ChatDraft"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ChatDraft_user_id_recipient_id_key" ON "ChatDraft"("user_id", "recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Poll_message_id_key" ON "Poll"("message_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PollVote_poll_id_idx" ON "PollVote"("poll_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PollVote_user_id_idx" ON "PollVote"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PollVote_poll_id_user_id_option_id_key" ON "PollVote"("poll_id", "user_id", "option_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Sticker_pack_id_idx" ON "Sticker"("pack_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "UserChatConfig_user_id_idx" ON "UserChatConfig"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserChatConfig_user_id_other_user_id_key" ON "UserChatConfig"("user_id", "other_user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CommunityProduct_community_id_idx" ON "CommunityProduct"("community_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Community_category_idx" ON "Community"("category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_album_id_idx" ON "Message"("album_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Post_original_post_id_idx" ON "Post"("original_post_id");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_original_post_id_fkey" FOREIGN KEY ("original_post_id") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostView" ADD CONSTRAINT "PostView_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostView" ADD CONSTRAINT "PostView_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatFolder" ADD CONSTRAINT "ChatFolder_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatDraft" ADD CONSTRAINT "ChatDraft_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_poll_id_fkey" FOREIGN KEY ("poll_id") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sticker" ADD CONSTRAINT "Sticker_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "StickerPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChatConfig" ADD CONSTRAINT "UserChatConfig_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityProduct" ADD CONSTRAINT "CommunityProduct_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
