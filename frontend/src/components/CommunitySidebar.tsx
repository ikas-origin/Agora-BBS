import Link from 'next/link';
import { GovernancePolicy, Topic, UserProfile } from '@/types/api';
import { formatReadingDuration } from '@/lib/format';
import { canBlindReview, capabilityLabel } from '@/lib/capabilities';

export default function CommunitySidebar({ user, topics, topicTotal, categoryCount, policy }: { user: UserProfile | null; topics: Topic[]; topicTotal: number; categoryCount: number; policy: GovernancePolicy | null }) {
  const popular = [...topics].sort((a, b) => (b.post_count * 3 + b.view_count) - (a.post_count * 3 + a.view_count)).slice(0, 3);
  return (
    <aside className="space-y-4 xl:sticky xl:top-6">
      {user ? <section className="paper-card rounded-xl p-4">
        <div className="flex items-center justify-between"><h2 className="font-bold">我的成长</h2><span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-bold text-[var(--accent-ink)]">L{user.unlock_level}</span></div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">有效阅读 {formatReadingDuration(user.verified_read_seconds)}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">{user.capabilities.map((item) => <span key={item} className="rounded bg-stone-100 px-2 py-1 text-[11px]">{capabilityLabel(item)}</span>)}</div>
        <Link href="/profile" className="mt-4 block text-xs font-semibold text-[var(--accent-ink)] hover:underline">查看成长条件 →</Link>
      </section> : <section className="rounded-xl bg-stone-900 p-4 text-stone-50"><h2 className="font-bold">加入讨论</h2><p className="mt-2 text-xs leading-5 text-stone-300">注册后可以收藏主题，并通过有效阅读逐步解锁讨论权限。</p><Link href="/register" className="mt-4 inline-block rounded bg-stone-50 px-3 py-2 text-xs font-bold text-stone-900">创建账号</Link></section>}

      <section className="paper-card rounded-xl p-4">
        <h2 className="font-bold">社区概览</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center"><div className="rounded bg-stone-100 p-3"><strong className="block text-lg">{topicTotal}</strong><span className="text-[11px] text-[var(--text-muted)]">当前主题</span></div><div className="rounded bg-stone-100 p-3"><strong className="block text-lg">{categoryCount}</strong><span className="text-[11px] text-[var(--text-muted)]">讨论分类</span></div></div>
      </section>

      {popular.length > 0 && <section className="paper-card rounded-xl p-4"><h2 className="font-bold">本页热议</h2><div className="mt-3 space-y-3">{popular.map((topic, index) => <Link key={topic.id} href={`/topics/${topic.id}`} className="flex gap-2 text-xs leading-5 hover:text-[var(--accent-ink)]"><span className="font-bold text-[var(--accent-ink)]">{index + 1}</span><span className="line-clamp-2">{topic.title}</span></Link>)}</div></section>}

      <section className="paper-card rounded-xl p-4"><h2 className="font-bold">快捷入口</h2><div className="mt-3 grid gap-2 text-xs">{user ? <><Link href="/bookmarks" className="rounded bg-stone-100 px-3 py-2 hover:text-[var(--accent-ink)]">我的收藏</Link><Link href="/profile" className="rounded bg-stone-100 px-3 py-2 hover:text-[var(--accent-ink)]">成长中心</Link>{canBlindReview(user) && <Link href="/reviews" className="rounded bg-stone-100 px-3 py-2 hover:text-[var(--accent-ink)]">待办匿名盲审</Link>}</> : <Link href="/login" className="rounded bg-stone-100 px-3 py-2 hover:text-[var(--accent-ink)]">登录已有账号</Link>}</div></section>

      <section className="paper-card rounded-xl p-4"><h2 className="font-bold">社区节奏</h2><ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--text-muted)]"><li>内容提交后有 {policy ? `${policy.cooling_seconds} 秒` : '一段'}冷静期。</li><li>长文回复前需读到底并停留{policy ? ` ${policy.reply_dwell_seconds} 秒` : ''}。</li><li>反馈需要选择语境标签并说明理由。</li></ul></section>

      <section className="paper-card rounded-xl p-4"><h2 className="font-bold">关于 Agora BBS</h2><p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">一个强调先阅读、再回应的结构化讨论社区。</p><Link href="/guide" className="mt-3 block text-xs font-semibold text-[var(--accent-ink)] hover:underline">阅读使用手册 →</Link></section>
    </aside>
  );
}
