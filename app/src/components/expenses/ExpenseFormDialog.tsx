import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Field } from '@/components/common/Field';
import { FormActions, FormDialog } from '@/components/common/FormDialog';
import { Input } from '@/components/ui/input';
import { Select, Textarea } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { selectableCategories } from '@/hooks/useCategories';
import { useExpenseBudgetAlerts } from '@/hooks/useExpenseAlerts';
import { useExpenseMutations, useLinkablePlans } from '@/hooks/useExpenses';
import { todayIso, useSettings } from '@/hooks/useSettings';
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/lib/constants';
import { toMutationMessage } from '@/lib/errors';
import { formatAmount, parseMoneyInput, toMoneyInput } from '@/lib/money';
import { emptyToNull } from '@/schemas/common';
import { expenseSchema, type ExpenseFormValues } from '@/schemas/expense';
import type { SsCategory, SsExpense } from '@/types/db';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SsExpense | null;
  categories: SsCategory[];
}

export function ExpenseFormDialog({ open, onOpenChange, editing, categories }: Props) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={editing ? 'Sửa chi tiêu' : 'Thêm chi tiêu'}>
      <ExpenseForm editing={editing} categories={categories} onClose={() => onOpenChange(false)} />
    </FormDialog>
  );
}

function ExpenseForm({ editing, categories, onClose }: Omit<Props, 'open' | 'onOpenChange'> & { onClose: () => void }) {
  const toast = useToast();
  const { timezone, currency } = useSettings();
  const { create, update } = useExpenseMutations();
  const alerts = useExpenseBudgetAlerts();
  const [formError, setFormError] = useState<string | null>(null);
  const options = selectableCategories(categories, 'expense', editing?.category_id);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      category_id: editing?.category_id ?? '',
      plan_id: editing?.plan_id ?? '',
      amount: editing ? toMoneyInput(editing.amount) : '',
      expense_date: editing?.expense_date ?? todayIso(timezone),
      payment_method: (editing?.payment_method as PaymentMethod | undefined) ?? 'cash',
      description: editing?.description ?? '',
      note: editing?.note ?? '',
    },
  });

  const categoryId = watch('category_id');
  // Chỉ kế hoạch của chính người dùng, cùng danh mục, chưa bị hủy.
  const plans = useLinkablePlans(categoryId);

  async function onSubmit(v: ExpenseFormValues) {
    setFormError(null);
    if (v.plan_id && !plans.data?.some((p) => p.id === v.plan_id)) {
      setError('plan_id', { message: 'Kế hoạch phải cùng danh mục và chưa bị hủy.' });
      return;
    }
    const input = {
      category_id: v.category_id,
      plan_id: v.plan_id || null,
      amount: parseMoneyInput(v.amount) ?? 0,
      expense_date: v.expense_date,
      payment_method: v.payment_method,
      description: v.description,
      note: emptyToNull(v.note),
    };
    try {
      // Mốc cảnh báo TRƯỚC khi ghi, để chỉ báo những ngưỡng mà chính thao tác này vừa chạm/vượt.
      const before = await alerts.snapshot(input.expense_date);
      if (editing) await update.mutateAsync({ id: editing.id, input });
      else await create.mutateAsync(input);
      toast.success(editing ? 'Đã cập nhật chi tiêu.' : 'Đã thêm chi tiêu.');
      onClose();
      // Không await: cảnh báo không được làm chậm hay chặn việc ghi nhận chi tiêu (vượt ngân sách vẫn được phép).
      void alerts.notify(before, input.expense_date);
    } catch (e) {
      const message = toMutationMessage(e);
      setFormError(message);
      toast.error(message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Field label="Danh mục" htmlFor="exp-cat" error={errors.category_id?.message}>
        <Select
          id="exp-cat"
          aria-invalid={Boolean(errors.category_id)}
          {...register('category_id', { onChange: () => setValue('plan_id', '') })}
        >
          <option value="">Chọn danh mục</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.is_active ? '' : ' (đã tắt)'}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Số tiền" htmlFor="exp-amount" error={errors.amount?.message}>
          <Input id="exp-amount" inputMode="decimal" placeholder="150.000" aria-invalid={Boolean(errors.amount)} {...register('amount')} />
        </Field>
        <Field label="Ngày" htmlFor="exp-date" error={errors.expense_date?.message}>
          <Input id="exp-date" type="date" aria-invalid={Boolean(errors.expense_date)} {...register('expense_date')} />
        </Field>
      </div>
      <Field label="Phương thức thanh toán" htmlFor="exp-method" error={errors.payment_method?.message}>
        <Select id="exp-method" {...register('payment_method')}>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {PAYMENT_METHOD_LABEL[m]}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Kế hoạch liên kết"
        htmlFor="exp-plan"
        error={errors.plan_id?.message}
        hint={categoryId ? 'Để trống nếu đây là chi tiêu ngoài kế hoạch.' : 'Chọn danh mục trước để xem các kế hoạch phù hợp.'}
      >
        {/* Không dùng `disabled`: ô vô hiệu hóa trả về undefined trong React Hook Form và làm form không hợp lệ. */}
        <Select id="exp-plan" aria-invalid={Boolean(errors.plan_id)} {...register('plan_id')}>
          <option value="">{plans.isLoading ? 'Đang tải kế hoạch...' : 'Không liên kết (ngoài kế hoạch)'}</option>
          {(plans.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} · {formatAmount(p.planned_amount, currency)}
            </option>
          ))}
        </Select>
        {plans.error && <p className="mt-1 text-sm text-danger">Không tải được danh sách kế hoạch.</p>}
      </Field>
      <Field label="Mô tả" htmlFor="exp-desc" error={errors.description?.message}>
        <Input id="exp-desc" maxLength={200} {...register('description')} />
      </Field>
      <Field label="Ghi chú (không bắt buộc)" htmlFor="exp-note" error={errors.note?.message}>
        <Textarea id="exp-note" maxLength={500} {...register('note')} />
      </Field>
      <FormActions onCancel={onClose} submitting={isSubmitting} error={formError} submitLabel={editing ? 'Lưu thay đổi' : 'Thêm chi tiêu'} />
    </form>
  );
}
