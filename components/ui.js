'use client';

import { useEffect } from 'react';
import { DAYS, colorFor, initials } from '@/lib/format';

export function Avatar({ name, photo, size = '' }) {
  if (photo) {
    return <div className={`av ${size}`} style={{ backgroundImage: `url("${photo}")` }} aria-hidden="true" />;
  }
  return (
    <div className={`av ${size}`} style={{ background: colorFor(name || '?') }} aria-hidden="true">
      {initials(name)}
    </div>
  );
}

export function PosBadge({ pos }) {
  return pos === 'GK' ? <span className="pos gk">Goalkeeper</span> : <span className="pos of">Outfielder</span>;
}

export function Price({ value }) {
  if (!value) return <div className="price free">Free</div>;
  return (
    <div className="price">
      ${value}
      <small>/game</small>
    </div>
  );
}

export function Days({ days = [], short = true }) {
  return (
    <div className="days" aria-label={`Available: ${days.join(', ') || 'not set'}`}>
      {DAYS.map((d) => (
        <span key={d} className={`day ${days.includes(d) ? 'on' : ''}`}>
          {short ? d[0] : d}
        </span>
      ))}
    </div>
  );
}

// Short line for cards: "★ 4.8 · 12 reviews"
export function RatingLine({ stats }) {
  if (!stats || !stats.review_count) return <span className="rating none">No reviews yet</span>;
  return (
    <span className="rating">
      <span className="star">★</span> {Number(stats.avg_rating).toFixed(1)}
      <span className="meta">
        {' '}
        · {stats.review_count} review{stats.review_count === 1 ? '' : 's'}
        {stats.no_shows ? ` · ${stats.no_shows} no-show${stats.no_shows === 1 ? '' : 's'}` : ''}
      </span>
    </span>
  );
}

export function PlayerCard({ p, isMe, onClick, as = 'button', stats, showRating = true }) {
  const Tag = as;
  return (
    <Tag className="card" onClick={onClick} type={as === 'button' ? 'button' : undefined}>
      <div className="row">
        <Avatar name={p.name} photo={p.photo_url} />
        <div style={{ minWidth: 0 }}>
          <div className="name">
            {p.name || 'Your name'} {isMe ? <span className="you">You</span> : null}
          </div>
          <div className="meta">
            {[p.role, p.area].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <PosBadge pos={p.position} />
        {showRating ? <RatingLine stats={stats} /> : null}
      </div>
      <p className="summary">{p.bio || 'No summary yet.'}</p>
      <div className="cardfoot">
        <Price value={p.price} />
        <Days days={p.days} />
      </div>
    </Tag>
  );
}

export function Modal({ onClose, children, label }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <button className="close" type="button" onClick={onClose}>
          Close ✕
        </button>
        {children}
      </div>
    </div>
  );
}

export function CopyLine({ label, value, href, onCopied }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      onCopied?.(`Copied ${value}`);
    } catch {
      onCopied?.('Select the text to copy it');
    }
  };
  return (
    <div className="field">
      <span className="lbl">{label}</span>
      <div className="copyline">
        <code>{value}</code>
        {href ? <a href={href}>Open</a> : null}
        <button type="button" onClick={copy}>
          Copy
        </button>
      </div>
    </div>
  );
}
