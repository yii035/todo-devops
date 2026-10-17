import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Banknote,
  Briefcase,
  Car,
  Camera,
  ChartNoAxesCombined,
  CircleDollarSign,
  CreditCard,
  ArrowLeft,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  LayoutGrid,
  Plane,
  PiggyBank,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  Settings,
  Tags,
  TrendingUp,
  Utensils,
  Wallet,
} from 'lucide-react';
import LoginPage from './pages/LoginPage';
import ChatbotWidget from './components/ChatbotWidget';
import ProfileMenu from './components/ProfileMenu';
import api from './services/api';

const DashboardCharts = lazy(() => import('./components/DashboardCharts'));

const sidebarItems = [
  { label: 'Tổng quan', path: '/dashboard', icon: LayoutGrid },
  { label: 'Giao dịch', path: '/transactions', icon: CreditCard },
  { label: 'Tài khoản', path: '/accounts', icon: Wallet },
  { label: 'Danh mục', path: '/categories', icon: ChartNoAxesCombined },
  { label: 'Ngân sách', path: '/budgets', icon: PiggyBank },
  { label: 'Vay & nợ', path: '/debts', icon: Landmark },
  { label: 'Báo cáo', path: '/reports', icon: TrendingUp },
  { label: 'Cài đặt', path: '/settings', icon: Settings },
];

const formatMoney = (value: number, suffix = 'đ') => `${Number(value).toLocaleString('vi-VN')}${suffix}`;

const categoryNameTranslations: Record<string, string> = {
  salary: 'Lương',
  allowance: 'Trợ cấp',
  food: 'Ăn uống',
  shopping: 'Mua sắm',
  transportation: 'Di chuyển',
  'other income': 'Thu nhập khác',
  other: 'Khác',
};

const transactionTitleTranslations: Record<string, string> = {
  salary: 'Lương',
  groceries: 'Mua thực phẩm',
  transportation: 'Di chuyển',
  freelance: 'Thu nhập tự do',
};

const accountNameTranslations: Record<string, string> = {
  cash: 'Tiền mặt',
  'bank account': 'Tài khoản ngân hàng',
};

const accountTypeTranslations: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK: 'Ngân hàng',
  EWALLET: 'Ví điện tử',
  OTHER: 'Khác',
};

const transactionTypeTranslations: Record<string, string> = {
  ALL: 'Tất cả',
  INCOME: 'Thu nhập',
  EXPENSE: 'Chi tiêu',
  TRANSFER: 'Chuyển khoản',
};

const displayCategoryName = (name: string | undefined) => categoryNameTranslations[name?.toLowerCase() ?? ''] ?? name ?? '';
const displayTransactionTitle = (title: string | undefined) => transactionTitleTranslations[title?.toLowerCase() ?? ''] ?? title ?? '';
const displayAccountName = (name: string | undefined) => accountNameTranslations[name?.toLowerCase() ?? ''] ?? name ?? '';
const displayTransactionType = (type: string | undefined) => transactionTypeTranslations[type ?? ''] ?? type ?? '';
const displayDebtStatus = (status: string | undefined) => ({ ACTIVE: 'Đang hoạt động', PAID: 'Đã tất toán' }[status ?? ''] ?? status ?? '');

function displayNotification(notification: any) {
  const titleTranslations: Record<string, string> = {
    'Budget limit exceeded': 'Ngân sách đã vượt hạn mức',
    'Budget nearing limit': 'Ngân sách sắp chạm giới hạn',
    'Debt payment overdue': 'Khoản nợ đã quá hạn',
    'Debt due soon': 'Khoản nợ sắp đến hạn',
    'Budget alert': 'Cảnh báo ngân sách',
  };
  const title = titleTranslations[notification.title] ?? notification.title;
  const budgetMessage = /^(.*?) budget is (\d+)% used\.$/i.exec(notification.message);
  if (budgetMessage) {
    return { title, message: `Ngân sách ${displayCategoryName(budgetMessage[1])} đã sử dụng ${budgetMessage[2]}%.` };
  }
  const debtMessage = /^(.*?): ([\d,.]+) VND (overdue|due in (\d+) days)\.$/i.exec(notification.message);
  if (debtMessage) {
    const amount = Number(debtMessage[2].replace(/[,.]/g, '')).toLocaleString('vi-VN');
    const dueText = debtMessage[3] === 'overdue' ? 'đã quá hạn' : `đến hạn sau ${debtMessage[4]} ngày`;
    return { title, message: `${debtMessage[1]}: còn ${amount}đ, ${dueText}.` };
  }
  if (notification.title === 'Debt due soon' && notification.message === 'A loan is due soon.') {
    return { title, message: 'Một khoản vay sắp đến hạn.' };
  }
  if (notification.title === 'Budget alert' && notification.message === 'Food budget is nearing its limit.') {
    return { title, message: 'Ngân sách Ăn uống sắp chạm giới hạn.' };
  }
  return { title, message: notification.message };
}

const categoryIconOptions = [
  { value: 'utensils', label: 'Ăn uống', icon: Utensils },
  { value: 'shopping', label: 'Mua sắm', icon: ShoppingBag },
  { value: 'car', label: 'Di chuyển', icon: Car },
  { value: 'gift', label: 'Quà tặng', icon: Gift },
  { value: 'salary', label: 'Lương', icon: Banknote },
  { value: 'work', label: 'Công việc', icon: Briefcase },
  { value: 'home', label: 'Nhà cửa', icon: House },
  { value: 'health', label: 'Sức khỏe', icon: HeartPulse },
  { value: 'education', label: 'Giáo dục', icon: GraduationCap },
  { value: 'travel', label: 'Du lịch', icon: Plane },
  { value: 'bills', label: 'Hóa đơn', icon: Receipt },
  { value: 'income', label: 'Thu nhập khác', icon: CircleDollarSign },
  { value: 'other', label: 'Khác', icon: Tags },
];

const legacyCategoryIcons: Record<string, string> = {
  '🍽️': 'utensils',
  '🍽': 'utensils',
  '🛍️': 'shopping',
  '🚗': 'car',
  '🎁': 'gift',
  '💰': 'salary',
  '📌': 'other',
};

const categoryIconByName: Record<string, string> = {
  food: 'utensils',
  groceries: 'utensils',
  shopping: 'shopping',
  transportation: 'car',
  salary: 'salary',
  allowance: 'gift',
  'other income': 'income',
  other: 'other',
};

function getCategoryIcon(icon: string | undefined, name: string | undefined) {
  const iconValue = legacyCategoryIcons[icon ?? ''] ?? icon;
  return categoryIconOptions.find((option) => option.value === iconValue)?.icon
    ?? categoryIconOptions.find((option) => option.value === categoryIconByName[name?.toLowerCase() ?? ''])?.icon
    ?? Tags;
}

function AppShell({ title, subtitle, children, actions }: { title: string; subtitle: string; children: React.ReactNode; actions?: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchText, setSearchText] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState('');

  const activeLabel = useMemo(() => {
    const current = sidebarItems.find((item) => item.path === location.pathname);
    return location.pathname === '/profile' ? 'Thông tin cá nhân' : current?.label ?? 'Tổng quan';
  }, [location.pathname]);

  useEffect(() => {
    api.get('/notifications')
      .then((response) => {
        setNotifications(response.data.data);
        setUnreadCount(response.data.meta.unreadCount);
      })
      .catch(() => setNotificationError('Không thể tải thông báo.'));
  }, [location.pathname]);

  const searchTransactions = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    const query = searchText.trim();
    navigate(query ? `/transactions?search=${encodeURIComponent(query)}` : '/transactions');
  };

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((items) => items.map((item) => item.id === id ? { ...item, isRead: true } : item));
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch {
      setNotificationError('Không thể cập nhật trạng thái thông báo.');
    }
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch {
      setNotificationError('Không thể đánh dấu thông báo đã đọc.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="hidden min-h-screen w-72 border-r border-slate-200 bg-white p-6 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-700 text-lg font-bold text-white">F</div>
            <div>
              <div className="text-2xl font-bold tracking-tight">FinTrack</div>
            </div>
          </div>

          <nav className="space-y-2">
            {sidebarItems.map(({ label, path, icon: Icon }) => (
              <NavLink
                key={label}
                to={path}
                className={({ isActive }) =>
                  `flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                    isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} className={isActive ? 'text-white' : 'text-slate-500'} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        <nav aria-label="Điều hướng chính" className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-slate-200 bg-white px-2 py-1 lg:hidden">
          {sidebarItems.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} className={({ isActive }) => `flex min-w-[76px] flex-1 flex-col items-center gap-1 px-2 py-2 text-[10px] ${isActive ? 'text-blue-700' : 'text-slate-500'}`}>
            <Icon size={18} /><span className="whitespace-nowrap">{label}</span>
          </NavLink>)}
        </nav>

        <main className="min-w-0 flex-1 p-4 pb-24 md:p-6 xl:p-8 lg:pb-8">
          <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{activeLabel}</p>
                <h1 className="text-2xl font-bold">{title}</h1>
              </div>
            </div>

            <div className="flex flex-1 items-center justify-end gap-3">
              <div className="hidden min-w-[220px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
                <Search size={16} className="text-slate-400" />
                <input placeholder="Tìm giao dịch, nhấn Enter" value={searchText} onChange={(event) => setSearchText(event.target.value)} onKeyDown={searchTransactions} className="w-full bg-transparent text-sm outline-none" />
              </div>
              {actions}
              <div className="relative">
                <button aria-label="Thông báo" aria-expanded={showNotifications} onClick={() => setShowNotifications((open) => !open)} className="relative rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-100">
                  <Bell size={18} />
                  {unreadCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{unreadCount}</span>}
                </button>
                {showNotifications && <div className="absolute right-0 z-20 mt-2 w-80 max-w-[90vw] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="font-semibold">Thông báo</h2>
                    {unreadCount > 0 && <button onClick={markAllRead} className="text-xs text-blue-700">Đánh dấu tất cả đã đọc</button>}
                  </div>
                  {notificationError && <p role="alert" className="mb-2 text-xs text-red-600">{notificationError}</p>}
                  {notifications.length === 0 ? <p className="py-4 text-sm text-slate-500">Chưa có thông báo.</p> : <div className="max-h-72 space-y-2 overflow-auto">
                    {notifications.slice(0, 8).map((item) => {
                      const localized = displayNotification(item);
                      return <button key={item.id} onClick={() => !item.isRead && markRead(item.id)} className={`block w-full rounded-lg p-2 text-left ${item.isRead ? 'bg-white' : 'bg-blue-50'}`}>
                        <span className="block text-sm font-medium">{localized.title}</span><span className="block text-xs text-slate-600">{localized.message}</span>
                      </button>;
                    })}
                  </div>}
                </div>}
              </div>
              <ProfileMenu />
            </div>
          </header>

          <div className="mb-4 text-sm text-slate-500">{subtitle}</div>
          {children}
        </main>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, tone, icon, suffix = 'đ' }: { title: string; value: number; tone: 'green' | 'red' | 'blue' | 'amber'; icon: React.ReactNode; suffix?: string }) {
  const palettes = {
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-rose-200 bg-rose-50 text-rose-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  } as const;

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${palettes[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</div>
          <div className="mt-3 text-2xl font-bold">{formatMoney(value, suffix)}</div>
        </div>
        <div className="rounded-xl bg-white/70 p-2">{icon}</div>
      </div>
    </div>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<'month' | '3months' | '6months' | 'year'>('month');
  const [summary, setSummary] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [charts, setCharts] = useState<any>({ incomeTrend: [], categoryExpense: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [summaryRes, txRes, accRes, budgetsRes, chartsRes, categoriesRes] = await Promise.all([
          api.get('/dashboard/summary', { params: { period } }),
          api.get('/dashboard/recent-transactions', { params: { limit: 6 } }),
          api.get('/accounts'),
          api.get('/budgets'),
          api.get('/dashboard/charts', { params: { months: period === 'year' ? 12 : period === 'month' ? 6 : Number(period[0]) } }),
          api.get('/categories'),
        ]);
        if (!active) return;
        setSummary(summaryRes.data.data);
        setTransactions(txRes.data.data);
        setAccounts(accRes.data.data);
        setBudgets(budgetsRes.data.data);
        setCharts(chartsRes.data.data);
        setCategories(categoriesRes.data.data);
      } catch {
        if (active) setError('Không thể tải dashboard. Vui lòng thử lại.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [period]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">Đang tải dashboard...</div>;
  }

  return (
    <AppShell
      title="Quản lý tài chính cá nhân"
      subtitle="Tổng quan thu nhập, chi tiêu, ngân sách và dòng tiền của bạn."
      actions={
        <button onClick={() => navigate('/transactions')} className="flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800">
            <Plus size={16} />
            Thêm giao dịch
        </button>
      }
    >
      {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      <div className="mb-4 flex justify-end">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Khoảng thời gian
          <select value={period} onChange={(event) => setPeriod(event.target.value as typeof period)} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <option value="month">Tháng này</option>
            <option value="3months">3 tháng gần nhất</option>
            <option value="6months">6 tháng gần nhất</option>
            <option value="year">Năm nay</option>
          </select>
        </label>
      </div>
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <SummaryCard title="Tổng thu nhập" value={summary?.totalIncome ?? 0} tone="green" icon={<ArrowUpRight size={18} />} />
        <SummaryCard title="Tổng chi tiêu" value={summary?.totalExpenses ?? 0} tone="red" icon={<ArrowDownLeft size={18} />} />
        <SummaryCard title="Số dư hiện tại" value={summary?.currentBalance ?? 0} tone="blue" icon={<Wallet size={18} />} />
      </section>

      <Suspense fallback={<div className="h-64 rounded-2xl bg-white p-5 text-slate-500">Đang tải biểu đồ...</div>}>
        <DashboardCharts incomeTrend={charts.incomeTrend} categoryExpense={charts.categoryExpense} />
      </Suspense>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Giao dịch gần đây</h2>
            <button onClick={() => navigate('/transactions')} className="text-sm font-medium text-blue-600">Xem tất cả</button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Tên giao dịch</th>
                  <th className="px-4 py-3 font-medium">Danh mục</th>
                  <th className="px-4 py-3 font-medium">Ngày</th>
                  <th className="px-4 py-3 font-medium">Số tiền</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Chưa có giao dịch.</td></tr> : transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-t border-slate-200">
                    <td className="px-4 py-3 font-medium text-slate-700">{displayTransactionTitle(transaction.title)}</td>
                    <td className="px-4 py-3 text-slate-500">{displayCategoryName(categories.find((category) => category.id === transaction.categoryId)?.name) || displayTransactionType(transaction.type)}</td>
                    <td className="px-4 py-3 text-slate-500">{new Date(transaction.transactionDate).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</td>
                    <td className={`px-4 py-3 font-semibold ${transaction.type === 'INCOME' ? 'text-green-600' : 'text-red-500'}`}>
                      {transaction.type === 'INCOME' ? '+' : '-'}{formatMoney(transaction.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Cảnh báo</h2>
            <div className="space-y-3">
              {[...(summary?.budgetWarnings ?? []).map((item: any) => ({ title: item.usagePercentage >= 100 ? 'Ngân sách đã vượt hạn mức' : 'Ngân sách sắp chạm giới hạn', detail: `${displayCategoryName(item.categoryName)}: ${Math.round(item.usagePercentage)}% đã sử dụng`, tone: 'amber' })), ...(summary?.debtWarnings ?? []).map((item: any) => ({ title: 'Khoản nợ đến hạn', detail: `${item.personName}: còn ${formatMoney(item.outstandingAmount)}`, tone: 'red' }))].length === 0
                ? <p className="text-sm text-slate-500">Hiện không có cảnh báo.</p>
                : [...(summary?.budgetWarnings ?? []).map((item: any) => ({ key: item.id, title: item.usagePercentage >= 100 ? 'Ngân sách đã vượt hạn mức' : 'Ngân sách sắp chạm giới hạn', detail: `${displayCategoryName(item.categoryName)}: ${Math.round(item.usagePercentage)}% đã sử dụng`, tone: 'amber' })), ...(summary?.debtWarnings ?? []).map((item: any) => ({ key: item.id, title: 'Khoản nợ đến hạn', detail: `${item.personName}: còn ${formatMoney(item.outstandingAmount)}`, tone: 'red' }))].map((item) => (
                <div key={item.key} className={`flex gap-3 rounded-xl border p-3 ${item.tone === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
                  <AlertTriangle className={item.tone === 'amber' ? 'text-amber-600' : 'text-red-600'} size={18} />
                  <div>
                    <div className="font-semibold text-slate-700">{item.title}</div>
                    <div className="text-sm text-slate-500">{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">Tài khoản</h2>
            <div className="space-y-3">
              {accounts.map((account) => (
                <div key={account.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-800">{displayAccountName(account.name)}</div>
                      <div className="text-xs uppercase tracking-wide text-slate-500">{accountTypeTranslations[account.type] ?? account.type}</div>
                    </div>
                    <Wallet size={16} className="text-slate-400" />
                  </div>
                  <div className="mt-3 text-lg font-bold text-blue-700">{formatMoney(account.currentBalance ?? account.openingBalance)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Ngân sách</h2>
              <button onClick={() => navigate('/budgets')} className="text-sm font-medium text-blue-600">Chi tiết</button>
            </div>
            {budgets.length === 0 ? <p className="text-sm text-slate-500">Chưa thiết lập ngân sách.</p> : <div className="space-y-3">
              {budgets.slice(0, 4).map((budget) => (
                <div key={budget.id}>
                  <div className="mb-1 flex justify-between gap-3 text-sm"><span>{displayCategoryName(budget.categoryName)}</span><span>{Math.round(budget.usagePercentage)}%</span></div>
                  <div className="h-2 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${budget.usagePercentage >= 100 ? 'bg-red-500' : budget.usagePercentage >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, budget.usagePercentage)}%` }} /></div>
                  <div className="mt-1 text-xs text-slate-500">{formatMoney(budget.spent)} / {formatMoney(budget.amountLimit)}</div>
                </div>
              ))}
            </div>}
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function PageTable({ title, subtitle, columns, rows, emptyMessage }: { title: string; subtitle: string; columns: string[]; rows: any[]; emptyMessage: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        <button className="rounded-xl bg-blue-700 px-3 py-2 text-sm font-medium text-white">Tạo mới</button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-slate-500">{emptyMessage}</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-4 py-3 font-medium">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="border-t border-slate-200">
                  {Object.values(row).map((value: any, valueIndex) => (
                    <td key={`${index}-${valueIndex}`} className="px-4 py-3 text-slate-600">{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TransactionsPage() {
  const [searchParams] = useSearchParams();
  const querySearch = searchParams.get('search') ?? '';
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE' | 'TRANSFER'>('ALL');
  const [search, setSearch] = useState(querySearch);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    title: '',
    amount: '0',
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE' | 'TRANSFER',
    categoryId: '',
    accountId: '',
    destinationAccountId: '',
    transactionDate: new Date().toISOString().slice(0, 10),
    note: '',
  });

  const refresh = async () => {
    const [txRes, accRes, catRes] = await Promise.all([
      api.get('/transactions', { params: {
        ...(filter !== 'ALL' ? { type: filter } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(startDate ? { startDate: new Date(`${startDate}T00:00:00+07:00`).toISOString() } : {}),
        ...(endDate ? { endDate: new Date(`${endDate}T23:59:59.999+07:00`).toISOString() } : {}),
      } }),
      api.get('/accounts'),
      api.get('/categories'),
    ]);

    setTransactions(txRes.data.data);
    setAccounts(accRes.data.data);
    setCategories(catRes.data.data);
    setForm((current) => ({
      ...current,
      accountId: accRes.data.data[0]?.id ?? '',
      destinationAccountId: accRes.data.data.find((item: any) => item.id !== current.accountId)?.id ?? '',
      categoryId: catRes.data.data.find((item: any) => item.type === current.type)?.id ?? '',
    }));
    setLoading(false);
  };

  useEffect(() => {
    refresh().catch(() => {
      setFormError('Không thể tải giao dịch. Vui lòng tải lại trang.');
      setLoading(false);
    });
  }, [filter, search, startDate, endDate]);

  useEffect(() => {
    setSearch(querySearch);
  }, [querySearch]);

  useEffect(() => {
    if (!categories.length) return;
    setForm((current) => ({
      ...current,
      categoryId: categories.find((item) => item.type === current.type)?.id ?? '',
    }));
  }, [categories, form.type]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!form.title.trim() || !form.accountId || Number(form.amount) <= 0) {
      setFormError('Vui lòng nhập tên, số tiền hợp lệ và tài khoản.');
      return;
    }
    if (form.type === 'TRANSFER' && (!form.destinationAccountId || form.destinationAccountId === form.accountId)) {
      setFormError('Chuyển khoản cần chọn hai tài khoản khác nhau.');
      return;
    }
    if (form.type !== 'TRANSFER' && !form.categoryId) {
      setFormError('Vui lòng chọn danh mục phù hợp.');
      return;
    }
    const payload = {
      title: form.title.trim(),
      amount: Number(form.amount),
      type: form.type,
      accountId: form.accountId,
      ...(form.type === 'TRANSFER' ? { destinationAccountId: form.destinationAccountId } : { categoryId: form.categoryId }),
      transactionDate: new Date(`${form.transactionDate}T00:00:00+07:00`).toISOString(),
      note: form.note,
    };
    try {
      if (editingId) await api.patch(`/transactions/${editingId}`, payload);
      else if (form.type === 'TRANSFER') await api.post('/transactions/transfer', payload);
      else await api.post('/transactions', payload);
      setEditingId(null);
      setForm({
        title: '', amount: '0', type: 'EXPENSE', categoryId: '',
        accountId: accounts[0]?.id ?? '', destinationAccountId: accounts[1]?.id ?? '',
        transactionDate: new Date().toISOString().slice(0, 10), note: '',
      });
      await refresh();
    } catch (error: any) {
      setFormError(error.response?.data?.message ?? 'Không thể lưu giao dịch.');
    }
  };

  const editTransaction = (item: any) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      amount: String(item.amount),
      type: item.type,
      categoryId: item.categoryId ?? '',
      accountId: item.accountId,
      destinationAccountId: item.destinationAccountId ?? '',
      transactionDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(item.transactionDate)),
      note: item.note ?? '',
    });
  };

  const deleteTransaction = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa giao dịch này?')) return;
    try {
      await api.delete(`/transactions/${id}`);
      await refresh();
    } catch (error: any) {
      setFormError(error.response?.data?.message ?? 'Không thể xóa giao dịch.');
    }
  };

  return (
    <AppShell title="Giao dịch" subtitle="Theo dõi các khoản thu, chi trên những tài khoản của bạn." actions={null}>
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold">{editingId ? 'Chỉnh sửa giao dịch' : 'Thêm giao dịch'}</h2>
        {formError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</p>}
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="xl:col-span-2">
            <span className="mb-1 block text-sm text-slate-500">Tên giao dịch</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-blue-400" placeholder="Ví dụ: Mua thực phẩm" />
          </label>
          <label>
            <span className="mb-1 block text-sm text-slate-500">Loại giao dịch</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-blue-400">
              <option value="INCOME">Thu nhập</option>
              <option value="EXPENSE">Chi tiêu</option>
              <option value="TRANSFER">Chuyển khoản</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm text-slate-500">Số tiền</span>
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-blue-400" />
          </label>
          <label>
            <span className="mb-1 block text-sm text-slate-500">Tài khoản nguồn</span>
            <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-blue-400">
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>{displayAccountName(account.name)}</option>
              ))}
            </select>
          </label>
          {form.type === 'TRANSFER' && <label>
            <span className="mb-1 block text-sm text-slate-500">Tài khoản đích</span>
            <select value={form.destinationAccountId} onChange={(e) => setForm({ ...form, destinationAccountId: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-blue-400">
              <option value="">Chọn tài khoản</option>
              {accounts.filter((account) => account.id !== form.accountId).map((account) => <option key={account.id} value={account.id}>{displayAccountName(account.name)}</option>)}
            </select>
          </label>}
          <label>
            <span className="mb-1 block text-sm text-slate-500">Ngày giao dịch</span>
            <input type="date" value={form.transactionDate} onChange={(e) => setForm({ ...form, transactionDate: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-blue-400" />
          </label>
          {form.type !== 'TRANSFER' && <label className="xl:col-span-2">
            <span className="mb-1 block text-sm text-slate-500">Danh mục</span>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-blue-400">
              {categories.filter((item) => item.type === form.type).map((item) => (
                <option key={item.id} value={item.id}>{displayCategoryName(item.name)}</option>
              ))}
            </select>
          </label>}
          <label className="xl:col-span-4">
            <span className="mb-1 block text-sm text-slate-500">Ghi chú</span>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-blue-400" placeholder="Ghi chú (không bắt buộc)" />
          </label>
          <div className="flex items-end gap-2 xl:col-span-2">
            <button type="submit" className="flex-1 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">{editingId ? 'Cập nhật' : 'Lưu giao dịch'}</button>
            {editingId && <button type="button" onClick={() => { setEditingId(null); setFormError(''); }} className="rounded-xl border px-4 py-2.5 text-sm">Hủy</button>}
          </div>
        </form>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">Đang tải giao dịch...</div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold">Lịch sử giao dịch</h2>
              <p className="text-sm text-slate-500">Tìm kiếm, lọc và cập nhật sổ giao dịch</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['ALL', 'INCOME', 'EXPENSE', 'TRANSFER'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setFilter(option)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium ${filter === option ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {displayTransactionType(option)}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4 grid gap-2 md:grid-cols-3">
            <input aria-label="Tìm giao dịch" placeholder="Tìm theo tên hoặc ghi chú" value={search} onChange={(event) => setSearch(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            <input aria-label="Từ ngày" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
            <input aria-label="Đến ngày" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2" />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Tiêu đề</th>
                  <th className="px-4 py-3 font-medium">Loại</th>
                  <th className="px-4 py-3 font-medium">Danh mục</th>
                  <th className="px-4 py-3 font-medium">Tài khoản</th>
                  <th className="px-4 py-3 font-medium">Ngày</th>
                  <th className="px-4 py-3 font-medium">Số tiền</th>
                  <th className="px-4 py-3 font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Không tìm thấy giao dịch.</td>
                  </tr>
                ) : (
                  transactions.map((item) => (
                    <tr key={item.id} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-medium text-slate-700">{displayTransactionTitle(item.title)}</td>
                      <td className="px-4 py-3 text-slate-500">{displayTransactionType(item.type)}</td>
                      <td className="px-4 py-3 text-slate-500">{displayCategoryName(categories.find((category) => category.id === item.categoryId)?.name) || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{displayAccountName(accounts.find((account) => account.id === item.accountId)?.name) || '—'}{item.destinationAccountId ? ` → ${displayAccountName(accounts.find((account) => account.id === item.destinationAccountId)?.name) || '—'}` : ''}</td>
                      <td className="px-4 py-3 text-slate-500">{new Date(item.transactionDate).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</td>
                      <td className={`px-4 py-3 font-semibold ${item.type === 'INCOME' ? 'text-green-600' : 'text-red-500'}`}>
                        {item.type === 'INCOME' ? '+' : item.type === 'EXPENSE' ? '-' : '↔ '}{formatMoney(item.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <button onClick={() => editTransaction(item)} className="mr-3 text-blue-700">Sửa</button>
                        <button onClick={() => deleteTransaction(item.id)} className="text-red-600">Xóa</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function AccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', type: 'CASH', openingBalance: '0' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const refresh = async () => {
    const res = await api.get('/accounts');
    setAccounts(res.data.data);
  };

  useEffect(() => {
    refresh().catch((err) => console.error(err));
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      if (editingId) await api.patch(`/accounts/${editingId}`, { name: form.name.trim(), type: form.type });
      else await api.post('/accounts', { name: form.name.trim(), type: form.type, openingBalance: Number(form.openingBalance) });
      setEditingId(null);
      setForm({ name: '', type: 'CASH', openingBalance: '0' });
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể lưu tài khoản.');
    }
  };

  return (
    <AppShell title="Tài khoản" subtitle="Theo dõi số dư và loại tài khoản." actions={null}>
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold">{editingId ? 'Cập nhật tài khoản' : 'Thêm tài khoản'}</h2>
        {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3">
          <label>
            <span className="mb-1 block text-sm text-slate-500">Tên tài khoản</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-blue-400" placeholder="Ví dụ: Tiết kiệm" />
          </label>
          <label>
            <span className="mb-1 block text-sm text-slate-500">Loại tài khoản</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-blue-400">
              <option value="CASH">Tiền mặt</option>
              <option value="BANK">Ngân hàng</option>
              <option value="EWALLET">Ví điện tử</option>
              <option value="OTHER">Khác</option>
            </select>
          </label>
          <label>
            <span className="mb-1 block text-sm text-slate-500">Số dư ban đầu</span>
            <input type="number" min="0" disabled={Boolean(editingId)} value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 outline-none focus:border-blue-400 disabled:opacity-50" />
          </label>
          <div className="flex items-end md:col-span-3">
            <button type="submit" className="rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">{editingId ? 'Cập nhật' : 'Lưu tài khoản'}</button>
            {editingId && <button type="button" onClick={() => { setEditingId(null); setForm({ name: '', type: 'CASH', openingBalance: '0' }); }} className="ml-2 rounded-xl border px-4 py-2.5 text-sm">Hủy</button>}
          </div>
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => (
          <div key={account.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{accountTypeTranslations[account.type] ?? account.type}</div>
                <div className="mt-1 text-xl font-bold">{displayAccountName(account.name)}</div>
              </div>
              <Wallet className="text-slate-400" size={20} />
            </div>
            <div className="text-2xl font-bold text-blue-700">{formatMoney(account.currentBalance ?? account.openingBalance)}</div>
            <div className="mt-3 flex gap-3 text-sm">
              <button onClick={() => { setEditingId(account.id); setForm({ name: account.name, type: account.type, openingBalance: String(account.openingBalance) }); }} className="text-blue-700">Sửa</button>
              <button onClick={async () => {
                if (!window.confirm(`Lưu trữ tài khoản ${displayAccountName(account.name)}?`)) return;
                try { await api.patch(`/accounts/${account.id}/archive`); await refresh(); }
                catch (err: any) { setError(err.response?.data?.message ?? 'Không thể lưu trữ tài khoản.'); }
              }} className="text-red-600">Lưu trữ</button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [form, setForm] = useState({ name: '', type: 'EXPENSE' as 'INCOME' | 'EXPENSE', icon: 'other', color: '#2563eb' });
  const [error, setError] = useState('');
  const refresh = async () => {
    const response = await api.get('/categories', { params: typeFilter === 'ALL' ? {} : { type: typeFilter } });
    setCategories(response.data.data);
  };

  useEffect(() => {
    refresh().catch(() => setError('Không thể tải danh mục.'));
  }, [typeFilter]);

  const addCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await api.post('/categories', form);
      setForm({ ...form, name: '' });
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể tạo danh mục.');
    }
  };

  const archiveCategory = async (id: string) => {
    try {
      await api.patch(`/categories/${id}/archive`);
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể lưu trữ danh mục.');
    }
  };

  return (
    <AppShell title="Danh mục" subtitle="Sắp xếp các nhóm thu nhập và chi tiêu." actions={null}>
      <form onSubmit={addCategory} className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
        <input required minLength={2} maxLength={60} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Tên danh mục" className="rounded-xl border border-slate-200 px-3 py-2" />
        <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as typeof form.type })} className="rounded-xl border border-slate-200 px-3 py-2">
          <option value="EXPENSE">Chi tiêu</option><option value="INCOME">Thu nhập</option>
        </select>
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2">
          {(() => {
            const SelectedIcon = getCategoryIcon(form.icon, form.name);
            return <SelectedIcon aria-hidden="true" size={20} style={{ color: form.color }} />;
          })()}
          <select aria-label="Biểu tượng danh mục" value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value })} className="min-w-0 flex-1 bg-transparent outline-none">
            {categoryIconOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <div className="flex gap-2"><input aria-label="Màu danh mục" type="color" value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} className="h-10 rounded border" /><button className="flex-1 rounded-xl bg-blue-700 px-3 py-2 font-semibold text-white">Thêm danh mục</button></div>
        {error && <p role="alert" className="text-sm text-red-600 md:col-span-4">{error}</p>}
      </form>
      <div className="mb-4 flex gap-2">
        {(['ALL', 'INCOME', 'EXPENSE'] as const).map((item) => <button key={item} onClick={() => setTypeFilter(item)} className={`rounded-xl px-3 py-2 text-sm ${typeFilter === item ? 'bg-blue-700 text-white' : 'bg-white text-slate-600'}`}>{item === 'ALL' ? 'Tất cả' : item === 'INCOME' ? 'Thu nhập' : 'Chi tiêu'}</button>)}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <div key={category.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${category.color}20`, color: category.color }}>
                {(() => {
                  const CategoryIcon = getCategoryIcon(category.icon, category.name);
                  return <CategoryIcon aria-hidden="true" size={20} strokeWidth={2} />;
                })()}
              </span>
              <div>
                <div className="font-bold text-slate-800">{displayCategoryName(category.name)}</div>
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{displayTransactionType(category.type)}</div>
              </div>
            </div>
            {!category.isSystem && <button onClick={() => archiveCategory(category.id)} className="text-sm text-red-600">Lưu trữ</button>}
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function BudgetsPage() {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const month = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).slice(0, 7);
  const monthStart = new Date(`${month}-01T00:00:00+07:00`);
  const monthEndDay = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
  const [form, setForm] = useState({ categoryId: '', amountLimit: '', periodStart: `${month}-01`, periodEnd: `${month}-${String(monthEndDay).padStart(2, '0')}` });
  const [error, setError] = useState('');
  const refresh = async () => {
    const [budgetsResponse, categoriesResponse] = await Promise.all([api.get('/budgets'), api.get('/categories', { params: { type: 'EXPENSE' } })]);
    setBudgets(budgetsResponse.data.data);
    setCategories(categoriesResponse.data.data);
    setForm((current) => ({ ...current, categoryId: current.categoryId || categoriesResponse.data.data[0]?.id || '' }));
  };

  useEffect(() => {
    refresh().catch(() => setError('Không thể tải ngân sách.'));
  }, []);

  const createBudget = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await api.post('/budgets', { ...form, amountLimit: Number(form.amountLimit) });
      setForm((current) => ({ ...current, amountLimit: '' }));
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể tạo ngân sách.');
    }
  };

  return (
    <AppShell title="Ngân sách" subtitle="Kiểm soát chi tiêu trong hạn mức hàng tháng." actions={null}>
      <form onSubmit={createBudget} className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
        <select required value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2">
          {categories.map((category) => <option key={category.id} value={category.id}>{displayCategoryName(category.name)}</option>)}
        </select>
        <input required type="number" min="1" step="1" value={form.amountLimit} onChange={(event) => setForm({ ...form, amountLimit: event.target.value })} placeholder="Hạn mức (VND)" className="rounded-xl border border-slate-200 px-3 py-2" />
        <input required type="date" value={form.periodStart} onChange={(event) => setForm({ ...form, periodStart: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2" />
        <div className="flex gap-2"><input required type="date" value={form.periodEnd} onChange={(event) => setForm({ ...form, periodEnd: event.target.value })} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2" /><button className="rounded-xl bg-blue-700 px-3 py-2 font-semibold text-white">Tạo</button></div>
        {error && <p role="alert" className="text-sm text-red-600 md:col-span-4">{error}</p>}
      </form>
      <div className="grid gap-4 xl:grid-cols-2">
        {budgets.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-lg font-bold">{displayCategoryName(item.categoryName)}</div>
              <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">{new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(item.periodStart))} — {new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(item.periodEnd))}</span>
            </div>
            <div className="flex items-baseline justify-between"><div className="text-2xl font-bold text-slate-800">{formatMoney(item.spent)} <span className="text-sm font-normal text-slate-500">/ {formatMoney(item.amountLimit)}</span></div><span className="text-sm text-slate-500">{Math.round(item.usagePercentage)}%</span></div>
            <div className="mt-4 h-2.5 rounded-full bg-slate-100">
              <div className={`h-2.5 rounded-full ${item.usagePercentage >= 100 ? 'bg-red-500' : item.usagePercentage >= 80 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, item.usagePercentage)}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-slate-500"><span>Còn lại: {formatMoney(Math.max(0, item.remaining))}</span><button onClick={async () => {
              try { await api.delete(`/budgets/${item.id}`); await refresh(); }
              catch (err: any) { setError(err.response?.data?.message ?? 'Không thể xóa ngân sách.'); }
            }} className="text-red-600">Xóa</button></div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function DebtsPage() {
  const [debts, setDebts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [paymentDebtId, setPaymentDebtId] = useState<string | null>(null);
  const [form, setForm] = useState({ personName: '', type: 'BORROWED' as 'BORROWED' | 'LENT', principalAmount: '', startDate: new Date().toISOString().slice(0, 10), dueDate: '', note: '' });
  const [payment, setPayment] = useState({ amount: '', accountId: '', note: '' });
  const [error, setError] = useState('');
  const refresh = async () => {
    const [debtsResponse, accountsResponse] = await Promise.all([api.get('/debts'), api.get('/accounts')]);
    setDebts(debtsResponse.data.data);
    setAccounts(accountsResponse.data.data);
  };

  useEffect(() => {
    refresh().catch(() => setError('Không thể tải khoản vay và khoản nợ.'));
  }, []);

  const addDebt = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      await api.post('/debts', { ...form, principalAmount: Number(form.principalAmount) });
      setForm((current) => ({ ...current, personName: '', principalAmount: '', note: '' }));
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể tạo khoản nợ.');
    }
  };

  const recordPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentDebtId) return;
    setError('');
    try {
      await api.post(`/debts/${paymentDebtId}/payments`, { amount: Number(payment.amount), accountId: payment.accountId || undefined, note: payment.note });
      setPaymentDebtId(null);
      setPayment({ amount: '', accountId: '', note: '' });
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể ghi nhận thanh toán.');
    }
  };

  return (
    <AppShell title="Vay & nợ" subtitle="Theo dõi các khoản vay và cho vay." actions={null}>
      <form onSubmit={addDebt} className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-3">
        <input required minLength={2} value={form.personName} onChange={(event) => setForm({ ...form, personName: event.target.value })} placeholder="Tên người liên quan" className="rounded-xl border border-slate-200 px-3 py-2" />
        <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as typeof form.type })} className="rounded-xl border border-slate-200 px-3 py-2"><option value="BORROWED">Tôi đi vay</option><option value="LENT">Tôi cho vay</option></select>
        <input required type="number" min="1" step="1" value={form.principalAmount} onChange={(event) => setForm({ ...form, principalAmount: event.target.value })} placeholder="Số tiền (VND)" className="rounded-xl border border-slate-200 px-3 py-2" />
        <label className="text-sm text-slate-500">Ngày bắt đầu<input required type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
        <label className="text-sm text-slate-500">Ngày đến hạn<input required type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2" /></label>
        <button className="self-end rounded-xl bg-blue-700 px-3 py-2 font-semibold text-white">Thêm khoản vay/nợ</button>
        <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Ghi chú" className="rounded-xl border border-slate-200 px-3 py-2 md:col-span-3" />
        {error && <p role="alert" className="text-sm text-red-600 md:col-span-3">{error}</p>}
      </form>
      <div className="grid gap-4 xl:grid-cols-2">
        {debts.map((item) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-lg font-bold">{item.personName}</div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.type === 'BORROWED' ? 'Tôi đi vay' : 'Tôi cho vay'} · {displayDebtStatus(item.status)}</div>
              </div>
              <Landmark className="text-slate-400" size={20} />
            </div>
            <div className="text-2xl font-bold text-slate-800">{formatMoney(item.outstandingAmount)}</div>
            <div className="mt-1 text-sm text-slate-500">Gốc {formatMoney(item.principalAmount)} · Hạn {new Date(item.dueDate).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</div>
            {item.outstandingAmount > 0 && <button onClick={() => { setPaymentDebtId(item.id); setPayment({ amount: '', accountId: '', note: '' }); }} className="mt-4 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">Ghi nhận thanh toán/thu hồi</button>}
            {paymentDebtId === item.id && <form onSubmit={recordPayment} className="mt-3 grid gap-2 sm:grid-cols-3">
              <input required type="number" min="1" max={item.outstandingAmount} step="1" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} placeholder="Số tiền" className="rounded-lg border px-3 py-2" />
              <select value={payment.accountId} onChange={(event) => setPayment({ ...payment, accountId: event.target.value })} className="rounded-lg border px-3 py-2"><option value="">Không cập nhật tài khoản</option>{accounts.map((account) => <option key={account.id} value={account.id}>{displayAccountName(account.name)}</option>)}</select>
              <button className="rounded-lg bg-emerald-600 px-3 py-2 text-white">Xác nhận</button>
              <input value={payment.note} onChange={(event) => setPayment({ ...payment, note: event.target.value })} placeholder="Ghi chú" className="rounded-lg border px-3 py-2 sm:col-span-3" />
            </form>}
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function ReportsPage() {
  const [summary, setSummary] = useState<any>(null);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = { ...(startDate ? { startDate: new Date(`${startDate}T00:00:00+07:00`).toISOString() } : {}), ...(endDate ? { endDate: new Date(`${endDate}T23:59:59.999+07:00`).toISOString() } : {}) };
    Promise.all([api.get('/reports/summary', { params }), api.get('/reports/income-expense', { params }), api.get('/reports/category-expenses', { params })])
      .then(([summaryResponse, monthlyResponse, categoryResponse]) => {
        setSummary(summaryResponse.data.data);
        setMonthly(monthlyResponse.data.data);
        setCategories(categoryResponse.data.data);
        setError('');
      })
      .catch((err) => setError(err.response?.data?.message ?? 'Không thể tải báo cáo.'));
  }, [startDate, endDate]);

  const exportReport = async () => {
    try {
      const response = await api.get('/reports/export', { params: {
        ...(startDate ? { startDate: new Date(`${startDate}T00:00:00+07:00`).toISOString() } : {}),
        ...(endDate ? { endDate: new Date(`${endDate}T23:59:59.999+07:00`).toISOString() } : {}),
      }, responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'fintrack-report.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể xuất báo cáo.');
    }
  };

  return (
    <AppShell title="Báo cáo" subtitle="Tổng quan tình hình tài chính của bạn." actions={null}>
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <label className="text-sm text-slate-500">Từ ngày<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 block rounded-lg border px-3 py-2" /></label>
        <label className="text-sm text-slate-500">Đến ngày<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 block rounded-lg border px-3 py-2" /></label>
        <button onClick={exportReport} className="rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white">Xuất CSV</button>
        {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard title="Thu nhập" value={summary?.totalIncome ?? 0} tone="green" icon={<ArrowUpRight size={18} />} />
        <SummaryCard title="Chi tiêu" value={summary?.totalExpense ?? 0} tone="red" icon={<ArrowDownLeft size={18} />} />
        <SummaryCard title="Số dư" value={summary?.balance ?? 0} tone="blue" icon={<TrendingUp size={18} />} />
      </div>
      <section className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">Thu chi theo tháng</h2>
          {monthly.length === 0 ? <p className="text-sm text-slate-500">Chưa có dữ liệu trong khoảng thời gian này.</p> : monthly.map((item) => <div key={item.month} className="flex justify-between border-b py-2 text-sm"><span>{item.month}</span><span className="text-emerald-700">+{formatMoney(item.income)}</span><span className="text-rose-600">-{formatMoney(item.expense)}</span></div>)}
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold">Chi tiêu theo danh mục</h2>
          {categories.length === 0 ? <p className="text-sm text-slate-500">Chưa có chi tiêu trong khoảng thời gian này.</p> : categories.map((item) => <div key={item.categoryId} className="flex justify-between border-b py-2 text-sm"><span>{displayCategoryName(item.name)}</span><span className="font-medium">{formatMoney(item.amount)}</span></div>)}
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm xl:col-span-2">
          <h2 className="mb-3 text-lg font-bold">Số dư theo tài khoản</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(summary?.accountBalances ?? []).map((account: any) => <div key={account.accountId} className="rounded-xl bg-slate-50 p-3"><div className="font-medium">{displayAccountName(account.name)}</div><div className="text-lg font-bold text-blue-700">{formatMoney(account.balance)}</div></div>)}</div>
        </div>
      </section>
    </AppShell>
  );
}

function SettingsPage() {
  const [profile, setProfile] = useState({ name: '', email: '', defaultCurrency: 'VND' });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/settings')
      .then((response) => setProfile(response.data.data))
      .catch(() => setError('Không thể tải cài đặt tài khoản.'));
  }, []);

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      const response = await api.patch('/settings', { name: profile.name, defaultCurrency: profile.defaultCurrency });
      setProfile((current) => ({ ...current, ...response.data.data }));
      setMessage('Đã cập nhật hồ sơ.');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể cập nhật hồ sơ.');
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage('');
    setError('');
    try {
      await api.patch('/auth/change-password', password);
      setPassword({ currentPassword: '', newPassword: '' });
      setMessage('Đã đổi mật khẩu.');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Không thể đổi mật khẩu.');
    }
  };

  return (
    <AppShell title="Cài đặt" subtitle="Quản lý thông tin cá nhân và tùy chọn tài khoản." actions={null}>
      {(message || error) && <p role={error ? 'alert' : 'status'} className={`mb-4 rounded-xl p-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{error || message}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={saveProfile} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold">Hồ sơ và tùy chọn</h3>
          <label className="block text-sm text-slate-500">Họ tên<input required minLength={2} value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2 text-slate-800" /></label>
          <label className="block text-sm text-slate-500">Địa chỉ email<input disabled value={profile.email} className="mt-1 w-full rounded-xl border bg-slate-50 px-3 py-2 text-slate-500" /></label>
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Tiền tệ hiện hỗ trợ: <strong className="text-slate-800">VND</strong>. Các tổng số liệu không trộn nhiều loại tiền tệ.</div>
          <button className="rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white">Lưu thay đổi</button>
        </form>
        <form onSubmit={changePassword} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold">Đổi mật khẩu</h3>
          <label className="block text-sm text-slate-500">Mật khẩu hiện tại<input required minLength={6} type="password" autoComplete="current-password" value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2 text-slate-800" /></label>
          <label className="block text-sm text-slate-500">Mật khẩu mới<input required minLength={6} type="password" autoComplete="new-password" value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2 text-slate-800" /></label>
          <button className="rounded-xl border border-blue-700 px-4 py-2 font-semibold text-blue-700">Đổi mật khẩu</button>
        </form>
      </div>
    </AppShell>
  );
}

interface PersonalProfile {
  name: string;
  email: string;
  phoneNumber: string;
  birthDate: string;
  avatarUrl: string;
}

const defaultProfileAvatarUrl = '/avatar-default.png';

function PersonalProfilePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInput = useRef<HTMLInputElement>(null);
  const returnPath = typeof location.state === 'object' && location.state !== null &&
    'from' in location.state && typeof location.state.from === 'string' &&
    location.state.from !== '/profile'
    ? location.state.from
    : '/dashboard';
  const [profile, setProfile] = useState<PersonalProfile>({
    name: '',
    email: '',
    phoneNumber: '',
    birthDate: '',
    avatarUrl: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const redirectTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.get('/settings')
      .then(({ data }) => {
        if (!cancelled) setProfile({
          name: data.data.name ?? '',
          email: data.data.email ?? '',
          phoneNumber: data.data.phoneNumber ?? '',
          birthDate: data.data.birthDate ?? '',
          avatarUrl: data.data.avatarUrl || defaultProfileAvatarUrl,
        });
      })
      .catch(() => {
        if (!cancelled) setLoadError('Không thể tải thông tin cá nhân. Vui lòng thử lại.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (redirectTimer.current !== null) window.clearTimeout(redirectTimer.current);
    };
  }, []);

  const updateAvatar = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('Ảnh đại diện chỉ hỗ trợ định dạng PNG, JPEG, WEBP hoặc GIF.');
      return;
    }
    if (file.size > 800_000) {
      setError('Ảnh đại diện phải nhỏ hơn 800 KB.');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProfile((current) => ({ ...current, avatarUrl: reader.result as string }));
      } else {
        setError('Không thể đọc ảnh đã chọn.');
      }
    };
    reader.onerror = () => setError('Không thể đọc ảnh đã chọn.');
    reader.readAsDataURL(file);
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const { data } = await api.patch('/settings', {
        name: profile.name,
        phoneNumber: profile.phoneNumber,
        birthDate: profile.birthDate || null,
        avatarUrl: profile.avatarUrl || null,
      });
      setProfile((current) => ({ ...current, ...data.data, avatarUrl: data.data.avatarUrl || defaultProfileAvatarUrl }));
      setMessage('Đã lưu thông tin cá nhân thành công.');
      redirectTimer.current = window.setTimeout(() => navigate(returnPath, { replace: true }), 1000);
    } catch (requestError) {
      const responseMessage = typeof requestError === 'object' && requestError !== null &&
        'response' in requestError && typeof requestError.response === 'object' && requestError.response !== null &&
        'data' in requestError.response && typeof requestError.response.data === 'object' &&
        requestError.response.data !== null && 'message' in requestError.response.data &&
        typeof requestError.response.data.message === 'string'
        ? requestError.response.data.message
        : 'Không thể lưu thông tin cá nhân. Vui lòng thử lại.';
      setError(responseMessage);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Thông tin cá nhân" subtitle="Cập nhật thông tin hồ sơ của bạn." actions={null}>
      <div className="mx-auto max-w-3xl">
        <button type="button" onClick={() => navigate(returnPath)} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-800">
          <ArrowLeft size={16} />
          Quay lại
        </button>
        <form onSubmit={saveProfile} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
          {loading ? <p className="py-8 text-center text-sm text-slate-500">Đang tải thông tin...</p> : loadError ? (
            <div className="space-y-4">
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{loadError}</p>
              <button type="button" onClick={() => window.location.reload()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">Tải lại</button>
            </div>
          ) : (
            <>
              {message && <p role="status" className="mb-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{message}</p>}
              {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <div className="mb-6 flex flex-col items-center gap-3 sm:flex-row">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-blue-100 bg-blue-50 text-2xl font-bold text-blue-700">
                  <img
                    src={profile.avatarUrl || defaultProfileAvatarUrl}
                    alt="Ảnh đại diện"
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      if (event.currentTarget.src !== new URL(defaultProfileAvatarUrl, window.location.origin).href) {
                        event.currentTarget.src = defaultProfileAvatarUrl;
                      }
                    }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <button type="button" onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <Camera size={16} />
                    Chọn ảnh đại diện
                  </button>
                  {profile.avatarUrl && profile.avatarUrl !== defaultProfileAvatarUrl && <button type="button" onClick={() => setProfile((current) => ({ ...current, avatarUrl: defaultProfileAvatarUrl }))} className="rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Khôi phục ảnh mặc định</button>}
                  <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={updateAvatar} />
                  <span className="w-full text-center text-xs text-slate-500 sm:text-left">PNG, JPEG, WEBP hoặc GIF · tối đa 800 KB</span>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-600">
                  Họ và tên
                  <input required minLength={2} maxLength={100} autoComplete="name" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 outline-none focus:border-blue-500" />
                </label>
                <label className="block text-sm font-medium text-slate-600">
                  Email
                  <input type="email" disabled value={profile.email} autoComplete="email" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-500" />
                  <span className="mt-1 block text-xs font-normal text-slate-400">Email đăng nhập không thể đổi tại đây.</span>
                </label>
                <label className="block text-sm font-medium text-slate-600">
                  Số điện thoại
                  <input type="tel" maxLength={30} autoComplete="tel" value={profile.phoneNumber} onChange={(event) => setProfile({ ...profile, phoneNumber: event.target.value })} placeholder="Nhập số điện thoại" className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 outline-none focus:border-blue-500" />
                </label>
                <label className="block text-sm font-medium text-slate-600">
                  Ngày sinh
                  <input type="date" autoComplete="bday" value={profile.birthDate} onChange={(event) => setProfile({ ...profile, birthDate: event.target.value })} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800 outline-none focus:border-blue-500" />
                </label>
              </div>
              <div className="mt-7 flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-5 sm:flex-row">
                <button type="button" onClick={() => navigate(returnPath)} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Hủy</button>
                <button type="submit" disabled={saving} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60">
                  {saving ? 'Đang lưu...' : 'Lưu thông tin'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </AppShell>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  useLocation();
  return localStorage.getItem('fintrack-token') ? <>{children}</> : <Navigate to="/login" replace />;
}

function AuthenticatedChatbot() {
  const location = useLocation();
  const token = localStorage.getItem('fintrack-token');
  if (!token || location.pathname === '/login') return null;

  let sessionId = 2166136261;
  for (let index = 0; index < token.length; index += 1) {
    sessionId = Math.imul(sessionId ^ token.charCodeAt(index), 16777619);
  }
  return <ChatbotWidget key={sessionId >>> 0} sessionId={(sessionId >>> 0).toString(36)} />;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
        <Route path="/accounts" element={<ProtectedRoute><AccountsPage /></ProtectedRoute>} />
        <Route path="/categories" element={<ProtectedRoute><CategoriesPage /></ProtectedRoute>} />
        <Route path="/budgets" element={<ProtectedRoute><BudgetsPage /></ProtectedRoute>} />
        <Route path="/debts" element={<ProtectedRoute><DebtsPage /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><PersonalProfilePage /></ProtectedRoute>} />
      </Routes>
      <AuthenticatedChatbot />
    </>
  );
}
