'use client';

import { useState } from 'react';

interface LeadHyperlinkFormProps {
  leadParagraph: string;
  onHyperlinkAdded: (updatedParagraph: string) => void;
  onCancel: () => void;
}

interface Article {
  headline: string;
  url: string;
  score: number;
  created: string;
}

export default function LeadHyperlinkForm({ leadParagraph, onHyperlinkAdded, onCancel }: LeadHyperlinkFormProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedPhrase, setSelectedPhrase] = useState<string>('');
  const [error, setError] = useState<string>('');

  const searchHyperlinkArticles = async () => {
    setLoading(true);
    setError('');
    setArticles([]);
    setSelectedArticle(null);
    setSelectedPhrase('');

    try {
      const response = await fetch('/api/generate/lead-hyperlink', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leadParagraph }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search for articles');
      }

      if (data.articles && data.articles.length > 0) {
        setArticles(data.articles);
      } else {
        setError('No relevant articles found for hyperlink selection');
      }
    } catch (error) {
      console.error('Error searching for hyperlink articles:', error);
      setError('Failed to search for articles. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addHyperlink = () => {
    if (!selectedArticle || !selectedPhrase) {
      setError('Please select both an article and a phrase to hyperlink');
      return;
    }

    // First, remove any existing hyperlink from the lead paragraph
    let cleanParagraph = leadParagraph.replace(/<a[^>]*>([^<]*)<\/a>/g, '$1');
    
    // Find the phrase in the cleaned paragraph and replace it with a hyperlink
    const phraseRegex = new RegExp(`\\b${selectedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    
    if (!phraseRegex.test(cleanParagraph)) {
      setError('Selected phrase not found in lead paragraph');
      return;
    }

    const hyperlinkedParagraph = cleanParagraph.replace(
      phraseRegex,
      `<a href="${selectedArticle.url}" target="_blank" rel="noopener noreferrer">${selectedPhrase}</a>`
    );

    onHyperlinkAdded(hyperlinkedParagraph);
  };

  const extractPhrases = (text: string): string[] => {
    // Remove HTML tags for processing
    const cleanText = text.replace(/<[^>]*>/g, '');
    const words = cleanText.split(/\s+/);
    const phrases: string[] = [];

    // Generate 3-word phrases
    for (let i = 0; i <= words.length - 3; i++) {
      const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
      
      // Filter out phrases that are too generic
      const genericWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
      const phraseWords = phrase.toLowerCase().split(' ');
      
      if (!phraseWords.every(word => genericWords.includes(word))) {
        phrases.push(phrase);
      }
    }

    return phrases.slice(0, 10); // Return top 10 phrases
  };

  const phrases = extractPhrases(leadParagraph);

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Replace Lead Hyperlink</h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      {/* Lead Paragraph Display */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Lead Paragraph:</h3>
        <div className="bg-gray-50 p-4 rounded border text-sm">
          <div dangerouslySetInnerHTML={{ __html: leadParagraph }} />
        </div>
        <p className="text-xs text-gray-600 mt-2">
          This will replace the existing hyperlink (if any) with a new one on the selected phrase.
        </p>
      </div>

      {/* Search Button */}
      <div className="mb-6">
        <button
          onClick={searchHyperlinkArticles}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search for Relevant Articles'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Articles Selection */}
      {articles.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Select Article:</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {articles.map((article, index) => (
              <div
                key={index}
                className={`p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                  selectedArticle?.url === article.url ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
                onClick={() => setSelectedArticle(article)}
              >
                <div className="font-medium text-sm">{article.headline}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Score: {article.score} • {new Date(article.created).toLocaleDateString()}
                </div>
                <div className="text-xs text-blue-600 truncate">{article.url}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phrase Selection */}
      {selectedArticle && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Select Phrase to Hyperlink:</h3>
          <div className="grid grid-cols-2 gap-2">
            {phrases.map((phrase, index) => (
              <button
                key={index}
                onClick={() => setSelectedPhrase(phrase)}
                className={`p-2 text-sm border rounded hover:bg-gray-50 ${
                  selectedPhrase === phrase ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                "{phrase}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      {selectedArticle && selectedPhrase && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Preview:</h3>
          <div className="bg-gray-50 p-4 rounded border text-sm">
            <div
              dangerouslySetInnerHTML={{
                __html: leadParagraph.replace(
                  new RegExp(`\\b${selectedPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'),
                  `<a href="${selectedArticle.url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline">${selectedPhrase}</a>`
                )
              }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
        >
          Cancel
        </button>
                  <button
            onClick={addHyperlink}
            disabled={!selectedArticle || !selectedPhrase}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Replace Hyperlink
          </button>
      </div>
    </div>
  );
}
