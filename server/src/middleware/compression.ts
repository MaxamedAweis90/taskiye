import { Request, Response, NextFunction } from 'express';
import zlib from 'node:zlib';

export function responseCompression(minByteLength: number = 1024) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const acceptEncoding = req.headers['accept-encoding'] || '';

    if (typeof acceptEncoding !== 'string' || !acceptEncoding.includes('gzip')) {
      return next();
    }

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = (body: unknown): Response => {
      try {
        const jsonString = JSON.stringify(body);
        const byteLength = Buffer.byteLength(jsonString, 'utf8');

        if (byteLength < minByteLength) {
          return originalSend(jsonString);
        }

        const gzipped = zlib.gzipSync(Buffer.from(jsonString, 'utf8'));
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('Content-Length', String(gzipped.length));

        return originalSend(gzipped);
      } catch {
        return originalJson(body);
      }
    };

    return next();
  };
}
