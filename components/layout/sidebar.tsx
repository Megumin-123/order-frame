'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

const mainNavItems = [
  { href: '/', label: 'ダッシュボード', icon: '📊' },
  { href: '/stock-check', label: '在庫登録', icon: '📋' },
  { href: '/orders', label: '発注書', icon: '📝' },
  { href: '/deliveries', label: '納品一覧', icon: '🚚' },
  { href: '/payments', label: '支払一覧', icon: '💰' },
];

const settingItems = [
  { href: '/products', label: '商品マスタ' },
  { href: '/settings', label: 'システム設定' },
];

export function Sidebar() {
  const pathname = usePathname();
  const [settingsOpen, setSettingsOpen] = useState(
    pathname.startsWith('/products') || pathname.startsWith('/settings')
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const navContent = (
    <>
      {mainNavItems.map((item) => {
        const isActive = item.href === '/'
          ? pathname === '/'
          : pathname.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors',
              isActive
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            )}>
            <span className="text-2xl">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
      <button
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors w-full text-left',
          settingsOpen ? 'text-gray-900' : 'text-gray-700 hover:bg-gray-50'
        )}
        onClick={() => setSettingsOpen(!settingsOpen)}>
        <span className="text-2xl">⚙️</span>
        <span>設定</span>
        <span className="ml-auto text-gray-400">{settingsOpen ? '▼' : '▶'}</span>
      </button>
      {settingsOpen && (
        <div className="ml-8 space-y-1">
          {settingItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={cn(
                  'block px-3 py-2 rounded text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}>
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b px-4 py-3 flex items-center justify-between">
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-lg hover:bg-gray-100">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <h1 className="text-lg font-bold text-gray-900">額縁発注管理</h1>
        <div className="w-10" />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <div className={cn(
        'lg:hidden fixed top-0 left-0 bottom-0 z-40 w-72 bg-white border-r transform transition-transform duration-200',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-gray-900">額縁発注管理</h1>
          <p className="text-sm text-gray-500 mt-1">ハッピービジョン</p>
        </div>
        <nav className="p-4 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 80px)' }}>
          {navContent}
        </nav>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 min-h-screen bg-white border-r border-gray-200 flex-col shrink-0">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">額縁発注管理</h1>
          <p className="text-sm text-gray-500 mt-1">ハッピービジョン</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navContent}
        </nav>
      </aside>
    </>
  );
}
