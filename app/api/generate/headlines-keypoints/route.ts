import { NextResponse } from 'next/server';
import { aiProvider } from '@/lib/aiProvider';

export async function POST(req: Request) {
  try {
    const { article } = await req.json();

    if (!article) {
      return NextResponse.json({ error: 'Article is required' }, { status: 400 });
    }

    const prompt = `You are a professional financial news editor specializing in thoughtful, insightful, and click-worthy headlines for a respected financial publication. Based on the following article, generate:

1. THREE different headlines that are PUNCHY, CLICKY, THOUGHTFUL, and INSIGHTFUL
2. TWO key points (each exactly 12 words) that summarize the most important aspects of the story

Article:
${article}

Please format your response exactly as follows:

HEADLINES:
1. [First headline]
2. [Second headline] 
3. [Third headline]

KEY POINTS:
1. [First key point - exactly 12 words]
2. [Second key point - exactly 12 words]

HEADLINE REQUIREMENTS:
- Make headlines PUNCHY and CLICK-WORTHY while remaining THOUGHTFUL and INSIGHTFUL for a financial audience
- ALWAYS start with the primary stock ticker (e.g., "AAPL", "TSLA") or the main person's name (e.g., "Trump", "Powell", "Cook") when possible
- Use sophisticated power words like: "Slams", "Crashes", "Explodes", "Dumps", "Surges", "Warns", "Reveals", "Shocks", "Destroys", "Annihilates", "Transforms", "Revolutionizes", "Disrupts", "Accelerates", "Collapses"
- Include specific numbers, percentages, or dollar amounts when available
- Make them feel urgent and newsworthy while maintaining credibility
- Keep them under 60 characters when possible for social media sharing
- Use emotional triggers that make readers want to click
- NO QUOTES - use direct statements instead
- EVERY WORD should start with a capital letter (Title Case)
- NO EXCLAMATION POINTS - use strong verbs and numbers instead
- Focus on market impact, strategic implications, and financial significance

Examples of good headlines:
- AAPL Slams Analysts With Record Breaking Q4 Earnings
- Trump Warns Fed About Inflation Policy Mistakes
- TSLA Stock Explodes 15 Percent After AI Announcement
- Powell Shocking Rate Decision Sends Markets Into Chaos
- NVDA Transforms Gaming Industry With AI Breakthrough
- Fed Chair Reveals Unexpected Policy Shift Timeline

The key points should capture the most critical information in exactly 12 words each.`;

    const currentProvider = aiProvider.getCurrentProvider();
    const model = currentProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini';
    const maxTokens = currentProvider === 'gemini' ? 8192 : 500;
    
    const aiResponse = await aiProvider.generateCompletion(
      [
        {
          role: "system",
          content: "You are a professional financial news editor with expertise in creating compelling headlines and concise summaries."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      {
        model,
        maxTokens,
        temperature: 0.7,
      }
    );

    const response = aiResponse.content;
    
    // Parse the response to extract headlines and key points
    const headlines: string[] = [];
    const keyPoints: string[] = [];
    
    const lines = response.split('\n');
    let currentSection = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('HEADLINES:')) {
        currentSection = 'headlines';
        continue;
      } else if (trimmedLine.startsWith('KEY POINTS:')) {
        currentSection = 'keypoints';
        continue;
      }
      
      if (currentSection === 'headlines' && trimmedLine.match(/^\d+\./)) {
        const headline = trimmedLine.replace(/^\d+\.\s*/, '').trim();
        if (headline) {
          headlines.push(headline);
        }
      } else if (currentSection === 'keypoints' && trimmedLine.match(/^\d+\./)) {
        const keyPoint = trimmedLine.replace(/^\d+\.\s*/, '').trim();
        if (keyPoint) {
          keyPoints.push(keyPoint);
        }
      }
    }

    return NextResponse.json({
      headlines: headlines.slice(0, 3), // Ensure we only return 3 headlines
      keyPoints: keyPoints.slice(0, 2)  // Ensure we only return 2 key points
    });

  } catch (error: any) {
    console.error('Error generating headlines and key points:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to generate headlines and key points' 
    }, { status: 500 });
  }
}
