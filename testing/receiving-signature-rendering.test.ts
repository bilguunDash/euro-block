import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MasterStationFormSection } from '../components/shift/MasterStationFormSection';
import { ToastProvider } from '../components/ui/ToastProvider';
import { createEmptyY181HeatMasterHandoverPayload } from '../lib/y181-heat-master-form';
import { createEmptyY099MasterHandoverPayload } from '../lib/y099-shift-master-handover';
import { createEmptyY310Payload } from '../lib/y310-repair-master-handover-form';
import { createEmptyCAH02Payload } from '../lib/cah02-electrical-control-form';
import { createEmptyY320Payload } from '../lib/y320-electrical-automation-repair-form';

(globalThis as any).React = React;

const formCases = [
  ['CAH02ElectricalControlReadOnly', 'cah02-electrical-control-form', 'createEmptyCAH02Payload'],
  ['Y110StartFormReadOnly', 'y110-cement-pump-form', 'createEmptyY110Payload'],
  ['Y120HandoverFormReadOnly', 'y120-lime-mill-handover-form', 'createEmptyY120Payload'],
  ['Y121HandoverFormReadOnly', 'y121-ball-mill-handover-form', 'createEmptyY121Payload'],
  ['Y130HandoverFormReadOnly', 'y130-mixing-tower-handover-form', 'createEmptyY130Payload'],
  ['Y140HandoverFormReadOnly', 'y140-mold-rotation-handover-form', 'createEmptyY140Payload'],
  ['Y150HandoverFormReadOnly', 'y150-cutting-line-handover-form', 'createEmptyY150Payload'],
  ['Y160HandoverFormReadOnly', 'y160-ram-rotation-handover-form', 'createEmptyY160Payload'],
  ['Y170HandoverFormReadOnly', 'y170-trolley-rotation-handover-form', 'createEmptyY170Payload'],
  ['Y170PackingOperatorReadOnly', 'y170-packing-operator-form', 'createEmptyY170PackingPayload'],
  ['Y180AutoclaveOperatorReadOnly', 'y180-autoclave-operator-form', 'createEmptyY180Payload'],
  ['Y181HeatMasterHandoverReadOnly', 'y181-heat-master-form', 'createEmptyY181HeatMasterHandoverPayload'],
  ['Y190HandoverFormReadOnly', 'y190-quality-inspector-handover-form', 'createEmptyY190Payload'],
  ['Y210TechnologyKilnOperatorReadOnly', 'y210-technology-kiln-operator-form', 'createEmptyY210Payload'],
  ['Y310RepairMasterHandoverReadOnly', 'y310-repair-master-handover-form', 'createEmptyY310Payload'],
  ['Y320ElectricalAutomationRepairReadOnly', 'y320-electrical-automation-repair-form', 'createEmptyY320Payload'],
] as const;

const payloadArgs = {
  shiftDate: '2026-09-30', shiftType: 'Өдрийн' as const,
  operatorUid: 'u1', operatorName: 'Өгөх хүн', masterUid: 'm1', masterName: 'Өгөх мастер',
};

test('every saved form with a receiving signature shows the saved recipient', async () => {
  for (const [componentName, payloadFile, factoryName] of formCases) {
    const { [componentName]: Component } = await import(`../components/shift/${componentName}`);
    const { [factoryName]: createPayload } = await import(`../lib/${payloadFile}`);
    const data = { ...createPayload(payloadArgs), sigReceiving: 'Хүлээн авагчийн нэр' };
    const html = renderToStaticMarkup(React.createElement(Component, { data }));
    assert.equal(html.split('Хүлээн авагчийн нэр').length - 1, 1, `${componentName} omitted or repeated the saved recipient`);
  }
});

test('master forms use the recorded shift recipient when an older signature is empty', () => {
  const cases = [
    ['ҮЯ-099', 'y099_master_handover_v1', { ...createEmptyY099MasterHandoverPayload(payloadArgs), receivedBy: '' }],
    ['ҮЯ-181', 'y181_heat_master_handover_v1', createEmptyY181HeatMasterHandoverPayload(payloadArgs)],
    ['ҮЯ-310', 'y310_repair_master_form', createEmptyY310Payload(payloadArgs)],
    ['ҮЯ-410', 'cah02_electrical_control_form', createEmptyCAH02Payload(payloadArgs)],
  ] as const;
  for (const [stationCode, formKind, payload] of cases) {
    const html = renderToStaticMarkup(React.createElement(MasterStationFormSection, {
      stationCode,
      stationForms: { [formKind]: { ...payload, sigReceiving: '' } },
      shift: { stationCode, handoverAcceptedByName: 'Бодитоор хүлээн авсан' },
      canEdit: false, onEdit: () => {},
    }));
    assert.match(html, />Бодитоор хүлээн авсан</, `${stationCode} lost the accepted master`);
  }
});

test('master and repair editors prefill a missing recipient from their shift', async () => {
  const cases = [
    ['CAH02ElectricalControlForm', createEmptyCAH02Payload(payloadArgs), 'receivingMasterName'],
    ['Y181HeatMasterHandoverForm', createEmptyY181HeatMasterHandoverPayload(payloadArgs), 'receivingMasterName'],
    ['Y320ElectricalAutomationRepairForm', createEmptyY320Payload(payloadArgs), 'receivingName'],
  ] as const;
  for (const [formName, payload, receivingProp] of cases) {
    const { [formName]: Form } = await import(`../components/shift/forms/${formName}`);
    const html = renderToStaticMarkup(React.createElement(ToastProvider, null,
      React.createElement(Form, {
        ...payloadArgs, initialPayload: { ...payload, sigReceiving: '' },
        [receivingProp]: 'Ээлжийн хүлээн авагч',
        onBack: () => {}, onSubmit: async () => {}, submitting: false,
      })
    ));
    assert.match(html, /<option value="Ээлжийн хүлээн авагч"[^>]*>Ээлжийн хүлээн авагч<\/option>/,
      `${formName} did not prefill the recipient`);
  }
});
