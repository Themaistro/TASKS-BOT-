import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = request.headers.get('cookie')?.match(/(?:^|; )slack_oauth_state=([^;]+)/)?.[1];
  const redirectUri = process.env.SLACK_REDIRECT_URI || `${url.origin}/api/slack/oauth/callback`;

  if (!code || !state || !cookieState || state !== cookieState) return NextResponse.redirect(new URL('/?slack=error&reason=invalid_state', request.url));
  if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_CLIENT_SECRET) return NextResponse.redirect(new URL('/?slack=error&reason=not_configured', request.url));

  const body = new URLSearchParams({ code, client_id: process.env.SLACK_CLIENT_ID, client_secret: process.env.SLACK_CLIENT_SECRET, redirect_uri: redirectUri });
  const exchange = await fetch('https://slack.com/api/oauth.v2.access', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store' });
  const result = await exchange.json();
  if (!result.ok || !result.access_token || !result.team?.id) return NextResponse.redirect(new URL('/?slack=error&reason=exchange_failed', request.url));

  await prisma.slackInstallation.upsert({
    where: { id: 'global' },
    update: { teamId: result.team.id, teamName: result.team.name || result.team.id, botToken: result.access_token, scopes: result.scope || '' },
    create: { id: 'global', teamId: result.team.id, teamName: result.team.name || result.team.id, botToken: result.access_token, scopes: result.scope || '' },
  });

  const response = NextResponse.redirect(new URL('/?slack=connected', request.url));
  response.cookies.set('slack_oauth_state', '', { expires: new Date(0), path: '/' });
  return response;
}
