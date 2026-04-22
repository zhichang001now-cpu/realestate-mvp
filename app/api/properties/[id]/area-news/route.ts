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

  const prompt = `${location}周辺の不動産投資に関係する最新の開発・再開発・インフラ情報を、日経新聞（nikkei.com）・NHK（nhk.or.jp）・読売新聞（yomiuri.co.jp）・朝日新聞（asahi.com）・Yahoo!ニュース（news.yahoo.co.jp）・東洋経済（toyokeizai.net）などの信頼性の高いメディアから検索してください。

以下のJSON形式のみで回答してください（前置き・説明不要）:
{"summary":"投資判断に役立つ1〜2文の日本語まとめ","source_title":"記事タイトル","source_url":"記事の実際のURL"}

該当記事が見つからない場合: {"summary":"該当エリアの最新開発情報は主要メディアで確認できませんでした","source_title":null,"source_url":null}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 5 }],
      messages: [{ role: 'user', content: prompt }],
    });

    const textBlock = response.content.findLast(b => b.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text.trim() : '';

    let summary = '情報を取得できませんでした';
    let source_title: string | null = null;
    let source_url: string | null = null;
    try {
      const fenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      const raw = fenceMatch?.[1] ?? text.match(/\{[\s\S]*\}/)?.[0];
      if (raw) ({ summary, source_title, source_url } = JSON.parse(raw));
    } catch { summary = text || '情報を取得できませんでした'; }

    return NextResponse.json({ location, summary, source_title, source_url });
  } catch (e) {
    console.error('area-news error:', e);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
