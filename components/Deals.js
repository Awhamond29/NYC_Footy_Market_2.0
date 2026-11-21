'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/providers';
import { Modal } from '@/components/ui';
import VenmoPay, { payNote } from '@/components/VenmoPay';
import { firstName } from '@/lib/format';

const POS = { GK: 'Keeper', OF: 'Outfield' };
const SHOW_CONFIRMED_FOR = 7 * 24 * 3600 * 1000; // keep the "confirmed" bar up for a week

// The latest deal in a chat, kept live. `available` is false until 007_deals.sql has been run.
export function useDeal(convoId, disabled) {
  const [deal, setDeal] = useState(null);
  const [available, setAvailable] = useState(false);

  const reload = useCallback(async () => {
    if (disabled) return;
    const { data, error } = await supabase
      .from('deals')
      .select('*')
      .eq('conversation_id', convoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setAvailable(!error);
    setDeal(error ? null : data ?? null);
  }, [convoId, disabled]);

  useEffect(() => {
    if (disabled) return;
    reload();
    const channel = supabase
      .channel(`deals-${convoId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals', filter: `conversation_id=eq.${convoId}` }, () =>
        reload()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [convoId, disabled, reload]);

  return { deal, available, pending: deal?.status === 'pending', reload };
}

function summary(deal, me, other) {
  const who = deal.player_id === me ? 'You play' : `${firstName(other?.name) || 'They'} plays`;
  return `${who} ${POS[deal.position] || ''} · ${deal.amount > 0 ? `$${deal.amount}` : 'free'}`;
}

export function DealForm({ convo, other, post, onClose, onDone }) {
  const { user, profile } = useAuth();
  const people = { them: other, me: profile };
  const [who, setWho] = useState('them');
  const [position, setPosition] = useState(other?.position || 'OF');
  const [amount, setAmount] = useState(String(other?.price ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pick = (w) => {
    setWho(w);
    setPosition(people[w]?.position || 'OF');
    setAmount(String(people[w]?.price ?? ''));
  };

  const value = Math.min(500, Math.max(0, Math.round(Number(amount) || 0)));
  const player = people[who];

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const playerId = who === 'me' ? user.id : other.id;
    const payerId = who === 'me' ? other.id : user.id;
    const { error } = await supabase.from('deals').insert({
      conversation_id: convo.id,
      player_id: playerId,
      payer_id: payerId,
      position,
      amount: value,
      game_id: convo.game_id ?? null,
    });
    if (error) {
      setBusy(false);
      setError(
        error.code === '23505'
          ? 'There’s already a deal waiting to be confirmed in this chat.'
          : 'Couldn’t log the deal. Check your connection and try again.'
      );
      return;
    }
    const playerName = who === 'me' ? 'I' : firstName(other.name);
    await post(
      `✅ Deal: ${playerName} ${who === 'me' ? 'play' : 'plays'} ${POS[position]} for ${value > 0 ? `$${value}` : 'free'}` +
        `${convo.game?.title ? ` (${convo.game.title})` : ''}. ` +
        `${firstName(other.name)}, tap Confirm at the top of this chat to lock it in.`
    );
    onDone();
  };

  return (
    <Modal onClose={onClose} label="Log a deal">
      <h2>Lock in the deal</h2>
      <p className="note" style={{ marginTop: -6 }}>
        Agreed on a game? Log it here and {firstName(other?.name)} confirms. Payment still happens on Venmo or in cash.
      </p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field">
          <span className="lbl">Who&apos;s playing?</span>
          <div className="seg">
            <button type="button" aria-pressed={who === 'them'} onClick={() => pick('them')}>
              {firstName(other?.name) || 'Them'}
            </button>
            <button type="button" aria-pressed={who === 'me'} onClick={() => pick('me')}>
              Me
            </button>
          </div>
        </div>
        <div className="field">
          <span className="lbl">Position</span>
          <div className="seg">
            {Object.entries(POS).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={position === k} onClick={() => setPosition(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="deal-amount">Price for the game</label>
          <div className="venmopay">
            <label className="amount">
              <span>$</span>
              <input
                id="deal-amount"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                placeholder="0"
              />
            </label>
          </div>
        </div>
        <button className="btn big" type="submit" disabled={busy}>
          {busy
            ? 'Logging…'
            : `Log deal: ${who === 'me' ? 'I play' : `${firstName(player?.name)} plays`} for ${value > 0 ? `$${value}` : 'free'}`}
        </button>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </Modal>
  );
}

export function DealBanner({ deal, me, other, game, post, reload, venmo, onReview }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const name = firstName(other?.name) || 'them';

  if (deal.status === 'confirmed' && Date.now() - new Date(deal.confirmed_at).getTime() > SHOW_CONFIRMED_FOR) return null;

  const confirm = async () => {
    setBusy(true);
    setError('');
    const { error } = await supabase.rpc('confirm_deal', { deal: deal.id });
    if (error) {
      setError('Couldn’t confirm. Try again.');
      setBusy(false);
      return;
    }
    await post('✅ Confirmed. See you on the pitch!');
    await reload();
    setBusy(false);
  };

  const cancel = async () => {
    setBusy(true);
    setError('');
    const { error } = await supabase.from('deals').delete().eq('id', deal.id);
    if (error) {
      setError('Couldn’t cancel. Try again.');
      setBusy(false);
      return;
    }
    await post('Deal cancelled.');
    await reload();
    setBusy(false);
  };

  if (deal.status === 'pending') {
    const mine = deal.created_by === me;
    return (
      <div className="dealbar pending">
        <div className="dealtext">
          <b>{mine ? `Waiting for ${name} to confirm` : `${name} logged a deal`}</b>
          <span>{summary(deal, me, other)}</span>
        </div>
        {mine ? (
          <button className="btn ghost sm" type="button" onClick={cancel} disabled={busy}>
            Cancel
          </button>
        ) : (
          <button className="btn sm" type="button" onClick={confirm} disabled={busy}>
            {busy ? 'Confirming…' : 'Confirm ✅'}
          </button>
        )}
        {error ? <p className="error" style={{ flexBasis: '100%', margin: 0 }}>{error}</p> : null}
      </div>
    );
  }

  const iPay = deal.payer_id === me;
  return (
    <div className="dealbar done">
      <div className="dealtext">
        <b>✅ Deal confirmed</b>
        <span>{summary(deal, me, other)}</span>
      </div>
      {onReview ? (
        <button className="btn ghost sm" type="button" onClick={onReview}>
          ★ Review
        </button>
      ) : null}
      {iPay && deal.amount > 0 ? (
        venmo ? (
          <div style={{ flexBasis: '100%' }}>
            <VenmoPay
              key={deal.id}
              handle={venmo}
              name={other?.name}
              amount={deal.amount}
              note={payNote({ position: deal.position, gameTitle: game?.title })}
            />
          </div>
        ) : (
          <p className="note" style={{ flexBasis: '100%', margin: 0 }}>
            Pay {name} ${deal.amount} in cash, or ask for their Venmo here.
          </p>
        )
      ) : null}
      {!iPay && deal.amount > 0 ? (
        <p className="note" style={{ flexBasis: '100%', margin: 0 }}>
          {name} pays you ${deal.amount} by Venmo or cash.
        </p>
      ) : null}
    </div>
  );
}
