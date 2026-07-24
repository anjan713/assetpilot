import { useState } from 'react'
import { ASSET_CLASSES } from '../engine/types'
import type { AssetClass } from '../engine/types'

const MAX_GOAL_LENGTH = 300
const PERCENT_SUM = 100

interface GoalBarProps {
  /** Engine-computed numbers only — never the raw CSV. */
  aiContext: Record<string, unknown>
  /** Called with a valid whole-number mix summing to 100. */
  onApplyPercents: (percents: Record<AssetClass, number>) => void
}

type GoalStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; summary: string }
  | { kind: 'error'; message: string }

/** The browser never trusts the network — re-check the AI's math here. */
function parsePercents(raw: unknown): Record<AssetClass, number> | null {
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
  return sum === PERCENT_SUM ? (raw as Record<AssetClass, number>) : null
}

export function GoalBar({ aiContext, onApplyPercents }: GoalBarProps) {
  const [goal, setGoal] = useState('')
  const [status, setStatus] = useState<GoalStatus>({ kind: 'idle' })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = goal.trim()
    if (trimmed === '' || status.kind === 'loading') return
    setStatus({ kind: 'loading' })
    try {
      const response = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: trimmed, context: aiContext }),
      })
      if (response.status === 503 || response.status === 404) {
        setStatus({
          kind: 'error',
          message:
            'The AI helper is not set up on this deployment — set the targets by hand below.',
        })
        return
      }
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        setStatus({
          kind: 'error',
          message: data.error ?? 'The AI could not suggest targets right now — try again.',
        })
        return
      }
      const data = (await response.json()) as { percents?: unknown; summary?: unknown }
      const percents = parsePercents(data.percents)
      if (percents === null) {
        setStatus({
          kind: 'error',
          message: 'The AI suggestion did not add up to 100 — try again.',
        })
        return
      }
      onApplyPercents(percents)
      setStatus({
        kind: 'done',
        summary: typeof data.summary === 'string' ? data.summary : 'Targets updated.',
      })
    } catch {
      setStatus({
        kind: 'error',
        message:
          'The AI helper is not reachable here (it runs only on the deployed site) — set the targets by hand below.',
      })
    }
  }

  return (
    <div className="goal-dock">
      {status.kind === 'done' && (
        <p className="goal-summary" aria-live="polite">
          {status.summary}
        </p>
      )}
      {status.kind === 'error' && (
        <p className="goal-summary goal-summary-error" role="alert">
          {status.message}
        </p>
      )}
      <form className="goal-bar" onSubmit={submit}>
        <label htmlFor="goal-input" className="visually-hidden">
          Write your goal and the AI will suggest target percentages
        </label>
        <input
          id="goal-input"
          type="text"
          value={goal}
          maxLength={MAX_GOAL_LENGTH}
          placeholder="What is your 1 year goal, I will set the target"
          onChange={(event) => setGoal(event.target.value)}
        />
        <button
          type="submit"
          className="goal-send"
          disabled={status.kind === 'loading' || goal.trim() === ''}
        >
          {status.kind === 'loading' ? 'Thinking…' : 'Enter'}
        </button>
      </form>
    </div>
  )
}
