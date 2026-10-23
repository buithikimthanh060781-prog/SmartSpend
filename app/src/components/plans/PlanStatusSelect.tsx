import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { usePlanMutations } from '@/hooks/usePlans';
import { PLAN_STATUSES, PLAN_STATUS_LABEL, type PlanStatus } from '@/lib/constants';
import { toMutationMessage } from '@/lib/errors';

/** Đổi trạng thái kế hoạch. Chặn hủy khi đã có giao dịch liên kết (database cũng có trigger chặn). */
export function PlanStatusSelect({ planId, status, linkedCount }: { planId: string; status: string; linkedCount: number }) {
  const toast = useToast();
  const { setStatus } = usePlanMutations();

  async function change(next: PlanStatus) {
    if (next === 'cancelled' && linkedCount > 0) {
      toast.error(`Không thể hủy: kế hoạch đã có ${linkedCount} giao dịch liên kết.`);
      return;
    }
    try {
      await setStatus.mutateAsync({ id: planId, status: next });
      toast.success(`Đã chuyển sang "${PLAN_STATUS_LABEL[next]}".`);
    } catch (e) {
      toast.error(toMutationMessage(e));
    }
  }

  return (
    <Select
      aria-label="Trạng thái kế hoạch"
      className="h-9 w-auto min-w-[150px] text-xs"
      value={status}
      disabled={setStatus.isPending}
      onChange={(e) => void change(e.target.value as PlanStatus)}
    >
      {PLAN_STATUSES.map((s) => (
        <option key={s} value={s}>
          {PLAN_STATUS_LABEL[s]}
        </option>
      ))}
    </Select>
  );
}
