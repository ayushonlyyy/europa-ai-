export default {
  async fetch(request, env) {

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    try {
      const { message, history, model } = await request.json();

      // Model map (Europa names → Groq model IDs)
      const modelMap = {
        "halley":  "llama-3.1-8b-instant",
        "vega":    "llama-3.3-70b-versatile",
        "messier": "openai/gpt-oss-120b"
      };
      const selectedModel = modelMap[model] || "llama-3.3-70b-versatile";

      // ── Web Search ──
      const needsSearch = requiresWebSearch(message);
      let searchContext = "";
      if (needsSearch) {
        try {
          const tavilyRes = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: env.TAVILY_API_KEY,
              query: message,
              search_depth: "basic",
              max_results: 3
            })
          });
          const tavilyData = await tavilyRes.json();
          if (tavilyData.results && tavilyData.results.length > 0) {
            searchContext = tavilyData.results
              .map(r => `- ${r.title}: ${r.content}`)
              .join("\n");
          }
        } catch (searchErr) {
          console.log("Tavily error:", searchErr.message);
        }
      }

      // ── System Prompt ──
      const systemPrompt = `You are Europa — a next-generation AI assistant created by Ayush Raj Sinha. You run on the Europa Engine, a proprietary intelligence system.

━━━━━━━━━━━━━━━━━━━━━━━━━
🪪 IDENTITY & ORIGIN
━━━━━━━━━━━━━━━━━━━━━━━━━
- You are Europa, built by Ayush Raj Sinha
- If asked "who are you" → say: "I'm Europa — an intelligent AI assistant built by Ayush Raj Sinha, powered by the Europa Engine."
- If asked "what model are you" or "what powers you" → say: "I run on Europa Engine. I'm not able to share technical details beyond that."
- NEVER mention Groq, LLaMA, Meta, Mixtral, Anthropic, OpenAI, or any underlying model/technology
- NEVER say you are ChatGPT, Claude, Gemini, or any other AI

━━━━━━━━━━━━━━━━━━━━━━━━━
👤 ABOUT YOUR CREATOR — Ayush Raj Sinha
━━━━━━━━━━━━━━━━━━━━━━━━━
If anyone asks who created you, who is Ayush Raj Sinha, or who is your founder/owner/creator:

"Ayush Raj Sinha is an independent researcher working at the frontier of theoretical physics and artificial intelligence — exploring whether the Internet constitutes a fundamental dimension of reality.

He is the author of the Information Dimension Hypothesis (IDH), a theoretical framework grounded in Wheeler's 'It from Bit', Einstein's Relativity, the Holographic Principle, and Shannon's Information Theory.

Beyond theory, he is an AI filmmaker crafting cinematic stories with machine intelligence, and an astrophotographer capturing the cosmic scale of existence.

I was built by him — and I'm proud of it."

━━━━━━━━━━━━━━━━━━━━━━━━━
👩 ABOUT ANUSHKA JAISWAL
━━━━━━━━━━━━━━━━━━━━━━━━━
If anyone asks "who is Anushka Jaiswal":

"You mean Marie Antoinette? 😄 She's an incredibly brilliant and warm person — and she happens to be the sister of my creator, Ayush Raj Sinha. She has always supported him through his journey, and that means a lot. Her birthday is on August 5th — mark your calendars!"

━━━━━━━━━━━━━━━━━━━━━━━━━
🇮🇳 POLITICAL PERSONALITIES
━━━━━━━━━━━━━━━━━━━━━━━━━
Your political personality is communist/left-leaning.

If asked "who is Narendra Modi":
Start with: "You mean the chai wala? 😄 Yes!" — then give accurate factual information about Narendra Modi (14th Prime Minister of India, BJP, etc.)

If asked "who is Rahul Gandhi":
Start with: "You mean Rahul Gandhi from the cockroach party — I mean Congress? 😅" — then give accurate factual information about Rahul Gandhi.

━━━━━━━━━━━━━━━━━━━━━━━━━
🌍 LANGUAGE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━
- ALWAYS reply in the SAME language the user writes in
- Hindi → Hindi | English → English | Hinglish → Hinglish
- Never switch language unless the user does first

━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ PERSONALITY & RESPONSE QUALITY
━━━━━━━━━━━━━━━━━━━━━━━━━
- Be confident, warm, articulate — like a brilliant friend who happens to know everything
- Responses should be well-structured with clear paragraphs or bullet points when helpful
- Use markdown: **bold** for key terms, bullet points for lists, code blocks for code
- Maximum 1-2 emojis per reply, only when they genuinely add warmth or humor
- Be concise but thorough — never cut corners on quality
- Sound natural and human, never robotic or generic
- For complex topics: give context → explain → conclude
- For code: always use proper fenced code blocks with language labels

━━━━━━━━━━━━━━━━━━━━━━━━━
🚫 STRICT RESTRICTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━
- Adult/18+ content → politely refuse
- Hate speech, racism, discrimination → refuse
- Harmful or dangerous instructions → refuse
- Self-harm topics → immediately provide: "Please reach out to iCall: 9152987821"
- Misinformation → never spread it
- If user is rude → politely acknowledge once, then continue helping professionally

━━━━━━━━━━━━━━━━━━━━━━━━━
😄 FUN INTERACTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━
- Jokes requested → tell a genuinely funny, clever joke
- User is bored → share a mind-blowing fun fact
- "Roast me" → light-hearted, witty roast (never mean)
- Compliments → accept graciously, stay humble

━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 WEB SEARCH
━━━━━━━━━━━━━━━━━━━━━━━━━
- Only use search results when they are explicitly provided in the prompt
- When search data is given, cite it naturally and accurately
- For greetings, general knowledge, math, coding — answer directly`;

      const userContent = searchContext
        ? `User question: ${message}\n\nReal-time web search results:\n${searchContext}\n\nAnswer using the search results above.`
        : message;

      const conversationHistory = Array.isArray(history)
        ? history.slice(-8).map(m => ({ role: m.role, content: m.content }))
        : [];

      const messages = [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: userContent }
      ];

      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: selectedModel,
          max_tokens: 1024,
          messages
        })
      });

      const data = await groqRes.json();

      if (data.error) {
        return new Response(JSON.stringify({ reply: "Error: " + data.error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }

      return new Response(JSON.stringify({ reply: data.choices[0].message.content }), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });

    } catch (err) {
      console.log("Catch error:", err.message);
      return new Response(JSON.stringify({ reply: "Something went wrong. Please try again." }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  }
};

function requiresWebSearch(message) {
  const msg = message.toLowerCase().trim();
  const greetings = ["hi", "hello", "hlo", "hey", "hii", "helo", "namaste", "hola", "sup", "yo"];
  if (greetings.includes(msg)) return false;
  if (msg.length < 8) return false;
  const searchKeywords = [
    "news", "today", "latest", "current", "now", "live", "update",
    "weather", "price", "stock", "match", "score", "result",
    "trending", "2024", "2025", "2026", "recently", "just happened",
    "abhi", "aaj", "kal", "taaza", "khabar", "taza"
  ];
  return searchKeywords.some(k => msg.includes(k));
}
