import express from 'express';
import prisma from '../prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { io } from '../socket.js';

const router = express.Router();

function stableHashToUnitInterval(input: string) {
  // Simple deterministic hash -> [0, 1)
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Convert to unsigned and scale
  return (hash >>> 0) / 4294967296;
}

function hoursSince(date: Date) {
  return (Date.now() - date.getTime()) / 36e5;
}

function sanitizePostsForClient(posts: any[], viewerId: string) {
  return posts.map((p) => {
    const likes = p.likes;
    const liked_by_me = Array.isArray(likes) && likes.some((l: any) => l.user_id === viewerId);
    const { likes: _drop, ...rest } = p;
    return { ...rest, liked_by_me };
  });
}

// Get feed
router.get('/', authenticateToken, async (req: any, res) => {
  const { recommendation_type, user_id: filterUserId } = req.query; // 'friends', 'main' + profile filter
  const userId = req.user.id;

  try {
    if (filterUserId) {
      const targetId = String(filterUserId);
      if (targetId !== userId) {
        const targetProfile = await prisma.profile.findUnique({
          where: { user_id: targetId },
        });
        if (targetProfile) {
          const friendship = await prisma.friendship.findFirst({
            where: {
              status: 'ACCEPTED',
              OR: [
                { user_id: userId, friend_id: targetId },
                { user_id: targetId, friend_id: userId },
              ],
            },
          });
          const isFriend = !!friendship;
          if (
            (targetProfile.profile_visibility === 'FRIENDS_ONLY' ||
              targetProfile.profile_visibility === 'PRIVATE') &&
            !isFriend
          ) {
            return res.json([]);
          }
        }
      }
      const raw = await prisma.post.findMany({
        where: { user_id: targetId, author_type: 'USER' },
        include: {
          user: { include: { profile: true } },
          community: true,
          likes: true,
        },
        orderBy: { created_at: 'desc' },
        take: 80,
      });
      return res.json(sanitizePostsForClient(raw, userId));
    }

    let posts = await prisma.post.findMany({
      include: {
        user: {
          include: { profile: true },
        },
        community: true,
        likes: true,
      },
      orderBy: { created_at: 'desc' },
      take: 80,
    });

    const friends = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ user_id: userId }, { friend_id: userId }]
      }
    });
    const friendIds = new Set(friends.map(f => f.user_id === userId ? f.friend_id : f.user_id));
    friendIds.add(userId); // include own posts

    if (recommendation_type === 'friends') {
      // Show only friends' personal posts
      posts = posts.filter(p => p.author_type === 'USER' && friendIds.has(p.user_id));
    } else {
      // Main feed: Friends, Subscribed Communities, and Recommendations
      const myCommunities = await prisma.communityMember.findMany({
        where: { user_id: userId },
        select: { community_id: true }
      });
      const myCommunityIds = new Set(myCommunities.map(c => c.community_id));

      const friendLikes = await prisma.like.findMany({
        where: { user_id: { in: Array.from(friendIds) } },
        select: { post_id: true }
      });
      const likedPostIds = new Set(friendLikes.map(l => l.post_id));

      // Calculate deterministic score for recommendation:
      // - prioritize friends + subscribed communities
      // - boost posts that friends liked
      // - decay by age (freshness)
      // - small stable per-user jitter for discovery without "jumping"
      posts.forEach(p => {
        let score = 0;

        const isFriendUserPost = p.author_type === 'USER' && friendIds.has(p.user_id);
        const isSubscribedCommunityPost =
          p.author_type === 'COMMUNITY' && !!p.community_id && myCommunityIds.has(p.community_id);
        const isLikedByFriends = likedPostIds.has(p.id);

        if (isFriendUserPost) score += 120;
        if (isSubscribedCommunityPost) score += 90;
        if (isLikedByFriends) score += 45;

        // Popularity signal (very light, to avoid "rich get richer")
        const popularity =
          Math.min((p.likes_count || 0), 50) * 0.3 +
          Math.min((p.comments_count || 0), 30) * 0.5;
        score += popularity;

        // Freshness decay: ~24h half-life-ish (tunable)
        const ageHours = hoursSince(new Date(p.created_at as any));
        const freshness = Math.exp(-ageHours / 24);
        score += freshness * 60;

        // Stable discovery jitter (0..12)
        score += stableHashToUnitInterval(`${userId}:${p.id}`) * 12;

        (p as any).score = score;
      });

      // Sort by score (desc). Tie-break by created_at desc for stability.
      posts.sort((a: any, b: any) => b.score - a.score);
      posts.sort((a: any, b: any) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      posts = posts.slice(0, 50); // limit back to 50
    }

    res.json(sanitizePostsForClient(posts, userId));
  } catch (error: any) {
    console.error("GET /posts error:", error);
    res.status(400).json({ error: error.message });
  }
});

// Create post
router.post('/', authenticateToken, async (req: any, res) => {
  const { content_text, media_type, media_url, author_type, community_id } = req.body;
  const userId = req.user.id;
  
  try {
    const normalizedAuthorType = (author_type || 'USER') as 'USER' | 'COMMUNITY';

    if (normalizedAuthorType === 'COMMUNITY' && !community_id) {
      return res.status(400).json({ error: "Для поста от имени сообщества нужен community_id" });
    }

    // If posting as community, verify permissions
    if (normalizedAuthorType === 'COMMUNITY' && community_id) {
      const member = await prisma.communityMember.findUnique({
        where: {
          community_id_user_id: {
            community_id,
            user_id: userId
          }
        }
      });

      if (!member) {
        return res.status(403).json({ error: "Вы не состоите в этом сообществе" });
      }

      const community = await prisma.community.findUnique({ where: { id: community_id } });
      const canWriteChannel = ['OWNER', 'ADMIN', 'MODERATOR'].includes(member.role as string);
      if (community?.type === 'CHANNEL' && !canWriteChannel) {
        return res.status(403).json({ error: "Писать в канал могут только модераторы и администраторы" });
      }
    }

    const post = await prisma.post.create({
      data: {
        user_id: userId,
        content_text,
        media_type,
        media_url,
        author_type: normalizedAuthorType,
        community_id: normalizedAuthorType === 'COMMUNITY' ? (community_id as string) : null
      },
      include: {
        user: { include: { profile: true } },
        community: true,
        likes: true
      }
    });

    const sanitized = sanitizePostsForClient([post], userId)[0];
    io.emit('new_post', sanitized);
    res.json(sanitized);
  } catch (error: any) {
    console.error("POST /posts error:", error);
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/likes', authenticateToken, async (req: any, res) => {
  try {
    const likes = await prisma.like.findMany({
      where: { post_id: req.params.id },
      include: { user: { include: { profile: true } } },
      orderBy: { created_at: 'desc' },
      take: 300,
    });
    res.json(likes);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id', authenticateToken, async (req: any, res) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      include: {
        user: { include: { profile: true } },
        community: true,
        likes: true,
      },
    });
    if (!post) return res.status(404).json({ error: 'Not found' });
    res.json(sanitizePostsForClient([post], req.user.id)[0]);
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
    const userId = req.user.id as string;
    if (post.user_id === userId) {
      await prisma.post.delete({ where: { id: req.params.id } });
      return res.json({ success: true });
    }
    if (post.author_type === 'COMMUNITY' && post.community_id) {
      const member = await prisma.communityMember.findUnique({
        where: {
          community_id_user_id: { community_id: post.community_id, user_id: userId },
        },
      });
      if (member && ['OWNER', 'ADMIN', 'MODERATOR'].includes(member.role as string)) {
        await prisma.post.delete({ where: { id: req.params.id } });
        return res.json({ success: true });
      }
    }
    return res.status(403).json({ error: 'Forbidden' });
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
