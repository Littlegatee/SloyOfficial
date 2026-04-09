import express from 'express';
import prisma from '../prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all bookmarks for user
router.get('/', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  try {
    const bookmarks = await (prisma as any).bookmark.findMany({
      where: { user_id: userId },
      include: {
        post: {
          include: {
            user: { include: { profile: true } },
            community: true,
            likes: true
          }
        },
        product: {
          include: {
            community: true
          }
        },
        community: true
      },
      orderBy: { created_at: 'desc' }
    });
    res.json(bookmarks);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Add bookmark (post or product or community)
router.post('/', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  const { post_id, product_id, community_id } = req.body;

  if (!post_id && !product_id && !community_id) {
    return res.status(400).json({ error: "Need at least one ID" });
  }

  try {
    const bookmark = await (prisma as any).bookmark.create({
      data: {
        user_id: userId,
        post_id: post_id || null,
        product_id: product_id || null,
        community_id: community_id || null
      }
    });
    res.json(bookmark);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Remove bookmark
router.delete('/', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  const { post_id, product_id, community_id } = req.body;

  try {
    if (post_id) {
      await (prisma as any).bookmark.deleteMany({ where: { user_id: userId, post_id } });
    } else if (product_id) {
      await (prisma as any).bookmark.deleteMany({ where: { user_id: userId, product_id } });
    } else if (community_id) {
      await (prisma as any).bookmark.deleteMany({ where: { user_id: userId, community_id } });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
