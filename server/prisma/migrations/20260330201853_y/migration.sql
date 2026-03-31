-- CreateTable
CREATE TABLE "MessageReaction" (
    "id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DialogMute" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "other_user_id" TEXT NOT NULL,
    "muted_until" TIMESTAMP(3),
    "muted_forever" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DialogMute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DialogArchive" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "other_user_id" TEXT NOT NULL,
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DialogArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageReaction_message_id_idx" ON "MessageReaction"("message_id");

-- CreateIndex
CREATE INDEX "MessageReaction_user_id_idx" ON "MessageReaction"("user_id");

-- CreateIndex
CREATE INDEX "MessageReaction_emoji_idx" ON "MessageReaction"("emoji");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_message_id_user_id_emoji_key" ON "MessageReaction"("message_id", "user_id", "emoji");

-- CreateIndex
CREATE INDEX "DialogMute_user_id_idx" ON "DialogMute"("user_id");

-- CreateIndex
CREATE INDEX "DialogMute_other_user_id_idx" ON "DialogMute"("other_user_id");

-- CreateIndex
CREATE INDEX "DialogMute_muted_until_idx" ON "DialogMute"("muted_until");

-- CreateIndex
CREATE UNIQUE INDEX "DialogMute_user_id_other_user_id_key" ON "DialogMute"("user_id", "other_user_id");

-- CreateIndex
CREATE INDEX "DialogArchive_user_id_idx" ON "DialogArchive"("user_id");

-- CreateIndex
CREATE INDEX "DialogArchive_other_user_id_idx" ON "DialogArchive"("other_user_id");

-- CreateIndex
CREATE INDEX "DialogArchive_archived_at_idx" ON "DialogArchive"("archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "DialogArchive_user_id_other_user_id_key" ON "DialogArchive"("user_id", "other_user_id");

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialogMute" ADD CONSTRAINT "DialogMute_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialogArchive" ADD CONSTRAINT "DialogArchive_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
