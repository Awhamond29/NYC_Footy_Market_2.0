// Sends a phone notification to the person who just received a message.
// The sender's browser calls this right after sending. The server then checks
// everything itself (who you are, that you sent the message, that it's new)
// before notifying the other person in the chat.

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
const secretKey = process.env.SUPABASE_SECRET_KEY;
const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.nycfootymarket.com';

function reply(status, body) {
  return Response.json(body, { status });
}

export async function POST(req) {
  if (!url || !secretKey || !vapidPublic || !vapidPrivate) {
    return reply(503, { error: 'Notifications are not set up yet.' });
  }

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  let messageId;
  try {
    messageId = Number((await req.json()).messageId);
  } catch {
    return reply(400, { error: 'Bad request.' });
  }
  if (!token || !Number.isInteger(messageId)) return reply(400, { error: 'Bad request.' });

  const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1. Who is asking?
  const { data: who, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !who?.user) return reply(401, { error: 'Sign in first.' });
  const me = who.user.id;

  // 2. The message must be theirs, recent, and not already notified.
  const { data: msg } = await admin
    .from('messages')
    .select('id, body, sender_id, created_at, pushed_at, conversation:conversations(id, user_a, user_b)')
    .eq('id', messageId)
    .maybeSingle();
  if (!msg || msg.sender_id !== me) return reply(404, { error: 'Message not found.' });
  if (msg.pushed_at) return reply(200, { sent: 0, note: 'Already notified.' });
  if (Date.now() - new Date(msg.created_at).getTime() > 5 * 60 * 1000) return reply(200, { sent: 0, note: 'Too old.' });

  // Claim it first so a repeated call can't notify twice.
  const { data: claimed } = await admin
    .from('messages')
    .update({ pushed_at: new Date().toISOString() })
    .eq('id', messageId)
    .is('pushed_at', null)
    .select('id');
  if (!claimed?.length) return reply(200, { sent: 0, note: 'Already notified.' });

  const c = msg.conversation;
  const recipient = c.user_a === me ? c.user_b : c.user_a;

  // 3. Who sent it (for the notification title), and the recipient's devices.
  const [{ data: sender }, { data: subs }] = await Promise.all([
    admin.from('profiles').select('name').eq('id', me).maybeSingle(),
    admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', recipient),
  ]);
  if (!subs?.length) return reply(200, { sent: 0 });

  webpush.setVapidDetails(SITE, vapidPublic, vapidPrivate);
  const body = msg.body.length > 120 ? msg.body.slice(0, 117) + '…' : msg.body;
  const payload = JSON.stringify({
    title: sender?.name || 'New message',
    body,
    url: `/chats/${c.id}`,
    tag: `chat-${c.id}`,
  });

  let sent = 0;
  const dead = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 60 * 60,
          urgency: 'high',
        });
        sent++;
      } catch (err) {
        // 404/410 = that phone turned notifications off or the app was removed.
        if (err?.statusCode === 404 || err?.statusCode === 410) dead.push(s.id);
      }
    })
  );
  if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead);

  return reply(200, { sent });
}
