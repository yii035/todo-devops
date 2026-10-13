import { Router } from 'express';
import { z } from 'zod';
import { BudgetModel } from '../models/Budget.js';
import { CategoryModel } from '../models/Category.js';
import { DebtModel } from '../models/Debt.js';
import { NotificationModel } from '../models/Notification.js';
import { budgetUsage, dayEnd, debtOutstanding, objectId, vietnamDate } from '../utils/mongoFinance.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const syncWarnings = async (userId: string) => {
  const [budgets, debts] = await Promise.all([
    BudgetModel.find({ userId }),
    DebtModel.find({ userId, dueDate: { $lte: dayEnd(new Date(Date.now() + 7 * 86_400_000).toISOString()) } }),
  ]);
  const categoryIds = budgets.map((budget) => budget.categoryId);
  const categories = await CategoryModel.find({ _id: { $in: categoryIds } }).select('name').lean();
  const names = new Map(categories.map((category) => [String(category._id), category.name]));
  const notifications: Array<{ userId: string; type: 'BUDGET' | 'DEBT'; title: string; message: string; deduplicationKey: string }> = [];

  for (const budget of budgets) {
    const usage = await budgetUsage(userId, budget.categoryId, budget.periodStart, budget.periodEnd, budget.amountLimit);
    if (usage.usagePercentage < 80) continue;
    const exceeded = usage.usagePercentage >= 100;
    notifications.push({
      userId,
      type: 'BUDGET',
      title: exceeded ? 'Ngân sách đã vượt hạn mức' : 'Ngân sách sắp chạm giới hạn',
      message: `Ngân sách ${names.get(budget.categoryId.toString()) ?? 'danh mục'} đã sử dụng ${Math.round(usage.usagePercentage)}%.`,
      deduplicationKey: `budget-${budget.id}-${exceeded ? 'exceeded' : 'near'}`,
    });
  }
  for (const debt of debts) {
    const outstandingAmount = await debtOutstanding(userId, debt._id, debt.principalAmount);
    if (!outstandingAmount) continue;
    const days = Math.ceil((debt.dueDate.getTime() - Date.now()) / 86_400_000);
    const overdue = days < 0;
    notifications.push({
      userId,
      type: 'DEBT',
      title: overdue ? 'Khoản nợ đã quá hạn' : 'Khoản nợ sắp đến hạn',
      message: `${debt.personName}: còn ${outstandingAmount.toLocaleString('vi-VN')}đ, ${overdue ? 'đã quá hạn' : `đến hạn sau ${days} ngày`}.`,
      deduplicationKey: `debt-${debt.id}-${overdue ? 'overdue' : vietnamDate(debt.dueDate)}`,
    });
  }
  if (notifications.length) {
    await NotificationModel.bulkWrite(notifications.map((notification) => ({
      updateOne: {
        filter: { userId: objectId(userId), deduplicationKey: notification.deduplicationKey },
        update: { $setOnInsert: { ...notification, userId: objectId(userId), isRead: false } },
        upsert: true,
      },
    })));
  }
};

router.get('/', requireAuth, async (req: AuthRequest, res, next) => {
  const parsed = z.object({ unreadOnly: z.enum(['true', 'false']).default('false') }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ success: false, message: 'Invalid notification filters.' });
  try {
    await syncWarnings(req.user!.id);
    const filter = { userId: req.user!.id, ...(parsed.data.unreadOnly === 'true' ? { isRead: false } : {}) };
    const [notifications, unreadCount] = await Promise.all([
      NotificationModel.find(filter).sort({ createdAt: -1 }).limit(100),
      NotificationModel.countDocuments({ userId: req.user!.id, isRead: false }),
    ]);
    return res.json({ success: true, data: notifications, meta: { unreadCount } });
  } catch (error) {
    return next(error);
  }
});

router.patch('/read-all', requireAuth, async (req: AuthRequest, res, next) => {
  try {
    await NotificationModel.updateMany({ userId: req.user!.id, isRead: false }, { $set: { isRead: true } });
    return res.json({ success: true, data: { unreadCount: 0 } });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/read', requireAuth, async (req: AuthRequest, res, next) => {
  const id = objectId(req.params.id.toString());
  if (!id) return res.status(400).json({ success: false, message: 'Invalid notification ID.' });
  try {
    const notification = await NotificationModel.findOneAndUpdate(
      { _id: id, userId: req.user!.id },
      { $set: { isRead: true } },
      { new: true },
    );
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });
    return res.json({ success: true, data: notification });
  } catch (error) {
    return next(error);
  }
});

export default router;
