import { describe, expect, it } from 'vitest';
import { StockListInputSchema, StockListSchema } from './stock.js';

describe('StockListInputSchema', () => {
  it('pages 20 rows at a time from page 1 by default, with no filters', () => {
    expect(StockListInputSchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      lowOnly: false,
      includeInactive: false,
    });
  });

  it('accepts a page size of up to 100', () => {
    expect(StockListInputSchema.safeParse({ pageSize: 100 }).success).toBe(true);
  });

  it('refuses a page size over 100', () => {
    const result = StockListInputSchema.safeParse({ pageSize: 101 });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([['pageSize']]);
  });

  it('refuses page 0 and fractional pages', () => {
    expect(StockListInputSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(StockListInputSchema.safeParse({ page: 1.5 }).success).toBe(false);
  });

  it('trims the search and drops a blank one', () => {
    expect(StockListInputSchema.parse({ q: '  SKU00 ' }).q).toBe('SKU00');
    expect(StockListInputSchema.parse({ q: '   ' }).q).toBeUndefined();
  });
});

describe('StockListSchema', () => {
  const row = {
    product: { id: 'p3', sku: 'SKU003', name: 'Laundry detergent', unit: 'bag', active: true },
    store: { id: 's1', code: 'B01', name: 'Central Store' },
    quantity: 0,
    reorderThreshold: 3,
    lowStock: true,
  };

  it('accepts a page of stock rows with its total', () => {
    const page = { items: [row], total: 1, page: 1, pageSize: 20 };

    expect(StockListSchema.parse(page)).toEqual(page);
  });

  it('refuses a negative quantity', () => {
    const page = { items: [{ ...row, quantity: -1 }], total: 1, page: 1, pageSize: 20 };

    expect(StockListSchema.safeParse(page).success).toBe(false);
  });

  it('refuses a page without a total', () => {
    expect(StockListSchema.safeParse({ items: [], page: 1, pageSize: 20 }).success).toBe(false);
  });
});
