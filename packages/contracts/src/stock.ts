import { oc } from '@orpc/contract';
import * as z from 'zod';
import { StoreRefSchema } from './auth.js';
import { pageSchema, PageInputSchema } from './lists.js';

export const StockListInputSchema = PageInputSchema.extend({
  /** A substring of the SKU or product name, ignoring case. Blank means no search. */
  q: z
    .string()
    .trim()
    .optional()
    .transform((q) => q || undefined),
  /** Only this store. A store employee may only ask for their own; without it they get it anyway. */
  storeId: z.string().min(1).optional(),
  /** Only rows whose quantity is at or below the reorder threshold (RPT-02). */
  lowOnly: z.boolean().default(false),
  /** Include inactive products, which are hidden by default (RPT-02.2). */
  includeInactive: z.boolean().default(false),
});
export type StockListInput = z.input<typeof StockListInputSchema>;

/** One product's stock balance in one store. */
export const StockRowSchema = z.object({
  product: z.object({
    id: z.string(),
    sku: z.string(),
    name: z.string(),
    unit: z.string(),
    active: z.boolean(),
  }),
  store: StoreRefSchema,
  quantity: z.number().int().min(0),
  reorderThreshold: z.number().int().min(0),
  /** `quantity` ≤ `reorderThreshold`. */
  lowStock: z.boolean(),
});
export type StockRow = z.infer<typeof StockRowSchema>;

export const StockListSchema = pageSchema(StockRowSchema);
export type StockList = z.infer<typeof StockListSchema>;

export const stockContract = {
  list: oc
    .route({
      method: 'GET',
      path: '/stock',
      summary: 'Stock on hand and low stock, ordered by SKU then store',
      tags: ['Stock'],
    })
    .input(StockListInputSchema)
    .output(StockListSchema),
};
