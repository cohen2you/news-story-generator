import { NextResponse } from 'next/server';
import { MODEL_CONFIG, generateTopicUrl, shouldLinkToTopic } from '../../../../lib/api';
import { aiProvider } from '@/lib/aiProvider';

const BENZINGA_API_KEY = process.env.BENZINGA_API_KEY!;
const BZ_NEWS_URL = 'https://api.benzinga.com/api/v2/news';
const MODEL = 'gpt-4o';

// Helper function to get current date in readable format
function getCurrentDate(): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  return now.toLocaleDateString('en-US', options);
}

// Helper function to extract outlet name from URL
function getOutletNameFromUrl(url: string): string {
  if (!url) return 'The company';
  
  try {
    const hostname = new URL(url).hostname;
    const domain = hostname.replace(/^www\./, '');
    const parts = domain.split('.');
    
    if (parts.length >= 2) {
      const name = parts[0].toLowerCase();
      // Map common outlet names
      const outletMap: Record<string, string> = {
        'cnbc': 'CNBC',
        'reuters': 'Reuters',
        'bloomberg': 'Bloomberg',
        'benzinga': 'Benzinga',
        'yahoo': 'Yahoo Finance',
        'marketwatch': 'MarketWatch',
        'wsj': 'The Wall Street Journal',
        'nytimes': 'The New York Times',
        'forbes': 'Forbes',
        'fortune': 'Fortune',
        'businessinsider': 'Business Insider',
        'techcrunch': 'TechCrunch',
        'seekingalpha': 'Seeking Alpha',
        'investing': 'Investing.com',
        'finance': 'Yahoo Finance'
      };
      
      return outletMap[name] || name.charAt(0).toUpperCase() + name.slice(1);
    }
    return 'The company';
  } catch {
    return 'The company';
  }
}

async function fetchRelatedArticles(ticker: string, excludeUrl?: string): Promise<any[]> {
  try {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 7);
    const dateFromStr = dateFrom.toISOString().slice(0, 10);
    
    let url: string;
    
    if (ticker && ticker.trim() !== '') {
      // Fetch ticker-specific articles
      url = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&tickers=${encodeURIComponent(ticker)}&items=20&fields=headline,title,created,url,channels&accept=application/json&displayOutput=full&dateFrom=${dateFromStr}`;
    } else {
      // Fetch general market news when no ticker is provided
      url = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&items=20&fields=headline,title,created,url,channels&accept=application/json&displayOutput=full&dateFrom=${dateFromStr}`;
    }
    
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    
    if (!res.ok) {
      console.error('Benzinga API error:', await res.text());
      return [];
    }
    
    const data = await res.json();
    console.log('Benzinga API response type:', typeof data, Array.isArray(data) ? 'array' : 'not array');
    console.log('Benzinga API response length:', Array.isArray(data) ? data.length : 'N/A');
    if (!Array.isArray(data)) return [];
    
    // Filter out press releases and the current article URL
    const prChannelNames = ['press releases', 'press-releases', 'pressrelease', 'pr'];
    const normalize = (str: string) => str.toLowerCase().replace(/[-_]/g, ' ');
    
    const filteredArticles = data.filter(item => {
      // Exclude press releases
      if (Array.isArray(item.channels) && item.channels.some((ch: any) => 
        typeof ch.name === 'string' && prChannelNames.includes(normalize(ch.name))
      )) {
        return false;
      }
      
      // Exclude the current article URL if provided
      if (excludeUrl && item.url === excludeUrl) {
        return false;
      }
      
      return true;
    });
    
    console.log('Articles after filtering:', filteredArticles.length);
    
    const relatedArticles = filteredArticles
      .map((item: any) => ({
        headline: item.headline || item.title || '[No Headline]',
        url: item.url,
        created: item.created,
      }))
      .slice(0, 5);
    
    console.log('Final related articles:', relatedArticles.length);
    return relatedArticles;
  } catch (error) {
    console.error('Error fetching related articles:', error);
    return [];
  }
}

function extractKeyTopics(text: string): string[] {
  // Remove HTML tags and get clean text
  const cleanText = text.replace(/<[^>]*>/g, '');
  
  // Extract company names, ticker symbols, and key terms
  const topics: string[] = [];
  
  // Look for ticker symbols (NYSE: XXX format)
  const tickerMatch = cleanText.match(/NYSE:\s*([A-Z]+)/);
  if (tickerMatch) {
    topics.push(tickerMatch[1]);
  }
  
  // Look for company names (words that start with capital letters, but avoid incomplete phrases)
  const companyMatches = cleanText.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g);
  if (companyMatches) {
    // Filter out common words, incomplete phrases, and add unique company names
    const commonWords = ['The', 'And', 'Or', 'But', 'For', 'With', 'From', 'This', 'That', 'They', 'Have', 'Will', 'Said', 'According', 'Recently', 'Today'];
    const companies = companyMatches.filter(word => 
      !commonWords.includes(word) && 
      word.length > 2 && 
      !word.includes('(') && !word.includes(')') && !word.includes(':') &&
      !topics.includes(word)
    );
    topics.push(...companies.slice(0, 3)); // Limit to top 3 companies
  }
  
  // Look for key financial terms and phrases
  const financialTerms = ['investor', 'stock', 'market', 'trading', 'earnings', 'revenue', 'profit', 'analyst', 'rating', 'price target', 'investment', 'long term', 'potential'];
  financialTerms.forEach(term => {
    if (cleanText.toLowerCase().includes(term) && !topics.includes(term)) {
      topics.push(term);
    }
  });
  
  // Look for specific phrases that would make good topics
  const specificPhrases = ['Jim Cramer', 'CNBC', 'online used car', 'used car dealer'];
  specificPhrases.forEach(phrase => {
    if (cleanText.toLowerCase().includes(phrase.toLowerCase()) && !topics.includes(phrase)) {
      topics.push(phrase);
    }
  });
  
  return topics.slice(0, 5); // Return top 5 topics
}

function buildPrompt({ ticker, sourceText, analystSummary, priceSummary, priceActionDay, sourceUrl, sourceDateFormatted, relatedArticles, includeCTA, ctaText, includeSubheads, subheadTexts, inputMode = 'news' }: { ticker: string; sourceText: string; analystSummary: string; priceSummary: string; priceActionDay?: string; sourceUrl?: string; sourceDateFormatted?: string; relatedArticles?: any[]; includeCTA?: boolean; ctaText?: string; includeSubheads?: boolean; subheadTexts?: string[]; inputMode?: string }) {
  
  console.log('buildPrompt called with sourceUrl:', sourceUrl);
  console.log('sourceUrl type:', typeof sourceUrl);
  console.log('sourceUrl length:', sourceUrl?.length);
  
  // Check if this is an analyst note - make detection more specific
  const isAnalystNote = (sourceText.includes('Samik Chatterjee') && sourceText.includes('J P M O R G A N')) || 
                       (sourceText.includes('analyst') && sourceText.includes('J.P. Morgan') && sourceText.includes('Overweight'));
  
  // Extract key analyst information if this is an analyst note
  let analystInfo = '';
  if (isAnalystNote) {
    const analystMatch = sourceText.match(/Samik Chatterjee, CFA/);
    const firmMatch = sourceText.match(/J\.P\. Morgan|J P M O R G A N/);
    const ratingMatch = sourceText.match(/Overweight/);
    
    // Extract price targets - look for patterns like "raised to $200 from $185" or "to $200"
    const priceTargetPatterns = [
      /\$(\d+)\s+from\s+\$(\d+)/i,  // "to $200 from $185"
      /raised.*?\$(\d+).*?\$(\d+)/i, // "raised to $200 from $185"
      /target.*?\$(\d+).*?\$(\d+)/i, // "target to $200 from $185"
    ];
    
    let currentPriceTarget = '';
    let previousPriceTarget = '';
    
    for (const pattern of priceTargetPatterns) {
      const match = sourceText.match(pattern);
      if (match) {
        currentPriceTarget = '$' + match[1];
        previousPriceTarget = '$' + match[2];
        break;
      }
    }
    
    // If no previous target found, look for single price target
    if (!currentPriceTarget) {
      const singleTargetMatch = sourceText.match(/\$(\d+)/);
      if (singleTargetMatch) {
        currentPriceTarget = '$' + singleTargetMatch[1];
      }
    }
    
    const dateMatch = sourceText.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
    
    analystInfo = `
EXTRACTED ANALYST INFORMATION:
- Analyst: ${analystMatch ? 'Samik Chatterjee, CFA' : 'Not found'}
- Firm: ${firmMatch ? 'J.P. Morgan' : 'Not found'}
- Rating: ${ratingMatch ? 'Overweight' : 'Not found'}
- Current Price Target: ${currentPriceTarget || 'Not found'}
- Previous Price Target: ${previousPriceTarget || 'Not found'}
- Date: ${dateMatch ? `${dateMatch[2]} ${dateMatch[1]}, ${dateMatch[3]}` : 'Not found'}

YOU MUST USE THIS INFORMATION IN YOUR ARTICLE.
`;
  }
  
  return `You are a professional financial news writer for Benzinga.

CRITICAL QUOTE REQUIREMENT: 
You MUST include at least one direct quote from the source material. Look for text that appears in quotation marks in the source and include it exactly as written. This is MANDATORY and takes priority over other instructions. If no quotes exist in the source, you must still include at least one direct quote from the person being discussed.

**BENZINGA NEWS STYLE - MANDATORY:**
Write the story in a tight, data-driven Benzinga news style. Follow these rules:

**STRUCTURE - Keep it clean and linear:**
Lead → Confirmation + Sources → Market Context → Operational Drivers → Forward-Looking Statements.

**CRITICAL CONTENT RULES:**
- Do NOT repeat facts, themes, or quotes anywhere in the story. Each piece of information should appear only once.
- Do NOT broaden the narrative beyond the core topic. Avoid side tangents (e.g., unrelated industry shifts, consumer deals, secondary partnerships) unless they directly support the valuation or market impact.
- Keep paragraphs short and focused. Each paragraph should deliver ONE idea only.
- Use specific financial details, metrics, subscriber counts, revenue figures, contract information, or valuation numbers to ground the story. Avoid vague statements.
- Avoid generic or motivational framing. Do NOT restate the same point in different wording.
- Do NOT over-explain or add background unrelated to the core valuation/IPO/news story.
- Maintain a crisp, newsroom tone — fast pacing, clean transitions, no filler.
- No narrative drift. If a fact cannot be tied directly to valuation, market relevance, or growth engines, exclude it.

Write a concise, fact-based news article (about 350 words)${ticker && ticker.trim() !== '' ? ` about the stock with ticker: ${ticker}` : ''}. Use the provided press release, news article, or analyst note text as your main source${ticker && ticker.trim() !== '' ? `, but focus only on information relevant to ${ticker}` : ''}. Ignore other tickers or companies mentioned in the source text.

IMPORTANT: If the source text appears to be an analyst note (contains analyst names, firm names, ratings, price targets, or financial analysis), prioritize extracting and using the specific analyst insights, forecasts, and reasoning from the note rather than generic analyst summary data. 

CRITICAL FOR ANALYST NOTES: Extract and include the analyst's name, firm, specific analysis points, financial forecasts, investment thesis, and key reasoning directly from the source text. Do not rely on the analyst summary data if the source text contains detailed analyst information.

IMPORTANT: The source text below contains the full analyst note. Extract all relevant analyst information, including names, ratings, price targets, analysis, and reasoning directly from this source text. Do not use any external analyst summary data.

${isAnalystNote ? 'CRITICAL: THIS IS AN ANALYST NOTE. You MUST extract and include the analyst name (Samik Chatterjee, CFA), firm name (J.P. Morgan), rating (Overweight), price target ($200), and specific analysis from the source text below. Do not write generic content.' : ''}

${analystInfo}

CRITICAL FORMATTING RULES:
- NO paragraph should be longer than 2 sentences
- Break up any long paragraphs into multiple shorter ones
- Use HTML tags for formatting, not markdown

Structure your article as follows:
- Headline: Write a clear, engaging headline in the style of these examples (do not use bold, asterisks, or markdown headings such as # or ##; the headline should be plain text only):
  - Federal Reserve Governor Adriana Kugler Resigns: What This Means
  - Fed Governor Kugler Steps Down: Impact on Interest Rate Policy

- Lead paragraph: Start with the most important news event or development from the source text. Focus on what happened, not on stock price movement. Use the full company name and ticker in this format: <strong>Company Name</strong> (NYSE: TICKER) if a specific company is involved, or focus on the news event itself if it's broader market news. The company name should be bolded using HTML <strong> tags. Do not use markdown bold (**) or asterisks elsewhere. State what happened and why it matters. CRITICAL: Do NOT include analyst names (like "Samik Chatterjee" or "J.P. Morgan analyst") in the lead paragraph. The lead should focus on the news event itself, not specific analyst details or stock price movements. 

NOTE: Hyperlinks will be added separately using the "Add Lead Hyperlink" feature for better control and relevance.

CRITICAL: The lead paragraph must be exactly 2 sentences maximum. If you have more information, create additional paragraphs.

- IMPORTANT: In your lead, ALWAYS identify the specific day when the news occurred. If the source text mentions a specific date, use that date. If no specific date is mentioned, use today's date (${getCurrentDate()}). NEVER use "recently" - always specify the actual day. Do not force price movement timing if the news is not about stock price changes.

- NAME FORMATTING RULES: When mentioning people's names, follow these strict rules:
  * First reference: Use the full name with the entire name in bold using HTML <strong> tags (e.g., "President <strong>Donald Trump</strong>" or "CEO <strong>Tim Cook</strong>")
  * Second and subsequent references: Use only the last name without bolding (e.g., "Trump" or "Cook")
  * This applies to all people mentioned in the article, including politicians, executives, analysts, etc.
  * Exception: Analyst names in analyst notes should follow the specific analyst note formatting rules below

- DATE AND MONTH FORMATTING: Always capitalize month names (January, February, March, April, May, June, July, August, September, October, November, December). Never use lowercase for month names.

- Additional paragraphs: Provide factual details, context, and any relevant quotes${ticker && ticker.trim() !== '' ? ` about ${ticker}` : ''}. MANDATORY: Include at least one direct quote from the source material using quotation marks. If multiple relevant quotes exist, include up to two quotes. Look for text in the source that is already in quotation marks and use those exact quotes. When referencing the source material, if a specific date is available, mention it (e.g., "In a press release dated ${sourceDateFormatted}" or "According to the ${sourceDateFormatted} announcement"). If no specific date is available, use today's date (${getCurrentDate()}). NEVER use "recently" - always specify the actual day. If the source is an analyst note, include specific details about earnings forecasts, financial estimates, market analysis, and investment reasoning from the note. 

${inputMode === 'pr' ? `
CRITICAL PRESS RELEASE HYPERLINK RULE: You MUST include a three-word hyperlink to the press release in the lead paragraph. ${sourceUrl ? `The lead paragraph MUST contain exactly one hyperlink using this exact format: <a href="${sourceUrl}">three word phrase</a> - where "three word phrase" is a relevant three-word phrase from the sentence (e.g., "press release states", "company announcement", "official statement"). Embed this hyperlink naturally within the sentence flow, not at the end.` : 'The lead paragraph MUST contain a reference to the press release if a URL is provided.'}

CRITICAL PRESS RELEASE FORMATTING: This is an internal press release, so do NOT include any external source attributions like "reports" or "according to [publication]". The press release is the primary source.
` : `
CRITICAL SOURCE ATTRIBUTION RULE: You MUST include a source attribution in the second paragraph (immediately after the lead paragraph). ${sourceUrl ? (() => { const outletName = getOutletNameFromUrl(sourceUrl); console.log('Generated outlet name:', outletName, 'for URL:', sourceUrl); return `The second paragraph MUST begin with: "${outletName} <a href="${sourceUrl}">reports</a>" - you MUST include the complete HTML hyperlink format exactly as shown, but do NOT add a period after the hyperlink. Continue the sentence naturally after the hyperlink.`; })() : 'The second paragraph MUST begin with: "The company reports."'}

CRITICAL SECOND SOURCE ATTRIBUTION RULE: You MUST include a second source attribution in the second half of the article (around paragraph 4-6, depending on article length). ${sourceUrl ? (() => { const outletName = getOutletNameFromUrl(sourceUrl); console.log('Generated outlet name for second attribution:', outletName); return `In the second half of the article, include a natural reference like: "according to ${outletName}" or "as reported by ${outletName}" or "as ${outletName} noted" - this should be integrated naturally into the sentence flow, not as a standalone attribution.`; })() : 'In the second half of the article, include a natural reference like: "according to the company" or "as the company noted" - this should be integrated naturally into the sentence flow.'}
`}

CRITICAL: Each paragraph must be no longer than 2 sentences. If you have more information, create additional paragraphs.

${includeCTA && ctaText ? `
- CTA Integration: After the lead paragraph, insert the following CTA exactly as provided:
  ${ctaText}
` : ''}

${includeSubheads && subheadTexts && subheadTexts.length > 0 ? `
- Subhead Integration: Insert the following subheads at specific positions:
  ${subheadTexts.map((subhead, index) => `${index + 1}. ${subhead}`).join('\n  ')}
  
  CRITICAL SUBHEAD PLACEMENT RULES:
  - First subhead: If there's a CTA line, place the first subhead immediately after the CTA line. If there's no CTA line, place the first subhead after the first or second paragraph (whichever provides better flow).
  - Second subhead: Place after approximately 50% of the content, ensuring it covers at least 2 paragraphs.
  - Third subhead: Place after approximately 80% of the content, ensuring it covers at least 2 paragraphs.
  - Each subhead must cover at least 2 paragraphs of content - do not place subheads too close together.
  - Format each subhead as a standalone line with proper spacing before and after.
  - Do not place subheads in the lead paragraph or immediately after the lead paragraph.
  - Subheads should reflect factual sections (e.g., "IPO Timing," "Operational Drivers," "Market Context") - not generic topics.
` : ''}

${relatedArticles && relatedArticles.length > 0 ? `
- After the second paragraph of additional content (not the lead paragraph), insert the "Also Read:" section with this exact format:
  Also Read: <a href="${relatedArticles[0].url}">${relatedArticles[0].headline}</a>
` : ''}

${isAnalystNote ? '- FOR ANALYST NOTES: Do NOT mention analyst names in the lead paragraph. Start your additional paragraphs (after the lead) with "According to J.P. Morgan analyst Samik Chatterjee, CFA..." and include specific details about the F3Q25 earnings preview, diversification strategy, Apple revenue loss impact, and investment thesis from the source text. When mentioning price targets, include the previous target if available (e.g., "raised the price target to $200 from $185"). Do not write generic content about the semiconductor industry.' : ''}

- For analyst notes specifically: Extract and include the analyst's name (e.g., "Samik Chatterjee, CFA"), firm name, specific analysis points, financial forecasts, investment thesis, and key reasoning directly from the source text. Include details about earnings previews, price targets (use whole numbers like $200, not $200.00), ratings, and market insights mentioned in the note. When a price target is raised or lowered, always include both the current and previous targets in the format "raised the price target to [current] from [previous]" or "lowered the price target to [current] from [previous]".

${isAnalystNote ? '- MANDATORY FOR ANALYST NOTES: Do NOT include analyst names in the lead paragraph. You MUST include the analyst name "Samik Chatterjee, CFA" and firm "J.P. Morgan" in your additional paragraphs (after the lead). You MUST mention the "Overweight" rating and price target information. If a previous price target is available, format it as "raised the price target to [current] from [previous]" (e.g., "raised the price target to $200 from $185"). If no previous target is available, use "raised the price target to [current]" or "set a price target of [current]". You MUST include specific details about the F3Q25 earnings preview, diversification strategy, and investment thesis from the source text.' : ''}

- Analyst Ratings: Extract and include analyst information directly from the source text. Include:
  * The analyst's name, firm, rating, and price target changes (use whole numbers like $200, not $200.00)
  * If a price target was raised or lowered, include both the current and previous targets (e.g., "raised the price target to $200 from $185")
  * Key analysis points and investment thesis from the note
  * Specific financial forecasts or estimates mentioned
  * Important reasoning and market insights
  * Any notable risks or catalysts discussed
  Each paragraph must be no longer than 2 sentences. Focus on extracting specific details from the source text rather than using generic analyst summary data.

${ticker && ticker.trim() !== '' ? `- At the very bottom, include the following price action summary for ${ticker} exactly as provided, but with these modifications:
  - Bold the ticker and "Price Action:" part using HTML <strong> tags (e.g., <strong>AA Price Action:</strong>)
  - Hyperlink "according to Benzinga Pro." to https://pro.benzinga.com/ using <a href="https://pro.benzinga.com/">according to Benzinga Pro.</a>
${priceSummary}` : ''}

${relatedArticles && relatedArticles.length > 0 ? `
- After the price action, add a "Read Next:" section in its own separate paragraph with the following format:
  <p>Read Next: <a href="${relatedArticles[1]?.url || relatedArticles[0].url}">${relatedArticles[1]?.headline || relatedArticles[0].headline}</a></p>
  CRITICAL: The "Read Next" section MUST be in its own paragraph, separate from the main article content.
` : ''}

WRITING STYLE: Write in a direct, conversational tone that sounds natural and engaging. Avoid overly formal or AI-like language such as "garnered attention," "expressed a favorable outlook," or "emphasized that." Instead, use simple, clear language that flows naturally.

Examples of what to avoid:
- "garnered attention from" → "caught the eye of" or "drew comments from"
- "expressed a favorable outlook" → "said he likes" or "is bullish on"
- "emphasized that" → "noted" or "said"
- "encounter volatility" → "face ups and downs" or "see price swings"

**BENZINGA STYLE ENFORCEMENT:**
- Maintain a crisp, newsroom tone with fast pacing and clean transitions
- No filler words or unnecessary explanations
- Each sentence must advance the story - no repetition or restatement
- Focus on data, metrics, and specific financial details
- If information doesn't directly relate to valuation, market impact, or growth drivers, exclude it
- Keep the narrative tight and focused on the core topic

NOTE: Hyperlinks will be added separately using the "Add Lead Hyperlink" feature for better control and relevance.

Keep the tone neutral and informative, suitable for a financial news audience. Do not include speculation or personal opinion. 

CRITICAL HTML FORMATTING: You MUST wrap each paragraph in <p> tags. The output should be properly formatted HTML with each paragraph separated by <p> tags. Example:
<p>First paragraph content.</p>
<p>Second paragraph content.</p>
<p>Third paragraph content.</p>

REMEMBER: NO paragraph should exceed 2 sentences. Break up longer content into multiple paragraphs. The hyperlink MUST appear in the lead paragraph.

Source Text:
${sourceText}

${isAnalystNote ? `
IMPORTANT: The source text above contains a J.P. Morgan analyst note by Samik Chatterjee, CFA. You MUST include:
1. The analyst name "Samik Chatterjee, CFA" and firm "J.P. Morgan"
2. The "Overweight" rating and price target information (include previous target if available)
3. Specific details about the F3Q25 earnings preview
4. Information about the diversification strategy and Apple revenue loss
5. The investment thesis about long-term re-rating opportunity
6. Financial forecasts and market insights from the note

Do not write generic content about the semiconductor industry. Use the specific analyst insights from the source text.
` : ''}

Write the article now.`;
}

export async function POST(req: Request) {
  try {
    const requestBody = await req.json();
    const { ticker, sourceText, analystSummary, priceSummary, priceActionDay, sourceUrl, sourceDateFormatted, includeCTA, ctaText, includeSubheads, subheadTexts, inputMode = 'news', provider: requestedProvider } = requestBody;
    if (!sourceText) return NextResponse.json({ error: 'Source text is required.' }, { status: 400 });
    
    console.log(`\n🔍 PROVIDER DEBUG IN API:`);
    console.log(`   - Request body has 'provider' key:`, 'provider' in requestBody);
    console.log(`   - Provider value received: "${requestedProvider}"`);
    console.log(`   - Provider type: ${typeof requestedProvider}`);
    console.log(`   - Is 'gemini'?: ${requestedProvider === 'gemini'}`);
    console.log(`   - Is 'openai'?: ${requestedProvider === 'openai'}`);
    console.log(`   - Current singleton provider: ${aiProvider.getCurrentProvider()}`);
    
    console.log(`\n🔍 Provider request received: ${requestedProvider || 'not provided'}`);
    console.log(`🔍 Current provider in singleton: ${aiProvider.getCurrentProvider()}`);
    // Ticker is optional - no validation required
    console.log('Prompt priceSummary:', priceSummary); // Log the priceSummary
    console.log('Source text length:', sourceText.length);
    console.log('Source text preview:', sourceText.substring(0, 200));
    console.log('Is analyst note:', (sourceText.includes('Samik Chatterjee') && sourceText.includes('J P M O R G A N')) || 
                                   (sourceText.includes('analyst') && sourceText.includes('J.P. Morgan') && sourceText.includes('Overweight')));
    
    // Fetch related articles
    const relatedArticles = await fetchRelatedArticles(ticker, sourceUrl);
    console.log('Related articles fetched:', relatedArticles.length, 'articles');
    console.log('Ticker provided:', ticker);
    
    console.log('Building prompt with sourceUrl:', sourceUrl);
    const prompt = buildPrompt({ ticker, sourceText, analystSummary: analystSummary || '', priceSummary: priceSummary || '', priceActionDay, sourceUrl, sourceDateFormatted, relatedArticles, includeCTA, ctaText, includeSubheads, subheadTexts, inputMode });
    console.log('Related articles in prompt:', relatedArticles.length);
    console.log('First related article:', relatedArticles[0]?.headline);
    console.log('Prompt preview (first 500 chars):', prompt.substring(0, 500));
    
    // Use requested provider if provided, otherwise get current provider
    let currentProvider: 'openai' | 'gemini';
    if (requestedProvider && (requestedProvider === 'openai' || requestedProvider === 'gemini')) {
      // Set the provider if it's different from current
      const current = aiProvider.getCurrentProvider();
      if (current !== requestedProvider) {
        await aiProvider.setProvider(requestedProvider);
      }
      currentProvider = requestedProvider;
    } else {
      currentProvider = aiProvider.getCurrentProvider();
    }
    
    const model = currentProvider === 'gemini' ? 'gemini-2.5-flash' : MODEL;
    const maxTokens = currentProvider === 'gemini' ? 8192 : 900;
    
    console.log(`\n📊 AI PROVIDER for story generation:`);
    console.log(`   - Provider: ${currentProvider}`);
    console.log(`   - Model: ${model}`);
    console.log(`   - Max Tokens: ${maxTokens}\n`);
    
    const response = await aiProvider.generateCompletion(
      [
        {
          role: 'system',
          content: 'You are a professional financial journalist for Benzinga. You MUST include at least one direct quote from the source material in every article you write. Look for text that appears in quotation marks in the source and include it exactly as written. This is MANDATORY for journalistic integrity and credibility.'
        },
        { role: 'user', content: prompt }
      ],
      {
        model,
        maxTokens,
        temperature: 0.5,
      }
    );
    
    let story = response.content.trim();
    
    console.log('\n📝 STORY GENERATION DEBUG:');
    console.log(`   - Response provider: ${response.provider}`);
    console.log(`   - Response content length: ${response.content ? response.content.length : 0}`);
    console.log(`   - Response content type: ${typeof response.content}`);
    console.log(`   - Story after trim length: ${story.length}`);
    console.log(`   - Story preview (first 500 chars):`, story.substring(0, 500));
    if (story.length > 200) {
      console.log(`   - Story preview (last 200 chars):`, story.substring(Math.max(0, story.length - 200)));
    }
    console.log(`   - Is story empty?: ${story.length === 0}`);
    
    if (story.length === 0) {
      console.error('❌ ERROR: Story content is empty!');
      console.error('Response object keys:', Object.keys(response));
      console.error('Response content:', response.content);
      console.error('Response content (stringified):', JSON.stringify(response.content));
      return NextResponse.json({ 
        error: 'Story generation returned empty content. Please try again or check the source material.',
        provider: response.provider,
        model: model
      }, { status: 500 });
    }
    
    console.log('Source URL provided:', sourceUrl);
    
    // Note: Hyperlinks are now handled separately via the "Add Lead Hyperlink" feature
    // This allows for better control and more relevant hyperlink selection
    
    // Fix any blank URLs in source attribution (skip for PR mode)
    if (inputMode !== 'pr') {
      console.log('Processing source attribution...');
      if (!sourceUrl) {
        console.log('No source URL - removing hyperlinks from reports');
        // Remove hyperlinks from "reports" when there's no source URL
        story = story.replace(/<a href="[^"]*">reports<\/a>/g, 'reports');
      } else {
        console.log('Fixing blank URLs in reports attribution');
        // Fix any blank URLs (href="#" or href="") in reports attribution
        const beforeFix = story.includes('reports');
        story = story.replace(/<a href="[#"]*">reports<\/a>/g, `<a href="${sourceUrl}">reports</a>`);
        const afterFix = story.includes(`href="${sourceUrl}">reports</a>`);
        console.log('Reports attribution fixed:', beforeFix, '->', afterFix);
        
        // Also check if "reports" exists but isn't hyperlinked and add hyperlink
        if (story.includes('reports') && !story.includes(`href="${sourceUrl}">reports</a>`)) {
          console.log('Adding missing hyperlink to reports');
          // Look for patterns like "CNBC reports." or "The company reports." and add hyperlink
          // Make sure the period comes after the hyperlink, not inside it
          story = story.replace(/([A-Z][a-z]+)\s+reports\./g, `$1 <a href="${sourceUrl}">reports</a>.`);
          story = story.replace(/(The company)\s+reports\./g, `$1 <a href="${sourceUrl}">reports</a>.`);
          
          // Also handle cases where "reports" appears without a period at the end of a sentence
          story = story.replace(/([A-Z][a-z]+)\s+reports\s+/g, `$1 <a href="${sourceUrl}">reports</a> `);
          story = story.replace(/(The company)\s+reports\s+/g, `$1 <a href="${sourceUrl}">reports</a> `);
        }
        
        // CRITICAL: If no source attribution exists at all, add it after the lead paragraph
        if (!story.includes('reports')) {
          console.log('No source attribution found - adding it after lead paragraph');
          const outletName = getOutletNameFromUrl(sourceUrl);
          const sourceAttribution = `<p>${outletName} <a href="${sourceUrl}">reports</a>.</p>`;
          
          // Split into paragraphs and insert after the first paragraph (lead)
          const paragraphs = story.split('</p>');
          if (paragraphs.length >= 2) {
            // Insert after the lead paragraph (index 1)
            paragraphs.splice(1, 0, sourceAttribution);
            story = paragraphs.join('</p>');
            console.log('Added source attribution after lead paragraph');
          }
        }
      }
    } else {
      console.log('PR mode - skipping source attribution processing');
    }
    
    // Ensure "Also Read" and "Read Next" sections are included if related articles are available
    console.log('Processing related articles sections...');
    if (relatedArticles && relatedArticles.length > 0) {
      console.log('Related articles available:', relatedArticles.length);
      
      // Check if "Also Read" section exists, if not add it after the second paragraph
      if (!story.includes('Also Read:')) {
        console.log('Adding "Also Read" section');
        const paragraphs = story.split('</p>');
        if (paragraphs.length >= 3) {
          // Insert "Also Read" after the second paragraph (index 2)
          const alsoReadSection = `<p>Also Read: <a href="${relatedArticles[0].url}">${relatedArticles[0].headline}</a></p>`;
          paragraphs.splice(2, 0, alsoReadSection);
          story = paragraphs.join('</p>');
        }
      } else {
        console.log('"Also Read" section already exists');
      }
      
      // Check if "Read Next" section exists, if not add it after context but before price action
      if (!story.includes('Read Next:')) {
        console.log('Adding "Read Next" section');
        const readNextSection = `<p>Read Next: <a href="${relatedArticles[1]?.url || relatedArticles[0].url}">${relatedArticles[1]?.headline || relatedArticles[0].headline}</a></p>`;
        
        // Find the price action section to insert before it
        const priceActionIndex = story.indexOf('Price Action:');
        if (priceActionIndex !== -1) {
          // Insert before price action
          const beforePriceAction = story.substring(0, priceActionIndex);
          const priceActionAndAfter = story.substring(priceActionIndex);
          story = `${beforePriceAction}\n\n${readNextSection}\n\n${priceActionAndAfter}`;
        } else {
          // If no price action found, add to the end
          story += readNextSection;
        }
      } else {
        console.log('"Read Next" section already exists');
        
        // Fix any inline "Read Next" sections that might be embedded in paragraphs
        // Look for patterns like "Read Next: <a href="...">...</a>" that are not in their own paragraph
        const inlineReadNextPattern = /([^>])\s*Read Next:\s*<a href="([^"]+)">([^<]+)<\/a>/g;
        if (inlineReadNextPattern.test(story)) {
          console.log('Found inline "Read Next" section - fixing...');
          story = story.replace(inlineReadNextPattern, (match: string, beforeText: string, url: string, headline: string) => {
            // Remove the inline "Read Next" and add it as a separate paragraph
            const readNextSection = `<p>Read Next: <a href="${url}">${headline}</a></p>`;
            return `${beforeText.trim()}\n\n${readNextSection}`;
          });
        }
      }
    } else {
      console.log('No related articles available');
    }
    
    console.log('Final story preview:', story.substring(0, 500));
    console.log(`✅ Story generated successfully using ${currentProvider.toUpperCase()} (${model})`);
    return NextResponse.json({ 
      story,
      provider: currentProvider,
      model: model
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to generate story.' }, { status: 500 });
  }
} 