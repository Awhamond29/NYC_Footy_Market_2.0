'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/providers';
import RequireAuth from '@/components/RequireAuth';
import { Modal } from '@/components/ui';
import { LEVELS, firstName, gameDate, soonLabel } from '@/lib/format';

export default function GamesPage() {
  return (
    <RequireAuth needsProfile>
      <Games />
    </RequireAuth>
  );
}

function Games() {
  const { user, profile, toast } = useAuth();
  const router = useRouter();
  const [games, setGames] = useState(null);
  const [error, setError] = useState('');
  const [posting, setPosting] = useState(false);
  const [joining, setJoining] = useState(null);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 2 * 36e5).toISOString();
    const { data, error } = await supabase
      .from('games')
      .select('*, poster:profiles!games_poster_id_fkey(id, name)')
      .gte('kickoff', since)
      .order('kickoff', { ascending: true })
      .limit(200);
    if (error) setError('Couldn’t load games. Check your connection and refresh.');
    else setGames(data);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('games-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const join = async (g) => {
    if (!profile?.is_adult) {
      router.push('/profile');
      return;
    }
    setJoining(g.id);
    const { data, error } = await supabase.rpc('start_conversation', { other: g.poster_id, game: g.id });
    setJoining(null);
    if (error) {
      toast(error.message);
      return;
    }
    try {
      sessionStorage.setItem(
        `draft:${data}`,
        `Hey ${firstName(g.poster?.name)}, saw you need players for ${g.title} at ${g.field}. Can I join?`
      );
    } catch {}
    router.push(`/chats/${data}`);
  };

  const remove = async (g) => {
    const { error } = await supabase.from('games').delete().eq('id', g.id);
    if (error) toast('Couldn’t remove it. Try again.');
    else {
      toast('Post removed');
      load();
    }
  };

  return (
    <section>
      <div className="toolbar" style={{ marginTop: 0 }}>
        <div>
          <h1>Short on players</h1>
          <p className="sub">
            Teams that need bodies, soonest kickoff first. Looking for a game? Hit up the poster and ask to join.
          </p>
        </div>
        <button
          className="btn"
          type="button"
          onClick={() => (profile?.is_adult ? setPosting(true) : router.push('/profile'))}
        >
          Post a game
        </button>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {games === null && !error ? <div className="empty">Loading games…</div> : null}
      {games && games.length === 0 ? (
        <div className="empty">No open games right now. Short for your next one? Post it.</div>
      ) : null}

      <div className="games">
        {(games ?? []).map((g) => {
          const f = gameDate(g.kickoff);
          const soon = soonLabel(g.kickoff);
          const mine = g.poster_id === user.id;
          return (
            <article className="game" key={g.id}>
              <div className="when">
                <span className="d">
                  {f.dow} {f.mon}
                </span>
                <span className="n">{f.day}</span>
                <span className="t">{f.time}</span>
              </div>
              <div className="gbody">
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <span className="gtitle">{g.title}</span>
                  {soon ? <span className="soon">{soon}</span> : null}
                  {mine ? <span className="you">Your post</span> : null}
                </div>
                <div className="meta">
                  {g.field} · {g.level} · posted by {g.poster?.name || 'a player'}
                </div>
                <div className="needs">
                  {g.need_gk ? <span className="pos gk">Need {g.need_gk} GK</span> : null}
                  {g.need_of ? <span className="pos of">Need {g.need_of} outfield</span> : null}
                </div>
                {g.note ? <p style={{ margin: 0, fontSize: 14 }}>{g.note}</p> : null}
              </div>
              <div className="gact">
                {mine ? (
                  <button className="btn ghost" type="button" onClick={() => remove(g)}>
                    Remove
                  </button>
                ) : (
                  <button className="btn" type="button" onClick={() => join(g)} disabled={joining === g.id}>
                    {joining === g.id ? 'Opening…' : 'Ask to join'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {posting ? (
        <PostGame
          onClose={() => setPosting(false)}
          onPosted={() => {
            setPosting(false);
            toast('Game posted');
            load();
          }}
        />
      ) : null}
    </section>
  );
}

function defaultKickoff() {
  const t = new Date(Date.now() + 864e5);
  t.setHours(20, 0, 0, 0);
  return new Date(t - t.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
}

function PostGame({ onClose, onPosted }) {
  const [f, setF] = useState({ title: '', field: '', kickoff: defaultKickoff(), need_gk: 0, need_of: 1, level: 'Intermediate', note: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const at = new Date(f.kickoff);
    const gk = Number(f.need_gk) || 0;
    const of = Number(f.need_of) || 0;
    const err = !f.title.trim()
      ? 'Add a name for the game.'
      : !f.field.trim()
        ? 'Add the field or area.'
        : !(at.getTime() > Date.now())
          ? 'Pick a kickoff time in the future.'
          : gk + of === 0
            ? 'Say how many players you need.'
            : '';
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    const { error } = await supabase.from('games').insert({
      title: f.title.trim(),
      field: f.field.trim(),
      kickoff: at.toISOString(),
      need_gk: gk,
      need_of: of,
      level: f.level,
      note: f.note.trim(),
    });
    setBusy(false);
    if (error) setError('Couldn’t post the game. Check the details and try again.');
    else onPosted();
  };

  return (
    <Modal onClose={onClose} label="Post a game">
      <h2>Post a game</h2>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }} noValidate>
        <div className="field">
          <label htmlFor="gTitle">Game</label>
          <input id="gTitle" value={f.title} onChange={set('title')} placeholder="e.g. 7v7 league match" maxLength={80} />
        </div>
        <div className="field">
          <label htmlFor="gField">Field / area</label>
          <input id="gField" value={f.field} onChange={set('field')} placeholder="e.g. Pier 40, Hudson River Park" maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor="gAt">Kickoff</label>
          <input id="gAt" type="datetime-local" value={f.kickoff} onChange={set('kickoff')} />
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="gGK">Keepers needed</label>
            <input id="gGK" type="number" min="0" max="5" value={f.need_gk} onChange={set('need_gk')} />
          </div>
          <div className="field">
            <label htmlFor="gOF">Outfielders needed</label>
            <input id="gOF" type="number" min="0" max="11" value={f.need_of} onChange={set('need_of')} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="gLevel">Level</label>
          <select id="gLevel" value={f.level} onChange={set('level')}>
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="gNote">Details</label>
          <textarea id="gNote" value={f.note} onChange={set('note')} maxLength={400} placeholder="Pay, jersey color, anything players should know" />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Posting…' : 'Post game'}
        </button>
      </form>
    </Modal>
  );
}
