// Cloudflare Pages Function: Analytics Endpoint
// Path: /api/analytics
// Returns privacy-safe usage counters (no personal data)

import { getCounters } from '../lib/security';

interface Env {
  ANALYTICS_KV?: KVNamespace;
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  try {
    if (!context.env.ANALYTICS_KV) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Analytics not configured',
        }),
        {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
        }
      );
    }

    const counters = await getCounters(context.env.ANALYTICS_KV);

    return new Response(
      JSON.stringify({
        success: true,
        analytics: counters,
        note: 'All data is anonymous. No personal information is collected.',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60', // Cache for 1 minute
        },
      }
    );
  } catch (error) {
    console.error('Analytics error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to retrieve analytics',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      }
    );
  }
}
