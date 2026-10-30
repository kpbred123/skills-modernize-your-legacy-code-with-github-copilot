'use strict';

const readline = require('node:readline');

const INITIAL_BALANCE_CENTS = 100_000;
const MAX_AMOUNT_CENTS = 99_999_999;

function parseAmount(input) {
  const value = input.trim();
  const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(value);

  if (!match) {
    throw new Error('Enter an amount from 0.00 to 999999.99, with up to two decimal places.');
  }

  const whole = Number(match[1]);
  const fraction = Number((match[2] || '').padEnd(2, '0'));
  const amountCents = whole * 100 + fraction;

  if (amountCents > MAX_AMOUNT_CENTS) {
    throw new Error('The amount cannot exceed 999999.99.');
  }

  return amountCents;
}

function formatAmount(amountCents) {
  return `${Math.floor(amountCents / 100)}.${String(amountCents % 100).padStart(2, '0')}`;
}

function createAccount(initialBalanceCents = INITIAL_BALANCE_CENTS) {
  if (!Number.isSafeInteger(initialBalanceCents)
      || initialBalanceCents < 0
      || initialBalanceCents > MAX_AMOUNT_CENTS) {
    throw new RangeError('The initial balance must be between 0.00 and 999999.99.');
  }

  let balanceCents = initialBalanceCents;

  return {
    getBalance() {
      return balanceCents;
    },
    credit(amountCents) {
      validateAmountCents(amountCents);
      if (balanceCents + amountCents > MAX_AMOUNT_CENTS) {
        throw new RangeError('The resulting balance cannot exceed 999999.99.');
      }
      balanceCents += amountCents;
      return balanceCents;
    },
    debit(amountCents) {
      validateAmountCents(amountCents);
      if (balanceCents < amountCents) {
        return { accepted: false, balanceCents };
      }
      balanceCents -= amountCents;
      return { accepted: true, balanceCents };
    },
  };
}

function validateAmountCents(amountCents) {
  if (!Number.isSafeInteger(amountCents)
      || amountCents < 0
      || amountCents > MAX_AMOUNT_CENTS) {
    throw new RangeError('The amount must be between 0.00 and 999999.99.');
  }
}

async function runApplication(input = process.stdin, output = process.stdout) {
  const account = createAccount();
  const terminal = readline.createInterface({ input, output });
  const lines = terminal[Symbol.asyncIterator]();

  async function prompt(message) {
    output.write(message);
    const result = await lines.next();
    return result.done ? null : result.value;
  }

  try {
    let running = true;
    while (running) {
      output.write('--------------------------------\n');
      output.write('Account Management System\n');
      output.write('1. View Balance\n');
      output.write('2. Credit Account\n');
      output.write('3. Debit Account\n');
      output.write('4. Exit\n');
      output.write('--------------------------------\n');

      const choice = await prompt('Enter your choice (1-4): ');
      if (choice === null) {
        break;
      }

      switch (choice.trim()) {
        case '1':
          output.write(`Current balance: ${formatAmount(account.getBalance())}\n`);
          break;
        case '2':
        case '3': {
          const action = choice.trim() === '2' ? 'credit' : 'debit';
          const amountInput = await prompt(`Enter ${action} amount: `);
          if (amountInput === null) {
            running = false;
            break;
          }

          let amountCents;
          try {
            amountCents = parseAmount(amountInput);
          } catch (error) {
            output.write(`${error.message}\n`);
            break;
          }

          if (action === 'credit') {
            try {
              const balanceCents = account.credit(amountCents);
              output.write(`Amount credited. New balance: ${formatAmount(balanceCents)}\n`);
            } catch (error) {
              output.write(`${error.message}\n`);
            }
          } else {
            const result = account.debit(amountCents);
            if (result.accepted) {
              output.write(`Amount debited. New balance: ${formatAmount(result.balanceCents)}\n`);
            } else {
              output.write('Insufficient funds for this debit.\n');
            }
          }
          break;
        }
        case '4':
          running = false;
          break;
        default:
          output.write('Invalid choice, please select 1-4.\n');
      }
    }

    output.write('Exiting the program. Goodbye!\n');
  } finally {
    terminal.close();
  }
}

if (require.main === module) {
  runApplication().catch((error) => {
    console.error('Unable to run the accounting application:', error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  createAccount,
  formatAmount,
  parseAmount,
  runApplication,
};
