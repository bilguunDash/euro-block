export type ApprovalRecordKind = 'shift' | 'master_form' | 'operator_schedule' | 'master_schedule';
export type ApprovalRecordState = 'pending' | 'approved' | 'not_started';
export type ApprovalMaintenanceAction = 'cancel' | 'delete';

export type ApprovalMaintenanceRequest = {
  kind: ApprovalRecordKind;
  id: string;
  state: ApprovalRecordState;
};

export function parseApprovalMaintenanceRequest(body: unknown): ApprovalMaintenanceRequest {
  const value = body as Partial<ApprovalMaintenanceRequest> | null;
  if (!value || !['shift', 'master_form', 'operator_schedule', 'master_schedule'].includes(value.kind || '')) {
    throw new Error('Бүртгэлийн төрөл буруу байна.');
  }
  if (typeof value.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.id)) {
    throw new Error('Бүртгэлийн дугаар буруу байна.');
  }
  const schedule = value.kind === 'operator_schedule' || value.kind === 'master_schedule';
  if (schedule ? value.state !== 'not_started' : !['pending', 'approved'].includes(value.state || '')) {
    throw new Error('Бүртгэлийн төлөв буруу байна.');
  }
  return value as ApprovalMaintenanceRequest;
}

export function approvalMaintenanceConfirmation(kind: ApprovalRecordKind, action: ApprovalMaintenanceAction, label: string) {
  const schedule = kind === 'operator_schedule' || kind === 'master_schedule';
  const effect = action === 'cancel'
    ? schedule
      ? 'Энэ хуваарийн оноолтыг цуцалж, мэдээллийг аудит логт хадгална.'
      : `${kind === 'master_form' ? 'Энэ маягтын бүх хувилбарын баталгаажуулалтыг буцааж' : 'Баталгаажуулалтыг буцааж'}, ээлжийг засварт нээнэ. Бөглөсөн мэдээлэл хадгалагдана. Дахин илгээсний дараа баталгаажуулна.`
    : schedule
      ? 'Зөвхөн энэ хуваарийн оноолтыг устгана.'
      : kind === 'master_form'
        ? 'Энэ ээлжийн сонгосон мастерын маягтыг бүх хувилбартай нь устгана. Ээлжийн бусад маягт хадгалагдана. Ээлжийн баталгаажуулалтыг буцаана.'
        : 'Энэ ээлжийг бүх маягт, хэмжилт, хавсралтын бүртгэлтэй нь устгана.';
  return {
    title: action === 'cancel' ? `${schedule ? 'Хуваарийг' : 'Баталгаажуулалтыг'} цуцлах уу?`
      : schedule ? 'Хуваарийн оноолтыг устгах уу?' : kind === 'master_form' ? 'Мастерын маягтыг устгах уу?' : 'Ээлжийн бүртгэлийг устгах уу?',
    message: `${label}\n${effect}${action === 'delete' ? ' Устгасан мэдээллийг сэргээх боломжгүй.' : ''}`,
    confirmText: action === 'cancel' ? 'Цуцлах' : 'Устгах',
    danger: true,
  };
}
