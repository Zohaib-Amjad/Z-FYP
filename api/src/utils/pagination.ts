export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 10;

export interface PageParams {
  page: number;
  pageSize: number;
}

export interface Page<T> extends PageParams {
  items: T[];
  total: number;
  totalPages: number;
}

export const toSkipTake = ({ page, pageSize }: PageParams): { skip: number; take: number } => ({
  skip: (page - 1) * pageSize,
  take: pageSize,
});

export const buildPage = <T>(
  items: T[],
  total: number,
  { page, pageSize }: PageParams,
): Page<T> => ({
  items,
  page,
  pageSize,
  total,
  totalPages: Math.ceil(total / pageSize),
});
