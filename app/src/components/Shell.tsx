import { Link, usePathname } from 'expo-router';
import { FlaskConical, History, LogOut, Smartphone, UserRound } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, Health } from '../lib/api';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { c, f } from '../lib/theme';
import { type as tx } from './ui';

const NAV = [
  { href: '/test', label: 'New test', short: 'Test', Icon: FlaskConical },
  { href: '/runs', label: 'Runs', short: 'Runs', Icon: History },
  { href: '/phone', label: 'My phone', short: 'Phone', Icon: Smartphone },
  { href: '/account', label: 'Account', short: 'Account', Icon: UserRound },
] as const;

export function useWide() {
  const { width } = useWindowDimensions();
  return width >= 900;
}

function useLabStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => api<Health>('/health', { auth: false }).then((h) => alive && setHealth(h)).catch(() => alive && setHealth(null));
    load();
    const id = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return health;
}

export function Wordmark({ size = 17 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 16 }}>
        {[5, 8, 12, 16].map((h, i) => (
          <View key={i} style={{ width: 3, height: h, borderRadius: 1, backgroundColor: i === 3 ? c.acc : c.ink }} />
        ))}
      </View>
      <Text style={{ fontFamily: f.sansSemi, fontSize: size, color: c.t1, letterSpacing: -0.2 }}>
        Bharat<Text style={{ color: c.acc }}>Sim</Text>
      </Text>
    </View>
  );
}

function LabStatus({ health }: { health: Health | null }) {
  const online = !!health?.worker_online;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} accessibilityLabel={online ? 'Test lab online' : 'Test lab offline'}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: online ? c.pos : c.t3 }} />
      <Text style={[tx.small, { color: c.t2 }]}>{health === null ? 'Checking lab' : online ? 'Test lab online' : 'Test lab offline'}</Text>
    </View>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const wide = useWide();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const health = useLabStatus();
  const active = (href: string) => path === href || path.startsWith(href + '/') || (href === '/runs' && path.startsWith('/run/'));

  if (wide) {
    return (
      <View style={styles.wideRoot}>
        <View style={styles.rail}>
          <View style={{ paddingHorizontal: 8 }}>
            <Wordmark />
          </View>
          <View style={{ gap: 2 }}>
            {NAV.map(({ href, label, Icon }) => {
              const on = active(href);
              return (
                <Link key={href} href={href} asChild>
                  <Pressable style={({ hovered, pressed }: any) => [styles.navItem, (on || hovered || pressed) && styles.navHover, on && styles.navOn]}>
                    <Icon size={18} strokeWidth={1.5} color={on ? c.t1 : c.t3} />
                    <Text style={[tx.small, { fontSize: 14, color: on ? c.t1 : c.t2, fontFamily: on ? f.sansMedium : f.sans }]}>{label}</Text>
                  </Pressable>
                </Link>
              );
            })}
          </View>
          <View style={styles.railFoot}>
            <LabStatus health={health} />
            <Text numberOfLines={1} style={[tx.small, { color: c.t3, marginTop: 12 }]}>{session?.user.email}</Text>
            <Pressable onPress={() => supabase.auth.signOut()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }} accessibilityRole="button">
              <LogOut size={14} strokeWidth={1.5} color={c.t3} />
              <Text style={[tx.small, { color: c.t3 }]}>Sign out</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      <View style={[styles.mobileTop, { paddingTop: insets.top + 10 }]}>
        <Wordmark size={16} />
        <LabStatus health={health} />
      </View>
      <View style={{ flex: 1 }}>{children}</View>
      <View style={[styles.tabbar, { paddingBottom: insets.bottom, height: 60 + insets.bottom }]} accessibilityRole="tablist">
        {NAV.map(({ href, short, Icon }) => {
          const on = active(href);
          return (
            <Link key={href} href={href} asChild>
              <Pressable style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={short}>
                <Icon size={21} strokeWidth={1.5} color={on ? c.acc : c.t3} />
                <Text style={{ fontFamily: on ? f.sansMedium : f.sans, fontSize: 11, color: on ? c.t1 : c.t3 }}>{short}</Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wideRoot: { flex: 1, flexDirection: 'row', backgroundColor: c.page, minHeight: '100%' as any },
  rail: { width: 248, backgroundColor: c.card, borderRightWidth: 1, borderRightColor: c.line, paddingVertical: 20, paddingHorizontal: 12, gap: 28 },
  navItem: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 36, paddingHorizontal: 10, borderRadius: 8 },
  navHover: { backgroundColor: c.raised },
  navOn: { borderWidth: 1, borderColor: c.line },
  railFoot: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12, paddingHorizontal: 10 },
  mobileTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.line },
  tabbar: { flexDirection: 'row', backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.line },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 6 },
});
