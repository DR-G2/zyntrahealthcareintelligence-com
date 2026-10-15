import mark from '@/assets/zyntra-mark.png.asset.json';
import { cn } from '@/lib/utils';

/** The single Zyntra Z mark used across the site. */
export function BrandMark({ className }: { className?: string }) {
  return <img src={mark.url} alt="" aria-hidden="true" width={256} height={256} className={cn('h-8 w-8 shrink-0 object-contain', className)} />;
}
