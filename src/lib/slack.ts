import { WebClient } from '@slack/web-api';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

function localEnv(name: string) {
  try {
    const line = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8').split(/\r?\n/).find(row => row.trim().startsWith(`${name}=`));
    return line?.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '') || '';
  } catch { return ''; }
}

export async function getSlackClient() {
  const manualToken = localEnv('SLACK_BOT_TOKEN') || process.env.SLACK_BOT_TOKEN;
  if (manualToken) return new WebClient(manualToken);
  const installation = await prisma.slackInstallation.findUnique({ where: { id: 'global' } });
  const token = installation?.botToken;
  return token ? new WebClient(token) : null;
}

export async function getSlackInstallation() {
  try {
    return await prisma.slackInstallation.findUnique({
      where: { id: 'global' },
      select: { teamId: true, teamName: true, scopes: true, installedAt: true, updatedAt: true },
    });
  } catch { return null; }
}
