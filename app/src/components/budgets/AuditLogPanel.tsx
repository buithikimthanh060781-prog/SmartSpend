import { History } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Pagination } from '@/components/Pagination';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useBudgetAuditLogs } from '@/hooks/useBudgets';
import { PAGE_SIZE } from '@/lib/constants';
import { PERIOD_TYPE_LABEL, type PeriodType } from '@/lib/budget';
import { toUserMessage } from '@/lib/errors';
import { formatMoney, subtractMoney, tryToMoney } from '@/lib/money';
import { periodLabel } from '@/lib/periods';
import { cn } from '@/lib/utils';
import type { SsBudget, SsBudgetAuditLog } from '@/types/db';

/** Tên hành động trong audit log chưa được xác minh với database nên chỉ nhận dạng theo từ khóa, giá trị lạ hiển thị nguyên văn. */
export function actionLabel(action: string): string {
  const a = action.toLowerCase();
  if (/(insert|create)/.test(a)) return 'Tạo ngân sách';
  if (/update/.test(a)) return 'Sửa hạn mức';
  if (/delete/.test(a)) return 'Xóa ngân sách';
  return action;
}

/** Chênh lệch new - old; null nếu thiếu một trong hai giá trị hoặc giá trị hỏng (không âm thầm coi là 0). */
export function auditDelta(log: Pick<SsBudgetAuditLog, 'old_amount' | 'new_amount'>): number | null {
  if (tryToMoney(log.old_amount) === null || tryToMoney(log.new_amount) === null) return null;
  return subtractMoney(log.new_amount, log.old_amount);
}

function budgetLabel(b: SsBudget | undefined, categoryName: (id: string) => string | undefined): string {
  if (!b) return 'Ngân sách đã bị xóa';
  const type = b.period_type as PeriodType;
  const scope = b.category_id === null ? 'Tổng chi tiêu' : categoryName(b.category_id) ?? 'Danh mục';
  return `${scope} · ${PERIOD_TYPE_LABEL[type] ?? b.period_type} ${periodLabel({ type, start: b.period_start, endExclusive: b.period_end })}`;
}

interface Props {
  budgetId: string;
  page: number;
  onPageChange: (page: number) => void;
  onClearBudget: () => void;
  currency: string;
  categoryName: (id: string) => string | undefined;
}

/** Lịch sử điều chỉnh ngân sách (chỉ đọc). Ghi log là việc của database (trigger), frontend không bao giờ ghi bảng này. */
export function AuditLogPanel({ budgetId, page, onPageChange, onClearBudget, currency, categoryName }: Props) {
  const logs = useBudgetAuditLogs({ budgetId, page });

  return (
    <Card>
      {budgetId && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 text-sm">
          <span className="text-slate-600">Đang lọc lịch sử của một ngân sách.</span>
          <Button variant="ghost" size="sm" onClick={onClearBudget}>Xem tất cả</Button>
        </div>
      )}
      {logs.isLoading && <div className="p-5"><LoadingSkeleton /></div>}
      {logs.error && !logs.isLoading && <div className="p-5"><ErrorState message={toUserMessage(logs.error)} onRetry={() => void logs.refetch()} /></div>}
      {logs.data && logs.data.rows.length === 0 && (
        <EmptyState
          icon={History}
          title="Chưa có lịch sử điều chỉnh"
          description="Mỗi lần tạo, sửa hoặc xóa ngân sách sẽ được database ghi lại. Nếu bạn đã sửa ngân sách mà vẫn trống, database có thể chưa có trigger ghi lịch sử (xem database/verify_sprint3.sql)."
        />
      )}
      {logs.data && logs.data.rows.length > 0 && (
        <>
          <ul className="divide-y divide-slate-100 px-5">
            {logs.data.rows.map((log) => {
              const delta = auditDelta(log);
              return (
                <li key={log.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-navy">{actionLabel(log.action)}</p>
                    <p className="truncate text-xs text-slate-500">{budgetLabel(logs.data.budgets.get(log.budget_id), (id) => categoryName(id))}</p>
                    <p className="text-xs text-slate-400">{new Date(log.changed_at).toLocaleString('vi-VN')}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-slate-600">
                      {log.old_amount === null ? '—' : formatMoney(tryToMoney(log.old_amount) ?? 0, currency)} →{' '}
                      <strong className="text-navy">{log.new_amount === null ? '—' : formatMoney(tryToMoney(log.new_amount) ?? 0, currency)}</strong>
                    </p>
                    <p className={cn('text-xs font-semibold', delta === null ? 'text-slate-400' : delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-slate-500')}>
                      {delta === null ? 'Chênh lệch: —' : `Chênh lệch: ${delta > 0 ? '+' : ''}${formatMoney(delta, currency)}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={logs.data.total} onPageChange={onPageChange} />
        </>
      )}
    </Card>
  );
}
