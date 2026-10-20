import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FlightDataError } from '../../data/provider';
import { flightProgress } from '../../domain/status';
import { formatAge, formatDuration, formatLocalDate, formatUtcOffset, minutesBetween } from '../../domain/time';
import { formatDesignator, type FlightEndpoint } from '../../domain/types';
import { useFlights, useNow } from '../../state/FlightsContext';
import { Button, Card, LabeledValue, MessageState, MockBanner, StatusBadge, TimeTable } from '../../ui/components';
import { RouteMap } from '../../ui/RouteMap';
import { Timeline } from '../../ui/Timeline';
import { useTheme } from '../../ui/theme';

export default function FlightDetailScreen() {
  const t = useTheme();
  const now = useNow(15_000);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { flights, loading, refreshFlight, removeFlight } = useFlights();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const saved = flights.find((f) => f.flight.id === id);
  if (!saved) {
    return loading ? null : (
      <MessageState title="Flight not found" body="It may have been removed." actionLabel="Back to my flights" onAction={() => router.replace('/')} />
    );
  }
  const flight = saved.flight;
  const dep = flight.departure;
  const arr = flight.arrival;

  async function refresh() {
    setRefreshing(true);
    setRefreshError(null);
    try {
      await refreshFlight(flight.id);
    } catch (e) {
      setRefreshError(
        e instanceof FlightDataError ? e.message : 'Could not refresh. Showing the last saved details (available offline).',
      );
    } finally {
      setRefreshing(false);
    }
  }

  function confirmRemove() {
    const doRemove = async () => {
      await removeFlight(flight.id);
      router.replace('/');
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Remove this flight?')) void doRemove();
      return;
    }
    Alert.alert('Remove flight?', `${formatDesignator(flight.designator)} will be removed from this device.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => void doRemove() },
    ]);
  }

  const scheduledBlock = minutesBetween(dep.times.scheduled, arr.times.scheduled);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: formatDesignator(flight.designator) }} />
      {flight.source.isMock ? <MockBanner /> : null}
      <ScrollView contentContainerStyle={styles.container}>
        <Card>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={[styles.title, { color: t.colors.text }]}>
                {dep.airport.city} → {arr.airport.city}
              </Text>
              <Text style={{ color: t.colors.textMuted, marginTop: 2 }}>
                {flight.carrierName} · {formatLocalDate(dep.times.scheduled, dep.airport.timeZone)}
              </Text>
            </View>
            <StatusBadge flight={flight} now={now} />
          </View>
          {flight.codeshares.length > 0 ? (
            <Text style={{ color: t.colors.textMuted, marginTop: 8 }}>
              Also sold as {flight.codeshares.map(formatDesignator).join(', ')}
            </Text>
          ) : null}
          <Text
            style={{ color: t.colors.textMuted, marginTop: 8, fontSize: 13 }}
            accessibilityLabel={`Data ${flight.source.isMock ? 'simulated by mock provider' : `from ${flight.source.provider}`}, updated ${formatAge(flight.source.fetchedAt, now)}`}
          >
            {flight.source.isMock ? 'Simulated' : `Source: ${flight.source.provider}`} · updated {formatAge(flight.source.fetchedAt, now)}
          </Text>
          <View style={{ marginTop: 12 }}>
            <Button label={refreshing ? 'Refreshing…' : 'Refresh'} variant="secondary" onPress={refresh} disabled={refreshing} />
          </View>
          {refreshError ? <Text style={{ color: t.colors.danger, marginTop: 8 }}>{refreshError}</Text> : null}
        </Card>

        <Card>
          <RouteMap from={dep.airport} to={flight.divertedTo ?? arr.airport} progress={flightProgress(flight, now)} />
        </Card>

        <EndpointCard title="Departure" endpoint={dep} />
        <EndpointCard title="Arrival" endpoint={arr} baggage={arr.baggageClaim} isArrival />

        <Card>
          <Text accessibilityRole="header" style={[styles.section, { color: t.colors.text }]}>
            Timeline
          </Text>
          <Timeline flight={flight} now={now} />
        </Card>

        <Card>
          <Text accessibilityRole="header" style={[styles.section, { color: t.colors.text }]}>
            Flight
          </Text>
          <View style={styles.row}>
            <LabeledValue label="Scheduled duration" value={formatDuration(scheduledBlock)} />
            <LabeledValue label="Aircraft" value={flight.aircraft.model} />
          </View>
          <View style={[styles.row, { marginTop: 12 }]}>
            <LabeledValue label="Registration" value={flight.aircraft.registration} />
            <LabeledValue label="Operated by" value={formatDesignator(flight.designator)} />
          </View>
        </Card>

        <Button label="Remove flight" variant="danger" onPress={confirmRemove} />
      </ScrollView>
    </View>
  );
}

function EndpointCard({
  title,
  endpoint,
  baggage,
  isArrival,
}: {
  title: string;
  endpoint: FlightEndpoint;
  baggage?: string | null;
  isArrival?: boolean;
}) {
  const t = useTheme();
  const a = endpoint.airport;
  return (
    <Card>
      <Text accessibilityRole="header" style={[styles.section, { color: t.colors.text }]}>
        {title} · {a.iata}
      </Text>
      <Text style={{ color: t.colors.textMuted, marginBottom: 8 }}>
        {a.name}, {a.city} · times in local time ({formatUtcOffset(endpoint.times.scheduled, a.timeZone)})
      </Text>
      <TimeTable times={endpoint.times} timeZone={a.timeZone} />
      <View style={[styles.row, { marginTop: 12 }]}>
        <LabeledValue label="Terminal" value={endpoint.terminal} />
        <LabeledValue label="Gate" value={endpoint.gate} />
        {isArrival ? <LabeledValue label="Baggage" value={baggage ?? null} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 22, fontWeight: '800' },
  section: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
});
