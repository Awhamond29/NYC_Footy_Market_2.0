'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/providers';
import { Avatar, RatingLine } from '@/components/ui';
import { firstName } from '@/lib/format';

export function Stars({ value, size = 14 }) {
  const full = Math.round(value);
  return (
    <span className="stars" style={{ fontSize: size }} aria-label={`${value} out of 5 stars`}>
      {'★★★★★'.slice(0, full)}
      <span className="off">{'★★★★★'.slice(full)}</span>
    </span>
  );
}

function reviewDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Full review section for a player's popup: list + leave/edit your review.
export function ReviewsSection({ player, stats, onChanged }) {
  const { user, toast } = useAuth();
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState(null);
  const [canReview, setCanReview] = useState(false);
  const [writing, setWriting] = useState(false);
  const isMe = Boolean(user) && player.id === user.id;

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('reviews')
      .select('*, reviewer:profiles!reviews_reviewer_id_fkey(id, name, photo_url)')
      .eq('player_id', player.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setReviews(data ?? []);
  }, [player.id]);

  useEffect(() => {
    if (isMe || !user) return;
    supabase.rpc('can_review', { target: player.id }).then(({ data }) => setCanReview(Boolean(data)));
  }, [player.id, isMe, user]);

  useEffect(() => {
    if (open && reviews === null) load();
  }, [open, reviews, load]);

  const mine = user ? reviews?.find((r) => r.reviewer_id === user.id) : undefined;
  const count = stats?.review_count ?? 0;

  return (
    <div className="reviews">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <RatingLine stats={stats} />
        <div className="row" style={{ gap: 8 }}>
          {count > 0 ? (
            <button className="btn ghost sm" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? 'Hide reviews' : `See reviews (${count})`}
            </button>
          ) : null}
          {canReview && !writing ? (
            <button
              className="btn ghost sm"
              type="button"
              onClick={async () => {
                if (reviews === null) await load();
                setOpen(true);
                setWriting(true);
              }}
            >
              {mine ? 'Edit my review' : 'Leave a review'}
            </button>
          ) : null}
        </div>
      </div>

      {user && !isMe && !canReview && count === 0 ? (
        <p className="note" style={{ margin: 0 }}>
          You can review {firstName(player.name)} after you&apos;ve messaged each other.
        </p>
      ) : null}

      {writing ? (
        <ReviewForm
          player={player}
          existing={mine}
          onCancel={() => setWriting(false)}
          onSaved={async (msg) => {
            setWriting(false);
            toast(msg);
            await load();
            onChanged?.();
          }}
        />
      ) : null}

      {open && reviews === null ? <p className="note">Loading reviews…</p> : null}
      {open && reviews ? (
        <ul className="reviewlist">
          {reviews.map((r) => (
            <li key={r.id}>
              <div className="row" style={{ gap: 10 }}>
                <Avatar name={r.reviewer?.name} photo={r.reviewer?.photo_url} size="xs" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 14 }}>{r.reviewer?.name || 'A player'}</strong>
                    <Stars value={r.rating} />
                    <span className={`tagpill ${r.showed_up ? 'ok' : 'bad'}`}>{r.showed_up ? 'Showed up' : 'No-show'}</span>
                  </div>
                  <div className="meta">{reviewDate(r.created_at)}</div>
                </div>
              </div>
              {r.comment ? <p style={{ margin: '6px 0 0', fontSize: 14 }}>{r.comment}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ReviewForm({ player, existing, onCancel, onSaved }) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [showedUp, setShowedUp] = useState(existing?.showed_up ?? true);
  const [comment, setComment] = useState(existing?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (e) => {
    e.preventDefault();
    if (!rating) {
      setError('Pick a star rating.');
      return;
    }
    setBusy(true);
    setError('');
    const fields = { rating, showed_up: showedUp, comment: comment.trim() };
    const { error } = existing
      ? await supabase.from('reviews').update(fields).eq('id', existing.id)
      : await supabase.from('reviews').insert({ player_id: player.id, ...fields });
    setBusy(false);
    if (error) setError('Couldn’t save your review. You can only review players you’ve messaged with.');
    else onSaved(existing ? 'Review updated' : 'Review posted');
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.from('reviews').delete().eq('id', existing.id);
    setBusy(false);
    if (error) setError('Couldn’t delete it. Try again.');
    else onSaved('Review deleted');
  };

  return (
    <form className="reviewform" onSubmit={save} noValidate>
      <span className="lbl">Your review of {firstName(player.name)}</span>
      <div className="starpick" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            className={n <= rating ? 'on' : ''}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </div>
      <div className="seg" role="group" aria-label="Did they show up?">
        <button type="button" aria-pressed={showedUp} onClick={() => setShowedUp(true)}>
          Showed up
        </button>
        <button type="button" aria-pressed={!showedUp} onClick={() => setShowedUp(false)}>
          No-show
        </button>
      </div>
      <textarea
        id="review-comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={300}
        placeholder="How did they play? Punctual, good teammate, big saves?"
      />
      {error ? <p className="error">{error}</p> : null}
      <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Saving…' : existing ? 'Update review' : 'Post review'}
        </button>
        <button className="link" type="button" onClick={onCancel}>
          Cancel
        </button>
        {existing ? (
          <button className="link" type="button" onClick={remove} style={{ marginLeft: 'auto' }}>
            Delete review
          </button>
        ) : null}
      </div>
    </form>
  );
}
