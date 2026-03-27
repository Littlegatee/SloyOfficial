import express from 'express';
import prisma from '../prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get user profile
router.get('/:id', authenticateToken, async (req: any, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { user_id: req.params.id as string },
      include: {
        user: true,
      },
    });
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
    const profile = await prisma.profile.update({
      where: { user_id: req.params.id },
      data: req.body,
    });
    res.json(profile);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Search profiles
router.get('/', authenticateToken, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);

  const searchTerm = String(q).startsWith('@') ? String(q).slice(1) : String(q);

  try {
    const profiles = await prisma.profile.findMany({
      where: {
        OR: [
          { username: { contains: searchTerm, mode: 'insensitive' } },
          { first_name: { contains: searchTerm, mode: 'insensitive' } },
          { last_name: { contains: searchTerm, mode: 'insensitive' } },
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
