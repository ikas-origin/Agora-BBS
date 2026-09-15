'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi, getErrorMessage } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { UserProfile } from '@/types/api';
import UsageGuideCard from '@/components/UsageGuideCard';
import { formatReadingDuration } from '@/lib/format';
import { canBlindReview, capabilityLabel } from '@/lib/capabilities';

const levelNames = ['阅读者', '讨论参与者', '主题发起者', '社区评审者'];

function ProfileContent({ user }: { user: UserProfile }) {
  const [statement, setStatement] = useState(user.onboarding_statement);
  const [backgroundTag, setBackgroundTag] = useState(user.background_tag);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const { refreshUser } = useAuth();
  const router = useRouter();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const result = await authApi.saveOnboarding({ statement, background_tag: backgroundTag });
      if (result.code === 0) {
        await refreshUser();
        router.refresh();
        setNotice('自述已提交，成长状态已刷新。评审期间页面会每 5 秒自动同步结果。');
      }
    } catch (err: unknown) { setError(getErrorMessage(err, '自述保存失败')); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <section className="paper-card rounded-xl p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">成长中心</p>
        <h1 className="mt-2 text-2xl font-bold">L{user.unlock_level} · {levelNames[user.unlock_level]}</h1>
        <p className="mt-3 text-sm text-[var(--text-muted)]">已验证阅读 {formatReadingDuration(user.verified_read_seconds)}</p>
        <div className="mt-4 flex flex-wrap gap-2">{user.capabilities.map((ability) => <span key={ability} className="rounded-full bg-stone-100 px-3 py-1 text-xs">{capabilityLabel(ability)}</span>)}</div>
        {canBlindReview(user) && <Link href="/reviews" className="paper-btn-primary mt-5 inline-block rounded-md px-4 py-2 text-sm">进入匿名盲审</Link>}
      </section>
      <section className="paper-card rounded-xl p-6">
        <h2 className="text-lg font-bold">社区自述</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">不会阻断账号使用；匿名评审只判断表达是否真诚、得体。当前状态：{user.onboarding_status}</p>
        {user.onboarding_status === 'pending_review' && <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">匿名评审进行中，系统会自动刷新本页状态，请勿重复提交。</p>}
        {notice && <p className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        <form onSubmit={submit} className="mt-4 space-y-4">
          <input value={backgroundTag} onChange={(event) => setBackgroundTag(event.target.value)} required minLength={2} maxLength={64} placeholder="背景标签，例如：在校学生 / 软件工程" className="w-full rounded-md border p-3 text-sm" />
          <textarea value={statement} onChange={(event) => setStatement(event.target.value)} required minLength={20} maxLength={1000} rows={6} placeholder="介绍你希望如何参与社区讨论…" className="w-full rounded-md border p-3 text-sm" />
          <button disabled={saving} className="paper-btn-primary rounded-md px-5 py-2 text-sm disabled:opacity-50">{saving ? '保存中…' : '提交自述'}</button>
        </form>
      </section>
    </div>
  );
}

export default function ProfilePage() {
  const { user, isLoading, refreshUser } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!isLoading && !user) router.replace('/login'); }, [isLoading, router, user]);
  useEffect(() => {
    if (user?.onboarding_status !== 'pending_review') return;
    const timer = window.setInterval(() => { void refreshUser().catch(() => undefined); }, 5000);
    return () => window.clearInterval(timer);
  }, [refreshUser, user?.onboarding_status]);
  if (isLoading) return <div className="mx-auto h-40 max-w-5xl animate-pulse rounded-xl bg-stone-200" />;
  if (!user) return null;
  return <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[240px_minmax(0,1fr)]"><UsageGuideCard context="growth" /><ProfileContent user={user} /></div>;
}
