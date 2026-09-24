import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RequestContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request & { id?: string }, _res: Response, next: NextFunction) {
    RequestContext.run(
      {
        requestId: typeof req.id === 'string' ? req.id : undefined,
        ip: req.ip,
        userAgent: req.get('user-agent')?.slice(0, 300),
      },
      next,
    );
  }
}
