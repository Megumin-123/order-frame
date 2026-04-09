'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useState } from 'react';

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

  return (
    <aside className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div className="px-4 pt-5 pb-4 border-b border-gray-200">
        <div className="flex justify-center mb-2">
          <Image src="/logo.jpg" alt="KAWAII ART" width={80} height={100} className="object-contain" />
        </div>
        <h1 className="text-lg font-bold text-gray-800 text-center tracking-wide">発注管理</h1>
      </div>
      <nav className="flex-1 p-4 space-y-2">
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
      </nav>
      <div className="p-4 border-t border-gray-100">
        <p className="text-center text-xs tracking-widest text-gray-400 uppercase">Happy Vision</p>
      </div>
    </aside>
  );
}
