import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { parseApprovalMaintenanceRequest, type ApprovalMaintenanceAction } from '@/lib/approval-maintenance';
import { ApprovalMaintenanceError, maintainApprovalRecord } from '@/lib/approval-maintenance-service';

async function handle(req: Request, action: ApprovalMaintenanceAction) {
  const session = await getServerSession(authOptions);
  const role = String((session?.user as any)?.role || '');
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  if (!['admin', 'chief_engineer'].includes(role)) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  let request;
  try { request = parseApprovalMaintenanceRequest(await req.json()); }
  catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Invalid JSON' }, { status: 400 }); }
  try {
    await prisma.$transaction((tx) => maintainApprovalRecord(tx, request, action, {
      id: session.user.id, name: session.user.name || null,
    }), { isolationLevel: 'Serializable' });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ApprovalMaintenanceError) return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    if ((error as { code?: string })?.code === 'P2034') return NextResponse.json({ ok: false, error: 'Бүртгэлийн төлөв өөрчлөгдсөн. Жагсаалтыг шинэчлээд дахин оролдоно уу.' }, { status: 409 });
    console.error(`${req.method} /api/approvals/manage`, error);
    return NextResponse.json({ ok: false, error: 'Үйлдлийг хадгалж чадсангүй. Дахин оролдоно уу.' }, { status: 500 });
  }
}

export async function PATCH(req: Request) { return handle(req, 'cancel'); }
export async function DELETE(req: Request) { return handle(req, 'delete'); }
