import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function GET() {
  const { data } = await supabase.from('of_settings').select('key, value');
  const settings: Record<string, string> = {};
  (data || []).forEach((r: { key: string; value: string }) => { settings[r.key] = r.value; });
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const body = await request.json();
  for (const [key, value] of Object.entries(body)) {
    await supabase.from('of_settings').upsert({ key, value: String(value) });
  }
  return NextResponse.json({ success: true });
}
