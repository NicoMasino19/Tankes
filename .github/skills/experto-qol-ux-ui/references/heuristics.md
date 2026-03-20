# Heurísticas UX/UI Y QOL Para Tankes

## 1. Claridad De Estado

Preguntas:
- ¿El jugador entiende qué está pasando sin leer demasiado?
- ¿Round, score, XP, buffs y cooldowns se distinguen rápido?
- ¿Las acciones bloqueadas explican por qué fallan?
- ¿La muerte, el respawn y el draft tienen feedback inequívoco?

Señales de problema:
- Demasiado texto para entender una decisión inmediata.
- Estados importantes diferenciados solo por color.
- Mensajes de error tardíos, ambiguos o invisibles.

## 2. Jerarquía Visual

Preguntas:
- ¿La vista va primero a lo importante?
- ¿Los paneles compiten entre sí?
- ¿Hay demasiados acentos visuales simultáneos?
- ¿El ojo puede volver al área de combate rápido?

Señales de problema:
- Scoreboard, stats y habilidades con el mismo peso visual.
- Glow, bordes o animaciones encendidos en exceso.
- Bloques informativos útiles pero mal priorizados.

## 3. Input Y Descubribilidad

Preguntas:
- ¿Las acciones principales son obvias?
- ¿Hay shortcuts o comportamientos no visibles?
- ¿Enter, ESC, focus y navegación por teclado funcionan de forma coherente?
- ¿El usuario novato recibe la ayuda justa en el momento correcto?

Señales de problema:
- El usuario depende de memoria externa para operar el HUD.
- Hay información clave escondida detrás de hover sin alternativa.
- Controles y estados cambian de lugar o forma sin consistencia.

## 4. Accesibilidad Básica

Preguntas:
- ¿El contraste alcanza para lectura rápida?
- ¿Hay indicadores de foco visibles?
- ¿La interfaz se entiende sin depender solo del color?
- ¿Los textos y áreas clickeables tienen tamaño razonable?

Señales de problema:
- Botones o inputs sin foco claro.
- Texto secundario demasiado tenue.
- Estados semánticos transmitidos solo por tono cromático.

## 5. Feedback Y Aprendizaje

Preguntas:
- ¿Cada acción importante devuelve una señal clara?
- ¿El juego enseña mientras se usa, no solo antes de entrar?
- ¿El usuario puede recuperar el contexto después de un error?
- ¿Audio, tooltip y UI cuentan la misma historia?

Señales de problema:
- Toasts efímeros para eventos que necesitan persistencia.
- Tooltips útiles pero difíciles de descubrir.
- Falta de pistas para entender por qué conviene una mejora o habilidad.

## 6. Preferencias Y Persistencia

Preguntas:
- ¿Una preferencia nueva necesita persistir entre sesiones?
- ¿El usuario puede volver fácilmente a una configuración estable?
- ¿Las opciones tienen nombres claros y valores entendibles?

Señales de problema:
- Settings reiniciados sin motivo.
- Opciones agregadas sin explicar impacto real.
- Demasiada complejidad de configuración para un MVP.

## 7. Responsive Y Densidad

Preguntas:
- ¿La UI sigue siendo legible en ancho reducido?
- ¿Los paneles se pisan o tapan áreas críticas?
- ¿La interacción sigue siendo viable en pantallas chicas?

Señales de problema:
- Paneles fijos que saturan esquinas en resoluciones medianas.
- Texto comprimido o botones demasiado pequeños.
- El menú de pausa o los offers quedan fuera de lectura cómoda.

## Priorización Recomendada

Cuando detectes problemas, clasificá así:

- Crítico: afecta comprensión, input o lectura de estado en combate.
- Alto: genera errores evitables o fricción repetida.
- Medio: mejora consistencia, aprendizaje o confort de uso.
- Bajo: pulido visual o mejora cosmética sin impacto fuerte.