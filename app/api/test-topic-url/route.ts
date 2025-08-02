import { NextResponse } from 'next/server';
import { generateTopicUrl, shouldLinkToTopic } from '../../../lib/api';

export async function POST(req: Request) {
  try {
    const { phrase, sourceUrl } = await req.json();
    
    if (!phrase) {
      return NextResponse.json({ error: 'Phrase is required' }, { status: 400 });
    }
    
    const shouldLink = shouldLinkToTopic(phrase, sourceUrl);
    const topicUrl = shouldLink ? await generateTopicUrl(phrase) : null;
    
    return NextResponse.json({
      phrase,
      sourceUrl,
      shouldLinkToTopic: shouldLink,
      topicUrl,
      explanation: shouldLink 
        ? `"${phrase}" should link to a topic page because it contains topic indicators`
        : `"${phrase}" should link to the source URL because it doesn't contain topic indicators`
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to test topic URL generation' }, { status: 500 });
  }
} 