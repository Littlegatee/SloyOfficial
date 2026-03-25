import express from 'express';
import prisma from '../prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get profile
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { user_id: req.params.id },
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

  try {
    const profiles = await prisma.profile.findMany({
      where: {
        OR: [
          { username: { contains: String(q), mode: 'insensitive' } },
          { first_name: { contains: String(q), mode: 'insensitive' } },
        ],
      },
      limit: 10,
    } as any);
    res.json(profiles);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
