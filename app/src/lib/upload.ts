import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';
import { api, AppRow } from './api';
import { supabase } from './supabase';

export const MAX_APK_BYTES = 50 * 1024 * 1024;

export type PickedApk = { name: string; size: number; read: () => Promise<ArrayBuffer | Blob> };

export async function pickApk(): Promise<PickedApk | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: Platform.OS === 'web' ? ['.apk', 'application/vnd.android.package-archive'] : ['application/vnd.android.package-archive', 'application/octet-stream'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  const webFile = (asset as any).file as globalThis.File | undefined;
  return {
    name: asset.name,
    size: asset.size ?? webFile?.size ?? 0,
    read: async () => {
      if (webFile) return webFile;
      const bytes = await new File(asset.uri).bytes();
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    },
  };
}

function safeName(name: string) {
  const base = name.replace(/\.apk$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'app';
  return `${base}-${Date.now().toString(36)}.apk`;
}

export async function uploadApk(
  picked: { name: string; size: number; read: () => Promise<ArrayBuffer | Blob> },
  source: 'upload' | 'device' = 'upload',
  meta: { label?: string; package_name?: string | null; version_name?: string | null } = {},
): Promise<AppRow> {
  if (!/\.apk$/i.test(picked.name)) throw new Error('Choose an .apk file');
  if (picked.size <= 0) throw new Error('That file is empty');
  if (picked.size > MAX_APK_BYTES) throw new Error('APKs up to 50 MB are supported');
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error('Sign in first');
  const path = `${uid}/${safeName(picked.name)}`;
  const body = await picked.read();
  const { error } = await supabase.storage.from('apks').upload(path, body, {
    contentType: 'application/vnd.android.package-archive',
    upsert: false,
  });
  if (error) throw new Error(error.message.includes('exceeded') ? 'APKs up to 50 MB are supported' : 'Upload failed. Check your connection and try again');
  return api<AppRow>('/apps', {
    method: 'POST',
    body: {
      label: (meta.label ?? picked.name.replace(/\.apk$/i, '')).slice(0, 120),
      storage_path: path,
      source,
      package_name: meta.package_name ?? null,
      version_name: meta.version_name ?? null,
    },
  });
}
