import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PRESET_LABEL, RANGE_PRESETS, type CustomRange, type DateRange, type RangePreset } from '@/reports/ranges';
import { formatDate, addDays } from '@/lib/dates';

interface Props {
  preset: RangePreset;
  onPreset: (p: RangePreset) => void;
  custom: CustomRange;
  onCustom: (c: CustomRange) => void;
  range: DateRange | null;
}

/** Bộ lọc khoảng thời gian dùng chung cho các báo cáo. Hiển thị rõ khoảng ngày đang áp dụng. */
export function RangeFilter({ preset, onPreset, custom, onCustom, range }: Props) {
  const invalid = preset === 'custom' && !range;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Select aria-label="Khoảng thời gian" className="w-auto min-w-[190px]" value={preset} onChange={(e) => onPreset(e.target.value as RangePreset)}>
          {RANGE_PRESETS.map((p) => (
            <option key={p} value={p}>
              {PRESET_LABEL[p]}
            </option>
          ))}
        </Select>
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <Input type="date" aria-label="Từ ngày" className="w-auto" value={custom.from} max={custom.to || undefined} onChange={(e) => onCustom({ ...custom, from: e.target.value })} />
            <span className="text-slate-400">–</span>
            <Input type="date" aria-label="Đến ngày" className="w-auto" value={custom.to} min={custom.from || undefined} onChange={(e) => onCustom({ ...custom, to: e.target.value })} />
          </div>
        )}
      </div>
      {range && (
        <p className="text-xs text-slate-500">
          Áp dụng: {formatDate(range.start)} – {formatDate(addDays(range.endExclusive, -1))}
        </p>
      )}
      {invalid && (
        <p role="alert" className="text-sm font-semibold text-danger">
          Hãy chọn khoảng ngày hợp lệ (ngày bắt đầu không sau ngày kết thúc).
        </p>
      )}
    </div>
  );
}
