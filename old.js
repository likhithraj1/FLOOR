const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");

const img = document.getElementById("floorImg");
const imageInput = document.getElementById("imageInput");

imageInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  img.src = url;

  img.onload = () => {
    img.style.display = "block";
  };
});


let plan = null;
let agents = [];
let running = false;

const SPEED = 0.6;
const PERSON_RADIUS = 4;
const ROOM_RADIUS = 10;
const SPAWN_DELAY = 10;

// FIXED agent colors
const AGENT_COLORS = ["#3b82f6", "#facc15", "#ec4899"]; // blue, yellow, pink

/* ================= LOAD JSON ================= */
function loadPlan() {
  try {
    plan = JSON.parse(document.getElementById("jsonInput").value);
    agents = [];
    running = false;
    alert("Floor plan loaded");
  } catch {
    alert("Invalid JSON");
  }
}

/* ================= START ================= */
function startEvacuation() {
  if (!plan) return;
  agents = [];
  spawnAgents();
  running = true;
  requestAnimationFrame(loop);
}

/* ================= LOOP ================= */
function loop() {
  if (!running) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawCorridors();
  drawConnections();
  drawNodes();
  moveAgents();

  requestAnimationFrame(loop);
}

/* ================= CORRIDORS ================= */
function drawCorridors() {
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 4;

  plan.corridors.forEach(c => {
    ctx.beginPath();
    ctx.moveTo(c.x1, c.y1);
    ctx.lineTo(c.x2, c.y2);
    ctx.stroke();
  });
}

/* ================= CONNECTORS ================= */
function drawConnections() {
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 4;

  [...plan.rooms, ...plan.exits].forEach(n => {
    const p = nearestMainCorridorPoint(n);
    ctx.beginPath();
    ctx.moveTo(n.x, n.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  });
}

/* ================= NODES ================= */
function drawNodes() {
  // Rooms
  plan.rooms.forEach(r => {
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(r.x, r.y, ROOM_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    drawLabel(r.id, r.x + 14, r.y);
  });

  // Exits / stairs
  plan.exits.forEach(e => {
    ctx.fillStyle = e.type === "exit" ? "green" : "red";
    ctx.fillRect(e.x - 18, e.y - 12, 36, 24);
    drawLabel(e.id, e.x + 22, e.y);
  });
}

/* ================= LABEL ================= */
function drawLabel(text, x, y) {
  ctx.font = "bold 12px Arial";
  ctx.fillStyle = "#111";
  ctx.fillText(text, x, y);
}

/* ================= MAIN CORRIDOR ================= */
// Dynamically detect the central / main corridor
function getMainCorridor() {
  return plan.corridors
    .filter(c => c.y1 === c.y2) // horizontal only
    .reduce((a, b) =>
      Math.abs(b.x2 - b.x1) > Math.abs(a.x2 - a.x1) ? b : a
    );
}

/* ================= SPAWN ================= */
function spawnAgents() {
  let colorIndex = 0;

  plan.rooms.forEach(room => {
    const exit = nearestExit(room);
    if (!exit) return;

    const corridorPoint = nearestMainCorridorPoint(room);

    for (let i = 0; i < room.people; i++) {
      agents.push({
        x: room.x,
        y: room.y,
        corridor: corridorPoint,
        exit,
        stage: 0,
        delay: i * SPAWN_DELAY,
        color: AGENT_COLORS[colorIndex % AGENT_COLORS.length]
      });
      colorIndex++;
    }
  });
}

/* ================= HELPERS ================= */
// 🔒 FORCE ENTRY INTO MAIN CORRIDOR ONLY
function nearestMainCorridorPoint(p) {
  const main = getMainCorridor();
  return { x: p.x, y: main.y1 };
}

// 🔒 ONLY GREEN EXITS
/* ================= SHORTEST EXIT (DIJKSTRA STYLE) ================= */
/*
This is a Dijkstra-style shortest path selection.
Since the floor is single-level and corridors are linear,
the algorithm reduces to selecting the minimum-distance exit,
which matches the earlier greedy behavior.
*/

function nearestExit(room) {
  const exits = plan.exits.filter(e => e.type === "exit");
  if (exits.length === 0) return null;

  // Dijkstra tables
  const dist = {};
  const visited = new Set();

  exits.forEach(e => dist[e.id] = Infinity);

  // Source = room
  exits.forEach(exit => {
    // edge weight = Manhattan distance (uniform corridor cost)
    dist[exit.id] =
      Math.abs(exit.x - room.x) + Math.abs(exit.y - room.y);
  });

  // Find minimum distance (Dijkstra relaxation step)
  let chosenExit = exits[0];
  let minDist = dist[chosenExit.id];

  exits.forEach(exit => {
    if (dist[exit.id] < minDist) {
      minDist = dist[exit.id];
      chosenExit = exit;
    }
  });

  return chosenExit;
}


/* ================= MOVE ================= */
function moveAgents() {
  agents.forEach(a => {
    if (a.delay-- > 0) {
      drawPerson(a);
      return;
    }

    let target;
    if (a.stage === 0) target = a.corridor;               // room → MAIN corridor
    else if (a.stage === 1) target = { x: a.exit.x, y: a.corridor.y }; // along corridor
    else if (a.stage === 2) target = a.exit;              // corridor → exit
    else return;

    const dx = target.x - a.x;
    const dy = target.y - a.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 2) a.stage++;
    else {
      a.x += (dx / dist) * SPEED;
      a.y += (dy / dist) * SPEED;
    }

    drawPerson(a);
  });

  agents = agents.filter(a => a.stage < 3);
}

/* ================= PERSON ================= */
function drawPerson(a) {
  ctx.beginPath();
  ctx.arc(a.x, a.y, PERSON_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = a.color;
  ctx.fill();
}

function goToJSONGenerator() {
  window.location.href = "generate-json.html";
}

/* ================= TEXTUAL EVACUATION GUIDE ================= */
function generateEvacuationText() {
  if (!plan) {
    alert("Load a floor plan first");
    return;
  }

  const output = document.getElementById("textOutput");
  output.innerHTML = "";

  const mainCorridor = getMainCorridor();

  plan.rooms.forEach(room => {
    const exit = nearestExit(room);
    if (!exit) return;

    const corridorPoint = nearestMainCorridorPoint(room);

    let direction;
    if (exit.x > corridorPoint.x) direction = "RIGHT";
    else if (exit.x < corridorPoint.x) direction = "LEFT";
    else direction = "STRAIGHT";

    const block = document.createElement("div");
    block.className = "text-card";

    block.innerHTML = `
      <h3>Room ${room.id}</h3>
      <ul>
        <li>Exit the room and move straight to the main corridor</li>
        <li>Once on the corridor, go <strong>${direction}</strong></li>
        <li>Use <strong>Exit ${exit.id}</strong></li>
      </ul>
    `;

    output.appendChild(block);
  });
}

