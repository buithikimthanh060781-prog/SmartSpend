import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Field } from '@/components/common/Field';
import { FormActions, FormDialog } from '@/components/common/FormDialog';
import { Input } from '@/components/ui/input';
import { Select, Textarea } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { selectableCategories } from '@/hooks/useCategories';
import { usePlanMutations } from '@/hooks/usePlans';
import { todayIso, useSettings } from '@/hooks/useSettings';
import { PLAN_STATUSES, PLAN_STATUS_LABEL, type PlanStatus } from '@/lib/constants';
import { toMutationMessage } from '@/lib/errors';
import { parseMoneyInput, toMoneyInput } from '@/lib/money';
import { emptyToNull } from '@/schemas/common';
import { planSchema, type PlanFormValues } from '@/schemas/plan';
import type { SsCategory, SsExpensePlan } from '@/types/db';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SsExpensePlan | null;
  categories: SsCategory[];
  /** Số giao dịch đã liên kết với kế hoạch đang sửa. */
  linkedCount: number;
}

export function PlanFormDialog({ open, onOpenChange, editing, categories, linkedCount }: Props) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={editing ? 'Sửa kế hoạch' : 'Tạo kế hoạch chi tiêu'}>
      <PlanForm editing={editing} categories={categories} linkedCount={linkedCount} onClose={() => onOpenChange(false)} />
    </FormDialog>
  );
}

export function PlanForm({ editing, categories, linkedCount, onClose }: Omit<Props, 'open' | 'onOpenChange'> & { onClose: () => void }) {
  const toast = useToast();
  const { timezone } = useSettings();
  const { create, update } = usePlanMutations();
  const options = selectableCategories(categories, 'expense', editing?.category_id);
  const hasLinked = Boolean(editing) && linkedCount > 0;
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      category_id: editing?.category_id ?? '',
      title: editing?.title ?? '',
      planned_date: editing?.planned_date ?? todayIso(timezone),
      planned_amount: editing ? toMoneyInput(editing.planned_amount) : '',
      status: (editing?.status as PlanStatus | undefined) ?? 'planned',
      note: editing?.note ?? '',
    },
  });

  async function onSubmit(v: PlanFormValues) {
    setFormError(null);
    if (v.status === 'cancelled' && hasLinked) {
      setError('status', { message: `Không thể hủy: kế hoạch đã có ${linkedCount} giao dịch liên kết.` });
      return;
    }
    const input = {
      category_id: v.category_id,
      title: v.title,
      planned_date: v.planned_date,
      planned_amount: parseMoneyInput(v.planned_amount) ?? 0,
      status: v.status,
      note: emptyToNull(v.note),
    };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input });
      else await create.mutateAsync(input);
      toast.success(editing ? 'Đã cập nhật kế hoạch.' : 'Đã tạo kế hoạch.');
      onClose();
    } catch (e) {
      const message = toMutationMessage(e);
      setFormError(message);
      toast.error(message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Field label="Tên kế hoạch" htmlFor="plan-title" error={errors.title?.message}>
        <Input id="plan-title" maxLength={120} aria-invalid={Boolean(errors.title)} {...register('title')} />
      </Field>
      <Field
        label="Danh mục"
        htmlFor="plan-cat"
        error={errors.category_id?.message}
        hint={hasLinked ? 'Không đổi được danh mục vì kế hoạch đã có giao dịch liên kết.' : undefined}
      >
        {/* Khi khóa danh mục: ô vô hiệu hóa trả về undefined trong React Hook Form khiến form không bao giờ hợp lệ,
            nên giá trị thật nằm ở ô ẩn được đăng ký; ô hiển thị chỉ để đọc. */}
        {hasLinked && <input type="hidden" {...register('category_id')} />}
        <Select
          id="plan-cat"
          aria-invalid={Boolean(errors.category_id)}
          {...(hasLinked ? { disabled: true, value: editing?.category_id ?? '', onChange: () => undefined } : register('category_id'))}
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
        <Field label="Số tiền dự kiến" htmlFor="plan-amount" error={errors.planned_amount?.message}>
          <Input id="plan-amount" inputMode="decimal" placeholder="5.000.000" aria-invalid={Boolean(errors.planned_amount)} {...register('planned_amount')} />
        </Field>
        <Field label="Ngày dự kiến" htmlFor="plan-date" error={errors.planned_date?.message}>
          <Input id="plan-date" type="date" aria-invalid={Boolean(errors.planned_date)} {...register('planned_date')} />
        </Field>
      </div>
      <Field label="Trạng thái" htmlFor="plan-status" error={errors.status?.message}>
        <Select id="plan-status" {...register('status')}>
          {PLAN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PLAN_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Ghi chú (không bắt buộc)" htmlFor="plan-note" error={errors.note?.message}>
        <Textarea id="plan-note" maxLength={500} {...register('note')} />
      </Field>
      <FormActions onCancel={onClose} submitting={isSubmitting} error={formError} submitLabel={editing ? 'Lưu thay đổi' : 'Tạo kế hoạch'} />
    </form>
  );
}
