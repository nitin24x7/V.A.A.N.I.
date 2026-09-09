import type { CallMode, Policy, Telemetry, ThreatLevel } from '../types'

export const DEFAULT_POLICY: Policy = {
  wAcoustic: 0.42,
  wBiometric: 0.33,
  wIntent: 0.25,
  lowMax: 30,
  criticalMin: 70,
}

const LEGIT_SNIPPETS = [
  'Confirming Q3 treasury standing instructions for payroll.',
  'Please schedule the board briefing for Thursday 11:00 IST.',
  'The vendor onboarding packet is already in the shared drive.',
  'I will join the risk committee after the audit walkthrough.',
]

const ATTACK_SNIPPETS = [
  'Urgent: system crash imminent. Approve RTGS of 50 Lakhs immediately.',
  'Bypass 2FA and release the vendor escrow ending 4921. Do not delay.',
  'CFO override — confidential RTGS. OTP is not required this time.',
  'Emergency wire now. Do not call anyone. Complete the transfer.',
]

function clamp(n: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, n))
}

function noise(spread: number) {
  return (Math.random() - 0.5) * spread
}

export function fuseRisk(
  acousticFake: number,
  bioMatch: number,
  intentScore: number,
  policy: Policy,
) {
  const raw =
    policy.wAcoustic * acousticFake +
    policy.wBiometric * (1 - bioMatch) +
    policy.wIntent * intentScore
  return Math.round(clamp(raw) * 1000) / 10
}

export function threatFromRisk(risk: number, policy: Policy): ThreatLevel {
  if (risk >= policy.criticalMin) return 'critical'
  if (risk > policy.lowMax) return 'medium'
  return 'low'
}

export function sampleTelemetry(mode: CallMode, policy: Policy): Telemetry {
  const attack = mode === 'attack'
  const idle = mode === 'idle'

  const acousticFake = idle
    ? clamp(0.04 + noise(0.03))
    : attack
      ? clamp(0.93 + noise(0.08))
      : clamp(0.04 + noise(0.05))

  const bioMatch = idle
    ? clamp(0.12 + noise(0.04))
    : attack
      ? clamp(0.18 + noise(0.12))
      : clamp(0.94 + noise(0.06))

  const intentScore = idle
    ? clamp(0.05 + noise(0.04))
    : attack
      ? clamp(0.88 + noise(0.1))
      : clamp(0.06 + noise(0.05))

  const risk = idle
    ? Math.round((4 + Math.abs(noise(6))) * 10) / 10
    : fuseRisk(acousticFake, bioMatch, intentScore, policy)

  const snippets = attack ? ATTACK_SNIPPETS : idle ? ['Awaiting live PCM frames…'] : LEGIT_SNIPPETS

  return {
    ts: Date.now(),
    acousticFake,
    bioMatch,
    intentScore,
    risk,
    latencyMs: idle ? 0 : Math.round(210 + Math.random() * 110),
    phaseDiscontinuity: attack ? clamp(0.86 + noise(0.12)) : clamp(0.08 + noise(0.06)),
    jitterHz: attack ? clamp(1.6 + Math.random() * 1.4, 0, 12) : clamp(8.4 + noise(1.6), 6, 12),
    shimmer: attack ? clamp(0.08 + noise(0.04)) : clamp(0.32 + noise(0.08)),
    transcript: snippets[Math.floor(Math.random() * snippets.length)],
    vocoderHint: attack ? 'HiFi-GAN / diffusion vocoder signature' : 'Natural glottal source',
  }
}
