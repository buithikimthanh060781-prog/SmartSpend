import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from '@/components/ErrorState';
import { toUserMessage } from '@/lib/errors';

interface State {
  error: unknown;
}

/** Chặn lỗi khi render (ví dụ dữ liệu tiền hỏng) để một trang lỗi không làm trắng cả ứng dụng. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[Smart Spend] Lỗi khi hiển thị trang:', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    // Chuyển sang trang khác thì thử hiển thị lại.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (this.state.error === null) return this.props.children;
    return (
      <ErrorState
        title="Không hiển thị được trang này"
        message={toUserMessage(this.state.error, 'Đã có lỗi khi hiển thị dữ liệu. Vui lòng tải lại trang.')}
        onRetry={() => this.setState({ error: null })}
      />
    );
  }
}
