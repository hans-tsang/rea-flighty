import { router, Stack } from 'expo-router';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { partitionFlights } from '../domain/status';
import { useFlights, useNow } from '../state/FlightsContext';
import { Button, FlightCard, LoadingState, MessageState, MockBanner } from '../ui/components';
import { useTheme } from '../ui/theme';

export default function FlightListScreen() {
  const t = useTheme();
  const now = useNow();
  const { flights, loading, provider, storageMessage, dismissStorageMessage } = useFlights();
  const { upcoming, past } = partitionFlights(flights, now);

  const sections = [
    { title: 'Upcoming', data: upcoming },
    { title: 'Past', data: past },
  ].filter((s) => s.data.length > 0);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/add')}
              accessibilityRole="button"
              accessibilityLabel="Add flight"
              hitSlop={12}
              style={{ paddingHorizontal: 8 }}
            >
              <Text style={{ color: t.colors.accent, fontSize: 28, fontWeight: '400' }}>+</Text>
            </Pressable>
          ),
        }}
      />
      {provider.isMock ? <MockBanner /> : null}
      {storageMessage ? (
        <Pressable onPress={dismissStorageMessage} accessibilityRole="alert" accessibilityHint="Dismisses this message">
          <Text style={[styles.storage, { color: t.colors.danger, backgroundColor: t.colors.card }]}>{storageMessage}</Text>
        </Pressable>
      ) : null}
      {loading ? (
        <LoadingState label="Loading saved flights…" />
      ) : sections.length === 0 ? (
        <MessageState
          title="No flights yet"
          body="Add a flight by airline code, flight number and date. Saved flights stay available offline."
          actionLabel="Add a flight"
          onAction={() => router.push('/add')}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.flight.id}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => (
            <Text accessibilityRole="header" style={[styles.header, { color: t.colors.textMuted, backgroundColor: t.colors.background }]}>
              {section.title} ({section.data.length})
            </Text>
          )}
          renderItem={({ item }) => (
            <FlightCard
              flight={item.flight}
              now={now}
              onPress={() => router.push({ pathname: '/flight/[id]', params: { id: item.flight.id } })}
            />
          )}
          ListFooterComponent={<Button label="Add another flight" variant="secondary" onPress={() => router.push('/add')} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 48 },
  header: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, paddingVertical: 8 },
  storage: { padding: 12, fontSize: 14 },
});
