import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import { Link, router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { ArrowLeft, ChevronDown, ChevronUp, Download, Pause, Play, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { CompareChart } from '../../../components/CompareChart';
import { Enter, LazyFade, LiveDot, Shimmer, ShimmerRows, WordReveal } from '../../../components/motion';
import { Page } from '../../../components/Page';
import { ScoreRing, StatusLabel } from '../../../components/RunBits';
import { useWide } from '../../../components/Shell';
import { Button, Divider, Notice, Panel, SectionHead, Signal, T, Tag, type as tx, VerdictLabel } from '../../../components/ui';
import { api, Explanation, RunDetail, RunResult, TestProfile } from '../../../lib/api';
import { ago, duration, ms, pct } from '../../../lib/format';
import { c, f, r } from '../../../lib/theme';

const LANGS = [
  { code: 'hi-IN', name: 'हिन्दी' },
  { code: 'ta-IN', name: 'தமிழ்' },
  { code: 'mr-IN', name: 'मराठी' },
  { code: 'bn-IN', name: 'বাংলা' },
  { code: 'te-IN', name: 'తెలుగు' },
  { code: 'kn-IN', name: 'ಕನ್ನಡ' },
];

// ---------------------------------------------------------------- explanation + Sarvam

function ExplainPanel({ run }: { run: RunDetail }) {
  const [english, setEnglish] = useState<Explanation | null>(run.translations.find((t) => t.language === 'en-IN')?.content ?? null);
  const [lang, setLang] = useState<string>('en-IN');
  const [translated, setTranslated] = useState<Record<string, Explanation>>(
    Object.fromEntries(run.translations.filter((t) => t.language !== 'en-IN').map((t) => [t.language, t.content])),
  );
  const [busy, setBusy] = useState<'explain' | 'translate' | 'speech' | null>(english ? null : 'explain');
  const [error, setError] = useState<string | null>(null);
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (english) return;
    let alive = true;
    api<Explanation>(`/runs/${run.id}/explain`, { method: 'POST' })
      .then((e) => alive && setEnglish(e))
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setBusy(null));
    return () => {
      alive = false;
    };
  }, [english, run.id]);

  const pick = async (code: string) => {
    setError(null);
    player.pause();
    setLang(code);
    if (code === 'en-IN' || translated[code]) return;
    setBusy('translate');
    try {
      const t = await api<Explanation>(`/runs/${run.id}/translate`, { method: 'POST', body: { language: code } });
      setTranslated((cur) => ({ ...cur, [code]: t }));
    } catch (e: any) {
      setError(e.message);
      setLang('en-IN');
    } finally {
      setBusy(null);
    }
  };

  const listen = async () => {
    if (status.playing) return player.pause();
    setError(null);
    setBusy('speech');
    try {
      const { url } = await api<{ url: string }>(`/runs/${run.id}/speech`, { method: 'POST', body: { language: lang } });
      player.replace({ uri: url });
      player.play();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const shown = lang === 'en-IN' ? english : translated[lang];

  return (
    <Panel>
      <SectionHead title="What this means" right={<T v="meta" tone="t3">{english?.generated_by === 'rules' ? 'rule-based summary' : 'explained by Sarvam AI'}</T>} />
      {busy === 'explain' || (!shown && !error) ? (
        <View style={{ gap: 10 }}>
          <Shimmer height={18} width="90%" />
          <Shimmer height={18} width="72%" />
          <View style={{ height: 8 }} />
          <ShimmerRows rows={2} />
        </View>
      ) : shown ? (
        <View>
          <WordReveal key={lang} text={shown.verdict} style={[tx.body, { fontSize: 18, lineHeight: 27, color: c.t1, marginBottom: 16, maxWidth: 720 }]} />
          {shown.issues.length > 0 && (
            <View style={{ borderTopWidth: 1, borderTopColor: c.line }}>
              {shown.issues.map((it, i) => (
                <View key={i} style={styles.issue}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T v="meta" tone="t3">problem</T>
                    <T v="small" style={{ fontSize: 14, lineHeight: 21, color: c.t1 }}>{it.issue}</T>
                  </View>
                  {it.fix ? (
                    <View style={{ flex: 1, gap: 2 }}>
                      <T v="meta" tone="t3">fix</T>
                      <T v="small" tone="t2" style={{ fontSize: 14, lineHeight: 21 }}>{it.fix}</T>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
      ) : null}
      {error ? <View style={{ marginTop: 12 }}><Notice kind="error">{error}</Notice></View> : null}
      <View style={styles.langBar}>
        <Pressable onPress={() => pick('en-IN')} style={[styles.langChip, lang === 'en-IN' && styles.langOn]} accessibilityRole="button" accessibilityState={{ selected: lang === 'en-IN' }}>
          <T v="small" style={{ color: lang === 'en-IN' ? c.white : c.t2 }}>English</T>
        </Pressable>
        {LANGS.map((l) => (
          <Pressable key={l.code} onPress={() => pick(l.code)} disabled={!english || !!busy} style={[styles.langChip, lang === l.code && styles.langOn]} accessibilityRole="button" accessibilityState={{ selected: lang === l.code }}>
            <T v="small" style={{ color: lang === l.code ? c.white : c.t2 }}>{l.name}</T>
          </Pressable>
        ))}
        {busy === 'translate' ? <T v="meta" tone="t3">translating…</T> : null}
      </View>
      {lang !== 'en-IN' && translated[lang] && (
        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Button
            size="sm"
            kind="quiet"
            title={status.playing ? 'Pause' : 'Listen to the summary'}
            loading={busy === 'speech'}
            icon={status.playing ? <Pause size={14} color={c.t1} strokeWidth={1.75} /> : <Play size={14} color={c.t1} strokeWidth={1.75} />}
            onPress={listen}
          />
          <T v="meta" tone="t3">Sarvam text-to-speech</T>
        </View>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- per-profile evidence

function delta(v: number | null | undefined, base: number | null | undefined) {
  if (v == null || base == null || base === 0) return null;
  return Math.round(((v - base) / base) * 100);
}

function Metric({ k, v, d }: { k: string; v: string; d?: number | null }) {
  return (
    <View style={styles.metric}>
      <T v="small" tone="t3" style={{ fontSize: 12 }}>{k}</T>
      <T v="figure" style={{ marginTop: 2 }}>{v}</T>
      {d != null ? <T v="meta" style={{ fontSize: 11, color: d > 15 ? c.negInk : c.t3 }}>{d > 0 ? `+${d}%` : `${d}%`} vs baseline</T> : <T v="meta" style={{ fontSize: 11 }}> </T>}
    </View>
  );
}

function ProfileBlock({ result, base, profile, wide }: { result: RunResult; base?: RunResult; profile?: TestProfile; wide: boolean }) {
  const [open, setOpen] = useState(false);
  const m = result.metrics ?? {};
  const b = base?.metrics ?? {};
  const isBase = result.profile_key === 'baseline';
  const applied = m.conditions_applied ?? {};
  return (
    <Panel pad={false} style={{ overflow: 'hidden' }}>
      <View style={styles.pTop}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="h3" style={{ fontSize: 16 }}>{profile?.name ?? result.profile_key}</T>
          <T v="small" tone="t3" numberOfLines={2}>{profile?.summary}</T>
        </View>
        <VerdictLabel verdict={result.verdict} />
      </View>
      <View style={[styles.metrics, !wide && { flexWrap: 'wrap' }]}>
        <Metric k="Cold start" v={ms(m.cold_start_ms_median)} d={isBase ? null : delta(m.cold_start_ms_median, b.cold_start_ms_median)} />
        <Metric k="Janky frames" v={pct(m.jank_percent)} />
        <Metric k="Crashes · ANRs" v={`${m.crashes ?? 0} · ${m.anrs ?? 0}`} />
        <Metric k="Memory" v={m.memory_pss_mb == null ? '—' : `${Math.round(m.memory_pss_mb)} MB`} d={isBase ? null : delta(m.memory_pss_mb, b.memory_pss_mb)} />
      </View>
      <View style={[styles.facts, !wide && { flexDirection: 'column' }]}>
        <View style={styles.fact}>
          <T v="meta" tone="t3">network errors</T>
          <T v="small">{m.network_errors ?? 0}</T>
        </View>
        <View style={styles.fact}>
          <T v="meta" tone="t3">mobile data used</T>
          <T v="small">{m.data_used_kb == null ? 'not measured' : `${Math.round(m.data_used_kb)} KB`}</T>
        </View>
        <View style={styles.fact}>
          <T v="meta" tone="t3">{m.offline_behavior ? 'when the network dropped' : 'automated exploration'}</T>
          <T v="small">{m.offline_behavior ? `${m.offline_behavior}${m.recovery_seconds != null ? `, recovered in ${m.recovery_seconds} s` : ''}` : m.monkey_events ? `${m.monkey_events} taps and swipes` : 'not run'}</T>
        </View>
      </View>
      {Object.keys(applied).length > 0 && (
        <View style={{ paddingHorizontal: wide ? 24 : 16, paddingTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(applied).map(([k, v]) => (
            <Tag key={k}>{`${k.replace(/_/g, ' ')}: ${String(v)}`}</Tag>
          ))}
        </View>
      )}
      <View style={{ paddingHorizontal: wide ? 24 : 16, paddingVertical: 12 }}>
        {result.findings.length === 0 ? (
          <T v="small" tone="t3">No failures found under this condition.</T>
        ) : (
          result.findings.map((fd, i) => (
            <View key={i} style={[styles.finding, !wide && { flexDirection: 'column', gap: 4 }, i === result.findings.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={{ width: wide ? 120 : undefined, gap: 2 }}>
                <T v="meta" tone="t2">{fd.category}</T>
                <T v="meta" tone="t3" style={{ fontSize: 11 }}>{fd.source === 'model' ? `model ${Math.round(fd.confidence * 100)}%` : `rule ${Math.round(fd.confidence * 100)}%`}</T>
              </View>
              <View style={{ flex: 1 }}>
                <T v="small" style={{ fontSize: 14, color: c.t1 }}>{fd.message}</T>
                {fd.fix ? <T v="small" tone="t2" style={{ marginTop: 4 }}>{fd.fix}</T> : null}
                {fd.evidence?.length ? (
                  <View style={styles.evidence}>
                    {fd.evidence.slice(0, 4).map((line, j) => (
                      <T key={j} v="meta" tone="t2" style={{ fontSize: 11, lineHeight: 16 }} numberOfLines={2}>{line}</T>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          ))
        )}
      </View>
      {result.logcat_excerpt ? (
        <>
          <Divider />
          <Pressable onPress={() => setOpen((o) => !o)} style={styles.toggle} accessibilityRole="button" accessibilityState={{ expanded: open }}>
            <T v="small" tone="t2">{open ? 'Hide raw log' : 'Show raw log excerpt'}</T>
            {open ? <ChevronUp size={16} color={c.t3} strokeWidth={1.5} /> : <ChevronDown size={16} color={c.t3} strokeWidth={1.5} />}
          </Pressable>
          {open && (
            <View style={[styles.evidence, { marginHorizontal: wide ? 24 : 16, marginBottom: 16, marginTop: 0 }]}>
              <T v="meta" tone="t2" style={{ fontSize: 11, lineHeight: 16 }} selectable>{result.logcat_excerpt.slice(0, 6000)}</T>
            </View>
          )}
        </>
      ) : null}
    </Panel>
  );
}

// ---------------------------------------------------------------- live view

function LivePanel({ run, onCancel }: { run: RunDetail; onCancel: () => void }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const steps = ['Waiting for the lab', 'Installing on the budget-phone emulator', ...run.profiles.map((p) => `Testing ${p.replace(/_/g, ' ')}`), 'Classifying failures and scoring'];
  const stage = (run.stage ?? '').toLowerCase();
  let current = run.status === 'queued' ? 0 : 1;
  run.profiles.forEach((p, i) => {
    if (stage.includes(p.replace(/_/g, ' ')) || stage.includes(p)) current = 2 + i;
  });
  if (stage.includes('classif') || stage.includes('scor') || stage.includes('saving')) current = steps.length - 1;
  return (
    <Panel>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <LiveDot />
        <T v="h2" style={{ flex: 1 }}>{run.status === 'queued' ? 'Waiting for the test lab' : 'Testing on the budget-phone emulator'}</T>
        <T v="mono" tone="t3">{duration(run.started_at ?? run.created_at, null)}</T>
      </View>
      {run.stage ? <T v="small" tone="t2" style={{ marginTop: 6 }}>{run.stage}</T> : null}
      <View style={{ marginTop: 16 }}>
        {steps.map((s, i) => (
          <View key={s} style={styles.stage}>
            <View style={[styles.stageDot, i < current && { backgroundColor: c.ink, borderColor: c.ink }, i === current && { borderColor: c.acc }]} />
            <T v="small" style={{ color: i < current ? c.t2 : i === current ? c.t1 : c.t3, fontFamily: i === current ? f.sansMedium : f.sans }}>{s}</T>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 16, flexDirection: 'row', gap: 8 }}>
        <Button size="sm" kind="danger" title="Cancel run" onPress={onCancel} />
      </View>
    </Panel>
  );
}

// ---------------------------------------------------------------- screen

export default function RunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const wide = useWide();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [profiles, setProfiles] = useState<Record<string, TestProfile>>({});
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<RunDetail>(`/runs/${id}`);
      setRun(data);
      setError(null);
      if (data.status === 'queued' || data.status === 'running') timer.current = setTimeout(load, 3000);
    } catch (e: any) {
      setError(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
    api<TestProfile[]>('/profiles')
      .then((ps) => setProfiles(Object.fromEntries(ps.map((p) => [p.key, p]))))
      .catch(() => undefined);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  const cancel = async () => {
    try {
      await api(`/runs/${id}/cancel`, { method: 'POST' });
      load();
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  const remove = async () => {
    try {
      await api(`/runs/${id}`, { method: 'DELETE' });
      router.replace('/runs');
    } catch (e: any) {
      setActionError(e.message);
    }
  };

  const exportJson = async () => {
    if (!run) return;
    const payload = JSON.stringify({ exported_at: new Date().toISOString(), run }, null, 2);
    const name = `bharatsim-${run.id.slice(0, 8)}.json`;
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([payload], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        const file = new File(Paths.cache, name);
        file.create({ overwrite: true });
        file.write(payload);
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Share report' });
      }
    } catch {
      setActionError('Could not export the report');
    }
  };

  const ordered = useMemo(
    () => (run ? [...run.results].sort((a, b) => (profiles[a.profile_key]?.sort_order ?? 99) - (profiles[b.profile_key]?.sort_order ?? 99)) : []),
    [run, profiles],
  );
  const base = ordered.find((x) => x.profile_key === 'baseline');

  const back = (
    <Link href="/runs" asChild>
      <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }} accessibilityRole="link">
        <ArrowLeft size={14} color={c.t3} strokeWidth={1.5} />
        <T v="small" tone="t3">All runs</T>
      </Pressable>
    </Link>
  );

  if (error && !run) {
    return (
      <Page title="Report" above={back}>
        <Notice kind="error">{error}</Notice>
      </Page>
    );
  }
  if (!run) {
    return (
      <Page title="Report" above={back}>
        <Panel>
          <View style={{ flexDirection: 'row', gap: 20, alignItems: 'center' }}>
            <Shimmer width={96} height={96} radius={48} />
            <View style={{ flex: 1, gap: 10 }}>
              <Shimmer height={22} width="60%" />
              <Shimmer height={12} width="40%" />
            </View>
          </View>
        </Panel>
        <View style={{ height: 16 }} />
        <Panel><ShimmerRows rows={4} /></Panel>
      </Page>
    );
  }

  const title = run.apps?.label ?? 'Report';
  const done = run.status === 'completed';

  return (
    <Page title={title} subtitle={`${run.apps?.package_name ?? 'package read during the run'} · started ${ago(run.created_at)}`} above={back}>
      <View style={{ gap: 16 }}>
        {actionError ? <Notice kind="error">{actionError}</Notice> : null}

        {(run.status === 'queued' || run.status === 'running') && <LivePanel run={run} onCancel={cancel} />}

        {run.status === 'failed' && (
          <Notice kind="error">{`The test could not finish: ${run.error ?? 'unknown error'}. Try again, or try a different APK.`}</Notice>
        )}
        {run.status === 'cancelled' && <Notice kind="info">This run was cancelled.</Notice>}

        {done && run.readiness_score !== null && (
          <Enter>
            <Panel style={[styles.head, !wide && { flexDirection: 'column', alignItems: 'flex-start' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20, flex: 1 }}>
                <ScoreRing value={run.readiness_score} size={wide ? 96 : 76} />
                <View style={{ flex: 1, gap: 6 }}>
                  <T v="h2">Bharat Readiness Score</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                    {ordered.map((x) => (
                      <View key={x.profile_key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Signal verdict={x.verdict} />
                        <T v="meta" tone="t2">{profiles[x.profile_key]?.name ?? x.profile_key}</T>
                      </View>
                    ))}
                  </View>
                  <T v="meta" tone="t3">Android 11 emulator · 2 GB RAM · 720p · finished in {duration(run.started_at, run.finished_at)}</T>
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button size="sm" kind="quiet" title="Export JSON" icon={<Download size={14} color={c.t1} strokeWidth={1.75} />} onPress={exportJson} />
                <Button size="sm" kind="danger" title="Delete" icon={<Trash2 size={14} color={c.neg} strokeWidth={1.75} />} onPress={remove} />
              </View>
            </Panel>
          </Enter>
        )}

        {done && <ExplainPanel run={run} />}

        {done && ordered.length > 0 && (
          <LazyFade placeholderHeight={300}>
            <Panel>
              <SectionHead title="Each condition against the baseline" />
              <CompareChart results={ordered} profiles={profiles} narrow={!wide} />
            </Panel>
          </LazyFade>
        )}

        {done && run.device_profiles && (
          <LazyFade placeholderHeight={100}>
            <Panel>
              <SectionHead title={`Compared with ${run.device_profiles.label}`} />
              <T v="small" tone="t2">
                {`Your phone: ${run.device_profiles.total_ram_mb ? `${(run.device_profiles.total_ram_mb / 1024).toFixed(1)} GB RAM` : 'RAM unknown'}, Android ${run.device_profiles.android_version ?? '?'}, measured ${run.device_profiles.measured_down_kbps ? `${(run.device_profiles.measured_down_kbps / 1000).toFixed(1)} Mbps` : 'no speed test'}. The lab emulator has 2 GB RAM on Android 11, so results on your phone should be close to the ${(run.device_profiles.total_ram_mb ?? 2048) <= 3072 ? 'tested' : 'baseline'} numbers.`}
              </T>
            </Panel>
          </LazyFade>
        )}

        {done &&
          ordered.map((x, i) => (
            <LazyFade key={x.profile_key} delay={i * 30} placeholderHeight={260}>
              <ProfileBlock result={x} base={base} profile={profiles[x.profile_key]} wide={wide} />
            </LazyFade>
          ))}

        {!done && run.status !== 'queued' && run.status !== 'running' && (
          <Button title="Delete this run" kind="danger" onPress={remove} style={{ alignSelf: 'flex-start' }} />
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  issue: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line },
  langBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 16, alignItems: 'center' },
  langChip: { height: 32, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: c.lineStrong, justifyContent: 'center', backgroundColor: c.card },
  langOn: { backgroundColor: c.ink, borderColor: c.ink },
  pTop: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.line },
  metrics: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.line },
  metric: { flexGrow: 1, flexBasis: '25%', minWidth: 140, paddingHorizontal: 20, paddingVertical: 14, borderRightWidth: 1, borderRightColor: c.line },
  facts: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.line },
  fact: { flex: 1, paddingHorizontal: 20, paddingVertical: 12, gap: 2 },
  finding: { flexDirection: 'row', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line },
  evidence: { marginTop: 8, padding: 10, borderRadius: 8, backgroundColor: c.page, borderWidth: 1, borderColor: c.line, gap: 2 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  stage: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line },
  stageDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: c.lineStrong },
});

