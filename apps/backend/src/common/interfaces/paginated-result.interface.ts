export interface PaginatedResult<T> {
  data: T[];
  total: number;
  skip: number;
  take: number;
}
