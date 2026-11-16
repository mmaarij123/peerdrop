import type { FastifyReply } from 'fastify';

export function httpError(reply: FastifyReply, status: number, error: string, retryAfter?: number) {
  if (retryAfter !== undefined) reply.header('Retry-After', String(retryAfter));
  return reply.code(status).send({ error });
}
