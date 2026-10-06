import { NextResponse } from 'next/server';
import { getSlackClient } from '@/lib/slack';

export async function GET() {
  const slack = await getSlackClient();
  if (!slack) return NextResponse.json({ error: 'Connect Slack first.' }, { status: 400 });
  try {
    const result = await slack.conversations.list({ types: 'public_channel,private_channel', exclude_archived: true, limit: 200 });
    return NextResponse.json({ channels: (result.channels || []).map(c => ({ id: c.id, name: c.name, is_member: c.is_member })) });
  } catch (error: any) {
    return NextResponse.json({ error: error.data?.error || error.message }, { status: 400 });
  }
}
