import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LazyFade, Shimmer, WordReveal } from '../../components/motion';
import { Page } from '../../components/Page';
import { Button, Panel, SectionHead, T, type as tx } from '../../components/ui';
import { api, Health } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { c } from '../../lib/theme';

const HOW = [
  {
    title: 'A budget phone, emulated',
    body: 'Every test runs on a real Android 11 emulator with 2 GB of RAM and a 720p screen, the kind of phone a large share of India actually carries.',
  },
  {
    title: 'Networks India actually has',
    body: 'Rural 2G, a crowded station on 3G, congested 4G and a metro tunnel that drops the connection for twenty seconds. Each one is applied with the emulator’s own network controls and compared against a full-speed baseline.',
  },
  {
    title: 'Evidence, not guesses',
    body: 'The lab measures cold start, janky frames, memory, crashes, freezes, network errors and mobile data, then taps through the app to find failures beyond the first screen. A model trained on Android logs labels each failure, and every finding links back to the log lines behind it.',
  },
  {
    title: 'In your language',
    body: 'Sarvam AI turns the findings into a plain-language verdict, translates it into Indian languages and reads it aloud, so the person deciding whether to ship can understand it.',
  },
];

function Row({ k, v, ok }: { k: string; v: string; ok?: boolean }) {
  return (
    <View style={styles.row}>
      <T v="small" tone="t2">{k}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {ok !== undefined ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ok ? c.pos : c.t3 }} /> : null}
        <T v="mono" tone="t1">{v}</T>
      </View>
    </View>
  );
}

export default function Account() {
  const { session } = useAuth();
  const [health, setHealth] = useState<Health | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api<Health>('/health', { auth: false }).then(setHealth).catch(() => setFailed(true));
  }, []);

  return (
    <Page title="Account" subtitle={session?.user.email ?? undefined}>
      <View style={{ gap: 16 }}>
        <Panel>
          <SectionHead title="Lab status" />
          {health ? (
            <View>
              <Row k="API and database" v={health.database === 'ok' ? 'connected' : 'unavailable'} ok={health.database === 'ok'} />
              <Row k="Emulator worker" v={health.worker_online ? 'online' : 'offline'} ok={health.worker_online} />
              <Row k="Sarvam AI" v={health.sarvam ? 'configured' : 'not configured'} ok={health.sarvam} />
            </View>
          ) : failed ? (
            <T v="small" tone="t3">Could not reach the lab.</T>
          ) : (
            <View style={{ gap: 12 }}>
              <Shimmer height={14} />
              <Shimmer height={14} width="80%" />
              <Shimmer height={14} width="70%" />
            </View>
          )}
        </Panel>

        <Panel>
          <SectionHead title="How BharatSim tests your app" />
          {HOW.map((h, i) => (
            <LazyFade key={h.title} delay={i * 40} placeholderHeight={90}>
              <View style={[styles.how, i === HOW.length - 1 && { borderBottomWidth: 0 }]}>
                <T v="meta" tone="t3" style={{ width: 28 }}>{String(i + 1).padStart(2, '0')}</T>
                <View style={{ flex: 1, gap: 4 }}>
                  <T v="h3">{h.title}</T>
                  <WordReveal text={h.body} style={[tx.small, { fontSize: 14, lineHeight: 21, color: c.t2 }]} />
                </View>
              </View>
            </LazyFade>
          ))}
        </Panel>

        <Panel>
          <SectionHead title="Session" />
          <T v="small" tone="t2" style={{ marginBottom: 12 }}>Signing out removes your session from this device. Your apps and reports stay in your account.</T>
          <Button title="Sign out" kind="quiet" onPress={() => supabase.auth.signOut()} style={{ alignSelf: 'flex-start' }} />
        </Panel>

        <T v="meta" tone="t3" style={{ textAlign: 'center', marginTop: 8 }}>
          BharatSim 2.0 · Team Deccans · hackFront India 2026
        </T>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line },
  how: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line },
});
