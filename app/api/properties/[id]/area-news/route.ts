import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sql = getDb();

  const [property] = await sql`SELECT prefecture, city, property_type FROM properties WHERE id = ${params.id}`;
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let prefecture = (property.prefecture as string) ?? '';
  let city = (property.city as string) ?? '';

  // If city is missing, try to derive from address_extracted in property_extractions
  if (!city) {
    const [ext] = await sql`SELECT address_extracted FROM property_extractions WHERE property_id = ${params.id} ORDER BY created_at DESC LIMIT 1`;
    const addr = (ext?.address_extracted as string) ?? '';
    if (addr) {
      const prefMatch = addr.match(/(.{2,3}[都道府県])/);
      const cityMatch = addr.match(/[都道府県](.+?[市区町村])/);
      if (prefMatch) prefecture = prefMatch[1];
      if (cityMatch) city = cityMatch[1];
    }
  }

  if (!city && !prefecture) return NextResponse.json({ error: 'エリア情報がありません。まずPDFをアップロードしてAI抽取してください。' }, { status: 422 });

  const location = prefecture || city ? `${prefecture}${city}` : '';
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `${location}周辺の不動産投資に関係する最新の開発・再開発・インフラ情報をウェブ検索して、投資判断に役立つ内容を1〜2文の日本語で簡潔にまとめてください。余計な前置きや説明は不要です。結論だけ答えてください。`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 5 }],
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.findLast(b => b.type === 'text');
    const summary = textBlock?.type === 'text' ? textBlock.text.trim() : '情報を取得できませんでした';

    return NextResponse.json({ location, summary });
  } catch (e) {
    console.error('area-news error:', e);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
