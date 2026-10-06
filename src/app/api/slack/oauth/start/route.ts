import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export async function GET(request: Request) {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = process.env.SLACK_REDIRECT_URI || `${new URL(request.url).origin}/api/slack/oauth/callback`;
  if (!clientId) {
    return new NextResponse(`<!doctype html><html><head><title>Slack setup required</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;color:#172033;display:grid;place-items:center;min-height:100vh"><main style="max-width:520px;margin:24px;padding:32px;border-radius:20px;background:white;box-shadow:0 16px 50px #17203322"><div style="font-size:38px">🔗</div><h1 style="margin:12px 0 8px">Slack connection is not ready</h1><p style="line-height:1.6;color:#526071">The app is running, but the host has not connected it to a Slack app yet. Add the Slack Client ID and Client Secret to the server settings, then try again.</p><div style="padding:16px;border-radius:12px;background:#f1f5ff;color:#303f87;font-size:14px;line-height:1.7"><b>Host setup required</b><br>SLACK_CLIENT_ID<br>SLACK_CLIENT_SECRET<br>SLACK_REDIRECT_URI</div><p style="font-size:13px;color:#687386">Callback URL: <code>${redirectUri}</code></p><a href="/" style="display:inline-block;margin-top:10px;padding:12px 18px;border-radius:10px;background:#4a154b;color:white;text-decoration:none;font-weight:bold">Return to Task Bot</a></main></body></html>`, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  const state = randomUUID();
  const authorize = new URL('https://slack.com/oauth/v2/authorize');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('scope', 'chat:write,channels:read,groups:read,im:write,users:read');
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('state', state);

  const response = NextResponse.redirect(authorize);
  response.cookies.set('slack_oauth_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/' });
  return response;
}
