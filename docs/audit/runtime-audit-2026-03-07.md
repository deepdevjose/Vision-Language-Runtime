# Auditoría Técnica Profunda — Vision-Language Runtime

**Repositorio auditado:** `https://github.com/deepdevjose/Vision-Language-Runtime`  
**Fecha de auditoría:** 2026-03-07  
**Perfil aplicado:** Principal Performance Engineer + Software Architect (runtime IA web, WebGPU, multimodal con cámara) jajaj its just me doing my things

## Alcance y método
- Auditoría basada en evidencia de código fuente real (sin asumir  los comportamientos no verificable).
- Flujo crítico auditado: `camera/video -> frame capture -> preprocess -> inference -> postprocess -> render -> UI state`.
- Verificaciones ejecutadas:
  - `npm run test:unit` ✅
  - `npm run type-check` ✅ (con cobertura real de tipo limitada por config)
  - `npm run lint` ❌ (falta cla onfiguración de ESLint)
  - `npx playwright test --project=chromium --workers=1 --reporter=line` ❌ (10 pasados, 2 fallidos)

## A. Resumen ejecutivo
- **Madurez general del repositorio:** **beta funcional con deuda sistémica alta**. El runtime demuestra intención arquitectónica correcta, pero hoy tiene inconsistencias de estado/contratos que afectan fiabilidad de producción.
- **Fortalezas reales:**
  - Control básico de backpressure con `inferenceLock` y delay dinámico (`src/js/services/vision-language-service.js:150-189`, `313-322`).
  - Caching de canvas/context y resize condicional para no recrear buffers por frame (`src/js/services/vision-language-service.js:195-233`).
  - Loop abortable con `AbortController` y limpieza parcial en runtime (`src/js/components/captioning-view.js:323-410`).
  - Estrategia de constraints/fallback de cámara razonable (`src/js/services/webcam-service.js:224-256`).
- **Debilidades principales:**
  - Contrato de utilidades DOM roto (`createElement`) con impacto transversal en UI y fallback.
  - Máquina de estados no alineada con eventos reales de media pipeline.
  - Fallback `no-WebGPU` roto por doble fuente de verdad del estado.
  - Riesgo de XSS en render de texto streameado.
  - Observabilidad “cosmética”: métricas aproximadas/no confiables para decisiones de performance.
- **Mayor riesgo técnico:** incoherencia entre estado formal y ejecución real (transiciones no disparadas, eventos inexistentes, recuperación incompleta).
- **Mayor riesgo de UX:** en navegadores sin WebGPU o con fallos de stream, usuario puede quedar bloqueado sin recuperación efectiva.
- **Mayor riesgo de producción:** fallas en resiliencia + batería/CPU elevada en móvil por composición pesada y procesamiento duplicado de frames.

## B. Top hallazgos priorizados

| # | Severidad | Prioridad | Hallazgo |
|---|---|---|---|
| 1 | Crítico | P0 | Contrato `createElement` inconsistente rompe UI y fallback |
| 2 | Crítico | P0 | Fallback sin WebGPU no transiciona por estado desincronizado |
| 3 | Crítico | P0 | Recuperación de stream rota (eventos incompatibles, transición inexistente) |
| 4 | Crítico | P0 | Inyección HTML/XSS potencial en texto de inferencia streameado |
| 5 | Alto | P1 | Warmup mal acoplado y duplicado (startup innecesariamente lento/inestable) |
| 6 | Alto | P1 | Detección WebGPU repetida y costosa (startup/runtime + ruido de consola) |
| 7 | Alto | P1 | Máquina de estados parcial: rutas muertas y side-effects fuera del modelo |
| 8 | Alto | P1 | Fugas de timers/listeners en vistas y overlays |
| 9 | Alto | P1 | E2E desalineado con UI real; cobertura crítica insuficiente |
| 10 | Medio | P2 | Diagnósticos con métricas inexactas/no accionables |
| 11 | Medio | P2 | Tooling de calidad incompleto (lint roto, tipado casi desactivado) |
| 12 | Medio | P2 | Sobrecoste por render/composición (ASCII + blur + updates por token) |
| 13 | Bajo | P3 | Deriva arquitectónica: módulos utilitarios no integrados |

## C. Hallazgos detallados

### Hallazgo 1
1. **Título:** Contrato `createElement` inconsistente rompe UI y fallback
2. **Severidad:** Crítico
3. **Área afectada:** Sistémico, `UX técnica + robustez + DX`
4. **Archivo(s)/módulo(s)/función(es):**
   - `src/js/utils/dom-helpers.js:createElement` (líneas 4-43)
   - Consumidores con contrato incorrecto:
     - `src/js/components/error-screen.js:50-65`
     - `src/js/components/image-upload.js:29-37`, `47-65`, `73-77`
     - `src/js/main.js:299-312`
     - `src/js/components/url-display.js:22-33`, `52-55`, `92-113`
5. **Evidencia concreta encontrada:**
   - `createElement` solo soporta `text`, `html`, `attributes`.
   - Varios componentes usan `textContent`, `innerHTML`, `type`, `accept` fuera de `attributes`.
   - Ejemplo crítico: `image-upload` crea input con `{ type: 'file', accept: 'image/*' }` pero helper lo ignora.
6. **Causa raíz:** ausencia de contrato tipado/validado del helper y uso inconsistente en módulos.
7. **Por qué afecta rendimiento/estabilidad/mantenibilidad:**
   - Rompe rutas de UI en silencio (sin excepción), elevando tiempo de diagnóstico y riesgo de regresión.
   - Deja fallback de upload no operativo.
8. **Síntoma esperado en usuario real:** textos faltantes en pantallas/diálogos y selector de archivos que no abre picker.
9. **Mitigación concreta:** unificar API del helper, aceptar alias (`textContent`/`innerHTML`) o prohibirlos explícitamente con validación en desarrollo; migrar consumidores.
10. **Esfuerzo estimado:** Bajo
11. **Impacto esperado:** Alto
12. **Prioridad de implementación:** P0

### Hallazgo 2
1. **Título:** Fallback sin WebGPU no transiciona por estado desincronizado
2. **Severidad:** Crítico
3. **Área afectada:** Arquitectónico, `resiliencia + startup UX`
4. **Archivo(s)/módulo(s)/función(es):**
   - `src/js/main.js:30-45`, `51-59`, `236-243`
   - `src/js/utils/state-machine.js:106-116`
5. **Evidencia concreta encontrada:**
   - `main.js` usa variable local `hasWebGPU` (inicial `false`) para decidir evento.
   - `stateMachine.state.hasWebGPU` inicia en `true` y no se sincroniza.
   - `START_FALLBACK` requiere `!this.state.hasWebGPU`, guard que falla siempre.
6. **Causa raíz:** doble fuente de verdad (estado local vs estado de máquina).
7. **Por qué afecta rendimiento/estabilidad/mantenibilidad:** flujo de degradación progresiva queda roto; no hay path confiable para navegador no compatible.
8. **Síntoma esperado en usuario real:** botón de inicio sin efecto en ciertos tiempos/entornos; fallback nunca abre.
9. **Mitigación concreta:** mover detección de WebGPU a evento de state machine (`GPU_DETECTED`) y bloquear `START` hasta que ese estado esté fijado.
10. **Esfuerzo estimado:** Medio
11. **Impacto esperado:** Alto
12. **Prioridad de implementación:** P0

### Hallazgo 3
1. **Título:** Recuperación de stream rota (eventos incompatibles, transición inexistente)
2. **Severidad:** Crítico
3. **Área afectada:** Arquitectónico, `robustez en tiempo real`
4. **Archivo(s)/módulo(s)/función(es):**
   - `src/js/services/webcam-service.js:261-271`
   - `src/js/main.js:380-383`
   - `src/js/utils/state-machine.js:165-189` y `175` (`RETRY_STREAM`)
5. **Evidencia concreta encontrada:**
   - Servicio reporta “Camera reconnected” por el mismo callback de “ended”.
   - `main.js` siempre despacha `STREAM_ENDED` independientemente del mensaje.
   - Existe transición `STREAM_RECOVERED` pero no se despacha nunca.
   - `recoverAction` despacha `RETRY_STREAM`, evento no definido en la máquina.
6. **Causa raíz:** contrato de eventos media/state-machine no definido de forma explícita y verificable.
7. **Por qué afecta rendimiento/estabilidad/mantenibilidad:** imposibilita autorecuperación confiable y deja estados de recuperación colgados.
8. **Síntoma esperado en usuario real:** pérdida temporal de cámara termina en estado de error sin retorno operativo.
9. **Mitigación concreta:** callback tipado con discriminante (`ended|recovered`) + transición explícita `RETRY_STREAM` o eliminación del botón si no existe estrategia.
10. **Esfuerzo estimado:** Medio
11. **Impacto esperado:** Alto
12. **Prioridad de implementación:** P0

### Hallazgo 4
1. **Título:** Inyección HTML/XSS potencial en texto de inferencia streameado
2. **Severidad:** Crítico
3. **Área afectada:** Local crítico, `seguridad + robustez UI`
4. **Archivo(s)/módulo(s)/función(es):**
   - `src/js/components/captioning-view.js:299-309`
5. **Evidencia concreta encontrada:**
   - `outputText.innerHTML = ... + streamedText` sin escape/sanitización.
   - `streamedText` viene directo del modelo (`runInference` callback).
6. **Causa raíz:** render textual con `innerHTML` en contenido no confiable.
7. **Por qué afecta rendimiento/estabilidad/mantenibilidad:** riesgo de ejecución de markup/script y corrupción del árbol DOM.
8. **Síntoma esperado en usuario real:** contenido inesperado, overlays/markup inyectado, potencial script execution.
9. **Mitigación concreta:** usar nodos con `textContent` para contenido dinámico, mantener `innerHTML` solo para plantillas internas estáticas.
10. **Esfuerzo estimado:** Bajo
11. **Impacto esperado:** Alto
12. **Prioridad de implementación:** P0

### Hallazgo 5
1. **Título:** Warmup mal acoplado y duplicado
2. **Severidad:** Alto
3. **Área afectada:** Sistémico, `performance de arranque + estabilidad de TTFFI`
4. **Archivo(s)/módulo(s)/función(es):**
   - `src/js/services/vision-language-service.js:96-99`, `112-148`, `204-206`
   - `src/js/components/loading-screen.js:167`
5. **Evidencia concreta encontrada:**
   - `loadModel()` ya llama `performWarmup()`.
   - `loading-screen` vuelve a llamar `performWarmup()`.
   - `_runInferenceCore` usa `video.videoWidth/videoHeight`; en warmup se pasa canvas (`warmupCanvas`) y no el `dummyVideo` creado.
6. **Causa raíz:** warmup sin interfaz explícita por tipo de fuente (video vs canvas) y secuencia duplicada.
7. **Por qué afecta rendimiento/estabilidad/mantenibilidad:** alarga startup, hace warmup poco determinista y erosiona métricas de “ready”.
8. **Síntoma esperado en usuario real:** loading más largo o errático; primera inferencia no siempre estabilizada.
9. **Mitigación concreta:** único warmup centralizado, con función dedicada para `CanvasImageSource` y validación de dimensiones.
10. **Esfuerzo estimado:** Medio
11. **Impacto esperado:** Alto
12. **Prioridad de implementación:** P1

### Hallazgo 6
1. **Título:** Detección WebGPU repetida y costosa
2. **Severidad:** Alto
3. **Área afectada:** Sistémico, `startup + runtime performance + DX`
4. **Archivo(s)/módulo(s)/función(es):**
   - `src/index.html:42-47`
   - `src/js/main.js:31-45`
   - `src/js/services/vision-language-service.js:45-56`
   - `src/js/components/diagnostics-panel.js:167-173`, `347-350`
   - `src/js/utils/constants.js:89` (`DEBUG: true`)
5. **Evidencia concreta encontrada:**
   - Detección se ejecuta en bootstrap HTML, bootstrap JS, carga de modelo y cada 2s en panel abierto.
   - Logging detallado de detector entra como errores/ruido en consola.
6. **Causa raíz:** ausencia de caché central de capacidades + detector con side effects verbosos por defecto.
7. **Por qué afecta rendimiento/estabilidad/mantenibilidad:** sobrecoste evitable y falsos positivos en pruebas (“console error” por logs de compatibilidad).
8. **Síntoma esperado en usuario real:** más latencia inicial, baterías más castigadas y consola saturada.
9. **Mitigación concreta:** cache singleton inmutable (`detectOnce`) y niveles de log por entorno; diagnostics consume snapshot, no redetecta.
10. **Esfuerzo estimado:** Bajo-Medio
11. **Impacto esperado:** Alto
12. **Prioridad de implementación:** P1

### Hallazgo 7
1. **Título:** Máquina de estados parcial: rutas muertas y side-effects fuera del modelo
2. **Severidad:** Alto
3. **Área afectada:** Arquitectónico, `robustez + mantenibilidad`
4. **Archivo(s)/módulo(s)/función(es):**
   - `src/js/main.js:69-83` (listener `transition`)
   - `src/js/utils/state-machine.js:247-292` (solo emite `statechange`)
   - `src/js/components/webcam-permission-dialog.js:151-183`
5. **Evidencia concreta encontrada:**
   - Se registra listener a evento `transition` que nunca se emite.
   - Limpieza de retry dependía de ese evento (nunca ocurre).
   - Error de permisos se maneja inline con UI y reload; no usa transición formal `PERMISSION_DENIED` esperada por `main`.
6. **Causa raíz:** separación incompleta entre orquestación de estado y lógica de componentes.
7. **Por qué afecta rendimiento/estabilidad/mantenibilidad:** estado formal pierde autoridad, aumentan estados implícitos y bugs de sincronización.
8. **Síntoma esperado en usuario real:** comportamientos inconsistentes en retry/error y rutas de recuperación impredecibles.
9. **Mitigación concreta:** definir “event contract” único, emitir transición formal y mover side-effects de componentes a acciones de máquina.
10. **Esfuerzo estimado:** Medio-Alto
11. **Impacto esperado:** Alto
12. **Prioridad de implementación:** P1

### Hallazgo 8
1. **Título:** Fugas de timers/listeners en vistas y overlays
2. **Severidad:** Alto
3. **Área afectada:** Sistémico, `performance + estabilidad largas sesiones`
4. **Archivo(s)/módulo(s)/función(es):**
   - `src/js/components/welcome-screen.js:120-165` (interval/timeouts sin cleanup)
   - `src/js/components/url-display.js:171-177` (keydown no se libera en cierres no-Escape)
   - `src/js/components/captioning-view.js:294-296` (timer no limpiado explícitamente en cleanup)
5. **Evidencia concreta encontrada:**
   - `createWelcomeScreen` no expone `cleanup` pese a timers activos.
   - En `url-display`, `document.addEventListener('keydown', handleEscape)` solo remueve en tecla Escape, no al cancelar/abrir con botón.
6. **Causa raíz:** lifecycle incompleto en componentes que crean side effects globales.
7. **Por qué afecta rendimiento/estabilidad/mantenibilidad:** acumulación progresiva de handlers/timers y comportamiento fantasma tras navegación interna.
8. **Síntoma esperado en usuario real:** degradación de fluidez tras uso prolongado, acciones duplicadas, consumo extra de CPU.
9. **Mitigación concreta:** política obligatoria de `cleanup()` en todo componente con timer/listener global.
10. **Esfuerzo estimado:** Bajo-Medio
11. **Impacto esperado:** Medio-Alto
12. **Prioridad de implementación:** P1

### Hallazgo 9
1. **Título:** E2E desalineado con la UI real y cobertura crítica insuficiente
2. **Severidad:** Alto
3. **Área afectada:** Sistémico, `DX + riesgo de regresión`
4. **Archivo(s)/módulo(s)/función(es):**
   - `tests/e2e/app.spec.js:23-33`, `177-196`, y múltiples tests condicionales
5. **Evidencia concreta encontrada:**
   - Fallo real reproducido: espera `.welcome-screen` que no existe (UI usa `aw-*` classes).
   - Fallo real reproducido: “no console errors” falla por 32 entradas de detector WebGPU.
   - Varios tests hacen `if (isVisible) { ... }` y no fallan si el flujo principal no aparece.
6. **Causa raíz:** pruebas acopladas a clases antiguas y aserciones laxas.
7. **Por qué afecta rendimiento/estabilidad/mantenibilidad:** el pipeline no protege flujo crítico; se cuelan regresiones funcionales graves.
8. **Síntoma esperado en usuario real:** bugs en runtime no detectados antes de demo/producción.
9. **Mitigación concreta:** migrar a `data-testid` + rutas determinísticas con mocks de media/WebGPU + asserts obligatorios por estado.
10. **Esfuerzo estimado:** Medio
11. **Impacto esperado:** Alto
12. **Prioridad de implementación:** P1

### Hallazgo 10
1. **Título:** Diagnósticos con métricas inexactas/no accionables
2. **Severidad:** Medio
3. **Área afectada:** Local-sistémico, `observabilidad + performance engineering`
4. **Archivo(s)/módulo(s)/función(es):**
   - `src/js/components/diagnostics-panel.js:194-198`, `282-302`
   - `src/js/utils/webgpu-detector.js:126-132`
5. **Evidencia concreta encontrada:**
   - Detector formatea límites como string (`"2.0 GB"`), panel intenta dividir como número (`/1024/1024`) y puede mostrar `NaN MB`.
   - Memoria estimada hardcoded `~2000 MB`; tokens/s asume 50 tokens siempre.
6. **Causa raíz:** mezcla de telemetría real con aproximaciones estáticas sin etiqueta de calidad.
7. **Por qué afecta rendimiento/estabilidad/mantenibilidad:** decisiones de tuning se apoyan en señales incorrectas.
8. **Síntoma esperado en usuario real:** panel “bonito” pero engañoso para debugging real.
9. **Mitigación concreta:** separar métricas medidas vs estimadas y reportar intervalos de confianza/`n` de muestras.
10. **Esfuerzo estimado:** Bajo-Medio
11. **Impacto esperado:** Medio
12. **Prioridad de implementación:** P2

### Hallazgo 11
1. **Título:** Tooling de calidad incompleto (lint roto, tipado casi desactivado)
2. **Severidad:** Medio
3. **Área afectada:** Sistémico, `DX + mantenibilidad`
4. **Archivo(s)/módulo(s)/función(es):**
   - `package.json:14` (`npm run lint`)
   - `tsconfig.json` (`checkJs:false`, `strict:false`, etc.)
5. **Evidencia concreta encontrada:**
   - `npm run lint` falla por ausencia de configuración ESLint.
   - `type-check` pasa, pero con `checkJs` desactivado no valida `src/**/*.js` en serio.
6. **Causa raíz:** scripts definidos sin política mínima de enforcement.
7. **Por qué afecta rendimiento/estabilidad/mantenibilidad:** errores de contrato y API llegan a runtime en vez de fallar en CI.
8. **Síntoma esperado en usuario real:** regresiones evitables reaparecen tras cambios menores.
9. **Mitigación concreta:** baseline lint + checkJs incremental en módulos críticos (pipeline y state machine primero).
10. **Esfuerzo estimado:** Bajo-Medio
11. **Impacto esperado:** Medio-Alto
12. **Prioridad de implementación:** P2

### Hallazgo 12
1. **Título:** Sobrecoste de composición/render en móvil (ASCII + blur + updates por token)
2. **Severidad:** Medio
3. **Área afectada:** Sistémico, `performance + UX técnica`
4. **Archivo(s)/módulo(s)/función(es):**
   - `src/js/components/ascii-background.js:44-75`, `90`
   - `src/js/services/vision-language-service.js:239-245`
   - `src/js/components/captioning-view.js:355-365` y `308`
   - `src/styles/components.css` (`backdrop-filter` masivo en runtime) y `src/styles/main.css:938-960`
5. **Evidencia concreta encontrada:**
   - Render ASCII hace `drawImage + getImageData` a 10 FPS en paralelo al pipeline de inferencia.
   - Overlay runtime usa múltiples capas con `backdrop-filter` y blur alto.
   - UI se actualiza en cada token streameado vía `innerHTML`.
6. **Causa raíz:** falta de budget explícito de frame y políticas de calidad por tier de dispositivo.
7. **Por qué afecta rendimiento/estabilidad/mantenibilidad:** incremento de costo por frame, peor batería/térmicas y menor fluidez percibida.
8. **Síntoma esperado en usuario real:** jank, calentamiento, caída de autonomía en móvil.
9. **Mitigación concreta:** modo “lite” automático por tier (sin ASCII, blur reducido, stream UI throttled a 60-100ms).
10. **Esfuerzo estimado:** Medio
11. **Impacto esperado:** Medio-Alto
12. **Prioridad de implementación:** P2

### Hallazgo 13
1. **Título:** Deriva arquitectónica por módulos no integrados
2. **Severidad:** Bajo
3. **Área afectada:** Sistémico, `mantenibilidad + claridad`
4. **Archivo(s)/módulo(s)/función(es):**
   - No referenciados en runtime principal: `live-caption.js`, `prompt-input.js`, `freeze-frame.js`, `webcam-capture.js`, `caption-history.js`, `draggable-container.js`
5. **Evidencia concreta encontrada:** búsqueda de imports en `src/js` sin referencias a esos módulos.
6. **Causa raíz:** iteración de UI sin consolidación/retiro de piezas antiguas.
7. **Por qué afecta rendimiento/estabilidad/mantenibilidad:** aumenta superficie mental y riesgo de aplicar fixes en código muerto.
8. **Síntoma esperado en usuario real:** indirecto (deuda de mantenimiento y mayor probabilidad de regresiones).
9. **Mitigación concreta:** declarar oficialmente qué módulos están activos y retirar/aislar legado.
10. **Esfuerzo estimado:** Medio
11. **Impacto esperado:** Medio
12. **Prioridad de implementación:** P3

## Diffs/snippets concretos recomendados (P0/P1)

### Diff 1 — Unificar contrato de `createElement`
```diff
--- a/src/js/utils/dom-helpers.js
+++ b/src/js/utils/dom-helpers.js
@@
 export function createElement(tag, options = {}) {
   const element = document.createElement(tag);
@@
-  if (options.text) {
-    element.textContent = options.text;
-  }
+  // Compatibilidad controlada: aceptar text/textContent
+  const text = options.text ?? options.textContent;
+  if (text !== undefined && text !== null) element.textContent = String(text);
@@
-  if (options.html) {
-    element.innerHTML = options.html;
-  }
+  const html = options.html ?? options.innerHTML;
+  if (html !== undefined && html !== null) element.innerHTML = String(html);
@@
+  // Soporte de atributos directos comunes
+  if (options.type) element.setAttribute('type', options.type);
+  if (options.accept) element.setAttribute('accept', options.accept);
 }
```

### Diff 2 — Arreglar fallback WebGPU con fuente única de verdad
```diff
--- a/src/js/main.js
+++ b/src/js/main.js
@@
-const stateMachine = new StateMachine({ hasWebGPU: true, ... });
+const stateMachine = new StateMachine({ hasWebGPU: false, ... });
@@
 (async () => {
   const gpuInfo = await webgpuDetector.detect();
-  hasWebGPU = gpuInfo.supported;
+  hasWebGPU = gpuInfo.supported;
+  stateMachine.setState({ hasWebGPU: gpuInfo.supported });
 })();
@@
- if (hasWebGPU) stateMachine.dispatch('START');
- else stateMachine.dispatch('START_FALLBACK');
+ stateMachine.dispatch(stateMachine.state.hasWebGPU ? 'START' : 'START_FALLBACK');
```

### Diff 3 — Reparar contrato de recuperación de stream
```diff
--- a/src/js/services/webcam-service.js
+++ b/src/js/services/webcam-service.js
@@
- onStreamEndedCallback('Camera reconnected');
+ onStreamEndedCallback({ type: 'recovered', stream });
@@
- onStreamEndedCallback('Camera disconnected and auto-recovery failed');
+ onStreamEndedCallback({ type: 'ended', reason: 'Camera disconnected and auto-recovery failed' });
```

```diff
--- a/src/js/main.js
+++ b/src/js/main.js
@@
-onStreamEnded((errorMessage) => {
-  stateMachine.dispatch('STREAM_ENDED', { reason: errorMessage || '...' });
-});
+onStreamEnded((event) => {
+  if (event?.type === 'recovered' && event.stream) {
+    stateMachine.dispatch('STREAM_RECOVERED', { stream: event.stream });
+    return;
+  }
+  stateMachine.dispatch('STREAM_ENDED', { reason: event?.reason || '...' });
+});
```

### Diff 4 — Quitar `innerHTML` para texto del modelo
```diff
--- a/src/js/components/captioning-view.js
+++ b/src/js/components/captioning-view.js
@@
- outputText.innerHTML = html + (streamingText ? '<span class="rt-streaming">' + streamingText + '</span>' : '');
+ outputText.innerHTML = html;
+ if (streamingText) {
+   const span = document.createElement('span');
+   span.className = 'rt-streaming';
+   span.textContent = streamingText;
+   outputText.appendChild(span);
+ }
```

## D. Quick wins (alto ROI)

### < 30 minutos
- Corregir `createElement` para aceptar `textContent/innerHTML` y atributos directos `type/accept`.
- Cambiar `MODEL_CONFIG.DEBUG` a `false` por defecto (`src/js/utils/constants.js`).
- Dejar una sola detección WebGPU en bootstrap JS (eliminar una de `index.html` o `main.js`).
- Escapar/sanitizar texto de streaming (eliminar `innerHTML` con texto dinámico).

### < 2 horas
- Implementar contrato de recuperación (`ended/recovered`) y despachar `STREAM_RECOVERED`.
- Corregir guardias de fallback (`hasWebGPU`) con fuente única de verdad en state machine.
- Añadir `cleanup()` al welcome screen para limpiar interval/timeouts al desmontar.
- Reparar tests E2E rotos por selectores (`.welcome-screen` -> selector real), y quitar tests “if visible then assert”.

### < 1 día
- Unificar warmup (una sola ejecución, fuente de imagen válida y métricas de warmup).
- Aplicar modo de calidad runtime por tier: desactivar ASCII + reducir blur en móvil bajo.
- Instrumentar métricas reales de startup/TTFFI/cadencia con `performance.mark/measure`.
- Agregar configuración mínima de ESLint y activarlo en CI.

## E. Refactors de mediano plazo
- **Orquestador único de runtime:** separar UI shell, media pipeline e inferencia con interfaces explícitas.
- **State machine formal tipada:** eventos con payload discriminado, sin side-effects externos al modelo.
- **Pipeline de imagen desacoplado:** `VideoFrame/OffscreenCanvas` cuando esté disponible y degradación por capacidades.
- **Control adaptativo de calidad (QoS):** adaptar resolución, efectos visuales y frecuencia de actualización según latencia/temperatura.
- **Arquitectura de testing confiable:** harness con media mock + webgpu mock + fault injection (stream loss, model init fail, timeout).

## F. Riesgos de regresión al aplicar mejoras
- Cambios en permisos/cámara pueden afectar Safari/iOS si se altera el timing de `getUserMedia`.
- Sanitización de salida puede modificar formato visual esperado en streaming.
- Consolidar detección WebGPU puede romper flujos que dependían del side-effect de logs/errores.
- Refactor de recuperación de stream puede introducir listeners duplicados si no se limpia bien el stream previo.
- Reducir efectos visuales puede cambiar percepción de branding si no se define fallback de diseño.

## G. Plan de medición antes/después (exacto)

### Métricas a medir
- `startup_time_ms`: desde `navigationStart` hasta primer render estable de pantalla inicial.
- `ttffi_ms` (time to first inference): desde click en “Launch Runtime” hasta primera respuesta no vacía en runtime.
- `inference_cadence_ms`: intervalo entre finalizaciones de inferencia (`p50`, `p95`, `jitter`).
- `dropped_frames_ratio`: `dropped / presented` durante runtime activo.
- `main_thread_blocking_ms`: suma y cuenta de Long Tasks (`>50ms`) por minuto.
- `memory_mb`: heap JS + (si disponible) `measureUserAgentSpecificMemory` + buffers de canvas estimados.
- `stream_stability`: cantidad de `track ended`, tasa de recuperación, `mean_time_to_recover_ms`.
- `error_recovery_success_rate`: sesiones que se recuperan sin recarga de página tras fallo inyectado.

### Instrumentación mínima recomendada
- Añadir `performance.mark` en:
  - `app_boot_start`
  - `welcome_rendered`
  - `launch_clicked`
  - `model_load_start/end`
  - `warmup_start/end`
  - `runtime_entered`
  - `first_inference_start/end`
- Emitir eventos estructurados a un buffer en memoria (`window.__VLR_METRICS__`):
```json
{
  "ts": 0,
  "event": "inference_end",
  "duration_ms": 0,
  "frame_w": 0,
  "frame_h": 0,
  "tokens": 0,
  "prompt_len": 0
}
```
- Usar `PerformanceObserver` para `longtask` y `event` timings.
- En cámara, registrar `track.ended`, `devicechange`, `recover_attempt`, `recover_success`, `recover_fail` con timestamps.

### Escenarios de medición (antes/después)
- Desktop Chrome con WebGPU.
- Android Chrome (gama media) con WebGPU.
- Escenario de fallo: revocar cámara en runtime y medir recuperación sin reload.
- Escenario de estrés UI: diagnostics abierto + runtime 5 min continuo.

### Criterios de mejora esperados
- Reducir `ttffi_ms` al menos 15-25% tras unificar warmup/detección.
- Reducir `longtask_count/min` al menos 30% en móvil al activar modo lite.
- Alcanzar `error_recovery_success_rate >= 95%` en pérdida transitoria de stream.

## 1. Qué arreglaría primero
1. Corregir contrato `createElement` y reparar consumidores críticos (`error-screen`, `image-upload`, overlays).
2. Arreglar fallback WebGPU con estado único y transiciones válidas.
3. Reparar recuperación de stream (`STREAM_RECOVERED` real + `RETRY_STREAM` coherente).
4. Eliminar `innerHTML` con texto streameado (hardening XSS).
5. Unificar warmup y remover detección WebGPU redundante.

## 2. Qué NO tocaría todavía
- Reescritura completa de UI/estética `aw-*` y `rt-*`.
- Migración total a framework (React/Vue/etc.) sin estabilizar primero el core runtime.
- Optimizaciones micro de CSS no ligadas a cuellos reales del pipeline.
- Cambios de modelo (`MODEL_ID`) antes de tener métricas comparables.

## 3. Ruta recomendada de mejora

### Fase 1: estabilización
- Corregir P0 (contrato DOM, fallback WebGPU, recuperación stream, XSS).
- Alinear state machine con eventos reales del runtime.
- Reparar tests E2E mínimos de flujo crítico.

### Fase 2: rendimiento
- Unificar warmup y detección de capacidades.
- Introducir QoS runtime (lite mode móvil/bajo tier).
- Reducir frecuencia de updates UI durante streaming.

### Fase 3: arquitectura
- Separar orquestador runtime/media/inferencia.
- Definir contratos tipados de eventos/payloads.
- Limpiar módulos no utilizados y deuda de rutas muertas.

### Fase 4: endurecimiento para producción
- Observabilidad real (métricas confiables + umbrales).
- CI de calidad (lint, type-check efectivo, e2e determinista multi-entorno).
- Ensayos de resiliencia con fault injection (permisos, stream loss, carga fallida).

---

## Hallazgos no verificables con evidencia local (declaración explícita)
- No se obtuvieron números reales de consumo CPU/GPU/RAM en dispositivo físico con cámara real en esta auditoría.
- No se validó degradación térmica/batería en sesiones móviles largas con hardware real.
- No se ejecutó benchmarking de TTFFI end-to-end con inferencia real porque depende de WebGPU y cámara del entorno final.
