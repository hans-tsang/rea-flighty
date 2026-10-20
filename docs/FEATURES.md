## Feature checklist

Legend: ✅ working (verified as described) · 🧪 mocked · ❓ untested · ⛔ blocked or not started

| Feature | State | Evidence / notes |
| --- | --- | --- |
| Flight list (Upcoming / Past, sorted) | ✅ web · ❓ iOS | Unit tests (`partitionFlights`); web build checked through Chrome |
| Add flight: airline, number, date search | ✅ web · 🧪 data | Mock provider; error (999), empty (404), and multi-leg (500) states checked on web |
| Flight details: scheduled, estimated, and actual times in airport-local time | ✅ web · 🧪 data | Time-zone unit tests (DST gap and overlap, +5:30, date line) |
| Terminals, gates, baggage, with explicit unknowns | ✅ web · 🧪 data | Mock reveals gates within 3 h and baggage after arrival |
| Status-timeline logic | ✅ unit tests · ❓ iOS rendering | `status.test.ts` |
| Route map | ✅ web · ❓ iOS | Schematic SVG great circle with no basemap. Plane position is **estimated from times**, not tracked, and labeled as such. |
| Local persistence and offline details | ✅ web (`localStorage` backend) · ✅ unit tests · ❓ iOS AsyncStorage | Survives reload; corrupt-data recovery tested |
| Refresh (mock "live" progression from the clock) | 🧪 | Simulated, not real live data |
| Light/dark theme | ✅ code path · ❓ visual on device | Follows the system setting through `useColorScheme` |
| Accessibility labels, roles, live regions, 44pt targets | ✅ code · ❓ VoiceOver | Not tested with VoiceOver |
| Loading, error, and empty states | ✅ web | |
| CI: lint, typecheck, tests, web export | ✅ local run · ❓ GitHub run | `.github/workflows/ci.yml` |
| Expo Go on an iPhone | ❓ | Not performed. SDK 58 support in App Store Expo Go is unverified. |
| EAS iOS build, signing, TestFlight | ⛔ | Needs your Expo and Apple accounts; nothing run |
| Real flight data (backend + provider) | ⛔ | Paid provider; see DATA_PROVIDERS.md |
| Push notifications, live updates | ⛔ later phase | Needs backend and EAS build |
| Inbound aircraft, delay predictions | ⛔ later phase | Not simulated |
| Calendar/email import, stats, sharing | ⛔ later phase | |
| Widgets, Live Activities, Dynamic Island | ⛔ later phase | Native Swift extension |
| Real app icon, splash, and name | ⛔ | The template's placeholder assets are still in `assets/` |
