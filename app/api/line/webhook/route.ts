import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  const events = body.events || [];

  for (const event of events) {
    if (event.type === 'message' && event.source?.groupId) {
      const groupId = event.source.groupId;
      const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

      if (token) {
        await fetch('https://api.line.me/v2/bot/message/reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            replyToken: event.replyToken,
            messages: [{ type: 'text', text: `グループID: ${groupId}` }],
          }),
        });
      }
    }
  }

  return NextResponse.json({ status: 'ok' });
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
