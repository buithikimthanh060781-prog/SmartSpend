import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { CATEGORY_ICONS } from '@/components/common/CategoryIcon';
import { Field } from '@/components/common/Field';
import { FormActions, FormDialog } from '@/components/common/FormDialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { CATEGORY_PALETTE, normalizeHex, randomUnusedColor } from '@/lib/colors';
import { CATEGORY_TYPES, CATEGORY_TYPE_LABEL, type CategoryType } from '@/lib/constants';
import { toMutationMessage } from '@/lib/errors';
import { findDuplicateCategory, useCategoryMutations } from '@/hooks/useCategories';
import { categorySchema, type CategoryFormValues } from '@/schemas/category';
import type { SsCategory } from '@/types/db';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SsCategory | null;
  defaultType: CategoryType;
  all: SsCategory[];
  /** Màu hiển thị hiện tại của từng danh mục (màu đã lưu hoặc màu gán sẵn). */
  colors: Map<string, string>;
}

export function CategoryFormDialog({ open, onOpenChange, editing, defaultType, all, colors }: Props) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'Sửa danh mục' : 'Thêm danh mục'}
      description={editing ? 'Có thể đổi tên, màu và icon. Loại danh mục không thể thay đổi.' : 'Danh mục cá nhân của bạn.'}
    >
      <CategoryForm editing={editing} defaultType={defaultType} all={all} colors={colors} onClose={() => onOpenChange(false)} />
    </FormDialog>
  );
}

export function CategoryForm({ editing, defaultType, all, colors, onClose }: Omit<Props, 'open' | 'onOpenChange'> & { onClose: () => void }) {
  const toast = useToast();
  const { create, update } = useCategoryMutations();
  // Sửa: hiện đúng màu đang đặt. Tạo mới: chọn sẵn một màu tươi chưa dùng.
  const [initialColor] = useState(() => (editing ? colors.get(editing.id) : undefined) ?? randomUnusedColor(colors.values()));
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: editing?.name ?? '',
      type: (editing?.type as CategoryType | undefined) ?? defaultType,
      icon: editing?.icon ?? 'tag',
      color: initialColor,
    },
  });
  const colorValue = watch('color');
  const [formError, setFormError] = useState<string | null>(null);
  const pickColor = (hex: string) => setValue('color', hex.toUpperCase(), { shouldValidate: true, shouldDirty: true });

  const currentIcon = editing?.icon;
  const unknownIcon = currentIcon && !CATEGORY_ICONS[currentIcon] ? currentIcon : null;

  async function onSubmit(values: CategoryFormValues) {
    setFormError(null);
    const dup = findDuplicateCategory(all, values.type, values.name, editing?.id);
    if (dup) {
      setError('name', {
        message: dup.is_active
          ? 'Đã có danh mục cùng tên và cùng loại.'
          : 'Đã có danh mục cùng tên (đang tắt). Hãy bật lại danh mục đó thay vì tạo mới.',
      });
      return;
    }
    const base = { name: values.name.trim(), icon: values.icon || null, color: normalizeHex(values.color) };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, input: base });
      else await create.mutateAsync({ ...base, type: values.type });
      toast.success(editing ? 'Đã cập nhật danh mục.' : 'Đã thêm danh mục.');
      onClose();
    } catch (e) {
      // Trùng tên được phát hiện trên dữ liệu mới nhất ở server (có thể do thiết bị/tab khác vừa tạo).
      if (e instanceof Error && e.name === 'DuplicateCategoryError') setError('name', { message: e.message });
      else {
        const message = toMutationMessage(e);
        setFormError(message);
        toast.error(message);
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <Field label="Tên danh mục" htmlFor="cat-name" error={errors.name?.message}>
        <Input id="cat-name" maxLength={50} aria-invalid={Boolean(errors.name)} {...register('name')} />
      </Field>
      <Field label="Loại" htmlFor="cat-type" error={errors.type?.message}>
        {editing ? (
          <>
            {/* Ô bị vô hiệu hóa sẽ trả về undefined trong React Hook Form và làm form không bao giờ hợp lệ,
                nên giá trị thật nằm ở ô ẩn được đăng ký; ô hiển thị bên dưới chỉ để đọc. */}
            <input type="hidden" {...register('type')} />
            <Select id="cat-type" disabled value={editing.type} onChange={() => undefined}>
              {CATEGORY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CATEGORY_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </>
        ) : (
          <Select id="cat-type" {...register('type')}>
            {CATEGORY_TYPES.map((t) => (
              <option key={t} value={t}>
                {CATEGORY_TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Icon" htmlFor="cat-icon">
        <Select id="cat-icon" {...register('icon')}>
          {unknownIcon && <option value={unknownIcon}>{unknownIcon}</option>}
          {Object.entries(CATEGORY_ICONS).map(([key, v]) => (
            <option key={key} value={key}>
              {v.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Màu" htmlFor="cat-color-hex" error={errors.color?.message}>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Chọn màu"
            className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-slate-300 bg-white p-1"
            value={normalizeHex(colorValue) ?? '#142B49'}
            onChange={(e) => pickColor(e.target.value)}
          />
          <Input id="cat-color-hex" maxLength={7} placeholder="#F58B2B" className="font-mono uppercase" aria-invalid={Boolean(errors.color)} {...register('color')} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Màu gợi ý">
          {CATEGORY_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={`Chọn màu ${c}`}
              aria-pressed={normalizeHex(colorValue) === c}
              onClick={() => pickColor(c)}
              className={`h-7 w-7 rounded-full border-2 ${normalizeHex(colorValue) === c ? 'border-navy' : 'border-white shadow-card'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </Field>
      <FormActions onCancel={onClose} submitting={isSubmitting} error={formError} submitLabel={editing ? 'Lưu thay đổi' : 'Thêm danh mục'} />
    </form>
  );
}
