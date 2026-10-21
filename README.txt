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


MEJORAS DE INTERFAZ (versión actualizada)
- Pantalla inicial renovada con accesos a Reglas y Cómo se juega.
- Tras robar, las cartas se pueden seleccionar para leer su descripción antes de confirmar con "Jugar esta carta".
- Aviso compartido de carta jugada, con cierre manual y desaparición automática a los 2 segundos.
- Al terminar el mazo, se compara el valor de las cartas que quedan en mano, se informa del ganador de ronda y se muestran las puntuaciones. La partida finaliza al alcanzar el objetivo.
- Los jugadores marcados en el estado compartido como protegidos aparecen en verde.

LIMITACIONES IMPORTANTES
- Las reglas de efectos individuales no están implementadas de forma completa en este prototipo. Las descripciones son orientativas y algunos textos de las cartas originales son ambiguos.
- Las animaciones de ataque con elección de número y las comparaciones específicas solo podrán mostrarse cuando esos efectos estén implementados y produzcan eventos de juego. Esta versión anuncia la carta jugada y muestra el resultado de ronda, pero no simula todavía todos los efectos especiales.
- No se ha podido probar una partida real con varios navegadores conectados a Firebase; se ha comprobado la sintaxis JavaScript.


CORRECCIÓN DE ERROR AL ROBAR/JUGAR (2026-10-21)
- Se normalizan los campos `manos`, `mazo`, `jugadas`, `historial`, `puntos` y `protegidos` antes de ejecutar acciones.
- Si el jugador activo no tiene una mano válida en una sala antigua, se recupera una carta inicial del mazo antes de robar.
- Se añade versión a las referencias CSS/JS para evitar que el navegador reutilice una copia en caché de `app.js`.
- El error anterior al leer `.push` era compatible con intentar añadir una carta a una mano no inicializada; la corrección cubre esa ruta y también normaliza el registro de cartas jugadas.
