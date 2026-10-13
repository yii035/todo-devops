import mongoose from 'mongoose';
import { AccountModel } from '../models/Account.js';
import { BudgetModel } from '../models/Budget.js';
import { CategoryModel } from '../models/Category.js';
import { DebtModel } from '../models/Debt.js';
import { DebtPaymentModel } from '../models/DebtPayment.js';
import { TransactionModel } from '../models/Transaction.js';

export const objectId = (value: string) =>
  mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null;

export const activeOwnedAccount = (userId: string, accountId: string) => {
  const _id = objectId(accountId);
  return _id ? AccountModel.findOne({ _id, userId, isArchived: false }) : null;
};

export const usableCategory = (userId: string, categoryId: string, type: 'INCOME' | 'EXPENSE') => {
  const _id = objectId(categoryId);
  if (!_id) return null;
  return CategoryModel.findOne({
    _id,
    type,
    isArchived: false,
    $or: [{ isSystem: true, userId: null }, { isSystem: false, userId }],
  });
};

export const accountBalance = async (userId: string, accountId: mongoose.Types.ObjectId, openingBalance: number) => {
  const [transactions, payments] = await Promise.all([
    TransactionModel.find({ userId, $or: [{ accountId }, { destinationAccountId: accountId }] })
      .select('type amount accountId destinationAccountId').lean(),
    DebtPaymentModel.find({ userId, accountId }).select('debtId amount').lean(),
  ]);
  let balance = openingBalance;
  for (const transaction of transactions) {
    const source = transaction.accountId.toString() === accountId.toString();
    if (transaction.type === 'INCOME' && source) balance += transaction.amount;
    if ((transaction.type === 'EXPENSE' || transaction.type === 'TRANSFER') && source) balance -= transaction.amount;
    if (transaction.type === 'TRANSFER' && !source) balance += transaction.amount;
  }
  if (payments.length) {
    const debtIds = [...new Set(payments.map((payment) => payment.debtId.toString()))];
    const debts = await DebtModel.find({ userId, _id: { $in: debtIds } }).select('_id type').lean();
    const debtsById = new Map(debts.map((debt) => [String(debt._id), debt.type]));
    for (const payment of payments) {
      const type = debtsById.get(payment.debtId.toString());
      if (type === 'BORROWED') balance -= payment.amount;
      if (type === 'LENT') balance += payment.amount;
    }
  }
  return balance;
};

export const budgetUsage = async (
  userId: string,
  categoryId: mongoose.Types.ObjectId,
  periodStart: Date,
  periodEnd: Date,
  amountLimit: number,
) => {
  const [result] = await TransactionModel.aggregate<{ spent: number }>([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        categoryId,
        type: 'EXPENSE',
        transactionDate: { $gte: periodStart, $lte: periodEnd },
      },
    },
    { $group: { _id: null, spent: { $sum: '$amount' } } },
  ]);
  const spent = result?.spent ?? 0;
  return {
    spent,
    remaining: amountLimit - spent,
    usagePercentage: amountLimit === 0 ? (spent === 0 ? 0 : 100) : (spent / amountLimit) * 100,
  };
};

export const debtOutstanding = async (userId: string, debtId: mongoose.Types.ObjectId, principalAmount: number) => {
  const [result] = await DebtPaymentModel.aggregate<{ paid: number }>([
    { $match: { userId: new mongoose.Types.ObjectId(userId), debtId } },
    { $group: { _id: null, paid: { $sum: '$amount' } } },
  ]);
  return Math.max(0, principalAmount - (result?.paid ?? 0));
};

export const vietnamDate = (date: Date | string) => {
  const value = typeof date === 'string' ? date : date.toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
};

export const dayStart = (date: string) => new Date(`${vietnamDate(date)}T00:00:00+07:00`);
export const dayEnd = (date: string) => new Date(`${vietnamDate(date)}T23:59:59.999+07:00`);

export const userObjectId = (userId: string) => new mongoose.Types.ObjectId(userId);

export const formatBudget = async (userId: string, budget: any) => {
  const [category, usage] = await Promise.all([
    CategoryModel.findById(budget.categoryId).select('name').lean(),
    budgetUsage(userId, budget.categoryId, budget.periodStart, budget.periodEnd, budget.amountLimit),
  ]);
  return { ...budget.toJSON(), categoryName: (category as { name?: string } | null)?.name ?? 'Archived category', ...usage };
};

export const formatDebt = async (userId: string, debt: any) => ({
  ...debt.toJSON(),
  outstandingAmount: await debtOutstanding(userId, debt._id, debt.principalAmount),
});

export const getAccountById = (userId: string, accountId: string) => {
  const _id = objectId(accountId);
  return _id ? AccountModel.findOne({ _id, userId }) : null;
};

export const getBudgetById = (userId: string, budgetId: string) => {
  const _id = objectId(budgetId);
  return _id ? BudgetModel.findOne({ _id, userId }) : null;
};
