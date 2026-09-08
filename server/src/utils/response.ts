import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export function sendSuccess<T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode = 200
): Response {
  return res.status(statusCode).json({
    success: true,
    ...(data !== undefined && { data }),
    ...(message && { message }),
  });
}

export function sendError(
  res: Response,
  message = 'An unexpected error occurred',
  statusCode = 500,
  error?: unknown
): Response {
  const errorDetails =
    error instanceof Error ? error.message : typeof error === 'string' ? error : undefined;

  return res.status(statusCode).json({
    success: false,
    message,
    ...(errorDetails && { error: errorDetails }),
  });
}
