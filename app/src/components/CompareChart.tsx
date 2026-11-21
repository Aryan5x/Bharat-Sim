/** Condition vs baseline: the one rich visual of the report.
 * Each condition is a bar; the dark tick marks the baseline value, so the gap
 * between bar end and tick is the cost of that condition. */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { RunResult, TestProfile } from '../lib/api';
import { ms, pct } from '../lib/format';
import { c, f, verdictColor } from '../lib/theme';
import { Segmented, Signal, T } from './ui';

type MetricKey = 'cold_start_ms_median' | 'jank_percent' | 'memory_pss_mb' | 'data_used_kb';

const METRICS: { key: MetricKey; label: string; fmt: (n: number | null | undefined) => string; lowerIsBetter: true }[] = [
  { key: 'cold_start_ms_median', label: 'Cold start', fmt: ms, lowerIsBetter: true },
  { key: 'jank_percent', label: 'Jank', fmt: pct, lowerIsBetter: true },
  { key: 'memory_pss_mb', label: 'Memory', fmt: (n) => (n == null ? '—' : `${Math.round(n)} MB`), lowerIsBetter: true },
  { key: 'data_used_kb', label: 'Data used', fmt: (n) => (n == null ? '—' : n >= 1024 ? `${(n / 1024).toFixed(1)} MB` : `${Math.round(n)} KB`), lowerIsBetter: true },
];

function Bar({ fraction, color }: { fraction: number; color: string }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(fraction, { duration: 600, easing: Easing.bezier(0.22, 1, 0.36, 1) });
  }, [fraction, w]);
  const style = useAnimatedStyle(() => ({ width: `${Math.max(0.6, w.value * 100)}%` }));
  return <Animated.View style={[styles.bar, { backgroundColor: color }, style]} />;
}

export function CompareChart({ results, profiles, narrow }: { results: RunResult[]; profiles: Record<string, TestProfile>; narrow?: boolean }) {
  const [metric, setMetric] = useState<MetricKey>('cold_start_ms_median');
  const m = METRICS.find((x) => x.key === metric)!;
  const ordered = useMemo(
    () => [...results].sort((a, b) => (profiles[a.profile_key]?.sort_order ?? 99) - (profiles[b.profile_key]?.sort_order ?? 99)),
    [results, profiles],
  );
  const values = ordered.map((r) => (typeof r.metrics?.[metric] === 'number' ? (r.metrics[metric] as number) : null));
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  const base = ordered.find((r) => r.profile_key === 'baseline');
  const baseVal = base && typeof base.metrics?.[metric] === 'number' ? (base.metrics[metric] as number) : null;
  const any = values.some((v) => v !== null);
  const labelW = narrow ? 104 : 180;

  return (
    <View>
      <View style={{ marginBottom: 16 }}>
        <Segmented options={METRICS.map((x) => ({ key: x.key, label: x.label }))} value={metric} onChange={setMetric} />
      </View>
      {!any ? (
        <T v="small" tone="t3">This metric was not captured on this run.</T>
      ) : (
        <View>
          {ordered.map((r, i) => {
            const v = values[i];
            const isBase = r.profile_key === 'baseline';
            const delta = !isBase && v !== null && baseVal ? Math.round(((v - baseVal) / baseVal) * 100) : null;
            return (
              <View key={r.profile_key} style={styles.row}>
                <View style={[styles.name, { width: labelW }]}>
                  <Signal verdict={r.verdict} />
                  <T v="small" numberOfLines={1} style={{ flexShrink: 1, color: c.t1, fontSize: narrow ? 13 : 14 }}>{profiles[r.profile_key]?.name ?? r.profile_key}</T>
                </View>
                <View style={styles.track}>
                  {v !== null ? <Bar fraction={v / max} color={isBase ? c.ink : verdictColor[r.verdict].bar} /> : null}
                  {baseVal !== null && !isBase ? <View style={[styles.tick, { left: `${(baseVal / max) * 100}%` }]} /> : null}
                </View>
                <View style={{ width: narrow ? 70 : 96, alignItems: 'flex-end' }}>
                  <T v="mono" style={{ fontSize: 13, color: c.t1 }}>{m.fmt(v)}</T>
                  {delta !== null ? (
                    <T v="meta" style={{ fontSize: 11, color: delta > 15 ? c.negInk : c.t3 }}>{delta > 0 ? `+${delta}%` : `${delta}%`} vs base</T>
                  ) : null}
                </View>
              </View>
            );
          })}
          <View style={styles.legend}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 2, height: 12, backgroundColor: c.ink }} />
              <T v="meta" tone="t3" style={{ fontSize: 11 }}>baseline value</T>
            </View>
            <T v="meta" tone="t3" style={{ fontSize: 11 }}>lower is better</T>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  name: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 24, backgroundColor: c.page, borderRadius: 4, justifyContent: 'center' },
  bar: { position: 'absolute', left: 0, top: 5, bottom: 5, borderRadius: 3 },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, backgroundColor: c.ink },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: c.line },
});

