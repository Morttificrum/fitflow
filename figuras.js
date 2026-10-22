/* FitFlow — figuras dos exercícios.
   Boneco de linha em SVG, de perfil, com 2 quadros (início/fim do movimento) que se alternam.
   Cada pose é definida por ângulos das articulações; o desenho calcula as posições e
   apoia o corpo no chão automaticamente.
   Ângulos em graus. Braços e pernas: 0 = para baixo, 90 = para a frente (direita), 180 = para cima.
   Tronco: 0 = em pé, 90 = inclinado para a frente, -90 = deitado de costas (cabeça à esquerda). */
(function () {
  const L = { torso: 28, shoulder: 25, neck: 9.5, arm1: 14, arm2: 13, leg1: 19, leg2: 19, foot: 6, head: 6.5 };
  const rad = d => d * Math.PI / 180;
  const dn = (a) => [Math.sin(rad(a)), Math.cos(rad(a))];      // direção "a partir de baixo"
  const up = (a) => [Math.sin(rad(a)), -Math.cos(rad(a))];     // direção "a partir de cima"
  const add = (p, v, k) => [p[0] + v[0] * k, p[1] + v[1] * k];

  // P(tronco, braçoPerto[2], braçoLonge[2], pernaPerto[2], pernaLonge[2], opções)
  const P = (t, an, af, ln, lf, o) => Object.assign({ t, an, af, ln, lf }, o || {});

  const POSES = {
    // ── em pé
    stand:      P(0,   [4, 4],     [-4, -4],   [0, 0],     [0, 0]),
    armsup:     P(0,   [175, 178], [165, 170], [0, 0],     [0, 0]),
    armsfwd:    P(0,   [90, 90],   [86, 86],   [0, 0],     [0, 0]),
    armsside:   P(0,   [60, 60],   [-60, -60], [0, 0],     [0, 0]),
    sway_a:     P(-4,  [110, 160], [-30, -60], [8, 2],     [-14, -8]),
    sway_b:     P(4,   [30, 70],   [150, 170], [14, 6],    [-8, -2]),
    tiptoe:     P(0,   [4, 4],     [-4, -4],   [0, 0],     [0, 0], { toe: true }),
    headtilt_a: P(0,   [150, 40],  [4, 4],     [0, 0],     [0, 0], { hd: 28 }),
    headtilt_b: P(0,   [150, 40],  [4, 4],     [0, 0],     [0, 0], { hd: -22 }),
    crossarm:   P(0,   [90, 190],  [86, 86],   [0, 0],     [0, 0]),
    fold:       P(125, [10, 5],    [0, 0],     [0, 0],     [0, 0]),
    halffold:   P(80,  [60, 70],   [50, 60],   [0, 0],     [0, 0]),
    jj_open:    P(0,   [165, 175], [-165, -175], [22, 12], [-22, -12]),
    mountain:   P(0,   [175, 178], [165, 170], [0, 0],     [0, 0]),
    // ── agachar / afundo
    squat:      P(32,  [90, 90],   [86, 86],   [82, -10],  [78, -14]),
    squat_down: P(38,  [90, 90],   [86, 86],   [92, -18],  [88, -20]),
    squat_arms: P(32,  [170, 175], [165, 170], [82, -10],  [78, -14]),
    squat_hands:P(55,  [40, 5],    [30, 0],    [95, -25],  [90, -28]),
    sumo:       P(10,  [40, 80],   [30, 70],   [60, -35],  [50, -40]),
    air:        P(0,   [160, 170], [150, 165], [0, 0],     [0, -10], { air: true }),
    air_squat:  P(12,  [110, 120], [100, 110], [30, -40],  [22, -45], { air: true }),
    lunge_up:   P(0,   [4, 4],     [-4, -4],   [28, 0],    [-28, -8]),
    lunge: P(0,   [4, 4],      [-4, -4],    [72, -4],   [-22, -88]),
    lunge_arms: P(0,   [172, 175], [168, 172], [72, -4],   [-22, -88]),
    warrior2: P(0,   [90, 90],    [-90, -90],  [78, -4],   [-30, -30]),
    lunge_twist:P(0,   [100, 170], [-60, -60], [72, -4],   [-22, -88]),
    pigeon:     P(70,  [90, 90],   [80, 85],   [100, 40],  [-85, -88]),
    pistol:     P(40,  [90, 90],   [86, 86],   [105, -10], [90, 90]),
    // ── sentado (cadeira)
    sit:        P(0,   [4, 4],     [-4, -4],   [90, 0],    [90, 0],  { chair: true }),
    sit_up:     P(0,   [175, 178], [165, 170], [90, 0],    [90, 0],  { chair: true }),
    sit_ball:   P(0,   [70, 110],  [60, 100],  [90, 0],    [90, 0],  { chair: true }),
    sit_push:   P(0,   [90, 90],   [86, 86],   [90, 0],    [90, 0],  { chair: true }),
    sit_pull:   P(0,   [40, 200],  [30, 195],  [90, 0],    [90, 0],  { chair: true }),
    sit_wave_a: P(0,   [100, 160], [30, 70],   [90, 0],    [90, 0],  { chair: true }),
    sit_wave_b: P(0,   [30, 70],   [100, 160], [90, 0],    [90, 0],  { chair: true }),
    sit_twist:  P(0,   [90, 160],  [-60, -90], [90, 0],    [90, 0],  { chair: true, hd: 20 }),
    sit_knee:   P(0,   [4, 4],     [-4, -4],   [90, 0],    [90, 80], { chair: true }),
    sit_lean:   P(25,  [60, 70],   [50, 60],   [90, 0],    [90, 0],  { chair: true }),
    sit_ext:    P(0,   [4, 4],     [-4, -4],   [90, 90],   [90, 90], { chair: true }),
    sit_easy:   P(0,   [60, 100],  [50, 90],   [88, -95],  [92, -100]),
    sit_easy_up:P(0,   [175, 178], [165, 170], [88, -95],  [92, -100]),
    sit_floor:  P(0,   [4, 4],     [-4, -4],   [90, 90],   [90, 90]),
    sit_floor_t:P(8,   [-70, -100],[60, 90],   [90, 90],   [90, 90], { hd: 25 }),
    butterfly:  P(10,  [70, 80],   [60, 70],   [105, -10], [105, -14]),
    butterfly_b:P(12,  [70, 80],   [60, 70],   [118, -5],  [118, -8]),
    boat:       P(-30, [90, 90],   [86, 86],   [135, 135], [135, 135]),
    // ── deitado / chão
    lie:        P(-90, [90, 90],   [90, 90],   [90, 90],   [90, 90]),
    bridge_d:   P(-90, [90, 90],   [90, 90],   [135, 30],  [135, 30]),
    bridge_u:   P(-122,[90, 90],   [90, 90],   [118, 4],   [118, 4]),
    crunch_d:   P(-90, [-90, -90], [-90, -90], [135, 30],  [135, 30]),
    crunch_u:   P(-50, [10, 70],   [20, 70],   [135, 30],  [135, 30]),
    bike_a:     P(-60, [-130, -150],[-130,-150],[150, 60], [90, 100]),
    bike_b:     P(-60, [-130, -150],[-130,-150],[90, 100], [150, 60]),
    legs_down:  P(-90, [90, 90],   [90, 90],   [92, 92],   [92, 92]),
    legs_up:    P(-90, [90, 90],   [90, 90],   [175, 175], [175, 175]),
    deadbug_a:  P(-90, [175, 175], [175, 175], [150, 60],  [150, 60]),
    deadbug_b:  P(-90, [175, 175], [-100,-100],[150, 60],  [100, 95]),
    prone: P(90,  [90, 90],    [90, 90],    [-90, -90], [-90, -90], { prone: true }),
    superman: P(88,  [100, 100],  [105, 105],  [-100, -100],[-102, -102], { prone: true }),
    cobra: P(55,  [0, 0],      [0, 0],      [-90, -90], [-90, -90], { prone: true }),
    fish:       P(-100,[90, 90],   [90, 90],   [90, 90],   [90, 90]),
    // ── quatro apoios / prancha
    quad: P(88,  [0, 0],      [0, 0],      [0, -90],   [0, -90]),
    quad_up: P(74,  [0, 0],      [0, 0],      [0, -90],   [0, -90]),
    quad_dn: P(100, [0, 0],      [0, 0],      [0, -90],   [0, -90]),
    quad_kick: P(88,  [0, 0],      [0, 0],      [0, -90],   [-100, -100]),
    birddog: P(88,  [90, 90],    [0, 0],      [0, -90],   [-100, -100]),
    bear: P(80,  [0, 0],      [0, 0],      [50, -30],  [50, -30]),
    child: P(100, [95, 95],    [95, 95],    [80, -90],  [80, -90]),
    plank: P(83,  [0, 0],      [0, 0],      [-83, -83], [-83, -83]),
    plank_knee: P(83,  [0, 0],      [0, 0],      [-83, -83], [-83, -83], { kneesDown: true }),
    plank_kn_a: P(80,  [0, 0],      [0, 0],      [-83, -83], [-30, -110]),
    plank_kn_b: P(80,  [0, 0],      [0, 0],      [-30, -110],[-83, -83]),
    pushup_up: P(83,  [0, 0],      [0, 0],      [-83, -83], [-83, -83]),
    pushup_dn: P(92,  [-40, 10],   [-40, 10],   [-92, -92], [-92, -92]),
    incline_u: P(60,  [0, 0],      [0, 0],      [-60, -60], [-60, -60]),
    incline_d: P(72,  [-35, 10],   [-35, 10],   [-60, -60], [-60, -60]),
    knee_up: P(75,  [0, 0],      [0, 0],      [-83, -83], [-83, -83], { kneesDown: true }),
    knee_dn: P(88,  [-40, 10],   [-40, 10],   [-92, -92], [-92, -92], { kneesDown: true }),
    chatur: P(94,  [-50, 15],   [-50, 15],   [-96, -96], [-96, -96]),
    sideplank: P(60,  [0, 0],      [180, 180],  [-60, -60], [-60, -60]),
    sideplank_l: P(60,  [0, 0],      [180, 180],  [-60, -60], [-110, -110]),
    downdog: P(135, [45, 45],    [45, 45],    [-45, -45], [-45, -45]),
    pike_dn: P(140, [30, 60],    [30, 60],    [-40, -40], [-40, -40]),
    tree:       P(0,   [175, 178], [165, 170], [0, 0],     [60, -80]),
    warrior1: P(0,   [175, 178],  [168, 172],  [72, -4],   [-30, -30]),
    warrior3:   P(95,  [100, 100], [95, 95],   [0, 0],     [-95, -95]),
    halfmoon:   P(85,  [100, 175], [95, 95],   [0, 0],     [-95, -95]),
    triangle:   P(100, [10, 4],    [175, 178], [28, 0],    [-28, 0]),
    crow:       P(75,  [90, 180],  [90, 175],  [110, 150], [105, 145]),
    wheel:      P(-110,[175, 120], [175, 120], [80, 0],    [80, 0]),
    handstand: P(180, [0, 0],      [0, 0],      [180, 180], [180, 180]),
    hs_down: P(180, [-35, 25],   [-35, 25],   [180, 180], [180, 180]),
    // ── barra
    hang:       P(0,   [180, 180], [180, 180], [0, -5],    [0, -5],  { bar: true }),
    pullup:     P(0,   [150, 40],  [150, 40],  [0, -5],    [0, -5],  { bar: true }),
    invrow_d:   P(-84, [180, 180], [180, 180], [-84, -84], [-84, -84]),
    invrow_u:   P(-70, [130, 40],  [130, 40],  [-84, -84], [-84, -84]),
    lsit: P(0,   [0, 0],      [0, 0],      [90, 90],   [90, 90]),
    fl_tuck:    P(-80, [180, 180], [180, 180], [140, 20],  [140, 20], { bar: true }),
    dragon:     P(-88, [180, 180], [180, 180], [-88, -88], [-88, -88]),
    // ── cadeira de apoio (tai chi de pé)
    horse:      P(0,   [60, 40],   [50, 30],   [40, -30],  [30, -35]),
    taichi_a:   P(0,   [70, 100],  [60, 90],   [30, -10],  [-20, -25]),
    taichi_b:   P(0,   [20, 60],   [110, 150], [-5, -20],  [25, 0]),
    step_a:     P(0,   [4, 4],     [-4, -4],   [70, -10],  [0, 0],   { box: true }),
    step_b:     P(0,   [4, 4],     [-4, -4],   [0, 0],     [0, 0],   { box: true, onbox: true }),
    run_a:      P(10,  [-60, 40],  [60, 90],   [60, -40],  [-40, -80]),
    run_b:      P(10,  [60, 90],   [-60, 40],  [-40, -80], [60, -40]),
    kneeup_a:   P(0,   [-30, 70],  [50, 100],  [92, 0],    [0, 0]),
    kneeup_b:   P(0,   [50, 100],  [-30, 70],  [0, 0],     [92, 0]),
    stance_a:   P(18,  [60, 100],  [50, 90],   [45, -20],  [35, -25]),
    stance_b:   P(18,  [100, 60],  [90, 50],   [38, -25],  [48, -18]),
    bentrow_d:  P(75,  [10, 5],    [0, 0],     [25, -5],   [20, -8]),
    bentrow_u:  P(75,  [60, 200],  [0, 0],     [25, -5],   [20, -8]),
    dip_up:     P(0,   [-30, -10], [-35, -12], [75, 0],    [75, 0],  { behind: true }),
    dip_dn:     P(0,   [-30, 40],  [-35, 35],  [75, 0],    [75, 0],  { behind: true, low: 8 }),
    bulg_a:     P(5,   [4, 4],     [-4, -4],   [30, -5],   [-30, -85]),
    bulg_b:     P(5,   [4, 4],     [-4, -4],   [85, -5],   [-20, -85])
  };

  // ── mapa exercício → [quadro A, quadro B]
  const FIG = {
    f01: ['pushup_up', 'pushup_dn'], f02: ['pushup_up', 'pushup_dn'], f03: ['incline_u', 'incline_d'],
    f04: ['armsfwd', 'squat'], f05: ['sumo', 'squat_down'], f06: ['squat', 'air_squat'], f07: ['lunge_up', 'lunge'],
    f08: ['bridge_d', 'bridge_u'], f09: ['bridge_d', 'bridge_u'], f10: ['plank', 'plank'], f11: ['sideplank', 'sideplank'],
    f12: ['crunch_d', 'crunch_u'], f13: ['bike_a', 'bike_b'], f14: ['prone', 'superman'], f15: ['dip_up', 'dip_dn'],
    f16: ['bentrow_d', 'bentrow_u'], f17: ['stand', 'tiptoe'], f18: ['quad', 'quad_kick'],
    c01: ['stand', 'jj_open'], c02: ['run_a', 'run_b'], c03: ['squat_hands', 'air'], c04: ['plank_kn_a', 'plank_kn_b'],
    c05: ['stand', 'air'], c06: ['kneeup_a', 'kneeup_b'], c07: ['stance_a', 'stance_b'], c08: ['step_a', 'step_b'],
    c09: ['kneeup_a', 'kneeup_b'], c10: ['bear', 'bear'],
    d01: ['sway_a', 'sway_b'], d02: ['sway_a', 'sway_b'], d03: ['stance_a', 'stance_b'], d04: ['sway_a', 'sway_b'],
    d05: ['sway_a', 'jj_open'], d06: ['stance_a', 'sway_b'], d07: ['stance_b', 'stance_a'], d08: ['sway_b', 'stance_a'],
    d09: ['sway_a', 'sway_b'], d10: ['stance_a', 'kneeup_b'],
    x01: ['headtilt_a', 'headtilt_b'], x02: ['sit_floor', 'sit_floor_t'], x03: ['stand', 'fold'], x04: ['child', 'child'],
    x05: ['pigeon', 'pigeon'], x06: ['quad_up', 'quad_dn'], x07: ['lunge_arms', 'lunge_twist'], x08: ['butterfly', 'butterfly_b'],
    x09: ['stand', 'crossarm'], x10: ['fish', 'fish'],
    y01: ['sit_easy', 'sit_easy_up'], y02: ['stand', 'mountain'], y03: ['downdog', 'downdog'], y04: ['warrior1', 'warrior1'],
    y05: ['warrior2', 'warrior2'], y06: ['stand', 'tree'], y07: ['prone', 'cobra'], y08: ['bridge_d', 'bridge_u'],
    y09: ['lie', 'lie'], y10: ['sit_easy', 'sit_easy'], y11: ['mountain', 'fold'], y12: ['squat_arms', 'squat_arms'],
    y13: ['triangle', 'triangle'], y14: ['warrior3', 'warrior3'], y15: ['boat', 'boat'], y16: ['halfmoon', 'halfmoon'],
    y17: ['plank', 'chatur'], y18: ['squat_arms', 'fold'], y19: ['crow', 'crow'], y20: ['wheel', 'wheel'],
    y21: ['handstand', 'handstand'], y22: ['sideplank', 'sideplank_l'], y23: ['plank', 'downdog'],
    k01: ['knee_up', 'knee_dn'], k02: ['sit', 'stand'], k03: ['invrow_d', 'invrow_u'], k04: ['plank_knee', 'plank_knee'],
    k05: ['deadbug_a', 'deadbug_b'], k06: ['quad', 'birddog'], k10: ['bulg_a', 'bulg_b'], k11: ['pushup_up', 'pushup_dn'],
    k12: ['downdog', 'pike_dn'], k13: ['pullup', 'hang'], k14: ['legs_down', 'legs_up'], k15: ['lsit', 'lsit'],
    k16: ['stand', 'pistol'], k20: ['stand', 'pistol'], k21: ['plank', 'incline_d'], k22: ['handstand', 'hs_down'],
    k23: ['fl_tuck', 'fl_tuck'], k24: ['dragon', 'dragon'], k25: ['lsit', 'lsit'], k26: ['hang', 'pullup'],
    t01: ['sit', 'sit_up'], t02: ['sit', 'sit_push'], t03: ['sit_ball', 'sit_ball'], t04: ['sit_wave_a', 'sit_wave_b'],
    t05: ['sit', 'sit_twist'], t06: ['sit', 'sit_knee'], t07: ['stance_a', 'stance_b'], t10: ['sit_pull', 'sit_push'],
    t11: ['sit_pull', 'sit_push'], t12: ['sit_wave_a', 'sit_wave_b'], t13: ['sit_wave_a', 'sit_wave_b'], t14: ['sit', 'stand'],
    t15: ['sit_ball', 'sit_push'], t20: ['sit_ball', 'sit_up'], t21: ['horse', 'horse'], t22: ['taichi_a', 'taichi_b'],
    t23: ['sit_up', 'stand'], t24: ['taichi_a', 'taichi_b'],
    h01: ['squat', 'air_squat'], h02: ['pushup_up', 'pushup_dn'], h03: ['squat_hands', 'air'], h04: ['run_a', 'run_b']
  };
  const FALLBACK = { forca: ['stand', 'squat'], cardio: ['run_a', 'run_b'], danca: ['sway_a', 'sway_b'], flexib: ['stand', 'fold'],
    hiit: ['squat', 'air_squat'], yoga: ['stand', 'mountain'], calist: ['plank', 'pushup_dn'], taichi: ['sit', 'sit_up'] };

  function compute(p) {
    const hip = [0, 0];
    const pts = {};
    pts.hip = hip;
    pts.neck = add(hip, up(p.t), L.torso);
    pts.sh = add(hip, up(p.t), L.shoulder);
    pts.head = add(pts.neck, up(p.t + (p.hd || 0)), L.neck);
    const limb = (root, a, l1, l2) => { const m = add(root, dn(a[0]), l1); const e = add(m, dn(a[1]), l2); return [m, e]; };
    [pts.elN, pts.haN] = limb(pts.sh, p.an, L.arm1, L.arm2);
    [pts.elF, pts.haF] = limb(pts.sh, p.af, L.arm1, L.arm2);
    [pts.knN, pts.anN] = limb(hip, p.ln, L.leg1, L.leg2);
    [pts.knF, pts.anF] = limb(hip, p.lf, L.leg1, L.leg2);
    const foot = (an, a2) => [an[0] + L.foot * Math.cos(rad(a2)), an[1] - L.foot * Math.sin(rad(a2))];
    pts.toN = foot(pts.anN, p.ln[1]); pts.toF = foot(pts.anF, p.lf[1]);
    return pts;
  }

  function frame(poseName, cls) {
    const p = POSES[poseName] || POSES.stand;
    const q = compute(p);
    const all = Object.values(q);
    const maxY0 = Math.max(...all.map(v => v[1]), q.head[1] + L.head), minY0 = Math.min(...all.map(v => v[1]), q.head[1] - L.head);
    const minX0 = Math.min(...all.map(v => v[0]), q.head[0] - L.head), maxX0 = Math.max(...all.map(v => v[0]), q.head[0] + L.head);
    const GROUND = 91;
    // encolhe o desenho se não couber na caixa (braços para cima, saltos etc.)
    const room = 84 - (p.air ? 9 : 0) - (p.onbox ? 8 : 0);
    const sc = Math.min(1, room / (maxY0 - minY0), 104 / (maxX0 - minX0));
    const lift = (p.air ? 9 : 0) + (p.onbox ? 8 : 0) - (p.low || 0);
    const T = v => [(60 + (v[0] - (minX0 + maxX0) / 2) * sc).toFixed(1), (GROUND - lift - (maxY0 - v[1]) * sc).toFixed(1)];
    const pt = {}; for (const k in q) pt[k] = T(q[k]);
    const seg = (a, b, w, o) => `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke-width="${w}"${o ? ' opacity="' + o + '"' : ''}/>`;
    const poly = (pp, w, o) => `<polyline points="${pp.map(v => v.join(',')).join(' ')}" fill="none" stroke-width="${w}"${o ? ' opacity="' + o + '"' : ''}/>`;
    let s = `<g class="${cls}" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" fill="none">`;
    // props
    const gy = GROUND + 0;
    if (p.chair) {
      const sy = (+pt.hip[1] + 4).toFixed(1), hx = +pt.hip[0];
      s += `<g stroke="var(--muted2)" stroke-width="2.4">${seg([hx - 13, sy], [hx + 9, sy], 2.4)}${seg([hx - 13, sy - 30], [hx - 13, gy], 2.4)}${seg([hx + 9, sy], [hx + 9, gy], 2.4)}</g>`;
    }
    if (p.bar) {
      const hy = Math.min(+pt.haN[1], +pt.haF[1]) - 3, hx = +pt.haN[0];
      s += `<g stroke="var(--muted2)" stroke-width="2.4">${seg([hx - 18, hy], [hx + 18, hy], 2.4)}</g>`;
    }
    if (p.box) { const hx = +pt.hip[0] + 12; s += `<rect x="${hx}" y="${gy - 8}" width="22" height="8" rx="1.5" stroke="var(--muted2)" stroke-width="2"/>`; }
    if (p.behind) { const hx = +pt.hip[0] - 8; s += `<g stroke="var(--muted2)" stroke-width="2.4">${seg([hx - 4, (+pt.hip[1] + 4)], [hx - 22, (+pt.hip[1] + 4)], 2.4)}${seg([hx - 22, (+pt.hip[1] + 4)], [hx - 22, gy], 2.4)}</g>`; }
    if (p.air) s += `<ellipse cx="60" cy="${gy + 1}" rx="14" ry="2" fill="var(--muted2)" stroke="none" opacity=".35"/>`;
    // membros do lado de longe (mais claros)
    s += poly([pt.sh, pt.elF, pt.haF], 3.2, 0.5) + poly([pt.hip, pt.knF, pt.anF, pt.toF], 3.2, 0.5);
    // tronco e cabeça
    s += seg(pt.hip, pt.neck, 4.4) + `<circle cx="${pt.head[0]}" cy="${pt.head[1]}" r="${L.head}" fill="var(--bg)" stroke-width="3"/>`;
    // membros do lado de perto
    s += poly([pt.sh, pt.elN, pt.haN], 3.6) + poly([pt.hip, pt.knN, pt.anN, pt.toN], 3.6);
    return s + '</g>';
  }

  function figSVG(id, cat, opts) {
    const pair = FIG[id] || FALLBACK[cat] || FALLBACK.forca;
    const o = opts || {};
    const still = pair[0] === pair[1] || o.still;
    return `<svg class="fig${still ? ' fig-still' : ''}" viewBox="0 0 120 100" role="img" aria-label="${(o.label || 'Figura do exercício').replace(/"/g, '')}">` +
      `<line x1="6" y1="92" x2="114" y2="92" stroke="var(--border2)" stroke-width="1.5"/>` +
      frame(pair[0], 'fa') + (still ? '' : frame(pair[1], 'fb')) + `</svg>`;
  }

  window.FIGURAS = { figSVG, POSES, FIG };
})();
