import type { StockList } from '@erp/contracts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage, toApiError } from '@/lib/errors';
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
        <StockError error={stock.error} onRetry={() => stock.refetch()} />
      ) : stock.data.items.length === 0 ? (
        <p className="text-muted-foreground">ไม่พบสินค้าที่ตรงกับเงื่อนไข</p>
      ) : (
        <>
          <StockTable list={stock.data} />
          <Pager list={stock.data} onPage={(next) => show({ page: next })} />
        </>
      )}
    </div>
  );
}

function StockError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const apiError = toApiError(error);
  return (
    <div role="alert" className="space-y-2 text-sm text-destructive">
      <p>{errorMessage(apiError)}</p>
      {apiError.kind === 'retry' && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          ลองอีกครั้ง
        </Button>
      )}
    </div>
  );
}

function StockTable({ list }: { list: StockList }) {
  return (
    <table className="w-full text-sm">
      <thead className="border-b text-left text-muted-foreground">
        <tr>
          <th className="py-2 font-medium">SKU</th>
          <th className="py-2 font-medium">ชื่อสินค้า</th>
          <th className="py-2 font-medium">สาขา</th>
          <th className="py-2 text-right font-medium">คงเหลือ</th>
          <th className="py-2 pl-4 font-medium">หน่วย</th>
          <th className="py-2 text-right font-medium">จุดสั่งซื้อ</th>
          <th className="py-2 pl-4 font-medium">สถานะ</th>
        </tr>
      </thead>
      <tbody>
        {list.items.map((row) => (
          <tr key={`${row.product.id}-${row.store.id}`} className="border-b">
            <td className="py-2 font-mono">{row.product.sku}</td>
            <td className="py-2">{row.product.name}</td>
            <td className="py-2">{row.store.code}</td>
            <td className="py-2 text-right tabular-nums">{row.quantity}</td>
            <td className="py-2 pl-4">{row.product.unit}</td>
            <td className="py-2 text-right tabular-nums">{row.reorderThreshold}</td>
            <td className="py-2 pl-4">
              {row.lowStock ? (
                <Badge variant="destructive">ใกล้หมด</Badge>
              ) : (
                <span className="text-muted-foreground">ปกติ</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Pager({ list, onPage }: { list: StockList; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        ทั้งหมด {list.total} รายการ · หน้า {list.page} จาก {pages}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={list.page <= 1}
          onClick={() => onPage(list.page - 1)}
        >
          ก่อนหน้า
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={list.page >= pages}
          onClick={() => onPage(list.page + 1)}
        >
          ถัดไป
        </Button>
      </div>
    </div>
  );
}
