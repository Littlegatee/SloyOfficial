import express from 'express';
import prisma from '../prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get trending tags (last 24 hours)
router.get('/trending', authenticateToken, async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    // Aggregate tags from PostTag joined with Post created in last 24h
    const trendingTags = await (prisma as any).postTag.groupBy({
      by: ['tag_id'],
      where: {
        post: {
          created_at: {
            gte: twentyFourHoursAgo
          }
        }
      },
      _count: {
        tag_id: true
      },
      orderBy: {
        _count: {
          tag_id: 'desc'
        }
      },
      take: 10
    });

    const tagIds = trendingTags.map((t: any) => t.tag_id);
    const tags = await (prisma as any).tag.findMany({
      where: {
        id: { in: tagIds }
      }
    });

    const result = trendingTags.map((t: any) => {
      const tag = tags.find((tg: any) => tg.id === t.tag_id);
      return {
        id: t.tag_id,
        name: tag?.name,
        count: t._count.tag_id
      };
    });

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get posts by tag name
router.get('/:tagName', authenticateToken, async (req: any, res) => {
  const { tagName } = req.params;
  const userId = req.user.id;
  try {
    const posts = await (prisma as any).post.findMany({
      where: {
        tags: {
          some: {
            tag: {
              name: tagName
            }
          }
        }
      },
      include: {
        user: { include: { profile: true } },
        community: true,
        likes: true,
        tags: { include: { tag: true } },
        poll: {
          include: {
            votes: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 50
    });
    res.json(posts);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
