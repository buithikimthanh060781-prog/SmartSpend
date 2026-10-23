import { Info, Lightbulb, TriangleAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Insight } from '@/reports/insights';

/**
 * Nhận xét tự động dựa trên QUY TẮC tính toán (rule-based), không phải AI dự đoán và không phải lời khuyên tài chính.
 * Mỗi nhận xét có số liệu chứng minh; chỉ xuất hiện khi có đủ dữ liệu.
 */
export function InsightsCard({ insights }: { insights: Insight[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-accent-600" aria-hidden />
          Nhận xét từ số liệu của bạn
        </CardTitle>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa đủ dữ liệu để đưa ra nhận xét. Hãy ghi thêm giao dịch trong tháng này (cần ít nhất 3 giao dịch chi tiêu).</p>
        ) : (
          <ul className="space-y-3">
            {insights.map((i) => {
              const Icon = i.tone === 'attention' ? TriangleAlert : Info;
              return (
                <li key={i.id} className="flex items-start gap-3">
                  <span className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg', i.tone === 'attention' ? 'bg-accent/15 text-accent-600' : 'bg-navy-50 text-navy')}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy">{i.text}</p>
                    <p className="text-xs text-slate-500">{i.evidence}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-xs text-slate-400">Nhận xét được tạo theo quy tắc cố định từ dữ liệu của bạn, không phải dự đoán bằng AI và không phải lời khuyên tài chính.</p>
      </CardContent>
    </Card>
  );
}
