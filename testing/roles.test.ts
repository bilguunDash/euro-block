import assert from 'node:assert/strict';
import test from 'node:test';
import { ALLOWED_ROLES, isAllowedRole, normalizeRole, roleLabel } from '../lib/roles';

test('isAllowedRole recognizes all 8 canonical roles and rejects everything else', () => {
  for (const role of ALLOWED_ROLES) {
    assert.equal(isAllowedRole(role), true, `${role} should be allowed`);
  }
  for (const bad of ['manager', '', 'bogus', null, undefined]) {
    assert.equal(isAllowedRole(bad), false, `${JSON.stringify(bad)} should not be allowed`);
  }
});

test('normalizeRole maps the legacy "manager" alias to "admin" but otherwise passes values through unchanged', () => {
  assert.equal(normalizeRole('MANAGER'), 'admin');
  assert.equal(normalizeRole(' Manager '), 'admin');
  assert.equal(normalizeRole('chief_engineer'), 'chief_engineer');
  assert.equal(normalizeRole('bogus_role'), 'bogus_role');
  assert.equal(normalizeRole(null), '');
  assert.equal(normalizeRole(undefined), '');
});

test('roleLabel returns the Mongolian label for known roles and the raw value for unknown ones', () => {
  assert.equal(roleLabel('auditor'), 'Аудитор');
  assert.equal(roleLabel('chief_engineer'), 'Ерөнхий инженер');
  assert.equal(roleLabel('unknown_xyz'), 'unknown_xyz');
});
