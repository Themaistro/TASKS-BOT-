import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default function proxy(req: NextRequest) {
  const session = req.cookies.get('task_bot_session')?.value;
  if (session === 'authenticated') {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL('/login', req.url));
}

export const config = {
  matcher: ['/((?!api/auth|api/health|api/test-bot|api/slack/oauth|login|_next/static|_next/image|favicon.ico).*)']
}
