'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(result.error || 'Unable to sign in.');
      setLoading(false);
      return;
    }

    router.replace('/');
    router.refresh();
  }

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-[#3f0e40] via-[#541b55] to-[#17112e] flex items-center justify-center p-6">
      <section className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-white shadow-lg">
          <ShieldCheck className="h-9 w-9" />
        </div>
        <h1 className="text-center text-3xl font-extrabold tracking-tight text-white">Task Bot Roster</h1>
        <p className="mt-2 text-center text-sm text-purple-200">Sign in to manage your team schedule</p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-purple-200">Username</span>
            <span className="flex items-center rounded-xl border border-white/15 bg-black/20 px-3 focus-within:ring-2 focus-within:ring-purple-300">
              <UserRound className="h-5 w-5 text-purple-200" />
              <input required value={username} onChange={(event) => setUsername(event.target.value)} className="w-full bg-transparent px-3 py-3 text-white outline-none placeholder:text-purple-200/50" autoComplete="username" />
            </span>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-purple-200">Password</span>
            <span className="flex items-center rounded-xl border border-white/15 bg-black/20 px-3 focus-within:ring-2 focus-within:ring-purple-300">
              <LockKeyhole className="h-5 w-5 text-purple-200" />
              <input required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full bg-transparent px-3 py-3 text-white outline-none placeholder:text-purple-200/50" autoComplete="current-password" />
            </span>
          </label>
          {error && <p className="rounded-lg bg-red-500/20 px-3 py-2 text-center text-sm text-red-200">{error}</p>}
          <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3.5 font-bold text-[#3f0e40] transition hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? 'Signing in…' : 'Sign in'} {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </form>
        <p className="mt-8 text-center text-xs text-white/45">Tradeling Task Bot Internal System</p>
      </section>
    </main>
  );
}
