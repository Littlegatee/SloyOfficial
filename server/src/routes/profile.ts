import express from 'express';
import prisma from '../prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

async function areAcceptedFriends(a: string, b: string) {
  const f = await prisma.friendship.findFirst({
    where: {
      status: 'ACCEPTED',
      OR: [
        { user_id: a, friend_id: b },
        { user_id: b, friend_id: a },
      ],
    },
  });
  return !!f;
}

function limitedProfilePayload(profile: any) {
  const pinned =
    profile?.pinned_track?.id && profile?.pinned_track?.visibility === 'PUBLIC'
      ? {
          id: profile.pinned_track.id,
          title: profile.pinned_track.title,
          artist: profile.pinned_track.artist,
          file_url: profile.pinned_track.file_url,
          cover_url: profile.pinned_track.cover_url,
          visibility: profile.pinned_track.visibility,
        }
      : null;

  return {
    user_id: profile.user_id,
    username: profile.username,
    first_name: profile.first_name,
    last_name: profile.last_name,
    avatar_url: profile.avatar_url,
    is_verified: profile.is_verified,
    is_limited: true,
    profile_visibility: profile.profile_visibility,
    allow_friend_requests: profile.allow_friend_requests,
    pinned_track: pinned,
  };
}

// Block / Unblock user
router.post('/:id/block', authenticateToken, async (req: any, res) => {
  const me = req.user.id;
  const target = req.params.id as string;
  if (me === target) return res.status(400).json({ error: "Нельзя заблокировать себя" });
  try {
    await prisma.userBlock.upsert({
      where: { blocker_id_blocked_id: { blocker_id: me, blocked_id: target } },
      create: { blocker_id: me, blocked_id: target },
      update: { created_at: new Date() },
    });
    res.json({ blocked: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:id/block', authenticateToken, async (req: any, res) => {
  const me = req.user.id;
  const target = req.params.id as string;
  try {
    await prisma.userBlock.deleteMany({
      where: { blocker_id: me, blocked_id: target },
    });
    res.json({ blocked: false });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/blocks/me', authenticateToken, async (req: any, res) => {
  const me = req.user.id;
  try {
    const blocks = await prisma.userBlock.findMany({
      where: { blocker_id: me },
      include: { blocked: { include: { profile: true } } },
      orderBy: { created_at: 'desc' },
      take: 200,
    });
    res.json(blocks.map(b => ({ user_id: b.blocked_id, profile: b.blocked.profile, created_at: b.created_at })));
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get user profile
router.get('/:id', authenticateToken, async (req: any, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { user_id: req.params.id as string },
      include: {
        user: true,
        pinned_track: true,
      },
    });
    // Apply privacy for last seen / online flags (simple: hide values, not the profile itself)
    const me = req.user.id as string;
    const target = req.params.id as string;
    const blocked = await prisma.userBlock.findFirst({
      where: {
        OR: [
          { blocker_id: me, blocked_id: target },
          { blocker_id: target, blocked_id: me },
        ],
      },
    });

    // If blocked either way, still allow profile basics but hide messaging-sensitive fields
    if (blocked && profile) {
      return res.json({
        ...profile,
        allow_online_status: false,
        allow_last_seen: false,
        allow_messages_from: 'NOBODY',
      });
    }

    if (me !== target && profile) {
      const friends = await areAcceptedFriends(me, target);
      if (
        (profile.profile_visibility === 'FRIENDS_ONLY' ||
          profile.profile_visibility === 'PRIVATE') &&
        !friends
      ) {
        return res.json(limitedProfilePayload(profile));
      }
    }

    res.json(profile);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update profile
router.put('/:id', authenticateToken, async (req: any, res: any) => {
  if (req.user.id !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const incoming = req.body || {};
    const { pinned_track_id, ...rest } = incoming;

    if (pinned_track_id !== undefined) {
      if (!pinned_track_id) {
        // allow unpin
        (rest as any).pinned_track_id = null;
      } else {
        const track = await prisma.musicTrack.findUnique({ where: { id: String(pinned_track_id) } });
        if (!track || track.user_id !== req.user.id) {
          return res.status(403).json({ error: 'FORBIDDEN' });
        }
        if (track.visibility !== 'PUBLIC') {
          return res.status(400).json({ error: 'Pinned track must be PUBLIC' });
        }
        (rest as any).pinned_track_id = String(pinned_track_id);
      }
    }

    const profile = await prisma.profile.update({
      where: { user_id: req.params.id },
      data: rest,
    });
    res.json(profile);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update privacy settings (subset)
router.patch('/:id/privacy', authenticateToken, async (req: any, res: any) => {
  if (req.user.id !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const {
    allow_online_status,
    allow_last_seen,
    allow_messages_from,
    profile_visibility,
    allow_friend_requests,
  } = req.body || {};
  try {
    const data: Record<string, unknown> = {};
    if (allow_online_status !== undefined) data.allow_online_status = !!allow_online_status;
    if (allow_last_seen !== undefined) data.allow_last_seen = !!allow_last_seen;
    if (allow_messages_from !== undefined) data.allow_messages_from = allow_messages_from;
    if (
      profile_visibility !== undefined &&
      ['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE'].includes(profile_visibility)
    ) {
      data.profile_visibility = profile_visibility;
    }
    if (allow_friend_requests !== undefined) data.allow_friend_requests = !!allow_friend_requests;

    const updated = await prisma.profile.update({
      where: { user_id: req.params.id },
      data: data as any,
    });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Search profiles
router.get('/', authenticateToken, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);

  const searchTerm = String(q).startsWith('@') ? String(q).slice(1) : String(q);
  const me = (req as any).user?.id as string;

  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ user_id: me }, { friend_id: me }],
      },
    });
    const friendIds = new Set(
      friendships.map((f) => (f.user_id === me ? f.friend_id : f.user_id))
    );

    const profiles = await prisma.profile.findMany({
      where: {
        AND: [
          {
            OR: [
              { username: { contains: searchTerm, mode: 'insensitive' } },
              { first_name: { contains: searchTerm, mode: 'insensitive' } },
              { last_name: { contains: searchTerm, mode: 'insensitive' } },
            ],
          },
          {
            OR: [
              { profile_visibility: { in: ['PUBLIC', 'FRIENDS_ONLY'] } },
              { user_id: me },
              { user_id: { in: Array.from(friendIds) } },
            ],
          },
        ],
      },
      take: 10,
    });
    res.json(profiles);
  } catch (error: any) {
    console.error("Search error:", error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
