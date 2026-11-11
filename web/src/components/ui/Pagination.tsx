import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { pageWindow } from '@/lib/pagination';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const BUTTON =
  'inline-flex h-11 min-w-[2.75rem] items-center justify-center rounded-control px-3 text-sm font-medium transition-colors';

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex flex-wrap items-center justify-center gap-1.5', className)}
    >
      <button
        type="button"
        className={cn(BUTTON, 'border border-ink-300 hover:bg-ink-50 disabled:opacity-40')}
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      {pageWindow(page, totalPages).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-ink-400">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-label={`Page ${item}`}
            aria-current={item === page ? 'page' : undefined}
            className={cn(
              BUTTON,
              item === page
                ? 'bg-ink-900 text-ivory-100'
                : 'border border-transparent text-ink-700 hover:bg-ink-100',
            )}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        className={cn(BUTTON, 'border border-ink-300 hover:bg-ink-50 disabled:opacity-40')}
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
