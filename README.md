# ZONA CERO — Shooter 3D apocalíptico

Juego de disparos en **primera persona** hecho solo con **HTML + CSS + JavaScript** y la librería **three.js** para los objetos 3D.
Sin frameworks, sin build, sin dependencias que instalar.

**Objetivo: superar 3 oleadas** (una zona distinta cada una) y sobrevivir.

---

## Cómo ejecutarlo

### Opción A — Doble clic (directo)
Haz **doble clic en `index.html`**.
Funciona tal cual: los scripts son clásicos (no modules), todos los assets son
procedurales (texturas y sonidos se generan en código), así que no hay
problemas de CORS ni de servidor.

### Opción B — En localhost
Doble clic en **`JUGAR-LOCALHOST.bat`**. Arranca un servidor estático con
Python en `http://localhost:8080` y abre el juego en el navegador.

Manualmente equivalente:

```bash
python -m http.server 8080
# y abrir http://localhost:8080/index.html
```

> Si el puerto 8080 está ocupado, cambia el número por otro (ej. 8081).

---

## Controles

| Tecla / botón      | Acción                                    |
|--------------------|-------------------------------------------|
| `↑`                | Avanzar                                   |
| `↓`                | Retroceder                                |
| `←`                | Girar la cámara a la izquierda            |
| `→`                | Girar la cámara a la derecha              |
| **`ESPACIO`**      | Disparar                                  |
| `W A S D`          | Alternativa de movimiento (con derrape)   |
| **Clic izquierdo** | Disparar                                  |
| **Clic derecho**   | Disparar                                  |
| Ratón              | **Apuntar también**: cursor fijado o manteniendo el clic (modo arrastre) |
| **`F`**            | Disparar (teclado)                        |
| `Shift`            | Correr                                    |
| **`C`**            | Saltar                                    |
| `R`                | Recargar                                  |
| **`P` / `Esc`**    | Pausa («Esc» también suelta el ratón)     |

La mira se expande con el movimiento y el calor del arma. Disparos a la **cabeza**: daño x2.4.

---

## Qué pasa en el juego

- **3 oleadas con victoria final**: al superar la tercera, ganas la partida (pantalla de
  «¡HAS SOBREVIVIDO!» con estadísticas).
- **Cada oleada en una zona distinta**, con paleta, suelo y obstáculos propios:
  1. **Distrito en Ruinas** — naranja quemado, cajas y coberturas.
  2. **Complejo Industrial** — cian, contenedores y chimeneas.
  3. **Cráter Cero** — rojo infernal, basalto y cráteres humeantes (la zona final).
- 3 tipos de robot: **Droide MK-I** (equilibrado), **Acechador** (rápido),
  **Colosal** (blindado, muy dañino). Salen más Colosales cuantas más oleadas.
- Al morir sueltan **botiquines** y **munición** (suelen soltar más justo cuando estás
  escaso de vida o balas).
- Al terminar cada oleada: **salud al 100%**, bonus de puntos y +45 de munición.
- Récord de puntos guardado en el navegador (localStorage).

### Entorno
Arena cerrada en un mundo quemado, cielo con sol muerto, brasas flotando y niebla
coloreada — **recoloreada y rediseñada por zona** en cada oleada.

---

## Estructura

```
Juego/
├── index.html          interfaz, HUD y pantallas
├── css/style.css       estilos del HUD y menús
├── js/main.js          todo el motor del juego
├── lib/three.min.js    three.js r149 (local, sin CDN)
├── JUGAR-LOCALHOST.bat servidor local en un clic
└── README.md           este archivo
```

### Lo que implementa `js/main.js`
1. Escena, luces, sombras y mundo procedural (texturas dibujadas en canvas).
2. Sistema de partículas (impactos, chispas, explosiones) y trazadores.
3. Audio sintetizado con WebAudio (disparos, recargas, impactos, oleadas…).
4. Colisiones círculo-vs-AABB, salto y gravedad.
5. Arma en primera persona: retroceso, balanceo, fogonazo, recarga.
6. Enemigos robot con IA: persecución, esquiva de obstáculos, separación,
   ataques a corto distancia y animación de muerte.
7. Oleadas, puntuación, drops, HUD, menús y control del puntero.
8. Modo depuración: añade `?debug` a la URL para forzar la simulación
   (`ZC.step(dt, frames)`, `ZC.info()`, `ZC.aim()`, `ZC.shoot()`).

---

## Requisitos
Navegador con WebGL (Chrome, Edge, Firefox…). No necesita internet una vez
descargado three.js.
