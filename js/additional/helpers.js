"use strict";
/*
   setup and helpers  
   this file loads first because every other file uses stuff from here
   has the settings  game state  color stuff  model building  copies
   of models  cutting off stuff behind the camera  fog and the background
*/

// canvas and settings
const canvas = document.getElementById("screen");
const ctx = canvas.getContext("2d");
const HI_W = 1600, HI_H = 1000;      // size of the big screen for level 1
const LO_W = 320,  LO_H = 200;       // size of the fake old school screen
const PIX = 5;                       // each fake pixel is drawn as a 5 by 5 square
const HORIZON = 0.5;                 // straight ahead is the middle of the screen same as my project
const NEAR = 0.1;                    // anything closer than this to the camera gets cut off
const FAR = 170;                     // anything farther than this doesnt get drawn
const FOG_START = 110;               // stuff starts fading out past this distance
const LANE_X = [-4.5, -1.5, 1.5, 4.5];   // where the middle of each lane is
const LANE_NAME = ["LEFT SIDEWALK", "ONCOMING LANE", "TRAFFIC LANE", "RIGHT SIDEWALK"];
const REAR_REL = 12;                 // cars from behind go 12 faster than you so the warning is exactly 3 seconds
const IRS_WARN = 2;                  // how many seconds of warning before the irs jumps
const BRIBE_TIME = 5;                // how long a bribe lasts
const CASH_PER_BRIBE = 10;           // dollars needed for 1 bribe

// stuff every file can see
let renderMode = 3, showGrid = false, paused = false;   // which level  pixel grid on or off  paused or not
let state = "menu";                  // what screen were on  menu cutscene play gameover or test
let stateBeforeTest = "menu";        // where to go back to after the test bench

// small helpers
const rand = (a, b) => a + Math.random() * (b - a);            // random number between a and b
const pick = a => a[Math.floor(Math.random() * a.length)];      // random item from a list
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;           // keep a number between a and b
const lerp = (a, b, t) => a + (b - a) * t;                      // go part of the way from a to b

// color helpers  colors are stored as numbers like 0xff0000 for red
const cssCache = new Map();
function css(c) {                    // turns a color number into the text the canvas wants
  let s = cssCache.get(c);
  if (!s) { s = "#" + c.toString(16).padStart(6, "0"); cssCache.set(c, s); }
  return s;
}
function shade(c, k) {               // makes a color darker or brighter
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
  const b = Math.min(255, Math.round((c & 255) * k));
  return (r << 16) | (g << 8) | b;
}
function mix(a, b, t) {              // blends two colors together
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
}

/* building models
   a model has points  lines between points for the wireframe levels
   and triangles for level 3*/
function makeModel() { return { v: [], e: [], t: [] }; }

/* stuff built inside fillonly only gets triangles and no lines
   the road uses this so the wireframe is just a few lines down the street
   addline does the opposite  just a line and no triangles*/
let WIRE_ON = true;
function fillOnly(build) { const prev = WIRE_ON; WIRE_ON = false; build(); WIRE_ON = prev; }
function addLine(m, a, b, col) {
  const i = m.v.length;
  m.v.push(a, b);
  m.e.push([i, i + 1, col]);
}

function addQuad(m, a, b, c, d, col) {   // a flat 4 sided shape
  const i = m.v.length;
  m.v.push(a, b, c, d);
  if (WIRE_ON) m.e.push([i, i + 1, col], [i + 1, i + 2, col], [i + 2, i + 3, col], [i + 3, i, col]);
  m.t.push([i, i + 1, i + 2, col], [i, i + 2, i + 3, col]);   // split into 2 triangles
}
function groundQuad(m, x0, z0, x1, z1, y, col) {   // a flat 4 sided shape lying on the ground
  addQuad(m, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], col);
}
const BOX_EDGES = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];   // the 12 lines of a box
// the 6 sides of a box and how bright each one is so you can tell the sides apart
const BOX_FACES = [[0,1,2,3,0.85],[4,5,6,7,0.6],[0,3,7,4,0.7],[1,2,6,5,0.7],[3,2,6,7,1.0],[0,1,5,4,0.45]];
function addBox(m, x0, y0, z0, x1, y1, z1, col, faceCols) {   // a box from one corner to the other
  const i = m.v.length;
  m.v.push([x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]);
  if (WIRE_ON) for (const [a, b] of BOX_EDGES) m.e.push([i + a, i + b, col]);
  BOX_FACES.forEach((f, k) => {
    const c = shade(faceCols ? faceCols[k] : col, f[4]);
    m.t.push([i + f[0], i + f[1], i + f[2], c], [i + f[0], i + f[2], i + f[3], c]);   // each side is 2 triangles
  });
}
function finish(m) {                 // remembers how far forward and back the model goes so we can skip it if its behind us
  let a = Infinity, b = -Infinity;
  for (const v of m.v) { a = Math.min(a, v[2]); b = Math.max(b, v[2]); }
  m.minZ = a; m.maxZ = b;
  return m;
}

/* copies of models
   each copy has a model  a position  and a size
   the game stretches the model by the size then moves it to the position  no spinning*/
function inst(model, x, y, z, s, extra) {
  return Object.assign({ model, pos: [x, y, z], scale: Array.isArray(s) ? s : [s, s, s] }, extra || {});
}
function inView(o, cam) {            // false if the whole thing is behind the camera or way too far
  const z0 = o.pos[2] + o.model.minZ * o.scale[2] - cam.z;
  const z1 = o.pos[2] + o.model.maxZ * o.scale[2] - cam.z;
  return z1 > NEAR && z0 < FAR;
}

/* cutting off stuff behind the camera  we havent learned this in class yet*/
// if a line goes behind the camera cut it where it passes the camera and keep the front part
function clipSegNear(a, b) {
  const ain = a[2] >= NEAR, bin = b[2] >= NEAR;
  if (!ain && !bin) return null;
  if (ain && bin) return [a, b];
  const t = (NEAR - a[2]) / (b[2] - a[2]);
  const p = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), NEAR];
  return ain ? [a, p] : [p, b];
}
// same thing for triangles  what is left can have 3 or 4 corners
function clipPolyNear(poly) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const A = poly[i], B = poly[(i + 1) % poly.length];
    const ain = A[2] >= NEAR, bin = B[2] >= NEAR;
    if (ain) out.push(A);
    if (ain !== bin) {
      const t = (NEAR - A[2]) / (B[2] - A[2]);
      out.push([A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1]), NEAR]);
    }
  }
  return out;
}
// trims a line to the edges of the screen so we dont try to draw thousands of pixels off screen
function clip2D(x0, y0, x1, y1, xmax, ymax) {
  let t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  const p = [-dx, dx, -dy, dy], q = [x0, xmax - x0, y0, ymax - y0];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; continue; }
    const r = q[i] / p[i];
    if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; }
    else          { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
}

/* fog and background*/
function fog(col, z, haze) {         // far away stuff fades into the background color
  if (z <= FOG_START) return col;
  return mix(col, haze, Math.min(0.92, (z - FOG_START) / (FAR - FOG_START)));
}
// background colors for each row of the fake screen  a sky that fades in stripes like old games
function skyRows(top, bottom, below) {
  const rows = [], hy = Math.floor(LO_H * HORIZON);
  for (let y = 0; y < LO_H; y++) rows.push(y < hy ? mix(top, bottom, Math.floor(y / hy * 8) / 8) : below);
  return rows;
}
const ROWS_GAME = skyRows(0x3f86d4, 0xbfe3f2, 0xa9c4cc);   // blue sky for the street
const ROWS_BLACK = skyRows(0x000000, 0x000000, 0x000000);  // black for the apartment
const ROWS_DARK = skyRows(0x0b0f1f, 0x0b0f1f, 0x0b0f1f);   // dark blue for level 2 and the test bench
