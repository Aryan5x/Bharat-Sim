import { router, useFocusEffect } from 'expo-router';
import { Check, FileUp, Package, Smartphone } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { LazyFade, ShimmerRows } from '../../components/motion';
import { Page } from '../../components/Page';
import { useWide } from '../../components/Shell';
import { Button, Notice, Panel, T, Tag, type as tx } from '../../components/ui';
import { api, AppRow, DeviceProfile, Run, TestProfile } from '../../lib/api';
import { bytes } from '../../lib/format';
import { InstalledAppsPicker, nativeDevice } from '../../lib/native';
import { pickApk, uploadApk } from '../../lib/upload';
import { c, f, r } from '../../lib/theme';

const FAST_DEFAULT = ['baseline', 'rural_2g'];

function StepHead({ n, title, body, done }: { n: number; title: string; body: string; done?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14, marginBottom: 16 }}>
      <View style={[styles.stepN, done && styles.stepDone]}>
        {done ? <Check size={14} color={c.white} strokeWidth={2} /> : <T v="meta" tone="t2">{n}</T>}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="h2">{title}</T>
        <T v="small" tone="t2">{body}</T>
      </View>
    </View>
  );
}

export default function NewTest() {
  const wide = useWide();
  const [apps, setApps] = useState<AppRow[] | null>(null);
  const [profiles, setProfiles] = useState<TestProfile[] | null>(null);
  const [devices, setDevices] = useState<DeviceProfile[]>([]);
  const [appId, setAppId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[]>(FAST_DEFAULT);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'upload' | 'sample' | 'start' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [showInstalled, setShowInstalled] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [a, p, d] = await Promise.all([api<AppRow[]>('/apps'), api<TestProfile[]>('/profiles'), api<DeviceProfile[]>('/devices')]);
      setApps(a);
      setProfiles(p);
      setDevices(d);
      setAppId((cur) => cur ?? a[0]?.id ?? null);
    } catch (e: any) {
      setLoadError(e.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const upload = async () => {
    setError(null);
    try {
      const picked = await pickApk();
      if (!picked) return;
      setBusy('upload');
      setProgress(`Uploading ${picked.name} (${bytes(picked.size)})`);
      const row = await uploadApk(picked);
      setApps((cur) => [row, ...(cur ?? [])]);
      setAppId(row.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };

  const addSample = async (key: 'fragile_news' | 'steady_notes') => {
    setError(null);
    setBusy('sample');
    try {
      const row = await api<AppRow>('/apps/sample', { method: 'POST', body: { key } });
      setApps((cur) => [row, ...(cur ?? [])]);
      setAppId(row.id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const toggle = (key: string) => {
    if (key === 'baseline') return;
    setChosen((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  };

  const start = async () => {
    if (!appId) return setError('Choose an app first');
    setError(null);
    setBusy('start');
    try {
      const run = await api<Run>('/runs', { method: 'POST', body: { app_id: appId, profiles: chosen, device_profile_id: deviceId } });
      router.push(`/run/${run.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const estimate = useMemo(() => Math.max(2, Math.round(chosen.length * 1.6)), [chosen.length]);
  const selectedApp = apps?.find((a) => a.id === appId);

  return (
    <Page title="New test" subtitle="Pick an app, choose the conditions it should survive, and send it to the test lab.">
      {loadError ? (
        <View style={{ marginBottom: 16, gap: 12 }}>
          <Notice kind="error">{loadError}</Notice>
          <Button title="Try again" kind="quiet" onPress={load} style={{ alignSelf: 'flex-start' }} />
        </View>
      ) : null}

      <View style={{ gap: 16 }}>
        {/* Step 1: app */}
        <Panel>
          <StepHead n={1} title="Choose the app" body="Upload an APK up to 50 MB, use one of the sample apps, or pick an app installed on this phone." done={!!appId} />
          <View style={[styles.sources, !wide && { flexDirection: 'column' }]}>
            <Pressable onPress={upload} disabled={!!busy} style={({ pressed, hovered }: any) => [styles.source, (pressed || hovered) && styles.sourceHover]} accessibilityRole="button">
              <FileUp size={22} strokeWidth={1.5} color={c.t2} />
              <View style={{ flex: 1 }}>
                <T v="h3">Upload an APK</T>
                <T v="small" tone="t3">{busy === 'upload' && progress ? progress : 'Choose an .apk file'}</T>
              </View>
            </Pressable>
            {nativeDevice.available && (
              <Pressable onPress={() => setShowInstalled(true)} disabled={!!busy} style={({ pressed }) => [styles.source, pressed && styles.sourceHover]} accessibilityRole="button">
                <Smartphone size={22} strokeWidth={1.5} color={c.t2} />
                <View style={{ flex: 1 }}>
                  <T v="h3">From this phone</T>
                  <T v="small" tone="t3">Test an app you already have installed</T>
                </View>
              </Pressable>
            )}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' }}>
            <T v="small" tone="t3">No APK handy?</T>
            <Button size="sm" kind="quiet" title="Fragile News sample" onPress={() => addSample('fragile_news')} disabled={!!busy} />
            <Button size="sm" kind="quiet" title="Steady Notes sample" onPress={() => addSample('steady_notes')} disabled={!!busy} />
          </View>

          {showInstalled && (
            <InstalledAppsPicker
              onClose={() => setShowInstalled(false)}
              onUploaded={(row) => {
                setApps((cur) => [row, ...(cur ?? [])]);
                setAppId(row.id);
                setShowInstalled(false);
              }}
            />
          )}

          <View style={{ marginTop: 16 }}>
            {apps === null && !loadError ? (
              <ShimmerRows rows={3} />
            ) : apps && apps.length > 0 ? (
              <View style={styles.list}>
                {apps.slice(0, 8).map((a) => {
                  const on = a.id === appId;
                  return (
                    <Pressable key={a.id} onPress={() => setAppId(a.id)} style={[styles.appRow, on && styles.appRowOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                      <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                      <Package size={18} strokeWidth={1.5} color={c.t3} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <T v="h3" numberOfLines={1} style={{ fontSize: 14 }}>{a.label}</T>
                        <T v="meta" tone="t3" numberOfLines={1}>{a.package_name ?? 'package read during the run'}</T>
                      </View>
                      <T v="meta" tone="t3">{a.source === 'sample' ? 'sample' : bytes(a.size_bytes)}</T>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <T v="small" tone="t3">No apps yet. Upload one or start with a sample.</T>
            )}
          </View>
        </Panel>

        {/* Step 2: conditions */}
        <LazyFade placeholderHeight={420}>
          <Panel>
            <StepHead n={2} title="Choose the conditions" body="Every test includes a baseline run, so each condition is compared against normal behaviour. The fast default is baseline and rural 2G." done={chosen.length > 1} />
            {profiles === null && !loadError ? (
              <ShimmerRows rows={4} />
            ) : (
              <View style={[styles.conds, wide && { flexDirection: 'row', flexWrap: 'wrap' }]}>
                {(profiles ?? []).map((p) => {
                  const on = chosen.includes(p.key);
                  const locked = p.key === 'baseline';
                  return (
                    <Pressable
                      key={p.key}
                      onPress={() => toggle(p.key)}
                      disabled={locked}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on, disabled: locked }}
                      style={[styles.cond, wide && { width: '49.3%' }, on && styles.condOn]}
                    >
                      <View style={[styles.check, on && styles.checkOn]}>{on ? <Check size={12} color={c.white} strokeWidth={2.5} /> : null}</View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <T v="h3" style={{ fontSize: 14 }}>{p.name}</T>
                          {locked ? <Tag>always on</Tag> : null}
                        </View>
                        <T v="small" tone="t2">{p.summary}</T>
                        <T v="meta" tone="t3" style={{ fontSize: 11, marginTop: 4 }}>{p.source}</T>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {devices.length > 0 && (
              <View style={{ marginTop: 16, gap: 8 }}>
                <T v="small" tone="t2" style={{ fontFamily: f.sansMedium }}>Compare with a real phone (optional)</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Button size="sm" kind={deviceId === null ? 'primary' : 'quiet'} title="None" onPress={() => setDeviceId(null)} />
                  {devices.slice(0, 4).map((d) => (
                    <Button key={d.id} size="sm" kind={deviceId === d.id ? 'primary' : 'quiet'} title={d.label} onPress={() => setDeviceId(d.id)} />
                  ))}
                </View>
              </View>
            )}
          </Panel>
        </LazyFade>

        {/* Step 3: launch */}
        <Panel style={[styles.launch, !wide && { flexDirection: 'column', alignItems: 'stretch' }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h3">{selectedApp ? selectedApp.label : 'No app selected'}</T>
            <T v="small" tone="t3">
              {chosen.length} condition{chosen.length === 1 ? '' : 's'} · about {estimate} min on the lab emulator
            </T>
          </View>
          <Button title="Start test" kind="accent" onPress={start} loading={busy === 'start'} disabled={!appId || !!busy} />
        </Panel>
        {error ? <Notice kind="error">{error}</Notice> : null}
        {Platform.OS === 'web' ? null : <View style={{ height: 8 }} />}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  stepN: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: c.lineStrong, alignItems: 'center', justifyContent: 'center' },
  stepDone: { backgroundColor: c.ink, borderColor: c.ink },
  sources: { flexDirection: 'row', gap: 8 },
  source: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: r.m, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.lineStrong, backgroundColor: c.page },
  sourceHover: { borderColor: c.acc, backgroundColor: c.accSoft },
  list: { borderWidth: 1, borderColor: c.line, borderRadius: r.m, overflow: 'hidden' },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.card },
  appRowOn: { backgroundColor: c.accSoft },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: c.lineStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: c.acc },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.acc },
  conds: { gap: 8 },
  cond: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: r.m, borderWidth: 1, borderColor: c.line, backgroundColor: c.card },
  condOn: { borderColor: 'rgba(180,83,9,0.45)', backgroundColor: c.accSoft },
  check: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: c.lineStrong, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkOn: { backgroundColor: c.acc, borderColor: c.acc },
  launch: { flexDirection: 'row', alignItems: 'center', gap: 16 },
});

