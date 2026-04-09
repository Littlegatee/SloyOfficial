import express from 'express';
import prisma from '../prisma.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get orders for a community (for admins/owners)
router.get('/community/:communityId', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  const communityId = req.params.communityId;

  try {
    const member = await prisma.communityMember.findUnique({
      where: { community_id_user_id: { community_id: communityId, user_id: userId } }
    });

    if (!member || !['OWNER', 'ADMIN', 'PRODUCT_EDITOR'].includes(member.role)) {
      return res.status(403).json({ error: "Нет прав для просмотра заказов" });
    }

    const orders = await (prisma as any).order.findMany({
      where: { community_id: communityId },
      include: {
        user: { include: { profile: true } },
        product: true
      },
      orderBy: { created_at: 'desc' }
    });
    res.json(orders);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get user's orders
router.get('/me', authenticateToken, async (req: any, res) => {
  try {
    const orders = await (prisma as any).order.findMany({
      where: { user_id: req.user.id },
      include: {
        community: true,
        product: true
      },
      orderBy: { created_at: 'desc' }
    });
    res.json(orders);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Create an order
router.post('/', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  const { product_id, quantity, customer_note } = req.body;

  try {
    const product = await (prisma as any).communityProduct.findUnique({
      where: { id: product_id }
    });

    if (!product) return res.status(404).json({ error: "Товар не найден" });

    const order = await (prisma as any).order.create({
      data: {
        user_id: userId,
        community_id: product.community_id,
        product_id: product.id,
        quantity: quantity || 1,
        total_price: (product.price || 0) * (quantity || 1),
        currency: product.currency,
        customer_note
      },
      include: {
        product: true,
        community: true
      }
    });

    // In a real app, send notification to community admins here
    
    res.json(order);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update order status
router.patch('/:id/status', authenticateToken, async (req: any, res) => {
  const userId = req.user.id;
  const { status, admin_note } = req.body;

  try {
    const order = await (prisma as any).order.findUnique({
      where: { id: req.params.id }
    });

    if (!order) return res.status(404).json({ error: "Заказ не найден" });

    const member = await prisma.communityMember.findUnique({
      where: { community_id_user_id: { community_id: order.community_id, user_id: userId } }
    });

    if (!member || !['OWNER', 'ADMIN', 'PRODUCT_EDITOR'].includes(member.role)) {
      return res.status(403).json({ error: "Нет прав для изменения статуса заказа" });
    }

    const updatedOrder = await (prisma as any).order.update({
      where: { id: req.params.id },
      data: { status, admin_note },
      include: { user: { include: { profile: true } }, product: true }
    });

    res.json(updatedOrder);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
