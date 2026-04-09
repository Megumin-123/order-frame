'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OrderEditRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  useEffect(() => { router.replace(`/orders/${id}`); }, [id, router]);
  return <div className="text-center py-12 text-lg">リダイレクト中...</div>;
}
