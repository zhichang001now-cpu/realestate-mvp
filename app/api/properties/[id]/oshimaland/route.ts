import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sql = getDb();

  const [extraction] = await sql`
    SELECT address_extracted FROM property_extractions
    WHERE property_id = ${params.id} ORDER BY created_at DESC LIMIT 1
  `;

  const [property] = await sql`SELECT city, prefecture FROM properties WHERE id = ${params.id}`;

  const address = (extraction?.address_extracted as string)
    ?? `${property?.prefecture ?? ''}${property?.city ?? ''}`;

  if (!address) return NextResponse.json({ error: 'Address not set' }, { status: 422 });

  // Build Oshimaland search URL
  const searchUrl = `https://www.oshimaland.co.jp/?address=${encodeURIComponent(address)}`;

  // Try server-side fetch to check for records
  try {
    const res = await fetch(`https://www.oshimaland.co.jp/search_address?address=${encodeURIComponent(address)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/html',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const text = await res.text();
      // Look for property listings in response
      const hasResults = text.includes('jiko') || text.includes('事故') ||
        (text.includes('address') && text.includes('result') && !text.includes('"count":0'));
      return NextResponse.json({
        address,
        searchUrl,
        checked: true,
        hasRecord: hasResults,
        status: hasResults ? 'record_found' : 'clean',
      });
    }
  } catch {
    // Fallback: return link only
  }

  // Fallback: just return the search link for manual check
  return NextResponse.json({
    address,
    searchUrl,
    checked: false,
    hasRecord: null,
    status: 'manual_check',
  });
}
