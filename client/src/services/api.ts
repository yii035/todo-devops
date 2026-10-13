import axios from 'axios';

let isRedirectingToLogin = false;

const errorTranslations: Record<string, string> = {
  'Authentication required.': 'Vui lòng đăng nhập để tiếp tục.',
  'Invalid or expired token.': 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
  'Invalid email or password.': 'Email hoặc mật khẩu không chính xác.',
  'Email already exists.': 'Email này đã được đăng ký.',
  'Invalid registration payload.': 'Thông tin đăng ký không hợp lệ.',
  'Invalid login payload.': 'Thông tin đăng nhập không hợp lệ.',
  'Invalid password update payload.': 'Thông tin đổi mật khẩu không hợp lệ.',
  'User not found.': 'Không tìm thấy người dùng.',
  'Account not found.': 'Không tìm thấy tài khoản.',
  'Category not found.': 'Không tìm thấy danh mục.',
  'Transaction not found.': 'Không tìm thấy giao dịch.',
  'Budget not found.': 'Không tìm thấy ngân sách.',
  'Debt not found.': 'Không tìm thấy khoản vay hoặc nợ.',
  'Notification not found.': 'Không tìm thấy thông báo.',
  'Invalid account payload.': 'Thông tin tài khoản không hợp lệ.',
  'Invalid category payload.': 'Thông tin danh mục không hợp lệ.',
  'Invalid category filters.': 'Bộ lọc danh mục không hợp lệ.',
  'Invalid transaction payload.': 'Thông tin giao dịch không hợp lệ.',
  'Invalid budget payload.': 'Thông tin ngân sách không hợp lệ.',
  'Invalid debt payload.': 'Thông tin khoản vay hoặc nợ không hợp lệ.',
  'Invalid debt payment payload.': 'Thông tin thanh toán không hợp lệ.',
  'Invalid settings payload.': 'Thông tin cài đặt không hợp lệ.',
  'Invalid notification filters.': 'Bộ lọc thông báo không hợp lệ.',
  'Invalid transaction ID.': 'Mã giao dịch không hợp lệ.',
  'Invalid account ID.': 'Mã tài khoản không hợp lệ.',
  'Invalid category ID.': 'Mã danh mục không hợp lệ.',
  'Invalid debt ID.': 'Mã khoản vay hoặc nợ không hợp lệ.',
  'Invalid notification ID.': 'Mã thông báo không hợp lệ.',
  'Category name already exists for this type.': 'Tên danh mục này đã tồn tại trong cùng loại.',
  'Category is in use and cannot be archived.': 'Danh mục đang được sử dụng nên không thể lưu trữ.',
  'A budget already exists for this category and period.': 'Ngân sách cho danh mục và thời gian này đã tồn tại.',
  'Budget category must be an active expense category.': 'Danh mục ngân sách phải là danh mục chi tiêu đang hoạt động.',
  'Invalid budget period or limit.': 'Thời gian hoặc hạn mức ngân sách không hợp lệ.',
  'Password updated successfully.': 'Đổi mật khẩu thành công.',
  'Current password is incorrect.': 'Mật khẩu hiện tại không chính xác.',
  'dueDate must not precede startDate.': 'Ngày đến hạn không được trước ngày bắt đầu.',
};

function localizeErrorMessage(message: unknown) {
  if (typeof message !== 'string') return message;
  const exactTranslation = errorTranslations[message];
  if (exactTranslation) return exactTranslation;
  if (message === 'Invalid transaction type or date range.') return 'Loại giao dịch hoặc khoảng ngày không hợp lệ.';
  if (message === 'Invalid report filters.') return 'Bộ lọc báo cáo không hợp lệ.';
  if (message === 'Invalid startDate.') return 'Ngày bắt đầu không hợp lệ.';
  if (message === 'Invalid endDate.') return 'Ngày kết thúc không hợp lệ.';
  if (message === 'Invalid dashboard period.') return 'Khoảng thời gian trên bảng tổng quan không hợp lệ.';
  if (message === 'Provide a valid startDate and endDate range.') return 'Vui lòng chọn khoảng ngày bắt đầu và kết thúc hợp lệ.';
  if (message === 'months must be between 1 and 12.') return 'Số tháng phải từ 1 đến 12.';
  if (message === 'limit must be between 1 and 20.') return 'Giới hạn phải từ 1 đến 20.';
  if (message === 'Invalid transaction ID.') return errorTranslations['Invalid transaction ID.'];
  if (message === 'Debt not found or invalid ID.') return 'Không tìm thấy khoản vay hoặc mã không hợp lệ.';
  return message;
}

const api = axios.create({
  baseURL: '/api/v1',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fintrack-token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const responseData = error.response?.data;
      if (typeof responseData === 'object' && responseData !== null && 'message' in responseData) {
        responseData.message = localizeErrorMessage(responseData.message);
      }
    }

    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const requestUrl = error.config?.url ?? '';
      const isAuthenticationRequest = requestUrl.endsWith('/auth/login') || requestUrl.endsWith('/auth/register');

      if (!isAuthenticationRequest && localStorage.getItem('fintrack-token')) {
        localStorage.removeItem('fintrack-token');
        if (!isRedirectingToLogin && window.location.pathname !== '/login') {
          isRedirectingToLogin = true;
          window.location.assign('/login');
        }
      }
    }

    return Promise.reject(error);
  },
);

export default api;
