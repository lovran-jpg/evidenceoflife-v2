import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { events, lang } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const langHint = lang === 'zh' ? '用中文回复' : 'Reply in English';

    const systemPrompt = `You are a poetic life narrator. Given a list of today's events, generate a short, warm "Life Replay" — a 2-3 sentence narrative summary of the day, written like a personal journal entry. 

Rules:
- Be warm, reflective, slightly literary
- Mention key activities and transitions naturally
- Include a sense of rhythm (morning → afternoon → evening)
- Don't list events, weave them into a story
- Keep it under 60 words
- ${langHint}

Example input:
08:20 运动 (17m)
09:30 整理cheatsheet (186m)
13:22 继续cheatsheet (296m)
16:10 CS class
19:00 NLP class

Example output (zh):
清晨从一场运动开始，然后扎进图书馆整理cheatsheet，一坐就是大半天。下午赶去上CS课，晚上又听了NLP。忙碌但充实的一天，像是把所有碎片拼成了完整的拼图。`;

    const eventsText = events.map((e: any) => {
      let line = e.time + ' ' + e.title;
      if (e.duration) line += ` (${e.duration})`;
      return line;
    }).join('\n');

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Today's events:\n${eventsText}` },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      throw new Error(`AI gateway error [${status}]`);
    }

    const data = await response.json();
    const story = data.choices?.[0]?.message?.content?.trim() || '';

    return new Response(JSON.stringify({ story }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("life-replay error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
