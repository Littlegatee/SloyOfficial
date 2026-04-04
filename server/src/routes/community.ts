import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import prisma, { withDbReconnectRetry } from '../prisma.js';

const router = express.Router();

function sanitizePostsForClient(posts: any[], viewerId: string) {
  return posts.map((p) => {
    const likes = p.likes;
    const liked_by_me = Array.isArray(likes) && likes.some((l: any) => l.user_id === viewerId);
    const { likes: _drop, ...rest } = p;
    return { ...rest, liked_by_me };
  });
}

// Explore communities (not joined yet)
// IMPORTANT: must be defined before '/:id' routes
router.get('/explore/all', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  try {
    const communities = await prisma.community.findMany({
      where: {
        NOT: {
          members: {
            some: {
              user_id: userId
            }
          }
        }
      },
      include: {
        _count: { select: { members: true } }
      },
      take: 20
    });
    res.json(communities);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get all communities user is part of
router.get('/', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  try {
    const memberships = await prisma.communityMember.findMany({
      where: { user_id: userId },
      include: {
        community: {
          include: {
            _count: { select: { members: true } }
          }
        }
      }
    });
    res.json(memberships.map((m: any) => ({ ...m.community, role: m.role })));
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Create community
router.post('/', authenticateToken, async (req: any, res) => {
  const { name, description, type, avatar_url, cover_url } = req.body;
  const userId = req.user.id;

  try {
    const community = await prisma.community.create({
      data: {
        name,
        description,
        type,
        avatar_url,
        cover_url,
        members: {
          create: {
            user_id: userId,
            role: 'OWNER'
          }
        }
      },
      include: {
        _count: { select: { members: true } }
      }
    });
    res.json(community);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/members', authenticateToken, async (req: any, res) => {
  const communityId = req.params.id;
  const skip = Math.min(Number(req.query.skip) || 0, 10000);
  const take = Math.min(Number(req.query.take) || 80, 100);
  try {
    const members = await prisma.communityMember.findMany({
      where: { community_id: communityId },
      include: { user: { include: { profile: true } } },
      orderBy: { joined_at: 'asc' },
      skip,
      take,
    });
    res.json(members);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/:id/members/:memberUserId', authenticateToken, async (req: any, res) => {
  const communityId = req.params.id;
  const memberUserId = req.params.memberUserId;
  const { role } = req.body || {};
  const ownerId = req.user.id as string;

  try {
    const ownerMembership = await prisma.communityMember.findUnique({
      where: { community_id_user_id: { community_id: communityId, user_id: ownerId } },
    });
    if (!ownerMembership || ownerMembership.role !== 'OWNER') {
      return res.status(403).json({ error: 'Только владелец может назначать и снимать роли' });
    }
    if (memberUserId === ownerId) {
      return res.status(400).json({ error: 'Нельзя изменить свою роль владельца' });
    }

    const target = await prisma.communityMember.findUnique({
      where: { community_id_user_id: { community_id: communityId, user_id: memberUserId } },
    });
    if (!target) return res.status(404).json({ error: 'Участник не найден' });
    if (target.role === 'OWNER') {
      return res.status(400).json({ error: 'Нельзя изменить владельца' });
    }

    const allowed = ['MEMBER', 'MODERATOR', 'ADMIN'];
    if (!role || !allowed.includes(role)) {
      return res.status(400).json({ error: 'Укажите роль: MEMBER, MODERATOR или ADMIN' });
    }

    const updated = await prisma.communityMember.update({
      where: { id: target.id },
      data: { role },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get community details
router.get('/:id', authenticateToken, async (req: any, res) => {
  try {
    const community = await withDbReconnectRetry(() => prisma.community.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { members: true } },
        members: {
          where: { user_id: req.user.id }
        }
      }
    }));

    if (!community) {
      return res.status(404).json({ error: "Сообщество не найдено" });
    }

    const role = community.members[0]?.role ?? null;
    const { members, ...communityData } = community;
    
    res.json({ ...communityData, role });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Join community
router.post('/:id/join', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  const communityId = req.params.id;

  try {
    const member = await prisma.communityMember.create({
      data: {
        user_id: userId,
        community_id: communityId,
        role: 'MEMBER'
      }
    });
    res.json(member);
  } catch (error: any) {
    res.status(400).json({ error: "Уже в сообществе или ошибка" });
  }
});

// Leave community
router.post('/:id/leave', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  const communityId = req.params.id;

  try {
    // Check if owner
    const member = await prisma.communityMember.findUnique({
      where: {
        community_id_user_id: {
          community_id: communityId,
          user_id: userId
        }
      }
    });

    if (member?.role === 'OWNER') {
      return res.status(400).json({ error: "Владелец не может покинуть сообщество, сначала передайте права или удалите его." });
    }

    await prisma.communityMember.delete({
      where: {
        community_id_user_id: {
          community_id: communityId,
          user_id: userId
        }
      }
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update community
router.put('/:id', authenticateToken, async (req: any, res) => {
  const { name, description, avatar_url, cover_url } = req.body;
  const userId = req.user.id;
  const communityId = req.params.id;

  try {
    const member = await prisma.communityMember.findUnique({
      where: {
        community_id_user_id: { community_id: communityId, user_id: userId }
      }
    });

    if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
      return res.status(403).json({ error: "Нет прав для редактирования" });
    }

    const updated = await prisma.community.update({
      where: { id: communityId },
      data: { name, description, avatar_url, cover_url }
    });
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get community posts
router.get('/:id/posts', authenticateToken, async (req: any, res) => {
  try {
    const posts = await prisma.post.findMany({
      where: { community_id: req.params.id, author_type: 'COMMUNITY' },
      include: {
        user: { include: { profile: true } },
        community: true,
        likes: true
      },
      orderBy: { created_at: 'desc' }
    });
    res.json(sanitizePostsForClient(posts, req.user.id));
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;