'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/providers';
import { Avatar, RatingLine } from '@/components/ui';
import { Stars } from '@/components/Reviews';

function reviewDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Reviews shown under a league's details, plus leave/edit your own.
export default function LeagueReviews({ league, stats, onChanged }) {
  const { user, toast } = useAuth();
  const [reviews, setReviews] = useState(null);
  const [canReview, setCanReview] = useState(false);
  const [writing, setWriting] = useState(false);
  const isManager = Boolean(user) && league.manager_id === user.id;

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('league_reviews')
      .select('*, reviewer:profiles!league_reviews_reviewer_id_fkey(id, name, photo_url)')
      .eq('league_id', league.id)
      .order('created_at', { ascending: false })
      .limit(100);
    setReviews(data ?? []);
  }, [league.id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user || isManager) return;
    supabase.rpc('can_review_league', { league: league.id }).then(({ data }) => setCanReview(Boolean(data)));
  }, [league.id, user, isManager]);

  const mine = user ? reviews?.find((r) => r.reviewer_id === user.id) : undefined;

  return (
    <div className="reviews">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <span className="lbl">Reviews</span>
        <RatingLine stats={stats} />
      </div>

      {canReview && !writing ? (
        <button className="btn ghost sm" type="button" onClick={() => setWriting(true)} style={{ alignSelf: 'flex-start' }}>
          {mine ? 'Edit my review' : '★ Leave a review'}
        </button>
      ) : null}
      {user && !isManager && !canReview ? (
        <p className="note" style={{ margin: 0 }}>
          Played in this league? Message the manager here and you can leave a review once they reply.
        </p>
      ) : null}

      {writing ? (
        <LeagueReviewForm
          league={league}
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

      {reviews === null ? <p className="note">Loading reviews…</p> : null}
      {reviews && reviews.length > 0 ? (
        <ul className="reviewlist">
          {reviews.map((r) => (
            <li key={r.id}>
              <div className="row" style={{ gap: 10 }}>
                <Avatar name={r.reviewer?.name || 'Team'} photo={r.reviewer?.photo_url} size="xs" />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 14 }}>{r.reviewer?.name || 'A team'}</strong>
                    <Stars value={r.rating} />
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

function LeagueReviewForm({ league, existing, onCancel, onSaved }) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
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
    const fields = { rating, comment: comment.trim() };
    const { error } = existing
      ? await supabase.from('league_reviews').update(fields).eq('id', existing.id)
      : await supabase.from('league_reviews').insert({ league_id: league.id, ...fields });
    setBusy(false);
    if (error) setError('Couldn’t save your review. Try again.');
    else onSaved(existing ? 'Review updated' : 'Review posted');
  };

  const remove = async () => {
    setBusy(true);
    const { error } = await supabase.from('league_reviews').delete().eq('id', existing.id);
    setBusy(false);
    if (error) setError('Couldn’t delete it. Try again.');
    else onSaved('Review deleted');
  };

  return (
    <form className="reviewform" onSubmit={save} noValidate>
      <span className="lbl">Your review of {league.name}</span>
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
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={300}
        placeholder="Refs, fields, organization, competition level, value for money?"
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
