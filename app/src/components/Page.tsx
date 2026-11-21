import React from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { c } from '../lib/theme';
import { ScrollScreen } from './motion';
import { useWide } from './Shell';
import { T } from './ui';

export function Page({
  title,
  subtitle,
  right,
  above,
  children,
  refreshing,
  onRefresh,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  above?: React.ReactNode;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const wide = useWide();
  return (
    <ScrollScreen
      style={{ flex: 1, backgroundColor: c.page }}
      contentContainerStyle={[styles.content, wide ? styles.wide : styles.narrow]}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.acc} colors={[c.acc]} /> : undefined}
    >
      {above}
      <View style={[styles.head, !wide && { flexDirection: 'column', alignItems: 'flex-start' }]}>
        <View style={{ flex: wide ? 1 : undefined, gap: 4 }}>
          <T v="title" accessibilityRole="header">{title}</T>
          {subtitle ? <T tone="t2" style={{ maxWidth: 640 }}>{subtitle}</T> : null}
        </View>
        {right}
      </View>
      {children}
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 1120, alignSelf: 'center' },
  wide: { paddingHorizontal: 40, paddingTop: 32, paddingBottom: 64 },
  narrow: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 },
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24 },
});
