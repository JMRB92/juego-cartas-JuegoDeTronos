
"use strict";

// ============================================================
// JUEGO DE CARTAS - JUEGO DE TRONOS
// Firebase Authentication + Realtime Database
// Creación de salas, entrada y lobby multijugador.
// ============================================================

// 1. CONFIGURACIÓN DE FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBLQJx8_PG6GJt-qMJGGZVqI4f1fQpRZzY",
  authDomain: "juego-cartas-jdt.firebaseapp.com",
  databaseURL: "https://juego-cartas-jdt-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "juego-cartas-jdt",
  storageBucket: "juego-cartas-jdt.firebasestorage.app",
  messagingSenderId: "1017793643872",
  appId: "1:1017793643872:web:a84810ffb3c13584510a05",
  measurementId: "G-Y75B2LGBDT"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.database();
const $ = id => document.getElementById(id);

// 2. ESTADO DE LA APLICACIÓN
let currentUser = null;
let currentCode = null;
let roomRef = null;
let roomListener = null;
let roomData = null;

// 3. PANTALLAS
const screens = [
  "pantalla-inicio",
  "pantalla-crear",
  "pantalla-unirse",
  "pantalla-lobby",
  "pantalla-juego"
];

function showScreen(id) {
  screens.forEach(screenId => {
    const element = $(screenId);
    if (element) {
      element.classList.toggle("hidden", screenId !== id);
      element.classList.toggle("pantalla-oculta", screenId !== id);
    }
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// 4. MENSAJES Y ESTADO DE CONEXIÓN
function status(text, kind = "") {
  const element = $("estado-conexion");
  if (!element) return;

  element.textContent = text;
  element.className = "status " + kind;
}

function message(text = "") {
  const element = $("mensaje-global");
  if (element) element.textContent = text;
}

function errorMessage(error, fallback) {
  if (error && error.code === "PERMISSION_DENIED") {
    return "Firebase ha denegado el acceso. Revisa las reglas de Realtime Database.";
  }

  if (error && error.code === "NETWORK_ERROR") {
    return "Error de conexión. Comprueba tu conexión a Internet.";
  }

  return error && error.message ? error.message : fallback;
}

// 5. UTILIDADES
function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

function updateDefaultPoints() {
  const playersInput = $("numero-jugadores");
  const pointsInput = $("puntos-objetivo");
  const explanation = $("explicacion-puntos");

  if (!playersInput || !pointsInput || !explanation) return;

  const numberOfPlayers = Number(playersInput.value);

  pointsInput.value = numberOfPlayers <= 4 ? 5 : 3;

  explanation.textContent = numberOfPlayers <= 4
    ? "Objetivo predeterminado: 5 puntos para 2–4 jugadores."
    : "Objetivo predeterminado: 3 puntos para 5–8 jugadores.";
}

function validateName(name) {
  if (!name) {
    throw new Error("Escribe tu nombre.");
  }

  if (name.length > 20) {
    throw new Error("El nombre no puede superar los 20 caracteres.");
  }
}

// 6. AUTENTICACIÓN ANÓNIMA
async function getUser() {
  if (auth.currentUser) {
    currentUser = auth.currentUser;
    return currentUser;
  }

  if (currentUser) return currentUser;

  const result = await auth.signInAnonymously();
  currentUser = result.user;

  return currentUser;
}

auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    status("Firebase conectado", "ok");
    console.log("Firebase conectado. UID:", user.uid);
  } else {
    currentUser = null;
    status("Conectando con Firebase…");
  }
});

auth.signInAnonymously().catch(error => {
  status("Error de conexión", "bad");

  console.error(
    "Error de autenticación Firebase:",
    error.code,
    error.message
  );

  message(
    "No se pudo iniciar sesión en Firebase: " + error.message
  );
});

// 7. GESTIÓN DE LA ESCUCHA DE UNA SALA
function detachRoom() {
  if (roomRef && roomListener) {
    roomRef.off("value", roomListener);
  }

  roomRef = null;
  roomListener = null;
}

function listenRoom(code) {
  detachRoom();

  currentCode = code;
  roomRef = db.ref("salas/" + code);

  roomListener = snapshot => {
    if (!snapshot.exists()) {
      message("La sala ya no existe o ha sido eliminada.");
      detachRoom();
      showScreen("pantalla-inicio");
      return;
    }

    roomData = snapshot.val();
    roomData.codigo = code;

    renderLobby();
  };

  roomRef.on(
    "value",
    roomListener,
    error => {
      console.error(
        "Error al leer la sala:",
        error.code,
        error.message
      );

      message("Error al leer la sala: " + error.message);
    }
  );
}

// 8. DIBUJAR EL LOBBY
function renderLobby() {
  if (!roomData) return;

  $("codigo-sala").textContent = roomData.codigo;

  const players = Object.values(roomData.jugadores || {});
  const list = $("lista-jugadores");

  list.replaceChildren();

  players.forEach(player => {
    const item = document.createElement("li");

    const name = document.createElement("span");
    name.textContent = player.nombre || "Jugador";
    item.appendChild(name);

    if (player.uid === roomData.creadorUid) {
      const tag = document.createElement("span");
      tag.className = "creador";
      tag.textContent = "CREADOR";
      item.appendChild(tag);
    }

    list.appendChild(item);
  });

  $("estado-lobby").textContent =
    `Jugadores: ${players.length} de ${roomData.maxJugadores}`;

  const startButton = $("btn-iniciar-partida");

  if (startButton) {
    startButton.disabled = true;
    startButton.textContent = "Juego todavía no activado";
  }

  showScreen("pantalla-lobby");
  message("");
}

// 9. CREAR UNA SALA
async function createRoom() {
  message("");

  const button = $("btn-generar-partida");
  button.disabled = true;

  try {
    const name = $("nombre-creador").value.trim();
    validateName(name);

    const maxPlayers = Number($("numero-jugadores").value);
    const target = Number($("puntos-objetivo").value);

    if (
      !Number.isInteger(maxPlayers) ||
      maxPlayers < 2 ||
      maxPlayers > 8
    ) {
      throw new Error("Elige entre 2 y 8 jugadores.");
    }

    if (
      !Number.isInteger(target) ||
      target < 1 ||
      target > 20
    ) {
      throw new Error("El objetivo debe estar entre 1 y 20 puntos.");
    }

    const user = await getUser();
    let createdCode = null;

    for (let attempt = 0; attempt < 10 && !createdCode; attempt++) {
      const code = randomCode();
      const ref = db.ref("salas/" + code);

      const result = await ref.transaction(existing => {
        if (existing !== null) return;

        return {
          codigo: code,
          creadorUid: user.uid,
          maxJugadores: maxPlayers,
          puntosObjetivo: target,
          estado: "esperando",
          creadaEn: firebase.database.ServerValue.TIMESTAMP,
          jugadores: {
            [user.uid]: {
              uid: user.uid,
              nombre: name,
              unidoEn: firebase.database.ServerValue.TIMESTAMP
            }
          }
        };
      });

      if (result.committed) {
        createdCode = code;
      }
    }

    if (!createdCode) {
      throw new Error(
        "No se pudo reservar un código. Revisa las reglas de Firebase."
      );
    }

    listenRoom(createdCode);

  } catch (error) {
    console.error("Error al crear sala:", error);
    message(errorMessage(error, "No se ha podido crear la sala."));
  } finally {
    button.disabled = false;
  }
}

// 10. UNIRSE A UNA SALA
async function joinRoom() {
  message("");

  const button = $("btn-unirse");
  button.disabled = true;

  try {
    const name = $("nombre-jugador").value.trim();
    validateName(name);

    const code = $("codigo-partida").value.trim().toUpperCase();

    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
      throw new Error("El código debe tener 6 caracteres válidos.");
    }

    const user = await getUser();
    const ref = db.ref("salas/" + code);

    // Comprobar que la sala existe y está esperando jugadores.
    const firstRead = await ref.once("value");
    const initial = firstRead.val();

    if (!initial) {
      throw new Error("No existe ninguna partida con ese código.");
    }

    if (initial.estado !== "esperando") {
      throw new Error("Esta partida ya ha comenzado.");
    }

    const initialPlayers = initial.jugadores || {};

    if (
      Object.keys(initialPlayers).length >= Number(initial.maxJugadores) &&
      !initialPlayers[user.uid]
    ) {
      throw new Error("La partida está completa.");
    }

    // Añadir al jugador de forma atómica.
    const result = await ref.transaction(
      data => {
        if (data === null) return;

        if (data.estado !== "esperando") return;

        if (!data.jugadores) data.jugadores = {};

        // No duplicar al usuario si ya está en la sala.
        if (data.jugadores[user.uid]) return data;

        const count = Object.keys(data.jugadores).length;

        if (count >= Number(data.maxJugadores)) return;

        data.jugadores[user.uid] = {
          uid: user.uid,
          nombre: name,
          unidoEn: firebase.database.ServerValue.TIMESTAMP
        };

        return data;
      },
      (error, committed, snapshot) => {
        if (error) {
          console.error(
            "ERROR REAL DE LA TRANSACCIÓN:",
            error.code,
            error.message
          );
        } else {
          console.log("Resultado de transacción:", {
            committed,
            sala: snapshot ? snapshot.val() : null
          });
        }
      },
      false
    );

    if (!result.committed) {
      const checkSnapshot = await ref.once("value");
      const check = checkSnapshot.val();

      if (!check) {
        throw new Error("La sala ya no existe.");
      }

      if (check.estado !== "esperando") {
        throw new Error("La partida ya ha comenzado.");
      }

      const players = check.jugadores || {};

      if (
        Object.keys(players).length >= Number(check.maxJugadores) &&
        !players[user.uid]
      ) {
        throw new Error("La partida está completa.");
      }

      throw new Error(
        "La transacción no se confirmó. Consulta la consola del navegador: " +
        "busca 'ERROR REAL DE LA TRANSACCIÓN'."
      );
    }

    listenRoom(code);

  } catch (error) {
    console.error("Error al unirse a la sala:", error);

    message(errorMessage(
      error,
      "No se ha podido entrar en la sala."
    ));
  } finally {
    button.disabled = false;
  }
}

// 11. SALIR DE UNA SALA
function leaveRoom() {
  detachRoom();

  currentCode = null;
  roomData = null;

  showScreen("pantalla-inicio");
  message("");
}

// 12. BOTONES Y EVENTOS
$("btn-crear-partida").addEventListener("click", () => {
  updateDefaultPoints();
  showScreen("pantalla-crear");
});

$("btn-unirse-partida").addEventListener("click", () => {
  showScreen("pantalla-unirse");
});

$("btn-volver-inicio-crear").addEventListener("click", () => {
  showScreen("pantalla-inicio");
});

$("btn-volver-inicio-unirse").addEventListener("click", () => {
  showScreen("pantalla-inicio");
});

$("numero-jugadores").addEventListener("change", updateDefaultPoints);

$("btn-generar-partida").addEventListener("click", createRoom);
$("btn-unirse").addEventListener("click", joinRoom);

$("btn-copiar-codigo").addEventListener("click", async () => {
  const code = $("codigo-sala").textContent;

  try {
    await navigator.clipboard.writeText(code);
    message("Código copiado: " + code);
  } catch (_) {
    window.prompt("Copia este código:", code);
  }
});

$("btn-salir-sala").addEventListener("click", leaveRoom);

$("btn-volver-lobby").addEventListener("click", () => {
  showScreen("pantalla-lobby");
});

$("codigo-partida").addEventListener("input", event => {
  event.target.value = event.target.value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
});

console.log("Interfaz del juego cargada correctamente.");
