import { NextRequest, NextResponse } from 'next/server';

const PASSWORD = process.env.APP_PASSWORD ?? 'miraisince2026';

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({}));
  if (password !== PASSWORD) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set('riq_session', 'ok', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    // no maxAge = session cookie, expires when browser closes
  });
  return res;
}
