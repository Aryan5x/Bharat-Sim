/**
 * On-device checks. On Android the local Expo module `BharatDevice` reads the
 * phone's real specs and the list of installed apps. On the web these return
 * what the browser can honestly tell us, and the installed-apps picker is hidden.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Search, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ShimmerRows } from '../components/motion';
import { Button, Notice, T } from '../components/ui';
import type { AppRow } from './api';
import { bytes } from './format';
import { c, f, r } from './theme';
import { MAX_APK_BYTES, uploadApk } from './upload';
import { File } from 'expo-file-system';

export type DeviceSpecs = {
  manufacturer: string | null;
  model: string | null;
  androidVersion: string | null;
  sdkInt: number | null;
  totalRamMb: number | null;
  availRamMb: number | null;
  lowRamDevice: boolean | null;
  screenWidth: number | null;
  screenHeight: number | null;
  densityDpi: number | null;
  freeStorageMb: number | null;
  networkType: string | null;
  downKbpsEstimate: number | null;
};

export type InstalledApp = { packageName: string; label: string; versionName: string | null; sizeBytes: number; apkPath: string };

type Native = {
  getDeviceSpecs(): Promise<DeviceSpecs>;
  listInstalledApps(): Promise<InstalledApp[]>;
  copyApkToCache(packageName: string): Promise<string>;
};

const mod = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('BharatDevice') : null;

export const nativeDevice = {
  available: !!mod,
  async specs(): Promise<DeviceSpecs> {
    if (mod) return mod.getDeviceSpecs();
    const nav: any = typeof navigator !== 'undefined' ? navigator : {};
    const conn = nav.connection;
    return {
      manufacturer: null,
      model: null,
      androidVersion: null,
      sdkInt: null,
      totalRamMb: nav.deviceMemory ? Math.round(nav.deviceMemory * 1024) : null,
      availRamMb: null,
      lowRamDevice: null,
      screenWidth: typeof window !== 'undefined' ? Math.round(window.screen.width * (window.devicePixelRatio || 1)) : null,
      screenHeight: typeof window !== 'undefined' ? Math.round(window.screen.height * (window.devicePixelRatio || 1)) : null,
      densityDpi: typeof window !== 'undefined' ? Math.round(160 * (window.devicePixelRatio || 1)) : null,
      freeStorageMb: null,
      networkType: conn?.effectiveType ?? null,
      downKbpsEstimate: conn?.downlink ? Math.round(conn.downlink * 1000) : null,
    };
  },
  installed: () => (mod ? mod.listInstalledApps() : Promise.resolve([] as InstalledApp[])),
  copy: (pkg: string) => (mod ? mod.copyApkToCache(pkg) : Promise.reject(new Error('Not available'))),
};

export function InstalledAppsPicker({ onClose, onUploaded }: { onClose: () => void; onUploaded: (row: AppRow) => void }) {
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    nativeDevice
      .installed()
      .then((list) => setApps(list.sort((a, b) => a.label.localeCompare(b.label))))
      .catch(() => setError('Could not read installed apps on this phone'));
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (apps ?? []).filter((a) => !q || a.label.toLowerCase().includes(q) || a.packageName.includes(q));
  }, [apps, query]);

  const choose = async (app: InstalledApp) => {
    if (app.sizeBytes > MAX_APK_BYTES) return setError(`${app.label} is ${bytes(app.sizeBytes)}. APKs up to 50 MB are supported`);
    setError(null);
    setBusy(app.packageName);
    try {
      const uri = await nativeDevice.copy(app.packageName);
      const row = await uploadApk(
        {
          name: `${app.packageName}.apk`,
          size: app.sizeBytes,
          read: async () => {
            const b = await new File(uri).bytes();
            return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
          },
        },
        'device',
        { label: app.label, package_name: app.packageName, version_name: app.versionName },
      );
      onUploaded(row);
    } catch (e: any) {
      setError(e.message ?? 'Upload failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <T v="h2">Apps on this phone</T>
          <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={12}>
            <X size={22} color={c.t2} strokeWidth={1.5} />
          </Pressable>
        </View>
        <View style={styles.search}>
          <Search size={16} color={c.t3} strokeWidth={1.5} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor={c.t3} style={styles.searchInput} />
        </View>
        {error ? <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}><Notice kind="error">{error}</Notice></View> : null}
        {apps === null && !error ? (
          <View style={{ padding: 16 }}>
            <ShimmerRows rows={6} />
          </View>
        ) : (
          <FlatList
            data={shown}
            keyExtractor={(a) => a.packageName}
            initialNumToRender={14}
            windowSize={7}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: c.line }} />}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="h3" numberOfLines={1} style={{ fontSize: 14 }}>{item.label}</T>
                  <T v="meta" tone="t3" numberOfLines={1}>{item.packageName} · {bytes(item.sizeBytes)}</T>
                </View>
                <Button size="sm" kind="quiet" title="Test" loading={busy === item.packageName} disabled={!!busy} onPress={() => choose(item)} />
              </View>
            )}
            ListEmptyComponent={<T v="small" tone="t3" style={{ padding: 16 }}>No apps match.</T>}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: c.card },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: c.line },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, paddingHorizontal: 12, height: 44, borderRadius: r.m, borderWidth: 1, borderColor: c.lineStrong },
  searchInput: { flex: 1, fontFamily: f.sans, fontSize: 15, color: c.t1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
});
