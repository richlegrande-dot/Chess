/**
 * useCoaching Hook
 * 
 * Custom hook for CoachEngine integration
 * Provides coaching insights based on game context
 */

import { useState, useCallback } from 'react';
import { useAdminStore } from '../store/adminStore';

interface CoachingResult {
  advice?: string;
  coaching?: string;
  theme?: string;
  results?: Array<{
    id: string;
    text: string;
    fullText?: string;
    tags?: string;
    source?: string;
  }>;
  relevantKnowledge?: string[];
  sources?: string[];
  confidence?: number;
  query?: string;
  count?: number;
}

interface UseCoachingReturn {
  getInsights: (gameContext: any) => Promise<CoachingResult | null>;
  searchKnowledge: (query: string) => Promise<CoachingResult | null>;
  getThematicGuidance: (theme: string) => Promise<CoachingResult | null>;
  loading: boolean;
  error: string | null;
  lastResult: CoachingResult | null;
}

export function useCoaching(): UseCoachingReturn {
  const { token } = useAdminStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<CoachingResult | null>(null);

  const callCoachEngine = useCallback(async (
    action: 'search_knowledge' | 'thematic_coaching' | 'generate_advice',
    params: any
  ): Promise<CoachingResult | null> => {
    if (!token) {
      setError('Not authenticated');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ action, ...params }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      setLastResult(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get coaching';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  const getInsights = useCallback(async (gameContext: {
    gamePhase: 'opening' | 'middlegame' | 'endgame';
    playerColor: 'white' | 'black';
    skillLevel: 'beginner' | 'intermediate' | 'advanced';
    themes: string;
    moveCount: number;
  }): Promise<CoachingResult | null> => {
    return callCoachEngine('generate_advice', gameContext);
  }, [callCoachEngine]);

  const searchKnowledge = useCallback(async (query: string): Promise<CoachingResult | null> => {
    return callCoachEngine('search_knowledge', { query });
  }, [callCoachEngine]);

  const getThematicGuidance = useCallback(async (theme: string): Promise<CoachingResult | null> => {
    return callCoachEngine('thematic_coaching', { theme });
  }, [callCoachEngine]);

  return {
    getInsights,
    searchKnowledge,
    getThematicGuidance,
    loading,
    error,
    lastResult,
  };
}
