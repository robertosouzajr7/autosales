import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../../shared/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) throw new UnauthorizedException('Credenciais inválidas');

    const isMatch = await bcrypt.compare(pass, user.password);
    if (!isMatch) throw new UnauthorizedException('Credenciais inválidas');

    return {
      user: { id: user.id, name: user.name, role: user.role },
      tenant: user.tenant,
    };
  }

  async register(data: any) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const tenant = await this.prisma.tenant.create({
        data: {
            name: data.companyName,
            email: data.email,
        }
    });

    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        tenantId: tenant.id,
        role: 'OWNER',
      },
    });
  }
}
