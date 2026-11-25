import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FactoryProcessControlReadOnly } from '../components/shift/FactoryProcessControlReadOnly';
import { FactoryProcessControlForm } from '../components/shift/forms/FactoryProcessControlForm';
import { ToastProvider } from '../components/ui/ToastProvider';
import { MasterStationFormSection } from '../components/shift/MasterStationFormSection';
import { createEmptyFactoryProcessControlPayload } from '../lib/factory-process-control-form';
import { createEmptyY099MasterHandoverPayload } from '../lib/y099-shift-master-handover';
import { ENVIRONMENT_CHECK_TITLE } from '../lib/environment-check-form';

// The project's TS test runner uses classic JSX; Next itself supplies this automatically.
(globalThis as any).React = React;
const { createElement } = React;

const y099 = createEmptyY099MasterHandoverPayload({
  shiftDate: '2026-09-30', shiftType: 'Өдрийн', masterUid: 'm1', masterName: 'Мастер',
});
const process = { ...createEmptyFactoryProcessControlPayload({
  shiftDate: '2026-09-30', shiftType: 'Өдрийн', operatorUid: 'm1', operatorName: 'Мастер',
}), submittedAt: '' };
process.environmentChecks[0] = { ...process.environmentChecks[0], answer: 'Тийм', comment: 'Хуучин хариулт' };
const titleCount = (html: string) => html.split(ENVIRONMENT_CHECK_TITLE).length - 1;

test('Y099 shows one environmental checklist and keeps answers saved in the older process form', () => {
  const forms = { y099_master_handover_v1: y099, factory_process_control_form: process };
  const main = renderToStaticMarkup(createElement(MasterStationFormSection, {
    stationCode: 'ҮЯ-099', stationForms: forms, shift: { stationCode: 'ҮЯ-099' },
    canEdit: false, onEdit: () => {},
  }));
  const auxiliary = renderToStaticMarkup(createElement(FactoryProcessControlReadOnly, {
    data: process, showEnvironmentChecks: false,
  }));
  assert.equal(titleCount(main + auxiliary), 1);
  assert.match(main, /Хуучин хариулт/);
});

test('the process form still shows the checklist on Y400 and when Y099 has no main form yet', () => {
  const processHtml = renderToStaticMarkup(createElement(FactoryProcessControlReadOnly, { data: process }));
  assert.equal(titleCount(processHtml), 1);
  const noMain = renderToStaticMarkup(createElement(MasterStationFormSection, {
    stationCode: 'ҮЯ-099', stationForms: { factory_process_control_form: process },
    shift: { stationCode: 'ҮЯ-099' }, canEdit: false, onEdit: () => {},
  }));
  assert.equal(titleCount(noMain + processHtml), 1);
});

test('a filled Y099 answer takes precedence over a different process-form answer', () => {
  const primary = {
    ...y099,
    environmentChecks: y099.environmentChecks.map((row, index) => index === 0
      ? { ...row, answer: 'Үгүй' as const, comment: 'Мастерын хариулт' } : row),
  };
  const html = renderToStaticMarkup(createElement(MasterStationFormSection, {
    stationCode: 'ҮЯ-099',
    stationForms: { y099_master_handover_v1: primary, factory_process_control_form: process },
    shift: { stationCode: 'ҮЯ-099' }, canEdit: false, onEdit: () => {},
  }));
  assert.equal(titleCount(html), 1);
  assert.match(html, /Мастерын хариулт/);
  assert.doesNotMatch(html, /Хуучин хариулт/);
});

test('Y099 process editor omits its duplicate checklist while the Y400 editor keeps it', () => {
  const props = {
    shiftDate: '2026-09-30', shiftType: 'Өдрийн', operatorUid: 'm1', operatorName: 'Мастер',
    initialPayload: process, onBack: () => {}, onSubmit: async () => {}, submitting: false,
  };
  const renderEditor = (showEnvironmentChecks: boolean) => renderToStaticMarkup(
    createElement(ToastProvider, null, createElement(FactoryProcessControlForm, {
      ...props, showEnvironmentChecks,
    }))
  );
  const y099Editor = renderEditor(false);
  const y400Editor = renderEditor(true);
  assert.equal(titleCount(y099Editor), 0);
  assert.equal(titleCount(y400Editor), 1);
});
