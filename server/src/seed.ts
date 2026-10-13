import mongoose from 'mongoose';
import { AccountModel } from './models/Account.js';
import { BudgetModel } from './models/Budget.js';
import { CategoryModel } from './models/Category.js';
import { DebtModel } from './models/Debt.js';
import { DebtPaymentModel } from './models/DebtPayment.js';
import { NotificationModel } from './models/Notification.js';
import { TransactionModel } from './models/Transaction.js';
import { UserModel } from './models/User.js';
import { env } from './config/env.js';
import { hashPassword } from './utils/auth.js';
import { dayEnd, dayStart } from './utils/mongoFinance.js';

const seedDemo = async () => {
  await mongoose.connect(env.mongoUri);
  const demoUser = await UserModel.findOneAndUpdate(
    { email: 'demo@fintrack.local' },
    {
      $setOnInsert: {
        name: 'Demo User',
        email: 'demo@fintrack.local',
        passwordHash: await hashPassword('password123'),
        defaultCurrency: 'VND',
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const accountSpecs = [
    { name: 'Cash', type: 'CASH' as const, openingBalance: 5_000_000 },
    { name: 'Bank Account', type: 'BANK' as const, openingBalance: 12_000_000 },
  ];
  const accounts = await Promise.all(accountSpecs.map((spec) =>
    AccountModel.findOneAndUpdate(
      { userId: demoUser._id, name: spec.name },
      { $setOnInsert: { ...spec, userId: demoUser._id, currency: 'VND', isArchived: false } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ),
  ));
  const [cash, bank] = accounts;

  const categorySpecs = [
    { name: 'Salary', type: 'INCOME', icon: '💰', color: '#16a34a' },
    { name: 'Allowance', type: 'INCOME', icon: '🎁', color: '#10b981' },
    { name: 'Food', type: 'EXPENSE', icon: '🍽️', color: '#f59e0b' },
    { name: 'Transportation', type: 'EXPENSE', icon: '🚗', color: '#ef4444' },
    { name: 'Shopping', type: 'EXPENSE', icon: '🛍️', color: '#8b5cf6' },
  ];
  const categories = await Promise.all(categorySpecs.map((spec) =>
    CategoryModel.findOneAndUpdate(
      { userId: demoUser._id, name: spec.name, type: spec.type },
      { $setOnInsert: { ...spec, userId: demoUser._id, isSystem: false, isArchived: false } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ),
  ));
  const categoryByName = new Map(categories.map((category) => [category.name, category]));

  const now = new Date();
  for (let offset = -5; offset <= 0; offset += 1) {
    const monthDate = (day: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, day, 3));
    const transactions = [
      { title: 'Salary', type: 'INCOME', amount: 25_000_000, categoryId: categoryByName.get('Salary')!._id, accountId: bank!._id },
      { title: 'Groceries', type: 'EXPENSE', amount: 5_000_000, categoryId: categoryByName.get('Food')!._id, accountId: cash!._id },
      { title: 'Transportation', type: 'EXPENSE', amount: 1_200_000, categoryId: categoryByName.get('Transportation')!._id, accountId: bank!._id },
      { title: 'Freelance', type: 'INCOME', amount: 5_500_000, categoryId: categoryByName.get('Allowance')!._id, accountId: bank!._id },
    ];
    for (const [index, transaction] of transactions.entries()) {
      const transactionDate = monthDate([1, 5, 7, 9][index]!);
      const accountId = transaction.title === 'Groceries' ? bank!._id : transaction.accountId;
      if (transaction.title === 'Groceries') {
        await TransactionModel.updateOne(
          { userId: demoUser._id, title: transaction.title, transactionDate, accountId: cash!._id },
          { $set: { accountId } },
        );
      }
      await TransactionModel.updateOne(
        { userId: demoUser._id, title: transaction.title, transactionDate },
        { $setOnInsert: { ...transaction, accountId, userId: demoUser._id, destinationAccountId: null, transactionDate } },
        { upsert: true },
      );
    }
  }

  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const foodCategory = categoryByName.get('Food')!;
  const transportCategory = categoryByName.get('Transportation')!;
  const budgetSpecs = [
    { categoryId: foodCategory._id, amountLimit: 6_000_000 },
    { categoryId: transportCategory._id, amountLimit: 3_000_000 },
  ];
  const budgets = await Promise.all(budgetSpecs.map((spec) =>
    BudgetModel.findOneAndUpdate(
      { userId: demoUser._id, categoryId: spec.categoryId, periodStart: dayStart(monthStart.toISOString()), periodEnd: dayEnd(monthEnd.toISOString()) },
      { $setOnInsert: { ...spec, userId: demoUser._id, periodStart: dayStart(monthStart.toISOString()), periodEnd: dayEnd(monthEnd.toISOString()) } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ),
  ));

  const dueDate = new Date(now.getTime() + 5 * 86_400_000);
  const debt = await DebtModel.findOneAndUpdate(
    { userId: demoUser._id, personName: 'Nguyen Van A', type: 'BORROWED' },
    { $setOnInsert: {
      userId: demoUser._id,
      personName: 'Nguyen Van A',
      type: 'BORROWED',
      principalAmount: 8_000_000,
      paidAmount: 2_000_000,
      startDate: new Date(now.getTime() - 20 * 86_400_000),
      dueDate,
      note: 'Emergency loan',
      status: 'ACTIVE',
    } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  await DebtPaymentModel.updateOne(
    { userId: demoUser._id, debtId: debt!._id, note: 'Seed partial payment' },
    { $setOnInsert: { userId: demoUser._id, debtId: debt!._id, amount: 2_000_000, paymentDate: now, accountId: bank!._id, note: 'Seed partial payment' } },
    { upsert: true },
  );

  await Promise.all([
    NotificationModel.updateOne(
      { userId: demoUser._id, deduplicationKey: `budget-${budgets[0]!._id}-near` },
      { $setOnInsert: { userId: demoUser._id, type: 'BUDGET', title: 'Cảnh báo ngân sách', message: 'Ngân sách Ăn uống sắp chạm giới hạn.', isRead: false, deduplicationKey: `budget-${budgets[0]!._id}-near` } },
      { upsert: true },
    ),
    NotificationModel.updateOne(
      { userId: demoUser._id, deduplicationKey: `debt-${debt!._id}-${dueDate.toISOString().slice(0, 10)}` },
      { $setOnInsert: { userId: demoUser._id, type: 'DEBT', title: 'Khoản nợ sắp đến hạn', message: 'Một khoản vay sắp đến hạn.', isRead: false, deduplicationKey: `debt-${debt!._id}-${dueDate.toISOString().slice(0, 10)}` } },
      { upsert: true },
    ),
  ]);
  console.log('FinTrack demo data is ready.');
};

seedDemo()
  .catch((error: unknown) => {
    console.error('Unable to seed FinTrack demo data.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
