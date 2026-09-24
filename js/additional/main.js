"use strict";
/*
   keys  screen text  test bench  and the main loop  
   this file loads last so it can start the game after everything else is ready
*/

/* keys*/
// keeps track of which keys are being held down right now
const held = new Set();
const norm = k => k.length === 1 ? k.toLowerCase() : k;   // makes letters lowercase so a and a count the same
// when a key goes down
addEventListener("keydown", e => {
  const k = norm(e.key);
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(k)) e.preventDefault();   // stop arrows and space from scrolling the page
  held.add(k);
  if (!e.repeat) onPress(k);   // only count the first press not the repeats from holding it
});
addEventListener("keyup", e => held.delete(norm(e.key)));   // key let go
addEventListener("blur", () => held.clear());   // if you click away from the page forget all held keys

// what each key does when you press it
function onPress(k) {
  if (k === "1" || k === "2" || k === "3") setMode(+k);
  else if (k === "m") setMode(renderMode % 3 + 1);
  else if (k === "g") showGrid = !showGrid;
  else if (k === "p") paused = !paused;
  else if (k === "r") resetCurrent();
  else if (k === "t") { resetMenu(); state = "menu"; }
  else if (k === "x") { if (state === "test") state = stateBeforeTest; else { stateBeforeTest = state; state = "test"; } }
  else if (k === "Enter" || (k === " " && state !== "play")) advance();
  else if (state === "play" && !paused) {
    if (k === "ArrowLeft" || k === "a") player.lane = Math.max(0, player.lane - 1);
    else if (k === "ArrowRight" || k === "d") player.lane = Math.min(3, player.lane + 1);
    else if (k === " ") useBribe();
  }
}
// enter goes to the next thing  menu to cutscene  cutscene or game over to the run
function advance() {
  paused = false;
  if (state === "menu") startCutscene();
  else if (state === "cutscene" || state === "gameover") startRun();
}
// r restarts whatever screen youre on
function resetCurrent() {
  paused = false;
  if (state === "menu") resetMenu();
  else if (state === "cutscene") startCutscene();
  else startRun();                 // restarts the run with the camera and everything back where they started
}
// switch between level 1 2 and 3 and check the right box in the header
function setMode(n) {
  renderMode = n;
  for (let i = 1; i <= 3; i++) document.getElementById("m" + i).setAttribute("aria-pressed", String(i === n));
}
// make the header buttons work too
for (let i = 1; i <= 3; i++) document.getElementById("m" + i).addEventListener("click", e => { setMode(i); e.currentTarget.blur(); });
document.getElementById("bStart").addEventListener("click", e => { advance(); e.currentTarget.blur(); });
document.getElementById("bReset").addEventListener("click", e => { resetCurrent(); e.currentTarget.blur(); });

/* screen text*/
// writes text on the screen with a black shadow so its easy to read
function txt(s, x, y, size, color, align) {
  ctx.font = `bold ${size}px "Courier New", Courier, monospace`;
  ctx.textAlign = align || "left"; ctx.textBaseline = "top";
  ctx.fillStyle = "#000"; ctx.fillText(s, x + 3, y + 3);
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
// names shown in the top right for each level
const MODE_NAME = ["", "L1 WIREFRAME 1600x1000", "L2 320x200 DDA LINES", "L3 320x200 TRIANGLES + Z-BUFFER"];

// all the text on top of the game every frame
function drawHUD(sc) {
  txt(MODE_NAME[renderMode] + (showGrid && renderMode > 1 ? " [GRID]" : ""), HI_W - 24, 20, 24, "#ffe066", "right");
  txt(`cam x ${sc.cam.x.toFixed(1)}  y ${sc.cam.y.toFixed(1)}  z ${sc.cam.z.toFixed(1)}`, HI_W - 24, 52, 20, "#dee2e6", "right");

  // menu and cutscene have their own text in cutscenes js
  if (state === "menu") { drawMenuHUD(); return; }
  if (state === "cutscene") { drawCutsceneHUD(); return; }

  // score stuff in the top left
  const W = world, P = player, A = agent;
  txt(`DISTANCE ${Math.floor(P.z)} m`, 30, 20, 34, "#fff");
  txt(`$ ${W.dollars}`, 30, 62, 34, "#8ce99a");
  txt(`BRIBES ${"#".repeat(W.bribes)}${"-".repeat(3 - W.bribes)}  next ${W.cash}/${CASH_PER_BRIBE}  (SPACE)`, 30, 104, 26, "#ffe066");
  txt(`SPEED ${P.speed.toFixed(0)}${P.sprint ? "  SPRINT" : P.braking ? "  BRAKING" : ""}`, 30, 140, 24, P.braking ? "#ff8787" : "#dee2e6");

  // warnings in the middle that blink
  const flash = Math.floor(W.time * 8) % 2 === 0;   // flips on and off 8 times a second
  let wy = 200;   // how far down to write the next warning
  const rear = W.objs.filter(o => o.kind === "rearcar" && o.pos[2] < P.z);   // cars still coming from behind
  for (const o of rear) {
    const s = (P.z - o.pos[2]) / REAR_REL;   // seconds until it gets to you
    txt(`!! CAR FROM BEHIND - ${LANE_NAME[2]} - ${s.toFixed(1)}s`, HI_W / 2, wy, 38, flash ? "#ff4d4d" : "#fff", "center"); wy += 50;
  }
  if (A.state === "warn") {
    txt(`!! IRS LUNGE - ${LANE_NAME[A.target]} - ${A.t.toFixed(1)}s`, HI_W / 2, wy, 38, flash ? "#ff9f1a" : "#fff", "center"); wy += 50;
  }
  if (W.bribeT > 0) {
    txt(`BRIBED PEDESTRIANS ARE HOLDING OFF THE IRS - ${W.bribeT.toFixed(1)}s`, HI_W / 2, wy, 34, "#8ce99a", "center"); wy += 46;
  }
  if (P.braking && A.gap < 2.2 && state === "play") txt("THE IRS IS RIGHT BEHIND YOU", HI_W / 2, wy, 34, "#ff8787", "center");

  // the 4 lane boxes at the bottom  yours has a white border and warned lanes blink
  const cw = 360, gap = 10, x0 = (HI_W - (4 * cw + 3 * gap)) / 2, y0 = 915;
  for (let i = 0; i < 4; i++) {
    const x = x0 + i * (cw + gap);
    let fill = "rgba(0,0,0,0.55)";
    if (flash && i === 2 && rear.length) fill = "rgba(255,40,40,0.8)";
    if (flash && A.state === "warn" && A.target === i) fill = "rgba(255,159,26,0.85)";
    ctx.fillStyle = fill; ctx.fillRect(x, y0, cw, 60);
    if (i === P.lane) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; ctx.strokeRect(x, y0, cw, 60); }
    txt(LANE_NAME[i], x + cw / 2, y0 + 18, 24, "#fff", "center");
  }

  // white flash when the run starts
  if (flashT > 0) { ctx.fillStyle = `rgba(255,255,255,${flashT / 0.6})`; ctx.fillRect(0, 0, HI_W, HI_H); }

  // game over screen
  if (state === "gameover") {
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, HI_W, HI_H);
    txt("AUDITED!", HI_W / 2, 260, 120, "#ff4d4d", "center");
    txt(W.reason, HI_W / 2, 420, 34, "#fff", "center");
    txt(`Distance ${Math.floor(P.z)} m    Dollars ${W.dollars}`, HI_W / 2, 490, 36, "#ffe066", "center");
    txt("ENTER / R: run again     T: back home", HI_W / 2, 580, 30, "#dee2e6", "center");
  }
}

/* test bench  press x to check my line and triangle code by itself*/
function renderTest() {
  clearFrame(ROWS_DARK);
  // a star of 24 lines going every direction
  for (let i = 0; i < 24; i++) {
    const t = i / 24 * Math.PI * 2;
    drawLine(70, 100, Math.round(70 + Math.cos(t) * 60), Math.round(100 + Math.sin(t) * 60), i % 2 ? 0xffe066 : 0x8ce99a);
  }
  // red is closer but drawn first  blue is farther and drawn second  red should still be in front
  fillTriangle([150, 30, 0.5], [225, 50, 0.5], [165, 125, 0.5], 0xff4d4d);
  fillTriangle([165, 60, 0.1], [150, 165, 0.1], [232, 150, 0.1], 0x4dabf7);
  // green and purple go through each other  green gets closer toward the right
  fillTriangle([240, 35, 0.1], [318, 55, 0.5], [270, 180, 0.3], 0x51cf66);
  fillTriangle([245, 70, 0.3], [318, 120, 0.3], [250, 175, 0.3], 0xb197fc);
  presentFrame();
  txt("TEST BENCH  (X to go back)", HI_W / 2, 20, 34, "#ffe066", "center");
  txt("drawLine: 24 solid spokes", 350, 880, 26, "#fff", "center");
  txt("fillTriangle: red in front,", 950, 880, 26, "#fff", "center");
  txt("blue behind", 950, 915, 26, "#fff", "center");
  txt("green/purple cross", 1400, 880, 26, "#fff", "center");
  txt("along a slanted line", 1400, 915, 26, "#fff", "center");
}

/* main loop*/
// picks the camera and stuff to draw for whatever screen youre on
function currentScene() {
  if (state === "menu") return { cam: menu.cam, list: menu.objs, rows: ROWS_BLACK, haze: 0x000000, wireBg: 0x0b0f1f };
  if (state === "cutscene") return { cam: cs.cam, list: cs.objs, rows: ROWS_BLACK, haze: 0x000000, wireBg: 0x0b0f1f };
  return { cam, list: gameList(), rows: ROWS_GAME, haze: 0xa9c4cc, wireBg: 0x0b0f1f };
}
// moves everything forward a little each frame
function update(dt) {
  if (state === "menu") updateMenu(dt);
  else if (state === "cutscene") updateCutscene(dt);
  else if (state === "play") updatePlay(dt);
}
// draws the frame with whichever level is picked then the text on top
function render() {
  if (state === "test") { renderTest(); return; }
  const sc = currentScene();
  if (renderMode === 1) renderWireHi(sc);
  else if (renderMode === 2) renderLinesLo(sc);
  else renderTrisLo(sc);
  drawHUD(sc);
  if (paused) txt("PAUSED", HI_W / 2, 440, 90, "#fff", "center");
}
// runs about 60 times a second forever
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;   // time since last frame in seconds  capped so a lag spike doesnt teleport stuff
  if (!paused) update(dt);
  render();
  requestAnimationFrame(loop);
}
// start on the menu and kick off the loop
resetMenu();
requestAnimationFrame(loop);
