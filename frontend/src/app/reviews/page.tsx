'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage, reviewApi } from '@/services';
import { ReviewTask } from '@/types/api';
import Pagination from '@/components/Pagination';
import Link from 'next/link';
import { canBlindReview } from '@/lib/capabilities';

export default function ReviewsPage() {
  const { user, isLoading } = useAuth();
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = async () => {
    setLoading(true);
    try { const result = await reviewApi.list(); setTasks(result.data); setPage((current) => Math.min(current, Math.max(1, Math.ceil(result.data.length / pageSize)))); }
    catch (err: unknown) { setError(getErrorMessage(err, '评审任务加载失败')); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (isLoading) return;
    if (!canBlindReview(user)) return;
    let cancelled = false;
    reviewApi.list()
      .then((result) => { if (!cancelled) setTasks(result.data); })
      .catch((err: unknown) => { if (!cancelled) setError(getErrorMessage(err, '评审任务加载失败')); });
    return () => { cancelled = true; };
  }, [isLoading, user]);

  if (isLoading || loading) return <div className="mx-auto h-48 max-w-3xl animate-pulse rounded-xl bg-stone-200" />;
  if (!user) return <div className="paper-card mx-auto max-w-3xl rounded-xl p-10 text-center"><p>登录后才能查看匿名盲审任务。</p><Link href="/login" className="paper-btn-primary mt-4 inline-block rounded px-4 py-2 text-sm">前往登录</Link></div>;
  if (!canBlindReview(user)) return <div className="paper-card mx-auto max-w-3xl rounded-xl p-10 text-center"><p>匿名盲审将在达到 L3 后解锁，你当前为 L{user.unlock_level}。</p><Link href="/profile" className="mt-3 inline-block text-sm font-semibold text-[var(--accent-ink)] hover:underline">查看成长条件 →</Link></div>;
  const pageTasks = tasks.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header><h1 className="text-2xl font-bold">匿名盲审</h1><p className="mt-2 text-sm text-[var(--text-muted)]">这里只展示内容，不展示作者身份。请只判断表达是否得体、态度是否真诚。</p></header>
      {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {tasks.length === 0 ? <div className="paper-card rounded-xl p-10 text-center text-sm text-[var(--text-muted)]">目前没有待完成的评审。</div> : pageTasks.map((task) => <ReviewCard key={task.id} task={task} onDone={load} />)}
      <Pagination page={page} pageSize={pageSize} total={tasks.length} onPageChange={setPage} onPageSizeChange={(size) => { setPage(1); setPageSize(size); }} itemLabel="个待审任务" />
    </div>
  );
}

function ReviewCard({ task, onDone }: { task: ReviewTask; onDone: () => Promise<void> }) {
  const [appropriateness, setAppropriateness] = useState(true);
  const [sincerity, setSincerity] = useState(true);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const subject = task.subject;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try { await reviewApi.submit(task.id, { appropriateness, sincerity, reason: reason.trim() }); await onDone(); }
    catch (err: unknown) { setError(getErrorMessage(err, '评审提交失败')); }
    finally { setSaving(false); }
  };

  return (
    <article className="paper-card rounded-xl p-5">
      <div className="flex justify-between text-xs text-[var(--text-muted)]"><span>{task.subject_type === 'user' ? '新人社区自述' : '重要长文'}</span><span>截止 {new Date(task.deadline).toLocaleString()}</span></div>
      <div className="mt-4 space-y-3 text-sm leading-7">
        {subject.title && <h2 className="font-bold">{subject.title}</h2>}
        <p className="whitespace-pre-wrap">{subject.statement || subject.claim}</p>
        {subject.evidence && <p className="whitespace-pre-wrap"><strong>依据：</strong>{subject.evidence}</p>}
        {subject.uncertainty && <p className="whitespace-pre-wrap"><strong>不确定：</strong>{subject.uncertainty}</p>}
        {subject.background_tag && <p className="text-xs text-[var(--text-muted)]">背景标签：{subject.background_tag}</p>}
      </div>
      <form onSubmit={submit} className="mt-5 space-y-3 border-t border-[var(--border-paper)] pt-4 text-sm">
        <label className="flex items-center justify-between"><span>表达是否得体</span><select value={String(appropriateness)} onChange={(event) => setAppropriateness(event.target.value === 'true')} className="rounded border p-1"><option value="true">得体</option><option value="false">不当</option></select></label>
        <label className="flex items-center justify-between"><span>态度是否真诚</span><select value={String(sincerity)} onChange={(event) => setSincerity(event.target.value === 'true')} className="rounded border p-1"><option value="true">真诚</option><option value="false">不真诚</option></select></label>
        <textarea required minLength={10} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="请用至少 10 字说明判断理由。" className="w-full rounded border p-3" />
        {error && <p className="text-xs text-red-700">{error}</p>}
        <div className="flex justify-end"><button disabled={saving || reason.trim().length < 10} className="paper-btn-primary rounded px-4 py-2 disabled:opacity-50">{saving ? '提交中…' : '提交匿名评审'}</button></div>
      </form>
    </article>
  );
}
