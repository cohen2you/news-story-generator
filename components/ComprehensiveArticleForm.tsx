'use client';

import { useState } from 'react';

interface ComprehensiveArticleFormProps {
  onArticleGenerated?: (article: string) => void;
}

export default function ComprehensiveArticleForm({ onArticleGenerated }: ComprehensiveArticleFormProps) {
  const [sourceText, setSourceText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [ticker, setTicker] = useState('');
  const [includeMarketData, setIncludeMarketData] = useState(true);
  const [includeCTA, setIncludeCTA] = useState(false);
  const [includeSubheads, setIncludeSubheads] = useState(false);
  const [scrapeUrl, setScrapeUrl] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [article, setArticle] = useState('');
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<any>(null);
  const [marketData, setMarketData] = useState<any>(null);
  const [relatedArticles, setRelatedArticles] = useState<any[]>([]);
  const [ctaText, setCtaText] = useState('');
  const [subheadTexts, setSubheadTexts] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceText.trim() && !sourceUrl.trim()) {
      setError('Please enter source text or URL');
      return;
    }

    setIsGenerating(true);
    setError('');
    setArticle('');

    try {
      const response = await fetch('/api/generate/comprehensive-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceText: sourceText.trim(),
          sourceUrl: sourceUrl.trim() || undefined,
          ticker: ticker.trim() || undefined,
          includeMarketData,
          includeCTA,
          includeSubheads,
          scrapeUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate article');
      }

      setArticle(data.article);
      setAnalysis(data.analysis);
      setMarketData(data.marketData);
      setRelatedArticles(data.relatedArticles || []);
      setCtaText(data.ctaText || '');
      setSubheadTexts(data.subheadTexts || []);
      
      if (onArticleGenerated) {
        onArticleGenerated(data.article);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExampleLoad = () => {
    const exampleText = `President Donald Trump announced Friday that he has "ordered two Nuclear Submarines to be positioned in the appropriate regions" following "highly provocative statements" made by former Russian President Dmitry Medvedev. 

Medvedev said earlier this week that Trump's new deadline for Russia to end the conflict with Ukraine is an additional "step towards war."

"Based on the highly provocative statements of the Former President of Russia, Dmitry Medvedev, who is now the Deputy Chairman of the Security Council of the Russian Federation, I have ordered two Nuclear Submarines to be positioned in the appropriate regions, just in case these foolish and inflammatory statements are more than just that," Trump said in a post on Truth Social. 

"Words are very important, and can often lead to unintended consequences, I hope this will not be one of those instances," he added. 

There was no immediate response to Trump's comments from Russia. The Russian Foreign Ministry did not immediately respond Friday to a request for comment from Fox News Digital.

Medvedev, now the deputy chairman of the Security Council of Russia, cautioned that Trump's announcement Monday that Russia must end the conflict with Ukraine in 10 to 12 days would not end well for the U.S.  

"Trump's playing the ultimatum game with Russia: 50 days or 10… He should remember 2 things: 1. Russia isn't Israel or even Iran. 2. Each new ultimatum is a threat and a step towards war. Not between Russia and Ukraine, but with his own country," Medvedev said in a post on X on Monday. "Don't go down the Sleepy Joe road!" 

While Trump announced on July 14 that he would sign off on "severe tariffs" against Russia if Moscow failed to agree to a peace deal within 50 days, Trump said Monday that waiting that period of time was futile amid stalled negotiations.  

"I'm going to make a new deadline, of about 10 — 10 or 12 days from today," Trump told reporters from Scotland. "There's no reason for waiting. It was 50 days. I wanted to be generous, but we just don't see any progress being made."`;
    
    setSourceText(exampleText);
    setTicker('SPY');
  };

  const handleCopyArticle = async () => {
    if (article) {
      try {
        await navigator.clipboard.writeText(article);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Failed to copy article:', error);
      }
    }
  };

  const handleClearAll = () => {
    setSourceText('');
    setSourceUrl('');
    setTicker('');
    setArticle('');
    setError('');
    setAnalysis(null);
    setMarketData(null);
    setRelatedArticles([]);
    setCtaText('');
    setSubheadTexts([]);
    setCopied(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Benzinga Article Generator</h2>
        <button
          onClick={handleClearAll}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          Clear All
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* URL Input Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Source URL (Optional)
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="https://example.com/article"
            />
            <div className="flex items-center">
              <input
                type="checkbox"
                id="scrapeUrl"
                checked={scrapeUrl}
                onChange={(e) => setScrapeUrl(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="scrapeUrl" className="ml-2 text-sm text-gray-700">
                Scrape
              </label>
            </div>
          </div>
        </div>

        {/* Source Text Section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Source Text *
          </label>
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            rows={12}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Paste your source article here..."
            required={!sourceUrl.trim()}
          />
          <button
            type="button"
            onClick={handleExampleLoad}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Load Example (Trump Nuclear Submarines)
          </button>
        </div>

        {/* Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ticker Symbol (Optional - SPY will be used for market references if not provided)
            </label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., SPY, QQQ"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="includeMarketData"
                checked={includeMarketData}
                onChange={(e) => setIncludeMarketData(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="includeMarketData" className="ml-2 text-sm text-gray-700">
                Include Market Data & Related News
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="includeCTA"
                checked={includeCTA}
                onChange={(e) => setIncludeCTA(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="includeCTA" className="ml-2 text-sm text-gray-700">
                Generate CTA Line
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="includeSubheads"
                checked={includeSubheads}
                onChange={(e) => setIncludeSubheads(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="includeSubheads" className="ml-2 text-sm text-gray-700">
                Generate Subheadings
              </label>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isGenerating || (!sourceText.trim() && !sourceUrl.trim())}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? 'Generating Article...' : 'Generate Article'}
        </button>
      </form>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Generated Content Display */}
      {article && (
        <div className="mt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-gray-800">Generated Article</h3>
            <button
              onClick={handleCopyArticle}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {copied ? 'Copied!' : 'Copy Article'}
            </button>
          </div>
          
          <div className="bg-gray-50 p-6 rounded-lg border">
            <div 
              className="prose max-w-none"
              dangerouslySetInnerHTML={{ __html: article }}
            />
          </div>
          
          {/* CTA Display */}
          {ctaText && (
            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-3 text-gray-800">Generated CTA</h4>
              <div className="bg-white p-4 rounded-lg border">
                <p className="text-sm">{ctaText}</p>
              </div>
            </div>
          )}

          {/* Subheads Display */}
          {subheadTexts.length > 0 && (
            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-3 text-gray-800">Generated Subheadings</h4>
              <div className="bg-white p-4 rounded-lg border">
                <div className="space-y-2">
                  {subheadTexts.map((subhead, index) => (
                    <div key={index} className="text-sm">
                      <strong>{index + 1}.</strong> {subhead}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Market Data Display */}
          {marketData && Object.keys(marketData).length > 0 && (
            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-3 text-gray-800">Market Data</h4>
              <div className="bg-white p-4 rounded-lg border">
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(marketData, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* Content Analysis Display */}
          {analysis && (
            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-3 text-gray-800">Content Analysis</h4>
              <div className="bg-white p-4 rounded-lg border">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <strong>News Type:</strong> {analysis.newsType}
                  </div>
                  <div>
                    <strong>Market Impact:</strong> {analysis.marketImpact}
                  </div>
                  <div>
                    <strong>Relevant Sectors:</strong> {analysis.relevantSectors.join(', ')}
                  </div>
                  <div>
                    <strong>Financial Context:</strong> {analysis.financialContext}
                  </div>
                  {analysis.suggestedSymbols.length > 0 && (
                    <div>
                      <strong>Suggested Symbols:</strong> {analysis.suggestedSymbols.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Related Articles Display */}
          {relatedArticles.length > 0 && (
            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-3 text-gray-800">Related Articles</h4>
              <div className="bg-white p-4 rounded-lg border">
                <div className="space-y-2">
                  {relatedArticles.map((article, index) => (
                    <div key={index} className="text-sm">
                      <a 
                        href={article.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        {article.headline}
                      </a>
                      {article.created && (
                        <span className="text-gray-500 ml-2">
                          {new Date(article.created).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 