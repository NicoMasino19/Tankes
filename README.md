# Tankes MVP (Server-Authoritative Multiplayer)

Juego multijugador en tiempo real estilo Diep.io con simulación autoritativa en servidor.

## Arquitectura breve

- `server/`: simula movimiento, disparo, colisiones, daño y stats (autoridad total).
- `client/`: envía input, recibe snapshots y renderiza en Canvas con interpolación.
- `shared/`: tipos, constantes y protocolo compartido.

Puntos técnicos del MVP:

- Tick de simulación estable (60 TPS) con `deltaTime`.
- Snapshots con delta compression (se envían cambios, no estado completo).
- Red lista para binario (`msgpack`) con fallback `json`.
- Colisiones optimizadas con grid espacial uniforme.
- Balas con Factory + Object Pool.

## Flujo de usuario

1. Usuario abre el cliente.
2. Ingresa `nickname` en pantalla inicial.
3. Click en `Play` (o Enter).
4. Cliente envía `join` al servidor.
5. Servidor responde `join:ack` y entra a la arena con ese nombre.

## Requisitos

- Node.js 20+.
- npm 10+ recomendado.

## Comandos (raíz del monorepo)

### Instalar

```bash
npm install
```

### Desarrollo

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Docker

```bash
docker compose up --build
```

Esto levanta dos servicios:

- Cliente estático en `http://localhost:8080`
- Servidor Socket.io en `http://localhost:3001`

El cliente en Docker usa el fallback ya incluido en runtime y, si no configurás `VITE_SERVER_URL`, intenta conectar al mismo host del navegador en el puerto `3001`.

Variables útiles para compose:

- `CLIENT_PORT` publica el frontend localmente (default `8080`)
- `PORT` publica el server localmente (default `3001`)
- `VITE_SERVER_URL` fuerza la URL del socket en el build del cliente si necesitás apuntar a otro host
- `NET_CODEC` cambia el codec del server (`msgpack` por defecto)

Podés copiar `.env.example` a `.env` y ajustar esos valores sin tocar `docker-compose.yml`.

Ejemplo con URL explícita del server:

```bash
$env:VITE_SERVER_URL='http://localhost:3001'
docker compose up --build
```

Si antes probaste otros puertos en la misma terminal de PowerShell, limpiá variables persistidas antes de volver al default:

```bash
Remove-Item Env:PORT -ErrorAction SilentlyContinue
Remove-Item Env:CLIENT_PORT -ErrorAction SilentlyContinue
Remove-Item Env:VITE_SERVER_URL -ErrorAction SilentlyContinue
```

### Typecheck (runtime MVP)

```bash
npm run typecheck
```

## Puertos y variables

Puertos por defecto:

- Cliente Vite: `5173`
- Servidor Socket.io: `3001`

Variables útiles:

- `PORT` (server, por defecto `3001`)
- `VITE_SERVER_URL` (client, por defecto `http://localhost:3001`)
- `NET_CODEC` (`msgpack|json`, default `msgpack`)
- `VITE_NET_CODEC` (`msgpack|json`, default `msgpack`)
- `RATE_LIMIT_INPUT_WINDOW_MS`
- `RATE_LIMIT_INPUT_MAX_EVENTS`
- `RATE_LIMIT_UPGRADE_WINDOW_MS`
- `RATE_LIMIT_UPGRADE_MAX_EVENTS`
- `RATE_LIMIT_MAX_VIOLATIONS_BEFORE_DISCONNECT`
- `UPGRADE_MIN_INTERVAL_MS`
- `RECONNECT_GRACE_MS`

## Troubleshooting rápido

- **No conecta al servidor**: verificar que `npm run dev` esté corriendo en raíz y que `PORT`/`VITE_SERVER_URL` coincidan.
- **Puerto ocupado (`5173` o `3001`)**: liberar puerto o cambiar `PORT` para server y ajustar `VITE_SERVER_URL` en client.
- **Docker marca contenedor unhealthy**: probar `docker compose logs server client` y verificar `http://localhost:3001/health` o el puerto alternativo que estés publicando.
- **Cambios en shared no reflejan**: reiniciar `npm run dev` desde raíz para asegurar rebuild/watch de `shared`.
- **Cliente queda en pantalla de inicio**: revisar consola del navegador y logs del server para eventos `join`/`join:ack`.
- **Typecheck falla localmente**: ejecutar `npm run typecheck` en raíz y revisar paquete específico (`-w @tankes/server` o `-w @tankes/client`).

## Runbook de demo (sesión multicliente)

Objetivo: ejecutar una demo completa del MVP y validar el ciclo principal de sesión de juego.

### 1) Levantar entorno

1. Ejecutar `npm install` (una sola vez por máquina).
2. Ejecutar `npm run dev` desde la raíz.
3. Confirmar servicios:
	- Cliente: `http://localhost:5173`
	- Servidor: `http://localhost:3001` (Socket.io)

Criterio de pase: client y server levantan sin errores fatales en consola.

### 2) Abrir múltiples pestañas

1. Abrir 2 o 3 pestañas del cliente (`http://localhost:5173`).
2. Ingresar nicknames distintos (ejemplo: `Alpha`, `Bravo`, `Charlie`).
3. Entrar con `Play` en todas.

Criterio de pase: todas las pestañas entran a la arena y muestran entidades remotas.

### 3) Completar una ronda

1. Jugar hasta que al menos un tanque elimine a otro (intercambio real de disparos).
2. Continuar hasta observar que la partida sigue estable después de la primera eliminación.

Criterio de pase: el servidor procesa daño/eliminación y la ronda continúa sin freeze ni desincronización evidente.

### 4) Validar marcador (scoreboard)

1. Durante y después de la eliminación, revisar el HUD/scoreboard en todas las pestañas.
2. Confirmar que el jugador que consiguió la eliminación refleja el cambio esperado.

Criterio de pase: scoreboard consistente entre pestañas (mismos jugadores y puntajes en orden lógico).

### 5) Validar respawn

1. En la pestaña del jugador eliminado, esperar el ciclo de respawn.
2. Verificar que reaparece en arena con control funcional (movimiento/disparo).

Criterio de pase: el jugador respawnea correctamente, vuelve a interactuar y no queda en estado inválido.

### 6) Validar reconexión de sesión

1. Con un jugador activo, cerrar su pestaña (o desconectar socket) y volver a abrir cliente.
2. Reingresar usando el mismo flujo de sesión soportado por el cliente.
3. Confirmar continuidad de sesión y estabilidad para el resto de jugadores.

Criterio de pase: la reconexión no rompe la partida, conserva la sesión esperada y el jugador vuelve a recibir estado.

## Smoke tests de sesión (pasada mínima)

Ejecutar y marcar `OK/FAIL`:

1. Entorno levanta (`npm run dev`) y acepta joins.
2. 2+ pestañas conectadas simultáneamente sin errores críticos.
3. Se completa al menos 1 eliminación real entre jugadores.
4. Scoreboard refleja el resultado de la eliminación en todos los clientes.
5. Jugador eliminado respawnea y recupera control.
6. Reconexión de un jugador funciona sin tumbar la sesión de los demás.

## Definition of Done (MVP completo)

La entrega se considera cerrada solo si todos los puntos están en `Sí`:

1. `npm install` finaliza sin errores críticos.
2. `npm run dev` levanta `client`, `server` y watcher de `shared`.
3. `npm run build` finaliza en el monorepo.
4. `npm run typecheck` (runtime MVP) finaliza sin errores.
5. Flujo `nickname -> Play -> arena` funciona en frío.
6. Demo multicliente completada (2+ pestañas activas).
7. Ronda jugable completada con al menos una eliminación válida.
8. Scoreboard consistente entre clientes tras la eliminación.
9. Respawn validado end-to-end para jugador eliminado.
10. Reconexión de sesión validada sin caída del servidor ni corrupción de estado.
11. Comandos de pruebas del servidor pasan (`npm run test -w @tankes/server`).
12. Runbook de demo/smoke en este README permite repetir la validación en otra máquina.

## No incluido en MVP

- Autenticación.
- Persistencia de usuarios/progreso.
- Matchmaking.
- Anti-cheat avanzado.
- Ranking/leaderboards persistentes.
