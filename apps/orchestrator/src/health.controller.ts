import { Controller, Get, Res } from '@nestjs/common';
import { Response } from 'express';
import { Connection } from '@temporalio/client';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('/live')
  live() {
    return { status: 'ok' };
  }

  @Get('/version')
  version() {
    return {
      source_revision: process.env.SOURCE_REVISION || 'unknown',
      image_digest: process.env.IMAGE_DIGEST || 'unknown',
      image_version: process.env.IMAGE_VERSION || 'unknown',
      build_created: process.env.BUILD_CREATED || 'unknown',
    };
  }

  @Get('/status')
  status(@Res() res: Response) {
    return this.readiness(res);
  }

  @Get('/ready')
  ready(@Res() res: Response) {
    return this.readiness(res);
  }

  private async readiness(res: Response) {
    let connection: Connection | undefined;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const address = process.env.TEMPORAL_ADDRESS || 'localhost:7233';
      connection = await Connection.connect({
        address,
        ...(process.env.TEMPORAL_TLS === 'true' ? { tls: true } : {}),
        ...(process.env.TEMPORAL_API_KEY
          ? { apiKey: process.env.TEMPORAL_API_KEY }
          : {}),
      });

      const namespace = process.env.TEMPORAL_NAMESPACE || 'default';
      await Promise.race([
        connection.workflowService.describeNamespace({ namespace }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 10000)
        ),
      ]);
      const releaseIdentity = this.version();
      const releaseReady =
        process.env.NODE_ENV !== 'production' ||
        !Object.values(releaseIdentity).includes('unknown');
      return res.status(releaseReady ? 200 : 503).json({
        status: releaseReady ? 'ready' : 'not_ready',
        dependencies: { postgresql: true, temporal: true },
        release_identity: releaseReady,
      });
    } catch {
      return res.status(503).json({ status: 'not_ready' });
    } finally {
      await connection?.close().catch(() => {});
    }
  }
}
