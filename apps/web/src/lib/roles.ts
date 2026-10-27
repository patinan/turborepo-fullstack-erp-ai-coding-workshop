import type { Role } from '@erp/contracts';

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'ผู้ดูแลระบบ',
  PURCHASING: 'ฝ่ายจัดซื้อ',
  STORE_STAFF: 'พนักงานสาขา',
  MANAGER: 'ผู้จัดการ',
};
