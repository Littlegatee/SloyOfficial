import express from 'express';
import prisma from '../prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get product reviews
router.get('/product/:productId', authenticateToken, async (req: any, res) => {
  try {
    const reviews = await (prisma as any).productReview.findMany({
      where: { product_id: req.params.productId },
      include: { user: { include: { profile: true } } },
      orderBy: { created_at: 'desc' }
    });
    res.json(reviews);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Create/Update product review
router.post('/product/:productId', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  const productId = req.params.productId;
  const { rating, text } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Рейтинг должен быть от 1 до 5" });
  }

  try {
    const review = await (prisma as any).productReview.upsert({
      where: { product_id_user_id: { product_id: productId, user_id: userId } },
      update: { rating, text, created_at: new Date() },
      create: { product_id: productId, user_id: userId, rating, text }
    });
    res.json(review);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get community ratings
router.get('/community/:communityId', authenticateToken, async (req: any, res) => {
  try {
    const ratings = await (prisma as any).communityRating.findMany({
      where: { community_id: req.params.communityId },
      include: { user: { include: { profile: true } } },
      orderBy: { created_at: 'desc' }
    });
    
    const avg = await (prisma as any).communityRating.aggregate({
      where: { community_id: req.params.communityId },
      _avg: { rating: true },
      _count: { rating: true }
    });

    res.json({ ratings, average: avg._avg.rating || 0, count: avg._count.rating });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Create/Update community rating
router.post('/community/:communityId', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  const communityId = req.params.communityId;
  const { rating, review_text } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Рейтинг должен быть от 1 до 5" });
  }

  try {
    const commRating = await (prisma as any).communityRating.upsert({
      where: { community_id_user_id: { community_id: communityId, user_id: userId } },
      update: { rating, review_text, created_at: new Date() },
      create: { community_id: communityId, user_id: userId, rating, review_text }
    });
    res.json(commRating);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
