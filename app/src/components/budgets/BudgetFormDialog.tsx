import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Field } from '@/components/common/Field';
import { FormActions, FormDialog } from '@/components/common/FormDialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { useBudgetMutations } from '@/hooks/useBudgets';
import { selectableCategories } from '@/hooks/useCategories';
import { todayIso, useSettings } from '@/hooks/useSettings';
import { PERIOD_TYPES, PERIOD_TYPE_LABEL, type PeriodType } from '@/lib/budget';
import { toMutationMessage } from '@/lib/errors';
import { formatMoney, parseMoneyInput, toMoneyInput } from '@/lib/money';
import { periodContaining, periodLabel } from '@/lib/periods';
import { budgetAmountSchema, budgetSchema, type BudgetAmountValues, type BudgetFormValues } from '@/schemas/budget';
import { isMajorChange, type BudgetEvaluation } from '@/services/budgetCalculation';
import type { SsCategory } from '@/types/db';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = tạo mới; có giá trị = sửa hạn mức của ngân sách đó. */
  editing: BudgetEvaluation | null;
  categories: SsCategory[];
  defaultType: PeriodType;
  defaultAnchor?: string;
}

export function BudgetFormDialog({ open, onOpenChange, editing, categories, defaultType, defaultAnchor }: Props) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Sửa hạn mức ngân sách' : 'Thiết lập ngân sách'}
      description={
        editing
          ? 'Chỉ sửa được số tiền hạn mức. Muốn đổi kỳ, ngày bắt đầu hoặc danh mục, hãy tạo ngân sách mới.'
          : 'Bạn tự nhập hạn mức cho từng kỳ. Hạn mức ngày, tuần, tháng độc lập, không tự cộng dồn hay phân bổ.'
      }
    >
      {editing ? (
        <EditAmountForm editing={editing} categories={categories} onClose={() => onOpenChange(false)} />
      ) : (
        <CreateForm categories={categories} defaultType={defaultType} defaultAnchor={defaultAnchor} onClose={() => onOpenChange(false)} />
      )}
    </FormDialog>
  );
}

function CreateForm({ categories, defaultType, defaultAnchor, onClose }: Pick<Props, 'categories' | 'defaultType' | 'defaultAnchor'> & { onClose: () => void }) {
  const toast = useToast();
  const { timezone } = useSettings();
  const { create } = useBudgetMutations();
  const options = selectableCategories(categories, 'expense');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { period_type: defaultType, anchor: defaultAnchor ?? todayIso(timezone), scope: 'total', category_id: '', amount: '' },
  });

  const [type, anchor, scope] = watch(['period_type', 'anchor', 'scope']);
  const preview = /^\d{4}-\d{2}-\d{2}$/.test(anchor) ? periodLabel(periodContaining(type, anchor)) : null;

  async function onSubmit(v: BudgetFormValues) {
    try {
      await create.mutateAsync({
        period_type: v.period_type,
        anchor: v.anchor,
        category_id: v.scope === 'category' ? v.category_id : null,
        amount: parseMoneyInput(v.amount) ?? 0,
      });
      toast.success('Đã thiết lập ngân sách.');
      onClose();
    } catch (e) {
      toast.error(toMutationMessage(e));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Field label="Loại ngân sách" htmlFor="bud-type" error={errors.period_type?.message}>
        <Select id="bud-type" {...register('period_type')}>
          {PERIOD_TYPES.map((t) => (
            <option key={t} value={t}>
              Ngân sách {PERIOD_TYPE_LABEL[t].toLowerCase()}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label={type === 'daily' ? 'Ngày áp dụng' : type === 'weekly' ? 'Chọn một ngày trong tuần' : 'Chọn một ngày trong tháng'}
        htmlFor="bud-anchor"
        error={errors.anchor?.message}
        hint={preview ? `Kỳ áp dụng: ${preview}` : undefined}
      >
        <Input id="bud-anchor" type="date" aria-invalid={Boolean(errors.anchor)} {...register('anchor')} />
      </Field>
      <Field label="Phạm vi" htmlFor="bud-scope">
        <Select id="bud-scope" {...register('scope')}>
          <option value="total">Tổng chi tiêu (mọi danh mục)</option>
          <option value="category">Một danh mục chi tiêu</option>
        </Select>
      </Field>
      {scope === 'category' && (
        <Field label="Danh mục chi tiêu" htmlFor="bud-cat" error={errors.category_id?.message}>
          <Select id="bud-cat" aria-invalid={Boolean(errors.category_id)} {...register('category_id')}>
            <option value="">Chọn danh mục</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Hạn mức" htmlFor="bud-amount" error={errors.amount?.message} hint="Nhập 0 nếu muốn đặt hạn mức bằng 0. Không nhập số âm.">
        <Input id="bud-amount" inputMode="decimal" placeholder="5.000.000" aria-invalid={Boolean(errors.amount)} {...register('amount')} />
      </Field>
      <FormActions onCancel={onClose} submitting={isSubmitting} submitLabel="Thiết lập" />
    </form>
  );
}

function EditAmountForm({ editing, categories, onClose }: { editing: BudgetEvaluation; categories: SsCategory[]; onClose: () => void }) {
  const toast = useToast();
  const { currency } = useSettings();
  const { updateAmount } = useBudgetMutations();
  const [pending, setPending] = useState<number | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BudgetAmountValues>({ resolver: zodResolver(budgetAmountSchema), defaultValues: { amount: toMoneyInput(editing.budget.amount) } });

  const b = editing.budget;
  const categoryName = b.category_id ? categories.find((c) => c.id === b.category_id)?.name ?? 'Danh mục' : 'Tổng chi tiêu';

  async function save(amount: number) {
    try {
      await updateAmount.mutateAsync({ id: b.id, amount });
      toast.success('Đã cập nhật hạn mức.');
      onClose();
    } catch (e) {
      toast.error(toMutationMessage(e));
    } finally {
      setPending(null);
    }
  }

  async function onSubmit(v: BudgetAmountValues) {
    const amount = parseMoneyInput(v.amount) ?? 0;
    // Thay đổi có ảnh hưởng lớn thì cần xác nhận trước khi lưu.
    if (isMajorChange(editing.amount, amount, editing.spent)) setPending(amount);
    else await save(amount);
  }

  return (
    <>
      <dl className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-canvas p-3 text-sm">
        <div>
          <dt className="text-xs text-slate-500">Kỳ</dt>
          <dd className="font-semibold text-navy">
            {PERIOD_TYPE_LABEL[b.period_type as PeriodType] ?? b.period_type} · {periodLabel({ type: b.period_type as PeriodType, start: b.period_start, endExclusive: b.period_end })}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Phạm vi</dt>
          <dd className="font-semibold text-navy">{categoryName}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-slate-500">Đã chi trong kỳ</dt>
          <dd className="font-semibold text-navy">{formatMoney(editing.spent, currency)}</dd>
        </div>
      </dl>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <Field label="Hạn mức" htmlFor="bud-edit-amount" error={errors.amount?.message}>
          <Input id="bud-edit-amount" inputMode="decimal" aria-invalid={Boolean(errors.amount)} {...register('amount')} />
        </Field>
        <FormActions onCancel={onClose} submitting={isSubmitting || updateAmount.isPending} submitLabel="Lưu thay đổi" />
      </form>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title="Xác nhận thay đổi hạn mức lớn?"
        description={
          pending === null
            ? ''
            : `Hạn mức sẽ đổi từ ${formatMoney(editing.amount, currency)} thành ${formatMoney(pending, currency)}.${
                pending < editing.spent ? ` Mức mới thấp hơn số đã chi (${formatMoney(editing.spent, currency)}), ngân sách sẽ ở trạng thái vượt hạn mức.` : ''
              }`
        }
        confirmLabel="Xác nhận"
        loading={updateAmount.isPending}
        onConfirm={() => pending !== null && void save(pending)}
      />
    </>
  );
}
