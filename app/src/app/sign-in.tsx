import { Redirect } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Enter, LazyFade, ScrollScreen, WordReveal } from '../components/motion';
import { useWide, Wordmark } from '../components/Shell';
import { Button, Field, Notice, Segmented, Signal, T, type as tx } from '../components/ui';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { c, f, Verdict } from '../lib/theme';

const LADDER: { label: string; value: string; verdict: Verdict }[] = [
  { label: 'Baseline, full network', value: 'reference', verdict: 'pass' },
  { label: 'Congested 4G', value: '1 Mbps · 150–400 ms', verdict: 'pass' },
  { label: 'Crowded station 3G', value: 'UMTS preset', verdict: 'warn' },
  { label: 'Rural 2G', value: 'EDGE preset', verdict: 'warn' },
  { label: 'Metro tunnel', value: '20 s drop, then back', verdict: 'fail' },
];

export default function SignIn() {
  const { session } = useAuth();
  const wide = useWide();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (session) return <Redirect href="/test" />;

  const submit = async () => {
    setError(null);
    setInfo(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return setError('Enter a valid email address');
    if (password.length < 8) return setError('Use a password with at least 8 characters');
    setBusy(true);
    try {
      if (mode === 'in') {
        const { error: e } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (e) setError(e.message === 'Invalid login credentials' ? 'That email and password do not match' : e.message);
      } else {
        const { data, error: e } = await supabase.auth.signUp({ email: cleanEmail, password });
        if (e) setError(e.message);
        else if (!data.session) setInfo('Check your inbox to confirm your email, then sign in');
      }
    } catch {
      setError('Could not reach the sign-in service. Check your connection');
    } finally {
      setBusy(false);
    }
  };

  const story = (
    <View style={[styles.story, wide ? styles.storyWide : { paddingTop: insets.top + 20 }]}>
      <Wordmark />
      <View style={{ marginTop: wide ? 0 : 32, gap: 16 }}>
        <T v="meta" tone="t3">Problem statement T1.2 · the cheap phone test</T>
        <WordReveal
          text="See how your Android app behaves on the phones and networks most of India actually uses"
          style={[tx.display, { color: c.t1, fontSize: wide ? 44 : 32, lineHeight: wide ? 50 : 38, maxWidth: 560 }]}
        />
        <WordReveal
          text="Upload an APK. We run it on a real Android emulator set up like a budget phone, on 2G, 3G, congested and dropping networks, then compare every run against a normal baseline. You get crashes, freezes, slow starts and network failures, explained in plain words and in your language."
          style={[tx.body, { color: c.t2, fontSize: 17, lineHeight: 26, maxWidth: 520 }]}
        />
      </View>
      <LazyFade style={{ marginTop: 36 }} placeholderHeight={250}>
        <View style={styles.ladder}>
          <View style={styles.ladderHead}>
            <T v="meta" tone="t3">Sample report · condition</T>
            <T v="meta" tone="t3">result</T>
          </View>
          {LADDER.map((row) => (
            <View key={row.label} style={styles.ladderRow}>
              <View style={{ flex: 1 }}>
                <T v="small" style={{ fontSize: 14, color: c.t1 }}>{row.label}</T>
                <T v="meta" tone="t3">{row.value}</T>
              </View>
              <Signal verdict={row.verdict} />
            </View>
          ))}
          <T v="meta" tone="t3" style={{ marginTop: 10 }}>Illustration of the report layout, not real results</T>
        </View>
      </LazyFade>
    </View>
  );

  const form = (
    <Enter style={[styles.form, wide && styles.formWide]}>
      <View style={{ width: '100%', maxWidth: 380, gap: 16 }}>
        <T v="title" style={{ fontSize: 22, lineHeight: 28 }}>{mode === 'in' ? 'Sign in to your lab' : 'Create your lab account'}</T>
        <Segmented
          options={[{ key: 'in', label: 'Sign in' }, { key: 'up', label: 'Create account' }]}
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
            setInfo(null);
          }}
        />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" inputMode="email" placeholder="you@company.in" />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          placeholder="At least 8 characters"
          onSubmitEditing={submit}
          returnKeyType="go"
        />
        {error ? <Notice kind="error">{error}</Notice> : null}
        {info ? <Notice kind="ok">{info}</Notice> : null}
        <Button title={mode === 'in' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} />
        <T v="small" tone="t3">Your apps and reports are private to your account.</T>
      </View>
    </Enter>
  );

  if (wide) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: c.page }}>
        <ScrollScreen style={{ flex: 1.15, backgroundColor: c.card, borderRightWidth: 1, borderRightColor: c.line }} contentContainerStyle={{ flexGrow: 1 }}>
          {story}
        </ScrollScreen>
        <View style={{ flex: 1 }}>{form}</View>
      </View>
    );
  }
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.page }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollScreen style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {story}
        {form}
      </ScrollScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  story: { backgroundColor: c.card, paddingHorizontal: 20, paddingBottom: 28, borderBottomWidth: 1, borderBottomColor: c.line },
  storyWide: { flex: 1, paddingHorizontal: 56, paddingVertical: 48, justifyContent: 'space-between', borderBottomWidth: 0 },
  ladder: { borderTopWidth: 1, borderTopColor: c.line, maxWidth: 520 },
  ladderHead: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line },
  ladderRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.line },
  form: { paddingHorizontal: 20, paddingTop: 28, alignItems: 'stretch' },
  formWide: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 56 },
});

