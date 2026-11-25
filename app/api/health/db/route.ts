import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      postgresql: { connected: true },
    });
  } catch (e) {
    console.error('Health check failed', e);
    return NextResponse.json({
      ok: false,
      postgresql: { connected: false },
    }, { status: 500 });
  }
}
