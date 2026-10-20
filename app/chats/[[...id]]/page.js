'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/app/providers';
import RequireAuth from '@/components/RequireAuth';
import { Avatar } from '@/components/ui';
import { firstName, msgTime } from '@/lib/format';

export default function ChatsPage() {
  return (
    <RequireAuth needsProfile>
      <Chats />
    </RequireAuth>
  );
}

const CONVO_SELECT =
  '*, a:profiles!conversations_user_a_fkey(id, name, photo_url, position, area), b:profiles!conversations_user_b_fkey(id, name, photo_url, position, area), game:games(title, field, kickoff)';

function Chats() {
  const params = useParams();
  const activeId = params?.id?.[0] ?? null;
  const { user } = useAuth();
  const [convos, setConvos] = useState(null);
  const [unreadIds, setUnreadIds] = useState(new Set());

  const loadList = useCallback(async () => {
    const [{ data }, { data: unread }] = await Promise.all([
      supabase.from('conversations').select(CONVO_SELECT).order('last_message_at', { ascending: false }).limit(200),
      supabase.from('messages').select('conversation_id').is('read_at', null).neq('sender_id', user.id),
    ]);
    setConvos(data ?? []);
    setUnreadIds(new Set((unread ?? []).map((m) => m.conversation_id)));
  }, [user.id]);

  useEffect(() => {
    loadList();
    const channel = supabase
      .channel('chat-list')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => loadList())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadList]);

  const other = (c) => (c.user_a === user.id ? c.b : c.a);
  const active = convos?.find((c) => c.id === activeId);

  return (
    <section>
      <h1 style={{ marginBottom: 16 }}>Chats</h1>
      <div className={`chat ${activeId ? 'open' : ''}`}>
        <div className="threads">
          {convos === null ? <div className="empty">Loading…</div> : null}
          {convos && convos.length === 0 ? (
            <div className="empty">No chats yet. Message a player or ask to join a game.</div>
          ) : null}
          {(convos ?? []).map((c) => {
            const o = other(c);
            const isUnread = unreadIds.has(c.id) && c.id !== activeId;
            return (
              <Link
                key={c.id}
                href={`/chats/${c.id}`}
                className={`thread ${isUnread ? 'unread' : ''}`}
                aria-current={c.id === activeId ? 'true' : undefined}
              >
                <Avatar name={o?.name} photo={o?.photo_url} size="sm" />
                <div>
                  <div className="name" style={{ fontSize: 15 }}>
                    {o?.name || 'Player'}
                  </div>
                  <div className="last">
                    {c.last_message
                      ? (c.last_sender === user.id ? 'You: ' : '') + c.last_message
                      : c.game
                        ? c.game.title
                        : 'New conversation'}
                  </div>
                </div>
                {isUnread ? <span className="dot" aria-label="Unread" /> : null}
              </Link>
            );
          })}
        </div>
        <div className="convo">
          {activeId && convos && !active ? <div className="empty">This chat isn&apos;t available.</div> : null}
          {!activeId ? <div className="empty">Pick a conversation.</div> : null}
          {active ? <Conversation key={active.id} convo={active} other={other(active)} onRead={loadList} /> : null}
        </div>
      </div>
    </section>
  );
}

function Conversation({ convo, other, onRead }) {
  const { user, refreshUnread } = useAuth();
  const [messages, setMessages] = useState(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef();
  const inputRef = useRef();

  const markRead = useCallback(async () => {
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', convo.id)
      .neq('sender_id', user.id)
      .is('read_at', null);
    refreshUnread();
    onRead();
  }, [convo.id, user.id, refreshUnread, onRead]);

  useEffect(() => {
    let alive = true;
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convo.id)
      .order('created_at', { ascending: true })
      .limit(500)
      .then(({ data }) => {
        if (!alive) return;
        setMessages(data ?? []);
        markRead();
      });

    const channel = supabase
      .channel(`convo-${convo.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convo.id}` },
        (payload) => {
          setMessages((m) => (m && !m.some((x) => x.id === payload.new.id) ? [...m, payload.new] : m));
          if (payload.new.sender_id !== user.id) markRead();
        }
      )
      .subscribe();

    try {
      const draft = sessionStorage.getItem(`draft:${convo.id}`);
      if (draft) {
        setText(draft);
        sessionStorage.removeItem(`draft:${convo.id}`);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    } catch {}

    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
    // markRead is stable per conversation; re-subscribing on every list refresh would drop messages.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convo.id, user.id]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setError('');
    setSending(true);
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: convo.id, body })
      .select()
      .single();
    setSending(false);
    if (error) {
      setError('Message not sent. You may have been blocked, or the connection dropped.');
      return;
    }
    setText('');
    setMessages((m) => (m && !m.some((x) => x.id === data.id) ? [...m, data] : m));
    onRead();
  };

  return (
    <>
      <div className="convohead">
        <Link href="/chats" className="back" aria-label="Back to chats">
          ‹
        </Link>
        <Avatar name={other?.name} photo={other?.photo_url} size="sm" />
        <div style={{ minWidth: 0 }}>
          <div className="name" style={{ fontSize: 15 }}>
            {other?.name || 'Player'}
          </div>
          <div className="meta">
            {convo.game
              ? `${convo.game.title} · ${convo.game.field}`
              : [other?.position === 'GK' ? 'Goalkeeper' : 'Outfielder', other?.area].filter(Boolean).join(' · ')}
          </div>
        </div>
      </div>
      <div className="msgs" ref={listRef}>
        {messages === null ? <div className="empty">Loading…</div> : null}
        {messages && messages.length === 0 ? (
          <div className="empty">Say hi and lock in the details: time, field, price.</div>
        ) : null}
        {(messages ?? []).map((m) => (
          <div key={m.id} className={`msg ${m.sender_id === user.id ? 'me' : 'them'}`}>
            {m.body}
            <time dateTime={m.created_at}>{msgTime(m.created_at)}</time>
          </div>
        ))}
      </div>
      {error ? (
        <p className="error" style={{ padding: '0 12px' }}>
          {error}
        </p>
      ) : null}
      <form className="compose" onSubmit={send}>
        <input
          id="msgInput"
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${firstName(other?.name)}`}
          autoComplete="off"
          maxLength={2000}
        />
        <button className="btn" type="submit" disabled={sending || !text.trim()}>
          Send
        </button>
      </form>
    </>
  );
}
