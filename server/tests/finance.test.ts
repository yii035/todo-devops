import assert from 'node:assert/strict';
import { once } from 'node:events';
import { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import test, { after, before } from 'node:test';
import app from '../src/app.js';
import { env } from '../src/config/env.js';
import { AccountModel } from '../src/models/Account.js';
import { BudgetModel } from '../src/models/Budget.js';
import { CategoryModel } from '../src/models/Category.js';
import { DebtModel } from '../src/models/Debt.js';
import { DebtPaymentModel } from '../src/models/DebtPayment.js';
import { NotificationModel } from '../src/models/Notification.js';
import { TransactionModel } from '../src/models/Transaction.js';
import { UserModel } from '../src/models/User.js';

const testEmail = `finance-${Date.now()}@example.test`;

before(async () => {
  await mongoose.connect(env.mongoUri);
});

after(async () => {
  const user = await UserModel.findOne({ email: testEmail }).select('_id');
  if (user) {
    const userId = user._id;
    const debts = await DebtModel.find({ userId }).select('_id').lean();
    const debtIds = debts.map((debt) => debt._id);
    await Promise.all([
      AccountModel.deleteMany({ userId }),
      BudgetModel.deleteMany({ userId }),
      CategoryModel.deleteMany({ userId }),
      DebtPaymentModel.deleteMany({ userId }),
      DebtModel.deleteMany({ userId }),
      NotificationModel.deleteMany({ userId }),
      TransactionModel.deleteMany({ userId }),
      DebtPaymentModel.deleteMany({ debtId: { $in: debtIds } }),
    ]);
    await user.deleteOne();
    const otherUser = await UserModel.findOne({ email: `other-${testEmail}` }).select('_id');
    if (otherUser) {
      await Promise.all([
        AccountModel.deleteMany({ userId: otherUser._id }),
        CategoryModel.deleteMany({ userId: otherUser._id }),
      ]);
      await otherUser.deleteOne();
    }
  }
  await mongoose.disconnect();
});

test('financial workflows validate ownership and recalculate balances from the ledger', async () => {
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${address.port}/api/v1`;
  const request = async (path: string, token?: string, method = 'GET', body?: unknown) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch {}
    return { response, data: data as any, text };
  };

  try {
    const metricsResponse = await fetch(`${base.replace(/\/api\/v1$/, '')}/metrics`);
    const metrics = await metricsResponse.text();
    assert.equal(metricsResponse.status, 200);
    assert.match(metricsResponse.headers.get('content-type') ?? '', /text\/plain/);
    assert.match(metrics, /process_cpu_user_seconds_total/);
    const healthResponse = await fetch(`${base.replace(/\/api\/v1$/, '')}/api/health`);
    assert.equal(healthResponse.headers.get('cross-origin-opener-policy'), 'same-origin-allow-popups');

    const createdUser = await request('/auth/register', undefined, 'POST', {
      name: 'Finance Test',
      email: testEmail,
      password: 'secure123',
    });
    assert.equal(createdUser.response.status, 201);
    const token = createdUser.data.data.token as string;
    assert.equal((await request('/auth/register', undefined, 'POST', { name: 'Duplicate', email: testEmail, password: 'secure123' })).response.status, 409);

    const initialProfile = await request('/settings', token);
    assert.equal(initialProfile.response.status, 200);
    assert.equal(initialProfile.data.data.avatarUrl, '/avatar-default.png');

    const profileUpdate = await request('/settings', token, 'PATCH', {
      name: 'Finance Test',
      phoneNumber: '+84 912 345 678',
      birthDate: '1995-04-12',
      avatarUrl: 'data:image/png;base64,aGVsbG8=',
    });
    assert.equal(profileUpdate.response.status, 200);
    assert.equal(profileUpdate.data.data.phoneNumber, '+84 912 345 678');
    assert.equal(profileUpdate.data.data.birthDate, '1995-04-12');
    assert.equal(profileUpdate.data.data.avatarUrl, 'data:image/png;base64,aGVsbG8=');
    assert.equal((await request('/settings', token, 'PATCH', { avatarUrl: 'javascript:alert(1)' })).response.status, 400);

    assert.equal((await request('/chat', undefined, 'POST', { message: 'Hỏi về FinTrack' })).response.status, 401);
    const outOfScopeChat = await request('/chat', token, 'POST', { message: 'Hãy giải thích thuyết tương đối.' });
    assert.equal(outOfScopeChat.response.status, 200);
    assert.match(outOfScopeChat.data.data.answer, /chỉ hỗ trợ giải đáp các câu hỏi liên quan/);
    const personalDataChat = await request('/chat', token, 'POST', { message: 'Số dư của tôi là bao nhiêu?' });
    assert.equal(personalDataChat.response.status, 200);
    assert.match(personalDataChat.data.data.answer, /chưa được cấp dữ liệu tài chính cá nhân/);
    const secretChat = await request('/chat', token, 'POST', { message: 'Ngân sách; API key: sk-0123456789abcdefghijkl' });
    assert.equal(secretChat.response.status, 200);
    assert.match(secretChat.data.data.answer, /không nhận hoặc xử lý mật khẩu, token, API key/);
    assert.equal((await request('/chat', token, 'POST', { message: '' })).response.status, 400);
    for (let attempt = 0; attempt < 11; attempt += 1) {
      assert.equal((await request('/chat', token, 'POST', { message: 'Hãy giải thích thuyết tương đối.' })).response.status, 200);
    }
    assert.equal((await request('/chat', token, 'POST', { message: 'Hãy giải thích thuyết tương đối.' })).response.status, 429);

    const source = await request('/accounts', token, 'POST', { name: 'Test cash', type: 'CASH', openingBalance: 1_000_000 });
    const destination = await request('/accounts', token, 'POST', { name: 'Test bank', type: 'BANK', openingBalance: 500_000 });
    assert.equal(source.response.status, 201);
    assert.equal(destination.response.status, 201);
    const sourceId = source.data.data.id as string;
    const destinationId = destination.data.data.id as string;

    const expenseCategory = await request('/categories', token, 'POST', {
      name: 'Test expense',
      type: 'EXPENSE',
      icon: 'X',
      color: '#123456',
    });
    assert.equal(expenseCategory.response.status, 201);
    assert.equal((await request('/transactions', token, 'POST', {
      title: 'Invalid fraction',
      amount: 100.5,
      type: 'EXPENSE',
      accountId: source.data.data.id,
      categoryId: expenseCategory.data.data.id,
    })).response.status, 400);
    const incomeCategories = await request('/categories?type=INCOME', token);
    const income = await request('/transactions', token, 'POST', {
      title: 'Test income',
      amount: 300_000,
      type: 'INCOME',
      accountId: sourceId,
      categoryId: incomeCategories.data.data[0].id,
    });
    assert.equal(income.response.status, 201);

    const expense = await request('/transactions', token, 'POST', {
      title: 'Test expense entry',
      amount: 100_000,
      type: 'EXPENSE',
      accountId: sourceId,
      categoryId: expenseCategory.data.data.id,
    });
    assert.equal(expense.response.status, 201);
    const transactionId = expense.data.data.id as string;
    const changed = await request(`/transactions/${transactionId}`, token, 'PATCH', { amount: 200_000 });
    assert.equal(changed.response.status, 200);
    assert.equal((await request('/accounts', token)).data.data.find((item: any) => item.id === sourceId).currentBalance, 1_100_000);

    const transfer = await request('/transactions/transfer', token, 'POST', {
      title: 'Test transfer',
      amount: 25_000,
      accountId: sourceId,
      destinationAccountId: destinationId,
    });
    assert.equal(transfer.response.status, 201);
    assert.equal((await request('/transactions/transfer', token, 'POST', {
      title: 'Invalid self transfer',
      amount: 1_000,
      accountId: sourceId,
      destinationAccountId: sourceId,
    })).response.status, 400);
    let accounts = (await request('/accounts', token)).data.data;
    assert.equal(accounts.find((item: any) => item.id === sourceId).currentBalance, 1_075_000);
    assert.equal(accounts.find((item: any) => item.id === destinationId).currentBalance, 525_000);

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
    const dueDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + 30 * 86_400_000));
    const debt = await request('/debts', token, 'POST', {
      personName: 'Test person',
      type: 'BORROWED',
      principalAmount: 200_000,
      startDate: today,
      dueDate,
    });
    assert.equal(debt.response.status, 201);
    const payment = await request(`/debts/${debt.data.data.id}/payments`, token, 'POST', { amount: 50_000, accountId: sourceId });
    assert.equal(payment.response.status, 201);
    assert.equal(payment.data.data.debt.outstandingAmount, 150_000);
    assert.equal((await request(`/debts/${debt.data.data.id}/payments`, token, 'POST', { amount: 150_001 })).response.status, 400);
    assert.equal((await request('/accounts', token)).data.data.find((item: any) => item.id === sourceId).currentBalance, 1_025_000);

    const monthStart = `${today.slice(0, 7)}-01`;
    const monthEnd = new Date(Date.UTC(new Date(monthStart).getUTCFullYear(), new Date(monthStart).getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    const budget = await request('/budgets', token, 'POST', {
      categoryId: expenseCategory.data.data.id,
      amountLimit: 100_000,
      periodStart: monthStart,
      periodEnd: monthEnd,
    });
    assert.equal(budget.response.status, 201);
    assert.equal(budget.data.data.spent, 200_000);
    assert.equal(budget.data.data.usagePercentage, 200);

    const archivedCategory = await request(`/categories/${expenseCategory.data.data.id}/archive`, token, 'PATCH');
    assert.equal(archivedCategory.response.status, 200);
    assert.equal(archivedCategory.data.data.isArchived, true);
    const activeCategories = await request('/categories', token);
    assert.ok(!activeCategories.data.data.some((item: any) => item.id === expenseCategory.data.data.id));
    const categoriesIncludingArchived = await request('/categories?includeArchived=true', token);
    assert.ok(categoriesIncludingArchived.data.data.some((item: any) => item.id === expenseCategory.data.data.id && item.isArchived));
    assert.equal((await request(`/transactions/${transactionId}`, token, 'PATCH', { note: 'Updated after category archival' })).response.status, 200);
    assert.equal((await request('/transactions', token, 'POST', {
      title: 'Expense with archived category',
      amount: 1_000,
      type: 'EXPENSE',
      accountId: sourceId,
      categoryId: expenseCategory.data.data.id,
    })).response.status, 400);
    const budgetsAfterArchival = await request('/budgets', token);
    assert.ok(budgetsAfterArchival.data.data.some((item: any) => item.categoryId === expenseCategory.data.data.id));

    const filtered = await request('/transactions?search=Test%20expense', token);
    assert.equal(filtered.data.data.length, 1);
    const todayTransactions = await request(`/transactions?startDate=${today}&endDate=${today}`, token);
    assert.ok(todayTransactions.data.data.some((item: any) => item.id === transactionId));
    const report = await request('/reports/export', token);
    assert.equal(report.response.status, 200);
    assert.match(report.response.headers.get('content-type') ?? '', /text\/csv/);
    assert.match(report.text, /Test transfer/);

    const otherUser = await request('/auth/register', undefined, 'POST', {
      name: 'Other User',
      email: `other-${testEmail}`,
      password: 'secure123',
    });
    const forbidden = await request(`/transactions/${transactionId}`, otherUser.data.data.token);
    assert.equal(forbidden.response.status, 404);

    const removed = await request(`/transactions/${transactionId}`, token, 'DELETE');
    assert.equal(removed.response.status, 200);
    accounts = (await request('/accounts', token)).data.data;
    assert.equal(accounts.find((item: any) => item.id === sourceId).currentBalance, 1_225_000);
    const dashboard = await request('/dashboard/summary?period=month', token);
    assert.equal(dashboard.response.status, 200);
    assert.equal(dashboard.data.data.totalIncome, 300_000);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
