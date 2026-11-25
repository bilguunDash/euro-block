import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function withQueryParam(url: string, key: string, value: string) {
  if (!url) return url;
  const hasQ = url.includes('?');
  const parts = url.split('#');
  const base = parts[0];
  const hash = parts.length > 1 ? `#${parts.slice(1).join('#')}` : '';
  if (new RegExp(`([?&])${key}=`).test(base)) return url;
  const joiner = hasQ ? '&' : '?';
  return `${base}${joiner}${encodeURIComponent(key)}=${encodeURIComponent(value)}${hash}`;
}

function makePrisma() {
  // In serverless, a single PrismaClient per runtime helps avoid exhausting DB connections.
  // Also set a conservative per-client connection limit when using a pooler.
  let cs = process.env.DATABASE_URL!;
  cs = withQueryParam(cs, 'connection_limit', '1');
  const adapter = new PrismaPg({ connectionString: cs });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? makePrisma();

// Cache across module reloads and warm invocations.
globalForPrisma.prisma = prisma;
