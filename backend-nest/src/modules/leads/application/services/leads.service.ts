import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import { TenantContext } from '../../../../shared/tenant/tenant.context';

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async findAll() {
    return this.prisma.lead.findMany({
      where: { tenantId: this.tenantContext.getTenantId() },
      include: { stage: true, tags: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.lead.findFirst({
      where: {
        id,
        tenantId: this.tenantContext.getTenantId(),
      },
      include: { stage: true, tags: true, conversations: true },
    });
  }

  async create(data: any) {
    const leadData = data as any;
    return this.prisma.lead.create({
      data: {
        ...leadData,
        tenantId: this.tenantContext.getTenantId(),
      },
    });
  }

  async update(id: string, data: any) {
    const leadData = data as any;
    return this.prisma.lead.update({
      where: {
        id,
        tenantId: this.tenantContext.getTenantId(),
      },
      data: leadData,
    });
  }

  async delete(id: string) {
    return this.prisma.lead.delete({
      where: {
        id,
        tenantId: this.tenantContext.getTenantId(),
      },
    });
  }
}
