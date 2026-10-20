export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const LEVELS = ['Casual', 'Rec', 'Intermediate', 'Competitive'];

const COLORS = ['#0f5132', '#7a3cff', '#c2410c', '#1d4ed8', '#9d174d', '#0e7490', '#4d7c0f', '#6b21a8', '#b45309'];

export function colorFor(s = '?') {
  let n = 0;
  for (const c of s) n += c.charCodeAt(0);
  return COLORS[n % COLORS.length];
}

export function initials(name) {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';
}

export function firstName(name) {
  return (name || 'them').trim().split(/\s+/)[0];
}

export function gameDate(iso) {
  const d = new Date(iso);
  return {
    dow: d.toLocaleDateString('en-US', { weekday: 'short' }),
    mon: d.toLocaleDateString('en-US', { month: 'short' }),
    day: d.getDate(),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

export function soonLabel(iso) {
  const at = new Date(iso).getTime();
  const hours = (at - Date.now()) / 36e5;
  if (hours < 0) return 'Started';
  if (hours < 12) return `In ${Math.max(1, Math.round(hours))}h`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(at);
  that.setHours(0, 0, 0, 0);
  const days = Math.round((that - today) / 864e5);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return null;
}

export function msgTime(iso) {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  return sameDay
    ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

// Shrinks an uploaded photo to a square JPEG before it's stored.
export async function squareJpeg(file, size = 400) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That file is not an image we can read.'));
      i.src = url;
    });
    const m = Math.min(img.width, img.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    canvas
      .getContext('2d')
      .drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
    return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}
