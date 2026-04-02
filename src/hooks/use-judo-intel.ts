import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

// GitHub repo mappings for common AI tools
const GITHUB_REPO_MAP: Record<string, string> = {
  'cursor': 'getcursor/cursor',
  'copilot': 'features/copilot',
  'langchain': 'langchain-ai/langchain',
  'llamaindex': 'run-llama/llama_index',
  'autogen': 'microsoft/autogen',
  'crewai': 'crewAI-tools/crewAI',
  'dify': 'langgenius/dify',
  'flowise': 'FlowiseAI/Flowise',
  'n8n': 'n8n-io/n8n',
  'streamlit': 'streamlit/streamlit',
  'gradio': 'gradio-app/gradio',
  'hugging face': 'huggingface/transformers',
  'transformers': 'huggingface/transformers',
  'pytorch': 'pytorch/pytorch',
  'tensorflow': 'tensorflow/tensorflow',
  'fastapi': 'fastapi/fastapi',
  'vercel': 'vercel/next.js',
  'supabase': 'supabase/supabase',
  'midjourney': '',
  'chatgpt': '',
  'claude': '',
};

function findGitHubRepo(toolName: string): string | null {
  const lower = toolName.toLowerCase().trim();
  for (const [key, repo] of Object.entries(GITHUB_REPO_MAP)) {
    if (lower.includes(key) && repo) return repo;
  }
  return null;
}

export interface WeeklyIntel {
  news: string;
  tutorial: { title: string; url: string; platform?: string };
  market_signal: string;
  weekly_tip?: string;
}

export interface JudoIntel {
  githubStars: number | null;
  weeklyIntel: WeeklyIntel | null;
  loading: boolean;
}

export function useJudoIntel(
  judoTool: string | undefined,
  role?: string,
  industry?: string,
  country?: string | null
): JudoIntel {
  const [githubStars, setGithubStars] = useState<number | null>(null);
  const [weeklyIntel, setWeeklyIntel] = useState<WeeklyIntel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!judoTool) { setLoading(false); return; }

    let cancelled = false;

    const fetchAll = async () => {
      // Check sessionStorage first
      const sessionKey = `jb_judo_${judoTool}_${role}`;
      try {
        const cached = sessionStorage.getItem(sessionKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && Date.now() - (parsed.ts || 0) < 30 * 60 * 1000) {
            if (!cancelled) {
              if (parsed.githubStars) setGithubStars(parsed.githubStars);
              if (parsed.weeklyIntel) setWeeklyIntel(parsed.weeklyIntel);
              setLoading(false);
            }
            return;
          }
        }
      } catch {}

      const promises: Promise<void>[] = [];

      // GitHub Stars
      const repo = findGitHubRepo(judoTool);
      if (repo) {
        promises.push(
          fetch(`https://api.github.com/repos/${repo}`, {
            headers: { Accept: 'application/vnd.github.v3+json' },
          })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
              if (!cancelled && data?.stargazers_count) {
                setGithubStars(data.stargazers_count);
              }
            })
            .catch(() => {})
        );
      }

      // Weekly Intel from edge function
      promises.push(
        supabase.functions.invoke('fetch-weekly-intel', {
          body: { role, judo_tool: judoTool, industry },
        })
          .then(({ data, error }) => {
            if (!cancelled && !error && data && !data.error) {
              setWeeklyIntel(data as WeeklyIntel);
            }
          })
          .catch(() => {})
      );

      await Promise.allSettled(promises);
      if (!cancelled) {
        setLoading(false);
        // Cache in session
        try {
          sessionStorage.setItem(sessionKey, JSON.stringify({ githubStars, weeklyIntel, ts: Date.now() }));
        } catch {}
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [judoTool, role, industry]);

  return { githubStars, weeklyIntel, loading };
}
