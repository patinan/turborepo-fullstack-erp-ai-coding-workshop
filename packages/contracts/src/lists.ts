import * as z from 'zod';

/** Offset paging for every list: 20 rows by default, at most 100 (UI-02.1). */
export const PageInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type PageInput = z.infer<typeof PageInputSchema>;

/** One page of a list, with the total number of matching rows. */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
  });
}
