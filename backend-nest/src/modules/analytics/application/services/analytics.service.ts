import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { TenantContext } from '../../../../shared/tenant/tenant.context';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async getDashboardStats() {
    const tenantId = this.tenantContext.getTenantId();
    const [leads, messages, appointments] = await Promise.all([
      this.prisma.lead.count({ where: { tenantId } }),
      this.prisma.message.count({ where: { tenantId } }),
      this.prisma.appointment.count({ where: { tenantId } }),
    ]);

    return { leads, messages, appointments };
  }
}
