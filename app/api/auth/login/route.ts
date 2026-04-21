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
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
  return res;
}
