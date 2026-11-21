import { useFocusEffect } from 'expo-router';
import { Gauge, Trash2 } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LazyFade, ShimmerRows } from '../../components/motion';
import { Page } from '../../components/Page';
import { useWide } from '../../components/Shell';
import { Button, Field, Notice, Panel, SectionHead, T } from '../../components/ui';
import { api, DeviceProfile } from '../../lib/api';
import { ago } from '../../lib/format';
import { DeviceSpecs, nativeDevice } from '../../lib/native';
import { c, r } from '../../lib/theme';

const API_BASE = Platform.OS === 'web' ? (process.env.EXPO_PUBLIC_API_BASE ?? '') : (process.env.EXPO_PUBLIC_API_BASE ?? 'https://bharat-sim.vercel.app');

/** Real measurement: time a 512 KB download and three small round trips to the API. */
async function speedTest(onProgress: (p: number) => void): Promise<{ downKbps: number; rttMs: number }> {
  const rtts: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t = Date.now();
    await fetch(`${API_BASE}/api/health?ping=${Date.now()}`, { cache: 'no-store' });
    rtts.push(Date.now() - t);
    onProgress((i + 1) / 6);
  }
  let total = 0;
  let elapsed = 0;
  for (let i = 0; i < 3; i++) {
    const t = Date.now();
    const resp = await fetch(`${API_BASE}/api/speedtest?n=${Date.now()}`, { cache: 'no-store' });
    const buf = await resp.arrayBuffer();
    elapsed += Date.now() - t;
    total += buf.byteLength;
    onProgress((4 + i) / 6);
  }
  return { downKbps: Math.round((total * 8) / (elapsed / 1000) / 1000), rttMs: Math.min(...rtts) };
}

function Spec({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.spec}>
      <T v="small" tone="t3" style={{ fontSize: 12 }}>{k}</T>
      <T v="figure" style={{ fontSize: 17, marginTop: 2 }}>{v}</T>
    </View>
  );
}

export default function Phone() {
  const wide = useWide();
  const [specs, setSpecs] = useState<DeviceSpecs | null>(null);
  const [speed, setSpeed] = useState<{ downKbps: number; rttMs: number } | null>(null);
  const [saved, setSaved] = useState<DeviceProfile[] | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState<'measure' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const progress = useSharedValue(0);
  const meter = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const load = useCallback(async () => {
    try {
      setSaved(await api<DeviceProfile[]>('/devices'));
    } catch (e: any) {
      setError(e.message);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const measure = async () => {
    setError(null);
    setOk(null);
    setBusy('measure');
    progress.value = 0;
    try {
      const s = await nativeDevice.specs();
      setSpecs(s);
      if (!label) setLabel([s.manufacturer, s.model].filter(Boolean).join(' ') || 'This device');
      const result = await speedTest((p) => (progress.value = withTiming(p, { duration: 250 })));
      setSpeed(result);
    } catch {
      setError('The measurement did not finish. Check your connection and try again');
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!specs) return;
    setBusy('save');
    setError(null);
    try {
      await api('/devices', {
        method: 'POST',
        body: {
          label: (label || 'This device').slice(0, 80),
          manufacturer: specs.manufacturer,
          model: specs.model,
          android_version: specs.androidVersion,
          sdk_int: specs.sdkInt,
          total_ram_mb: specs.totalRamMb,
          screen_width: specs.screenWidth,
          screen_height: specs.screenHeight,
          network_type: specs.networkType,
          measured_down_kbps: speed?.downKbps ?? null,
          measured_rtt_ms: speed?.rttMs ?? null,
        },
      });
      setOk('Saved. You can compare against this phone when you start a test');
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (id: string) => {
    try {
      await api(`/devices/${id}`, { method: 'DELETE' });
      setSaved((cur) => cur?.filter((d) => d.id !== id) ?? null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const gb = (mb: number | null) => (mb == null ? '—' : `${(mb / 1024).toFixed(1)} GB`);

  return (
    <Page
      title="My phone"
      subtitle={
        nativeDevice.available
          ? 'Read this phone’s real specs and measure your network right now, then compare test results against it.'
          : 'Measure this device and your network. Open BharatSim on your Android phone to read its exact RAM and Android version.'
      }
    >
      <View style={{ gap: 16 }}>
        <Panel>
          <View style={{ flexDirection: wide ? 'row' : 'column', alignItems: wide ? 'center' : 'stretch', gap: 16 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <T v="h2">Measure this device</T>
              <T v="small" tone="t2">Reads hardware details and times real downloads from the BharatSim server. Nothing is estimated.</T>
            </View>
            <Button title={specs ? 'Measure again' : 'Measure now'} kind="accent" icon={<Gauge size={16} color={c.white} strokeWidth={1.75} />} loading={busy === 'measure'} onPress={measure} />
          </View>
          {busy === 'measure' && (
            <View style={styles.track}>
              <Animated.View style={[styles.fill, meter]} />
            </View>
          )}
        </Panel>

        {specs && (
          <LazyFade placeholderHeight={240}>
            <Panel pad={false} style={{ overflow: 'hidden' }}>
              <View style={{ padding: wide ? 20 : 16, borderBottomWidth: 1, borderBottomColor: c.line }}>
                <T v="h2">{[specs.manufacturer, specs.model].filter(Boolean).join(' ') || 'This device'}</T>
                <T v="meta" tone="t3">{specs.androidVersion ? `Android ${specs.androidVersion} · API ${specs.sdkInt}` : 'browser measurement'}</T>
              </View>
              <View style={styles.grid}>
                <Spec k="Total RAM" v={gb(specs.totalRamMb)} />
                <Spec k="Free RAM now" v={gb(specs.availRamMb)} />
                <Spec k="Free storage" v={gb(specs.freeStorageMb)} />
                <Spec k="Screen" v={specs.screenWidth ? `${specs.screenWidth}×${specs.screenHeight}` : '—'} />
                <Spec k="Network" v={specs.networkType ?? '—'} />
                <Spec k="Download now" v={speed ? `${(speed.downKbps / 1000).toFixed(1)} Mbps` : '—'} />
                <Spec k="Round trip" v={speed ? `${speed.rttMs} ms` : '—'} />
                <Spec k="Low-RAM device" v={specs.lowRamDevice == null ? '—' : specs.lowRamDevice ? 'yes' : 'no'} />
                <Spec k="Lab emulator" v="2 GB · API 30" />
              </View>
              <View style={{ padding: wide ? 20 : 16, gap: 12 }}>
                <Field label="Name this phone" value={label} onChangeText={setLabel} placeholder="Mom's Redmi" maxLength={80} />
                <Button title="Save as a comparison device" onPress={save} loading={busy === 'save'} disabled={!!busy} style={{ alignSelf: wide ? 'flex-start' : 'stretch' }} />
              </View>
            </Panel>
          </LazyFade>
        )}

        {error ? <Notice kind="error">{error}</Notice> : null}
        {ok ? <Notice kind="ok">{ok}</Notice> : null}

        <Panel>
          <SectionHead title="Saved phones" />
          {saved === null ? (
            <ShimmerRows rows={2} />
          ) : saved.length === 0 ? (
            <T v="small" tone="t3">No saved phones yet. Measure a phone and save it to compare reports against it.</T>
          ) : (
            saved.map((d, i) => (
              <View key={d.id} style={[styles.saved, i === saved.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="h3" numberOfLines={1} style={{ fontSize: 14 }}>{d.label}</T>
                  <T v="meta" tone="t3" numberOfLines={1}>
                    {[d.total_ram_mb ? gb(d.total_ram_mb) : null, d.android_version ? `Android ${d.android_version}` : null, d.measured_down_kbps ? `${(d.measured_down_kbps / 1000).toFixed(1)} Mbps` : null, ago(d.created_at)].filter(Boolean).join(' · ')}
                  </T>
                </View>
                <Pressable onPress={() => remove(d.id)} accessibilityLabel={`Delete ${d.label}`} hitSlop={10}>
                  <Trash2 size={16} color={c.t3} strokeWidth={1.5} />
                </Pressable>
              </View>
            ))
          )}
        </Panel>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, backgroundColor: c.raised, overflow: 'hidden', marginTop: 16 },
  fill: { height: '100%', backgroundColor: c.acc },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  spec: { width: '33.33%', minWidth: 150, flexGrow: 1, paddingHorizontal: 20, paddingVertical: 14, borderRightWidth: 1, borderBottomWidth: 1, borderColor: c.line },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line },
});

