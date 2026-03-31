/*
  Warnings:

  - The `status` column on the `Friendship` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `media_type` column on the `Post` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `updated_at` to the `Comment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Friendship` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'NONE');

-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CommentMediaType" AS ENUM ('TEXT', 'VOICE', 'NONE');

-- CreateEnum
CREATE TYPE "CommunityType" AS ENUM ('CHANNEL', 'GROUP');

-- CreateEnum
CREATE TYPE "CommunityRole" AS ENUM ('MEMBER', 'ADMIN', 'OWNER');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'VOICE', 'STICKER', 'MEDIA', 'FILE', 'VIDEO_CIRCLE');

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "is_edited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "likes_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "media_type" "CommentMediaType" NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "parent_id" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "voice_duration" INTEGER,
ADD COLUMN     "voice_url" TEXT,
ALTER COLUMN "content_text" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Friendship" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "is_edited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "media_url" TEXT,
ADD COLUMN     "message_type" "MessageType" NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "reply_to_id" TEXT,
ADD COLUMN     "voice_duration" INTEGER,
ALTER COLUMN "content_text" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "author_type" TEXT NOT NULL DEFAULT 'USER',
ADD COLUMN     "community_id" TEXT,
ADD COLUMN     "is_edited" BOOLEAN NOT NULL DEFAULT false,
DROP COLUMN "media_type",
ADD COLUMN     "media_type" "MediaType" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "cover_url" TEXT;

-- CreateTable
CREATE TABLE "CommentLike" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageHidden" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "hidden_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageHidden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Community" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "avatar_url" TEXT,
    "cover_url" TEXT,
    "type" "CommunityType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityMember" (
    "id" TEXT NOT NULL,
    "community_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "CommunityRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommentLike_comment_id_idx" ON "CommentLike"("comment_id");

-- CreateIndex
CREATE UNIQUE INDEX "CommentLike_comment_id_user_id_key" ON "CommentLike"("comment_id", "user_id");

-- CreateIndex
CREATE INDEX "MessageHidden_user_id_idx" ON "MessageHidden"("user_id");

-- CreateIndex
CREATE INDEX "MessageHidden_message_id_idx" ON "MessageHidden"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "MessageHidden_message_id_user_id_key" ON "MessageHidden"("message_id", "user_id");

-- CreateIndex
CREATE INDEX "CommunityMember_user_id_idx" ON "CommunityMember"("user_id");

-- CreateIndex
CREATE INDEX "CommunityMember_community_id_idx" ON "CommunityMember"("community_id");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityMember_community_id_user_id_key" ON "CommunityMember"("community_id", "user_id");

-- CreateIndex
CREATE INDEX "Comment_post_id_idx" ON "Comment"("post_id");

-- CreateIndex
CREATE INDEX "Comment_user_id_idx" ON "Comment"("user_id");

-- CreateIndex
CREATE INDEX "Comment_parent_id_idx" ON "Comment"("parent_id");

-- CreateIndex
CREATE INDEX "Comment_created_at_idx" ON "Comment"("created_at");

-- CreateIndex
CREATE INDEX "Friendship_user_id_idx" ON "Friendship"("user_id");

-- CreateIndex
CREATE INDEX "Friendship_friend_id_idx" ON "Friendship"("friend_id");

-- CreateIndex
CREATE INDEX "Like_post_id_idx" ON "Like"("post_id");

-- CreateIndex
CREATE INDEX "Message_sender_id_idx" ON "Message"("sender_id");

-- CreateIndex
CREATE INDEX "Message_recipient_id_idx" ON "Message"("recipient_id");

-- CreateIndex
CREATE INDEX "Message_reply_to_id_idx" ON "Message"("reply_to_id");

-- CreateIndex
CREATE INDEX "Message_created_at_idx" ON "Message"("created_at");

-- CreateIndex
CREATE INDEX "Post_user_id_idx" ON "Post"("user_id");

-- CreateIndex
CREATE INDEX "Post_created_at_idx" ON "Post"("created_at");

-- CreateIndex
CREATE INDEX "Profile_username_idx" ON "Profile"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageHidden" ADD CONSTRAINT "MessageHidden_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageHidden" ADD CONSTRAINT "MessageHidden_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
