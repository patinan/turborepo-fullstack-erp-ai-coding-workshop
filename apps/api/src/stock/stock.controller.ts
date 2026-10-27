import { Controller } from '@nestjs/common';
import { contract, type User } from '@erp/contracts';
import type { Prisma } from '@erp/database';
import { Implement, implement } from '@orpc/nest';
import { CurrentUser, Roles, StoreScope } from '../auth/auth.decorators.js';
import { PrismaService } from '../database/prisma.service.js';

@Controller()
export class StockController {
  constructor(private readonly prisma: PrismaService) {}

  // Purchasing officers read every store [C-01]; administrators have no stock access [C-17].
  @Roles('PURCHASING', 'STORE_STAFF', 'MANAGER')
  @StoreScope('storeId')
  @Implement(contract.stock.list)
  list(@CurrentUser() user: User) {
    return implement(contract.stock.list).handler(async ({ input }) => {
      const { q, lowOnly, includeInactive, page, pageSize } = input;
      const where: Prisma.StockBalanceWhereInput = {
        // A store employee only ever sees their assigned store; the guard refused any other.
        storeId: user.store?.id ?? input.storeId,
        product: {
          ...(includeInactive ? {} : { active: true }),
          ...(q && {
            OR: [
              { sku: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }),
        },
        // Low stock: at or below the threshold (RPT-02).
        ...(lowOnly && { quantity: { lte: this.prisma.stockBalance.fields.reorderThreshold } }),
      };

      const [balances, total] = await this.prisma.$transaction([
        this.prisma.stockBalance.findMany({
          where,
          select: {
            quantity: true,
            reorderThreshold: true,
            product: { select: { id: true, sku: true, name: true, unit: true, active: true } },
            store: { select: { id: true, code: true, name: true } },
          },
          // By SKU, as the stock list has no "newest" [C-03].
          orderBy: [{ product: { sku: 'asc' } }, { store: { code: 'asc' } }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.stockBalance.count({ where }),
      ]);

      return {
        items: balances.map((balance) => ({
          ...balance,
          lowStock: balance.quantity <= balance.reorderThreshold,
        })),
        total,
        page,
        pageSize,
      };
    });
  }
}
