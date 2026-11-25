import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ToastProvider } from '../components/ui/ToastProvider';
import { ENVIRONMENT_CHECK_TITLE } from '../lib/environment-check-form';

// The test runner uses classic JSX for TSX components; Next provides this at runtime.
(globalThis as any).React = React;

const forms = [
  ['CAH02ElectricalControlReadOnly', 'cah02-electrical-control-form', 'createEmptyCAH02Payload', 'CAH02ElectricalControlForm'],
  ['FactoryProcessControlReadOnly', 'factory-process-control-form', 'createEmptyFactoryProcessControlPayload', 'FactoryProcessControlForm'],
  ['IngredientChangeRecordReadOnly', 'ingredient-change-record-form', 'createEmptyIngredientChangeRecordPayload', 'IngredientChangeRecordForm'],
  ['Y099ShiftMasterHandoverReadOnly', 'y099-shift-master-handover', 'createEmptyY099MasterHandoverPayload', 'Y099ShiftMasterHandoverForm'],
  ['Y110StartFormReadOnly', 'y110-cement-pump-form', 'createEmptyY110Payload', 'Y110CementPumpStartForm'],
  ['Y120HandoverFormReadOnly', 'y120-lime-mill-handover-form', 'createEmptyY120Payload', 'Y120LimeMillHandoverForm'],
  ['Y121HandoverFormReadOnly', 'y121-ball-mill-handover-form', 'createEmptyY121Payload', 'Y121BallMillHandoverForm'],
  ['Y130HandoverFormReadOnly', 'y130-mixing-tower-handover-form', 'createEmptyY130Payload', 'Y130MixingTowerHandoverForm'],
  ['Y140HandoverFormReadOnly', 'y140-mold-rotation-handover-form', 'createEmptyY140Payload', 'Y140MoldRotationHandoverForm'],
  ['Y150HandoverFormReadOnly', 'y150-cutting-line-handover-form', 'createEmptyY150Payload', 'Y150CuttingLineHandoverForm'],
  ['Y160HandoverFormReadOnly', 'y160-ram-rotation-handover-form', 'createEmptyY160Payload', 'Y160RamRotationHandoverForm'],
  ['Y170HandoverFormReadOnly', 'y170-trolley-rotation-handover-form', 'createEmptyY170Payload', 'Y170TrolleyRotationHandoverForm'],
  ['Y170PackingOperatorReadOnly', 'y170-packing-operator-form', 'createEmptyY170PackingPayload', 'Y170PackingOperatorForm'],
  ['Y180AutoclaveOperatorReadOnly', 'y180-autoclave-operator-form', 'createEmptyY180Payload', 'Y180AutoclaveOperatorForm'],
  ['Y181HeatMasterHandoverReadOnly', 'y181-heat-master-form', 'createEmptyY181HeatMasterHandoverPayload', 'Y181HeatMasterHandoverForm'],
  ['Y190HandoverFormReadOnly', 'y190-quality-inspector-handover-form', 'createEmptyY190Payload', 'Y190QualityInspectorHandoverForm'],
  ['Y210TechnologyKilnOperatorReadOnly', 'y210-technology-kiln-operator-form', 'createEmptyY210Payload', 'Y210TechnologyKilnOperatorForm'],
  ['Y310RepairMasterHandoverReadOnly', 'y310-repair-master-handover-form', 'createEmptyY310Payload', 'Y310RepairMasterHandoverForm'],
  ['Y320ElectricalAutomationRepairReadOnly', 'y320-electrical-automation-repair-form', 'createEmptyY320Payload', 'Y320ElectricalAutomationRepairForm'],
] as const;

test('every saved station form shows environmental questions exactly once', async () => {
  for (const [componentName, payloadFile, payloadFactory] of forms) {
    const componentModule = await import(`../components/shift/${componentName}`);
    const payloadModule = await import(`../lib/${payloadFile}`);
    const Component = componentModule[componentName];
    const createPayload = payloadModule[payloadFactory];
    assert.equal(typeof Component, 'function', `${componentName} is missing`);
    assert.equal(typeof createPayload, 'function', `${payloadFactory} is missing`);

    const data = createPayload({
      shiftDate: '2026-09-30', shiftType: 'Өдрийн',
      operatorUid: 'u1', operatorName: 'Оператор', masterUid: 'm1', masterName: 'Мастер',
    });
    const html = renderToStaticMarkup(React.createElement(Component, { data }));
    const count = html.split(ENVIRONMENT_CHECK_TITLE).length - 1;
    assert.equal(count, 1, `${componentName} shows ${count} environmental check sections`);
  }
});

test('every station form editor shows environmental questions exactly once', async () => {
  for (const [, payloadFile, payloadFactory, formName] of forms) {
    const formModule = await import(`../components/shift/forms/${formName}`);
    const payloadModule = await import(`../lib/${payloadFile}`);
    const Form = formModule[formName];
    const data = payloadModule[payloadFactory]({
      shiftDate: '2026-09-30', shiftType: 'Өдрийн',
      operatorUid: 'u1', operatorName: 'Оператор', masterUid: 'm1', masterName: 'Мастер',
    });
    assert.equal(typeof Form, 'function', `${formName} is missing`);

    const html = renderToStaticMarkup(React.createElement(ToastProvider, null,
      React.createElement(Form, {
        shiftDate: '2026-09-30', shiftType: 'Өдрийн',
        operatorUid: 'u1', operatorName: 'Оператор', masterUid: 'm1', masterName: 'Мастер',
        initialPayload: data, onBack: () => {}, onSubmit: async () => {}, submitting: false,
      })
    ));
    const count = html.split(ENVIRONMENT_CHECK_TITLE).length - 1;
    assert.equal(count, 1, `${formName} shows ${count} environmental check sections`);
  }
});
