export interface LineResult {
  success: boolean;
  error?: string;
  statusCode?: number;
}

function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];
  const sections = text.split(/(?=■)/);
  const messages: string[] = [];
  let current = '';
  for (const section of sections) {
    if (current.length + section.length > maxLength && current.length > 0) {
      messages.push(current.trim());
      current = section;
    } else {
      current += section;
    }
  }
  if (current.trim()) messages.push(current.trim());
  return messages.slice(0, 5);
}

export async function sendLinePushMessage(text: string): Promise<LineResult> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const targetId = process.env.LINE_TARGET_GROUP_ID || process.env.LINE_TARGET_USER_ID;

  if (!token) {
    return { success: false, error: 'LINE_CHANNEL_ACCESS_TOKENが設定されていません' };
  }
  if (!targetId) {
    return { success: false, error: 'LINE_TARGET_GROUP_IDまたはLINE_TARGET_USER_IDが設定されていません' };
  }

  const messages = splitMessage(text, 5000);

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        to: targetId,
        messages: messages.map(msg => ({ type: 'text', text: msg })),
      }),
    });

    if (res.ok) {
      return { success: true };
    } else {
      const errorData = await res.json().catch(() => ({}));
      return {
        success: false,
        error: `LINE API エラー: ${res.status} ${JSON.stringify(errorData)}`,
        statusCode: res.status,
      };
    }
  } catch (e) {
    return { success: false, error: `通信エラー: ${e}` };
  }
}
