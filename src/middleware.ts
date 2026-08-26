import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  // If the ADMIN_PASSWORD environment variable is not set, allow public access
  const password = process.env.ADMIN_PASSWORD
  if (!password) {
    return NextResponse.next()
  }

  // Check for the Authorization header
  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' }
    })
  }

  try {
    // Parse the Basic Auth header
    const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString()
    const [_, providedPassword] = auth.split(':')

    if (providedPassword === password) {
      return NextResponse.next()
    }
  } catch (e) {
    // Malformed header
  }

  // Incorrect password
  return new NextResponse('Invalid password', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' }
  })
}

export const config = {
  // Apply middleware to all routes EXCEPT the Slack webhook/API, static files, and images
  matcher: ['/((?!api/test-bot|_next/static|_next/image|favicon.ico).*)']
}
