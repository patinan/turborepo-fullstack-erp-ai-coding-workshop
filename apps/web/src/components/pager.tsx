import { Button } from '@/components/ui/button';

/** The total, the current page and previous/next buttons for a paged list (UI-02). */
export function Pager({
  total,
  page,
  pageSize,
  onPage,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        ทั้งหมด {total} รายการ · หน้า {page} จาก {pages}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ก่อนหน้า
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          ถัดไป
        </Button>
      </div>
    </div>
  );
}
