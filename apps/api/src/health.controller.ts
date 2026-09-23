import { Controller, Get, Header, HttpStatus, Res, VERSION_NEUTRAL } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators';
import { PrismaService } from './common/prisma/prisma.service';
import { QueueService } from './core/queue/queue.service';

const startedAt = Date.now();

@ApiTags('salud')
@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Estado de la API y sus dependencias' })
  async health(@Res({ passthrough: true }) res: Response) {
    let database = 'down';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = 'up';
    } catch {
      database = 'down';
    }
    // Orchestrators and the Docker HEALTHCHECK only look at the status code.
    if (database !== 'up') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: database === 'up' ? 'ok' : 'degraded',
      uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
      version: process.env.npm_package_version ?? '1.0.0',
      dependencies: {
        database,
        queue: this.queue.usesRedis ? 'redis' : 'inline',
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4')
  @ApiOperation({ summary: 'Metricas basicas en formato Prometheus' })
  async metrics(): Promise<string> {
    const memory = process.memoryUsage();
    const [companies, users, employees] = await Promise.all([
      this.prisma.company.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.employee.count({ where: { deletedAt: null, status: 'active' } }),
    ]);
    return [
      '# HELP talento_uptime_seconds Tiempo de ejecucion del proceso',
      '# TYPE talento_uptime_seconds gauge',
      `talento_uptime_seconds ${Math.round((Date.now() - startedAt) / 1000)}`,
      '# HELP talento_memory_heap_bytes Memoria heap usada',
      '# TYPE talento_memory_heap_bytes gauge',
      `talento_memory_heap_bytes ${memory.heapUsed}`,
      '# HELP talento_companies_total Empresas activas',
      '# TYPE talento_companies_total gauge',
      `talento_companies_total ${companies}`,
      '# HELP talento_users_total Usuarios registrados',
      '# TYPE talento_users_total gauge',
      `talento_users_total ${users}`,
      '# HELP talento_employees_active_total Colaboradores activos',
      '# TYPE talento_employees_active_total gauge',
      `talento_employees_active_total ${employees}`,
      '',
    ].join('\n');
  }
}
