/**
 * Vercel serverless AI proxy: turn a written goal into suggested target
 * percentages. Speaks the OpenAI chat-completions spec, so the provider and
 * model are swappable via env vars (AI_API_KEY, AI_BASE_URL, AI_MODEL) —
 * no code change needed. The API key lives only here and never reaches the
 * browser. The AI only SUGGESTS whole-number targets; every trade number is
 * still computed by the app's deterministic engine.
 *
 * Dollar goals ("save $300k in cash") are handled arithmetically, not by the
 * AI: the model just reports the class and the raw dollar amount, and
 * applyDollarGoals() converts it to an exact percentage against the household
 * total — so the number is always right regardless of the model's math.
 */
import { applyDollarGoals } from '../src/engine/dollarTarget'
import type { DollarGoal } from '../src/engine/dollarTarget'
import { ASSET_CLASSES } from '../src/engine/types'
import type { AssetClass } from '../src/engine/types'

const MAX_GOAL_LENGTH = 300
const MAX_CONTEXT_BYTES = 20_000
const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_MODEL = 'gpt-4o-mini'
const MAX_ANSWER_TOKENS = 300
const PERCENT_SUM = 100
/** Fixed seed so the same goal returns the same targets (with temperature 0). */
const SEED = 7

const SYSTEM_PROMPT = [
  'You suggest target allocations inside a household portfolio rebalancing tool.',
  'Given the user\'s goal and a JSON context of their current portfolio, reply',
  'with ONLY a JSON object, no other text, in exactly this shape:',
  `{"percents":{"US_EQUITY":n,"INTERNATIONAL":n,"GOLD":n,"TREASURIES":n,"CASH":n},"dollarGoals":[{"class":"CASH","amount":300000}],"summary":"..."}`,
  `"percents" is your suggested mix ignoring any dollar amounts: whole numbers >= 0 summing to exactly ${PERCENT_SUM}.`,
  '"dollarGoals" lists ONLY the classes for which the user named a specific dollar amount to hold',
  '(e.g. "save $300k in cash" -> {"class":"CASH","amount":300000}). Use [] when no dollar amount is named.',
  'Do NOT convert dollars into percentages yourself — just report the class and the number; the app does the math.',
  '"class" must be one of US_EQUITY, INTERNATIONAL, GOLD, TREASURIES, CASH; "amount" is a plain number of dollars.',
  '"summary" is ONE short plain-English sentence (no jargon) explaining why',
  'this mix fits the goal. This is general guidance, not financial advice.',
].join(' ')

interface VercelishRequest {
  method?: string
  body?: unknown
}

interface VercelishResponse {
  status(code: number): VercelishResponse
  json(body: unknown): void
}

type Percents = Record<AssetClass, number>

function parsePercents(raw: unknown): Percents | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  let sum = 0
  for (const assetClass of ASSET_CLASSES) {
    const value = record[assetClass]
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      return null
    }
    sum += value
  }
  return sum === PERCENT_SUM ? (raw as Percents) : null
}

/** Pull valid {class, amount} dollar goals out of the AI's reply; ignore junk. */
function parseDollarGoals(raw: unknown): DollarGoal[] {
  if (!Array.isArray(raw)) return []
  const goals: DollarGoal[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const record = entry as Record<string, unknown>
    const assetClass = record.class
    const amount = record.amount
    if (
      typeof assetClass === 'string' &&
      (ASSET_CLASSES as readonly string[]).includes(assetClass) &&
      typeof amount === 'number' &&
      Number.isFinite(amount) &&
      amount > 0
    ) {
      goals.push({ assetClass: assetClass as AssetClass, amount })
    }
  }
  return goals
}

export default async function handler(
  req: VercelishRequest,
  res: VercelishResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.AI_API_KEY
  if (apiKey === undefined || apiKey === '') {
    res.status(503).json({ error: 'AI is not configured on this deployment.' })
    return
  }
  const baseUrl = (process.env.AI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
  const model = process.env.AI_MODEL ?? DEFAULT_MODEL

  const body = (req.body ?? {}) as { goal?: unknown; context?: unknown }
  const goal = typeof body.goal === 'string' ? body.goal.trim() : ''
  if (goal === '' || goal.length > MAX_GOAL_LENGTH) {
    res.status(400).json({
      error: `Send a non-empty goal of at most ${MAX_GOAL_LENGTH} characters.`,
    })
    return
  }
  const context = (body.context ?? {}) as { householdTotal?: unknown }
  const householdTotal =
    typeof context.householdTotal === 'number' ? context.householdTotal : NaN
  const contextJson = JSON.stringify(body.context ?? {})
  if (contextJson.length > MAX_CONTEXT_BYTES) {
    res.status(400).json({ error: 'Context payload is too large.' })
    return
  }

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_ANSWER_TOKENS,
        temperature: 0,
        seed: SEED,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Portfolio context (computed by the app's engine):\n${contextJson}\n\nGoal: ${goal}`,
          },
        ],
      }),
    })

    if (!upstream.ok) {
      console.error(`AI upstream returned ${upstream.status}`)
      res.status(502).json({ error: 'The AI service could not answer right now.' })
      return
    }

    const data = (await upstream.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content === '') {
      res.status(502).json({ error: 'The AI service returned an empty answer.' })
      return
    }

    let parsed: { percents?: unknown; dollarGoals?: unknown; summary?: unknown }
    try {
      parsed = JSON.parse(content) as typeof parsed
    } catch {
      res.status(502).json({ error: 'The AI answer was not valid JSON.' })
      return
    }
    const baseline = parsePercents(parsed.percents)
    if (baseline === null) {
      res.status(502).json({
        error: `The AI suggestion was not whole numbers summing to ${PERCENT_SUM} — try again.`,
      })
      return
    }
    // Deterministic step: convert any named dollar goals into an exact
    // whole-number mix. No-ops (returns the baseline) when the user named no
    // dollar amount or the household total is unknown.
    const goals = parseDollarGoals(parsed.dollarGoals)
    const percents = applyDollarGoals(baseline, goals, householdTotal)
    const summary =
      typeof parsed.summary === 'string' && parsed.summary !== ''
        ? parsed.summary
        : 'Here is a target mix for your goal.'
    res.status(200).json({ percents, summary })
  } catch (error) {
    console.error('AI targets proxy error:', error)
    res.status(502).json({ error: 'The AI service could not be reached.' })
  }
}
