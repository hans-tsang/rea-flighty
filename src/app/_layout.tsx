import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { FlightsProvider } from '../state/FlightsContext';
import { useTheme } from '../ui/theme';

export default function RootLayout() {
  const t = useTheme();
  return (
    <SafeAreaProvider>
      <FlightsProvider>
        <StatusBar style={t.dark ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: t.colors.card },
            headerTintColor: t.colors.accent,
            headerTitleStyle: { color: t.colors.text },
            contentStyle: { backgroundColor: t.colors.background },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'My Flights' }} />
          <Stack.Screen name="add" options={{ title: 'Add Flight', presentation: 'modal' }} />
          <Stack.Screen name="flight/[id]" options={{ title: 'Flight' }} />
        </Stack>
      </FlightsProvider>
    </SafeAreaProvider>
  );
}
