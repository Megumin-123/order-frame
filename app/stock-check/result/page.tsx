'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StockCheckResultRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/stock-check'); }, [router]);
  return <div className="text-center py-12 text-lg">リダイレクト中...</div>;
}
