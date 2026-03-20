# Frontend De Tankes

## Stack

- Cliente con Vite.
- UI armada con DOM imperativo en TypeScript.
- Gameplay renderizado en Canvas 2D.
- Tailwind para utilidades visuales y layout.
- Sin React ni framework declarativo de componentes.

## Restricciones Reales

- El HUD no debe competir con la lectura del combate.
- Cualquier mejora visual debe respetar rendimiento y densidad informativa.
- Las propuestas deben encajar con una base de clases Tailwind y estilos globales ya existentes.
- El proyecto es MVP multijugador en tiempo real, así que claridad y velocidad de comprensión pesan más que ornamento.

## Superficies Principales

### Pantalla Inicial

Archivo principal: `client/src/ui/StartScreen.ts`

Responsabilidades actuales:
- Mostrar marca, subtítulo y propuesta rápida de valor.
- Pedir nickname.
- Permitir entrar con click o Enter.
- Mostrar controles básicos y una pista de uso sobre `ESC`.

Preguntas útiles:
- ¿El jugador entiende en menos de 5 segundos qué tipo de partida va a jugar?
- ¿La acción principal es obvia?
- ¿Hay fricción innecesaria antes de entrar?
- ¿La información de controles está bien priorizada para primer uso?

### HUD En Partida

Archivo principal: `client/src/ui/StatsHud.ts`

Responsabilidades actuales:
- Mostrar estado del round, objetivo, timer y scoreboard.
- Mostrar panel de stats mejorables.
- Mostrar habilidades, slots y unlocks.
- Mostrar panel del jugador con score, XP y buffs.
- Mostrar ofertas de habilidades.
- Mostrar toast de rechazo al castear.
- Abrir menú de pausa con tabs de audio, controles y guía del HUD.
- Manejar tooltips y parte del feedback contextual.

Zonas a revisar seguido:
- Claridad de prioridades entre paneles.
- Estados listos, bloqueados, en cooldown o máximos.
- Legibilidad de score, XP, buffs y objetivo del match.
- Descubribilidad del menú y de las ayudas disponibles.
- Calidad del feedback cuando una acción falla.
- Uso del color como único canal de comunicación.

### Audio Y Preferencias

Archivo principal: `client/src/audio/SfxManager.ts`

Estado actual:
- Ya existe persistencia de `muted` y `volume` en `localStorage`.
- Hay eventos de audio para disparo, daño, muerte, respawn y zonas.

Implicancias:
- No propongas persistencia de audio como si no existiera.
- Si se sugieren nuevas preferencias, definí si deben seguir el mismo patrón de almacenamiento.
- Revisá si el feedback sonoro acompaña o confunde el feedback visual.

### Base Visual Global

Archivo principal: `client/src/index.css`

Elementos útiles:
- Fondo con gradientes radiales y grilla sutil.
- Clases reutilizables como `hud-card`, `hud-menu-button`, `hud-pause-panel` y `hud-scrollbar`.
- Animaciones `hud-enter`, `hud-toast`, `hud-pulse` y `hud-ready`.
- Breakpoints ya definidos para HUD en pantallas más angostas.

Implicancias:
- Antes de proponer estilos nuevos, verificá si la base global ya ofrece una clase reutilizable.
- Evitá multiplicar variantes visuales si una convención existente alcanza.
- Si el problema es responsive, revisá primero los breakpoints ya declarados.

## Archivos Que Suelen Importar

- `client/src/main.ts` para wiring entre red, estado y HUD.
- `client/src/state/ClientWorld.ts` para entender qué datos tiene disponible el cliente.
- `client/src/state/GameplayEventDetector.ts` para eventos que pueden transformarse en feedback UX.
- `client/src/render/CanvasRenderer.ts` para separar claramente lo que pertenece al gameplay render y lo que pertenece al HUD.

## Qué Evitar

- Recomendar una migración completa de stack para resolver un problema puntual de UX.
- Proponer overlays o motion que tapen lectura del combate.
- Sugerir settings o paneles nuevos sin definir dónde viven y cómo persisten.
- Ignorar el flujo real de teclado y mouse del jugador.