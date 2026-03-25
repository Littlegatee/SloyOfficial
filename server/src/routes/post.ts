import express from 'express';
import prisma from '../prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get feed
router.get('/', authenticateToken, async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      include: {
        user: {
          include: { profile: true },
        },
        likes: true,
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
    res.json(posts);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Create post
router.post('/', authenticateToken, async (req: any, res) => {
  const { content_text, media_type, media_url } = req.body;
  try {
    const post = await prisma.post.create({
      data: {
        user_id: req.user.id,
        content_text,
        media_type,
        media_url,
      },
    });
    res.json(post);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Like/Unlike post
router.post('/:id/like', authenticateToken, async (req: any, res) => {
  const postId = req.params.id;
  const userId = req.user.id;

  try {
    const existingLike = await prisma.like.findUnique({
      where: {
        post_id_user_id: { post_id: postId, user_id: userId },
      },
    });

    if (existingLike) {
      await prisma.like.delete({
        where: { id: existingLike.id },
      });
      await prisma.post.update({
        where: { id: postId },
        data: { likes_count: { decrement: 1 } },
      });
      res.json({ liked: false });
    } else {
      await prisma.like.create({
        data: { post_id: postId, user_id: userId },
      });
      await prisma.post.update({
        where: { id: postId },
        data: { likes_count: { increment: 1 } },
      });
      res.json({ liked: true });
    }
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
