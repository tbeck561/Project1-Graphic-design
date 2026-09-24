"use strict";
/*
   models  
   simple boxy shapes so all 3 levels look the same
   every model is built around its own center (0 0 0)
   the game makes copies of them with inst and moves or stretches them
   y 0 is the ground so stuff sits on the floor
   the apartment room and door are in cutscenes js
   */

const M = {};

// level 0 cube  2 by 2 by 2 around the center  its the coffee table in the apartment
M.cube = (() => { const m = makeModel();
  addBox(m, -1, -1, -1, 1, 1, 1, 0xd9a066, [0xa0643a, 0x7a4a26, 0x8e5830, 0x8e5830, 0xc98a52, 0x5a3418]);
  return finish(m); })();

// object 1  road piece thats 10 long
M.road = (() => { const m = makeModel();
  fillOnly(() => {                                      // these only show up filled in level 3
    groundQuad(m, -3, -5, 3, 5, 0, 0x3b3d45);             // the road for the 2 car lanes
    groundQuad(m, -6, -5, -3, 5, 0, 0xa5a5ad);            // left sidewalk
    groundQuad(m, 3, -5, 6, 5, 0, 0xa5a5ad);              // right sidewalk
    groundQuad(m, -0.12, -2.5, 0.12, 2.5, 0.02, 0xf2c230);// yellow line in the middle
  });
  // for wireframe just draw lines going down the street so its not cluttered
  addLine(m, [-6, 0, -5], [-6, 0, 5], 0xa5a5ad);        // outside edges of the sidewalks
  addLine(m, [6, 0, -5], [6, 0, 5], 0xa5a5ad);
  addLine(m, [-3, 0, -5], [-3, 0, 5], 0xe9ecef);        // curbs
  addLine(m, [3, 0, -5], [3, 0, 5], 0xe9ecef);
  addLine(m, [0, 0.02, -2.5], [0, 0.02, 2.5], 0xf2c230);// middle yellow line
  return finish(m); })();

// object 2  building  just a box with windows on the side facing the street
// its a 1 by 1 by 1 box and the game stretches it to be wide tall and long
// side is 1 for buildings on the left and -1 for the right so windows face the road
function makeBuilding(col, side) {
  const m = makeModel();
  addBox(m, -0.5, 0, -0.5, 0.5, 1, 0.5, col);                                  // the building
  const x = 0.51 * side, win = shade(col, 0.45);                               // windows go right in front of the wall and are darker
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
    const y0 = 0.15 + r * 0.28, y1 = y0 + 0.16, z0 = -0.35 + c * 0.4, z1 = z0 + 0.3;
    addQuad(m, [x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], win);
  }
  return finish(m);
}
const BUILDING_COLS = [0xb5533c, 0xc9b48a, 0x7a8ca3, 0xd98b5f, 0x8e7cc3, 0x6fae9d];
M.buildingsLeft = BUILDING_COLS.map(c => makeBuilding(c, +1));
M.buildingsRight = BUILDING_COLS.map(c => makeBuilding(c, -1));
M.apartment = makeBuilding(0x9c3d2e, -1);    // the runners building on the right where the run starts

// object 3  car  just a body and a top part
function makeCar(body) {
  const m = makeModel();
  addBox(m, -0.9, 0, -2, 0.9, 1.05, 2, body);
  addBox(m, -0.8, 1.05, -1.1, 0.8, 1.7, 0.9, shade(body, 0.8));
  return finish(m);
}
M.cars = [0xe03131, 0x1971c2, 0xf59f00, 0xf1f3f5, 0x2b8a3e, 0x7048e8].map(makeCar);

// object 4  person  legs body head and a hat if they have one
function makePerson(shirt, pants, skin, hat) {
  const m = makeModel();
  addBox(m, -0.35, 0, -0.15, 0.35, 0.85, 0.15, pants);          // legs
  addBox(m, -0.45, 0.85, -0.2, 0.45, 1.5, 0.2, shirt);          // body
  addBox(m, -0.2, 1.5, -0.2, 0.2, 1.85, 0.2, skin);             // head
  if (hat) addBox(m, -0.25, 1.85, -0.25, 0.25, 2.0, 0.25, hat); // hat
  return finish(m);
}
M.peds = [
  [0x2f9e44, 0x343a40, 0xe0ac80], [0x9c36b5, 0x495057, 0x8d5524],
  [0x1c7ed6, 0x5c3b1e, 0xc68642], [0xf08c00, 0x1b3a5b, 0xf1c27d],
].map(([s, p, k]) => makePerson(s, p, k));
M.player = makePerson(0xff6b1a, 0x2f5cab, 0xe0ac80, 0xd02030);   // runner  orange hoodie and red cap
M.irs = makePerson(0x1f2a44, 0x141b2d, 0xe0ac80, 0x0d0d0d);      // irs guy  dark suit and black hat

// object 5  dollar bill  a flat green box
M.dollar = (() => { const m = makeModel();
  addBox(m, -0.55, -0.28, -0.04, 0.55, 0.28, 0.04, 0x2fa84f);
  return finish(m); })();

// warning stripes that flash on a lane  red for cars  orange for the irs
M.warnCar = (() => { const m = makeModel(); groundQuad(m, -1.4, -1, 1.4, 1, 0.03, 0xff2a2a); return finish(m); })();
M.warnIRS = (() => { const m = makeModel(); groundQuad(m, -1.4, -1, 1.4, 1, 0.03, 0xff9f1a); return finish(m); })();
