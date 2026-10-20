'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from './providers';

export default function Home() {
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace('/players');
  }, [session, router]);

  return (
    <>
      <section className="hero">
        <h1>
          Short on numbers? <span>Fill the spot.</span>
        </h1>
        <p className="sub" style={{ fontSize: 17 }}>
          NYC Footy Market connects teams around the five boroughs with keepers and outfielders who want a
          game. Players set their price, teams message them directly, and everyone pays each other by Venmo
          or cash. Free to use.
        </p>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Link href="/login" className="btn">
            Sign up free
          </Link>
          <Link href="/login" className="btn ghost">
            I already have an account
          </Link>
        </div>
      </section>

      <div className="steps">
        <div className="card">
          <h2>Players</h2>
          <p style={{ margin: 0 }}>
            Make a profile with your position, college team, the nights you&apos;re free and your asking price.
            Keep your number private or show it.
          </p>
        </div>
        <div className="card">
          <h2>Teams</h2>
          <p style={{ margin: 0 }}>
            Browse goalkeepers and outfielders, sort by price, and message someone in a tap. Or post your game
            and let players come to you.
          </p>
        </div>
        <div className="card">
          <h2>Game on</h2>
          <p style={{ margin: 0 }}>
            Agree the details in chat, show up, and pay each other directly. The site never takes a cut.
          </p>
        </div>
      </div>

      <p className="note" style={{ marginTop: 28 }}>
        18+ only. Meet at public fields, and report anyone who makes you uncomfortable.
      </p>
    </>
  );
}
