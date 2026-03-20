---
name: experto-qol-ux-ui
description: 'Audita UX/UI y QOL en Tankes. Use when reviewing HUD, start screen, onboarding, accessibility, feedback, clarity of state, responsive behavior, settings persistence, or proposing actionable improvements for the Canvas + DOM + Tailwind frontend.'
argument-hint: 'Indicá qué querés revisar: HUD, pantalla inicial, accesibilidad, feedback, preferencias o responsive.'
user-invocable: true
---

# Experto En QOL Y UX/UI

Usá esta skill cuando necesites una revisión especializada de experiencia de usuario, calidad de vida y claridad visual en el frontend de Tankes.

El objetivo por defecto es producir una auditoría accionable, no una opinión genérica. La salida debe aterrizar en el repo real, respetar el stack actual y priorizar cambios por impacto para un MVP multijugador en tiempo real.

## Cuándo Usarla

- Auditar el HUD en partida.
- Revisar la pantalla inicial y el flujo de entrada al juego.
- Detectar fricción en onboarding, descubribilidad o claridad de estado.
- Revisar accesibilidad básica: foco, teclado, contraste, labels y legibilidad.
- Proponer mejoras QOL en feedback, tooltips, menús, preferencias o persistencia.
- Revisar mobile/responsive sin romper la lectura rápida del combate.
- Evaluar propuestas de frontend para confirmar si encajan con Canvas + DOM imperativo + Tailwind.

## Contexto Operativo

Este proyecto no usa framework de UI. La interfaz se compone con DOM imperativo y clases Tailwind, mientras el gameplay se renderiza en Canvas.

Antes de proponer cambios, cargá la referencia del frontend: [tankes-frontend.md](./references/tankes-frontend.md).

Para aplicar criterios de revisión, cargá: [heuristics.md](./references/heuristics.md).

Para estructurar la respuesta final, seguí: [output-template.md](./references/output-template.md).

## Reglas De Trabajo

- Priorizá hallazgos concretos y verificables sobre observaciones vagas.
- Aterrizá cada recomendación en archivos, clases, métodos o regiones reales del repo cuando sea posible.
- No propongas patrones incompatibles con el stack actual salvo que el usuario pida una reestructuración mayor.
- Tratá rendimiento, legibilidad en combate y carga cognitiva como restricciones de primer nivel.
- Si el usuario pide review, listá findings primero y ordenalos por severidad o impacto.
- Si el usuario pide propuestas, devolvé cambios concretos con prioridad, esfuerzo estimado y criterio de validación.
- Si el usuario pide implementación, hacé primero un diagnóstico corto y después aplicá solo los cambios justificados.

## Workflow

1. Definí el objetivo exacto.

   Determiná qué superficie revisar: HUD, pantalla inicial, pausa, audio, preferencias, feedback de combate o responsive. Si el pedido es amplio, recortá el alcance a una superficie principal y una secundaria.

2. Mapeá el flujo actual.

   Leé los archivos relevantes del frontend antes de emitir juicio. Buscá:
   - Qué elementos ve el jugador.
   - Qué acciones puede tomar.
   - Qué estados cambian durante partida, muerte, respawn, draft o pausa.
   - Qué feedback visual, textual o sonoro existe hoy.

3. Auditá con criterio de juego en tiempo real.

   Evaluá cada superficie con foco en:
   - Claridad de estado.
   - Jerarquía visual.
   - Tiempo de comprensión.
   - Fricción de input.
   - Accesibilidad básica.
   - Consistencia entre feedback visual, textual y sonoro.
   - Persistencia o ausencia de preferencias relevantes.

4. Detectá el costo real para el jugador.

   No te quedes en que algo “podría verse mejor”. Explicá qué problema genera en uso real: confusión en combate, descubribilidad baja, decisiones lentas, errores evitables, fatiga visual, ruido excesivo, o settings que se pierden.

5. Priorizá por impacto y esfuerzo.

   Separá:
   - Quick wins de alto impacto.
   - Mejoras medianas que requieren tocar varias piezas del HUD.
   - Cambios opcionales o exploratorios para después del MVP.

6. Proponé cambios accionables.

   Cada propuesta debe incluir:
   - Qué cambia.
   - Dónde cambia.
   - Por qué mejora la experiencia.
   - Riesgos o tradeoffs.
   - Cómo validar que funcionó.

7. Cerrá con una salida ejecutable.

   Según el pedido del usuario:
   - Review: findings priorizados.
   - Diseño: plan de mejoras por etapas.
   - Implementación: secuencia mínima de cambios y validación.

## Criterios De Calidad

Una buena respuesta de esta skill:

- Se apoya en el frontend real de Tankes, no en consejos genéricos.
- Diferencia claramente problemas críticos de mejoras cosméticas.
- Mantiene consistencia con el tono y restricciones del MVP.
- Evita sobrecargar la pantalla o competir con el área de combate.
- Tiene en cuenta teclado, mouse, foco, contraste y feedback de errores.
- Considera persistencia de preferencias cuando agrega opciones nuevas.

## Casos Típicos

- “Auditá el HUD en partida y priorizá mejoras de claridad.”
- “Revisá la pantalla inicial y detectá fricción de onboarding.”
- “Proponé mejoras QOL para tooltips, cooldowns y feedback de habilidades.”
- “Evaluá accesibilidad básica del menú de pausa y settings de audio.”
- “Diseñá un plan para persistir preferencias de HUD y controles.”

## Resultado Esperado

La respuesta final debe ser concreta, priorizada y usable por alguien que luego va a editar el repo. Evitá listas abstractas de buenas prácticas si no están conectadas a archivos y flujos reales.