import { Construction } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/EmptyState';

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-navy">{title}</h1>
      <Card>
        <EmptyState
          icon={Construction}
          title="Chức năng đang được phát triển"
          description={`Trang "${title}" sẽ được triển khai ở các sprint tiếp theo. Hiện chưa có dữ liệu hay thao tác nào ở trang này.`}
        />
      </Card>
    </div>
  );
}
