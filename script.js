const canvas = document.getElementById("simCanvas");
const ctx = canvas.getContext("2d");

const img = document.getElementById("floorImg");
const imageInput = document.getElementById("imageInput");

/* ================= IMAGE UPLOAD ================= */
imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  img.src = url;

  img.onload = () => {
    img.style.display = "block";
  };
});

/* ================= STATE ================= */
let plan = null;
let agents = [];
let running = false;

const SPEED = 0.6;
const PERSON_RADIUS = 4;
const ROOM_RADIUS = 10;
const SPAWN_DELAY = 10;

// FIXED agent colors
const AGENT_COLORS = ["#3b82f6", "#facc15", "#ec4899"];

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

  plan.corridors.forEach((c) => {
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

  [...plan.rooms, ...plan.exits].forEach((n) => {
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
  plan.rooms.forEach((r) => {
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.arc(r.x, r.y, ROOM_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    drawLabel(r.id, r.x + 14, r.y);
  });

  // Exits / stairs
  plan.exits.forEach((e) => {
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
function getMainCorridor() {
  return plan.corridors
    .filter((c) => c.y1 === c.y2)
    .reduce((a, b) =>
      Math.abs(b.x2 - b.x1) > Math.abs(a.x2 - a.x1) ? b : a
    );
}

/* ================= SPAWN ================= */
function spawnAgents() {
  let colorIndex = 0;

  plan.rooms.forEach((room) => {
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
        color: AGENT_COLORS[colorIndex % AGENT_COLORS.length],
      });
      colorIndex++;
    }
  });
}

/* ================= HELPERS ================= */
function nearestMainCorridorPoint(p) {
  const main = getMainCorridor();
  return { x: p.x, y: main.y1 };
}

/* ================================================== */


/* ================= GRAPH-REPRESENTATION ================= */

function buildGraph() {

  const graph = {};

  plan.rooms.forEach(room => {

    graph[room.id] = [];

    plan.exits.forEach(exit => {

      const distance =
        Math.abs(exit.x - room.x) +
        Math.abs(exit.y - room.y);

      graph[room.id].push({
        node: exit.id,
        weight: distance
      });

    });

  });

  return graph;
}

/* ================= DIJKSTRAS ================= */

function dijkstra(graph, start) {

  const dist = {};
  const visited = {};

  // initialize distances
  Object.keys(graph).forEach(node => {
    dist[node] = Infinity;
    visited[node] = false;
  });

  dist[start] = 0;

  while (true) {

    let closest = null;
    let minDist = Infinity;


  /* ================================================== */

    // find closest unvisited node
    for (let node in dist) {
      if (!visited[node] && dist[node] < minDist) {
        minDist = dist[node];
        closest = node;
      }
    }

    if (closest === null) break;

    visited[closest] = true;

    if (!graph[closest]) continue;

    graph[closest].forEach(edge => {

      const newDist = dist[closest] + edge.weight;

      if (newDist < dist[edge.node]) {
        dist[edge.node] = newDist;
      }

    });
  }

  return dist;
}


function nearestExit(room) {
  const greenExits = plan.exits.filter((e) => e.type === "exit");
  if (greenExits.length === 0) return null;

  return greenExits.reduce((a, b) =>
    Math.abs(b.x - room.x) + Math.abs(b.y - room.y) <
    Math.abs(a.x - room.x) + Math.abs(a.y - room.y)
      ? b
      : a
  );
}

/* ================= MOVE ================= */
function moveAgents() {
  agents.forEach((a) => {
    if (a.delay-- > 0) {
      drawPerson(a);
      return;
    }

    let target;
    if (a.stage === 0) target = a.corridor;
    else if (a.stage === 1)
      target = { x: a.exit.x, y: a.corridor.y };
    else if (a.stage === 2) target = a.exit;
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

  agents = agents.filter((a) => a.stage < 3);
}

/* ================= PERSON ================= */
function drawPerson(a) {
  ctx.beginPath();
  ctx.arc(a.x, a.y, PERSON_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = a.color;
  ctx.fill();
}

/* ================= NAV ================= */
function goToJSONGenerator() {
  window.location.href = "generate-json.html";
}

/* ================= TEXTUAL GUIDE ================= */
function generateEvacuationText() {
  if (!plan) {
    alert("Load a floor plan first");
    return;
  }

  const output = document.getElementById("textOutput");
  output.innerHTML = "";

  plan.rooms.forEach((room) => {
    const exit = nearestExit(room);
    if (!exit) return;

    const corridorPoint = nearestMainCorridorPoint(room);

    let direction = "STRAIGHT";
    if (exit.x > corridorPoint.x) direction = "RIGHT";
    else if (exit.x < corridorPoint.x) direction = "LEFT";

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
