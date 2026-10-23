import { Pencil, Plus, Power, Tags, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { assignDisplayColors } from '@/lib/colors';
import { CategoryIcon } from '@/components/common/CategoryIcon';
import { PageHeader } from '@/components/common/PageHeader';
import { CategoryFormDialog } from '@/components/categories/CategoryFormDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';
import { findInvalidTypeCategories, useCategories, useCategoryMutations } from '@/hooks/useCategories';
import { CATEGORY_TYPES, CATEGORY_TYPE_LABEL, type CategoryType } from '@/lib/constants';
import { toMutationMessage, toUserMessage } from '@/lib/errors';
import type { SsCategory } from '@/types/db';

export function CategoriesPage() {
  const { categories, isLoading, error, refetch } = useCategories();
  const { setActive, remove } = useCategoryMutations();
  // Danh mục chưa có màu được gán sẵn màu tươi, khác nhau (chỉ hiển thị; lưu khi người dùng bấm Lưu ở form sửa).
  const colors = useMemo(() => assignDisplayColors(categories), [categories]);
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SsCategory | null>(null);
  const [formType, setFormType] = useState<CategoryType>('expense');
  const [deleting, setDeleting] = useState<SsCategory | null>(null);

  function openCreate(type: CategoryType) {
    setEditing(null);
    setFormType(type);
    setFormOpen(true);
  }

  async function toggle(c: SsCategory) {
    try {
      await setActive.mutateAsync({ id: c.id, isActive: !c.is_active });
      toast.success(c.is_active ? `Đã tắt "${c.name}". Lịch sử giao dịch vẫn được giữ.` : `Đã bật "${c.name}".`);
    } catch (e) {
      toast.error(toMutationMessage(e));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success('Đã xóa danh mục.');
    } catch (e) {
      toast.error(toMutationMessage(e));
    } finally {
      setDeleting(null);
    }
  }

  // BẤT KỲ danh mục nào có `type` ngoài CATEGORY_TYPES đều được báo rõ (không chỉ khi tất cả đều sai).
  const invalidTypeCategories = findInvalidTypeCategories(categories);

  return (
    <div className="space-y-6">
      <PageHeader title="Danh mục" subtitle="Quản lý danh mục thu nhập và chi tiêu. Danh mục đã tắt vẫn hiển thị trong lịch sử." />

      {isLoading && <LoadingSkeleton />}
      {error && !isLoading && <ErrorState message={toUserMessage(error)} onRetry={() => void refetch()} />}
      {invalidTypeCategories.length > 0 && (
        <ErrorState
          title="Có danh mục với loại không hợp lệ"
          message={`${invalidTypeCategories.length} danh mục có type ngoài 'income'/'expense' (${[...new Set(invalidTypeCategories.map((c) => c.type))].join(', ')}): ${invalidTypeCategories.map((c) => c.name).join(', ')}. Các danh mục này không được hiển thị bên dưới. Cần xác minh CHECK constraint của ss_categories.type rồi sửa dữ liệu hoặc CATEGORY_TYPES.`}
        />
      )}

      {!isLoading && !error &&
        CATEGORY_TYPES.map((type) => {
          const list = categories.filter((c) => c.type === type);
          return (
            <Card key={type}>
              <CardHeader>
                <CardTitle>
                  {CATEGORY_TYPE_LABEL[type]} <span className="text-sm font-medium text-slate-500">({list.length})</span>
                </CardTitle>
                <Button size="sm" variant="accent" onClick={() => openCreate(type)}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Thêm
                </Button>
              </CardHeader>
              {list.length === 0 ? (
                <EmptyState icon={Tags} title="Chưa có danh mục" description="Thêm danh mục đầu tiên cho loại này." />
              ) : (
                <ul className="divide-y divide-slate-100 px-5 py-2">
                  {list.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 py-3">
                      <CategoryIcon icon={c.icon} color={colors.get(c.id) ?? c.color} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${c.is_active ? 'text-navy' : 'text-slate-400'}`}>{c.name}</p>
                        <div className="mt-0.5 flex gap-1.5">
                          {c.is_default && <Badge tone="navy">Mặc định</Badge>}
                          {!c.is_active && <Badge>Đã tắt</Badge>}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => void toggle(c)} aria-label={c.is_active ? `Tắt ${c.name}` : `Bật ${c.name}`} title={c.is_active ? 'Tắt' : 'Bật'}>
                        <Power className={`h-4 w-4 ${c.is_active ? 'text-success' : 'text-slate-400'}`} aria-hidden />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setFormType(type); setFormOpen(true); }} aria-label={`Sửa ${c.name}`}>
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Button>
                      {!c.is_default && (
                        <Button variant="ghost" size="icon" onClick={() => setDeleting(c)} aria-label={`Xóa ${c.name}`}>
                          <Trash2 className="h-4 w-4 text-danger" aria-hidden />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}

      <CategoryFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} defaultType={formType} all={categories} colors={colors} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa danh mục?"
        description={`Chỉ xóa được khi chưa có giao dịch nào dùng "${deleting?.name ?? ''}". Nếu đã có giao dịch, hãy tắt danh mục để giữ lịch sử.`}
        confirmLabel="Xóa"
        loading={remove.isPending}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
