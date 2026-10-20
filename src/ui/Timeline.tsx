import { StyleSheet, Text, View } from 'react-native';

import { buildTimeline, type TimelineState } from '../domain/status';
import { formatLocalTime } from '../domain/time';
import type { Flight } from '../domain/types';
import { useTheme } from './theme';

const STATE_TEXT: Record<TimelineState, string> = {
  done: 'completed',
  current: 'current',
  upcoming: 'upcoming',
  skipped: 'will not happen',
};

export function Timeline({ flight, now }: { flight: Flight; now: number }) {
  const t = useTheme();
  const events = buildTimeline(flight, now);
  return (
    <View>
      {events.map((e, i) => {
        const zone = e.zone === 'departure' ? flight.departure.airport.timeZone : flight.arrival.airport.timeZone;
        const timeText = e.time ? `${formatLocalTime(e.time.time, zone)} (${e.time.kind})` : null;
        const dotColor =
          e.state === 'done' ? t.colors.success : e.state === 'current' ? t.colors.accent : e.state === 'skipped' ? t.colors.danger : t.colors.border;
        return (
          <View
            key={e.key}
            style={styles.row}
            accessible
            accessibilityLabel={`${e.title}, ${STATE_TEXT[e.state]}${timeText ? `, ${timeText}` : ''}${e.detail ? `, ${e.detail}` : ''}`}
          >
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: dotColor, borderColor: dotColor }]} />
              {i < events.length - 1 ? <View style={[styles.line, { backgroundColor: t.colors.border }]} /> : null}
            </View>
            <View style={styles.body}>
              <Text
                style={[
                  styles.title,
                  { color: e.state === 'upcoming' || e.state === 'skipped' ? t.colors.textMuted : t.colors.text },
                  e.state === 'skipped' && styles.skipped,
                ]}
              >
                {e.title}
              </Text>
              {timeText ? <Text style={{ color: t.colors.textMuted }}>{timeText}</Text> : null}
              {e.detail ? <Text style={{ color: t.colors.textMuted }}>{e.detail}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', minHeight: 56 },
  rail: { width: 24, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginTop: 3 },
  line: { width: 2, flex: 1, marginVertical: 2 },
  body: { flex: 1, paddingBottom: 12, paddingLeft: 8 },
  title: { fontSize: 16, fontWeight: '600' },
  skipped: { textDecorationLine: 'line-through' },
});
