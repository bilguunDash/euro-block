'use client';

import { Y099ShiftMasterHandoverReadOnly } from '@/components/shift/Y099ShiftMasterHandoverReadOnly';
import { Y181HeatMasterHandoverReadOnly } from '@/components/shift/Y181HeatMasterHandoverReadOnly';
import { Y310RepairMasterHandoverReadOnly } from '@/components/shift/Y310RepairMasterHandoverReadOnly';
import { FactoryProcessControlReadOnly } from '@/components/shift/FactoryProcessControlReadOnly';
import { CAH02ElectricalControlReadOnly } from '@/components/shift/CAH02ElectricalControlReadOnly';
import { masterStationFormConfig, type MasterStationCode } from '@/lib/master-stations';
import { preferEnvironmentChecks } from '@/lib/environment-check-form';
import { resolveReceivingName } from '@/lib/shift-signature';

type MasterStationFormSectionProps = {
  stationCode: MasterStationCode;
  stationForms: Record<string, any>;
  shift: any;
  canEdit: boolean;
  onEdit: () => void;
};

export function MasterStationFormSection({
  stationCode,
  stationForms,
  shift,
  canEdit,
  onEdit,
}: MasterStationFormSectionProps) {
  const config = masterStationFormConfig(stationCode);
  if (!config) return null;

  const existing = stationForms[config.formKind] || null;
  const legacy = config.legacyKey ? (shift as any)[config.legacyKey] : null;
  const data = existing || legacy;
  const hasData = Boolean(data);

  return (
    <section className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-bold text-gray-900">{config.title}</h3>
          <p className="text-sm text-gray-500 mt-1">Ээлжийн явцад бүртгэнэ. Ээлж дуусахад дараагийн мастер руу хүлээлцнэ.</p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
          >
            {hasData ? 'Засах' : 'Бүртгэх'}
          </button>
        ) : null}
      </div>

      {!hasData ? (
        <p className="text-sm text-gray-500">Бүртгэл хийгдээгүй.</p>
      ) : stationCode === 'ҮЯ-099' ? (
        <Y099ShiftMasterHandoverReadOnly
          data={{
            ...data,
            environmentChecks: preferEnvironmentChecks(
              data.environmentChecks,
              stationForms.factory_process_control_form?.environmentChecks ?? (shift as any).factoryProcessControlForm?.environmentChecks
            ),
          }}
          receivingMasterName={resolveReceivingName(shift.handoverAcceptedByName, shift.nextMasterName)}
        />
      ) : stationCode === 'ҮЯ-181' ? (
        <Y181HeatMasterHandoverReadOnly
          data={data}
          receivingMasterName={resolveReceivingName(shift.handoverAcceptedByName, shift.nextMasterName)}
        />
      ) : stationCode === 'ҮЯ-310' ? (
        <Y310RepairMasterHandoverReadOnly
          data={data}
          receivingMasterName={resolveReceivingName(shift.handoverAcceptedByName, shift.nextMasterName)}
        />
      ) : stationCode === 'ҮЯ-400' ? (
        <FactoryProcessControlReadOnly data={data} />
      ) : (
        <CAH02ElectricalControlReadOnly
          data={data}
          receivingMasterName={resolveReceivingName(shift.handoverAcceptedByName, shift.nextMasterName)}
        />
      )}
    </section>
  );
}
