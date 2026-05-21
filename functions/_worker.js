// Europa Live — Cloudflare Worker
// Keys are stored as Secrets in Cloudflare Dashboard → Settings → Variables
// Required secrets: NEWS_KEY_1, NEWS_KEY_2, NEWS_KEY_3, TAVILY_KEY

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });

    // /news - auto failover KEY1 → KEY2 → KEY3
    if (path === '/news') {
      const q = url.searchParams.get('q') || 'latest news';
      const keys = [env.NEWS_KEY_1, env.NEWS_KEY_2, env.NEWS_KEY_3].filter(Boolean);

      for (const key of keys) {
        try {
          const apiUrl = `https://newsdata.io/api/1/news?apikey=${key}&q=${encodeURIComponent(q)}&language=en&size=10`;
          const res = await fetch(apiUrl);
          const data = await res.json();

          if (data.status === 'success') return json(data);

          const code = data?.results?.code || data?.code || '';
          if (res.status === 429 || code.includes('RateLimit') || code.includes('MaximumRequests') || code.includes('Unauthorized')) {
            continue;
          }
        } catch {
          continue;
        }
      }
      return json({ status: 'error', results: [] });
    }

    // /search - Tavily
    if (path === '/search') {
      const q = url.searchParams.get('q') || '';
      if (!q.trim()) return json({ results: [] });

      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: env.TAVILY_KEY,
            query: q + ' news',
            search_depth: 'basic',
            max_results: 8,
            topic: 'news',
          }),
        });
        return json(await res.json());
      } catch {
        return json({ results: [] });
      }
    }

    return new Response('Europa Live Worker ✓', { headers: cors });
  },
};
