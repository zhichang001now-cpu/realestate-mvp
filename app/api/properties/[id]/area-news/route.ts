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

  const prompt = `あなたは日本不動産の投資アナリストです。
以下の地域について、不動産投資に影響を与える最新の開発・計画情報をウェブ検索して日本語で調査してください。

対象エリア: ${location}
物件種別: ${property.property_type ?? 'マンション'}

以下の観点で検索・調査してください:
1. 新設・予定の商業施設（ショッピングモール、大型店舗など）
2. 新設・予定の教育施設（学校、大学）
3. 鉄道・交通インフラ（新駅、路線延伸、バス路線）
4. 大型再開発・都市計画
5. 企業誘致・工場建設

結果をJSON形式で返してください（他のテキストは不要）:
{
  "findings": [
    {
      "category": "交通" | "商業" | "教育" | "再開発" | "産業",
      "title": "短いタイトル",
      "summary": "2〜3文の要約",
      "impact": "positive" | "neutral" | "negative",
      "timeframe": "開業予定や完成時期（不明の場合は null）",
      "source": "情報源URL（あれば）"
    }
  ],
  "overall": "エリア全体の開発動向の総括（2〜3文）"
}
情報が見つからない場合は findings を空配列にしてください。`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search', max_uses: 5 }],
      messages: [{ role: 'user', content: prompt }],
    });

    // Extract final text block
    const textBlock = response.content.findLast(b => b.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ findings: [], overall: '情報を取得できませんでした' });
    const result = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ location, ...result });
  } catch (e) {
    console.error('area-news error:', e);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
