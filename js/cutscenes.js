"use strict";
/*
   cutscenes   
   1 menu  the runner is at home next to his coffee table
     the coffee table is the level 0 cube and the arrow keys move the camera
   2 audit  the irs guy knocks  the door slides open  he says its an audit
     and the runner leaves out the window
   kept simple  just flat walls and a few boxes  and stuff only slides around  nothing spins
*/

// the apartment  just flat walls and boxes
M.room = (() => { const m = makeModel();
  const wall = 0xe6d5b0, side = 0xd9c49a;
  groundQuad(m, -5, -4, 5, 10, 0, 0x8a5a33);                                     // floor
  groundQuad(m, -5, -4, 5, 10, 3.2, 0xf1ead8);                                   // ceiling
  addQuad(m, [-5, 0, 10], [-0.9, 0, 10], [-0.9, 3.2, 10], [-5, 3.2, 10], wall);  // back wall left of the door
  addQuad(m, [0.9, 0, 10], [5, 0, 10], [5, 3.2, 10], [0.9, 3.2, 10], wall);      // back wall right of the door
  addQuad(m, [-0.9, 2.3, 10], [0.9, 2.3, 10], [0.9, 3.2, 10], [-0.9, 3.2, 10], wall); // above the door
  addQuad(m, [-5, 0, -4], [-5, 0, 10], [-5, 3.2, 10], [-5, 3.2, -4], side);      // left wall
  addQuad(m, [5, 0, -4], [5, 0, 10], [5, 3.2, 10], [5, 3.2, -4], side);          // right wall
  addQuad(m, [-4.98, 1, 3], [-4.98, 1, 6], [-4.98, 2.4, 6], [-4.98, 2.4, 3], 0x8fd0ff); // window
  addQuad(m, [-1.5, 0, 13], [1.5, 0, 13], [1.5, 3.2, 13], [-1.5, 3.2, 13], 0x7d8494);  // hallway wall behind the door
  groundQuad(m, -1.5, 10, 1.5, 13, 0, 0x4a4f5c);                                // hallway floor
  addBox(m, 1.2, 0, 7.2, 4.2, 0.8, 8.2, 0x3b5bdb);                               // couch behind the table
  addBox(m, -4.6, 0, 6.5, -3.4, 1.3, 7.2, 0x222222);                             // tv
  return finish(m); })();
M.door = (() => { const m = makeModel();
  addBox(m, -0.8, 0, -0.05, 0.8, 2.2, 0.05, 0x7a4a24);
  return finish(m); })();

const HOME_CAM = { x: 0, y: 1.6, z: 1 };       // where the camera starts for the menu and the cutscene
const TABLE_POS = [1.3, 0.45, 5];              // coffee table is the level 0 cube shrunk so its a little under 1 wide on every side
const STAND_SPOT = [2.6, 0, 5];                // where the runner stands  just right of the table

function homeObjects(guy) {                    // the room table and runner  used by both the menu and the cutscene
  return [
    inst(M.room, 0, 0, 0, 1),
    inst(M.cube, TABLE_POS[0], TABLE_POS[1], TABLE_POS[2], 0.45),   // same size on every side so it stays a cube
    guy,
  ];
}

/*
   1  menu  the runner at home  level 0 cube and a camera you can move
*/
const menu = { t: 0, cam: { ...HOME_CAM }, objs: [], guy: null };

function resetMenu() {
  menu.t = 0;
  menu.cam = { ...HOME_CAM };
  menu.guy = inst(M.player, STAND_SPOT[0], STAND_SPOT[1], STAND_SPOT[2], 1);
  menu.objs = [...homeObjects(menu.guy), inst(M.door, 0, 0, 9.78, 1)];
}

function updateMenu(dt) {
  menu.t += dt;
  const s = 6 * dt, c = menu.cam;             // arrow keys slide the camera around
  if (held.has("ArrowLeft") || held.has("a")) c.x -= s;
  if (held.has("ArrowRight") || held.has("d")) c.x += s;
  if (held.has("ArrowUp") || held.has("w")) c.z += s;
  if (held.has("ArrowDown") || held.has("s")) c.z -= s;
  menu.guy.pos[1] = Math.abs(Math.sin(menu.t * 1.5)) * 0.03;   // tiny up and down like hes breathing
}

function drawMenuHUD() {
  txt("TAX EVASION SURFERS", HI_W / 2, 90, 84, "#8ce99a", "center");
  txt("A quiet Tuesday at home. Nothing could possibly go wrong.", HI_W / 2, 200, 28, "#fff", "center");
  txt("ARROWS move the camera   R resets it", HI_W / 2, 790, 32, "#fff", "center");
  if (Math.floor(performance.now() / 500) % 2) txt("PRESS ENTER TO START", HI_W / 2, 860, 40, "#ffe066", "center");
}

/*
   2  audit cutscene
*/
const cs = { t: 0, cam: { ...HOME_CAM }, objs: [], door: null, agent: null, guy: null };
const CS_END = 13;                             // how many seconds long  then the run starts
const CS_LINES = [
  [0, 2.5,     ["*KNOCK KNOCK KNOCK*"]],
  [2.5, 4,     ["(the door slides open...)"]],
  [4, 6.5,     ["IRS AGENT: Internal Revenue Service.", "You've been selected for an audit."]],
  [6.5, 8.5,   ["IRS AGENT: I've been told you owe $1,276,855 in taxes..."]],
  [8.5, 10,    ["YOU: ....."]],
  [10, 11.5,   ["IRS AGENT: We'd like to recieve that now..."]],
  [11.5, CS_END, ["YOU: NOT TODAY!"]],
];

function startCutscene() {
  state = "cutscene"; cs.t = 0;
  cs.cam = { ...HOME_CAM };
  cs.door = inst(M.door, 0, 0, 9.78, 1);
  cs.agent = inst(M.irs, 0, 0, 11.5, 1.05);
  cs.guy = inst(M.player, STAND_SPOT[0], STAND_SPOT[1], STAND_SPOT[2], 1);
  cs.objs = [...homeObjects(cs.guy), cs.door, cs.agent];
}

function updateCutscene(dt) {
  const t = (cs.t += dt);
  // first the door shakes while he knocks  then it slides open
  cs.door.pos[0] = t < 2.4 ? Math.sin(t * 60) * 0.03 : 1.75 * clamp((t - 2.5) / 1, 0, 1);
  // the irs guy walks in to the table  then later steps closer
  cs.agent.pos[2] = t < 10 ? lerp(11.5, 6.5, clamp((t - 3.5) / 1.5, 0, 1))
                           : lerp(6.5, 5.6, clamp((t - 10) / 0.5, 0, 1));
  // then the runner leaves  steps around the table
  // then runs left to the window
  const g = cs.guy.pos;
  if (t >= 11.5) {
    const k = clamp((t - 11.5) / 1.4, 0, 1);
    if (k < 0.3) { g[2] = lerp(STAND_SPOT[2], 3.6, k / 0.3); }
    else         { g[2] = 3.6; g[0] = lerp(STAND_SPOT[0], -4.4, (k - 0.3) / 0.7); }
    g[1] = Math.abs(Math.sin(t * 14)) * 0.15;                          // bouncing while he runs
    const c = t - 11.5;                                               // the camera follows him out
    cs.cam.x = -c * 2.4; cs.cam.z = HOME_CAM.z - c * 1.5;
  }
  if (t >= CS_END) startRun();
}

function drawCutsceneHUD() {
  const line = CS_LINES.find(l => cs.t >= l[0] && cs.t < l[1]);
  ctx.fillStyle = "rgba(0,0,0,0.78)"; ctx.fillRect(100, 790, 1400, 170);
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.strokeRect(100, 790, 1400, 170);
  if (line) line[2].forEach((s, i) => txt(s, 140, 820 + i * 50, 38, line[2][0].startsWith("IRS") ? "#ff8787" : "#fff"));
  txt("ENTER: skip", 1480, 925, 20, "#adb5bd", "right");
}
