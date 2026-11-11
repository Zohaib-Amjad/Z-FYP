import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from './Skeleton';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Hide the label on the stacked mobile card (use for the card's headline cell). */
  hideLabelOnCard?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  caption: string;
  loading?: boolean;
  empty?: ReactNode;
  className?: string;
}

const SKELETON_ROWS = 5;

/** Table from the md breakpoint up; stacked cards (label/value pairs) below it. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  caption,
  loading = false,
  empty,
  className,
}: DataTableProps<T>) {
  if (!loading && rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={className}>
      <div className="hidden overflow-x-auto rounded-card border border-ivory-300 bg-white shadow-soft md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-ivory-200/70 text-xs uppercase tracking-wider text-ink-600">
            <tr>
              {columns.map(column => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn('px-4 py-3 font-semibold', column.className)}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ivory-300">
            {loading
              ? Array.from({ length: SKELETON_ROWS }, (_, index) => (
                  <tr key={index}>
                    {columns.map(column => (
                      <td key={column.key} className="px-4 py-4">
                        <Skeleton className="h-4 w-full max-w-[10rem]" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map(row => (
                  <tr key={rowKey(row)} className="hover:bg-ivory-100/70">
                    {columns.map(column => (
                      <td
                        key={column.key}
                        className={cn('px-4 py-3.5 align-middle', column.className)}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden" aria-label={caption}>
        {loading
          ? Array.from({ length: 3 }, (_, index) => (
              <li key={index} className="rounded-card border border-ivory-300 bg-white p-4">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-1/2" />
              </li>
            ))
          : rows.map(row => (
              <li
                key={rowKey(row)}
                className="rounded-card border border-ivory-300 bg-white p-4 shadow-soft"
              >
                <dl className="space-y-2.5">
                  {columns.map(column => (
                    <div key={column.key} className="flex items-start justify-between gap-4">
                      {column.hideLabelOnCard ? null : (
                        <dt className="shrink-0 text-xs font-semibold uppercase tracking-wider text-ink-500">
                          {column.header}
                        </dt>
                      )}
                      <dd
                        className={cn(
                          'min-w-0 text-sm',
                          column.hideLabelOnCard ? 'w-full' : 'text-right',
                        )}
                      >
                        {column.cell(row)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
      </ul>
    </div>
  );
}
