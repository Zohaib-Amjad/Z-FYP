import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import type { Kpi } from '@/lib/adminBookings';

export function KpiGrid({ kpis }: { kpis: Kpi[] | null }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key figures">
      {kpis
        ? kpis.map(kpi => (
            <li key={kpi.id}>
              <Link
                href={kpi.href}
                className="group block rounded-card"
                aria-label={`${kpi.label}: ${kpi.value}. View details`}
              >
                <Card
                  interactive
                  className={cn(
                    'h-full p-5',
                    kpi.highlight && 'border-gold-500 bg-gold-200/30 ring-1 ring-gold-400',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-ink-600">{kpi.label}</p>
                    <ArrowUpRight
                      className="h-4 w-4 text-ink-400 transition-colors group-hover:text-gold-700"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="mt-3 font-display text-5xl font-semibold leading-none">
                    {kpi.value}
                  </p>
                  <p className="mt-2 text-xs text-ink-500">{kpi.hint}</p>
                </Card>
              </Link>
            </li>
          ))
        : Array.from({ length: 8 }, (_, index) => (
            <li key={index}>
              <Skeleton className="h-32 w-full" />
            </li>
          ))}
    </ul>
  );
}
