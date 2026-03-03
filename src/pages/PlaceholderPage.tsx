import { AppLayout } from '@/components/AppLayout';
import { Construction } from 'lucide-react';

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Construction className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h1 className="text-2xl font-bold font-display mb-2">{title}</h1>
        <p className="text-muted-foreground">This section is coming soon.</p>
      </div>
    </AppLayout>
  );
}
