'use client';

import { useState } from 'react';

interface EditorialReviewFormProps {
  article: string;
  sourceText: string;
  onComplete: (reviewedArticle: string) => void;
  onBack: () => void;
}

export default function EditorialReviewForm({
  article,
  sourceText,
  onComplete,
  onBack,
}: EditorialReviewFormProps) {
  const [reviewedArticle, setReviewedArticle] = useState('');
  const [changes, setChanges] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [originalWordCount, setOriginalWordCount] = useState(0);
  const [newWordCount, setNewWordCount] = useState(0);
  const [reviewCompleted, setReviewCompleted] = useState(false);
  const [originalArticle, setOriginalArticle] = useState(article);

  const handleEditorialReview = async () => {
    setError('');
    setLoading(true);
    setReviewCompleted(false);

    try {
      const res = await fetch('/api/generate/editorial-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          article,
          sourceText,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Server error');
      }

      const data = await res.json();
      setReviewedArticle(data.reviewedArticle);
      setChanges(data.changes);
      setOriginalWordCount(data.originalWordCount);
      setNewWordCount(data.newWordCount);
      setReviewCompleted(true);
      onComplete(data.reviewedArticle);
    } catch (err: any) {
      setError(err.message || 'Error performing editorial review.');
    } finally {
      setLoading(false);
    }
  };

  const handleUndoChanges = () => {
    setReviewedArticle('');
    setChanges([]);
    setReviewCompleted(false);
    onComplete(originalArticle); // Restore original article
  };

  return (
    <div style={{ backgroundColor: 'white', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', borderRadius: '16px', padding: '40px', maxWidth: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>Editorial Review</h2>
               <div style={{ fontSize: '14px', color: '#6b7280' }}>
         Original: {originalArticle.split(/\s+/).length} words | Target: &lt;600 words
       </div>
      </div>

      <div style={{ marginBottom: '32px' }}>
        <label style={{ display: 'block', fontWeight: '600', fontSize: '20px', color: '#1f2937', marginBottom: '16px' }}>
          Current Article
        </label>
                 <div
           style={{ 
             width: '100%', 
             borderRadius: '8px', 
             border: '2px solid #d1d5db', 
             padding: '16px 24px', 
             fontSize: '18px', 
             fontFamily: 'monospace', 
             backgroundColor: '#f9fafb', 
             maxHeight: '384px', 
             overflowY: 'auto' 
           }}
           dangerouslySetInnerHTML={{ __html: originalArticle }}
         />
      </div>

      {error && <p style={{ color: '#dc2626', fontWeight: '600' }}>{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          type="button"
          onClick={onBack}
          style={{ 
            borderRadius: '8px', 
            border: '1px solid #9ca3af', 
            padding: '12px 24px', 
            fontWeight: '600', 
            cursor: 'pointer',
            backgroundColor: 'white',
            color: '#374151'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
        >
          Back
        </button>

        {!reviewCompleted && (
          <button
            type="button"
            onClick={handleEditorialReview}
            disabled={loading}
            style={{ 
              borderRadius: '8px', 
              background: 'linear-gradient(to right, #9333ea, #6366f1)', 
              padding: '12px 24px', 
              color: 'white', 
              fontWeight: 'bold', 
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
            onMouseOver={(e) => !loading && (e.currentTarget.style.background = 'linear-gradient(to right, #7c3aed, #5855eb)')}
            onMouseOut={(e) => !loading && (e.currentTarget.style.background = 'linear-gradient(to right, #9333ea, #6366f1)')}
          >
            {loading ? 'Performing Editorial Review...' : 'Run Editorial Review'}
          </button>
        )}
      </div>

      {reviewCompleted && (
        <div style={{ marginTop: '24px' }}>
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px', marginBottom: '24px' }}>
            <h3 style={{ fontWeight: '600', color: '#166534', marginBottom: '8px' }}>Review Complete!</h3>
            <div style={{ fontSize: '14px', color: '#15803d' }}>
              <div>Original: {originalWordCount} words</div>
              <div>New: {newWordCount} words (Target: &lt;600)</div>
              <div>Reduction: {originalWordCount - newWordCount} words</div>
            </div>
          </div>

          {changes.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontWeight: '600', fontSize: '18px', color: '#1f2937', marginBottom: '12px' }}>Changes Made:</h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {changes.map((change, index) => (
                  <li key={index} style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span style={{ color: '#2563eb', marginRight: '8px' }}>•</span>
                    <span style={{ color: '#374151' }}>{change}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontWeight: '600', fontSize: '20px', color: '#1f2937', marginBottom: '16px' }}>
              Reviewed Article
            </label>
            <div
              style={{ 
                width: '100%', 
                borderRadius: '8px', 
                border: '2px solid #d1d5db', 
                padding: '16px 24px', 
                fontSize: '18px', 
                fontFamily: 'monospace', 
                backgroundColor: '#f9fafb', 
                maxHeight: '384px', 
                overflowY: 'auto' 
              }}
              dangerouslySetInnerHTML={{ __html: reviewedArticle }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={handleUndoChanges}
              style={{ 
                borderRadius: '8px', 
                backgroundColor: '#dc2626', 
                padding: '12px 24px', 
                color: 'white', 
                fontWeight: 'bold',
                cursor: 'pointer',
                border: 'none'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
            >
              Undo Editorial Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
