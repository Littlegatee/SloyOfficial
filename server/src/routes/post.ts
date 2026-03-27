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
    console.error("GET /posts error:", error);
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
    console.error("POST /posts error:", error);
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

// Update post
router.put('/:id', authenticateToken, async (req: any, res: any) => {
  const { content_text } = req.body;
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Not found' });
    if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const updatedPost = await prisma.post.update({
      where: { id: req.params.id },
      data: { content_text, is_edited: true },
    });
    res.json(updatedPost);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete post
router.delete('/:id', authenticateToken, async (req: any, res: any) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'Not found' });
    if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    await prisma.post.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get comments for a post
router.get('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const comments = await prisma.comment.findMany({
      where: { post_id: req.params.id as string },
      include: {
        user: {
          include: { profile: true },
        },
        likes: true,
      },
      orderBy: { created_at: 'asc' },
    });
    res.json(comments);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Create comment for a post
router.post('/:id/comments', authenticateToken, async (req: any, res) => {
  const { content_text, parent_id } = req.body;
  try {
    const comment = await prisma.comment.create({
      data: {
        post_id: req.params.id,
        user_id: req.user.id,
        content_text,
        parent_id: parent_id || null,
      },
      include: {
        user: {
          include: { profile: true },
        },
        likes: true,
      }
    });
    await prisma.post.update({
      where: { id: req.params.id },
      data: { comments_count: { increment: 1 } },
    });
    res.json(comment);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Like/Unlike comment
router.post('/comments/:id/like', authenticateToken, async (req: any, res) => {
  const commentId = req.params.id;
  const userId = req.user.id;

  try {
    const comment = await prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    const existingLike = await prisma.commentLike.findUnique({
      where: {
        comment_id_user_id: { comment_id: commentId, user_id: userId },
      },
    });

    if (existingLike) {
      await prisma.commentLike.delete({
        where: { id: existingLike.id },
      });
      await prisma.comment.update({
        where: { id: commentId },
        data: { likes_count: { decrement: 1 } },
      });
      res.json({ liked: false });
    } else {
      await prisma.commentLike.create({
        data: { comment_id: commentId, user_id: userId },
      });
      await prisma.comment.update({
        where: { id: commentId },
        data: { likes_count: { increment: 1 } },
      });
      res.json({ liked: true });
    }
  } catch (error: any) {
    console.error("Comment like error:", error);
    res.status(400).json({ error: error.message });
  }
});

export default router;
