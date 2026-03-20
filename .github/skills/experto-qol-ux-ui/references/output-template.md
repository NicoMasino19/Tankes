# Plantilla De Salida

Usá esta estructura como default y adaptala al pedido del usuario.

## Si El Pedido Es Una Review

1. Findings

   Listá problemas concretos primero, ordenados por severidad o impacto.

   Para cada finding incluí:
   - Superficie afectada.
   - Qué está pasando hoy.
   - Por qué perjudica la experiencia.
   - Dónde mirar en el repo.

2. Preguntas O Suposiciones

   Solo si faltan datos para cerrar una recomendación.

3. Cambios sugeridos

   Resumí quick wins y mejoras medianas.

## Si El Pedido Es Propuesta De Mejora

1. Diagnóstico breve

   Explicá el problema principal en lenguaje operativo.

2. Propuestas priorizadas

   Para cada propuesta incluí:
   - Prioridad: crítico, alto, medio o bajo.
   - Cambio recomendado.
   - Archivos o zonas probables.
   - Beneficio esperado.
   - Riesgo o tradeoff.
   - Validación sugerida.

3. Secuencia de implementación

   Ordená los cambios de menor riesgo a mayor riesgo.

## Si El Pedido Incluye Implementación

1. Diagnóstico corto.
2. Plan mínimo de cambios.
3. Ejecución enfocada en el alcance pedido.
4. Verificación concreta.

## Estilo Esperado

- Sé directo.
- Evitá relleno teórico.
- No confundas preferencia estética con problema de UX.
- Nombrá archivos reales cuando puedas.
- Mantené separación entre hallazgos, decisiones y validación.