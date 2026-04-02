-- Music models from schema.prisma (were never migrated; /api/music/* returned 400).

CREATE TYPE "MusicVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

CREATE TABLE "MusicTrack" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT,
    "file_url" TEXT NOT NULL,
    "cover_url" TEXT,
    "duration_sec" INTEGER,
    "visibility" "MusicVisibility" NOT NULL DEFAULT 'PRIVATE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicTrack_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MusicAlbum" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cover_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicAlbum_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MusicAlbumTrack" (
    "id" TEXT NOT NULL,
    "album_id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MusicAlbumTrack_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Playlist" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cover_url" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlaylistTrack" (
    "id" TEXT NOT NULL,
    "playlist_id" TEXT NOT NULL,
    "track_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlaylistTrack_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MusicTrack_user_id_idx" ON "MusicTrack"("user_id");
CREATE INDEX "MusicTrack_created_at_idx" ON "MusicTrack"("created_at");
CREATE INDEX "MusicAlbum_user_id_idx" ON "MusicAlbum"("user_id");
CREATE INDEX "MusicAlbumTrack_album_id_idx" ON "MusicAlbumTrack"("album_id");
CREATE UNIQUE INDEX "MusicAlbumTrack_album_id_track_id_key" ON "MusicAlbumTrack"("album_id", "track_id");
CREATE INDEX "Playlist_user_id_idx" ON "Playlist"("user_id");
CREATE INDEX "PlaylistTrack_playlist_id_idx" ON "PlaylistTrack"("playlist_id");
CREATE UNIQUE INDEX "PlaylistTrack_playlist_id_track_id_key" ON "PlaylistTrack"("playlist_id", "track_id");

ALTER TABLE "MusicTrack" ADD CONSTRAINT "MusicTrack_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MusicAlbum" ADD CONSTRAINT "MusicAlbum_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MusicAlbumTrack" ADD CONSTRAINT "MusicAlbumTrack_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "MusicAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MusicAlbumTrack" ADD CONSTRAINT "MusicAlbumTrack_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "MusicTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Playlist" ADD CONSTRAINT "Playlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaylistTrack" ADD CONSTRAINT "PlaylistTrack_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaylistTrack" ADD CONSTRAINT "PlaylistTrack_track_id_fkey" FOREIGN KEY ("track_id") REFERENCES "MusicTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Optional FK for pinned track (column added in 20260402140000 without constraint)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Profile' AND column_name = 'pinned_track_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Profile_pinned_track_id_fkey'
  ) THEN
    ALTER TABLE "Profile"
      ADD CONSTRAINT "Profile_pinned_track_id_fkey"
      FOREIGN KEY ("pinned_track_id") REFERENCES "MusicTrack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
