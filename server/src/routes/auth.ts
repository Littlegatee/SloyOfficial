import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prisma.js';

const router = express.Router();

function signUserToken(user: { id: string; email: string }) {
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).trim() === '') {
    const e = new Error('JWT_SECRET_MISSING');
    (e as any).statusCode = 503;
    throw e;
  }
  return jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: '7d' });
}

// Register
router.post('/register', async (req, res) => {
  const { email, password, username, first_name, last_name } = req.body || {};

  if (!email || !password || !username || !first_name) {
    return res.status(400).json({ error: 'Нужны email, пароль, никнейм и имя' });
  }

  const emailNorm = String(email).trim().toLowerCase();
  const usernameNorm = String(username).trim();

  try {
    const hashedPassword = await bcrypt.hash(String(password), 10);
    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        password: hashedPassword,
        profile: {
          create: {
            username: usernameNorm,
            first_name: String(first_name).trim(),
            last_name: last_name ? String(last_name).trim() : '',
          },
        },
      },
      include: {
        profile: true,
      },
    });

    const token = signUserToken(user);
    res.json({ user, token });
  } catch (error: any) {
    if (error?.message === 'JWT_SECRET_MISSING' || error?.statusCode === 503) {
      return res.status(503).json({
        error:
          'Сервер не настроен: в переменных окружения не задан JWT_SECRET. Добавьте его в Render → Environment.',
      });
    }
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
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Укажите email и пароль' });
  }

  const emailNorm = String(email).trim().toLowerCase();

  try {
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: emailNorm, mode: 'insensitive' },
      },
      include: { profile: true },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const token = signUserToken(user);
    res.json({ user, token });
  } catch (error: any) {
    if (error?.message === 'JWT_SECRET_MISSING' || error?.statusCode === 503) {
      return res.status(503).json({
        error:
          'Сервер не настроен: в переменных окружения не задан JWT_SECRET. Добавьте его в Render → Environment.',
      });
    }
    console.error('[auth/login]', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

export default router;
