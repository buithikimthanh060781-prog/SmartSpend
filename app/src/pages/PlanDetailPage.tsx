import { ArrowLeft, Pencil, Receipt } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { PlanFormDialog } from '@/components/plans/PlanFormDialog';
import { PlanProgress } from '@/components/plans/PlanProgress';
import { PlanStatusSelect } from '@/components/plans/PlanStatusSelect';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCategories } from '@/hooks/useCategories';
import { usePlanDetail } from '@/hooks/usePlans';
import { useSettings } from '@/hooks/useSettings';
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/lib/constants';
import { formatDate } from '@/lib/dates';
import { toUserMessage } from '@/lib/errors';
import { formatAmount, tryToMoney } from '@/lib/money';

export function PlanDetailPage() {
  const { id = '' } = useParams();
  const { currency } = useSettings();
  const { categories, byId } = useCategories();
  const detail = usePlanDetail(id);
  const [editOpen, setEditOpen] = useState(false);

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link to="/plans">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Danh sách kế hoạch
      </Link>
    </Button>
  );

  if (detail.isLoading) return <div className="space-y-4">{back}<LoadingSkeleton /></div>;
  if (detail.error) return <div className="space-y-4">{back}<ErrorState message={toUserMessage(detail.error)} onRetry={() => void detail.refetch()} /></div>;
  if (!detail.data) {
    return (
      <div className="space-y-4">
        {back}
        <Card><EmptyState icon={Receipt} title="Không tìm thấy kế hoạch" description="Kế hoạch không tồn tại hoặc bạn không có quyền xem." /></Card>
      </div>
    );
  }

  const { plan, expenses, spent } = detail.data;
  const planned = tryToMoney(plan.planned_amount);

  return (
    <div className="space-y-6">
      {back}
      <PageHeader
        title={plan.title}
        subtitle={`${byId.get(plan.category_id)?.name ?? 'Chưa phân loại'} · Ngày dự kiến ${formatDate(plan.planned_date)}`}
        action={
          <div className="flex items-center gap-2">
            <PlanStatusSelect planId={plan.id} status={plan.status} linkedCount={spent.count} />
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" aria-hidden />
              Sửa
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent>
          {planned === null ? (
            <p role="alert" className="text-sm font-semibold text-danger">Số tiền kế hoạch không hợp lệ trong dữ liệu, không thể so sánh với thực chi.</p>
          ) : (
            <PlanProgress planned={planned} spent={spent.spent} currency={currency} />
          )}
          {plan.note && <p className="mt-4 whitespace-pre-line text-sm text-slate-600">{plan.note}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Giao dịch liên kết ({expenses.length})</CardTitle>
        </CardHeader>
        {expenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Chưa có giao dịch liên kết"
            description="Khi thêm chi tiêu, chọn kế hoạch này (cùng danh mục) để theo dõi thực chi."
            action={<Button asChild variant="accent"><Link to="/expenses">Đến trang Chi tiêu</Link></Button>}
          />
        ) : (
          <ul className="divide-y divide-slate-100 px-5 py-2">
            {expenses.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy">{e.description || 'Chi tiêu'}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(e.expense_date)} · {PAYMENT_METHOD_LABEL[e.payment_method as PaymentMethod] ?? e.payment_method}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-danger">-{formatAmount(e.amount, currency)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <PlanFormDialog open={editOpen} onOpenChange={setEditOpen} editing={plan} categories={categories} linkedCount={spent.count} />
    </div>
  );
}
