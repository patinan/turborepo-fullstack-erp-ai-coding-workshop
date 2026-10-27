import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Pager } from '@/components/pager';
import { QueryError } from '@/components/query-error';
import { StockTable } from '@/components/stock-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { orpc } from '@/lib/orpc';

/**
 * Stock on hand and low stock (INV-01, RPT-02). The search, the low-stock filter and the page live
 * in the URL, so back and reload keep them. A store employee only ever gets their own store.
 */
export function StockPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const lowOnly = params.get('lowOnly') === 'true';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [search, setSearch] = useState(q);

  const stock = useQuery(
    orpc.stock.list.queryOptions({ input: { q: q || undefined, lowOnly, page } }),
  );

  /** Change the filters. Any change but the page starts again at page 1. */
  function show(next: { q?: string; lowOnly?: boolean; page?: number }) {
    const values = { q, lowOnly, page: 1, ...next };
    setParams({
      ...(values.q && { q: values.q }),
      ...(values.lowOnly && { lowOnly: 'true' }),
      ...(values.page > 1 && { page: String(values.page) }),
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">สต็อกสินค้า</h1>

      <form
        className="flex flex-wrap items-end gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          show({ q: search.trim() });
        }}
      >
        <div className="w-72 space-y-2">
          <Label htmlFor="stock-search">ค้นหาสินค้า</Label>
          <Input
            id="stock-search"
            type="search"
            placeholder="SKU หรือชื่อสินค้า"
            autoFocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex h-9 items-center gap-2">
          <input
            id="stock-low-only"
            type="checkbox"
            className="size-4"
            checked={lowOnly}
            onChange={(event) => show({ q: search.trim(), lowOnly: event.target.checked })}
          />
          <Label htmlFor="stock-low-only">เฉพาะสินค้าใกล้หมด</Label>
        </div>
        <Button type="submit">ค้นหา</Button>
      </form>

      {stock.isPending ? (
        <p role="status" className="text-muted-foreground">
          กำลังโหลด…
        </p>
      ) : stock.isError ? (
        <QueryError error={stock.error} onRetry={() => stock.refetch()} />
      ) : stock.data.items.length === 0 ? (
        <p className="text-muted-foreground">ไม่พบสินค้าที่ตรงกับเงื่อนไข</p>
      ) : (
        <>
          <StockTable rows={stock.data.items} />
          <Pager {...stock.data} onPage={(next) => show({ page: next })} />
        </>
      )}
    </div>
  );
}
