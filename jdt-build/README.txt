JUEGO DE CARTAS JDT — ACTUALIZACIÓN DE INTERFAZ

Incluye:
- index.html, styles.css, app.js y firebase-config.js.
- Las 27 imágenes de cartas en assets/cartas/.
- Paneles individuales de jugadores y resaltado del turno.
- Cartas jugadas en columna bajo cada jugador.
- Historial cronológico persistido en el estado de la partida de Firebase.
- Animación de entrada de cartas y diseño adaptable a móvil.
- Ampliación de cartas con doble clic en la mano.
- Alternativa textual si la imagen no carga.

INSTALACIÓN
1. Descarga y descomprime el ZIP.
2. En tu repositorio, sustituye index.html, styles.css y app.js por los de esta carpeta.
3. Sustituye/añade assets/cartas con la carpeta incluida.
4. Conserva tu firebase-config.js actual si tiene la configuración Firebase que ya funciona. El archivo incluido es una copia de la configuración previa; no la cambies si ya funciona.
5. Haz commit y espera a que GitHub Pages publique los cambios.

IMPORTANTE SOBRE LAS REGLAS
La versión base del motor de juego solo implementa robar, jugar una carta y pasar el turno. No implementa los efectos de las cartas, comparaciones, eliminación de jugadores ni adjudicación de puntos. Por eso esta actualización registra de forma explícita la carta jugada y deja claro en el historial que su efecto no se ha resuelto automáticamente. No inventa ganadores ni puntuaciones. Para implementar resolución de comparaciones, puntuación y pantalla final real hay que integrar las reglas originales de cada carta en el motor compartido de Firebase.
