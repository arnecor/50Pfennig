/**
 * SplashScreen.tsx
 *
 * Shown while the app is hydrating (auth state not yet resolved).
 * Displays the Sharli wordmark + squirrel logo with a fade-in → hold → fade-out
 * animation. Respects system dark/light mode via CSS variables.
 */

import { useEffect, useState } from 'react';

interface Props {
  /** Called once the exit animation has fully completed */
  onDone?: () => void;
  /** When true the screen starts its fade-out */
  exiting?: boolean;
}

export default function SplashScreen({ exiting = false, onDone }: Props) {
  // phase: 'in' → 'hold' → 'out' → 'done'
  const [phase, setPhase] = useState<'in' | 'hold' | 'out' | 'done'>('in');

  useEffect(() => {
    // Fade in over 500 ms, then hold for 400 ms
    const holdTimer = setTimeout(() => setPhase('hold'), 500);
    return () => clearTimeout(holdTimer);
  }, []);

  // As soon as the parent signals ready (or after a minimum hold), start exit
  useEffect(() => {
    if (phase === 'hold' && exiting) {
      setPhase('out');
    }
    // Minimum display even if exiting comes early
    if (phase === 'in' && exiting) {
      const t = setTimeout(() => setPhase('out'), 900);
      return () => clearTimeout(t);
    }
  }, [phase, exiting]);

  useEffect(() => {
    if (phase === 'out') {
      // Fade-out takes 400 ms — notify parent after it completes
      const t = setTimeout(() => {
        setPhase('done');
        onDone?.();
      }, 400);
      return () => clearTimeout(t);
    }
  }, [phase, onDone]);

  if (phase === 'done') return null;

  const animClass =
    phase === 'in' ? 'splash-enter'
    : phase === 'out' ? 'splash-exit'
    : '';

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background ${animClass}`}
      aria-label="Sharli lädt"
      role="status"
    >
      {/* Logo mark */}
      <div className="flex flex-col items-center gap-5">
        <SharliLogo />
        <Wordmark />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Squirrel logo — minimal 2-colour SVG                                       */
/* -------------------------------------------------------------------------- */

function SharliLogo() {
  return (
    <svg
      width="88"
      height="88"
      viewBox="0 0 88 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Body */}
      <ellipse
        cx="44"
        cy="56"
        rx="18"
        ry="20"
        className="fill-foreground"
      />

      {/* Head */}
      <circle
        cx="44"
        cy="34"
        r="14"
        className="fill-foreground"
      />

      {/* Big fluffy tail — sweeping arc behind the body */}
      <path
        d="M 58 62
           C 78 58, 82 36, 68 26
           C 62 22, 58 28, 62 34
           C 66 40, 66 52, 54 62
           Z"
        className="fill-accent"
      />

      {/* Tail highlight */}
      <path
        d="M 62 34
           C 64 40, 63 52, 54 62
           C 60 56, 63 44, 62 34
           Z"
        className="fill-foreground opacity-20"
      />

      {/* Left ear */}
      <path
        d="M 34 24 L 30 12 L 40 20 Z"
        className="fill-foreground"
      />
      {/* Left ear inner */}
      <path
        d="M 34 23 L 31.5 15 L 38 21 Z"
        className="fill-accent"
      />

      {/* Right ear */}
      <path
        d="M 54 24 L 58 12 L 48 20 Z"
        className="fill-foreground"
      />
      {/* Right ear inner */}
      <path
        d="M 54 23 L 56.5 15 L 50 21 Z"
        className="fill-accent"
      />

      {/* Eyes */}
      <circle cx="39" cy="32" r="2.5" className="fill-background" />
      <circle cx="49" cy="32" r="2.5" className="fill-background" />
      {/* Pupils */}
      <circle cx="39.5" cy="32.5" r="1.2" className="fill-foreground" />
      <circle cx="49.5" cy="32.5" r="1.2" className="fill-foreground" />
      {/* Eye shine */}
      <circle cx="40.2" cy="31.8" r="0.5" className="fill-background opacity-80" />
      <circle cx="50.2" cy="31.8" r="0.5" className="fill-background opacity-80" />

      {/* Nose */}
      <ellipse cx="44" cy="38" rx="2" ry="1.5" className="fill-accent" />

      {/* Mouth */}
      <path
        d="M 42 39.5 Q 44 41.5 46 39.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        className="text-background"
        fill="none"
      />

      {/* Tiny paws / arms */}
      <ellipse cx="30" cy="58" rx="5" ry="3.5" className="fill-foreground" transform="rotate(-20 30 58)" />
      <ellipse cx="58" cy="58" rx="5" ry="3.5" className="fill-foreground" transform="rotate(20 58 58)" />

      {/* Coin in paw — the "sharing" motif */}
      <circle cx="30" cy="57" r="4" className="fill-accent" transform="rotate(-20 30 57)" />
      <text
        x="30"
        y="59"
        textAnchor="middle"
        fontSize="4.5"
        fontWeight="700"
        className="fill-foreground font-sans"
        transform="rotate(-20 30 57)"
      >
        €
      </text>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  "sharli" wordmark                                                          */
/* -------------------------------------------------------------------------- */

function Wordmark() {
  return (
    <div className="flex items-baseline gap-0 select-none">
      <span
        className="text-[2rem] font-bold tracking-tight text-foreground font-sans leading-none"
        style={{ letterSpacing: '-0.02em' }}
      >
        sharli
      </span>
    </div>
  );
}
