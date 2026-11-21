// Field test bench: ink-grey neutrals, one signal-amber accent, IBM Plex.
export const c = {
  page: '#f5f7fa',
  card: '#ffffff',
  raised: '#eceff4',
  line: 'rgba(17,24,39,0.09)',
  lineStrong: 'rgba(17,24,39,0.16)',
  t1: '#111827',
  t2: '#4b5565',
  t3: '#6b7487',
  acc: '#b45309',
  accInk: '#92400e',
  accSoft: '#fdf3e7',
  pos: '#16a34a',
  posInk: '#166534',
  posSoft: '#ecf8f0',
  neg: '#dc2626',
  negInk: '#991b1b',
  negSoft: '#fdeeee',
  ink: '#111827',
  white: '#ffffff',
} as const;

export const f = {
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemi: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export const r = { s: 6, m: 10, l: 14 } as const;

export type Verdict = 'pass' | 'warn' | 'fail' | 'error';

export const verdictColor: Record<Verdict, { ink: string; soft: string; bar: string; label: string }> = {
  pass: { ink: c.posInk, soft: c.posSoft, bar: '#9aa3b2', label: 'Pass' },
  warn: { ink: c.accInk, soft: c.accSoft, bar: '#d08a3e', label: 'Needs work' },
  fail: { ink: c.negInk, soft: c.negSoft, bar: c.neg, label: 'Fails' },
  error: { ink: c.t2, soft: c.raised, bar: c.t3, label: 'Could not test' },
};

export const ease = [0.22, 1, 0.36, 1] as const;
