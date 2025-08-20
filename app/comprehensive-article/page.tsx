'use client';

import ComprehensiveArticleForm from '../../components/ComprehensiveArticleForm';

export default function ComprehensiveArticlePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Benzinga Article Generator
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Transform any news source into a comprehensive financial news article with market context, 
            avoiding plagiarism while including direct quotes and market analysis.
          </p>
        </div>
        
        <ComprehensiveArticleForm />
        
        <div className="mt-12 bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">How It Works</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Input</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Paste any news source article</li>
                <li>• Optionally specify a ticker symbol</li>
                <li>• Include market data and top movers</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Output</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Professional financial news article</li>
                <li>• Market context and volatility analysis</li>
                <li>• Direct quotes when appropriate</li>
                <li>• Stock movements and market impact</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Features</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Plagiarism Avoidance:</strong> Rewrites content in original language</li>
            <li>• <strong>Direct Quotes:</strong> Preserves important quotes from source</li>
            <li>• <strong>Market Context:</strong> Integrates real-time market data</li>
            <li>• <strong>Stock Analysis:</strong> Includes relevant stock movements</li>
            <li>• <strong>Professional Format:</strong> Benzinga-style formatting</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 