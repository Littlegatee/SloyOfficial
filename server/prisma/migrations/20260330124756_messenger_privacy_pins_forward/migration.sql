-- CreateEnum
CREATE TYPE "MessagePermission" AS ENUM ('EVERYONE', 'FRIENDS', 'NOBODY');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "forwarded_from_id" TEXT;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "allow_last_seen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allow_messages_from" "MessagePermission" NOT NULL DEFAULT 'FRIENDS',
ADD COLUMN     "allow_online_status" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "UserBlock" (
    "id" TEXT NOT NULL,
    "blocker_id" TEXT NOT NULL,
    "blocked_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DialogPin" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "other_user_id" TEXT NOT NULL,
    "pinned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DialogPin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessagePin" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "pinned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagePin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserBlock_blocker_id_idx" ON "UserBlock"("blocker_id");

-- CreateIndex
CREATE INDEX "UserBlock_blocked_id_idx" ON "UserBlock"("blocked_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserBlock_blocker_id_blocked_id_key" ON "UserBlock"("blocker_id", "blocked_id");

-- CreateIndex
CREATE INDEX "DialogPin_user_id_idx" ON "DialogPin"("user_id");

-- CreateIndex
CREATE INDEX "DialogPin_other_user_id_idx" ON "DialogPin"("other_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "DialogPin_user_id_other_user_id_key" ON "DialogPin"("user_id", "other_user_id");

-- CreateIndex
CREATE INDEX "MessagePin_user_id_idx" ON "MessagePin"("user_id");

-- CreateIndex
CREATE INDEX "MessagePin_message_id_idx" ON "MessagePin"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "MessagePin_user_id_message_id_key" ON "MessagePin"("user_id", "message_id");

-- CreateIndex
CREATE INDEX "Message_forwarded_from_id_idx" ON "Message"("forwarded_from_id");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_forwarded_from_id_fkey" FOREIGN KEY ("forwarded_from_id") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialogPin" ADD CONSTRAINT "DialogPin_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagePin" ADD CONSTRAINT "MessagePin_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagePin" ADD CONSTRAINT "MessagePin_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
