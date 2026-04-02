import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma.js';

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  const { email, password, username, first_name, last_name } = req.body || {};

  if (!email || !password || !username || !first_name) {
    return res.status(400).json({ error: 'Нужны email, пароль, никнейм и имя' });
  }

  try {
    const hashedPassword = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        profile: {
          create: {
            username,
            first_name,
            last_name: last_name || '',
          },
        },
      },
      include: {
        profile: true,
      },
    });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET as string, { expiresIn: '7d' });
    res.json({ user, token });
  } catch (error: any) {
    const code = error?.code;
    if (code === 'P2002') {
      const target = error?.meta?.target;
      const field = Array.isArray(target) ? target.join(', ') : String(target || '');
      if (field.includes('email')) {
        return res.status(400).json({ error: 'Этот email уже зарегистрирован' });
      }
      if (field.includes('username')) {
        return res.status(400).json({ error: 'Этот никнейм уже занят' });
      }
      return res.status(400).json({ error: 'Такой email или никнейм уже занят' });
    }
    res.status(400).json({ error: error?.message || 'Не удалось зарегистрироваться' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET as string, { expiresIn: '7d' });
    res.json({ user, token });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
