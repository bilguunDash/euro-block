import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MasterStationFormSection } from '../components/shift/MasterStationFormSection';
import { Y310RepairMasterHandoverForm } from '../components/shift/forms/Y310RepairMasterHandoverForm';
import { ToastProvider } from '../components/ui/ToastProvider';
import { createEmptyY310Payload } from '../lib/y310-repair-master-handover-form';
import { resolveReceivingName } from '../lib/shift-signature';

(globalThis as any).React = React;

const empty = createEmptyY310Payload({
  shiftDate: '2026-09-30', shiftType: 'Өдрийн', operatorUid: 'm1', operatorName: 'Өгөх мастер',
});

const renderSaved = (sigReceiving: string, shift: Record<string, unknown> = {}) => {
  const html = renderToStaticMarkup(React.createElement(MasterStationFormSection, {
    stationCode: 'ҮЯ-310',
    stationForms: { y310_repair_master_form: { ...empty, sigReceiving } },
    shift: { stationCode: 'ҮЯ-310', ...shift }, canEdit: false, onEdit: () => {},
  }));
  return /Ээлж хүлээн авсан: Засварын мастер<\/p><p[^>]*>([^<]*)<\/p>/.exec(html)?.[1];
};

test('Y310 saved form shows its receiving master instead of a dash', () => {
  assert.equal(renderSaved('Хадгалсан мастер', { handoverAcceptedByName: 'Өөр мастер' }), 'Хадгалсан мастер');
  assert.equal(renderSaved('', { handoverAcceptedByName: 'Хүлээн авсан мастер' }), 'Хүлээн авсан мастер');
  assert.equal(renderSaved('—', { nextMasterName: 'Оноогдсон мастер' }), 'Оноогдсон мастер');
  assert.equal(renderSaved(''), '—');
});

test('Y310 editor pre-fills a missing receiving master from the shift', () => {
  assert.equal(resolveReceivingName(' - ', 'Дараагийн мастер'), 'Дараагийн мастер');
  const html = renderToStaticMarkup(React.createElement(ToastProvider, null,
    React.createElement(Y310RepairMasterHandoverForm, {
      shiftDate: '2026-09-30', shiftType: 'Өдрийн', operatorUid: 'm1', operatorName: 'Өгөх мастер',
      initialPayload: { ...empty, sigReceiving: '' }, receivingMasterName: 'Дараагийн мастер',
      onBack: () => {}, onSubmit: async () => {}, submitting: false,
    })
  ));
  assert.match(html, /<option value="Дараагийн мастер"[^>]*>Дараагийн мастер<\/option>/);
});
