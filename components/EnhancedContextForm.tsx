'use client';

import React, { useState } from 'react';

interface Article {
  headline: string;
  body: string;
  url: string;
  created: string;
  relevanceScore: number;
}

interface EnhancedContextFormProps {
  currentArticle: string;
  onContextAdded: (updatedArticle: string) => void;
  onError: (error: string) => void;
}

export default function EnhancedContextForm({ currentArticle, onContextAdded, onError }: EnhancedContextFormProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<Article[]>([]);
  const [isAddingContext, setIsAddingContext] = useState(false);
  const [searchError, setSearchError] = useState('');

  const searchArticles = async () => {
    if (!searchTerm.trim()) {
      setSearchError('Please enter a search term');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setArticles([]);
    setSelectedArticles([]);

    try {
      const response = await fetch('/api/bz/search-articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ searchTerm: searchTerm.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to search articles');
      }

      // Add debugging to see what the frontend receives
      console.log('Frontend received data:', {
        articles: data.articles?.length || 0,
        totalFound: data.totalFound,
        searchTerm: data.searchTerm,
        note: data.note
      });
      console.log('Articles array:', data.articles);

      setArticles(data.articles || []);
      
      if (data.totalFound === 0) {
        setSearchError(`No articles found containing "${searchTerm}"`);
      }
    } catch (error: any) {
      setSearchError(error.message || 'Failed to search articles');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleArticleSelection = (article: Article) => {
    setSelectedArticles(prev => {
      const isSelected = prev.some(a => a.url === article.url);
      if (isSelected) {
        return prev.filter(a => a.url !== article.url);
      } else {
        if (prev.length >= 3) {
          onError('Maximum 3 articles can be selected');
          return prev;
        }
        return [...prev, article];
      }
    });
  };

  const addContextToArticle = async () => {
    if (selectedArticles.length === 0) {
      onError('Please select at least one article');
      return;
    }

    setIsAddingContext(true);

    try {
      const response = await fetch('/api/generate/add-multiple-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentArticle,
          selectedArticles,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add context');
      }

      onContextAdded(data.updatedArticle);
      
      // Reset form
      setSearchTerm('');
      setArticles([]);
      setSelectedArticles([]);
      setSearchError('');
    } catch (error: any) {
      onError(error.message || 'Failed to add context');
    } finally {
      setIsAddingContext(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown date';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">
        Add Benzinga Context (Enhanced)
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Search for specific keywords or phrases in recent Benzinga articles and select up to 3 articles to add as context to your story.
      </p>
      
      <div className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="e.g., 'Wegovy', 'Novo Nordisk', 'weight loss drugs', 'FDA approval'..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyPress={(e) => e.key === 'Enter' && searchArticles()}
          />
          <button
            onClick={searchArticles}
            disabled={isSearching}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
        
        {searchError && (
          <p className="text-red-600 text-sm mt-2">{searchError}</p>
        )}
      </div>

      {articles.length > 0 && (
        <div className="mb-4">
          <h4 className="font-medium text-gray-700 mb-2">
            Found {articles.length} articles (select up to 3):
          </h4>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {articles.map((article, index) => {
              const isSelected = selectedArticles.some(a => a.url === article.url);
              return (
                <div
                  key={article.url}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleArticleSelection(article)}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleArticleSelection(article)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900 mb-1">
                        {article.headline}
                      </h5>
                      <p className="text-sm text-gray-600 mb-2">
                        {article.body.substring(0, 150)}...
                      </p>
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>{formatDate(article.created)}</span>
                        <span>Relevance: {article.relevanceScore}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedArticles.length > 0 && (
        <div className="mb-4">
          <h4 className="font-medium text-gray-700 mb-2">
            Selected Articles ({selectedArticles.length}/3):
          </h4>
          <div className="space-y-2">
            {selectedArticles.map((article) => (
              <div key={article.url} className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                {article.headline}
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedArticles.length > 0 && (
        <button
          onClick={addContextToArticle}
          disabled={isAddingContext}
          className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAddingContext ? 'Adding Context...' : `Add ${selectedArticles.length} Article${selectedArticles.length > 1 ? 's' : ''} as Context`}
        </button>
      )}
    </div>
  );
}
