import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { ChevronRight, LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

export const GRAD = ['#0B2F5B', '#0F6E7A'];

export function Gradient({ colors = GRAD, style, children }: { colors?: string[]; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  return (
    <View style={[{ overflow: 'hidden', width: '100%' }, style]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors[0]} />
              <Stop offset="1" stopColor={colors[1]} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#g)" />
        </Svg>
      </View>
      {children}
    </View>
  );
}

type Tone = 'primary' | 'ok' | 'warn' | 'bad' | 'info';
const toneColors = (t: ReturnType<typeof useTheme>['t'], tone: Tone) =>
  ({ primary: [t.primary, t.tint], ok: [t.ok, t.okBg], warn: [t.warn, t.warnBg], bad: [t.bad, t.badBg], info: [t.info, t.infoBg] }[tone]);

export function IconBadge({ Icon, tone = 'primary', size = 40 }: { Icon: LucideIcon; tone?: Tone; size?: number }) {
  const { t } = useTheme();
  const [fg, bg] = toneColors(t, tone);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2.6, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={size * 0.48} color={fg} strokeWidth={2.2} />
    </View>
  );
}

export function Pill({ text, tone = 'primary' }: { text: string; tone?: Tone }) {
  const { t } = useTheme();
  const [fg, bg] = toneColors(t, tone);
  return (
    <View style={{ backgroundColor: bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: fg, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>{text.replace(/_/g, ' ')}</Text>
    </View>
  );
}

export const toneFor = (s: string): Tone =>
  /high|critical|reject|overdue|expired/i.test(s) ? 'bad' : /medium|pending|open|assigned|due/i.test(s) ? 'warn'
  : /verified|approved|complete|active|low|done/i.test(s) ? 'ok' : /progress|scheduled/i.test(s) ? 'info' : 'primary';

export function Surface({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { t } = useTheme();
  const s = [{ backgroundColor: t.card, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: t.line }, style];
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => [...s, pressed && { opacity: 0.85 }]}>{children}</Pressable> : <View style={s}>{children}</View>;
}

export function PortalHero({ eyebrow, title, subtitle, Icon }: { eyebrow: string; title: string; subtitle: string; Icon: LucideIcon }) {
  const { t } = useTheme();
  return (
    <Surface style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={{ color: t.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.1 }}>{eyebrow}</Text>
        <Text numberOfLines={1} style={{ color: t.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.35 }}>{title}</Text>
        <Text numberOfLines={2} style={{ color: t.sub, fontSize: 12, lineHeight: 17 }}>{subtitle}</Text>
      </View>
      <IconBadge Icon={Icon} size={46} />
    </Surface>
  );
}

export function Stat({ Icon, value, label, tone = 'primary' }: { Icon: LucideIcon; value: number | string; label: string; tone?: Tone }) {
  const { t } = useTheme();
  return (
    <Surface style={{ flex: 1, alignItems: 'center', paddingHorizontal: 6 }}>
      <IconBadge Icon={Icon} tone={tone} size={38} />
      <Text style={{ color: t.text, fontSize: 20, fontWeight: '800', marginTop: 8 }}>{value}</Text>
      <Text numberOfLines={1} style={{ color: t.sub, fontSize: 11, fontWeight: '600', marginTop: 2 }}>{label}</Text>
    </Surface>
  );
}

export function Section({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }}>
      <Text style={{ color: t.text, fontSize: 17, fontWeight: '800' }}>{title}</Text>
      {action ? <Pressable onPress={onAction}><Text style={{ color: t.primary, fontSize: 13, fontWeight: '700' }}>{action} →</Text></Pressable> : null}
    </View>
  );
}

export function ActionTile({ Icon, label, onPress, badge }: { Icon: LucideIcon; label: string; onPress: () => void; badge?: number }) {
  const { t } = useTheme();
  return (
    <Surface onPress={onPress} style={{ width: '48%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
      <IconBadge Icon={Icon} size={36} />
      <Text numberOfLines={2} style={{ flex: 1, color: t.text, fontSize: 13, fontWeight: '700' }}>{label}</Text>
      {badge ? <Pill text={String(badge)} tone="warn" /> : null}
    </Surface>
  );
}

export function CircularActionTile({ Icon, label, onPress }: { Icon: LucideIcon; label: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [{
        width: '48%',
        minHeight: 122,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 9,
        padding: 14,
        backgroundColor: t.card,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: t.line,
      }, pressed && { opacity: 0.82 }]}
    >
      <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: t.tint, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={27} color={t.primary} strokeWidth={2.2} />
      </View>
      <Text style={{ color: t.text, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
    </Pressable>
  );
}

export const Grid = ({ children }: { children: React.ReactNode }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }}>{children}</View>
);

export function Row({ Icon, title, sub, right, onPress, last }: { Icon?: LucideIcon; title: string; sub?: string; right?: React.ReactNode; onPress?: () => void; last?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line }}>
      {Icon ? <IconBadge Icon={Icon} size={38} /> : null}
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: t.text, fontSize: 14, fontWeight: '700' }}>{title}</Text>
        {sub ? <Text numberOfLines={1} style={{ color: t.sub, fontSize: 12, marginTop: 2 }}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={18} color={t.sub} /> : null)}
    </Pressable>
  );
}

export function State({ loading, error, empty, onRetry }: { loading?: boolean; error?: boolean; empty?: string; onRetry?: () => void }) {
  const { t } = useTheme();
  if (loading) return <View style={{ padding: 28 }}><ActivityIndicator color={t.primary} /></View>;
  if (error) return <Surface onPress={onRetry}><Text style={{ color: t.bad, fontWeight: '700' }}>Could not load. Tap to retry.</Text></Surface>;
  return empty ? <Text style={{ color: t.sub, textAlign: 'center', padding: 18 }}>{empty}</Text> : null;
}
