## Architecture and plan

### Assumptions

- You develop on Windows or Linux and have no Mac. You may or may not have an iPhone.
- You can create an Expo account (free) and, when you're ready for device builds, an Apple Developer Program membership (paid, see [BUILD_AND_SIGNING.md](BUILD_AND_SIGNING.md)).
- No paid flight-data API yet, so the app uses a clearly labeled mock provider.
- The app name "Skyline", its palette, and its layout are placeholders and original. Rename them before release.

### Stack decision

| | **Expo / React Native (chosen)** | Native SwiftUI + hosted macOS |
| --- | --- | --- |
| Write code on Windows/Linux | Yes, any editor | Possible, but there is no SwiftUI preview, no Xcode, and builds only happen remotely |
| UI preview without a Mac | Web (`npm run web`), Expo Go on an iPhone, Android emulator | None locally. Every UI change needs a cloud macOS build. |
| Physical iPhone testing | Expo Go (free, no Apple account) for JS-only features; EAS development build (needs paid Apple account) for custom native code | Hosted Mac plus signing, or TestFlight round-trips |
| Cloud iOS build and signing | EAS Build manages certificates and profiles (`eas credentials`) | GitHub Actions macOS runners, Codemagic, Bitrise, or MacinCloud, with fastlane `match` for signing |
| TestFlight | `eas submit -p ios` from any OS | fastlane `pilot` on the macOS runner |
| Widgets, Live Activities, Dynamic Island | Need a Swift widget extension added through a config plugin, built with EAS. Cannot be tested in Expo Go. | First-class |
| Fit for a no-Mac developer | **Best**: fast local iteration, cloud only for native builds | Slow feedback loop for every UI change |

**Recommendation:** use Expo SDK 58 (React Native 0.88, TypeScript, Expo Router), the latest stable release on npm when this was written. If Live Activities or widgets become core features, add a native Swift target later through a config plugin. EAS can build it without you owning a Mac, but **debugging** native Swift without Xcode is hard. Budget for a rented Mac (for example MacinCloud) at that phase.

Risk (**unknown**): SDK 58 shipped about 2026-10-15. Check that the App Store's Expo Go already supports SDK 58 before relying on it. If it doesn't, use the web build, an Android emulator, or an EAS development build, or temporarily pin SDK 57.

### What each test surface proves

| Surface | Runs here? | What it proves | What it does **not** prove |
| --- | --- | --- | --- |
| Jest unit tests | Yes (CI) | Domain logic: status, time zones, persistence | Rendering, native behavior |
| Web (`npm run web` / `export:web`) | Yes | Navigation, layout, the mock flow, `localStorage` persistence | iOS fonts, gestures, safe areas, Hermes `Intl`, AsyncStorage on iOS |
| Expo Go on an iPhone | Not done | The app's JS on real iOS with Expo Go's fixed native modules (AsyncStorage and SVG are included) | Your own native modules, app icon and entitlements, push notifications, release build |
| EAS development build | Not done | Your exact native module set on a device, with a dev menu | Release optimizations, App Store review |
| Signed release (TestFlight) | Not done | What users actually get | — |

### Code layout

```
src/
  app/                 Expo Router screens (every file is a route)
    _layout.tsx        Stack navigator, theme, FlightsProvider
    index.tsx          Flight list: Upcoming / Past
    add.tsx            Search by airline, number, and date, then save
    flight/[id].tsx    Details: times, gates, baggage, timeline, map
  domain/              Pure TypeScript, no React
    types.ts           Flight model (null = unknown)
    status.ts          Derived status, timeline, upcoming/past, progress
    time.ts            IANA time-zone conversions, DST, day offsets
    geo.ts             Great-circle math
  data/
    provider.ts        FlightDataProvider interface and error types
    mockProvider.ts    Deterministic, clearly labeled simulated data
    airports.ts        Static airports for the mock
  storage/
    flightRepository.ts  Versioned JSON in AsyncStorage, serialized writes, corruption recovery
  state/FlightsContext.tsx  React context wiring the repository and provider
  ui/                  Theme (light/dark), components, timeline, SVG route map
```

### Data-handling rules (implemented)

- **Instants are UTC.** Each airport carries an IANA zone, and every displayed time is formatted in *that airport's* zone with a UTC offset label. Arrival day offsets (+1, +2, −1) come from calendar dates in each zone, so overnight and date-line flights display correctly.
- **Flight identity** = carrier + number + *origin-local* departure date + origin airport. Flight numbers repeat daily and can cover several legs; the mock's `500` scenario shows this.
- **Unknown values are not facts.** `null` renders as "Not yet known" or "—". Status says "Scheduled" (not "On time") when there is no estimate, and "Departure not confirmed" instead of guessing that the plane left.
- **Freshness.** Every snapshot stores `source.fetchedAt` and `isMock`. The details screen shows "Simulated · updated N min ago".
- **Codeshares** are stored as marketing designators on the operating flight.
- **Offline:** saved flights are full snapshots, so details render without a network connection. A failed refresh keeps the last snapshot.

### Phased plan

1. **Milestone 1 (this PR):** list, add (mock), details, persistence, theming, tests, CI, EAS config, docs.
2. **Milestone 2:** run on a physical iPhone through Expo Go. Polish (pull-to-refresh, swipe to delete, date picker). Add a real basemap (react-native-maps uses Apple Maps on iOS and is included in Expo Go).
3. **Milestone 3: backend and real data.** Build a small server (for example Cloudflare Workers, Fly.io, or Supabase Edge Functions) that implements `FlightDataProvider` against one paid provider. Add an app-side `BackendFlightProvider`, a cache layer, and rate limiting. See [DATA_PROVIDERS.md](DATA_PROVIDERS.md).
4. **Milestone 4: alerts.** Server-side scheduled polling or provider webhooks for tracked flights, then change detection, then Expo Push / APNs. Needs device tokens and the push entitlement. Requires an EAS build; Expo Go is not enough.
5. **Later:** inbound aircraft (needs a provider with tail-number linkage), calendar and email import, statistics and sharing, widgets, Live Activities and Dynamic Island (Swift extension), delay predictions (needs historical data and modeling). None of these are simulated in this milestone.
