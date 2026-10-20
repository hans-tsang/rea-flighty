# rea-flighty

An original flight-tracking app for iOS, inspired by Flighty. It is built with **Expo (SDK 58) / React Native / TypeScript**, so you can develop it on Windows or Linux. iOS builds run in the cloud with EAS.

> ⚠️ This milestone uses **simulated flight data only**. Every screen shows a "SIMULATED DATA" banner.

## Quick start (Windows or Linux)

Prerequisites: Node.js 22 LTS (22.19+), npm, and Git. Chrome is optional but useful for the web preview.

```bash
git clone <this repo> && cd rea-flighty
npm ci
cp .env.example .env        # optional; the defaults use mock data
npm run web                 # opens the app in your browser
npm start                   # Expo dev server; scan the QR code with Expo Go on your iPhone
```

On Windows, run the commands in PowerShell, or use `copy .env.example .env`. If your phone and PC are on different networks, run `npx expo start --tunnel`.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run web` | Runs in the browser. Fastest UI loop; not iOS. |
| `npm start` | Dev server for Expo Go or a development build |
| `npm run lint` / `npm run typecheck` / `npm test` | ESLint (eslint-config-expo), `tsc --noEmit`, Jest (jest-expo) |
| `npm run check` | All three of the above |
| `npm run export:web` | Production web bundle in `dist/` |

### Trying the mock data

Search any 2-character airline code (for example `ZZ`) with any number and date. The results are generated deterministically, and the flight's state follows your device clock. Special numbers:

- `404` returns no results.
- `999` simulates a network error.
- `500` returns two legs that share one flight number.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): why Expo was chosen over SwiftUI, what each test surface proves (web, Expo Go, dev build, release), the code layout, and the phased plan
- [docs/BUILD_AND_SIGNING.md](docs/BUILD_AND_SIGNING.md): EAS Build, signing, and TestFlight without a Mac, with accounts and costs
- [docs/DATA_PROVIDERS.md](docs/DATA_PROVIDERS.md): provider comparison and backend design (secrets, polling, push)
- [docs/INVESTIGATION.md](docs/INVESTIGATION.md): REA setup for GitHub Copilot (MCP) and an evidence log labeled observed, documented, reported, inferred, or unknown
- [docs/FEATURES.md](docs/FEATURES.md): which features work, which are mocked, untested, or blocked

## Ground rules

This project contains no Flighty code, branding, assets, or private APIs. Reverse-engineering work is limited to public content and artifacts we are authorized to analyze (see `docs/INVESTIGATION.md`).
