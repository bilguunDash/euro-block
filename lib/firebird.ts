import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Firebird = require('node-firebird');

export type FirebirdOptions = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  lowercase_keys: boolean;
};

/** Орчны хувьсагч дутуу үед шиддэг алдаа — route-д 503 болгож хувиргана. */
export class FirebirdConfigError extends Error {
  constructor(public readonly missing: readonly string[]) {
    super(`Firebird тохиргоо дутуу: ${missing.join(', ')} орчны хувьсагч заавал шаардлагатай.`);
    this.name = 'FirebirdConfigError';
  }
}

/**
 * Firebird холболтын тохиргоог ЗӨВХӨН орчны хувьсагчаас уншина.
 * Хэрэглэгч/нууц үг/хост/DB-г кодод хатуу бичихгүй (аюулгүй байдал — git-д secret оруулахгүй).
 * Шаардлагатай хувьсагч дутвал FirebirdConfigError шиднэ.
 */
export function getFirebirdOptions(): FirebirdOptions {
  const required = ['FIREBIRD_HOST', 'FIREBIRD_DATABASE', 'FIREBIRD_USER', 'FIREBIRD_PASSWORD'] as const;
  const missing = required.filter((k) => !(process.env[k] ?? '').trim());
  if (missing.length > 0) {
    throw new FirebirdConfigError(missing);
  }
  return {
    host: (process.env.FIREBIRD_HOST ?? '').trim(),
    port: parseInt(process.env.FIREBIRD_PORT ?? '3050', 10),
    database: (process.env.FIREBIRD_DATABASE ?? '').trim(),
    user: (process.env.FIREBIRD_USER ?? '').trim(),
    password: process.env.FIREBIRD_PASSWORD ?? '',
    lowercase_keys: true,
  };
}

/** FirebirdConfigError-г стандарт 503 JSON хариу болгоно. */
export function firebirdConfigErrorResponse(err: FirebirdConfigError) {
  return NextResponse.json(
    { error: 'Firebird тохиргоо дутуу', detail: err.message, missing: err.missing },
    { status: 503 },
  );
}

/**
 * Firebird endpoint-уудын эрхийн шалгалт.
 * `Bearer FIREBIRD_SYNC_SECRET` (cron) ЭСВЭЛ admin/chief_engineer session шаардана.
 * Зөвшөөрөгдвөл null, эс бол 401 хариу буцаана.
 */
export async function guardFirebirdRequest(req: Request): Promise<NextResponse | null> {
  const secret = (process.env.FIREBIRD_SYNC_SECRET ?? '').trim();
  const auth = req.headers.get('authorization') ?? '';
  if (secret && auth === `Bearer ${secret}`) return null;

  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role ?? '';
  if (session && ['admin', 'chief_engineer'].includes(role)) return null;

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// ── Firebird холболтын туслахууд ────────────────────────────────────────────────

export function fbConnect(options: FirebirdOptions): Promise<unknown> {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, (err: Error | null, db: unknown) => {
      if (err) reject(err); else resolve(db);
    });
  });
}

export function fbDetach(db: unknown): Promise<void> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).detach(() => resolve());
  });
}

export function fbQuery<T>(db: unknown, sql: string, params: unknown[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).query(sql, params, (err: Error | null, rows: T[]) => {
      if (err) reject(err); else resolve(rows ?? []);
    });
  });
}
