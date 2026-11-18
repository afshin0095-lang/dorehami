import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateMessage, makeMessage, makeRoomCode, normalizeRoomCode, createRevisionGate, PROTOCOL_VERSION } from '../public/src/net/sync.js';
import { mulberry32 } from '../public/src/core.js';

const valid = () => makeMessage('hello', { roomId: 'AB12C', from: 'p1abcde', payload: { at: 1 } });

test('پیام درست پذیرفته می‌شود', () => {
  const r = validateMessage(valid());
  assert.equal(r.ok, true);
  assert.equal(r.msg.type, 'hello');
});

test('نسخه‌ی ناسازگار رد می‌شود', () => {
  const r = validateMessage({ ...valid(), v: 99 });
  assert.equal(r.ok, false);
});

test('نوع پیام ناشناخته رد می‌شود', () => {
  assert.equal(validateMessage({ ...valid(), type: 'exec' }).ok, false);
});

test('شناسه‌ی اتاق نامعتبر رد می‌شود', () => {
  assert.equal(validateMessage({ ...valid(), roomId: 'a' }).ok, false);
  assert.equal(validateMessage({ ...valid(), roomId: 'AB' }).ok, false);
  assert.equal(validateMessage({ ...valid(), roomId: 'AB12C3D45' }).ok, false);
});

test('فرستنده‌ی نامعتبر رد می‌شود', () => {
  assert.equal(validateMessage({ ...valid(), from: '' }).ok, false);
  assert.equal(validateMessage({ ...valid(), from: 'x'.repeat(40) }).ok, false);
});

test('پیام غیرشیء رد می‌شود', () => {
  assert.equal(validateMessage(null).ok, false);
  assert.equal(validateMessage('hi').ok, false);
  assert.equal(validateMessage(42).ok, false);
});

test('پیام بیش از ۱۶KB رد می‌شود', () => {
  const big = makeMessage('state', { roomId: 'AB12C', from: 'p1abcde', payload: { blob: 'x'.repeat(20000) } });
  assert.equal(validateMessage(big).ok, false);
});

test('makeRoomCode: طول و الفبای بدون حروف مبهم', () => {
  const rnd = mulberry32(4);
  for (let i = 0; i < 30; i++) {
    const c = makeRoomCode(rnd);
    assert.equal(c.length, 5);
    assert.equal(/[O0I1]/.test(c), false, c);
    assert.equal(normalizeRoomCode(c), c);
  }
});

test('normalizeRoomCode: ورودی کاربر نرمال می‌شود', () => {
  assert.equal(normalizeRoomCode(' ab-12c '), 'AB12C');
  assert.equal(normalizeRoomCode('ab1'), null);
  assert.equal(normalizeRoomCode(''), null);
});

test('revision gate: فقط وضعیت تازه‌ی سرور پذیرفته می‌شود', () => {
  const gate = createRevisionGate();
  const state = (rev, from = 'server') => ({ type: 'state', from, rev, payload: {} });
  assert.equal(gate.accept(state(1)), true);
  assert.equal(gate.accept(state(1)), false, 'تکرار پذیرفته نشود');
  assert.equal(gate.accept(state(0)), false, 'قدیمی‌تر پذیرفته نشود');
  assert.equal(gate.accept(state(2)), true);
  // در تصمیم «ب» سرور داور است: وضعیت از میزبان هم پذیرفته نمی‌شود
  assert.equal(gate.accept(state(99, 'host1')), false, 'از غیرِ سرور پذیرفته نشود');
  assert.equal(gate.accept(state(99, 'p-fake')), false, 'از کلاینت پذیرفته نشود');
  assert.equal(gate.revision, 2);
});

test('PROTOCOL_VERSION موجود و عددی است', () => {
  assert.equal(typeof PROTOCOL_VERSION, 'number');
});
