import { NextResponse } from 'next/server';

const configuredUsername = () => process.env.ADMIN_USERNAME || 'admin';
const configuredPassword = () => process.env.ADMIN_PASSWORD || 'admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = typeof body?.username === 'string' ? body.username : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (username !== configuredUsername() || password !== configuredPassword()) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set('task_bot_session', 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('task_bot_session', '', { httpOnly: true, expires: new Date(0), path: '/' });
  return response;
}
