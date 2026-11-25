import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
export const projectRoot = path.resolve(import.meta.dirname, '../..');

// Execute production handlers, replacing only their external boundaries.
// Compiling in memory keeps the unit suite independent of PostgreSQL/child processes.
export function loadSource(relativePath, dependencies = {}) {
  const filename = path.join(projectRoot, relativePath);
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
  });
  const mod = { exports: {} };
  vm.runInThisContext(`(function(require, module, exports) { ${outputText}\n})`, { filename })(
    name => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name), mod, mod.exports,
  );
  return mod.exports;
}

export const masterStations = loadSource('lib/master-stations.ts');
export const maintenance = loadSource('lib/approval-maintenance-service.ts', { './master-stations': masterStations });

export function approvalRoutes(prisma, getActor) {
  const dependencies = {
    'next-auth/next': { getServerSession: async () => ({ user: getActor() }) },
    '@/lib/auth-options': { authOptions: {} }, '@/lib/prisma': { prisma },
    '@/lib/approval-maintenance': loadSource('lib/approval-maintenance.ts'),
    '@/lib/approval-maintenance-service': maintenance,
    '@/lib/shift-api-permissions': loadSource('lib/shift-api-permissions.ts'),
    '@/lib/picked-user': loadSource('lib/picked-user.ts', { './prisma': { prisma } }),
    '@/lib/shift-db': loadSource('lib/shift-db.ts'),
    '@/lib/master-stations': masterStations,
    '@/lib/approval-history-query': loadSource('lib/approval-history-query.ts', { './master-stations': masterStations }),
    '@/lib/device-access': { getDeviceAccessForRequest: async () => ({ allowed: true }) },
    '@/lib/system-settings': {
      getHandoverTimingStatus: async () => ({ key: 'normal', label: 'normal' }),
      getPeriodicIntervalHours: async () => 2, isHandoverWindowStrict: async () => false,
    },
    '@/lib/shift-completeness': { getPeriodicLogStatus: () => ({ isOverdue: false }), stationUsesPeriodicLogs: () => true },
    '@/lib/crew-master': { resolveCrewMasterForShift: async () => null },
    '@/lib/master-handover': { resolveNextMasterScheduleForShift: async () => null },
    '@/lib/operator-schedule-resolver': { resolveNextOperatorSchedule: async () => ({ eligible: false }), normalizeStationCode: value => value },
    '@/lib/environment-check-form': { normalizeEnvironmentChecks: value => value },
    '@/lib/server-audit': { writeServerAuditLog: async data => prisma.auditLog.create({ data }) },
    '@/lib/server-notifications': {
      notifyManyDeduped: async (ids, data) => {
        for (const userId of new Set(ids)) await prisma.notification.create({ data: { userId, ...data } });
      },
      createNotificationDeduped: async data => prisma.notification.create({ data }),
    },
  };
  return {
    manage: loadSource('app/api/approvals/manage/route.ts', dependencies),
    shift: loadSource('app/api/shifts/[id]/route.ts', dependencies),
    logs: loadSource('app/api/shifts/[id]/logs/route.ts', dependencies),
    forms: loadSource('app/api/y310-approvals/route.ts', dependencies),
  };
}

export function invoke(handler, body, id, method = 'PATCH') {
  return handler(new Request('http://localhost/api/test', {
    method, ...(method === 'GET' ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  }), { params: Promise.resolve({ id }) });
}
