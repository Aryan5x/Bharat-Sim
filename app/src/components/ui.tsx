import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react-native';
import { c, f, r, Verdict, verdictColor } from '../lib/theme';

// ---------------------------------------------------------------- text

type Tone = 't1' | 't2' | 't3' | 'acc' | 'white';
type Variant = 'display' | 'title' | 'h2' | 'h3' | 'body' | 'small' | 'meta' | 'mono' | 'figure';

const variantStyle: Record<Variant, TextStyle> = {
  display: { fontFamily: f.sansMedium, fontSize: 40, lineHeight: 44, letterSpacing: -0.8 },
  title: { fontFamily: f.sansMedium, fontSize: 26, lineHeight: 32, letterSpacing: -0.3 },
  h2: { fontFamily: f.sansMedium, fontSize: 17, lineHeight: 24 },
  h3: { fontFamily: f.sansMedium, fontSize: 15, lineHeight: 22 },
  body: { fontFamily: f.sans, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: f.sans, fontSize: 13, lineHeight: 19 },
  meta: { fontFamily: f.mono, fontSize: 12, lineHeight: 16 },
  mono: { fontFamily: f.mono, fontSize: 13, lineHeight: 18 },
  figure: { fontFamily: f.monoMedium, fontSize: 20, lineHeight: 26, fontVariant: ['tabular-nums'] },
};

export function T({ v = 'body', tone = 't1', style, ...rest }: TextProps & { v?: Variant; tone?: Tone }) {
  const color = tone === 'white' ? c.white : c[tone];
  return <Text {...rest} style={[variantStyle[v], { color }, style]} />;
}

export const type = variantStyle;

// ---------------------------------------------------------------- buttons

type ButtonKind = 'primary' | 'accent' | 'quiet' | 'danger';

export function Button({
  title,
  kind = 'primary',
  size = 'md',
  loading,
  disabled,
  icon,
  style,
  ...rest
}: PressableProps & { title: string; kind?: ButtonKind; size?: 'sm' | 'md'; loading?: boolean; icon?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const palette = {
    primary: { bg: c.ink, bgPressed: '#000000', fg: c.white, border: c.ink },
    accent: { bg: c.acc, bgPressed: c.accInk, fg: c.white, border: c.acc },
    quiet: { bg: c.card, bgPressed: c.raised, fg: c.t1, border: c.lineStrong },
    danger: { bg: c.card, bgPressed: c.negSoft, fg: c.neg, border: c.lineStrong },
  }[kind];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      {...rest}
      style={({ pressed }) => [
        styles.btn,
        size === 'sm' && styles.btnSm,
        { backgroundColor: pressed ? palette.bgPressed : palette.bg, borderColor: palette.border, opacity: off ? 0.5 : 1 },
        pressed && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={palette.fg} /> : icon}
      <Text style={[styles.btnText, size === 'sm' && { fontSize: 13 }, { color: palette.fg }]}>{title}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------- surfaces

export function Panel({ children, style, pad = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; pad?: boolean }) {
  return <View style={[styles.panel, pad && styles.panelPad, style]}>{children}</View>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: c.line }, style]} />;
}

export function SectionHead({ title, meta, right }: { title: string; meta?: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionHead}>
      <T v="h2">{title}</T>
      {right ?? (meta ? <T v="small" tone="t3">{meta}</T> : null)}
    </View>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'error' | 'ok'; children: React.ReactNode }) {
  const map = {
    info: { bg: c.accSoft, border: 'rgba(180,83,9,0.22)', fg: c.accInk, Icon: Info },
    error: { bg: c.negSoft, border: 'rgba(220,38,38,0.22)', fg: c.negInk, Icon: AlertCircle },
    ok: { bg: c.posSoft, border: 'rgba(22,163,74,0.22)', fg: c.posInk, Icon: CheckCircle2 },
  }[kind];
  return (
    <View style={[styles.notice, { backgroundColor: map.bg, borderColor: map.border }]} accessibilityRole="alert">
      <map.Icon size={18} color={map.fg} strokeWidth={1.75} />
      <Text style={[type.small, { color: map.fg, flex: 1 }]}>{children}</Text>
    </View>
  );
}

// ---------------------------------------------------------------- fields

export function Field({ label, hint, ...input }: TextInputProps & { label: string; hint?: string }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T v="small" tone="t2" style={{ fontFamily: f.sansMedium }}>{label}</T>
      <TextInput
        placeholderTextColor={c.t3}
        {...input}
        onFocus={(e) => {
          setFocus(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocus(false);
          input.onBlur?.(e);
        }}
        style={[styles.input, focus && styles.inputFocus, input.style]}
      />
      {hint ? <T v="small" tone="t3">{hint}</T> : null}
    </View>
  );
}

export function Segmented<K extends string>({ options, value, onChange }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={styles.seg} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.segItem, on && styles.segOn]}>
            <Text style={[type.small, { color: on ? c.t1 : c.t2, fontFamily: on ? f.sansMedium : f.sans }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------- signal bars (signature)

const filled: Record<Verdict, number> = { pass: 4, warn: 2, fail: 1, error: 1 };

export function Signal({ verdict, large }: { verdict: Verdict; large?: boolean }) {
  const n = filled[verdict];
  const color = verdict === 'pass' ? c.pos : verdict === 'warn' ? c.acc : verdict === 'fail' ? c.neg : c.t3;
  const hs = large ? [6, 11, 16, 22] : [4, 7, 10, 14];
  const w = large ? 5 : 3;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: large ? 3 : 2, height: hs[3] }} accessibilityLabel={verdictColor[verdict].label}>
      {hs.map((h, i) => (
        <View key={i} style={{ width: w, height: h, borderRadius: 1, backgroundColor: i < n ? color : c.lineStrong }} />
      ))}
    </View>
  );
}

export function VerdictLabel({ verdict }: { verdict: Verdict }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Signal verdict={verdict} />
      <Text style={[type.small, { fontFamily: f.sansMedium, color: verdictColor[verdict].ink }]}>{verdictColor[verdict].label}</Text>
    </View>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <View style={styles.tag}>
      <Text style={[type.meta, { color: c.t2, fontSize: 11 }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: r.m,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnSm: { minHeight: 34, paddingHorizontal: 12, borderRadius: 8 },
  btnText: { fontFamily: f.sansMedium, fontSize: 14 },
  panel: { backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: r.l },
  panelPad: { padding: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 },
  notice: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: r.m, borderWidth: 1, alignItems: 'flex-start' },
  input: {
    height: 46,
    paddingHorizontal: 12,
    borderRadius: r.m,
    borderWidth: 1,
    borderColor: c.lineStrong,
    backgroundColor: c.card,
    fontFamily: f.sans,
    fontSize: 15,
    color: c.t1,
  },
  inputFocus: { borderColor: c.acc },
  seg: { flexDirection: 'row', backgroundColor: c.raised, borderRadius: r.m, padding: 3, gap: 2, alignSelf: 'flex-start' },
  segItem: { height: 34, paddingHorizontal: 14, borderRadius: 8, justifyContent: 'center' },
  segOn: { backgroundColor: c.card, borderWidth: 1, borderColor: c.line },
  tag: { paddingHorizontal: 6, borderRadius: 4, backgroundColor: c.raised, alignSelf: 'flex-start' },
});
