"use strict";

// Firebase config for the registered web app.
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

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
const $ = id => document.getElementById(id);

let currentUser = null;
let currentCode = null;
let roomRef = null;
let roomListener = null;
let roomData = null;

const screens = ["pantalla-inicio","pantalla-crear","pantalla-unirse","pantalla-lobby","pantalla-juego"];
function showScreen(id) {
  screens.forEach(s => $(s)?.classList.toggle("hidden", s !== id));
  window.scrollTo({top:0,behavior:"smooth"});
}
function status(text, kind="") {
  const el = $("estado-conexion");
  el.textContent = text;
  el.className = "status " + kind;
}
function message(text="") { $("mensaje-global").textContent = text; }
function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length:6}, () => chars[Math.floor(Math.random()*chars.length)]).join("");
}
function updateDefaultPoints() {
  const n = Number($("numero-jugadores").value);
  $("puntos-objetivo").value = n <= 4 ? 5 : 3;
  $("explicacion-puntos").textContent = n <= 4
    ? "Objetivo predeterminado: 5 puntos para 2–4 jugadores."
    : "Objetivo predeterminado: 3 puntos para 5–8 jugadores.";
}
function validateName(name) {
  if (!name) throw new Error("Escribe tu nombre.");
  if (name.length > 20) throw new Error("El nombre no puede superar los 20 caracteres.");
}
async function getUser() {
  if (currentUser) return currentUser;
  const result = await auth.signInAnonymously();
  currentUser = result.user;
  return currentUser;
}
function detachRoom() {
  if (roomRef && roomListener) roomRef.off("value", roomListener);
  roomRef = null; roomListener = null;
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
  roomRef.on("value", roomListener, error => {
    console.error("No se puede leer la sala:", error);
    message("Error al leer la sala: " + error.message);
  });
}
function renderLobby() {
  if (!roomData) return;
  $("codigo-sala").textContent = roomData.codigo;
  const players = Object.values(roomData.jugadores || {});
  const list = $("lista-jugadores");
  list.replaceChildren();
  players.forEach(p => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = p.nombre || "Jugador";
    li.appendChild(name);
    if (p.uid === roomData.creadorUid) {
      const tag = document.createElement("span");
      tag.className = "creador";
      tag.textContent = "CREADOR";
      li.appendChild(tag);
    }
    list.appendChild(li);
  });
  $("estado-lobby").textContent = `Jugadores: ${players.length} de ${roomData.maxJugadores}`;
  $("btn-iniciar-partida").disabled = true;
  $("btn-iniciar-partida").textContent = "Juego todavía no activado";
  showScreen("pantalla-lobby");
  message("");
}
async function createRoom() {
  message("");
  const button = $("btn-generar-partida");
  button.disabled = true;
  try {
    const name = $("nombre-creador").value.trim();
    validateName(name);
    const maxPlayers = Number($("numero-jugadores").value);
    const target = Number($("puntos-objetivo").value);
    if (!Number.isInteger(maxPlayers) || maxPlayers < 2 || maxPlayers > 8) throw new Error("Elige entre 2 y 8 jugadores.");
    if (!Number.isInteger(target) || target < 1 || target > 20) throw new Error("El objetivo debe estar entre 1 y 20 puntos.");
    const user = await getUser();
    let createdCode = null;
    for (let i=0; i<10 && !createdCode; i++) {
      const code = randomCode();
      const ref = db.ref("salas/" + code);
      const result = await ref.transaction(existing => {
        if (existing !== null) return;
        return {
          codigo: code, creadorUid: user.uid, maxJugadores: maxPlayers,
          puntosObjetivo: target, estado: "esperando",
          creadaEn: firebase.database.ServerValue.TIMESTAMP,
          jugadores: {[user.uid]: {
            uid: user.uid, nombre: name,
            unidoEn: firebase.database.ServerValue.TIMESTAMP
          }}
        };
      });
      if (result.committed) createdCode = code;
    }
    if (!createdCode) throw new Error("No se ha podido reservar un código de sala. Inténtalo de nuevo.");
    listenRoom(createdCode);
  } catch (e) {
    console.error("Error al crear sala:", e);
    message(errorMessage(e, "No se ha podido crear la sala."));
  } finally { button.disabled = false; }
}
async function joinRoom() {
  message("");
  const button = $("btn-unirse");
  button.disabled = true;
  try {
    const name = $("nombre-jugador").value.trim();
    validateName(name);
    const code = $("codigo-partida").value.trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) throw new Error("El código debe tener 6 caracteres válidos.");
    const user = await getUser();
    const ref = db.ref("salas/" + code);

    // Read first so we can report clear errors, then transact to avoid overfilling.
    const firstRead = await ref.once("value");
    const initial = firstRead.val();
    if (!initial) throw new Error("No existe ninguna partida con ese código.");
    if (initial.estado !== "esperando") throw new Error("Esta partida ya ha comenzado.");
    const initialPlayers = initial.jugadores || {};
    if (Object.keys(initialPlayers).length >= Number(initial.maxJugadores) && !initialPlayers[user.uid]) {
      throw new Error("La partida está completa.");
    }

    const result = await ref.transaction(data => {
      if (!data || data.estado !== "esperando") return;
      if (!data.jugadores) data.jugadores = {};
      if (data.jugadores[user.uid]) return data;
      if (Object.keys(data.jugadores).length >= Number(data.maxJugadores)) return;
      data.jugadores[user.uid] = {
        uid: user.uid, nombre,
        unidoEn: firebase.database.ServerValue.TIMESTAMP
      };
      return data;
    });

    if (!result.committed) {
      const check = (await ref.once("value")).val();
      if (!check) throw new Error("La sala no existe.");
      if (check.estado !== "esperando") throw new Error("La partida ya ha comenzado.");
      if (Object.keys(check.jugadores || {}).length >= Number(check.maxJugadores) && !(check.jugadores || {})[user.uid]) {
        throw new Error("La partida está completa.");
      }
      throw new Error("Firebase canceló la actualización. Comprueba las reglas de Realtime Database y la consola del navegador.");
    }
    listenRoom(code);
  } catch (e) {
    console.error("Error al unirse a la sala:", e);
    message(errorMessage(e, "No se ha podido entrar en la sala."));
  } finally { button.disabled = false; }
}
function errorMessage(e, fallback) {
  if (e && e.code === "PERMISSION_DENIED") {
    return "Firebase ha denegado el acceso. Comprueba las reglas de Realtime Database y que hayas pulsado Publicar.";
  }
  return e && e.message ? e.message : fallback;
}
function leaveRoom() {
  detachRoom();
  currentCode = null; roomData = null;
  showScreen("pantalla-inicio");
  message("");
}
$("btn-crear-partida").addEventListener("click", () => { updateDefaultPoints(); showScreen("pantalla-crear"); });
$("btn-unirse-partida").addEventListener("click", () => showScreen("pantalla-unirse"));
$("btn-volver-inicio-crear").addEventListener("click", () => showScreen("pantalla-inicio"));
$("btn-volver-inicio-unirse").addEventListener("click", () => showScreen("pantalla-inicio"));
$("numero-jugadores").addEventListener("change", updateDefaultPoints);
$("btn-generar-partida").addEventListener("click", createRoom);
$("btn-unirse").addEventListener("click", joinRoom);
$("btn-copiar-codigo").addEventListener("click", async () => {
  const code = $("codigo-sala").textContent;
  try { await navigator.clipboard.writeText(code); message("Código copiado: " + code); }
  catch (_) { window.prompt("Copia este código:", code); }
});
$("btn-salir-sala").addEventListener("click", leaveRoom);
$("btn-volver-lobby").addEventListener("click", () => showScreen("pantalla-lobby"));
$("codigo-partida").addEventListener("input", e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6); });

auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    status("Firebase conectado", "ok");
    console.log("Firebase conectado; sesión anónima:", user.uid);
  } else {
    status("Conectando…");
  }
});
auth.signInAnonymously().catch(e => {
  status("Error de conexión", "bad");
  console.error("Error de autenticación Firebase:", e.code, e.message);
  message("No se pudo iniciar sesión en Firebase: " + e.message);
});
