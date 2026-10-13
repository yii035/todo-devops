import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DashboardChartsProps = {
  incomeTrend: Array<{ name: string; income: number; expense: number }>;
  categoryExpense: Array<{ name: string; value: number }>;
};

const formatMoney = (value: number) => `${value.toLocaleString('vi-VN')}đ`;

const categoryNameTranslations: Record<string, string> = {
  salary: 'Lương',
  allowance: 'Trợ cấp',
  food: 'Ăn uống',
  shopping: 'Mua sắm',
  transportation: 'Di chuyển',
  'other income': 'Thu nhập khác',
  other: 'Khác',
};

export default function DashboardCharts({ incomeTrend, categoryExpense }: DashboardChartsProps) {
  const localizedCategoryExpense = categoryExpense.map((item) => ({
    ...item,
    name: categoryNameTranslations[item.name.toLowerCase()] ?? item.name,
  }));

  return (
    <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-5 text-lg font-bold">Thu nhập và chi tiêu theo tháng</h2>
        {incomeTrend.length === 0 ? <div className="flex h-64 items-center justify-center text-sm text-slate-500">Chưa có dữ liệu biểu đồ.</div> : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={incomeTrend} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1_000_000)}tr`} />
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
                <Line type="monotone" dataKey="income" name="Thu nhập" stroke="#2563eb" strokeWidth={3} />
                <Line type="monotone" dataKey="expense" name="Chi tiêu" stroke="#f87171" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-bold">Chi tiêu theo danh mục</h2>
        {localizedCategoryExpense.length === 0 ? <div className="flex h-64 items-center justify-center text-sm text-slate-500">Chưa có chi tiêu trong kỳ.</div> : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={localizedCategoryExpense} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {localizedCategoryExpense.map((item, index) => <Cell key={item.name} fill={['#2563eb', '#f97316', '#10b981', '#8b5cf6', '#ef4444', '#06b6d4'][index % 6]} />)}
                </Pie>
                <Tooltip formatter={(value) => formatMoney(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
