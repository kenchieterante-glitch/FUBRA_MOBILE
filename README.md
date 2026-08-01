# FU-UBRA Mobile (Expo)

Android port of the FU-UBRA iPad designs, connecting to your existing
CodeIgniter 4 backend via a JSON API layer (see `backend/` for the
matching CI4 controller + routes).

## Setup

```bash
npx create-expo-app fu-ubra-mobile
cd fu-ubra-mobile
# copy all files from this folder in, overwriting App.js/package.json
npm install
```

Create a `.env` file in the project root:

```
EXPO_PUBLIC_API_URL=http://192.168.1.10:8080/api
```

- On a **physical Android phone**: use your computer's LAN IP (run `ipconfig`/`ifconfig`
  to find it), and make sure your phone is on the same WiFi as your dev machine.
- On the **Android emulator**: use `http://10.0.2.2:8080/api` — this special
  address maps to your host machine's localhost.
- Your CI4 dev server needs to be started with `php spark serve --host 0.0.0.0`
  (not just `php spark serve`) so it accepts connections from other devices.

## Run

```bash
npx expo start
```

Scan the QR code with the Expo Go app on your Android phone, or press `a`
to launch an Android emulator (requires Android Studio installed).

## What's wired vs. what's a stub

Every screen calls real endpoints on your CI4 backend (`/api/tools`,
`/api/vehicles`, `/api/safety/buildings`, etc. — see `api/client.js` for
the base config). The **backend** side (`backend/Api.php`) currently
returns example JSON shaped correctly for the app — you need to replace
the query logic inside each method with real calls to your Models, same
as the Mr. UBRA AI integration.

## Screens included

1. **Login** — Employee ID + password, calls `POST /api/auth/login`
2. **Portal** — module picker, shows Guard Dashboard only if `user.is_guard`
3. **Tools** — tools list by category, QR/barcode scan for borrow/return
4. **Vehicles** — fleet list, add-vehicle form, trip ticket scan in/out
5. **Safety** — building grid, fire extinguisher form, aircon checklist
6. **Janitorial** — cleaning zone grid, per-zone daily checklist
7. **Guard** — key borrowing log, scan borrow/return, today's trip tickets

## Next steps

- Wire real auth (JWT or CI4 session token) in `backend/Api.php::login()`
- Replace each backend method's placeholder data with real Model queries
- Add pull-to-refresh polling or websockets if you want live GPS/status updates
- Test camera scanning against your actual QR/barcode format for tool tags and IDs
