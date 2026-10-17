import { Router, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { answerProjectQuestion } from '../services/chatbot.js';

const router = Router();
const messageSchema = z.object({ message: z.string().trim().min(1).max(1000) }).strict();
const requestWindowMs = 60_000;
const requestLimit = 15;
const requestCounts = new Map<string, { count: number; windowStartedAt: number }>();

const enforceChatRateLimit = (req: AuthRequest, res: Response, next: NextFunction) => {
  const now = Date.now();
  for (const [userId, window] of requestCounts) {
    if (now - window.windowStartedAt >= requestWindowMs) requestCounts.delete(userId);
  }

  const userId = req.user!.id;
  const current = requestCounts.get(userId);
  if (!current || now - current.windowStartedAt >= requestWindowMs) {
    requestCounts.set(userId, { count: 1, windowStartedAt: now });
    return next();
  }
  if (current.count >= requestLimit) {
    return res.status(429).json({ success: false, message: 'Bạn đã gửi quá nhiều câu hỏi. Vui lòng thử lại sau một phút.' });
  }
  current.count += 1;
  return next();
};

router.post('/', requireAuth, enforceChatRateLimit, async (req: AuthRequest, res, next) => {
  const parsed = messageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Câu hỏi không hợp lệ. Nội dung tối đa 1000 ký tự.' });
  }
  try {
    const result = await answerProjectQuestion(parsed.data.message);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Chatbot request failed.', error instanceof Error ? error.name : 'UnknownError');
    return res.status(502).json({ success: false, message: 'Chatbot tạm thời không thể trả lời. Vui lòng thử lại sau.' });
  }
});

export default router;
