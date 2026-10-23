'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/providers';
import RequireAuth from '@/components/RequireAuth';
import { Avatar, PlayerCard } from '@/components/ui';
import AppSetup from '@/components/AppSetup';
import SupportButton from '@/components/SupportButton';
import { takeReturnTo } from '@/lib/returnTo';
import { DAYS, squareJpeg } from '@/lib/format';

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileForm />
    </RequireAuth>
  );
}

const TEXT_FIELDS = [
  ['name', 'Name', 'First and last name', 60],
  ['role', 'Best spots', 'e.g. CB / DM', 40],
  ['area', 'Home area', 'e.g. Lower Manhattan', 60],
];

function ProfileForm() {
  const { user, profile, refreshProfile, toast } = useAuth();
  const router = useRouter();
  const [f, setF] = useState(null);
  const [c, setC] = useState(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    setWelcome(window.location.search.includes('welcome=1'));
  }, []);

  useEffect(() => {
    if (profile && !f) setF(profile);
  }, [profile, f]);

  useEffect(() => {
    supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setC(data ?? { phone: '', venmo: '', show_phone: false, show_venmo: false }));
  }, [user.id]);

  if (!f || !c) return <div className="empty">Loading your profile…</div>;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setContact = (k) => (e) => setC({ ...c, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const toggleDay = (d) => setF({ ...f, days: f.days.includes(d) ? f.days.filter((x) => x !== d) : DAYS.filter((x) => x === d || f.days.includes(x)) });

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const blob = await squareJpeg(file);
      const path = `${user.id}/${Date.now()}.jpg`;
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setF((cur) => ({ ...cur, photo_url: data.publicUrl }));
      toast('Photo added. Save to keep it.');
    } catch (err) {
      setError(err.message?.startsWith('That file') ? err.message : 'Photo upload failed. Try again, or pick a different photo.');
    } finally {
      setUploading(false);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (f.listed && !f.name.trim()) {
      setError('Add your name to get listed.');
      return;
    }
    if (f.listed && !f.is_adult) {
      setError('Confirm you’re 18 or older to get listed.');
      return;
    }
    setBusy(true);
    const profileUpdate = supabase
      .from('profiles')
      .update({
        name: f.name.trim(),
        position: f.position,
        role: f.role.trim(),
        area: f.area.trim(),
        college: f.college.trim(),
        experience: f.experience.trim(),
        bio: f.bio.trim(),
        days: f.days,
        price: Number(f.price) || 0,
        listed: f.listed,
        is_adult: f.is_adult,
        photo_url: f.photo_url,
      })
      .eq('id', user.id);
    const contactUpdate = supabase
      .from('contacts')
      .update({
        phone: c.phone.trim(),
        venmo: c.venmo.trim(),
        show_phone: c.show_phone,
        show_venmo: c.show_venmo,
      })
      .eq('user_id', user.id);
    const [r1, r2] = await Promise.all([profileUpdate, contactUpdate]);
    setBusy(false);
    if (r1.error || r2.error) {
      setError('Couldn’t save. Check your details and try again.');
      return;
    }
    await refreshProfile();
    toast(f.listed ? 'Saved. You’re listed in Players.' : 'Saved. You’re hidden from Players.');
    if (welcome && f.is_adult) router.push(takeReturnTo());
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  return (
    <section>
      <h1>{welcome ? 'Welcome! Set up your profile' : 'My profile'}</h1>
      <p className="sub">
        This is what teams see in the Players list. Turn on &ldquo;List me&rdquo; to show up. Captains who only post
        games can leave it off.
      </p>

      <div className="profile">
        <form className="panel" onSubmit={save} noValidate>
          <div className="row">
            <Avatar name={f.name || 'You'} photo={f.photo_url} size="lg" />
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="pfPhoto">{uploading ? 'Uploading…' : 'Photo'}</label>
              <input type="file" id="pfPhoto" accept="image/*,.heic,.heif" onChange={upload} disabled={uploading} />
            </div>
          </div>

          <div className="two">
            <div className="field">
              <label htmlFor="pf-name">Name</label>
              <input id="pf-name" value={f.name} onChange={set('name')} placeholder="First and last name" maxLength={60} />
            </div>
            <div className="field">
              <label htmlFor="pf-position">Position</label>
              <select id="pf-position" value={f.position} onChange={set('position')}>
                <option value="OF">Outfielder</option>
                <option value="GK">Goalkeeper</option>
              </select>
            </div>
          </div>
          <div className="two">
            {TEXT_FIELDS.slice(1).map(([k, label, ph, max]) => (
              <div className="field" key={k}>
                <label htmlFor={`pf-${k}`}>{label}</label>
                <input id={`pf-${k}`} value={f[k]} onChange={set(k)} placeholder={ph} maxLength={max} />
              </div>
            ))}
          </div>
          <div className="field">
            <label htmlFor="pf-college">College team</label>
            <input id="pf-college" value={f.college} onChange={set('college')} placeholder="e.g. Johns Hopkins (NCAA DIII)" maxLength={80} />
          </div>
          <div className="field">
            <label htmlFor="pf-exp">Experience</label>
            <input id="pf-exp" value={f.experience} onChange={set('experience')} placeholder="Leagues, clubs, honors" maxLength={300} />
          </div>
          <div className="field">
            <label htmlFor="pf-bio">Short summary</label>
            <textarea id="pf-bio" value={f.bio} onChange={set('bio')} placeholder="What teams get when they pick you up" maxLength={400} />
          </div>
          <div className="field">
            <span className="lbl">Days / nights available</span>
            <div className="daypick">
              {DAYS.map((d) => (
                <button key={d} type="button" aria-pressed={f.days.includes(d)} onClick={() => toggleDay(d)}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="two">
            <div className="field">
              <label htmlFor="pf-phone">Phone</label>
              <input id="pf-phone" type="tel" value={c.phone} onChange={setContact('phone')} placeholder="(212) 555-0100" maxLength={30} />
            </div>
            <div className="field">
              <label htmlFor="pf-venmo">Venmo</label>
              <input id="pf-venmo" value={c.venmo} onChange={setContact('venmo')} placeholder="@username" maxLength={40} />
            </div>
          </div>
          <label className="switch" htmlFor="pf-show-phone">
            Show phone number publicly
            <input type="checkbox" id="pf-show-phone" checked={c.show_phone} onChange={setContact('show_phone')} />
          </label>
          <label className="switch" htmlFor="pf-show-venmo">
            Show Venmo publicly
            <input type="checkbox" id="pf-show-venmo" checked={c.show_venmo} onChange={setContact('show_venmo')} />
          </label>

          <div className="field">
            <span className="lbl">Asking price per game</span>
            <div className="pricebox">
              <input
                type="range"
                id="pf-price"
                min="0"
                max="100"
                step="1"
                value={Math.min(f.price, 100)}
                onChange={(e) => setF({ ...f, price: Number(e.target.value) })}
                aria-label="Asking price slider"
              />
              <div className="priceinput">
                <span>$</span>
                <input
                  type="number"
                  id="pf-price-exact"
                  inputMode="numeric"
                  min="0"
                  max="500"
                  step="1"
                  value={f.price}
                  onChange={(e) => {
                    const n = Math.round(Number(e.target.value));
                    setF({ ...f, price: Number.isFinite(n) ? Math.max(0, Math.min(500, n)) : 0 });
                  }}
                  aria-label="Asking price in dollars"
                />
                <small>{f.price ? '/game' : 'Free'}</small>
              </div>
            </div>
            <p className="note" style={{ margin: 0 }}>
              Drag the slider or type an exact amount. Set $0 to play for free.
            </p>
          </div>

          <label className="switch" htmlFor="pf-adult">
            I&apos;m 18 or older
            <input type="checkbox" id="pf-adult" checked={f.is_adult} onChange={(e) => setF({ ...f, is_adult: e.target.checked })} />
          </label>
          <label className="switch" htmlFor="pf-listed">
            <strong>List me in the market</strong>
            <input type="checkbox" id="pf-listed" checked={f.listed} onChange={(e) => setF({ ...f, listed: e.target.checked })} />
          </label>

          {error ? <p className="error">{error}</p> : null}
          <button className="btn" type="submit" disabled={busy || uploading}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
          <p className="note" style={{ margin: 0 }}>
            Hidden contact details stay private. Teams can still message you in Chats, and you can share them there.
          </p>
        </form>

        <div className="stick" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AppSetup variant="panel" />
        <SupportButton />
        <div className="panel">
          <span className="lbl">Preview: how your card looks</span>
          <PlayerCard p={{ ...f, name: f.name || 'Your name' }} isMe as="div" showRating={false} />
          <p className="note" style={{ margin: 0 }}>
            Signed in as {user.email}.{' '}
            <button className="link" type="button" onClick={signOut}>
              Sign out
            </button>
          </p>
        </div>
        </div>
      </div>
    </section>
  );
}
