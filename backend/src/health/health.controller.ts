import { Controller, Get } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  /** Liveness: the process answers. No dependencies, so a database outage doesn't restart pods. */
  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  /** Readiness: the database answers, so the pod can take traffic. */
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () =>
        this.prismaHealth.pingCheck('database', this.prisma).withTimeout(1500),
    ]);
  }
}
