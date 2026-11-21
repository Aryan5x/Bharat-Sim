/**
 * Motion pieces, written for Reanimated so they run on the UI thread on Android
 * and also on the web.
 *
 * - ScrollScreen / useScrollProgress: one shared scroll position per screen.
 * - WordReveal: words brighten one by one as the block scrolls through the
 *   viewport (in the spirit of motion.dev's "text scroll word reveal").
 * - Shimmer: skeleton placeholder with a travelling highlight (in the spirit of
 *   motion.dev's "skeleton shimmer").
 * - LazyFade: mounts children only once they scroll near the viewport, then
 *   fades and lifts them in (in the spirit of React Bits' lazy/animated content).
 */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  LayoutChangeEvent,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  interpolate,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { c } from '../lib/theme';

type ScrollCtx = { scrollY: SharedValue<number>; viewport: number } | null;
const ScrollContext = createContext<ScrollCtx>(null);

export function ScrollScreen({ children, contentContainerStyle, ...rest }: ScrollViewProps & { children: React.ReactNode }) {
  const scrollY = useSharedValue(0);
  const { height } = useWindowDimensions();
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const value = useMemo(() => ({ scrollY, viewport: height }), [scrollY, height]);
  return (
    <ScrollContext.Provider value={value}>
      <Animated.ScrollView
        {...rest}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={contentContainerStyle}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </Animated.ScrollView>
    </ScrollContext.Provider>
  );
}

const ease = Easing.bezier(0.22, 1, 0.36, 1);

/** Track an element's offset inside the nearest ScrollScreen's content.
 * measureInWindow gives the on-screen y; adding the current scroll offset turns
 * it into a content offset regardless of how deeply the element is nested. */
function useOffset(ctx: ScrollCtx) {
  const ref = useRef<any>(null);
  const top = useSharedValue(-1);
  const height = useSharedValue(0);
  const onLayout = (e: LayoutChangeEvent) => {
    height.value = e.nativeEvent.layout.height;
    const node = ref.current;
    if (!node?.measureInWindow) {
      top.value = e.nativeEvent.layout.y;
      return;
    }
    requestAnimationFrame(() =>
      node.measureInWindow((_x: number, y: number) => {
        top.value = y + (ctx ? ctx.scrollY.value : 0);
      }),
    );
  };
  return { ref, top, height, onLayout };
}

// ---------------------------------------------------------------- WordReveal

function Word({ word, index, count, progress, style }: { word: string; index: number; count: number; progress: SharedValue<number>; style: StyleProp<TextStyle> }) {
  const start = index / count;
  const end = Math.min(1, start + 1.5 / count);
  const animated = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [start, end], [0.16, 1], 'clamp'),
  }));
  return <Animated.Text style={[style, animated]}>{word + ' '}</Animated.Text>;
}

export function WordReveal({ text, style, offset = 0 }: { text: string; style?: StyleProp<TextStyle>; offset?: number }) {
  const ctx = useContext(ScrollContext);
  const reduced = useReducedMotion();
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const { ref, top, height, onLayout } = useOffset(ctx);
  const progress = useSharedValue(ctx ? 0 : 1);

  useAnimatedReaction(
    () => {
      if (!ctx || top.value < 0) return 1;
      // Starts when the block's top enters at 90% of the viewport, completes when
      // its bottom reaches 65%, so text already on screen at load reads in full.
      const startAt = top.value + offset - ctx.viewport * 0.9;
      const span = Math.max(1, height.value + ctx.viewport * 0.25);
      return Math.max(0, Math.min(1, (ctx.scrollY.value - startAt) / span));
    },
    (p) => {
      progress.value = p;
    },
    [ctx, offset],
  );

  if (reduced || !ctx) return <Text style={style}>{text}</Text>;
  return (
    <Text ref={ref} style={style} onLayout={onLayout} accessibilityLabel={text}>
      {words.map((w, i) => (
        <Word key={`${i}-${w}`} word={w} index={i} count={words.length} progress={progress} style={style} />
      ))}
    </Text>
  );
}

// ---------------------------------------------------------------- Shimmer

export function Shimmer({ width = '100%', height = 14, radius = 6, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [reduced, t]);
  const sweep = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(t.value, [0, 1], [-w * 0.6, w * 1.1]) }],
  }));
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[{ width, height, borderRadius: radius, backgroundColor: c.raised, overflow: 'hidden' }, style]}
      accessibilityLabel="Loading"
    >
      {!reduced && w > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, { width: w * 0.5 }, sweep]}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#ffffff" stopOpacity="0" />
                <Stop offset="0.5" stopColor="#ffffff" stopOpacity="0.65" />
                <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#shine)" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

/** A list-shaped skeleton: rows of title + meta lines. */
export function ShimmerRows({ rows = 3, gap = 18 }: { rows?: number; gap?: number }) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={{ gap: 8 }}>
          <Shimmer width={i % 2 ? '52%' : '68%'} height={14} />
          <Shimmer width={i % 2 ? '30%' : '40%'} height={10} />
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------- LazyFade

export function LazyFade({ children, delay = 0, style, placeholderHeight = 120 }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle>; placeholderHeight?: number }) {
  const ctx = useContext(ScrollContext);
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(!ctx || reduced);
  const { ref, top, onLayout } = useOffset(ctx);
  const shown = useSharedValue(visible ? 1 : 0);

  useAnimatedReaction(
    () => {
      if (!ctx || top.value < 0) return false;
      return ctx.scrollY.value + ctx.viewport * 1.15 > top.value;
    },
    (inView, prev) => {
      if (inView && !prev) scheduleOnRN(setVisible, true);
    },
    [ctx],
  );

  useEffect(() => {
    if (visible) shown.value = withDelay(delay, withTiming(1, { duration: 420, easing: ease }));
  }, [visible, delay, shown]);

  const anim = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: interpolate(shown.value, [0, 1], [10, 0]) }],
  }));

  return (
    <View ref={ref} style={style} onLayout={onLayout}>
      {visible ? <Animated.View style={anim}>{children}</Animated.View> : <View style={{ height: placeholderHeight }} />}
    </View>
  );
}

/** One-shot entrance for a screen's main content. */
export function Enter({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withTiming(1, { duration: 360, easing: ease }));
  }, [delay, v]);
  const anim = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: interpolate(v.value, [0, 1], [8, 0]) }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** Live dot for things that are actually live (a running test). */
export function LiveDot({ color = c.acc, size = 8 }: { color?: string; size?: number }) {
  const v = useSharedValue(1);
  useEffect(() => {
    v.value = withRepeat(withTiming(0.35, { duration: 700 }), -1, true);
  }, [v]);
  const anim = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, anim]} />;
}

