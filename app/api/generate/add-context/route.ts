import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { generateTopicUrl, MODEL_CONFIG } from '../../../../lib/api';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const BENZINGA_API_KEY = process.env.BENZINGA_API_KEY!;
const BZ_NEWS_URL = 'https://api.benzinga.com/api/v2/news';

async function fetchContextArticle(currentArticle: string, excludeUrl?: string, previouslyUsedUrls: string[] = []): Promise<any | null> {
  try {
    // Extract key topics from the current article to find relevant context
    const topicPrompt = `
Extract 3-5 key topics or themes from this financial article that would be relevant for finding related news articles. Focus on:
- Company names, ticker symbols, or industry terms
- Key events, announcements, or market movements
- Regulatory or policy topics
- Technology or product-related terms

IMPORTANT: Prioritize the main company/ticker being discussed in the article. If the article is about a specific company (like Carvana, Apple, Tesla, etc.), that company name should be the primary topic.

Article: ${currentArticle.substring(0, 1000)}

Return only the topics as a comma-separated list, no explanations:`;

    const topicCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: topicPrompt }],
      max_tokens: 100,
      temperature: 0.3,
    });

    const topics = topicCompletion.choices[0].message?.content?.trim() || '';
    if (!topics) return null;

    // Try each topic to find a relevant article
    const topicList = topics.split(',').map(t => t.trim()).filter(t => t.length > 0);
    
    for (const topic of topicList) {
      try {
        // Use the same logic as generateTopicUrl but for context articles
        const cleanTopic = topic.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        if (cleanTopic.length < 3) continue;

        const url = `${BZ_NEWS_URL}?token=${BENZINGA_API_KEY}&items=20&fields=headline,title,created,body,url,channels&accept=application/json&displayOutput=full`;
        
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
        });
        
        if (!res.ok) continue;
        
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) continue;
        
        // Filter out press releases and the excluded URL
        const prChannelNames = ['press releases', 'press-releases', 'pressrelease', 'pr'];
        const normalize = (str: string) => str.toLowerCase().replace(/[-_]/g, ' ');
        
        const relevantArticles = data
          .filter(item => {
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
            
            // Exclude previously used URLs
            if (previouslyUsedUrls.includes(item.url)) {
              return false;
            }
            
            // Check if the article content is relevant to the topic
            const content = `${item.headline || ''} ${item.body || ''}`.toLowerCase();
            const headline = (item.headline || item.title || '').toLowerCase();
            
            // Enhanced relevance checking with industry context
            const topicWords = cleanTopic.split(' ');
            
            // Check for exact topic match first
            if (content.includes(cleanTopic)) {
              return true;
            }
            
            // Enhanced relevance scoring with industry context
            let relevanceScore = 0;
            
            // Check for exact topic matches
            if (content.includes(cleanTopic)) {
              relevanceScore += 100;
            }
            
            // Check for company-specific matches (higher weight for company names)
            const companyTerms = ['novo nordisk', 'wegovy', 'ozempic', 'eli lilly', 'zepbound', 'mounjaro', 'pfizer', 'moderna', 'johnson & johnson', 'j&j'];
            const foundCompany = companyTerms.find(term => content.includes(term) || headline.includes(term));
            if (foundCompany) {
              relevanceScore += 80;
            }
            
            // Check for industry-specific terms (pharmaceutical, healthcare, etc.)
            const industryTerms = ['pharmaceutical', 'biotech', 'healthcare', 'fda', 'clinical trial', 'drug', 'medication', 'treatment', 'therapy', 'obesity', 'diabetes', 'weight loss'];
            const foundIndustry = industryTerms.find(term => content.includes(term) || headline.includes(term));
            if (foundIndustry) {
              relevanceScore += 40;
            }
            
            // Check for word matches in headline and content
            const headlineMatches = topicWords.filter(word => 
              word.length > 2 && headline.includes(word)
            ).length;
            relevanceScore += headlineMatches * 15;
            
            const bodyMatches = topicWords.filter(word => 
              word.length > 2 && content.includes(word)
            ).length;
            relevanceScore += bodyMatches * 5;
            
            // Require minimum relevance score
            return relevanceScore >= 20;
          })
          .map((item: any) => {
            const content = `${item.headline || ''} ${item.body || ''}`.toLowerCase();
            const headline = (item.headline || item.title || '').toLowerCase();
            const topicWords = cleanTopic.split(' ');
            
            // Calculate enhanced relevance score
            let score = 0;
            
            // Exact topic match gets highest score
            if (content.includes(cleanTopic)) {
              score += 100;
            }
            
            // Company-specific matches get high priority
            const companyTerms = ['novo nordisk', 'wegovy', 'ozempic', 'eli lilly', 'zepbound', 'mounjaro', 'pfizer', 'moderna', 'johnson & johnson', 'j&j'];
            const foundCompany = companyTerms.find(term => content.includes(term) || headline.includes(term));
            if (foundCompany) {
              score += 80;
            }
            
            // Industry-specific terms get medium priority
            const industryTerms = ['pharmaceutical', 'biotech', 'healthcare', 'fda', 'clinical trial', 'drug', 'medication', 'treatment', 'therapy', 'obesity', 'diabetes', 'weight loss'];
            const foundIndustry = industryTerms.find(term => content.includes(term) || headline.includes(term));
            if (foundIndustry) {
              score += 40;
            }
            
            // Headline matches get higher score than body matches
            const headlineMatches = topicWords.filter(word => 
              word.length > 2 && headline.includes(word)
            ).length;
            score += headlineMatches * 20;
            
            const bodyMatches = topicWords.filter(word => 
              word.length > 2 && content.includes(word)
            ).length;
            score += bodyMatches * 5;
            
            // Penalize articles that seem unrelated to the industry
            const unrelatedTerms = ['web3', 'crypto', 'blockchain', 'gaming', 'sports', 'entertainment', 'fashion', 'food', 'travel'];
            const foundUnrelated = unrelatedTerms.find(term => content.includes(term) || headline.includes(term));
            if (foundUnrelated) {
              score -= 50; // Significant penalty for unrelated content
            }
            
            return {
              headline: item.headline || item.title || '[No Headline]',
              body: item.body || '',
              url: item.url,
              created: item.created,
              score: score
            };
          })
          .filter(item => item.body && item.body.length > 100) // Ensure there's substantial content
          .sort((a, b) => b.score - a.score); // Sort by relevance score
        
        if (relevantArticles.length > 0) {
          return relevantArticles[0];
        }
      } catch (error) {
        console.error(`Error fetching article for topic "${topic}":`, error);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching context article:', error);
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { currentArticle, excludeUrl, previouslyUsedUrls = [] } = await request.json();
    
    if (!currentArticle) {
      return NextResponse.json({ error: 'Current article is required.' }, { status: 400 });
    }

    // Fetch a relevant context article based on the current article's topics
    const contextArticle = await fetchContextArticle(currentArticle, excludeUrl, previouslyUsedUrls);
    
    if (!contextArticle) {
      return NextResponse.json({ error: 'No relevant context articles found.' }, { status: 404 });
    }

    // Generate condensed context using OpenAI
    const prompt = `
You are a financial journalist. Given the current article and a recent news article about the same ticker, create 2 very concise paragraphs that add relevant context to the current article.

Current Article:
${currentArticle}

Context News Article:
Headline: ${contextArticle.headline}
Content: ${contextArticle.body}

CRITICAL REQUIREMENTS:
1. Create exactly 2 paragraphs that provide additional context
2. Make the content relevant to the current article's topic
3. Keep each paragraph to EXACTLY 2 sentences maximum - no more, no less
4. **MANDATORY HYPERLINK RULE**: You MUST include exactly one hyperlink ONLY in the FIRST paragraph using this EXACT format: <a href="${contextArticle.url}">three word phrase</a>
5. The SECOND paragraph should have NO hyperlinks
6. Make the content flow naturally with the current article
7. Focus on providing valuable context that enhances the reader's understanding
8. Use AP style and maintain a professional tone
9. Keep paragraphs short and impactful - aim for 1-2 sentences each
10. The hyperlink should be embedded within existing words in the text, not as "[source]" at the end
11. Choose relevant three-word phrases within the sentences to hyperlink, such as company names, key terms, or action phrases
12. **CRITICAL**: ONLY the first paragraph should contain exactly one hyperlink in the format specified above
13. Do NOT reference "a recent article" or similar phrases - just embed the hyperlink naturally in the existing sentence structure
14. **CRITICAL**: Format the output with proper HTML paragraph tags. Each paragraph should be wrapped in <p> tags.
15. **CRITICAL**: Ensure no paragraph has more than 2 sentences - break longer paragraphs into smaller ones
16. NAME FORMATTING RULES: When mentioning people's names, follow these strict rules:
    * First reference: Use the full name with the entire name in bold using HTML <strong> tags (e.g., "<strong>Bill Ackman</strong>" or "<strong>Warren Buffett</strong>")
    * Second and subsequent references: Use only the last name without bolding (e.g., "Ackman" or "Buffett")
    * This applies to all people mentioned in the context paragraphs

**MANDATORY EXAMPLE FORMAT:**
<p>First paragraph with hyperlink <a href="${contextArticle.url}">three word phrase</a> and second sentence.</p>
<p>Second paragraph with no hyperlinks and second sentence.</p>

**CRITICAL**: You MUST include the hyperlink in the first paragraph. Do not skip this requirement.

Write the 2 context paragraphs now:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    });

    const contextParagraphs = completion.choices[0].message?.content?.trim() || '';

    // Debug: Log the generated context to see if hyperlinks are included
    console.log('Generated context paragraphs:', contextParagraphs);
    console.log('Contains hyperlink:', contextParagraphs.includes('<a href='));

    if (!contextParagraphs) {
      return NextResponse.json({ error: 'Failed to generate context.' }, { status: 500 });
    }

    // Ensure proper HTML paragraph formatting
    const formattedContextParagraphs = contextParagraphs
      .replace(/\n\n+/g, '\n\n') // Normalize multiple line breaks to double
      .replace(/\n([^<])/g, '\n\n$1') // Ensure paragraphs are separated by double line breaks
      .replace(/([^>])\n\n([^<])/g, '$1\n\n$2') // Ensure proper spacing around HTML tags
      .replace(/<p>\s*<\/p>/g, '') // Remove empty paragraphs
      .replace(/(<p>.*?<\/p>)\s*(<p>.*?<\/p>)/g, '$1\n\n$2'); // Ensure proper spacing between <p> tags

    // Generate subhead first
    let contextSubhead = '';
    try {
      const contextSubheadPrompt = `
You are a top-tier financial journalist. Given the context that was just added to the article, create exactly 1 compelling subhead that introduces the context section.

The context section provides additional background information and relevant details about the ticker.

CONTEXT PARAGRAPHS TO BASE SUBHEAD ON:
${formattedContextParagraphs}

Requirements:
- Create exactly 1 standalone mini headline
- Make it 4-8 words maximum for maximum impact
- Make it highly engaging and clickable
- Focus on the context/additional information aspect
- Use strong, active language that conveys authority
- Capitalize the first letter of every word
- Make it relevant to the context being added
- Do NOT include quotes around the subhead
- Make it specific to the actual context content, not generic
- Base it on the specific details in the context paragraphs above
- The subhead should directly relate to the main topic discussed in the context paragraphs

Examples of good context subheads:
- "Regulatory Compliance Strategy"
- "App Store Policy Changes"
- "Investor Confidence Factors"
- "Market Positioning Tactics"
- "Competitive Edge Measures"

Create 1 subhead for the context section:`;

      const contextSubheadCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: contextSubheadPrompt }],
        max_tokens: 50,
        temperature: 0.7,
      });

      contextSubhead = contextSubheadCompletion.choices[0].message?.content?.trim() || '';
      if (contextSubhead) {
        contextSubhead = contextSubhead.replace(/\*\*/g, '').replace(/^##\s*/, '').replace(/^["']|["']$/g, '').trim();
      }
    } catch (error) {
      console.error('Error generating context subhead:', error);
    }

    // Insert context and subhead together
    let updatedArticleWithSubheads = currentArticle;
    // Split the article into lines to find the price action section
    const lines = currentArticle.split('\n');
    const priceActionIndex = lines.findIndex((line: string) => 
      line.includes('Price Action:') || 
      line.includes('<strong>') && line.includes('Price Action:') ||
      line.includes('Price Action')
    );
    
    if (priceActionIndex !== -1) {
      // Insert context and subhead before the price action line
      const beforePriceAction = lines.slice(0, priceActionIndex).join('\n');
      const priceActionAndAfter = lines.slice(priceActionIndex).join('\n');
      const subheadSection = contextSubhead ? `${contextSubhead}\n\n\n${formattedContextParagraphs}` : formattedContextParagraphs;
      
      // Check if there's a "Read Next" section before price action that needs to be moved
      const readNextPattern = /Read Next:[\s\S]*?(?=\n\n|$)/;
      const readNextMatch = beforePriceAction.match(readNextPattern);
      
      if (readNextMatch) {
        // Remove the "Read Next" section from before price action
        const beforePriceActionWithoutReadNext = beforePriceAction.replace(readNextPattern, '').trim();
        // Insert context first, then "Read Next" after context
        updatedArticleWithSubheads = `${beforePriceActionWithoutReadNext}\n\n${subheadSection}\n\n${readNextMatch[0]}\n\n${priceActionAndAfter}`;
      } else {
        // No "Read Next" section to move, just insert context
        updatedArticleWithSubheads = `${beforePriceAction}\n\n${subheadSection}\n\n${priceActionAndAfter}`;
      }
    } else {
      // If no price action found, check if there's a "Read Next" section at the end to move
      const readNextPattern = /Read Next:[\s\S]*?(?=\n\n|$)/;
      const readNextMatch = currentArticle.match(readNextPattern);
      
      if (readNextMatch) {
        // Remove the "Read Next" section from the end
        const articleWithoutReadNext = currentArticle.replace(readNextPattern, '').trim();
        const subheadSection = contextSubhead ? `${contextSubhead}\n\n\n${formattedContextParagraphs}` : formattedContextParagraphs;
        // Insert context first, then "Read Next" after context
        updatedArticleWithSubheads = `${articleWithoutReadNext}\n\n${subheadSection}\n\n${readNextMatch[0]}`;
      } else {
        // No "Read Next" section to move, just add context to the end
        const subheadSection = contextSubhead ? `${contextSubhead}\n\n\n${formattedContextParagraphs}` : formattedContextParagraphs;
        updatedArticleWithSubheads = `${currentArticle}\n\n${subheadSection}`;
      }
    }
    
    return NextResponse.json({ 
      updatedArticle: updatedArticleWithSubheads,
      contextSource: {
        headline: contextArticle.headline,
        url: contextArticle.url
      }
    });
  } catch (error: any) {
    console.error('Error adding context:', error);
    return NextResponse.json({ error: error.message || 'Failed to add context.' }, { status: 500 });
  }
}