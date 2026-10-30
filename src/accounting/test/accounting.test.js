'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const appPath = path.join(__dirname, '..', 'index.js');
const { createAccount, formatAmount, parseAmount } = require('../index');

function runApp(input) {
  const result = spawnSync(process.execPath, [appPath], {
    encoding: 'utf8',
    input,
  });

  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

function balanceDisplays(output) {
  return [...output.matchAll(/Current balance: ([\d.]+)/g)].map((match) => match[1]);
}

test('unit: amounts parse and format precisely to cents', () => {
  assert.equal(parseAmount('25.75'), 2575);
  assert.equal(parseAmount('200'), 20000);
  assert.equal(formatAmount(102575), '1025.75');
});

test('unit: account credits, accepts exact-balance debits, and rejects overdrafts unchanged', () => {
  const account = createAccount();
  assert.equal(account.getBalance(), 100000);
  assert.equal(account.credit(parseAmount('200.50')), 120050);
  assert.deepEqual(account.debit(parseAmount('1200.51')), {
    accepted: false,
    balanceCents: 120050,
  });
  assert.deepEqual(account.debit(parseAmount('1200.50')), {
    accepted: true,
    balanceCents: 0,
  });
});

test('COBOL-TC-001: initialize account balance', () => {
  const output = runApp('1\n4\n');
  assert.deepEqual(balanceDisplays(output), ['1000.00']);
});

test('COBOL-TC-002: view balance without changing it', () => {
  const output = runApp('1\n1\n4\n');
  assert.deepEqual(balanceDisplays(output), ['1000.00', '1000.00']);
});

test('COBOL-TC-003: credit a whole-number amount', () => {
  const output = runApp('2\n200\n1\n4\n');
  assert.match(output, /Amount credited\. New balance: 1200\.00/);
  assert.deepEqual(balanceDisplays(output), ['1200.00']);
});

test('COBOL-TC-004: credit an amount with cents', () => {
  const output = runApp('2\n25.75\n1\n4\n');
  assert.match(output, /Amount credited\. New balance: 1025\.75/);
  assert.deepEqual(balanceDisplays(output), ['1025.75']);
});

test('COBOL-TC-005: apply multiple credits to the shared balance', () => {
  const output = runApp('2\n100\n2\n50\n1\n4\n');
  assert.match(output, /Amount credited\. New balance: 1100\.00/);
  assert.match(output, /Amount credited\. New balance: 1150\.00/);
  assert.deepEqual(balanceDisplays(output), ['1150.00']);
});

test('COBOL-TC-006: debit less than the available balance', () => {
  const output = runApp('3\n250\n1\n4\n');
  assert.match(output, /Amount debited\. New balance: 750\.00/);
  assert.deepEqual(balanceDisplays(output), ['750.00']);
});

test('COBOL-TC-007: debit the exact available balance', () => {
  const output = runApp('3\n1000\n1\n4\n');
  assert.match(output, /Amount debited\. New balance: 0\.00/);
  assert.deepEqual(balanceDisplays(output), ['0.00']);
});

test('COBOL-TC-008: reject a debit greater than the available balance unchanged', () => {
  const output = runApp('3\n1000.01\n1\n4\n');
  assert.match(output, /Insufficient funds for this debit\./);
  assert.deepEqual(balanceDisplays(output), ['1000.00']);
});

test('COBOL-TC-009: debit zero', () => {
  const output = runApp('3\n0\n1\n4\n');
  assert.match(output, /Amount debited\. New balance: 1000\.00/);
  assert.deepEqual(balanceDisplays(output), ['1000.00']);
});

test('COBOL-TC-010: credit zero', () => {
  const output = runApp('2\n0\n1\n4\n');
  assert.match(output, /Amount credited\. New balance: 1000\.00/);
  assert.deepEqual(balanceDisplays(output), ['1000.00']);
});

test('COBOL-TC-011: reject an invalid numeric menu choice and continue', () => {
  const output = runApp('5\n1\n4\n');
  assert.match(output, /Invalid choice, please select 1-4\./);
  assert.deepEqual(balanceDisplays(output), ['1000.00']);
  assert.ok(output.indexOf('Invalid choice') < output.indexOf('Current balance'));
});

test('COBOL-TC-012: exit the application', () => {
  const output = runApp('4\n');
  assert.match(output, /Exiting the program\. Goodbye!/);
  assert.equal((output.match(/Account Management System/g) || []).length, 1);
});

test('COBOL-TC-013: preserve updates across mixed operations in one run', () => {
  const output = runApp('2\n200\n3\n50\n1\n4\n');
  assert.match(output, /Amount credited\. New balance: 1200\.00/);
  assert.match(output, /Amount debited\. New balance: 1150\.00/);
  assert.deepEqual(balanceDisplays(output), ['1150.00']);
});

test('COBOL-TC-014: reset the balance between application runs', () => {
  const firstRun = runApp('2\n200\n4\n');
  const secondRun = runApp('1\n4\n');

  assert.match(firstRun, /Amount credited\. New balance: 1200\.00/);
  assert.deepEqual(balanceDisplays(secondRun), ['1000.00']);
});
