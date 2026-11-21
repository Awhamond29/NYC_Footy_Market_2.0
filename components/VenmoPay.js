'use client';

import { useState } from 'react';
import { firstName } from '@/lib/format';

// Venmo's pay link opens the Venmo app on phones (or venmo.com on a computer)
// with the person, amount and note already filled in. The payer still taps Pay.
export function venmoPayUrl(handle, amount, note) {
  const user = String(handle || '').trim().replace(/^@/, '');
  const q = new URLSearchParams({ txn: 'pay' });
  if (amount > 0) q.set('amount', Number(amount).toFixed(2));
  if (note) q.set('note', note);
  return `https://venmo.com/${encodeURIComponent(user)}?${q.toString()}`;
}

export function payNote({ position, gameTitle } = {}) {
  const role = position === 'GK' ? 'Keeper' : position === 'OF' ? 'Outfield' : '';
  return ['NYC Footy Market', gameTitle || role].filter(Boolean).join(' - ');
}

export default function VenmoPay({ handle, name, amount: start = 0, note, compact = false }) {
  const [amount, setAmount] = useState(start > 0 ? String(start) : '');
  if (!handle) return null;
  const value = Math.min(500, Math.max(0, Math.round(Number(amount) || 0)));
  const who = firstName(name) || 'them';

  return (
    <div className={`venmopay ${compact ? 'compact' : ''}`}>
      <label className="amount" aria-label="Amount in dollars">
        <span>$</span>
        <input
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
          placeholder="0"
        />
      </label>
      <a className="btn venmo" href={venmoPayUrl(handle, value, note)} target="_blank" rel="noopener noreferrer">
        {value > 0 ? `Pay ${who} $${value} on Venmo` : `Pay ${who} on Venmo`}
      </a>
    </div>
  );
}
