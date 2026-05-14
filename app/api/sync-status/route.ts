import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

// 受注データの最終同期日時を返す。
// サイドバー右下のバッジから呼ばれる軽量エンドポイント。
export async function GET() {
  const { data } = await supabase
    .from('of_sync_log')
    .select('synced_at')
    .eq('status', 'success')
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    lastSyncAt: data ? (data as { synced_at: string }).synced_at : null,
  });
}
