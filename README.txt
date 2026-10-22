JUEGO DE CARTAS JDT — VERSIÓN CON EFECTOS DE CARTAS

Contenido
- index.html: estructura de la aplicación.
- app.js: salas multijugador, turnos, efectos, eventos y puntuación.
- styles.css: estilos y estados visuales.
- firebase-config.js: configuración web de Firebase existente.
- firebase-rules.json: reglas de referencia, revisar antes de usar en público.
- assets/cartas/: ilustraciones originales.

Instalación
1. Descomprime el ZIP.
2. Sube los archivos y la carpeta assets a la raíz del repositorio de GitHub Pages.
3. Conserva tu configuración Firebase si difiere de la incluida.
4. Recarga con Ctrl+F5.

Cambios principales
- Carta 0: selecciona un objetivo; si ese jugador gana la ronda, quien jugó la carta obtiene un punto adicional.
- Carta 1: selecciona objetivo y valor para adivinar; si acierta, elimina al objetivo.
- Carta de valor 2: selecciona objetivo y muestra su carta en privado durante 3 segundos al jugador que la jugó. En el historial los demás no ven la carta revelada.
- Cartas de comparación: se elige objetivo y se muestra el resultado con las cartas comparadas.
- Carta 4: activa protección hasta el siguiente turno del jugador; el nombre muestra PROTEGIDO y no se puede elegir como objetivo.
- Carta 5: elige objetivo. Si tiene la otra carta de valor 5, el objetivo gana la ronda. En caso contrario descarta su carta; si era un 8, queda eliminado. El descarte se añade a la pila de cartas jugadas.
- Carta 6: elige a un jugador e intercambia las cartas que quedan en sus manos.
- Carta 9: elige un objetivo no protegido; un 8 no se ve afectado y Jon Nieve (ID 18) se descarta y roba una carta de reemplazo.
- Carta 0 deja una gota azul junto al objetivo seleccionado.
- Las notificaciones compartidas y de fin de ronda no se cierran automáticamente; cada jugador puede cerrarlas con la X.
- Las cartas jugadas se pueden pulsar para ver el resultado. La carta revelada por una carta de valor 2 solo se muestra al jugador que la miró.

Importante
La aplicación se ha validado mediante comprobación de sintaxis JavaScript, no mediante una partida real con varios navegadores conectados a Firebase. Las reglas exactas de algunas cartas deben contrastarse con el texto oficial de las ilustraciones. La estructura actual guarda estado de partida en Realtime Database y no constituye una protección fuerte contra jugadores maliciosos: no publiques la aplicación sin revisar las reglas de seguridad de Firebase y la gestión de información privada.

VERSIÓN v1.22
- Se muestra el número de versión en la esquina inferior derecha.
- El nombre de los jugadores eliminados aparece tachado durante el resto de la ronda.
- Si solo queda un jugador vivo, se declara ganador de la ronda y recibe un punto.
- Al comenzar una nueva ronda, se limpian las marcas de eliminación.
- Al alcanzar el objetivo de puntos, la partida queda finalizada y se deshabilitan las acciones de turno.


VERSIÓN v1.22
- La mano del jugador aparece antes que el panel de jugadores.
- El turno avanza automáticamente tras resolver la carta; el botón manual queda desactivado.
- Los objetivos y las adivinaciones se seleccionan mediante desplegables, con valores 0 y 2–9 para los unos.
- Se corrige el efecto de las cartas 5: si el objetivo descarta una carta distinta del otro 5, roba una de reemplazo; descartar un 8 elimina.
- Descartar voluntariamente el 8 elimina al jugador de la ronda.
- El catálogo de reglas muestra las 27 cartas y permite ampliarlas y navegar entre cartas.
- Se amplía la explicación de cómo se juega.
- Al finalizar la partida se muestra la clasificación y se destaca al ganador.
- Se añade el temporizador opcional de 120 segundos por turno, con pausa y reanudación compartidas en Firebase.

Validación: comprobación de sintaxis JavaScript con node --check. No se ha probado una partida real con varios navegadores conectados a Firebase; el temporizador y la sincronización deben probarse en la publicación real.


Cambios v1.22: ficha de carta accesible desde el catálogo de la pantalla inicial; avisos compartidos con la resolución detallada de cada carta y controles de cierre restaurados.
