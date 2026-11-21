import { Link, router, useFocusEffect } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LazyFade, ShimmerRows } from '../../components/motion';
import { ScoreText as Score, StatusLabel } from '../../components/RunBits';
import { Page } from '../../components/Page';
import { useWide } from '../../components/Shell';
import { Button, Notice, Panel, T } from '../../components/ui';
import { api, Run } from '../../lib/api';
import { ago } from '../../lib/format';
import { c } from '../../lib/theme';

export default function Runs() {
  const wide = useWide();
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      setRuns(await api<Run[]>('/runs'));
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Poll only while something is in progress.
  useEffect(() => {
    const active = runs?.some((r) => r.status === 'queued' || r.status === 'running');
    if (active && !timer.current) timer.current = setInterval(load, 5000);
    if (!active && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [runs, load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <Page
      title="Runs"
      subtitle="Every test you have sent to the lab, newest first."
      right={<Button title="New test" kind="quiet" size="sm" onPress={() => router.push('/test')} />}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {error ? <View style={{ marginBottom: 16 }}><Notice kind="error">{error}</Notice></View> : null}
      <Panel pad={false} style={{ overflow: 'hidden' }}>
        {runs === null && !error ? (
          <View style={{ padding: 20 }}>
            <ShimmerRows rows={5} />
          </View>
        ) : runs && runs.length === 0 ? (
          <View style={styles.empty}>
            <T v="h3">No runs yet</T>
            <T v="small" tone="t2" style={{ marginBottom: 16, textAlign: 'center' }}>Start a test and it will show up here with its readiness score.</T>
            <Button title="Start a test" onPress={() => router.push('/test')} />
          </View>
        ) : wide ? (
          <View>
            <View style={[styles.row, styles.headRow]}>
              <T v="meta" tone="t3" style={styles.cApp}>app</T>
              <T v="meta" tone="t3" style={styles.cCond}>conditions</T>
              <T v="meta" tone="t3" style={styles.cStatus}>status</T>
              <T v="meta" tone="t3" style={styles.cScore}>score</T>
              <T v="meta" tone="t3" style={styles.cWhen}>started</T>
            </View>
            {(runs ?? []).map((r, i) => (
              <LazyFade key={r.id} delay={Math.min(i, 6) * 40} placeholderHeight={56}>
                <Link href={`/run/${r.id}`} asChild>
                  <Pressable style={({ hovered }: any) => [styles.row, hovered && { backgroundColor: c.page }]}>
                    <View style={styles.cApp}>
                      <T v="h3" numberOfLines={1} style={{ fontSize: 14 }}>{r.apps?.label ?? 'Deleted app'}</T>
                      <T v="meta" tone="t3" numberOfLines={1}>{r.apps?.package_name ?? ''}</T>
                    </View>
                    <T v="small" tone="t2" style={styles.cCond}>{r.profiles.length}</T>
                    <View style={styles.cStatus}><StatusLabel status={r.status} stage={r.stage} /></View>
                    <View style={styles.cScore}><Score value={r.readiness_score} /></View>
                    <T v="small" tone="t3" style={styles.cWhen}>{ago(r.created_at)}</T>
                  </Pressable>
                </Link>
              </LazyFade>
            ))}
          </View>
        ) : (
          <View>
            {(runs ?? []).map((r, i) => (
              <LazyFade key={r.id} delay={Math.min(i, 6) * 40} placeholderHeight={72}>
                <Link href={`/run/${r.id}`} asChild>
                  <Pressable style={({ pressed }) => [styles.card, pressed && { backgroundColor: c.page }]}>
                    <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
                      <T v="h3" numberOfLines={1}>{r.apps?.label ?? 'Deleted app'}</T>
                      <StatusLabel status={r.status} stage={r.stage} />
                      <T v="meta" tone="t3">{r.profiles.length} conditions · {ago(r.created_at)}</T>
                    </View>
                    <Score value={r.readiness_score} />
                    <ChevronRight size={18} color={c.t3} strokeWidth={1.5} />
                  </Pressable>
                </Link>
              </LazyFade>
            ))}
          </View>
        )}
      </Panel>
    </Page>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line, gap: 16 },
  headRow: { paddingVertical: 12 },
  cApp: { flex: 3, minWidth: 0 },
  cCond: { flex: 1 },
  cStatus: { flex: 2.2 },
  cScore: { flex: 0.8, alignItems: 'flex-end' },
  cWhen: { flex: 1.2, textAlign: 'right' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line },
});
