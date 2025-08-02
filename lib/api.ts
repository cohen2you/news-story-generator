import { getFinalAssemblyPrompt } from './prompts/final';
import { getSecondaryPrompt } from './prompts/secondary';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o';

async function callOpenAI(prompt: string) {
  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set!');
    throw new Error('Missing OpenAI API key');
  }

  console.log('Calling OpenAI with prompt:', prompt.substring(0, 200));

  const res = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 800,
    }),
  });

  if (!res.ok) {
    const raw = await res.text();
    console.error('OpenAI raw error:', raw);
    throw new Error(`OpenAI failed with status ${res.status}`);
  }

  const data = await res.json();
  console.log('OpenAI response received');
  return data.choices[0].message.content.trim();
}

export async function generateFinalStory({
  lead,
  whatHappened,
  whyItMatters,
  priceAction,
  primaryOutlet,
  secondaryOutlet,
}: {
  lead: string;
  whatHappened: string;
  whyItMatters: string;
  priceAction: string;
  primaryOutlet: string;
  secondaryOutlet: string;
}) {
  const prompt = getFinalAssemblyPrompt.prompt({
    lead,
    whatHappened,
    whyItMatters,
    priceAction,
    primaryOutlet,
    secondaryOutlet,
  });
  return await callOpenAI(prompt);
}

export async function generateSecondarySection({
  secondaryUrl,
  outletName,
  primaryText,
  secondaryText,
}: {
  secondaryUrl: string;
  outletName: string;
  primaryText: string;
  secondaryText: string;
}) {
  const prompt = getSecondaryPrompt.prompt({
    secondaryUrl,
    outletName,
    primaryText,
    secondaryText,
  });
  return await callOpenAI(prompt);
}

// Utility function to generate topic-based Benzinga URLs
export async function generateTopicUrl(topic: string): Promise<string> {
  try {
    // Clean and normalize the topic
    const cleanTopic = topic.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    
    // Extract key terms from the topic
    const terms = cleanTopic.split(/\s+/).filter(term => term.length > 2);
    
    if (terms.length === 0) {
      return 'https://www.benzinga.com/news';
    }
    
    // Try to find relevant articles using the Benzinga News API
    const searchTerm = terms.slice(0, 3).join(' '); // Use up to 3 terms
    const url = `https://api.benzinga.com/api/v2/news?token=${process.env.BENZINGA_API_KEY}&items=5&fields=headline,title,url,channels&accept=application/json&displayOutput=full`;
    
    const res = await fetch(url);
    if (!res.ok) {
      return 'https://www.benzinga.com/news';
    }
    
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      return 'https://www.benzinga.com/news';
    }
    
    // Look for articles that contain our search terms
    const relevantArticles = data.filter((article: any) => {
      const headline = (article.headline || article.title || '').toLowerCase();
      return terms.some(term => headline.includes(term));
    });
    
    if (relevantArticles.length > 0) {
      // Return the URL of the most relevant article
      return relevantArticles[0].url || 'https://www.benzinga.com/news';
    }
    
    // Fallback: construct a topic-based URL
    const topicSlug = terms.join('-');
    return `https://www.benzinga.com/news/${topicSlug}`;
    
  } catch (error) {
    console.error('Error generating topic URL:', error);
    return 'https://www.benzinga.com/news';
  }
}

// Function to determine if a phrase should link to a topic page vs source URL
export function shouldLinkToTopic(phrase: string, sourceUrl?: string): boolean {
  if (!sourceUrl) return true;
  
  // Phrases that typically indicate topics rather than specific news events
  const topicIndicators = [
    'warning', 'concern', 'impact', 'effect', 'influence', 'pressure',
    'trend', 'movement', 'shift', 'change', 'development', 'situation',
    'environment', 'climate', 'condition', 'state', 'position',
    'strategy', 'approach', 'plan', 'initiative', 'effort',
    'challenge', 'obstacle', 'hurdle', 'difficulty', 'issue',
    'opportunity', 'potential', 'prospect', 'outlook', 'forecast'
  ];
  
  const phraseLower = phrase.toLowerCase();
  return topicIndicators.some(indicator => phraseLower.includes(indicator));
}
