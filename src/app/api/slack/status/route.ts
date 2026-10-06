import { NextResponse } from 'next/server';
import { getSlackClient, getSlackInstallation } from '@/lib/slack';
import prisma from '@/lib/prisma';

export async function GET() {
  const [installation, config, slack] = await Promise.all([
    getSlackInstallation(),
    prisma.config.findUnique({ where: { id: 'global' }, select: { slackChannel: true } }),
    getSlackClient(),
  ]);
  if (!slack) return NextResponse.json({ connected: false, hasChannel: false });
  let botUserId: string | null = null;
  try { botUserId = (await slack.auth.test()).user_id || null; } catch { /* token may be invalid */ }
  return NextResponse.json({
    connected: Boolean(installation && botUserId),
    teamName: installation?.teamName || null,
    botUserId,
    channelId: config?.slackChannel || '',
    hasChannel: Boolean(config?.slackChannel),
  });
}
