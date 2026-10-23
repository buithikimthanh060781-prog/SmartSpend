import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Field } from '@/components/common/Field';
import { FormActions, FormDialog } from '@/components/common/FormDialog';
import { Input } from '@/components/ui/input';
import { Select, Textarea } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { selectableCategories } from '@/hooks/useCategories';
import { useIncomeMutations } from '@/hooks/useIncomes';
import { todayIso, useSettings } from '@/hooks/useSettings';
import { INCOME_STATUSES, INCOME_STATUS_LABEL, type IncomeStatus } from '@/lib/constants';
import { toMutationMessage } from '@/lib/errors';
import { parseMoneyInput, toMoneyInput } from '@/lib/money';
import { emptyToNull } from '@/schemas/common';
import { incomeSchema, type IncomeFormValues } from '@/schemas/income';
import type { SsCategory, SsIncome } from '@/types/db';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SsIncome | null;
  categories: SsCategory[];
}

export function IncomeFormDialog({ open, onOpenChange, editing, categories }: Props) {
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={editing ? 'Sửa thu nhập' : 'Thêm thu nhập'}>
      <IncomeForm editing={editing} categories={categories} onClose={() => onOpenChange(false)} />
    </FormDialog>
  );
}

export function IncomeForm({ editing, categories, onClose }: Omit<Props, 'open' | 'onOpenChange'> & { onClose: () => void }) {
  const toast = useToast();
  const { timezone } = useSettings();
  const { create, update } = useIncomeMutations();
  const options = selectableCategories(categories, 'income', editing?.category_id);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      category_id: editing?.category_id ?? '',
      amount: editing ? toMoneyInput(editing.amount) : '',
      income_date: editing?.income_date ?? todayIso(timezone),
      status: (editing?.status as IncomeStatus | undefined) ?? 'received',
      description: editing?.description ?? '',
      note: editing?.note ?? '',
    },
  });

  async function onSubmit(v: IncomeFormValues) {
    setFormError(null);
    const input = {
      category_id: v.category_id,
      amount: parseMoneyInput(v.amount) ?? 0,
      income_date: v.income_date,
      status: v.status,
      description: v.description,
      note: emptyToNull(v.note),
    };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input });
      else await create.mutateAsync(input);
      toast.success(editing ? 'Đã cập nhật thu nhập.' : 'Đã thêm thu nhập.');
      onClose();
    } catch (e) {
      const message = toMutationMessage(e);
      setFormError(message);
      toast.error(message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Field label="Danh mục" htmlFor="inc-cat" error={errors.category_id?.message}>
        <Select id="inc-cat" aria-invalid={Boolean(errors.category_id)} {...register('category_id')}>
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
        <Field label="Số tiền" htmlFor="inc-amount" error={errors.amount?.message}>
          <Input id="inc-amount" inputMode="decimal" placeholder="1.500.000" aria-invalid={Boolean(errors.amount)} {...register('amount')} />
        </Field>
        <Field label="Ngày" htmlFor="inc-date" error={errors.income_date?.message}>
          <Input id="inc-date" type="date" aria-invalid={Boolean(errors.income_date)} {...register('income_date')} />
        </Field>
      </div>
      <Field label="Trạng thái" htmlFor="inc-status" error={errors.status?.message} hint="Chỉ thu nhập 'Đã nhận' được tính vào tổng thu nhập trên Tổng quan.">
        <Select id="inc-status" {...register('status')}>
          {INCOME_STATUSES.map((s) => (
            <option key={s} value={s}>
              {INCOME_STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Mô tả" htmlFor="inc-desc" error={errors.description?.message}>
        <Input id="inc-desc" maxLength={200} {...register('description')} />
      </Field>
      <Field label="Ghi chú (không bắt buộc)" htmlFor="inc-note" error={errors.note?.message}>
        <Textarea id="inc-note" maxLength={500} {...register('note')} />
      </Field>
      <FormActions onCancel={onClose} submitting={isSubmitting} error={formError} submitLabel={editing ? 'Lưu thay đổi' : 'Thêm thu nhập'} />
    </form>
  );
}
