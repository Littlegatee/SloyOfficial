import express from 'express';
import prisma from '../prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

async function assertTrackOwner(userId: string, trackId: string) {
  const t = await prisma.musicTrack.findUnique({ where: { id: trackId } });
  if (!t || t.user_id !== userId) throw new Error('FORBIDDEN');
  return t;
}

// List tracks: mine, or another user's public tracks
router.get('/tracks', authenticateToken, async (req: any, res) => {
  const me = req.user.id as string;
  const { user_id } = req.query;
  try {
    if (user_id && String(user_id) !== me) {
      const list = await prisma.musicTrack.findMany({
        where: { user_id: String(user_id), visibility: 'PUBLIC' },
        orderBy: { created_at: 'desc' },
        take: 200,
      });
      return res.json(list);
    }
    const list = await prisma.musicTrack.findMany({
      where: { user_id: me },
      orderBy: { created_at: 'desc' },
      take: 500,
    });
    res.json(list);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/tracks', authenticateToken, async (req: any, res) => {
  const me = req.user.id as string;
  const { title, artist, file_url, cover_url, duration_sec, visibility } = req.body || {};
  if (!title || !file_url) {
    return res.status(400).json({ error: 'Нужны title и file_url' });
  }
  try {
    const track = await prisma.musicTrack.create({
      data: {
        user_id: me,
        title: String(title).slice(0, 500),
        artist: artist ? String(artist).slice(0, 300) : null,
        file_url: String(file_url),
        cover_url: cover_url ? String(cover_url) : null,
        duration_sec: duration_sec != null ? Number(duration_sec) : null,
        visibility: visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
      },
    });
    res.json(track);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/tracks/:id', authenticateToken, async (req: any, res) => {
  const me = req.user.id as string;
  try {
    await assertTrackOwner(me, req.params.id);
    await prisma.musicTrack.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(e.message === 'FORBIDDEN' ? 403 : 400).json({ error: e.message });
  }
});

router.patch('/tracks/:id', authenticateToken, async (req: any, res) => {
  const me = req.user.id as string;
  const { title, artist, cover_url, visibility } = req.body || {};
  try {
    await assertTrackOwner(me, req.params.id);
    const track = await prisma.musicTrack.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined ? { title: String(title).slice(0, 500) } : {}),
        ...(artist !== undefined ? { artist: artist ? String(artist).slice(0, 300) : null } : {}),
        ...(cover_url !== undefined ? { cover_url: cover_url ? String(cover_url) : null } : {}),
        ...(visibility !== undefined ? { visibility: visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE' } : {}),
      },
    });
    res.json(track);
  } catch (e: any) {
    res.status(e.message === 'FORBIDDEN' ? 403 : 400).json({ error: e.message });
  }
});

// Albums
router.get('/albums', authenticateToken, async (req: any, res) => {
  const me = req.user.id as string;
  try {
    const albums = await prisma.musicAlbum.findMany({
      where: { user_id: me },
      include: {
        tracks: { include: { track: true }, orderBy: { position: 'asc' } },
      },
      orderBy: { created_at: 'desc' },
    });
    res.json(albums);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/albums', authenticateToken, async (req: any, res) => {
  const me = req.user.id as string;
  const { title, cover_url } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Нужно название' });
  try {
    const album = await prisma.musicAlbum.create({
      data: {
        user_id: me,
        title: String(title).slice(0, 300),
        cover_url: cover_url ? String(cover_url) : null,
      },
    });
    res.json(album);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/albums/:albumId/tracks', authenticateToken, async (req: any, res) => {
  const me = req.user.id as string;
  const { track_id } = req.body || {};
  if (!track_id) return res.status(400).json({ error: 'Нужен track_id' });
  try {
    const album = await prisma.musicAlbum.findUnique({ where: { id: req.params.albumId } });
    if (!album || album.user_id !== me) return res.status(403).json({ error: 'Нет доступа' });
    await assertTrackOwner(me, track_id);
    const maxPos = await prisma.musicAlbumTrack.aggregate({
      where: { album_id: album.id },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;
    const row = await prisma.musicAlbumTrack.create({
      data: { album_id: album.id, track_id, position },
      include: { track: true },
    });
    res.json(row);
  } catch (e: any) {
    res.status(e.message === 'FORBIDDEN' ? 403 : 400).json({ error: e.message });
  }
});

router.delete('/albums/:albumId/track', authenticateToken, async (req: any, res) => {
  const me = req.user.id as string;
  const trackId = String(req.query.track_id || '');
  if (!trackId) return res.status(400).json({ error: 'Укажите track_id' });
  try {
    const album = await prisma.musicAlbum.findUnique({ where: { id: req.params.albumId } });
    if (!album || album.user_id !== me) return res.status(403).json({ error: 'Нет доступа' });
    await prisma.musicAlbumTrack.deleteMany({ where: { album_id: album.id, track_id: trackId } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/albums/:albumId', authenticateToken, async (req: any, res) => {
  const me = req.user.id as string;
  try {
    const album = await prisma.musicAlbum.findUnique({ where: { id: req.params.albumId } });
    if (!album || album.user_id !== me) return res.status(403).json({ error: 'Нет доступа' });
    await prisma.musicAlbum.delete({ where: { id: album.id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Playlists
router.get('/playlists', authenticateToken, async (req: any, res) => {
  const me = req.user.id as string;
  try {
    const list = await prisma.playlist.findMany({
      where: { user_id: me },
      include: {
        tracks: { include: { track: true }, orderBy: { position: 'asc' } },
      },
      orderBy: { created_at: 'desc' },
    });
    res.json(list);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/playlists', authenticateToken, async (req: any, res) => {
  const me = req.user.id as string;
  const { title, cover_url, is_public } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Нужно название' });
  try {
    const pl = await prisma.playlist.create({
      data: {
        user_id: me,
        title: String(title).slice(0, 300),
        cover_url: cover_url ? String(cover_url) : null,
        is_public: !!is_public,
      },
    });
    res.json(pl);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/playlists/:playlistId/tracks', authenticateToken, async (req: any, res) => {
  const me = req.user.id as string;
  const { track_id } = req.body || {};
  if (!track_id) return res.status(400).json({ error: 'Нужен track_id' });
  try {
    const pl = await prisma.playlist.findUnique({ where: { id: req.params.playlistId } });
    if (!pl || pl.user_id !== me) return res.status(403).json({ error: 'Нет доступа' });
    await assertTrackOwner(me, track_id);
    const maxPos = await prisma.playlistTrack.aggregate({
      where: { playlist_id: pl.id },
      _max: { position: true },
    });
    const position = (maxPos._max.position ?? -1) + 1;
    const row = await prisma.playlistTrack.create({
      data: { playlist_id: pl.id, track_id, position },
      include: { track: true },
    });
    res.json(row);
  } catch (e: any) {
    res.status(e.message === 'FORBIDDEN' ? 403 : 400).json({ error: e.message });
  }
});

router.delete('/playlists/:playlistId/track', authenticateToken, async (req: any, res) => {
  const me = req.user.id as string;
  const trackId = String(req.query.track_id || '');
  if (!trackId) return res.status(400).json({ error: 'Укажите track_id' });
  try {
    const pl = await prisma.playlist.findUnique({ where: { id: req.params.playlistId } });
    if (!pl || pl.user_id !== me) return res.status(403).json({ error: 'Нет доступа' });
    await prisma.playlistTrack.deleteMany({ where: { playlist_id: pl.id, track_id: trackId } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/playlists/:playlistId', authenticateToken, async (req: any, res) => {
  const me = req.user.id as string;
  try {
    const pl = await prisma.playlist.findUnique({ where: { id: req.params.playlistId } });
    if (!pl || pl.user_id !== me) return res.status(403).json({ error: 'Нет доступа' });
    await prisma.playlist.delete({ where: { id: pl.id } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
