"use strict";


let world, player, agent, cam; //declare the world, runner, irs agent, and the camera
let flashT = 0; //the transition from the cutscene

/*starting the game not including the cutscene*/ 
function startRun() {
  state = "play"; flashT = 0.6; //white flash time when game is reset (space, enter or r)

// everything about the run  the stuff on the street  time  dollars  bribes
// and where and when the next road buildings obstacles and rear car show up
  world = {
    objs: [], time: 0, dollars: 0, cash: 0, bribes: 0, bribeT: 0,
    roadZ: -20, bldZ: [-12, 8], spawnZ: 60, nextRear: 5, reason: "", mob: [],
  };
  //the player starts on the right sidewalk gives the z axis and isnt sprinting
  player = { lane: 3, x: LANE_X[3], z: 0, speed: 12, braking: false, sprint: false }; 
  //irs is 6 units behind with a luncge in 6 seconds and none of the 4 lanes are selected
  agent = { x: LANE_X[3] - 0.9, y: 0, z: -6, gap: 6, state: "chase", t: 0, next: 6, target: false };
  //the cameras starting position -9 z behind and the x has bias towards the road
  cam = { x: player.x * 0.7, y: 5, z: -9, back: 0 };
  //runners apartment building where the run starts  its front lines up with the other buildings
  world.objs.push(inst(M.apartment, 12, 0, 0, [10, 16, 14], { kind: "bld" }));
  generate();
}

/* makes one thing on the street and adds it to the world
   kind is what it is like road building car rear car person or dollar so the game knows what to do with it
   model is what it looks like  x y z is where it goes  s is how big
   extra is anything else like how fast it moves down the street or a bounce offset*/
function addObj(kind, model, x, y, z, s, extra) {
  const o = inst(model, x, y, z, s, Object.assign({ kind }, extra || {})); // make the copy with its kind and extras
  world.objs.push(o); return o;                                            // put it on the street and give it back
}

/* keeps the street built 170 ahead of the runner
   runs at the start and every frame so the street never ends*/
function generate() {
  const W = world, ahead = player.z + FAR;          // short names  and how far the street needs to go
  // road is one 10-unit segment at a time until the road reaches ahead
  while (W.roadZ < ahead) { addObj("road", M.road, 0, 0, W.roadZ + 5, 1); W.roadZ += 10; }
  
  // buildings  0 is the left side and 1 is the right side
  for (const s of [0, 1]) while (W.bldZ[s] < ahead) {          
    const w = rand(6, 11), d = rand(8, 16), h = rand(8, 30);   // random size so buildings look different
    // moved out so its front lines up with the street and stretched to its size
    addObj("bld", pick(s ? M.buildingsRight : M.buildingsLeft), (s ? 1 : -1) * (7 + w / 2), 0, W.bldZ[s] + d / 2, [w, h, d]);
    W.bldZ[s] += d + rand(0.5, 2.5);                            // next building starts after this one plus a small gap
  }
  // obstacles and dollars one row at a time
  while (W.spawnZ < ahead) {
    spawnRow(W.spawnZ);
    // rows are spaced out and get closer together the longer you run so its harder
    W.spawnZ += rand(16, 26) - Math.min(6, W.time * 0.04);
  }
}

/* one row of stuff  1 or 2 obstacles and sometimes a line of dollars
   the traffic lane isnt used here because its cars come from behind*/
function spawnRow(z) {
  const lanes = [0, 1, 3].sort(() => Math.random() - 0.5);        // shuffle the three lanes that get obstacles
  const used = lanes.slice(0, Math.random() < 0.35 ? 2 : 1);      // usually 1 obstacle sometimes 2
  for (const l of used) {
    // lane 1 gets a car driving toward you
    if (l === 1) addObj("car", pick(M.cars), LANE_X[1], 0, z, 1, { vz: -rand(7, 11) });   // oncoming
    // the sidewalks get a person  a little off center and a random size
    else addObj("ped", pick(M.peds), LANE_X[l] + rand(-0.4, 0.4), 0, z, rand(0.9, 1.12), {
      vz: l === 0 ? rand(1.2, 1.8) : -rand(1.2, 1.8),        // left side walks away  right side walks toward you
      phase: rand(0, 6) });                                    // so people dont all bounce at the same time
  }
  if (Math.random() < 0.6) {                                   // most rows also get dollars
    const l = pick([0, 1, 2, 3].filter(k => !used.includes(k)));   // in a lane with no obstacle
    // 5 dollars in a line floating a little off the ground
    for (let i = 0; i < 5; i++) addObj("dollar", M.dollar, LANE_X[l], 1.1, z + i * 2.2, 1.2, { phase: i * 0.6 });
  }
}

/* a car from behind in the traffic lane
   it starts 36 back and goes 12 faster than you so it reaches you in exactly 3 seconds  same as the warning*/
function spawnRearCar() {   // starts behind you and gets to you in 3 seconds
  addObj("rearcar", pick(M.cars), LANE_X[2], 0, player.z - REAR_REL * 3, 1);
}

// ends the run and saves why so the audited screen can say it
function gameOver(reason) { state = "gameover"; world.reason = reason; }

/* space uses a bribe so people hold off the irs for 5 seconds*/
function useBribe() {
  const W = world;
  // cant use one if you have none  one is already going  or hes mid jump
  if (W.bribes <= 0 || W.bribeT > 0 || agent.state === "lunge") return;
  W.bribes--; W.bribeT = BRIBE_TIME; agent.state = "bribed";   // use one  start the timer  irs stops chasing
}

/* runs every frame during the run  dt is the time since the last frame*/
function updatePlay(dt) {
  const W = world, P = player;                   // short names
  W.time += dt;                                  // total run time
  if (flashT > 0) flashT -= dt;                  // count down the white flash
  // moving forward  the camera goes forward every frame and up or down changes how fast
  P.sprint = held.has("ArrowUp") || held.has("w");      // holding up means sprint
  P.braking = held.has("ArrowDown") || held.has("s");   // holding down means brake
  const base = Math.min(22, 12 + W.time * 0.12);        // normal speed starts at 12 and slowly goes up to 22
  P.speed = base + (P.sprint ? 6 : 0) - (P.braking ? 6 : 0);   // faster when sprinting slower when braking
  P.z += P.speed * dt;                                  // move forward
  P.x += (LANE_X[P.lane] - P.x) * Math.min(1, dt * 14); // slide over to the lane you picked
  // camera follows you and backs up during a bribe so you can see the fight
  cam.back += ((W.bribeT > 0 ? 5 : 0) - cam.back) * Math.min(1, dt * 3);   // back up a bit during a bribe
  cam.x += (P.x * 0.7 - cam.x) * Math.min(1, dt * 6);   // follow you sideways but stay a little toward the middle
  cam.y = 5 + cam.back * 0.2;                           // above you
  cam.z = P.z - 9 - cam.back;                           // behind you

  generate();                                           // build more street ahead

  W.nextRear -= dt;                                     // counting down to the next car from behind
  // send one then wait a few seconds for the next  shorter wait later in the run
  if (W.nextRear <= 0) { spawnRearCar(); W.nextRear = rand(5, 9) - Math.min(2, W.time * 0.02); }

  // move everything on the street
  for (const o of W.objs) {
    if (o.vz) o.pos[2] += o.vz * dt;                                     // cars and people move down the street
    if (o.kind === "rearcar") o.pos[2] += (P.speed + REAR_REL) * dt;     // always a bit faster than you
    if (o.kind === "dollar") o.pos[1] = 1.1 + Math.sin(W.time * 4 + o.phase) * 0.2;       // dollars bob up and down
    if (o.kind === "ped") o.pos[1] = Math.abs(Math.sin(W.time * 8 + o.phase)) * 0.08;   // people bounce as they walk
  }
  // checking if you hit anything
  for (const o of W.objs) {
    const dz = o.pos[2] - P.z, dx = Math.abs(o.pos[0] - P.x);   // how far it is from you
    // cars are big so you hit them if youre close
    if (o.kind === "car" && Math.abs(dz) < 2.4 && dx < 1.35) return gameOver("Head-on with oncoming traffic.");
    if (o.kind === "rearcar" && Math.abs(dz) < 2.4 && dx < 1.35) return gameOver("Rear-ended. The warning was right there.");
    // people are smaller so you have to be closer to hit them
    if (o.kind === "ped" && Math.abs(dz) < 0.7 && dx < 0.95) return gameOver("You tripped over a pedestrian. The IRS caught up.");
    // dollars you pick up instead of crashing
    if (o.kind === "dollar" && !o.taken && Math.abs(dz) < 1.0 && dx < 1.1) {
      o.taken = true; W.dollars++; W.cash++;                                  // count it
      if (W.cash >= CASH_PER_BRIBE) { W.cash = 0; W.bribes = Math.min(3, W.bribes + 1); }  // every 10 dollars is a bribe  up to 3
    }
  }
  // get rid of stuff behind the camera and dollars you picked up
  W.objs = W.objs.filter(o => {
    if (o.taken) return false;                                       // picked up dollar
    if (o.kind === "rearcar") return o.pos[2] < P.z + FAR + 40;      // rear cars start behind so only remove them once theyre way ahead
    return o.pos[2] + o.model.maxZ * o.scale[2] > cam.z - 2;         // everything else goes once its behind the camera
  });
  updateAgent(dt);                                                   // move the irs guy
}

/* what the irs guy is doing
   normally  chase then warn for 2 seconds then lunge then recover then chase again
   after a bribe  held back for 5 seconds then catch back up then chase*/
function updateAgent(dt) {
  const A = agent, P = player, W = world;        // short names
  // follow  drift toward you but a little to the side so you can see both
  const follow = () => {
    const off = P.lane === 3 ? -0.9 : 0.9;       // stay a little to the side
    A.x += (P.x + off - A.x) * Math.min(1, dt * 3);
  };
  // stay a little behind you  if you brake he catches up and gets you
  const chaseGap = () => {                         // braking lets him catch up
    const target = P.braking ? 1.0 : 2.6;
    A.gap += (target - A.gap) * Math.min(1, dt * (P.braking ? 0.6 : 1.5));
    A.y = Math.abs(Math.sin(W.time * 11)) * 0.12;                 // running bounce
    if (A.gap < 1.4) { gameOver("You slowed down. The IRS thanks you for your cooperation."); return true; }
    return false;
  };
  // bribe timer  when its done he comes back
  if (W.bribeT > 0) { W.bribeT -= dt; if (W.bribeT <= 0) A.state = "return"; }

  switch (A.state) {
    case "chase":                                  // just chasing
      follow(); if (chaseGap()) return;
      A.next -= dt;                                // counting down to the next jump
      // time to jump  start the 2 second warning for the lane youre in right now
      if (A.next <= 0) { A.state = "warn"; A.t = IRS_WARN; A.target = P.lane; }
      break;
    case "warn":                                   // warning  lane is picked
      follow(); if (chaseGap()) return;
      A.t -= dt;                                   // counting down the warning
      // warning over  jump  and remember where he started
      if (A.t <= 0) { A.state = "lunge"; A.t = 0; A.sx = A.x; A.sg = A.gap; }
      break;
    case "lunge": {                                // the jump
      A.t += dt;
      const p = Math.min(1, A.t / 0.35);           // how far into the jump he is
      A.x = lerp(A.sx, LANE_X[A.target], p);       // slide into the lane he picked
      A.gap = lerp(A.sg, -0.2, p);                 // jump forward to where you are
      A.y = Math.sin(p * Math.PI) * 1.5;           // go up and come back down
      if (p >= 1) {                                // landed
        // if youre still in that lane you got caught
        if (Math.abs(P.x - LANE_X[A.target]) < 1.2) return gameOver("The IRS grabbed you mid-leap. Audit time.");
        A.state = "recover"; A.t = 0;              // missed so he gets back up
      }
      break;
    }
    case "recover":                                // getting back into place after missing
      A.t += dt; A.y = 0; follow();
      A.gap += (2.6 - A.gap) * Math.min(1, dt * 3);
      if (A.t > 0.9) { A.state = "chase"; A.next = rand(5, 9); }   // next jump in a few seconds
      break;
    case "bribed":                                 // people are holding him back
      A.gap += (7 - A.gap) * Math.min(1, dt * 1.2);               // he falls back
      A.y = Math.abs(Math.sin(W.time * 18)) * 0.25;               // shaking while hes fighting them
      break;
    case "return":                                 // bribe is over  he catches back up
      follow();
      A.gap += (2.6 - A.gap) * Math.min(1, dt * 1.2);
      A.y = Math.abs(Math.sin(W.time * 11)) * 0.12;
      if (A.gap < 3.2) { A.state = "chase"; A.next = rand(3, 6); } // back in place  next jump comes sooner
      break;
  }
  A.z = P.z - A.gap;                               // turn how far behind he is into where he actually is
  // mob of bribed pedestrians around the agent
  W.mob = [];
  if (A.state === "bribed") {
    const spots = [[-1.0, 0.3], [1.0, 0.3], [-0.5, 1.0], [0.5, 1.0]];   // spots around him
    // one of each person jumping around him
    spots.forEach(([dx, dz], i) => W.mob.push(inst(M.peds[i], A.x + dx, Math.abs(Math.sin(W.time * 14 + i)) * 0.5, A.z + dz, 1)));
  }
}

// everything to draw this frame during the run
function gameList() {
  const W = world, P = player, A = agent, list = W.objs.slice();   // start with everything on the street
  const flash = Math.floor(W.time * 8) % 2 === 0;                  // flips on and off 8 times a second for blinking
  if (state === "play" && flash) {
    // car coming from behind  blinking red stripe in the traffic lane
    for (const o of W.objs) if (o.kind === "rearcar" && o.pos[2] < P.z)
      list.push(inst(M.warnCar, LANE_X[2], 0, P.z + 4, [1, 1, 8]));
    // irs about to jump  blinking orange stripe in that lane
    if (A.state === "warn") list.push(inst(M.warnIRS, LANE_X[A.target], 0, P.z + 3, [1, 1, 6]));
  }
  // the runner bouncing while running  standing still if you lost
  list.push(inst(M.player, P.x, state === "play" ? Math.abs(Math.sin(W.time * 12)) * 0.15 : 0, P.z, 1));
  list.push(inst(M.irs, A.x, A.y, A.z, 0.95));     // the irs agent
  for (const m of W.mob) list.push(m);             // the people you bribed if there are any
  return list;
}
