import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { FlightDataError } from '../data/provider';
import { addDays, formatLocalDate, formatLocalTime, isValidLocalDate, localDateOf } from '../domain/time';
import { formatDesignator, type Flight } from '../domain/types';
import { useFlights } from '../state/FlightsContext';
import { Button, Card, LoadingState, MessageState, MockBanner } from '../ui/components';
import { useTheme } from '../ui/theme';

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'results'; flights: Flight[] };

function deviceToday(): string {
  return localDateOf(new Date().toISOString(), Intl.DateTimeFormat().resolvedOptions().timeZone);
}

export default function AddFlightScreen() {
  const t = useTheme();
  const { provider, saveFlight, flights: saved } = useFlights();
  const [carrier, setCarrier] = useState('ZZ');
  const [number, setNumber] = useState('');
  const [date, setDate] = useState(deviceToday);
  const [state, setState] = useState<SearchState>({ kind: 'idle' });
  const [saveError, setSaveError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const today = deviceToday();

  const dateValid = isValidLocalDate(date);
  const canSearch = carrier.trim().length === 2 && /^\d{1,4}$/.test(number.trim()) && dateValid;

  async function search() {
    if (!canSearch) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ kind: 'loading' });
    try {
      const flights = await provider.searchFlights(
        { carrierCode: carrier, flightNumber: number, departureLocalDate: date },
        controller.signal,
      );
      if (!controller.signal.aborted) setState({ kind: 'results', flights });
    } catch (e) {
      if (controller.signal.aborted) return;
      const message = e instanceof FlightDataError ? e.message : 'Something went wrong. Please try again.';
      setState({ kind: 'error', message });
    }
  }

  async function add(flight: Flight) {
    setSaveError(null);
    try {
      await saveFlight(flight);
      router.replace({ pathname: '/flight/[id]', params: { id: flight.id } });
    } catch {
      setSaveError('Could not save this flight on the device. Please try again.');
    }
  }

  const inputStyle = [styles.input, { color: t.colors.text, borderColor: t.colors.border, backgroundColor: t.colors.card }];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {provider.isMock ? <MockBanner /> : null}
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.row}>
          <View style={{ width: 110 }}>
            <Text style={[styles.label, { color: t.colors.textMuted }]} nativeID="carrierLabel">
              Airline (IATA)
            </Text>
            <TextInput
              value={carrier}
              onChangeText={(v) => setCarrier(v.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={2}
              placeholder="ZZ"
              placeholderTextColor={t.colors.textMuted}
              accessibilityLabel="Airline code"
              accessibilityLabelledBy="carrierLabel"
              style={inputStyle}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: t.colors.textMuted }]} nativeID="numberLabel">
              Flight number
            </Text>
            <TextInput
              value={number}
              onChangeText={(v) => setNumber(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              maxLength={4}
              placeholder="123"
              placeholderTextColor={t.colors.textMuted}
              accessibilityLabel="Flight number"
              accessibilityLabelledBy="numberLabel"
              returnKeyType="search"
              onSubmitEditing={search}
              style={inputStyle}
            />
          </View>
        </View>

        <Text style={[styles.label, { color: t.colors.textMuted }]} nativeID="dateLabel">
          Departure date (local to departure airport)
        </Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={t.colors.textMuted}
          autoCorrect={false}
          accessibilityLabel="Departure date, format year month day"
          accessibilityLabelledBy="dateLabel"
          style={[inputStyle, !dateValid && { borderColor: t.colors.danger }]}
        />
        {!dateValid ? <Text style={{ color: t.colors.danger, marginTop: 4 }}>Enter a valid date as YYYY-MM-DD.</Text> : null}
        <View style={[styles.row, { marginTop: 8 }]}>
          {[
            { label: 'Yesterday', value: addDays(today, -1) },
            { label: 'Today', value: today },
            { label: 'Tomorrow', value: addDays(today, 1) },
          ].map((chip) => (
            <View key={chip.label} style={{ flex: 1 }}>
              <Button
                label={chip.label}
                variant={date === chip.value ? 'primary' : 'secondary'}
                onPress={() => setDate(chip.value)}
              />
            </View>
          ))}
        </View>

        <View style={{ marginTop: 16 }}>
          <Button label="Search" onPress={search} disabled={!canSearch || state.kind === 'loading'} />
        </View>
        {provider.isMock ? (
          <Text style={[styles.hint, { color: t.colors.textMuted }]}>
            Mock provider: any 2-character airline and number returns a simulated flight. Try 404 (no results), 999
            (network error) or 500 (two legs).
          </Text>
        ) : null}

        <View style={{ marginTop: 16, minHeight: 160 }}>
          {state.kind === 'loading' ? <LoadingState label="Searching flights…" /> : null}
          {state.kind === 'error' ? (
            <MessageState tone="error" title="Search failed" body={state.message} actionLabel="Try again" onAction={search} />
          ) : null}
          {state.kind === 'results' && state.flights.length === 0 ? (
            <MessageState
              title="No flights found"
              body={`No ${carrier} ${number} departing on ${date}. Check the date is local to the departure airport.`}
            />
          ) : null}
          {state.kind === 'results'
            ? state.flights.map((f) => {
                const already = saved.some((s) => s.flight.id === f.id);
                return (
                  <Card key={f.id}>
                    <Text style={[styles.resultTitle, { color: t.colors.text }]}>
                      {formatDesignator(f.designator)} · {f.departure.airport.iata} → {f.arrival.airport.iata}
                    </Text>
                    <Text style={{ color: t.colors.textMuted, marginVertical: 6 }}>
                      {formatLocalDate(f.departure.times.scheduled, f.departure.airport.timeZone)} · departs{' '}
                      {formatLocalTime(f.departure.times.scheduled, f.departure.airport.timeZone)} local ·{' '}
                      {f.carrierName}
                    </Text>
                    <Button
                      label={already ? 'Already saved — update' : 'Save flight'}
                      onPress={() => add(f)}
                      accessibilityHint="Saves this flight to your list and opens its details"
                    />
                  </Card>
                );
              })
            : null}
          {saveError ? <Text style={{ color: t.colors.danger }}>{saveError}</Text> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  row: { flexDirection: 'row', gap: 12 },
  label: { fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 18, minHeight: 44 },
  hint: { fontSize: 13, marginTop: 12, lineHeight: 18 },
  resultTitle: { fontSize: 18, fontWeight: '700' },
});
