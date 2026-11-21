'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/providers';
import RequireAuth from '@/components/RequireAuth';
import { Modal, RatingLine } from '@/components/ui';
import LeagueReviews from '@/components/LeagueReviews';
import VenmoPay from '@/components/VenmoPay';
import { firstName, squareJpeg } from '@/lib/format';
import { useSupportId } from '@/lib/support';
import { notifyRecipient } from '@/lib/push';

export default function LeaguesPage() {
  return (
    <RequireAuth needsProfile allowGuest>
      <Leagues />
    </RequireAuth>
  );
}

const FORMATS = ['5v5', '6v6', '7v7', '8v8', '9v9', '11v11'];
const GENDERS = ['Coed', "Men's", "Women's", 'Open'];
const LEAGUE_LEVELS = ['Recreational', 'Intermediate', 'Competitive'];
const SETTINGS = { Outdoor: 'Outdoor', Indoor: 'Indoor', Both: 'Indoor & outdoor' };

const money = (n) => `$${Number(n || 0).toLocaleString('en-US')}`;
const shortDate = (d) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

// Sign-ups close at the end of the deadline day (New York time is close enough to the viewer's day).
function deadlineInfo(d) {
  if (!d) return null;
  const end = new Date(`${d}T23:59:59`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(`${d}T00:00:00`) - today) / 864e5);
  const date = new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (Date.now() > end.getTime()) return { closed: true, text: 'Sign-ups closed' };
  if (days === 0) return { soon: true, text: 'Sign-ups close today' };
  if (days === 1) return { soon: true, text: 'Sign-ups close tomorrow' };
  if (days <= 7) return { soon: true, text: `Sign-ups close in ${days} days` };
  return { text: `Sign-ups close ${date}` };
}

function LeagueBadge({ league, size = 'md' }) {
  if (league.photo_url) {
    return <div className={`lbadge ${size}`} style={{ backgroundImage: `url("${league.photo_url}")` }} aria-hidden="true" />;
  }
  const letters = league.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <div className={`lbadge ${size} blank`} aria-hidden="true">
      {letters}
    </div>
  );
}

function Leagues() {
  const { user, profile, toast, ensureSignedIn } = useAuth();
  const router = useRouter();
  const [leagues, setLeagues] = useState(null);
  const [stats, setStats] = useState({});
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null); // {} for a new league, or the league being edited
  const [filter, setFilter] = useState('All');

  const load = useCallback(async () => {
    const [{ data, error }, { data: st }] = await Promise.all([
      supabase.from('leagues').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('league_review_stats').select('*'),
    ]);
    if (error) {
      setError('Couldn’t load leagues. Check your connection and refresh.');
      return;
    }
    setLeagues(data);
    setStats(Object.fromEntries((st ?? []).map((s) => [s.league_id, s])));
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('leagues-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leagues' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const startPosting = () => {
    if (!ensureSignedIn('post your league')) return;
    if (!profile?.is_adult) {
      router.push('/profile');
      return;
    }
    setEditing({});
  };

  // Open leagues first; ones whose sign-up deadline has passed go to the bottom.
  const shown = (leagues ?? [])
    .filter((l) => filter === 'All' || l.format === filter)
    .map((l, i) => ({ l, i, closed: Boolean(deadlineInfo(l.signup_deadline)?.closed) }))
    .sort((a, b) => a.closed - b.closed || a.i - b.i)
    .map((x) => x.l);
  const formatsInUse = FORMATS.filter((f) => (leagues ?? []).some((l) => l.format === f));
  const current = open ? (leagues ?? []).find((l) => l.id === open) : null;

  return (
    <section>
      <div className="toolbar" style={{ marginTop: 0 }}>
        <div>
          <h1>League sign-ups</h1>
          <p className="sub">
            NYC leagues taking team entries. Check the fee, format and reviews, then message the manager or pay your entry.
          </p>
        </div>
        <button className="btn" type="button" onClick={startPosting}>
          Post your league
        </button>
      </div>

      {formatsInUse.length > 1 ? (
        <div className="seg" role="group" aria-label="Format" style={{ marginBottom: 14 }}>
          {['All', ...formatsInUse].map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {leagues === null && !error ? <div className="empty">Loading leagues…</div> : null}
      {leagues && shown.length === 0 ? (
        <div className="empty">
          No leagues taking sign-ups yet. Run a league? Post it here and teams will find you.
        </div>
      ) : null}

      <div className="leagues">
        {shown.map((l) => {
          const mine = Boolean(user) && l.manager_id === user.id;
          return (
            <button
              className={`league ${deadlineInfo(l.signup_deadline)?.closed ? 'closed' : ''}`}
              type="button"
              key={l.id}
              onClick={() => setOpen(l.id)}
            >
              <LeagueBadge league={l} />
              <div className="lbody">
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <span className="gtitle">{l.name}</span>
                  {!l.approved ? <span className="soon">Waiting for approval</span> : mine ? <span className="you">Your league</span> : null}
                </div>
                <Deadline date={l.signup_deadline} />
                <div className="needs">
                  <span className="pos of">{l.format}</span>
                  <span className="pos plain">{l.gender}</span>
                  <span className="pos plain">{l.level}</span>
                  {l.setting ? <span className="pos plain">{SETTINGS[l.setting]}</span> : null}
                </div>
                <div className="meta">
                  {[l.area, l.game_day, l.contact_name ? `Run by ${l.contact_name}` : ''].filter(Boolean).join(' · ')}
                </div>
                {stats[l.id] ? <RatingLine stats={stats[l.id]} /> : null}
              </div>
              <div className="lfee">
                <b>{l.entry_fee > 0 ? money(l.entry_fee) : 'Free'}</b>
                {l.entry_fee > 0 ? <small>per team</small> : null}
              </div>
            </button>
          );
        })}
      </div>

      {current ? (
        <LeagueDetail
          league={current}
          stats={stats[current.id]}
          onClose={() => setOpen(null)}
          onEdit={() => {
            setOpen(null);
            setEditing(current);
          }}
          onChanged={load}
        />
      ) : null}

      {editing ? (
        <LeagueForm
          existing={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            toast(msg);
            load();
          }}
        />
      ) : null}
    </section>
  );
}

function LeagueDetail({ league: l, stats, onClose, onEdit, onChanged }) {
  const { user, profile, toast, ensureSignedIn } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const mine = Boolean(user) && l.manager_id === user.id;
  const manager = firstName(l.contact_name) || 'the manager';

  const message = async () => {
    if (!ensureSignedIn(`message ${l.name}`)) return;
    if (!profile?.is_adult) {
      router.push('/profile');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc('start_conversation', { other: l.manager_id });
    setBusy(false);
    if (error) {
      toast(error.message);
      return;
    }
    try {
      sessionStorage.setItem(
        `draft:${data}`,
        `Hi ${firstName(l.contact_name) || 'there'}, saw ${l.name} on NYC Footy Market. Is there still room for a team?`
      );
    } catch {}
    router.push(`/chats/${data}`);
  };

  const remove = async () => {
    if (!confirmDelete()) return;
    const { error } = await supabase.from('leagues').delete().eq('id', l.id);
    if (error) toast('Couldn’t delete it. Try again.');
    else {
      toast('League removed');
      onClose();
      onChanged();
    }
  };

  return (
    <Modal onClose={onClose} label={l.name}>
      <div className="row">
        <LeagueBadge league={l} size="lg" />
        <div style={{ minWidth: 0 }}>
          <h2>{l.name}</h2>
          <div className="needs" style={{ marginTop: 6 }}>
            <span className="pos of">{l.format}</span>
            <span className="pos plain">{l.gender}</span>
            <span className="pos plain">{l.level}</span>
            {l.setting ? <span className="pos plain">{SETTINGS[l.setting]}</span> : null}
          </div>
        </div>
      </div>

      {!l.approved ? (
        <p className="note" style={{ margin: 0 }}>
          Only you can see this for now. It goes live once NYC Footy Market approves it. We&apos;ll message you in your chats.
        </p>
      ) : null}

      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="price">
          {l.entry_fee > 0 ? money(l.entry_fee) : 'Free'}
          {l.entry_fee > 0 ? <small>/team</small> : null}
        </div>
        <RatingLine stats={stats} />
      </div>

      <dl className="facts">
        {l.area ? (
          <>
            <dt>Where</dt>
            <dd>{l.area}</dd>
          </>
        ) : null}
        {l.game_day ? (
          <>
            <dt>Games</dt>
            <dd>{l.game_day}</dd>
          </>
        ) : null}
        {l.season_start ? (
          <>
            <dt>Season starts</dt>
            <dd>{shortDate(l.season_start)}</dd>
          </>
        ) : null}
        {l.signup_deadline ? (
          <>
            <dt>Sign-ups close</dt>
            <dd>
              {shortDate(l.signup_deadline)} <Deadline date={l.signup_deadline} inline />
            </dd>
          </>
        ) : null}
        <dt>Manager</dt>
        <dd>{l.contact_name || '—'}</dd>
        {l.contact ? (
          <>
            <dt>Contact</dt>
            <dd style={{ overflowWrap: 'anywhere' }}>{l.contact}</dd>
          </>
        ) : null}
      </dl>

      {l.description ? <p className="ldesc">{l.description}</p> : null}

      {mine ? (
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <button className="btn dark" type="button" onClick={onEdit}>
            Edit league
          </button>
          <button className="btn ghost" type="button" onClick={remove}>
            Delete
          </button>
        </div>
      ) : (
        <div className="lactions">
          <button className="btn" type="button" onClick={message} disabled={busy}>
            {busy ? 'Opening chat…' : `Message ${manager}`}
          </button>
          {l.signup_url ? (
            <a className="btn ghost" href={l.signup_url} target="_blank" rel="noopener noreferrer">
              Sign-up form ↗
            </a>
          ) : null}
          {l.venmo && l.entry_fee > 0 && !deadlineInfo(l.signup_deadline)?.closed ? (
            <>
              <span className="lbl" style={{ marginTop: 4 }}>
                Pay the entry fee
              </span>
              <VenmoPay
                handle={l.venmo}
                name={l.name}
                amount={l.entry_fee}
                max={20000}
                note={`${l.name} - team entry`}
                label={(v) => (v > 0 ? `Pay ${money(v)} on Venmo` : 'Pay on Venmo')}
              />
              <p className="note" style={{ margin: 0 }}>
                Goes to {l.venmo.startsWith('@') ? l.venmo : `@${l.venmo}`}. Message {manager} first to make sure there&apos;s a
                spot, and put your team name in the Venmo note.
              </p>
            </>
          ) : null}
        </div>
      )}

      <LeagueReviews league={l} stats={stats} onChanged={onChanged} />
    </Modal>
  );
}

function confirmDelete() {
  try {
    return window.confirm('Delete this league? Its reviews are deleted too.');
  } catch {
    return true;
  }
}

function LeagueForm({ existing, onClose, onSaved }) {
  const { user, profile } = useAuth();
  const supportId = useSupportId();
  const [f, setF] = useState(() => ({
    name: existing?.name ?? '',
    photo_url: existing?.photo_url ?? '',
    format: existing?.format ?? '7v7',
    gender: existing?.gender ?? 'Coed',
    level: existing?.level ?? 'Recreational',
    setting: existing?.setting ?? 'Outdoor',
    area: existing?.area ?? '',
    game_day: existing?.game_day ?? '',
    season_start: existing?.season_start ?? '',
    signup_deadline: existing?.signup_deadline ?? '',
    entry_fee: existing?.entry_fee ?? '',
    contact_name: existing?.contact_name ?? profile?.name ?? '',
    contact: existing?.contact ?? '',
    venmo: existing?.venmo ?? '',
    signup_url: existing?.signup_url ?? '',
    description: existing?.description ?? '',
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (k) => (e) => {
    setF({ ...f, [k]: e.target.value });
    if (error) setError('');
  };
  const pick = (k, v) => setF({ ...f, [k]: v });

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const blob = await squareJpeg(file, 600);
      const path = `${user.id}/league-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setF((cur) => ({ ...cur, photo_url: data.publicUrl }));
    } catch (err) {
      setError(err.message?.startsWith('That file') ? err.message : 'Photo upload failed. Try again, or pick a different photo.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    const fee = Math.round(Number(f.entry_fee) || 0);
    let url = f.signup_url.trim();
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
    const err =
      f.name.trim().length < 2
        ? 'Add your league’s name.'
        : !f.contact_name.trim()
          ? 'Add the manager’s name.'
          : fee < 0 || fee > 20000
            ? 'Set an entry fee between $0 and $20,000.'
            : f.description.trim().length < 20
              ? 'Add a few lines about the league: how many games, refs, what’s included.'
              : '';
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    const row = {
      name: f.name.trim(),
      photo_url: f.photo_url || null,
      format: f.format,
      gender: f.gender,
      level: f.level,
      setting: f.setting,
      area: f.area.trim(),
      game_day: f.game_day.trim(),
      season_start: f.season_start || null,
      signup_deadline: f.signup_deadline || null,
      entry_fee: fee,
      contact_name: f.contact_name.trim(),
      contact: f.contact.trim(),
      venmo: f.venmo.trim(),
      signup_url: url,
      description: f.description.trim(),
    };
    const save = (r) => (existing ? supabase.from('leagues').update(r).eq('id', existing.id) : supabase.from('leagues').insert(r));
    let { error } = await save(row);
    if (error && /setting/.test(error.message || '')) {
      // Database not updated yet (009_league_setting.sql): save without indoor/outdoor.
      const { setting, ...rest } = row;
      ({ error } = await save(rest));
    }
    if (error) {
      setBusy(false);
      setError('Couldn’t save the league. Check the details and try again.');
      return;
    }
    if (!existing && supportId) {
      // Let the NYC Footy Market team know there's a league to approve.
      const { data: cid } = await supabase.rpc('start_conversation', { other: supportId });
      if (cid) {
        const { data: msg } = await supabase
          .from('messages')
          .insert({
            conversation_id: cid,
            body: `New league submitted for approval: ${row.name} (${row.format}, ${row.entry_fee > 0 ? money(row.entry_fee) : 'free'} per team).`,
          })
          .select('id')
          .single();
        if (msg) notifyRecipient(msg.id);
      }
    }
    setBusy(false);
    onSaved(existing ? 'League updated' : 'League submitted. It goes live once it’s approved.');
  };

  return (
    <Modal onClose={onClose} label={existing ? 'Edit league' : 'Post your league'}>
      <h2>{existing ? 'Edit league' : 'Post your league'}</h2>
      {!existing ? (
        <p className="note" style={{ marginTop: -6 }}>
          Teams see this when looking for a league. We review new leagues before they go live.
        </p>
      ) : null}
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }} noValidate>
        <div className="row">
          <LeagueBadge league={{ name: f.name || 'League', photo_url: f.photo_url }} size="lg" />
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor="lgPhoto">{uploading ? 'Uploading…' : 'Logo or photo (optional)'}</label>
            <input type="file" id="lgPhoto" accept="image/*,.heic,.heif" onChange={upload} disabled={uploading} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="lgName">League name</label>
          <input id="lgName" value={f.name} onChange={set('name')} placeholder="e.g. Premier Beer League" maxLength={80} />
        </div>
        <div className="field">
          <span className="lbl">Format</span>
          <div className="seg" role="group" aria-label="Format">
            {FORMATS.map((x) => (
              <button key={x} type="button" aria-pressed={f.format === x} onClick={() => pick('format', x)}>
                {x}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="lbl">Who plays</span>
          <div className="seg" role="group" aria-label="Who plays">
            {GENDERS.map((x) => (
              <button key={x} type="button" aria-pressed={f.gender === x} onClick={() => pick('gender', x)}>
                {x}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="lbl">Indoor or outdoor</span>
          <div className="seg" role="group" aria-label="Indoor or outdoor">
            {Object.entries(SETTINGS).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={f.setting === k} onClick={() => pick('setting', k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="lbl">Level</span>
          <div className="seg" role="group" aria-label="Level">
            {LEAGUE_LEVELS.map((x) => (
              <button key={x} type="button" aria-pressed={f.level === x} onClick={() => pick('level', x)}>
                {x}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label htmlFor="lgFee">Entry fee per team</label>
          <div className="moneyinput">
            <span>$</span>
            <input id="lgFee" type="number" inputMode="numeric" min="0" max="20000" step="1" value={f.entry_fee} onChange={set('entry_fee')} placeholder="0" />
          </div>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="lgArea">Where</label>
            <input id="lgArea" value={f.area} onChange={set('area')} placeholder="e.g. Pier 40, Manhattan" maxLength={100} />
          </div>
          <div className="field">
            <label htmlFor="lgDay">Game days</label>
            <input id="lgDay" value={f.game_day} onChange={set('game_day')} placeholder="e.g. Sunday evenings" maxLength={60} />
          </div>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="lgStart">Season starts (optional)</label>
            <input id="lgStart" type="date" value={f.season_start} onChange={set('season_start')} />
          </div>
          <div className="field">
            <label htmlFor="lgDeadline">Sign-ups close (optional)</label>
            <input id="lgDeadline" type="date" value={f.signup_deadline} onChange={set('signup_deadline')} />
          </div>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="lgManager">Manager name</label>
            <input id="lgManager" value={f.contact_name} onChange={set('contact_name')} maxLength={60} />
          </div>
          <div className="field">
            <label htmlFor="lgContact">Contact (optional, shown publicly)</label>
            <input id="lgContact" value={f.contact} onChange={set('contact')} placeholder="Email, Instagram or phone" maxLength={120} />
          </div>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="lgVenmo">League Venmo (optional)</label>
            <input id="lgVenmo" value={f.venmo} onChange={set('venmo')} placeholder="@your-league" maxLength={40} />
          </div>
          <div className="field">
            <label htmlFor="lgUrl">Sign-up link (optional)</label>
            <input id="lgUrl" value={f.signup_url} onChange={set('signup_url')} placeholder="yourleague.com/register" maxLength={300} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="lgDesc">Details and rules</label>
          <textarea
            id="lgDesc"
            value={f.description}
            onChange={set('description')}
            maxLength={3000}
            rows={7}
            placeholder="Number of games and playoffs, refs, roster size, what the fee covers, jerseys, rules, how to sign up…"
          />
        </div>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn" type="submit" disabled={busy || uploading}>
          {busy ? 'Saving…' : existing ? 'Save changes' : 'Submit for approval'}
        </button>
      </form>
    </Modal>
  );
}

function Deadline({ date, inline = false }) {
  const d = deadlineInfo(date);
  if (!d) return null;
  if (inline) return d.closed || d.soon ? <span className={`deadline ${d.closed ? 'closed' : 'soon'}`}>{d.text}</span> : null;
  return <span className={`deadline ${d.closed ? 'closed' : d.soon ? 'soon' : ''}`}>{d.text}</span>;
}
