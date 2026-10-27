import type { Role } from '@erp/contracts';
import { NavLink } from 'react-router';
import { useCurrentUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

/**
 * The screens each role may use. Hiding the rest makes the app easier to use; the API still
 * enforces every permission (spec §4.4).
 */
const NAV_ITEMS: { to: string; label: string; roles: Role[] }[] = [
  { to: '/', label: 'หน้าแรก', roles: ['ADMIN', 'PURCHASING', 'STORE_STAFF', 'MANAGER'] },
  // Purchasing officers read every store's stock [C-01]; administrators have no stock access [C-17].
  { to: '/stock', label: 'สต็อกสินค้า', roles: ['PURCHASING', 'STORE_STAFF', 'MANAGER'] },
];

export function MainNav() {
  const user = useCurrentUser();
  if (!user) return null;

  return (
    <nav aria-label="เมนูหลัก" className="flex items-center gap-4 text-sm font-normal">
      {NAV_ITEMS.filter((item) => item.roles.includes(user.role)).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end
          className={({ isActive }) =>
            cn('text-muted-foreground hover:text-foreground', isActive && 'text-foreground')
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
