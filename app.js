
/* Juego de Cartas JDT
   Creación de salas, unión de jugadores, lobby y turnos básicos.
   Requiere firebase-config.js y los SDK compat de Firebase cargados en index.html.
*/
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const config = window.FIREBASE_CONFIG;
  const screens = [
    "pantalla-inicio",
    "pantalla-crear",
    "pantalla-unirse",
    "pantalla-lobby",
    "pantalla-juego"
  ];

  let auth;
  let db;
  let user = null;
  let currentCode = null;
  let roomRef = null;
  let roomCallback = null;
  let room = null;
  let busy = false;

  function showScreen(id) {
    screens.forEach(screenId => {
      const element = $(screenId);
      if (element) element.classList.toggle("hidden", screenId !== id);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function say(text = "") {
    const element = $("mensaje-global");
    if (element) element.textContent = text;
  }

  function setStatus(text, className = "") {
    const element = $("estado-conexion");
    if (!element) return;
    element.textContent = text;
    element.className = "connection " + className;
  }

  function fail(operation, error) {
    console.error(
      `[${operation}]`,
      error?.code || "",
      error?.message || error,
      error
    );

    say(
      `${operation}: ${
        error?.code ? error.code + " — " : ""
      }${error?.message || String(error)}`
    );
  }

  function randomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    return Array.from(
      { length: 6 },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  }

  function validateName(name) {
    if (!name) throw new Error("Escribe tu nombre.");
    if (name.length > 20) {
      throw new Error("El nombre no puede superar los 20 caracteres.");
    }
  }

  async function ensureUser() {
    if (auth.currentUser) {
      user = auth.currentUser;
      return user;
    }

    const credential = await auth.signInAnonymously();
    user = credential.user;
    return user;
  }

  function detachRoomListener() {
    if (roomRef && roomCallback) {
      roomRef.off("value", roomCallback);
    }
    roomRef = null;
    roomCallback = null;
  }

  function listenRoom(code) {
    detachRoomListener();
    currentCode = code;
    roomRef = db.ref(`salas/${code}`);

    roomCallback = snapshot => {
      if (!snapshot.exists()) {
        say("La sala ya no existe.");
        detachRoomListener();
        showScreen("pantalla-inicio");
        return;
      }

      room = snapshot.val();
      room.codigo = code;

      if (room.estado === "jugando") {
        renderGame();
      } else {
        renderLobby();
      }
    };

    roomRef.on("value", roomCallback, error => {
      fail("No se pudo leer la sala", error);
    });
  }

  function getPlayers(data = room) {
    return Object.values(data?.jugadores || {});
  }

  function renderLobby() {
    if (!room) return;

    $("codigo-sala").textContent = room.codigo;

    const players = getPlayers();
    $("estado-lobby").textContent =
      `${players.length} de ${room.maxJugadores} jugadores`;

    const list = $("lista-jugadores");
    list.replaceChildren();

    players.forEach(player => {
      const item = document.createElement("li");
      const playerName = document.createElement("span");

      playerName.textContent = player.nombre || "Jugador";
      item.appendChild(playerName);

      if (player.uid === room.creadorUid) {
        const tag = document.createElement("span");
        tag.className = "creador";
        tag.textContent = "ANFITRIÓN";
        item.appendChild(tag);
      }

      list.appendChild(item);
    });

    const isHost = room.creadorUid === user?.uid;
    const canStart = players.length >= 2;

    $("btn-iniciar-partida").disabled =
      !(isHost && canStart && room.estado === "esperando");

    $("btn-iniciar-partida").textContent =
      isHost ? "Iniciar partida" : "Esperando al anfitrión";

    $("estado-partida").textContent = isHost
      ? "Puedes iniciar cuando haya al menos 2 jugadores."
      : "El anfitrión iniciará la partida cuando haya suficientes jugadores.";

    showScreen("pantalla-lobby");
  }

  // Mazo provisional de 27 cartas. Los efectos especiales originales
  // deben implementarse contrastándolos con las cartas reales.
  function makeDeck() {
    const ids = [
      "01", "02", "11", "12", "13", "14", "15", "16", "17",
      "18", "21", "22", "23", "31", "32", "33", "41", "42",
      "43", "51", "52", "61", "62", "71", "72", "81", "91"
    ];

    return ids.map((id, index) => ({
      id,
      value: Number(id[0]),
      name: cardName(id),
      image: `assets/cartas/${id}.png`,
      uid: `${id}-${index}`
    }));
  }

  function cardName(id) {
    const names = {
      "01": "El Bufón",
      "02": "El Asesino",
      "11": "Carta de valor 1",
      "12": "Carta de valor 1",
      "13": "Carta de valor 1",
      "14": "Carta de valor 1",
      "15": "Carta de valor 1",
      "16": "Carta de valor 1",
      "17": "Carta de valor 1",
      "18": "Carta de valor 1",
      "21": "Carta de valor 2",
      "22": "Carta de valor 2",
      "23": "Carta de valor 2",
      "31": "Carta de valor 3",
      "32": "Carta de valor 3",
      "33": "Carta de valor 3",
      "41": "Carta de valor 4",
      "42": "Carta de valor 4",
      "43": "Carta de valor 4",
      "51": "Carta de valor 5",
      "52": "Carta de valor 5",
      "61": "Carta de valor 6",
      "62": "Carta de valor 6",
      "71": "Carta de valor 7",
      "72": "Carta de valor 7",
      "81": "Carta de valor 8",
      "91": "Carta de valor 9"
    };

    return names[id] || `Carta ${id}`;
  }

  function renderGame() {
    if (!room) return;

    showScreen("pantalla-juego");

    const game = room.juego || {};

    $("numero-ronda").textContent = game.ronda || 1;
    $("cartas-restantes").textContent = (game.mazo || []).length;
    $("objetivo-puntos").textContent = room.puntosObjetivo || 5;

    const playersZone = $("zona-jugadores");
    playersZone.replaceChildren();

    getPlayers().forEach(player => {
      const tile = document.createElement("div");

      tile.className =
        "player-tile" +
        (player.uid === game.turnoUid ? " active" : "");

      const name = document.createElement("strong");
      name.textContent = player.nombre || "Jugador";
      tile.appendChild(name);

      const score = document.createElement("small");
      score.textContent =
        `Puntos: ${(game.puntos || {})[player.uid] || 0}`;
      tile.appendChild(score);

      playersZone.appendChild(tile);
    });

    const handElement = $("mi-mano");
    handElement.replaceChildren();

    const hand = (game.manos || {})[user?.uid] || [];

    hand.forEach((card, index) => {
      const button = document.createElement("button");
      button.className = "playing-card";

      button.disabled =
        game.turnoUid !== user?.uid ||
        !!game.cartaJugada ||
        !game.cartaRobada;

      const value = document.createElement("span");
      value.className = "value";
      value.textContent = card.value;
      button.appendChild(value);

      const name = document.createElement("span");
      name.className = "card-name";
      name.textContent = card.name;
      button.appendChild(name);

      button.addEventListener("click", () => playCard(index));
      handElement.appendChild(button);
    });

    const playedElement = $("cartas-jugadas");
    playedElement.replaceChildren();

    (game.jugadas || []).slice().reverse().forEach(play => {
      const item = document.createElement("span");
      item.className = "pill";
      item.textContent =
        `${play.nombre}: ${play.carta.name} (${play.carta.value})`;
      playedElement.appendChild(item);
    });

    const myTurn = game.turnoUid === user?.uid;

    $("btn-robar").disabled =
      !myTurn || !!game.cartaRobada || !!game.cartaJugada;

    $("btn-pasar").disabled = !myTurn || !game.cartaJugada;

    $("mensaje-turno").textContent = myTurn
      ? "Es tu turno. Roba una carta y juega una."
      : "Esperando el turno de otro jugador.";
  }

  // CREAR PARTIDA
  async function createRoom() {
    if (busy) return;

    busy = true;
    say("");
    $("btn-generar-partida").disabled = true;

    try {
      const name = $("nombre-creador").value.trim();
      validateName(name);

      const maxPlayers = Number($("numero-jugadores").value);
      const target = Number($("puntos-objetivo").value);

      if (!Number.isInteger(maxPlayers) ||
          maxPlayers < 2 || maxPlayers > 8) {
        throw new Error("Elige entre 2 y 8 jugadores.");
      }

      if (!Number.isInteger(target) || target < 1 || target > 20) {
        throw new Error("El objetivo debe estar entre 1 y 20 puntos.");
      }

      await ensureUser();

      let code = null;

      for (let attempt = 0; attempt < 10 && !code; attempt++) {
        const candidate = randomCode();
        const ref = db.ref(`salas/${candidate}`);
        const snapshot = await ref.once("value");

        if (snapshot.exists()) continue;

        const roomData = {
          codigo: candidate,
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

        await ref.set(roomData);
        code = candidate;
      }

      if (!code) {
        throw new Error("No se pudo generar un código único. Inténtalo otra vez.");
      }

      listenRoom(code);
      say("");
    } catch (error) {
      fail("Error al crear la sala", error);
    } finally {
      busy = false;
      $("btn-generar-partida").disabled = false;
    }
  }

  // UNIRSE A UNA PARTIDA
  async function joinRoom() {
    if (busy) return;

    busy = true;
    say("");
    $("btn-unirse").disabled = true;

    // Esta variable se llama name y se usa como nombre: name al guardar.
    const name = $("nombre-jugador").value.trim();
    const code = $("codigo-partida").value.trim().toUpperCase();

    try {
      validateName(name);

      if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) {
        throw new Error("El código debe tener 6 caracteres válidos.");
      }

      await ensureUser();

      const roomReference = db.ref(`salas/${code}`);

      console.info("[UNIRSE] Leyendo sala:", roomReference.toString());

      const snapshot = await roomReference.once("value");
      const data = snapshot.val();

      console.info("[UNIRSE] Resultado de lectura:", {
        exists: snapshot.exists(),
        estado: data?.estado,
        jugadores: Object.keys(data?.jugadores || {}).length
      });

      if (!data) {
        throw new Error("No existe una sala con ese código. Comprueba el código.");
      }

      if (data.estado !== "esperando") {
        throw new Error("La partida ya ha comenzado o está cerrada.");
      }

      const players = data.jugadores || {};
      const alreadyJoined = Boolean(players[user.uid]);

      if (
        !alreadyJoined &&
        Object.keys(players).length >= Number(data.maxJugadores)
      ) {
        throw new Error("La sala está completa.");
      }

      if (!alreadyJoined) {
        const playerReference =
          roomReference.child(`jugadores/${user.uid}`);

        console.info(
          "[UNIRSE] Escribiendo jugador en:",
          playerReference.toString()
        );

        await playerReference.set({
          uid: user.uid,
          nombre: name,
          unidoEn: firebase.database.ServerValue.TIMESTAMP
        });

        console.info("[UNIRSE] Escritura completada.");
      }

      listenRoom(code);
    } catch (error) {
      fail("Error al unirse a la sala", error);
    } finally {
      busy = false;
      $("btn-unirse").disabled = false;
    }
  }

  // INICIAR PARTIDA
  async function startGame() {
    say("");

    try {
      await ensureUser();

      if (!room || room.creadorUid !== user.uid) {
        throw new Error("Solo el anfitrión puede iniciar la partida.");
      }

      const snapshot = await db.ref(`salas/${currentCode}`).once("value");
      const data = snapshot.val();

      if (!data || data.estado !== "esperando") {
        throw new Error("La sala ya no está esperando jugadores.");
      }

      const players = Object.values(data.jugadores || {});

      if (players.length < 2) {
        throw new Error("Se necesitan al menos 2 jugadores.");
      }

      const deck = makeDeck().sort(() => Math.random() - 0.5);
      const hands = {};
      const scores = {};

      players.forEach(player => {
        hands[player.uid] = [deck.pop()];
        scores[player.uid] = 0;
      });

      const firstPlayer =
        players[Math.floor(Math.random() * players.length)];

      const game = {
        ronda: 1,
        mazo: deck,
        manos: hands,
        puntos: scores,
        turnoUid: firstPlayer.uid,
        cartaRobada: false,
        cartaJugada: false,
        jugadas: [],
        estado: "jugando"
      };

      await db.ref(`salas/${currentCode}`).update({
        estado: "jugando",
        juego: game
      });
    } catch (error) {
      fail("No se pudo iniciar la partida", error);
    }
  }

  // ROBAR CARTA
  async function drawCard() {
    try {
      const snapshot =
        await db.ref(`salas/${currentCode}`).once("value");

      const data = snapshot.val();
      const game = data?.juego;

      if (!game || game.turnoUid !== user.uid) {
        throw new Error("No es tu turno.");
      }

      if (game.cartaRobada || game.cartaJugada) {
        throw new Error("Ya has robado una carta en este turno.");
      }

      if (!game.mazo || game.mazo.length === 0) {
        throw new Error("No quedan cartas en el mazo.");
      }

      const card = game.mazo.pop();
      game.manos[user.uid].push(card);
      game.cartaRobada = true;

      await db.ref(`salas/${currentCode}/juego`).set(game);
    } catch (error) {
      fail("No se pudo robar carta", error);
    }
  }

  // JUGAR CARTA
  async function playCard(index) {
    try {
      const snapshot =
        await db.ref(`salas/${currentCode}`).once("value");

      const data = snapshot.val();
      const game = data?.juego;

      if (!game || game.turnoUid !== user.uid) {
        throw new Error("No es tu turno.");
      }

      if (!game.cartaRobada) {
        throw new Error("Primero debes robar una carta.");
      }

      if (game.cartaJugada) {
        throw new Error("Ya has jugado una carta en este turno.");
      }

      const hand = game.manos[user.uid] || [];

      if (index < 0 || index >= hand.length) {
        throw new Error("La carta seleccionada ya no está en tu mano.");
      }

      const card = hand.splice(index, 1)[0];

      game.jugadas = game.jugadas || [];
      game.jugadas.push({
        uid: user.uid,
        nombre: data.jugadores[user.uid]?.nombre || "Jugador",
        carta: card
      });

      game.cartaJugada = true;
      game.manos[user.uid] = hand;

      await db.ref(`salas/${currentCode}/juego`).set(game);
    } catch (error) {
      fail("No se pudo jugar la carta", error);
    }
  }

  // TERMINAR TURNO
  async function endTurn() {
    try {
      const snapshot =
        await db.ref(`salas/${currentCode}`).once("value");

      const data = snapshot.val();
      const game = data?.juego;

      if (!game || game.turnoUid !== user.uid) {
        throw new Error("No es tu turno.");
      }

      if (!game.cartaJugada) {
        throw new Error("Debes robar y jugar una carta antes de terminar el turno.");
      }

      const players = Object.values(data.jugadores || {});
      const currentIndex = players.findIndex(p => p.uid === user.uid);

      if (currentIndex < 0 || players.length === 0) {
        throw new Error("No se ha encontrado el jugador en la sala.");
      }

      const nextPlayer = players[(currentIndex + 1) % players.length];

      game.turnoUid = nextPlayer.uid;
      game.cartaRobada = false;
      game.cartaJugada = false;

      await db.ref(`salas/${currentCode}/juego`).set(game);
    } catch (error) {
      fail("No se pudo terminar el turno", error);
    }
  }

  // SALIR DE LA SALA
  async function leaveRoom() {
    try {
      if (currentCode && user) {
        const reference = db.ref(`salas/${currentCode}`);
        const snapshot = await reference.once("value");
        const data = snapshot.val();

        if (data?.jugadores?.[user.uid]) {
          await reference.child(`jugadores/${user.uid}`).remove();
        }

        if (data?.creadorUid === user.uid) {
          await reference.update({ estado: "cerrada" });
        }
      }
    } catch (error) {
      console.warn("No se pudo limpiar la salida:", error);
    }

    detachRoomListener();
    currentCode = null;
    room = null;
    say("");
    showScreen("pantalla-inicio");
  }

  function wireEvents() {
    $("btn-crear-partida").addEventListener("click", () => {
      say("");
      showScreen("pantalla-crear");
    });

    $("btn-unirse-partida").addEventListener("click", () => {
      say("");
      showScreen("pantalla-unirse");
    });

    $("btn-volver-inicio-crear").addEventListener("click", () => {
      showScreen("pantalla-inicio");
    });

    $("btn-volver-inicio-unirse").addEventListener("click", () => {
      showScreen("pantalla-inicio");
    });

    $("numero-jugadores").addEventListener("change", () => {
      $("puntos-objetivo").value =
        Number($("numero-jugadores").value) <= 4 ? 5 : 3;
    });

    $("btn-generar-partida").addEventListener("click", createRoom);
    $("btn-unirse").addEventListener("click", joinRoom);

    $("codigo-partida").addEventListener("input", event => {
      event.target.value = event.target.value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 6);
    });

    $("btn-copiar-codigo").addEventListener("click", async () => {
      const code = $("codigo-sala").textContent;

      try {
        await navigator.clipboard.writeText(code);
        say("Código copiado: " + code);
      } catch (_) {
        window.prompt("Copia el código:", code);
      }
    });

    $("btn-salir-sala").addEventListener("click", leaveRoom);
    $("btn-salir-juego").addEventListener("click", leaveRoom);
    $("btn-iniciar-partida").addEventListener("click", startGame);
    $("btn-robar").addEventListener("click", drawCard);
    $("btn-pasar").addEventListener("click", endTurn);
  }

  function boot() {
    try {
      if (!window.firebase || !config) {
        throw new Error(
          "No se han cargado Firebase o firebase-config.js."
        );
      }

      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }

      auth = firebase.auth();
      db = firebase.database();

      auth.onAuthStateChanged(currentUser => {
        user = currentUser || null;

        if (user) {
          setStatus("Firebase conectado", "ok");
          console.log("Firebase conectado. UID:", user.uid);
        } else {
          setStatus("Iniciando sesión…");
        }
      });

      auth.signInAnonymously().catch(error => {
        setStatus("Error de autenticación", "bad");
        fail("No se pudo iniciar sesión anónima", error);
      });

      wireEvents();
      console.log("Aplicación cargada. Versión consolidada JDT.");
    } catch (error) {
      setStatus("Error de configuración", "bad");
      fail("No se pudo iniciar la aplicación", error);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
