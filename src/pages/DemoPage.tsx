import { useNavigate } from 'react-router-dom'
import { useSession } from '../context/SessionContext'
import { Button } from '../components/ui/Button'
import { GlassCard } from '../components/ui/GlassCard'

const steps = [
  {
    n: 1,
    title: 'Pre-enroll the MD / CFO',
    body: 'Record a 15 s genuine sample and store the ECAPA embedding.',
    to: '/enroll',
    cta: 'Open enrollment',
  },
  {
    n: 2,
    title: 'Legitimate call',
    body: 'Stream natural speech. Expect green human verification and an unlocked RTGS desk.',
    to: '/call',
    cta: 'Join genuine call',
  },
  {
    n: 3,
    title: 'Live deepfake attack',
    body: 'Inject cloned audio with a high-pressure RTGS instruction.',
    to: '/dashboard',
    cta: 'Open command center',
  },
  {
    n: 4,
    title: 'Interception < 350 ms',
    body: 'Watch the banking CTA freeze and the out-of-band challenge appear.',
    to: '/banking',
    cta: 'Show banking lock',
  },
]

export function DemoPage() {
  const { enroll, startCall, setMode, setDemoStep, demoStep, voiceprint } = useSession()
  const navigate = useNavigate()

  const run = () => {
    if (!voiceprint) {
      enroll('Aditi Sharma', 'Managing Director / CFO', 15)
    }
    setDemoStep(2)
    setMode('legitimate')
    startCall('webrtc')
    navigate('/dashboard')
    window.setTimeout(() => {
      setMode('attack')
      setDemoStep(3)
    }, 4200)
    window.setTimeout(() => {
      setDemoStep(4)
      navigate('/banking')
    }, 7800)
  }

  return (
    <div className="space-y-4">
      <GlassCard className="p-8">
        <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
          Automated Security Workflow
        </div>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight">Threat Simulation & Interception</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-neutral-600">
          Experience real-time voice verification workflows: automatically enrolls an executive
          voiceprint, verifies authentic stream telemetry, and intercepts synthetic voice-clone
          attacks before unauthorized transactions occur.
        </p>
        <div className="mt-6">
          <Button onClick={run}>Run full security sequence</Button>
        </div>
      </GlassCard>
      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((s) => (
          <GlassCard key={s.n} className="p-6" strong={demoStep >= s.n}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
              Step {s.n}
            </div>
            <h3 className="mt-2 text-lg font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-600">{s.body}</p>
            <div className="mt-4">
              <Button
                variant="ghost"
                onClick={() => {
                  if (s.n === 2) {
                    setMode('legitimate')
                    startCall()
                  }
                  if (s.n === 3) {
                    setMode('attack')
                    startCall()
                  }
                  setDemoStep(s.n as 1 | 2 | 3 | 4)
                  navigate(s.to)
                }}
              >
                {s.cta}
              </Button>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  )
}
