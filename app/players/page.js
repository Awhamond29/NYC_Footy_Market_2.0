'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/providers';
import RequireAuth from '@/components/RequireAuth';
import { Avatar, CopyLine, Days, Modal, PlayerCard, PosBadge, Price } from '@/components/ui';
import { ReviewsSection } from '@/components/Reviews';
import { firstName } from '@/lib/format';

const FILTERS = [
  { key: 'all', label: 'All Players' },
  { key: 'GK', label: 'Goalkeepers' },
  { key: 'OF', label: 'Outfielders' },
];

export default function PlayersPage() {
  return (
    <RequireAuth needsProfile allowGuest>
      <Players />
    </RequireAuth>
  );
}

function Players() {
  const { user } = useAuth();
  const [players, setPlayers] = useState(null);
  const [error, setError] = useState('');
  const [pos, setPos] = useState('all');
  const [sort, setSort] = useState('desc');
  const [open, setOpen] = useState(null);
  const [stats, setStats] = useState({});

  const loadStats = useCallback(async () => {
    // Ratings are optional: if the reviews table isn't set up yet, cards just show no rating.
    const { data } = await supabase.from('review_stats').select('*');
    setStats(Object.fromEntries((data ?? []).map((s) => [s.player_id, s])));
  }, []);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('profiles').select('*').eq('listed', true).limit(500);
    if (error) setError('Couldn’t load players. Check your connection and refresh.');
    else setPlayers(data);
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(() => {
    const list = (players ?? []).filter((p) => pos === 'all' || p.position === pos);
    if (sort === 'rating') {
      // Best average first; players with more reviews win ties; unrated players go last.
      const score = (p) => stats[p.id] ? Number(stats[p.id].avg_rating) * 1000 + stats[p.id].review_count : -1;
      return list.sort((a, b) => score(b) - score(a));
    }
    return list.sort((a, b) => (sort === 'desc' ? b.price - a.price : a.price - b.price));
  }, [players, pos, sort, stats]);

  return (
    <section>
      <h1>Players for hire</h1>
      <p className="sub">
        Keepers and outfielders around the five boroughs, ready to fill a spot. Tap a player to message them or
        grab their number. Pay them directly by Venmo or cash.
      </p>

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Position">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" aria-pressed={pos === f.key} onClick={() => setPos(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <select className="auto" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort players">
          <option value="desc">Price: most expensive</option>
          <option value="asc">Price: least expensive</option>
          <option value="rating">Top rated</option>
        </select>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {players === null && !error ? <div className="empty">Loading players…</div> : null}
      {players && shown.length === 0 ? (
        <div className="empty">
          <p>No {pos === 'GK' ? 'goalkeepers' : pos === 'OF' ? 'outfielders' : 'players'} listed yet.</p>
          <Link href="/profile" className="btn">
            List yourself
          </Link>
        </div>
      ) : null}

      <div className="grid">
        {shown.map((p) => (
          <PlayerCard key={p.id} p={p} stats={stats[p.id]} isMe={Boolean(user) && p.id === user.id} onClick={() => setOpen(p)} />
        ))}
      </div>

      {open ? (
        <PlayerModal p={open} stats={stats[open.id]} isMe={Boolean(user) && open.id === user.id} onClose={() => setOpen(null)} onReviewed={loadStats} />
      ) : null}
    </section>
  );
}

function PlayerModal({ p, stats, isMe, onClose, onReviewed }) {
  const router = useRouter();
  const { toast, profile, user, ensureSignedIn } = useAuth();
  const [contact, setContact] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!user) return; // contact details are for signed-in members only
    supabase
      .from('public_contacts')
      .select('phone, venmo')
      .eq('user_id', p.id)
      .maybeSingle()
      .then(({ data }) => setContact(data ?? {}));
  }, [p.id, user]);

  const message = async () => {
    setError('');
    if (!ensureSignedIn(`message ${firstName(p.name)}`)) return;
    if (!profile?.is_adult) {
      router.push('/profile');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc('start_conversation', { other: p.id });
    setBusy(false);
    if (error) setError(error.message);
    else router.push(`/chats/${data}`);
  };

  const block = async () => {
    const { error } = await supabase.from('blocks').insert({ blocked: p.id });
    if (error && error.code !== '23505') setError('Couldn’t block. Try again.');
    else {
      toast(`Blocked ${firstName(p.name)}. They can’t message you.`);
      onClose();
    }
  };

  const report = async () => {
    if (!reason.trim()) {
      setError('Say briefly what happened.');
      return;
    }
    const { error } = await supabase.from('reports').insert({ reported: p.id, reason: reason.trim() });
    if (error) setError('Couldn’t send the report. Try again.');
    else {
      toast('Report sent. Thanks for flagging it.');
      onClose();
    }
  };

  const phone = contact?.phone;
  const venmo = contact?.venmo;
  const venmoHandle = venmo?.replace(/^@/, '');

  return (
    <Modal onClose={onClose} label={p.name}>
      <div className="row">
        <Avatar name={p.name} photo={p.photo_url} size="lg" />
        <div>
          <h2>{p.name}</h2>
          <div style={{ marginTop: 6 }}>
            <PosBadge pos={p.position} />
          </div>
          <div className="meta" style={{ marginTop: 6 }}>
            {p.area}
          </div>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Price value={p.price} />
        <Days days={p.days} short={false} />
      </div>
      <ReviewsSection player={p} stats={stats} onChanged={onReviewed} />
      {p.bio ? <p style={{ margin: 0 }}>{p.bio}</p> : null}
      <dl className="facts">
        <dt>Plays</dt>
        <dd>{p.role || '—'}</dd>
        <dt>College</dt>
        <dd>{p.college || '—'}</dd>
        <dt>Experience</dt>
        <dd>{p.experience || '—'}</dd>
      </dl>

      {phone ? <CopyLine label="Text / call" value={phone} href={`sms:${phone.replace(/[^\d+]/g, '')}`} onCopied={toast} /> : null}
      {venmo ? (
        <CopyLine label="Venmo" value={venmo} href={`https://venmo.com/u/${encodeURIComponent(venmoHandle)}`} onCopied={toast} />
      ) : null}
      {!user ? (
        <p className="note">
          Create a free account to message {firstName(p.name)} and see their number and Venmo if they share them.
        </p>
      ) : null}
      {contact && !phone && !venmo && !isMe ? (
        <p className="note">This player keeps their number and Venmo private. Message them here and sort payment in the chat.</p>
      ) : null}

      {isMe ? (
        <Link href="/profile" className="btn dark">
          Edit my profile
        </Link>
      ) : (
        <button className="btn" type="button" onClick={message} disabled={busy}>
          {busy ? 'Opening chat…' : `Message ${firstName(p.name)}`}
        </button>
      )}
      {error ? <p className="error">{error}</p> : null}

      {!isMe && user ? (
        reporting ? (
          <div className="field">
            <label htmlFor="reason">What happened?</label>
            <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
            <div className="row">
              <button className="btn dark" type="button" onClick={report}>
                Send report
              </button>
              <button className="link" type="button" onClick={() => setReporting(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="row" style={{ gap: 16 }}>
            <button className="link" type="button" onClick={() => setReporting(true)}>
              Report
            </button>
            <button className="link" type="button" onClick={block}>
              Block
            </button>
          </div>
        )
      ) : null}
    </Modal>
  );
}
