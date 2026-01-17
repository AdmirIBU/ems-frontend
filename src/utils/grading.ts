export const PASS_PERCENT = 55

export function computeScorePercent(pointsAwarded: unknown, pointsTotal: unknown): number {
  const awarded = typeof pointsAwarded === 'number' && Number.isFinite(pointsAwarded) ? pointsAwarded : 0
  const total = typeof pointsTotal === 'number' && Number.isFinite(pointsTotal) ? pointsTotal : 0
  if (total <= 0) return 0
  const pct = (awarded / total) * 100
  return Math.max(0, Math.min(100, pct))
}

export function computeLetterGrade(scorePercent: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (scorePercent >= 90) return 'A'
  if (scorePercent >= 80) return 'B'
  if (scorePercent >= 70) return 'C'
  if (scorePercent >= PASS_PERCENT) return 'D'
  return 'F'
}

export function formatScorePercent(scorePercent: number): string {
  return `${scorePercent.toFixed(1)}%`
}
