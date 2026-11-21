import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { RunStatus } from '../lib/api';
import { c, f } from '../lib/theme';
import { LiveDot } from './motion';
import { T } from './ui';

const STATUS: Record<RunStatus, { label: string; color: string }> = {
  queued: { label: 'Waiting for the lab', color: c.t3 },
  running: { label: 'Running', color: c.acc },
  completed: { label: 'Completed', color: c.pos },
  failed: { label: 'Failed', color: c.neg },
  cancelled: { label: 'Cancelled', color: c.t3 },
};

export function StatusLabel({ status, stage }: { status: RunStatus; stage?: string | null }) {
  const s = STATUS[status];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 }}>
      {status === 'running' ? <LiveDot /> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />}
      <T v="small" tone="t2" numberOfLines={1} style={{ flexShrink: 1 }}>{status === 'running' && stage ? stage : s.label}</T>
    </View>
  );
}

export function scoreColor(value: number) {
  return value >= 75 ? c.pos : value >= 50 ? c.acc : c.neg;
}

export function ScoreText({ value }: { value: number | null }) {
  if (value === null) return <T v="mono" tone="t3">—</T>;
  const color = value >= 75 ? c.posInk : value >= 50 ? c.accInk : c.negInk;
  return <T v="mono" style={{ color, fontFamily: f.monoMedium, fontSize: 15 }}>{value}</T>;
}

export function ScoreRing({ value, size = 96 }: { value: number; size?: number }) {
  const stroke = size > 80 ? 6 : 5;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const color = scoreColor(value);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityLabel={`Bharat Readiness Score ${value} out of 100`}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={c.raised} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - value / 100)}
        />
      </Svg>
      <T style={{ fontFamily: f.monoMedium, fontSize: size > 80 ? 28 : 22, lineHeight: size > 80 ? 32 : 26, color: c.t1 }}>{value}</T>
      <T v="meta" tone="t3" style={{ fontSize: 10, marginTop: -2 }}>of 100</T>
    </View>
  );
}
