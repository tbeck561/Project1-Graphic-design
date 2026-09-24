"use strict";
/*
   in class stuff  the drawing steps we learned in lecture
   1 camverts      moves each point to where it is compared to the camera   
   2 project       turns a 3d point into a spot on the screen                 
   3 drawline      draws a line pixel by pixel                               
   4 filltriangle  fills in a triangle and keeps the closest one in front    
   also here  the fake screen and the 3 levels that use the functions above   
*/

/*
   1  model to world to camera   
   slides week 4 for size and position and week 1 day 2 for subtracting the camera
*/
function camVerts(o, cam) {
  const out = [];
  for (const v of o.model.v) {
    // make it the right size  move it to its spot  then subtract the camera
    out.push([v[0] * o.scale[0] + o.pos[0] - cam.x, v[1] * o.scale[1] + o.pos[1] - cam.y, v[2] * o.scale[2] + o.pos[2] - cam.z]);
  }
  return out;
}

/*
   2  pinhole camera   
   slides week 1 day 2  divide x and y by z then put it on the screen
   gives back the screen x  screen y  and 1 over z  works for the big and small screen
*/
function project(p, W, H) { //scales the projections
  const u = p[0] / p[2] //x divided by z
  const v = p[1] / p[2] //y divided by z

  const sx = W/2 + u * (H/2) //calculate updated projection for x
  const sy = H/2 - v * (H/2) //calculate updated projection for y

  return [sx, sy, 1 / p[2]];
}

/*
   the fake 320 by 200 screen   
   frame holds the color of each pixel and depth holds how close the thing in that pixel is  bigger means closer
*/
const frame = [], depth = [];
for (let y = 0; y < LO_H; y++) { frame.push(new Uint32Array(LO_W)); depth.push(new Float32Array(LO_W)); }

function clearFrame(rows) {
  for (let y = 0; y < LO_H; y++) { frame[y].fill(rows[y]); depth[y].fill(0); }
}
function setPixel(x, y, c) {
  if (x >= 0 && x < LO_W && y >= 0 && y < LO_H) frame[y][x] = c;
}
// draws the fake screen with each pixel as a 5 by 5 square
function presentFrame() {
  if (showGrid) {                                  // grid mode  every pixel as its own square with a gap
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, HI_W, HI_H);
    let last = -1;
    for (let y = 0; y < LO_H; y++) for (let x = 0; x < LO_W; x++) {
      const c = frame[y][x];
      if (c !== last) { ctx.fillStyle = css(c); last = c; }
      ctx.fillRect(x * PIX, y * PIX, PIX - 1, PIX - 1);
    }
    return;
  }
  // same squares but pixels next to each other with the same color get drawn together so its faster
  for (let y = 0; y < LO_H; y++) {
    const row = frame[y];
    let x = 0;
    while (x < LO_W) {
      const c = row[x]; let x2 = x + 1;
      while (x2 < LO_W && row[x2] === c) x2++;
      ctx.fillStyle = css(c);
      ctx.fillRect(x * PIX, y * PIX, (x2 - x) * PIX, PIX);
      x = x2;
    }
  }
}

/*
   3  drawing lines on the fake screen   
   slides class 3 and week 3  step one pixel at a time along the longer direction so every slope works
*/
function drawLine(x0, y0, x1, y1, col) {
  const dx = x1 - x0; //the change in x
  const dy = y1 - y0; //the change in y
  const steps = Math.max(Math.abs(dx), Math.abs(dy)); //finds the max number of steps to take to fill pixels

  if (steps === 0) {setPixel(x1, y1, col); return; } // if there are 0 changes return the same line

  const xStep = dx/steps; //the difference over how many steps we need to take
  const yStep = dy/steps;

  let x = x0, y = y0 //start of line
  for (let i = 0; i<= steps; i++){
    setPixel(Math.round(x), Math.round(y), col) //round to the nearest pixel

    x += xStep;
    y += yStep;

  }
}

/*
   4  filling triangles and keeping the closest one in front  
   slides week 3  box around the triangle  weights from areas  and the depth buffer
*/
function area2(p,q,r){
  return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
}

function fillTriangle(a, b, c, col) {
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
  const maxX = Math.min(LO_W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
  const maxY = Math.min(Math.ceil(Math.max(a[1], b[1], c[1])),LO_H - 1,);

  const total = area2(a, b, c);        // area of the whole triangle
  if (total === 0) return;             // flat triangle so nothing to fill

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const p = [x + 0.5, y + 0.5];    // middle of this pixel

      const wa = area2(b, c, p) / total;   // weight of corner a
      const wb = area2(c, a, p) / total    // weight of corner b
      const wc = area2(a, b, p) / total    // weight of corner c

      if (wa >= 0 && wb >= 0 && wc >= 0) {                           // is the pixel inside
        const iz = wa * a[2] + wb * b[2] + wc * c[2];                           // how close this pixel is
        if (iz > depth[y][x]) {                                // is it closer than whats already there
          depth[y][x] = iz;
          frame[y][x] = col;
        }
      }
    }
  }
}

/*
   the 3 levels   
   each one goes through every object  uses camverts and project  then draws it a different way
*/

// level 1  wireframe using the canvas line drawing on the big screen
function renderWireHi(sc) {
  ctx.fillStyle = css(sc.wireBg);
  ctx.fillRect(0, 0, HI_W, HI_H);
  ctx.lineWidth = 2; ctx.lineCap = "round";
  const paths = new Map();                       // group lines by color so its faster
  for (const o of sc.list) {
    if (!inView(o, sc.cam)) continue;
    const cv = camVerts(o, sc.cam);
    for (const e of o.model.e) {
      const seg = clipSegNear(cv[e[0]], cv[e[1]]);
      if (!seg) continue;
      const a = project(seg[0], HI_W, HI_H), b = project(seg[1], HI_W, HI_H);
      const col = fog(mix(e[2], 0xffffff, 0.3), (seg[0][2] + seg[1][2]) / 2, sc.wireBg);
      let p = paths.get(col); if (!p) { p = new Path2D(); paths.set(col, p); }
      p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]);
    }
  }
  for (const [col, p] of paths) { ctx.strokeStyle = css(col); ctx.stroke(p); }
}

// level 2  same lines but drawn with my drawline on the fake screen
function renderLinesLo(sc) {
  clearFrame(ROWS_DARK);
  for (const o of sc.list) {
    if (!inView(o, sc.cam)) continue;
    const cv = camVerts(o, sc.cam);
    for (const e of o.model.e) {
      const seg = clipSegNear(cv[e[0]], cv[e[1]]);
      if (!seg) continue;
      const a = project(seg[0], LO_W, LO_H), b = project(seg[1], LO_W, LO_H);
      const c = clip2D(a[0], a[1], b[0], b[1], LO_W - 0.001, LO_H - 0.001);
      if (!c) continue;
      const col = fog(mix(e[2], 0xffffff, 0.3), (seg[0][2] + seg[1][2]) / 2, 0x0b0f1f);
      drawLine(Math.floor(c[0]), Math.floor(c[1]), Math.floor(c[2]), Math.floor(c[3]), col);
    }
  }
  presentFrame();
}

// level 3  filled triangles using my filltriangle on the fake screen
function renderTrisLo(sc) {
  clearFrame(sc.rows);
  for (const o of sc.list) {
    if (!inView(o, sc.cam)) continue;
    const cv = camVerts(o, sc.cam);
    for (const t of o.model.t) {
      const p0 = cv[t[0]], p1 = cv[t[1]], p2 = cv[t[2]];
      if (p0[2] > FAR && p1[2] > FAR && p2[2] > FAR) continue;
      const poly = clipPolyNear([p0, p1, p2]);
      if (poly.length < 3) continue;
      const col = fog(t[3], (p0[2] + p1[2] + p2[2]) / 3, sc.haze);
      const pr = poly.map(p => project(p, LO_W, LO_H));
      for (let i = 1; i < pr.length - 1; i++) fillTriangle(pr[0], pr[i], pr[i + 1], col);
    }
  }
  presentFrame();
}
