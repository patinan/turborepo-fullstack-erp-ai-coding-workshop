import { Controller } from '@nestjs/common';
import { contract } from '@erp/contracts';
import { Implement, implement } from '@orpc/nest';
import { Public } from '../auth/auth.decorators.js';
import { Clock } from '../clock/clock.js';
import { PrismaService } from '../database/prisma.service.js';

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  // Route, method, input and output all come from the shared contract.
  @Public()
  @Implement(contract.health.check)
  check() {
    return implement(contract.health.check).handler(async () => {
      const database = await this.prisma.$queryRaw`SELECT 1`.then(
        () => 'ok' as const,
        () => 'error' as const,
      );

      return { api: 'ok' as const, database, timestamp: this.clock.now().toISOString() };
    });
  }
}
