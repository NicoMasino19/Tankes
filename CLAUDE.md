# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install                        # Install all workspace dependencies
npm run dev                        # Run all packages concurrently (client :5173, server :3001)
npm run build                      # Build shared → server → client (sequential)
npm run typecheck                  # Type check all packages
npm run test                       # Run server tests (Vitest, builds shared first)
npm run test -w @tankes/server     # Run server tests directly
docker compose up --build          # Docker: client on :8080, server on :3001
```

Shared must build before server or client. `npm run dev` handles this automatically.

## Architecture

Monorepo (npm workspaces) with three packages: `server/`, `client/`, `shared/`.

**Server-authoritative model**: the server owns all simulation (physics, collisions, damage) at 60 TPS. Clients send input and receive delta-compressed snapshots.

### Server (`server/src/`)
- `game/World.ts` — main game loop (60 TPS tick), entity management, physics
- `net/SocketGateway.ts` — Socket.io connection handling, input validation, rate limiting
- `sim/spatial/UniformGrid.ts` — spatial hashing grid for O(1) collision queries
- `sim/pool/BulletPool.ts` — object pool to avoid GC spikes
- `game/RoundSystem.ts`, `ZoneSystem.ts`, `PowerUpSystem.ts` — match/zone/powerup logic
- `domain/entities.ts` — server-side entity interfaces

### Client (`client/src/`)
- `render/CanvasRenderer.ts` — Canvas 2D rendering
- `render/InterpolationBuffer.ts` — smooth movement between server snapshots
- `net/ClientSocket.ts` — Socket.io client wrapper with reconnection
- `input/InputController.ts` — keyboard/mouse capture
- `ui/StatsHud.ts` — HUD, upgrades, ability selection UI

### Shared (`shared/src/`)
- `game/types.ts` — all gameplay types and enums (used by both server and client)
- `game/constants.ts` — game balance constants (world size, HP, speeds, damage, etc.)
- `game/stats.ts` — player stat definitions and scaling
- `protocol/messages.ts` — Socket.io event type definitions
- `protocol/snapshot.ts` — delta compression snapshot format
- `protocol/codec.ts` — msgpack/json encoding

### Network flow
1. Client sends `input` events (movement, shoot, aim angle)
2. Server simulates tick, produces `WorldDeltaSnapshot` (only changed entities)
3. Server broadcasts snapshots at 30 Hz via Socket.io
4. Client interpolates and renders

## Key Environment Variables

See `.env.example`. Main ones: `PORT` (server, default 3001), `VITE_SERVER_URL` (client socket target), `NET_CODEC` (msgpack|json).

## Notes

- Project language is Spanish (README, comments, some variable names).
- Testing framework is Vitest (server-side only currently).
- Client uses Vite + Tailwind CSS.
