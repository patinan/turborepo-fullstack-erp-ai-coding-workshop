import type { StockRow } from '@erp/contracts';
import { Badge } from '@/components/ui/badge';

/** Stock on hand per product and store, with low stock flagged (INV-01, RPT-02). */
export function StockTable({ rows }: { rows: StockRow[] }) {
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
        {rows.map((row) => (
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
