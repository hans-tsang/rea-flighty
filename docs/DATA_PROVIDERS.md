## Flight data providers

> Status: **research only. No provider is integrated.** The figures below come from 2026 web-search summaries (FlightAware's AeroAPI pricing page, the Cirium developer portal, and third-party "best flight API" guides). I could not open most of these pages directly from the sandbox. Confirm current terms, prices, and licensing with each vendor before you sign up. Commercial redistribution in a consumer app usually needs an explicit license.

| Provider | Model and cost (reported) | Free tier (reported) | Gates / baggage / aircraft reg. | Historical data | Notes |
| --- | --- | --- | --- | --- | --- |
| **FlightAware AeroAPI** | Self-serve, usage-based with monthly tiers; the reported starting tier is about $25/month, with $100+/month for commercial use and higher tiers by quote | Small allowance on the starter tier (rate-limited) | Yes: gates, baggage claim, tail numbers where available | Back to 2011 | Public pricing, REST, push alerts ("Alerts" endpoints / webhooks), predicted times (Foresight, paid add-on). **Best first choice for an MVP that needs real data.** |
| **Cirium (FlightStats APIs)** | Contract, by quote | Evaluation period | Very detailed: gates, baggage, equipment | Deep | Enterprise-grade coverage and accuracy. Costs more and takes longer to sign. |
| **OAG Flight Info / Status** | Contract, by quote | Limited trial | Schedule-led, with some operational data | Schedules history | Strongest for schedules |
| **AeroDataBox** (via API marketplaces) | From about $5/month | About 600 units/month | Gates sometimes, baggage occasionally, registration often | Limited | Cheap for prototyping. Coverage is uneven. |
| **Aviationstack** | From about $50/month | About 100 requests/month | Basic gate info; baggage and registration inconsistent | Paid plans only | Low cost. Check the data's freshness and licensing. |
| OpenSky Network / ADS-B feeds | Free for research, with restrictions | — | Positions only, no gates or baggage | Research access | Licensing usually **forbids commercial use** without an agreement. Does not replace a status API. |

**Recommendation:** start the backend with **FlightAware AeroAPI** because its pricing is self-serve and it covers gates, baggage, registrations, and history. Keep Cirium as the upgrade path if coverage or accuracy falls short. No free tier will match Flighty's coverage or alert speed. Flighty reportedly combines several sources with its own predictions; that is **unknown/reported**, not verified.

### Integration architecture

```
iPhone app ──HTTPS──▶ our API (auth, cache, rate limit) ──▶ provider (secret key server-side)
                            │
                  scheduler/poller ──▶ change detector ──▶ push (Expo Push → APNs)
```

- **Secrets stay server-side.** Anything in `EXPO_PUBLIC_*` ships inside the app binary. The app only knows our API's base URL.
- The backend maps provider responses to `Flight` (`src/domain/types.ts`) and implements the same `FlightDataProvider` contract (`src/data/provider.ts`), so the app's UI does not change.
- **Caching:** key on `(carrier, number, origin-local date)`. Use a short TTL near departure and arrival and a long TTL for far-future or completed flights. Share cached entries across users to control per-query cost.
- **Polling and scheduled jobs:** only for flights someone tracks. Increase the frequency from T−24h to arrival, then stop. Prefer provider webhooks where available.
- **Push:** store Expo push tokens per device and send only on meaningful changes (gate, delay ≥ 15 min, cancellation, baggage belt). Requires an EAS build with push capability; Expo Go cannot test production push.
- **Time zones:** providers return UTC plus airport codes. Resolve airport → IANA zone from the provider or a maintained dataset. Never use the device's zone.
- **Codeshares:** search by marketing number and resolve to the operating flight. Store both.
- **Reused numbers:** always query with the date and disambiguate multiple legs by origin.
- **Freshness:** return the provider timestamp and our fetch time. Show "updated N min ago" and flag stale data.
