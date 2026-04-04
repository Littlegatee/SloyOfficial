import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export function isClosedConnectionError(error: any) {
  const message = String(error?.message || '');
  return (
    error?.code === 'P1017' ||
    message.includes('Server has closed the connection') ||
    message.includes('Engine is not yet connected')
  );
}

export async function withDbReconnectRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: any = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (!isClosedConnectionError(error)) throw error;
      await prisma.$disconnect().catch(() => undefined);
      await prisma.$connect();
      await new Promise((resolve) => setTimeout(resolve, 120 * (attempt + 1)));
    }
  }
  throw lastError;
}

export default prisma;
