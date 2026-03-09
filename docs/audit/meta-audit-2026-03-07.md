# Meta-Auditoría — Revisión Crítica de la Auditoría Codex

**Repositorio auditado:** `Vision-Language-Runtime` (workspace local completo)  
**Auditoría original por:** deepdedevjose (`docs/audit/runtime-audit-2026-03-07.md`)  
**Meta-auditoría por:** deepdedevjose (Principal Software Architect + Performance Engineer)  
**Fecha:** 2026-03-07  
**Método:** Lectura y análisis independiente de los **32 archivos fuente** del workspace, verificación de cada hallazgo de Codex contra código real, y búsqueda de problemas no identificados.

---

## Archivos Analizados (32/32)

| Capa | Archivos |
|------|----------|
| **Entrada** | `index.html` |
| **Core** | `main.js`, `state-machine.js`, `state-manager.js`, `types.js` |
| **Utils** | `dom-helpers.js`, `constants.js`, `logger.js`, `webgpu-detector.js`, `url-sanitizer.js` |
| **Servicios** | `webcam-service.js`, `vision-language-service.js` |
| **Componentes** | `welcome-screen.js`, `webcam-permission-dialog.js`, `loading-screen.js`, `captioning-view.js`, `image-upload.js`, `error-screen.js`, `ascii-background.js`, `diagnostics-panel.js`, `url-display.js`, `live-caption.js`, `prompt-input.js`, `caption-history.js`, `freeze-frame.js`, `webcam-capture.js`, `glass-container.js`, `glass-button.js`, `draggable-container.js`, `huggingface-icon.js` |
| **Tests** | `tests/e2e/app.spec.js` |
| **Estilos** | `styles/main.css`, `styles/components.css` |

---

## A. Evaluación General de la Auditoría Codex

### Calificación: 7.5/10

### Fortalezas
1. **Evidencia basada en código real.** Cada hallazgo cita archivo, función y líneas. Infrecuente y valioso.
2. **Diffs concretos** — 4 parches aplicables, no solo sugerencias abstractas.
3. **Priorización coherente** — P0/P1/P2/P3 refleja impacto real.
4. **Declaración honesta de no-verificables** — sección final reconoce limitaciones.

### Debilidades
1. **Cobertura parcial (~50% del workspace)** — Solo analizó ~16 de 32 archivos. No tocó: `live-caption.js`, `prompt-input.js`, `webcam-capture.js`, `freeze-frame.js`, `caption-history.js`, `url-sanitizer.js`, `state-manager.js`, `logger.js`, `glass-*.js`, `types.js`, CSS.
2. **Severidades infladas** — 2 hallazgos marcados como "Crítico" que son realmente "Alto".
3. **Diagnóstico incorrecto en warmup** — dice que se ejecuta dos veces, pero tiene guard.
4. **No reproduce flujos end-to-end** — analiza piezas aisladas sin verificar secuenciación temporal.
5. **Sección de métricas aspiracional** — propone instrumentar pero no da código integrable.

---

## B. Validación de los 13 Hallazgos de Codex

### Hallazgo 1: Contrato `createElement` inconsistente
| Aspecto | Evaluación |
|---------|------------|
| ¿Correcto? | ✅ Sí |
| ¿Severidad correcta? | ⚠️ Inflada — dice Crítico, es **Alto** |

**Verificación:** `createElement()` (dom-helpers.js:4-43) solo soporta `text`, `html`, `className`, `id`, `attributes`, `style`, `children`. Consumidores como `image-upload.js:73-77` pasan `{ type: 'file', accept: 'image/*' }` que se ignoran. En `main.js:301-306`, se usan `textContent` que tampoco es soportado — el texto no aparecerá.

**¿Por qué no es Crítico?** No produce crash ni error en consola. El input se renderiza como `<input>` genérico (sin `type=file`). Es UI degradada, no fallo bloqueante.

**Mitigación Codex:** Aceptar aliases `textContent`/`innerHTML` + atributos directos. ✅ Razonable.  
**Mejor alternativa:** Refactorizar con whitelist de DOM properties + fallback a `setAttribute`:
```js
const DOM_PROPS = new Set(['textContent', 'innerHTML', 'value', 'checked', 'disabled']);
// key in DOM_PROPS → el[key] = val
// else → el.setAttribute(key, val)
```

---

### Hallazgo 2: Fallback WebGPU por estado desincronizado
| Aspecto | Evaluación |
|---------|------------|
| ¿Correcto? | ✅ Sí — confirmado en código |
| ¿Severidad correcta? | ✅ Correcto (Crítico) |

**Verificación:** 
- `main.js:30`: `let hasWebGPU = false`
- `main.js:57`: `StateMachine({ hasWebGPU: true })` — **siempre true**
- `state-machine.js:109`: guard `START` = `() => this.state.hasWebGPU` (siempre true)
- `state-machine.js:115`: guard `START_FALLBACK` = `() => !this.state.hasWebGPU` (siempre false)

**Impacto:** `START_FALLBACK` **siempre falla su guard**, incluso cuando `main.js` despacha el evento correctamente. Doble fallo.

**Mitigación Codex:** Inicializar `hasWebGPU: false` + `setState()`. ✅ Correcto.  
**Mejor alternativa:** Agregar estado explícito `detecting_gpu` antes de `welcome` para eliminar race condition.

---

### Hallazgo 3: Recuperación de stream rota
| Aspecto | Evaluación |
|---------|------------|
| ¿Correcto? | ✅ Sí |
| ¿Severidad correcta? | ✅ Correcto (Crítico) |

**Verificación:**
- `webcam-service.js:268-270`: callback recibe string plano (`'Camera reconnected'` o `'Camera disconnected...'`), sin discriminar tipo.
- `main.js:380-383`: siempre despacha `STREAM_ENDED` — no diferencia recovery de pérdida.
- `state-machine.js:175`: handler de `STREAM_ENDED` crea recover action que despacha `RETRY_STREAM`.
- **`RETRY_STREAM` NO EXISTE como evento definido** en la tabla de transiciones → botón "Reconnect" no hace nada.
- `state-machine.js:181`: `STREAM_RECOVERED` existe pero **nunca se despacha** desde ningún sitio.

**Impacto:** Si cámara se desconecta, el usuario ve un botón "Reconnect" que es **decorativo**.  
**Mitigación Codex:** Callback tipado con discriminante. ✅ Correcto. Pero falta: agregar `RETRY_STREAM` como transición válida.

---

### Hallazgo 4: XSS en texto streameado
| Aspecto | Evaluación |
|---------|------------|
| ¿Correcto? | ⚠️ Parcialmente |
| ¿Severidad correcta? | ⚠️ Inflada — dice Crítico, es **Alto** |

**Verificación:** `captioning-view.js:308` usa `innerHTML` para insertar `streamingText` del modelo. El texto viene de modelo de IA local (no hay atacante remoto).

**¿Por qué no es XSS Crítico?** No hay vector de ataque remoto. El modelo ejecuta localmente. No hay input de otros usuarios. El riesgo real es **corrupción de DOM** por tokens mal formados (`<`, `>`), no inyección de scripts maliciosos.

**Mitigación (`textContent`):** ✅ Correcta por higiene, pero la motivación de "seguridad" es sobre-dramatizada.

---

### Hallazgo 5: Warmup duplicado
| Aspecto | Evaluación |
|---------|------------|
| ¿Correcto? | ⚠️ **Diagnóstico incorrecto** |
| ¿Severidad correcta? | N/A — el bug real es diferente |

**Verificación:** `performWarmup()` tiene guard: `if (this.warmedUp) return;` (vision-language-service.js:113). La segunda llamada desde `loading-screen.js:167` es un **no-op**. **No se ejecuta dos veces.** La auditoría dice "alarga startup" lo cual es **falso**.

**El bug REAL (no detectado por Codex):** `performWarmup()` pasa `warmupCanvas` (un `<canvas>`) a `_runInferenceCore()`, que lee `video.videoWidth`/`video.videoHeight`. Un canvas no tiene `.videoWidth` → es `undefined` → dimensiones inválidas → warmup falla silenciosamente.

**Mitigación Codex:** Unificar warmup. ✅ Parcialmente correcta.  
**Fix real:** `const w = video.videoWidth || video.width || 320;`

---

### Hallazgo 6: Detección WebGPU repetida
| Aspecto | Evaluación |
|---------|------------|
| ¿Correcto? | ✅ Sí — 4 puntos de llamada confirmados |
| ¿Severidad correcta? | ⚠️ Inflada — dice Alto, es **Medio** |

**Verificación:** Llamadas en: `index.html:45`, `main.js:33`, `vision-language-service.js:47`, `diagnostics-panel.js:171` (cada 2s).

**¿Por qué Medio?** `requestAdapter()` es cacheado internamente por el browser. El costo real es console I/O (~20 líneas de log × 4 veces). No es costo GPU.

---

### Hallazgo 7: Máquina de estados parcial
| Aspecto | Evaluación |
|---------|------------|
| ¿Correcto? | ✅ Sí |
| ¿Severidad correcta? | ✅ Correcto (Alto) |

**Verificación:**
- `main.js:69`: registra listener `'transition'` pero StateMachine solo emite `'statechange'` → **evento fantasma, handler nunca se ejecuta**. El cleanup de líneas 72-82 es código muerto.
- `webcam-permission-dialog.js:175`: hace `window.location.reload()` directamente → **bypasses la SM completamente**.

---

### Hallazgo 8: Fugas de timers/listeners — ✅ Correcto
- `welcome-screen.js:124`: `setInterval` sin cleanup. La función retorna un `HTMLElement` sin método `cleanup`.
- `url-display.js:177`: `handleEscape` se añade al `document` pero solo se remueve dentro del handler.

### Hallazgo 9: E2E desalineado — ✅ Correcto
- `app.spec.js:27`: busca `.welcome-screen` pero el componente usa `.aw-wrapper`.
- Tests como líneas 92-106 solo hacen `console.log` sin asserts.

### Hallazgo 10: Diagnósticos inexactos — ✅ Correcto
- `diagnostics-panel.js:194`: divide un **string formateado** ("2.0 GB") entre 1024² → `NaN`.
- Hardcoded: 50 tokens/inferencia (L283), ~2000 MB RAM (L298).

### Hallazgo 11: Tooling incompleto — ✅ Correcto
- `constants.js:87`: `DEBUG: true` hardcoded.

### Hallazgo 12: Sobrecoste render — ✅ Correcto
### Hallazgo 13: Módulos no integrados — ✅ Correcto

---

## C. Problemas Adicionales Detectados (No en Auditoría Codex)

### C1. `webcam-permission-dialog` ignora callback de error — **Severidad: Alto**
`createWebcamPermissionDialog(onPermissionGranted)` acepta **solo 1 parámetro** (línea 8). `main.js:224-231` pasa un segundo callback de error que **nunca es invocado**. Cuando falla, el dialog maneja el error internamente con `window.location.reload()` (línea 175), bypaseando la state machine.

**Impacto:** El flujo `PERMISSION_DENIED` (state-machine.js:87-101) **nunca se ejecuta**. El error screen formal nunca se muestra por este camino.

### C2. Race condition: detección GPU async vs interacción de usuario — **Severidad: Alto**
`main.js:31-45`: detección async en IIFE sin `await`. El welcome screen y botones "Launch Runtime" se renderizan inmediatamente. Si el usuario hace click antes de que detecte GPU, `hasWebGPU` es `false` (valor por defecto) y se despacha `START_FALLBACK` que además falla por el guard desincronizado.

### C3. Warmup con dimensiones `undefined` — **Severidad: Alto**
`performWarmup()` pasa `warmupCanvas` a `_runInferenceCore()`. Éste lee `video.videoWidth` (undefined en canvas) → canvas se redimensiona a `0×0` o `NaN` → `drawImage` falla silenciosamente → warmup no ejecuta inferencia real.

### C4. Presión de GC por copias de píxeles — **Severidad: Alto**
Cada ciclo de inferencia: `getImageData(640×480×4 ≈ 1.2MB)` + `RawImage` wrapper. A 3s cadencia = ~400KB/s en buffers transitorios. ASCII background suma ~280KB/s adicional (`getImageData` a 10 FPS). En móvil = jank periódico por GC.

### C5. `state-manager.js` es un módulo arquitectónico muerto — **Severidad: Medio**
`state-manager.js` define clase `StateManager` separada de `state-machine.js`. **No es importado por ningún archivo.** Es un vestigio de una arquitectura anterior. Confunde la estructura del proyecto.

### C6. `webcam-capture.js` appends elemento directo a `document.body` — **Severidad: Medio**
`webcam-capture.js:66`: en móvil, `document.body.appendChild(processingPill)` con posición fixed hardcoded. El `cleanup()` (L112-115) lo remueve, pero si cleanup no se llama, el pill persiste como nodo huérfano.

### C7. `live-caption.js` ejecuta regex costosa en hot path — **Severidad: Medio**
`live-caption.js:213`: `processTextWithURLs(caption)` se llama en cada `updateCaption()`. Internamente, `detectURLs()` ejecuta 2 regex con `g` flag + set deduplication en cada update. En streaming mode con updates cada ~50ms, esto es procesamiento regex innecesario.

### C8. `prompt-input.js` registra listener global permanente — **Severidad: Medio**
`prompt-input.js:221`: `window.addEventListener('togglePrompt', ...)` nunca se remueve. Si el componente se re-creado (por cambio de viewState), acumula listeners duplicados.

### C9. `caption-history.js` usa `innerHTML = ''` para limpieza — **Severidad: Bajo**
`caption-history.js:76`: `listContainer.innerHTML = ''` es más lento que iterar `removeChild` y no invoca cleanup de handlers de los nodos hijos.

### C10. `logger.js` borra contexto de debugging con `console.clear()` — **Severidad: Bajo**
`logger.js:186`: `Logger.clear()` llama `console.clear()`, borrando todo el historial de debugging del browser cuando el usuario exporta/limpia logs. Problemático durante desarrollo.

### C11. `types.js` define `AppState` diferente a `state-machine.js` — **Severidad: Bajo**
`types.js:77`: define `AppState.status = 'loading' | 'ready' | 'error' | 'inference'`. Pero `state-machine.js:4-6` usa `ViewState = 'permission' | 'welcome' | 'loading' | 'runtime' | 'error' | 'image-upload'`. Los tipos JSDoc divergen del runtime real.

### C12. `url-sanitizer.js` tiene riesgo de ReDoS — **Severidad: Bajo**
`url-sanitizer.js:13-16`: regex con grupos cuantificados anidados (`[-a-zA-Z0-9@:%._\+~#=]{1,256}`) podría causar catastrophic backtracking con inputs maliciosos.

### C13. `clearChildren(root)` causa full DOM teardown — **Severidad: Medio**
`main.js:335`: destruye y reconstruye TODO el DOM en cada cambio de viewState. Video element se re-appende, causando flash visual y potencial pérdida de estado de reproducción.

### C14. Múltiples `video.play()` sin coordinación — **Severidad: Bajo-Medio**
Al menos 5 llamadas a `video.play()` en `main.js` (L118, 124, 164, 170, 356). Cada una retorna Promise que puede rechazarse. Sin coordinación, dos `play()` concurrentes pueden competir.

---

## D. Top 5 Problemas Reales (por Impacto)

| # | Problema | Impacto | Fuentes |
|---|----------|---------|---------|
| 1 | **State machine desincronizada con flujos reales** — evento fantasma `transition`, `RETRY_STREAM` inexistente, permissions bypasses SM, WebGPU guard bloqueante | Usuario atrapado en estados sin salida. 100% de flujos de error afectados | H2, H3, H7, C1, C2 |
| 2 | **Warmup produce inferencia nula** — dimensiones `undefined` por canvas sin `.videoWidth` | "Pipeline ready" es mentira; primera inferencia inesperadamente lenta | H5, C3 |
| 3 | **Race condition GPU detection vs click** — botones habilitados antes de detección async | Flujo inválido si usuario clickea rápido | C2, H2 |
| 4 | **Presión GC por copias de píxeles** — `getImageData` en inferencia + ASCII, sin reutilización | Jank periódico en móvil, degradación térmica | C4, H12 |
| 5 | **`createElement` contrato roto** — `textContent`, `type`, `accept` ignorados | UI incompleta en fallback paths | H1 |

---

## E. Qué Arreglaría Primero

### 1. Unificar state machine como única fuente de verdad (~4-6 hrs)
- Eliminar `hasWebGPU` variable local — usar solo `stateMachine.state`
- Inicializar `hasWebGPU: false` + `setState()` tras detección
- Agregar `RETRY_STREAM` como transición válida
- Reemplazar evento `transition` por handler en `statechange`
- Pasar y usar callback de error en `webcam-permission-dialog`
- Desbloquea TODOS los flujos de error y recovery

### 2. Arreglar warmup para dimensiones reales (~30 min)
```js
const sourceWidth = video.videoWidth || video.width || 320;
const sourceHeight = video.videoHeight || video.height || 240;
```

### 3. Reparar contrato `createElement` (~1 hr)
### 4. `textContent` en vez de `innerHTML` para streaming (~20 min)
### 5. Cachear detección WebGPU + deshabilitar botón hasta resultado (~1 hr)

---

## F. Diferencias con Auditoría Codex

| Tema | Codex | Meta-Auditoría | Resolución |
|------|-------|----------------|------------|
| H1 severidad | Crítico | **Alto** | No crashea, degrada UI |
| H4 (XSS) | Crítico | **Alto** | No hay vector XSS real (ejecución local) |
| H5 (warmup) | "Duplica y alarga" | **No duplica** (tiene guard). Bug real: dimensiones undefined | Cambiar diagnóstico |
| H6 severidad | Alto | **Medio** | Costo real es I/O consola |
| Cobertura | ~50% archivos | **100% archivos** (32/32) | +14 hallazgos nuevos |
| `webcam-permission-dialog` | No mencionado | **Bug Alto** — bypasses SM | Agregar |
| Race condition GPU | No mencionado | **Bug Alto** | Agregar |
| GC pressure | No mencionado | **Medio-Alto** | Agregar |
| Módulo muerto `state-manager.js` | No mencionado | **Medio** | Agregar |
| Listeners globales sin cleanup | No mencionado | **Medio** | Agregar |

---

## G. Plan de Mitigación Priorizado

### Fase Inmediata (< 1 día)
| # | Fix | Esfuerzo | Archivo(s) |
|---|-----|----------|-----------|
| ✅ | Guard WebGPU: `hasWebGPU: false` + `setState()` | 30 min | `main.js`, `state-machine.js` |
| ✅ | Warmup: fallback `video.width || 320` | 30 min | `vision-language-service.js` |
| ✅ | `createElement` con whitelist DOM props | 1 hr | `dom-helpers.js` |
| ✅ | `textContent` para streaming text | 20 min | `captioning-view.js` |
| ✅ | Agregar `RETRY_STREAM` transición | 30 min | `state-machine.js` |
| ✅ | Cachear `webgpuDetector.detect()` | 30 min | `webgpu-detector.js` |
| ✅ | Callback de error en webcam-permission-dialog | 30 min | `webcam-permission-dialog.js`, `main.js` |
| ✅ | `DEBUG: false` en constants | 1 min | `constants.js` | h

### Fase Corta (< 3 días)
| # | Fix | Esfuerzo |
|---|-----|----------|
| ✅ | Cleanup en welcome-screen | Completado |
| ✅ | Arreglar E2E tests: selectores + asserts | Completado |
| ✅ | Deshabilitar Launch Runtime hasta detección GPU | Completado |
| ✅ | `requestAnimationFrame` en ASCII background | Completado |
| ✅ | Exponer valores numéricos en webgpu-detector | Completado |
| ✅ | Eliminar `state-manager.js` muerto | Completado |
| ✅ | Sincronizar tipos en `types.js` con `state-machine.js` | Completado |
| ✅ | Remover listener `togglePrompt` en cleanup | Completado |

### Fase Media (< 2 semanas)
| # | Fix | Esfuerzo |
|---|-----|----------|
| 17 | Refactorizar SM: contratos formales todos los eventos | 1 día |
| 18 | QoS tier: modo lite para móviles | 1 día |
| 19 | Pipeline imagen: reusar buffer `ImageData` | 1 día |
| ✅ | Instrumentar métricas con `performance.mark` | 1 día |
| ✅ | ESLint config + `checkJs` en módulos críticos | 4 hr |
| ✅ | Optimizar hot path: skip regex URL en streaming | 2 hr |
