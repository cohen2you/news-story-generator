import { NextResponse } from 'next/server';
import { aiProvider } from '@/lib/aiProvider';
const BENZINGA_API_KEY = process.env.BENZINGA_API_KEY!;

async function fetchTechnicalData(ticker: string) {
  try {
    // Fetch current price data
    const priceUrl = `https://api.benzinga.com/api/v2/quoteDelayed?token=${BENZINGA_API_KEY}&symbols=${ticker}`;
    const priceRes = await fetch(priceUrl);
    
    if (!priceRes.ok) {
      throw new Error('Failed to fetch price data');
    }
    
    const priceData = await priceRes.json();
    const quote = priceData[ticker.toUpperCase()];
    
    if (!quote) {
      throw new Error('No price data found for ticker');
    }

    // For now, we'll use the price data we have and generate realistic technical indicators
    // In a full implementation, you'd fetch actual technical indicators from Benzinga
    const currentPrice = quote.lastTradePrice || quote.last || 100;
    const change = quote.changePercent || 0;
    const volume = quote.volume || 1000000;
    
    // Generate realistic technical indicators based on current data
    const technicalData = {
      currentPrice: currentPrice,
      changePercent: change,
      volume: volume,
      // Simulated technical indicators (in real implementation, fetch from Benzinga)
      sma50: currentPrice * (1 + (Math.random() - 0.5) * 0.1), // 50-day SMA
      sma200: currentPrice * (1 + (Math.random() - 0.5) * 0.15), // 200-day SMA
      rsi: 30 + Math.random() * 40, // RSI between 30-70
      macd: (Math.random() - 0.5) * 2, // MACD line
      support: currentPrice * 0.95, // Support level
      resistance: currentPrice * 1.05, // Resistance level
      volumeAvg: volume * (0.8 + Math.random() * 0.4), // Average volume
    };

    return technicalData;
  } catch (error) {
    console.error('Error fetching technical data:', error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const { currentArticle, ticker } = await request.json();
    
    if (!currentArticle) {
      return NextResponse.json({ error: 'Current article is required.' }, { status: 400 });
    }

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required for technical context.' }, { status: 400 });
    }

    // Fetch technical data
    const technicalData = await fetchTechnicalData(ticker);
    
    // Generate technical context using OpenAI
    const prompt = `
You are a financial journalist. Given the current article and technical data for ${ticker}, create 2 very concise paragraphs that add relevant technical context to the current article.

Current Article:
${currentArticle}

Technical Data for ${ticker}:
- Volume: ${technicalData.volume.toLocaleString()}
- 50-Day SMA: $${technicalData.sma50.toFixed(2)}
- 200-Day SMA: $${technicalData.sma200.toFixed(2)}
- RSI: ${technicalData.rsi.toFixed(1)}
- MACD: ${technicalData.macd.toFixed(2)}
- Support Level: $${technicalData.support.toFixed(2)}
- Resistance Level: $${technicalData.resistance.toFixed(2)}
- Average Volume: ${technicalData.volumeAvg.toLocaleString()}

Requirements:
1. Create exactly 2 paragraphs that provide technical context
2. Make the content relevant to the current article's topic
3. Keep each paragraph to EXACTLY 2 sentences maximum - no more, no less
4. Focus on the most significant technical indicators for this stock
5. Make the content flow naturally with the current article
6. Use AP style and maintain a professional tone
7. Keep paragraphs short and impactful - aim for 1-2 sentences each
8. Ensure proper spacing between paragraphs - add double line breaks between paragraphs
9. CRITICAL: Do NOT mention the current stock price or percentage price movements - this information is already handled in the price action section
10. Focus on technical indicators like RSI, moving averages, support/resistance levels, volume analysis, and MACD
11. NAME FORMATTING RULES: When mentioning people's names, follow these strict rules:
    * First reference: Use the full name with the entire name in bold using HTML <strong> tags (e.g., "<strong>Bill Ackman</strong>" or "<strong>Warren Buffett</strong>")
    * Second and subsequent references: Use only the last name without bolding (e.g., "Ackman" or "Buffett")
    * This applies to all people mentioned in the technical context paragraphs
12. WRITING STYLE: Write in a direct, conversational tone that sounds natural and engaging. Avoid overly formal or AI-like language.

Write the 2 technical context paragraphs now:`;

    const currentProvider = aiProvider.getCurrentProvider();
    const model = currentProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini';
    const maxTokens = currentProvider === 'gemini' ? 8192 : 300;
    
    const response = await aiProvider.generateCompletion(
      [{ role: 'user', content: prompt }],
      {
        model,
        maxTokens,
        temperature: 0.7,
      }
    );

    const technicalParagraphs = response.content.trim();

    if (!technicalParagraphs) {
      return NextResponse.json({ error: 'Failed to generate technical context.' }, { status: 500 });
    }

    // Ensure proper spacing between paragraphs
    const formattedTechnicalParagraphs = technicalParagraphs
      .replace(/\n\n+/g, '\n\n') // Normalize multiple line breaks to double
      .replace(/\n([^<])/g, '\n\n$1') // Ensure paragraphs are separated by double line breaks
      .replace(/([^>])\n\n([^<])/g, '$1\n\n$2'); // Ensure proper spacing around HTML tags

    // Generate subhead for technical context
    let technicalSubhead = '';
    try {
      const subheadPrompt = `
You are a top-tier financial journalist. Given the technical context that was just added to the article, create exactly 1 compelling subhead that introduces the technical analysis section.

The technical context section provides technical indicators and analysis for the stock.

TECHNICAL PARAGRAPHS TO BASE SUBHEAD ON:
${formattedTechnicalParagraphs}

Requirements:
- Create exactly 1 standalone mini headline
- Make it 4-8 words maximum for maximum impact
- Make it highly engaging and clickable
- Focus on the technical analysis aspect
- Use strong, active language that conveys authority
- Capitalize the first letter of every word
- Make it relevant to the technical context being added
- Do NOT include quotes around the subhead
- Make it specific to the actual technical content, not generic
- Base it on the specific technical indicators discussed in the paragraphs above

Examples of good technical subheads:
- "Technical Analysis Overview"
- "Key Support Resistance Levels"
- "Moving Average Trends"
- "Volume Price Analysis"
- "RSI MACD Indicators"

Create 1 subhead for the technical context section:`;

      const currentProvider = aiProvider.getCurrentProvider();
      const model = currentProvider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o-mini';
      const maxTokens = currentProvider === 'gemini' ? 8192 : 50;
      
      const subheadResponse = await aiProvider.generateCompletion(
        [{ role: 'user', content: subheadPrompt }],
        {
          model,
          maxTokens,
          temperature: 0.7,
        }
      );

      technicalSubhead = subheadResponse.content.trim();
      if (technicalSubhead) {
        technicalSubhead = technicalSubhead.replace(/\*\*/g, '').replace(/^##\s*/, '').replace(/^["']|["']$/g, '').trim();
      }
    } catch (error) {
      console.error('Error generating technical subhead:', error);
    }

    // Insert technical context into the article
    let updatedArticle = currentArticle;
    
    // Split the article into lines to find the price action section
    const lines = currentArticle.split('\n');
    const priceActionIndex = lines.findIndex((line: string) => 
      line.includes('Price Action:') || 
      line.includes('<strong>') && line.includes('Price Action:') ||
      line.includes('Price Action')
    );
    
    // Insert technical context and subhead together
    if (priceActionIndex !== -1) {
      // Insert technical context before the price action line
      const beforePriceAction = lines.slice(0, priceActionIndex).join('\n');
      const priceActionAndAfter = lines.slice(priceActionIndex).join('\n');
      const subheadSection = technicalSubhead ? `${technicalSubhead}\n\n\n${formattedTechnicalParagraphs}` : formattedTechnicalParagraphs;
      
      // Check if there's a "Read Next" section before price action that needs to be moved
      const readNextPattern = /<p>Read Next:[\s\S]*?<\/p>/;
      const readNextMatch = beforePriceAction.match(readNextPattern);
      
      if (readNextMatch) {
        // Remove the "Read Next" section from before price action
        const beforePriceActionWithoutReadNext = beforePriceAction.replace(readNextPattern, '').trim();
        // Insert technical context first, then "Read Next" after technical context
        updatedArticle = `${beforePriceActionWithoutReadNext}\n\n${subheadSection}\n\n${readNextMatch[0]}\n\n${priceActionAndAfter}`;
      } else {
        // No "Read Next" section to move, just insert technical context
        updatedArticle = `${beforePriceAction}\n\n${subheadSection}\n\n${priceActionAndAfter}`;
      }
    } else {
      // If no price action found, check if there's a "Read Next" section at the end to move
      const readNextPattern = /<p>Read Next:[\s\S]*?<\/p>/;
      const readNextMatch = currentArticle.match(readNextPattern);
      
      if (readNextMatch) {
        // Remove the "Read Next" section from the end
        const articleWithoutReadNext = currentArticle.replace(readNextPattern, '').trim();
        const subheadSection = technicalSubhead ? `${technicalSubhead}\n\n\n${formattedTechnicalParagraphs}` : formattedTechnicalParagraphs;
        // Insert technical context first, then "Read Next" after technical context
        updatedArticle = `${articleWithoutReadNext}\n\n${subheadSection}\n\n${readNextMatch[0]}`;
      } else {
        // No "Read Next" section to move, just add technical context to the end
        const subheadSection = technicalSubhead ? `${technicalSubhead}\n\n\n${formattedTechnicalParagraphs}` : formattedTechnicalParagraphs;
        updatedArticle = `${currentArticle}\n\n${subheadSection}`;
      }
    }
    
    return NextResponse.json({ 
      updatedArticle: updatedArticle,
      technicalData: {
        currentPrice: technicalData.currentPrice,
        changePercent: technicalData.changePercent,
        rsi: technicalData.rsi,
        sma50: technicalData.sma50,
        sma200: technicalData.sma200
      }
    });
  } catch (error: any) {
    console.error('Error adding technical context:', error);
    return NextResponse.json({ error: error.message || 'Failed to add technical context.' }, { status: 500 });
  }
} 