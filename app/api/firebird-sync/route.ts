import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  FirebirdConfigError,
  fbConnect,
  fbDetach,
  fbQuery,
  firebirdConfigErrorResponse,
  getFirebirdOptions,
  guardFirebirdRequest,
} from '@/lib/firebird';

// undefined болон null хоёуланг null болгоно
function n<T>(v: T | null | undefined): T | null { return v ?? null; }

// Firebird UTC+8 → PostgreSQL-д wall-clock цагаар хадгална
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;
function fd(v: unknown): Date | null {
  const d = n(v) as Date | null;
  if (!d || isNaN(d.getTime())) return null;
  return new Date(d.getTime() + TZ_OFFSET_MS);
}

const CHUNK = 500;

// Firebird холболт/туслахууд lib/firebird.ts-д төвлөрсөн (creds зөвхөн env-ээс).

// Өгөгдлийг CHUNK хэмжээгээр хуваагаад createMany-гаар оруулна
async function bulkInsert<T extends object>(
  rows: T[],
  insertFn: (chunk: T[]) => Promise<{ count: number }>
): Promise<number> {
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const result = await insertFn(rows.slice(i, i + CHUNK));
    total += result.count;
  }
  return total;
}

// ── Per-table sync functions ──────────────────────────────────────────────────

async function syncBatch(db: unknown) {
  const top = await prisma.batch.findFirst({ orderBy: { firebirdId: 'desc' }, select: { firebirdId: true } });
  const maxId = top?.firebirdId ?? -1;
  const rows = await fbQuery<Record<string, unknown>>(db, `SELECT * FROM BATCH WHERE ID > ? ORDER BY ID`, [maxId]);

  const data = rows.map(r => ({
    firebirdId:          n(r.id) as number,
    orderId:             n(r.order_id) as number,
    recipeId:            n(r.recipe_id) as number,
    id2:                 n(r.id_2) as number,
    productionLine:      n(r.production_line) as number,
    destinationTarget:   n(r.destination_target) as number,
    waterAddTimeActual:  n(r.water_add_time_actual) as number,
    mxTime4Setp:         n(r.mx_time_4_setp) as number,
    mxNbr:               n(r.mx_nbr) as number,
    temperatureSetp:     n(r.temperature_setp) as number,
    status:              n(r.status) as number,
    mxStartTime1:        fd(r.mx_start_time_1),
    mxTime1Setp:         n(r.mx_time_1_setp) as number,
    mxWaterType:         n(r.mx_water_type) as number,
    trReadyTime:         fd(r.tr_ready_time),
    mxReadyTime:         fd(r.mx_ready_time),
    destinationActual:   n(r.destination_actual) as number,
    trStartTime:         fd(r.tr_start_time),
    mxTimeDischSetp:     n(r.mx_time_disch_setp) as number,
    mxTime2Actual:       n(r.mx_time_2_actual) as number,
    readyTime:           fd(r.ready_time),
    mxTime1Actual:       n(r.mx_time_1_actual) as number,
    temperatureActual:   n(r.temperature_actual) as number,
    mxTime2Setp:         n(r.mx_time_2_setp) as number,
    mxStartTimeDisch:    fd(r.mx_start_time_disch),
    excepSequence:       n(r.excep_sequence) as number,
    mxTimeTotalSetp:     n(r.mx_time_total_setp) as number,
    mxSteamType:         n(r.mx_steam_type) as number,
    mxFillingTime:       n(r.mx_filling_time) as number,
    mxStartTime2:        fd(r.mx_start_time_2),
    startTime:           fd(r.start_time),
    mxTime3Actual:       n(r.mx_time_3_actual) as number,
    mxTime3Setp:         n(r.mx_time_3_setp) as number,
    mxStartTimeFill:     fd(r.mx_start_time_fill),
    mxTime4Actual:       n(r.mx_time_4_actual) as number,
    dischargingMassflow: n(r.discharging_massflow) as number,
    choppersInUse:       n(r.choppers_in_use) as number,
    actualNumberOfBatch: n(r.actual_number_of_batch) as number,
    batchType:           n(r.batch_type) as number,
    mxTimeDischActual:   n(r.mx_time_disch_actual) as number,
    trLineNbr:           n(r.tr_line_nbr) as number,
    mxTimeTotalActual:   n(r.mx_time_total_actual) as number,
    steamAddTimeActual:  n(r.steam_add_time_actual) as number,
    metalDetections:     n(r.metal_detections) as number,
  }));

  return bulkInsert(data, chunk => prisma.batch.createMany({ data: chunk, skipDuplicates: true }));
}

async function syncDestination(db: unknown) {
  const top = await prisma.destination.findFirst({ orderBy: { firebirdId: 'desc' }, select: { firebirdId: true } });
  const maxId = top?.firebirdId ?? -1;
  const rows = await fbQuery<Record<string, unknown>>(db, `SELECT * FROM DESTINATION WHERE ID > ? ORDER BY ID`, [maxId]);

  const data = rows.map(r => ({
    firebirdId:     n(r.id) as number,
    description:    n(r.description) as string,
    productionLine: n(r.production_line) as number,
  }));

  return bulkInsert(data, chunk => prisma.destination.createMany({ data: chunk, skipDuplicates: true }));
}

async function syncMaterial(db: unknown) {
  const top = await prisma.material.findFirst({ orderBy: { firebirdId: 'desc' }, select: { firebirdId: true } });
  const maxId = top?.firebirdId ?? -1;
  const rows = await fbQuery<Record<string, unknown>>(db, `SELECT * FROM MATERIAL WHERE ID > ? ORDER BY ID`, [maxId]);

  const data = rows.map(r => ({
    firebirdId: n(r.id) as number,
    gmf:        n(r.gmf) as number,
    density:    n(r.density) as number,
    savingTime: fd(r.saving_time),
    name:       n(r.name) as string,
    batchprint: n(r.batchprint) as number,
    code:       n(r.code) as string,
    totalcount: n(r.totalcount) as number,
    unit:       n(r.unit) as string,
    userName:   n(r.user_name) as string,
  }));

  return bulkInsert(data, chunk => prisma.material.createMany({ data: chunk, skipDuplicates: true }));
}

async function syncMixer(db: unknown) {
  const top = await prisma.mixer.findFirst({ orderBy: { firebirdId: 'desc' }, select: { firebirdId: true } });
  const maxId = top?.firebirdId ?? -1;
  const rows = await fbQuery<Record<string, unknown>>(db, `SELECT * FROM MIXER WHERE ID > ? ORDER BY ID`, [maxId]);

  const data = rows.map(r => ({
    firebirdId:     n(r.id) as number,
    positionNumber: n(r.position_number) as number,
  }));

  return bulkInsert(data, chunk => prisma.mixer.createMany({ data: chunk, skipDuplicates: true }));
}

async function syncProductOrder(db: unknown) {
  const top = await prisma.productOrder.findFirst({ orderBy: { firebirdId: 'desc' }, select: { firebirdId: true } });
  const maxId = top?.firebirdId ?? -1;
  // PRODUCT_ORDER эсвэл PRODUCTORDER — error message-ийг харж нэрийг тохируул
  const rows = await fbQuery<Record<string, unknown>>(db, `SELECT * FROM PRODUCT_ORDER WHERE ID > ? ORDER BY ID`, [maxId]);

  const data = rows.map(r => ({
    firebirdId:            n(r.id) as number,
    recipeId:              n(r.recipe_id) as number,
    productionLine:        n(r.production_line) as number,
    originalDestination:   n(r.original_destination) as number,
    extText2:              n(r.ext_text_2) as string,
    unit:                  n(r.unit) as string,
    name:                  n(r.name) as string,
    extSmall1:             n(r.ext_small_1) as number,
    batchSize:             n(r.batch_size) as number,
    readyTime:             fd(r.ready_time),
    orderTime:             fd(r.order_time),
    code:                  n(r.code) as string,
    extText1:              n(r.ext_text_1) as string,
    numberOfBatches:       n(r.number_of_batches) as number,
    numberOfBatchesActual: n(r.number_of_batches_actual) as number,
    extText3:              n(r.ext_text_3) as string,
    extSmall2:             n(r.ext_small_2) as number,
  }));

  return bulkInsert(data, chunk => prisma.productOrder.createMany({ data: chunk, skipDuplicates: true }));
}

async function syncRecipe(db: unknown) {
  const top = await prisma.recipe.findFirst({ orderBy: { firebirdId: 'desc' }, select: { firebirdId: true } });
  const maxId = top?.firebirdId ?? -1;
  const rows = await fbQuery<Record<string, unknown>>(db, `SELECT * FROM RECIPE WHERE ID > ? ORDER BY ID`, [maxId]);

  const data = rows.map(r => ({
    firebirdId:     n(r.id) as number,
    inuse:          n(r.inuse) as number,
    savedBy:        n(r.saved_by) as string,
    totalTarget:    n(r.total_target) as number,
    productVersion: n(r.product_version) as number,
    choppersInUse:  n(r.choppers_in_use) as number,
    dischTime:      n(r.disch_time) as number,
    destination:    n(r.destination) as number,
    savedTime:      fd(r.saving_time),
    customeVersion: n(r.custom_version) as number,
    name:           n(r.name) as string,
    productionLine: n(r.production_line) as number,
    code:           n(r.code) as string,
    mxTime2:        n(r.mx_time_2) as number,
    totalWaterRpc:  n(r.total_water_prc) as number,
    totalWaterKg:   n(r.total_water_kg) as number,
    comment:        n(r.comment) as string,
    temperature:    n(r.temperature) as number,
    mxTime3:        n(r.mx_time_3) as number,
    mxNbr:          n(r.mx_nbr) as number,
    mxTime1:        n(r.mx_time_1) as number,
    productNbr:     n(r.product_nbr) as number,
  }));

  return bulkInsert(data, chunk => prisma.recipe.createMany({ data: chunk, skipDuplicates: true }));
}

async function syncRecipeComponent(db: unknown) {
  // ID column байхгүй — composite key (recipeId, rowNbr)-аар дедуп хийнэ
  const rows = await fbQuery<Record<string, unknown>>(db, `SELECT * FROM RECIPE_COMPONENT`, []);

  const data = rows.map(r => ({
    recipeId:     n(r.recipe_id) as number,
    rowNbr:       n(r.row_nbr) as number,
    materialId:   n(r.material_id) as number,
    scale:        n(r.scale) as number,
    silo:         n(r.silo) as number,
    setpointPrc:  n(r.setpoint_prc) as number,
    setpoint:     n(r.setpoint) as number,
    tolerancePos: n(r.tolerance_pos) as number,
    toleranceNeg: n(r.tolerance_neg) as number,
    preact:       n(r.preact) as number,
    extParam1:    n(r.ext_param_1) as number,
    extParam2:    n(r.ext_param_2) as number,
    unit:         n(r.unit) as string,
    code:         n(r.code) as string,
    name:         n(r.name) as string,
    totalcount:   n(r.totalcount) as number,
    batchprint:   n(r.batchprint) as number,
    vlk:          n(r.vlk) as number,
    sv:           n(r.sv) as number,
  }));

  return bulkInsert(data, chunk => prisma.recipeComponent.createMany({ data: chunk, skipDuplicates: true }));
}

async function syncScale(db: unknown) {
  const top = await prisma.scale.findFirst({ orderBy: { firebirdId: 'desc' }, select: { firebirdId: true } });
  const maxId = top?.firebirdId ?? -1;
  const rows = await fbQuery<Record<string, unknown>>(db, `SELECT * FROM SCALE WHERE ID > ? ORDER BY ID`, [maxId]);

  const data = rows.map(r => ({
    firebirdId:     n(r.id) as number,
    unit:           n(r.unit) as string,
    maxLimit:       n(r.max_limit) as number,
    positionNumber: n(r.position_number) as number,
    format:         n(r.format) as string,
    scaleStep:      n(r.scale_step) as number,
    decimals:       n(r.decimals) as number,
    name:           n(r.name) as string,
    productionLine: n(r.production_line) as number,
  }));

  return bulkInsert(data, chunk => prisma.scale.createMany({ data: chunk, skipDuplicates: true }));
}

async function syncSilo(db: unknown) {
  const top = await prisma.silo.findFirst({ orderBy: { firebirdId: 'desc' }, select: { firebirdId: true } });
  const maxId = top?.firebirdId ?? -1;
  const rows = await fbQuery<Record<string, unknown>>(db, `SELECT * FROM SILO WHERE ID > ? ORDER BY ID`, [maxId]);

  const data = rows.map(r => ({
    firebirdId:      n(r.id) as number,
    positionNumber:  n(r.position_number) as number,
    name:            n(r.name) as string,
    scale:           n(r.scale) as number,
    material:        n(r.material) as number,
    spareSilo:       n(r.spare_silo) as number,
    accuracy:        n(r.accuracy) as number,
    inventoryLevel:  n(r.inventory_level) as number,
    volume:          n(r.volume) as number,
    scaleDosingLine: n(r.scale_dosing_line) as number,
  }));

  return bulkInsert(data, chunk => prisma.silo.createMany({ data: chunk, skipDuplicates: true }));
}

async function syncTransport(db: unknown) {
  const top = await prisma.transport.findFirst({ orderBy: { firebirdId: 'desc' }, select: { firebirdId: true } });
  const maxId = top?.firebirdId ?? -1;
  const rows = await fbQuery<Record<string, unknown>>(db, `SELECT * FROM TRANSPORT WHERE ID > ? ORDER BY ID`, [maxId]);

  const data = rows.map(r => ({
    firebirdId:     n(r.id) as number,
    positionNumber: n(r.position_number) as number,
  }));

  return bulkInsert(data, chunk => prisma.transport.createMany({ data: chunk, skipDuplicates: true }));
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const denied = await guardFirebirdRequest(req);
  if (denied) return denied;

  const results: Record<string, { synced: number; error?: string }> = {};

  let db: unknown;
  try {
    db = await fbConnect(getFirebirdOptions());
  } catch (err) {
    if (err instanceof FirebirdConfigError) return firebirdConfigErrorResponse(err);
    return NextResponse.json({ error: 'Firebird холболт амжилтгүй', detail: String(err) }, { status: 503 });
  }

  const tables: Array<{ name: string; fn: (db: unknown) => Promise<number> }> = [
    { name: 'batch',           fn: syncBatch },
    { name: 'destination',     fn: syncDestination },
    { name: 'material',        fn: syncMaterial },
    { name: 'mixer',           fn: syncMixer },
    { name: 'productOrder',    fn: syncProductOrder },
    { name: 'recipe',          fn: syncRecipe },
    { name: 'recipeComponent', fn: syncRecipeComponent },
    { name: 'scale',           fn: syncScale },
    { name: 'silo',            fn: syncSilo },
    { name: 'transport',       fn: syncTransport },
  ];

  for (const { name, fn } of tables) {
    try {
      const synced = await fn(db);
      results[name] = { synced };
    } catch (err) {
      results[name] = { synced: 0, error: String(err) };
    }
  }

  await fbDetach(db);

  const totalSynced = Object.values(results).reduce((s, r) => s + r.synced, 0);
  return NextResponse.json({ ok: true, totalSynced, results });
}
