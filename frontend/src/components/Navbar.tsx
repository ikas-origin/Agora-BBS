'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { canBlindReview } from '@/lib/capabilities';

export default function Navbar() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query.length < 2) return;
    router.push(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <header className="border-b bg-white shadow-sm">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6 lg:flex-nowrap lg:px-8">
        <div className="shrink-0">
          <Link href="/" className="text-xl font-bold text-gray-900 hover:opacity-80">
            Agora BBS
          </Link>
        </div>

        <form onSubmit={handleSearch} className="order-3 flex w-full min-w-0 flex-1 lg:order-none lg:mx-5 lg:max-w-md">
          <input aria-label="搜索论坛" minLength={2} maxLength={100} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="搜索主题、观点或回复…" className="min-w-0 flex-1 rounded-l-lg border px-3 py-2 text-sm" />
          <button type="submit" className="paper-btn-primary rounded-r-lg px-4 py-2 text-sm">搜索</button>
        </form>

        <nav className="ml-auto flex flex-wrap items-center justify-end gap-3">
          <Link href="/guide" className="text-sm text-gray-600 hover:text-gray-900">使用说明</Link>
          {isLoading ? (
            <div className="h-8 w-24 animate-pulse rounded bg-gray-200" />
          ) : user ? (
            <div className="flex items-center gap-4">
              <Link href="/my-content" className="text-sm text-gray-600 hover:text-gray-900">我的内容</Link>
              <Link href="/bookmarks" className="text-sm text-gray-600 hover:text-gray-900">收藏</Link>
              {canBlindReview(user) && <Link href="/reviews" className="text-sm text-gray-600 hover:text-gray-900">匿名盲审</Link>}
              {user.role === 'admin' && <Link href="/admin" className="text-sm font-semibold text-red-700 hover:text-red-900">进入管理端</Link>}
              <Link href="/profile" className="text-sm text-gray-600 hover:text-gray-900">成长中心</Link>
              <span className="text-sm text-gray-600">
                你好，<strong className="text-gray-900">{user.username}</strong>
              </span>
              <button
                onClick={handleLogout}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
              >
                退出登录
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-1.5"
              >
                登录
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-blue-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
              >
                注册
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
