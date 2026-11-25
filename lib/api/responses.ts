import { NextResponse } from 'next/server';

export function jsonError(status: number, error: string) {
  return NextResponse.json({ ok: false, error }, { status });
}
