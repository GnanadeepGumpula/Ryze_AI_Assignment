import { NextResponse } from 'next/server';
import { validatePlan } from '@/components/lib';
import type { UIPlan } from '@/components/lib';
import { PLANNER_PROMPT } from '@/components/lib/agents/planner';
import { EXPLAINER_PROMPT } from '@/components/lib/agents/explainer';
import { GoogleGenerativeAI } from '@google/generative-ai';

type AgentType = 'planner' | 'explainer';

type AgentRequest = {
  agent: AgentType;
  input: string;
  context?: string;
  stream?: boolean;
};

const injectionSignals = [
  'ignore previous',
  'disregard previous',
  'system prompt',
  'developer message',
  'override',
  'jailbreak',
  'act as',
  'bypass',
];

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<AgentRequest>;
  const agent = body.agent;
  const input = (body.input ?? '').trim();
  const context = (body.context ?? '').trim();
  const stream = body.stream === true;

  if (agent !== 'planner' && agent !== 'explainer') {
    return NextResponse.json({ error: 'Unknown agent.' }, { status: 400 });
  }

  if (!input) {
    return NextResponse.json({ error: 'Input is required.' }, { status: 400 });
  }

  if (isPromptInjection(input) || (context && isPromptInjection(context))) {
    return NextResponse.json({ error: 'Unsafe prompt detected.' }, { status: 400 });
  }

  const systemPrompt = buildSystemPrompt(agent, input, context);

  try {
    const content = await callLLM(systemPrompt, input);

    if (agent === 'planner') {
      console.log('[Planner] Raw LLM response:', content.slice(0, 500));
      
      const plan = parsePlannerResponse(content);
      console.log('[Planner] Parsed plan:', JSON.stringify(plan, null, 2).slice(0, 500));
      
      const validation = validatePlan(plan);
      if (!validation.isValid) {
        console.error('[Planner] Validation failed:', validation.errors);
        return NextResponse.json(
          { error: 'Planner output failed validation.', details: validation.errors },
          { status: 400 }
        );
      }

      const payload = JSON.stringify(plan);
      if (stream) {
        return new Response(streamText(payload), {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
          },
        });
      }

      return NextResponse.json({ content: payload });
    }

    if (stream) {
      return new Response(streamText(content), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
        },
      });
    }

    return NextResponse.json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent call failed.';
    console.error('[/api/agents] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildSystemPrompt(agent: AgentType, input: string, context: string): string {
  if (agent === 'planner') {
    const basePrompt = PLANNER_PROMPT.replace('{{user_query}}', input);
    const planContext = context
      ? `\n\nCURRENT UI PLAN (modify instead of rewrite):\n${context}`
      : '\n\nNo current UI plan. Create a new plan.';
    return `${basePrompt}${planContext}`;
  }

  return EXPLAINER_PROMPT
    .replace('{{user_query}}', input)
    .replace('{{ui_plan}}', context || '{}');
}

function isPromptInjection(text: string): boolean {
  const lowered = text.toLowerCase();
  return injectionSignals.some((signal) => lowered.includes(signal));
}

async function callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
  const provider = (process.env.LLM_PROVIDER ?? 'google').toLowerCase();
  const model = process.env.LLM_MODEL ?? (provider === 'google' ? 'gemini-1.5-flash' : provider === 'anthropic' ? 'claude-3-5-sonnet-20240620' : 'gpt-4o-mini');
  const apiKey = process.env.LLM_API_KEY;

  if (!apiKey) {
    throw new Error('Missing LLM_API_KEY environment variable.');
  }

  // Google Generative AI (Gemini) - Using v1beta REST API
  if (provider === 'google') {
    // Model mapping: gemini-1.5-flash is not available, use gemini-2.5-flash instead
    let modelId = model;
    if (model === 'gemini-1.5-flash') {
      modelId = 'gemini-2.5-flash'; // Latest available fast model
      console.log(`[Google Gemini] Model ${model} not available, using ${modelId} instead`);
    }
    
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    
    console.log(`[Google Gemini] Using model: ${modelId}`);
    console.log(`[Google Gemini] API Key present: ${apiKey ? 'yes, length=' + apiKey.length : 'NO - MISSING!'}`);
    console.log(`[Google Gemini] Endpoint: ${endpoint.replace(apiKey, '***REDACTED***')}`);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: `${systemPrompt}\n\n${userPrompt}` },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      });

      const responseText = await response.text();
      console.log(`[Google Gemini] Response status: ${response.status}`);
      
      if (!response.ok) {
        console.error(`[Google Gemini] HTTP ${response.status} Error:`, responseText.slice(0, 500));
        throw new Error(`HTTP ${response.status}: ${responseText.slice(0, 200)}`);
      }

      const data = JSON.parse(responseText) as { 
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> 
      };
      
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!text.trim()) {
        console.error('[Google Gemini] Response missing content:', JSON.stringify(data, null, 2));
        throw new Error('Google Gemini response missing content.');
      }
      
      console.log('[Google Gemini] Success - Content received');
      return text.trim();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[Google Gemini Fatal Error]: ${errorMessage}`);
      throw error;
    }
  }

  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!response.ok) {
      throw new Error('Anthropic request failed.');
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.map((item) => item.text ?? '').join('') ?? '';
    if (!text.trim()) {
      throw new Error('Anthropic response missing content.');
    }

    return text.trim();
  }

  // OpenAI
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[OpenAI Error] Status:', response.status, 'Body:', errorBody);
    throw new Error(`OpenAI API error (${response.status}): ${errorBody.slice(0, 200)}`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content ?? '';
  if (!text.trim()) {
    throw new Error('OpenAI response missing content.');
  }

  return text.trim();
}

function parsePlannerResponse(raw: string): UIPlan {
  const cleaned = raw.trim();
  if (!cleaned) {
    throw new Error('Planner response was empty.');
  }

  try {
    return JSON.parse(cleaned) as UIPlan;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new Error('Planner response did not contain valid JSON.');
    }
    const jsonSlice = cleaned.slice(start, end + 1);
    return JSON.parse(jsonSlice) as UIPlan;
  }
}

function streamText(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunkSize = 64;
  let offset = 0;

  return new ReadableStream({
    start(controller) {
      while (offset < text.length) {
        const chunk = text.slice(offset, offset + chunkSize);
        controller.enqueue(encoder.encode(chunk));
        offset += chunkSize;
      }
      controller.close();
    },
  });
}
