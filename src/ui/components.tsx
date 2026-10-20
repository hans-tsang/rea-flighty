import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

import { bestTime, deriveStatus, type TimeKind } from '../domain/status';
import { dayOffset, formatLocalDate, formatLocalTime } from '../domain/time';
import { formatDesignator, type Flight, type TimeTriple } from '../domain/types';
import { statusColor, useTheme } from './theme';

export function MockBanner() {
  const t = useTheme();
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="Simulated data. Flight information in this build is mock data, not real airline information."
      style={[styles.banner, { backgroundColor: t.colors.mockBanner }]}
    >
      <Text style={[styles.bannerText, { color: t.colors.mockBannerText }]}>
        SIMULATED DATA — not real flight information
      </Text>
    </View>
  );
}

export function StatusBadge({ flight, now }: { flight: Flight; now: number }) {
  const t = useTheme();
  const s = deriveStatus(flight, now);
  const color = statusColor(t, s.status);
  return (
    <View
      style={[styles.badge, { borderColor: color }]}
      accessibilityLabel={`Status: ${s.label}`}
      accessibilityRole="text"
    >
      <Text style={[styles.badgeText, { color }]}>{s.label}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.colors.card, borderColor: t.colors.border }, style]}>
      {children}
    </View>
  );
}

export function FlightCard({ flight, now, onPress }: { flight: Flight; now: number; onPress: () => void }) {
  const t = useTheme();
  const dep = flight.departure;
  const arr = flight.arrival;
  const depBest = bestTime(dep.times);
  const arrBest = bestTime(arr.times);
  const offset = dayOffset(depBest.time, dep.airport.timeZone, arrBest.time, arr.airport.timeZone);
  const title = `${formatDesignator(flight.designator)}, ${dep.airport.city} to ${arr.airport.city}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${formatLocalDate(dep.times.scheduled, dep.airport.timeZone)}. ${deriveStatus(flight, now).label}`}
      accessibilityHint="Opens flight details"
      style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
    >
      <Card>
        <View style={styles.row}>
          <Text style={[styles.designator, { color: t.colors.text }]}>{formatDesignator(flight.designator)}</Text>
          <StatusBadge flight={flight} now={now} />
        </View>
        <Text style={[styles.muted, { color: t.colors.textMuted }]}>
          {formatLocalDate(dep.times.scheduled, dep.airport.timeZone)} · {flight.carrierName}
        </Text>
        <View style={[styles.row, { marginTop: 12 }]}>
          <View>
            <Text style={[styles.code, { color: t.colors.text }]}>{dep.airport.iata}</Text>
            <Text style={[styles.time, { color: t.colors.text }]}>
              {formatLocalTime(depBest.time, dep.airport.timeZone)}
            </Text>
          </View>
          <Text style={[styles.arrow, { color: t.colors.textMuted }]} importantForAccessibility="no">
            →
          </Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.code, { color: t.colors.text }]}>{arr.airport.iata}</Text>
            <Text style={[styles.time, { color: t.colors.text }]}>
              {formatLocalTime(arrBest.time, arr.airport.timeZone)}
              {offset !== 0 ? <Text style={styles.dayOffset}>{` ${offset > 0 ? '+' : ''}${offset}d`}</Text> : null}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

const KIND_LABEL: Record<TimeKind, string> = {
  actual: 'Actual',
  estimated: 'Estimated',
  scheduled: 'Scheduled',
};

/** Shows scheduled / estimated / actual for one event, marking unknowns explicitly. */
export function TimeTable({ times, timeZone }: { times: TimeTriple; timeZone: string }) {
  const t = useTheme();
  const rows: { kind: TimeKind; value: string | null }[] = [
    { kind: 'scheduled', value: times.scheduled },
    { kind: 'estimated', value: times.estimated },
    { kind: 'actual', value: times.actual },
  ];
  return (
    <View>
      {rows.map(({ kind, value }) => (
        <View
          key={kind}
          style={styles.timeRow}
          accessible
          accessibilityLabel={`${KIND_LABEL[kind]}: ${value ? formatLocalTime(value, timeZone) : 'not yet known'}`}
        >
          <Text style={{ color: t.colors.textMuted }}>{KIND_LABEL[kind]}</Text>
          <Text style={{ color: value ? t.colors.text : t.colors.textMuted, fontWeight: kind === 'actual' ? '700' : '500' }}>
            {value ? formatLocalTime(value, timeZone) : '—'}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function LabeledValue({ label, value, unknownText = 'Not yet known' }: { label: string; value: string | null; unknownText?: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }} accessible accessibilityLabel={`${label}: ${value ?? unknownText}`}>
      <Text style={[styles.label, { color: t.colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: value ? t.colors.text : t.colors.textMuted, fontStyle: value ? 'normal' : 'italic' }]}>
        {value ?? unknownText}
      </Text>
    </View>
  );
}

export function LoadingState({ label }: { label: string }) {
  const t = useTheme();
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator color={t.colors.accent} accessibilityLabel={label} />
      <Text style={{ color: t.colors.textMuted, marginTop: 8 }}>{label}</Text>
    </View>
  );
}

export function MessageState({
  title,
  body,
  actionLabel,
  onAction,
  tone = 'neutral',
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'neutral' | 'error';
}) {
  const t = useTheme();
  return (
    <View style={styles.center} accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}>
      <Text style={[styles.messageTitle, { color: tone === 'error' ? t.colors.danger : t.colors.text }]}>{title}</Text>
      {body ? <Text style={[styles.messageBody, { color: t.colors.textMuted }]}>{body}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  accessibilityHint?: string;
}) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.colors.accent : 'transparent';
  const fg = variant === 'primary' ? t.colors.accentText : variant === 'danger' ? t.colors.danger : t.colors.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: variant === 'primary' ? bg : fg, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center' },
  bannerText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  badge: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  designator: { fontSize: 18, fontWeight: '700' },
  muted: { fontSize: 14, marginTop: 2 },
  code: { fontSize: 26, fontWeight: '800' },
  time: { fontSize: 16, fontVariant: ['tabular-nums'] },
  dayOffset: { fontSize: 12, fontWeight: '700' },
  arrow: { fontSize: 20 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  label: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 17, fontWeight: '600', marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  messageTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  messageBody: { fontSize: 15, textAlign: 'center', marginTop: 8, marginBottom: 16, lineHeight: 21 },
  button: { borderRadius: 10, borderWidth: 1.5, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', minHeight: 44 },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
