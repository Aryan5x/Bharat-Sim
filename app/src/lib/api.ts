import { Platform } from 'react-native';
import { supabase } from './supabase';
import type { Verdict } from './theme';

// Web is served from the same origin as the API. The phone app calls the live deployment.
const API_BASE = Platform.OS === 'web' ? (process.env.EXPO_PUBLIC_API_BASE ?? '') : (process.env.EXPO_PUBLIC_API_BASE ?? 'https://bharat-sim.vercel.app');

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function token(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.auth !== false) {
    const t = await token();
    if (!t) throw new ApiError(401, 'Sign in first');
    headers.Authorization = `Bearer ${t}`;
  }
  let resp: Response;
  try {
    resp = await fetch(`${API_BASE}/api${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, 'Could not reach BharatSim. Check your connection and try again');
  }
  const text = await resp.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!resp.ok) {
    let message = 'Something went wrong. Try again';
    if (data?.detail) {
      message = Array.isArray(data.detail) ? data.detail.map((d: any) => d.msg?.replace(/^Value error, /, '')).join('. ') : String(data.detail);
    }
    if (resp.status === 401) await supabase.auth.signOut().catch(() => undefined);
    throw new ApiError(resp.status, message);
  }
  return data as T;
}

// ---------- types ----------
export type TestProfile = { key: string; name: string; summary: string; sort_order: number; params: Record<string, unknown>; source: string };
export type AppRow = { id: string; label: string; package_name: string | null; version_name: string | null; size_bytes: number; source: 'upload' | 'device' | 'sample'; created_at: string; storage_path: string };
export type DeviceProfile = {
  id: string; label: string; manufacturer: string | null; model: string | null; android_version: string | null; sdk_int: number | null;
  total_ram_mb: number | null; screen_width: number | null; screen_height: number | null; network_type: string | null;
  measured_down_kbps: number | null; measured_rtt_ms: number | null; created_at: string;
};
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type Finding = { category: string; confidence: number; message: string; fix?: string; evidence?: string[]; source?: string };
export type Metrics = {
  installed?: boolean; launched?: boolean; cold_start_ms_median?: number | null; cold_start_ms_runs?: number[];
  jank_percent?: number | null; total_frames?: number | null; crashes?: number; anrs?: number; network_errors?: number;
  memory_pss_mb?: number | null; data_used_kb?: number | null; offline_behavior?: string | null; recovery_seconds?: number | null;
  monkey_events?: number | null; conditions_applied?: Record<string, unknown>; anomalies?: string[];
};
export type RunResult = { id: string; profile_key: string; verdict: Verdict; metrics: Metrics; findings: Finding[]; logcat_excerpt: string | null };
export type Explanation = { verdict: string; issues: { issue: string; fix: string }[]; generated_by?: string };
export type Run = {
  id: string; app_id: string; device_profile_id: string | null; profiles: string[]; status: RunStatus; stage: string | null;
  started_at: string | null; finished_at: string | null; error: string | null; readiness_score: number | null;
  summary: Record<string, any> | null; created_at: string;
  apps: { label: string; package_name: string | null; version_name: string | null; source: string } | null;
};
export type RunDetail = Run & {
  results: RunResult[];
  translations: { language: string; content: Explanation; audio_path: string | null }[];
  device_profiles: DeviceProfile | null;
};
export type Health = { status: string; database: string; worker_online: boolean; sarvam: boolean };
