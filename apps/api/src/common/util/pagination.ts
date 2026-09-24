import type { Paginated, PaginationQuery } from '@meca/shared';

export const skipTake = (q: Pick<PaginationQuery, 'page' | 'pageSize'>) => ({
  skip: (q.page - 1) * q.pageSize,
  take: q.pageSize,
});

export const paginated = <T>(items: T[], total: number, q: Pick<PaginationQuery, 'page' | 'pageSize'>): Paginated<T> => ({
  items,
  total,
  page: q.page,
  pageSize: q.pageSize,
});
