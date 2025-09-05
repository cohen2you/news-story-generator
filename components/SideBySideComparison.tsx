'use client';

import { useState } from 'react';

interface TextSegment {
  text: string;
  type: 'identical' | 'modified' | 'added' | 'removed';
  sourceIndex?: number;
  finalIndex?: number;
}

interface SideBySideComparisonProps {
  sourceText: string;
  finalText: string;
  sourceTitle?: string;
  finalTitle?: string;
}

export default function SideBySideComparison({ 
  sourceText, 
  finalText, 
  sourceTitle = "Source Article", 
  finalTitle = "Final Article" 
}: SideBySideComparisonProps) {
  const [showIdentical, setShowIdentical] = useState(true);
  const [showModified, setShowModified] = useState(true);
  const [showAdded, setShowAdded] = useState(true);
  const [showRemoved, setShowRemoved] = useState(true);

  // Simple text diff algorithm
  const createTextDiff = (source: string, final: string): TextSegment[] => {
    const sourceWords = source.split(/(\s+)/);
    const finalWords = final.split(/(\s+)/);
    const segments: TextSegment[] = [];
    
    let sourceIndex = 0;
    let finalIndex = 0;
    
    while (sourceIndex < sourceWords.length || finalIndex < finalWords.length) {
      // Find longest common subsequence starting from current positions
      let maxMatch = 0;
      let bestSourceEnd = sourceIndex;
      let bestFinalEnd = finalIndex;
      
      // Look for matches of increasing length
      for (let sourceEnd = sourceIndex; sourceEnd < sourceWords.length; sourceEnd++) {
        for (let finalEnd = finalIndex; finalEnd < finalWords.length; finalEnd++) {
          if (sourceWords[sourceEnd] === finalWords[finalEnd]) {
            // Found a match, check if we can extend it
            let matchLength = 1;
            while (
              sourceEnd + matchLength < sourceWords.length &&
              finalEnd + matchLength < finalWords.length &&
              sourceWords[sourceEnd + matchLength] === finalWords[finalEnd + matchLength]
            ) {
              matchLength++;
            }
            
            if (matchLength > maxMatch) {
              maxMatch = matchLength;
              bestSourceEnd = sourceEnd;
              bestFinalEnd = finalEnd;
            }
          }
        }
      }
      
      // Add segments based on what we found
      if (maxMatch > 0) {
        // Add removed text (source only)
        if (sourceIndex < bestSourceEnd) {
          const removedText = sourceWords.slice(sourceIndex, bestSourceEnd).join('');
          if (removedText.trim()) {
            segments.push({
              text: removedText,
              type: 'removed',
              sourceIndex: sourceIndex,
            });
          }
        }
        
        // Add added text (final only)
        if (finalIndex < bestFinalEnd) {
          const addedText = finalWords.slice(finalIndex, bestFinalEnd).join('');
          if (addedText.trim()) {
            segments.push({
              text: addedText,
              type: 'added',
              finalIndex: finalIndex,
            });
          }
        }
        
        // Add identical text
        const identicalText = sourceWords.slice(bestSourceEnd, bestSourceEnd + maxMatch).join('');
        if (identicalText.trim()) {
          segments.push({
            text: identicalText,
            type: 'identical',
            sourceIndex: bestSourceEnd,
            finalIndex: bestFinalEnd,
          });
        }
        
        sourceIndex = bestSourceEnd + maxMatch;
        finalIndex = bestFinalEnd + maxMatch;
      } else {
        // No match found, add remaining text
        if (sourceIndex < sourceWords.length) {
          const remainingSource = sourceWords.slice(sourceIndex).join('');
          if (remainingSource.trim()) {
            segments.push({
              text: remainingSource,
              type: 'removed',
              sourceIndex: sourceIndex,
            });
          }
        }
        if (finalIndex < finalWords.length) {
          const remainingFinal = finalWords.slice(finalIndex).join('');
          if (remainingFinal.trim()) {
            segments.push({
              text: remainingFinal,
              type: 'added',
              finalIndex: finalIndex,
            });
          }
        }
        break;
      }
    }
    
    return segments;
  };

  const segments = createTextDiff(sourceText, finalText);

  const getSegmentStyle = (type: string) => {
    switch (type) {
      case 'identical':
        return 'bg-gray-100 text-gray-800';
      case 'modified':
        return 'bg-yellow-100 text-yellow-800';
      case 'added':
        return 'bg-green-100 text-green-800';
      case 'removed':
        return 'bg-red-100 text-red-800 line-through';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSegmentIcon = (type: string) => {
    switch (type) {
      case 'identical':
        return '✓';
      case 'modified':
        return '~';
      case 'added':
        return '+';
      case 'removed':
        return '-';
      default:
        return '';
    }
  };

  const filteredSegments = segments.filter(segment => {
    switch (segment.type) {
      case 'identical':
        return showIdentical;
      case 'modified':
        return showModified;
      case 'added':
        return showAdded;
      case 'removed':
        return showRemoved;
      default:
        return true;
    }
  });

  const stats = {
    identical: segments.filter(s => s.type === 'identical').length,
    modified: segments.filter(s => s.type === 'modified').length,
    added: segments.filter(s => s.type === 'added').length,
    removed: segments.filter(s => s.type === 'removed').length,
  };

  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Article Comparison</h2>
        <div className="flex space-x-4 text-sm">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showIdentical}
              onChange={(e) => setShowIdentical(e.target.checked)}
              className="mr-2"
            />
            <span className="text-gray-600">Identical ({stats.identical})</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showModified}
              onChange={(e) => setShowModified(e.target.checked)}
              className="mr-2"
            />
            <span className="text-yellow-600">Modified ({stats.modified})</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showAdded}
              onChange={(e) => setShowAdded(e.target.checked)}
              className="mr-2"
            />
            <span className="text-green-600">Added ({stats.added})</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showRemoved}
              onChange={(e) => setShowRemoved(e.target.checked)}
              className="mr-2"
            />
            <span className="text-red-600">Removed ({stats.removed})</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Article */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-3 text-blue-600">{sourceTitle}</h3>
          <div className="text-sm space-y-1 max-h-96 overflow-y-auto">
            {filteredSegments.map((segment, index) => (
              <span
                key={index}
                className={`inline-block px-1 py-0.5 rounded text-xs ${getSegmentStyle(segment.type)}`}
                title={`${getSegmentIcon(segment.type)} ${segment.type}`}
              >
                {segment.text}
              </span>
            ))}
          </div>
        </div>

        {/* Final Article */}
        <div className="border rounded-lg p-4">
          <h3 className="font-semibold text-lg mb-3 text-green-600">{finalTitle}</h3>
          <div className="text-sm space-y-1 max-h-96 overflow-y-auto">
            {filteredSegments.map((segment, index) => (
              <span
                key={index}
                className={`inline-block px-1 py-0.5 rounded text-xs ${getSegmentStyle(segment.type)}`}
                title={`${getSegmentIcon(segment.type)} ${segment.type}`}
              >
                {segment.text}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-50 p-3 rounded text-center">
          <div className="text-2xl font-bold text-gray-600">{stats.identical}</div>
          <div className="text-sm text-gray-500">Identical</div>
        </div>
        <div className="bg-yellow-50 p-3 rounded text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.modified}</div>
          <div className="text-sm text-yellow-500">Modified</div>
        </div>
        <div className="bg-green-50 p-3 rounded text-center">
          <div className="text-2xl font-bold text-green-600">{stats.added}</div>
          <div className="text-sm text-green-500">Added</div>
        </div>
        <div className="bg-red-50 p-3 rounded text-center">
          <div className="text-2xl font-bold text-red-600">{stats.removed}</div>
          <div className="text-sm text-red-500">Removed</div>
        </div>
      </div>
    </div>
  );
}
