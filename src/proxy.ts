import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from '@/lib/session';

export default async function proxy(request: NextRequest) {
  const session = request.cookies.get('task_bot_session')?.value;
  if (await verifySessionToken(session)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!api/auth|api/health|api/slack/oauth/callback|login|_next/static|_next/image|favicon.ico).*)'],
};
