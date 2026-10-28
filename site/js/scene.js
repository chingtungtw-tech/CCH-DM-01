/**
 * 彰基內分泌健康迷思群島 - 3D 景觀核心 (2D 可愛卡通風格 / 豐富明亮版)
 * 核心樞紐：彰化基督教醫院 內分泌暨新陳代謝科
 * 七大主題島嶼：糖尿病、健康減重、骨質疏鬆、肌少症、代謝症候群、牙周共病、甲狀腺疾病
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class IslandScene {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.onSelectIsland = options.onSelectIsland || (() => {});
    this.onSelectBuilding = options.onSelectBuilding || (() => {});

    this.currentTheme = options.currentTheme || 'mint';
    this.dayNightMode = options.dayNightMode || 'day';
    this.reducedMotion = options.reducedMotion || false;

    this.selectedIslandId = null;
    this.selectedBuildingId = null;

    // Camera animation state (High overview looking down over sunny vibrant archipelago)
    this.cameraTargetPos = new THREE.Vector3(0, 36, 52);
    this.controlsTargetPos = new THREE.Vector3(0, 0, 0);
    this.isAnimatingCamera = false;

    // Objects
    this.islandMeshes = [];
    this.buildingMeshes = [];
    this.villagers = [];
    this.boats = [];
    this.animatedObjects = [];
    this.clouds = [];
    this.sparkles = [];

    // Raycasting
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-999, -999);

    this.setupIslandDefinitions();
    this.init();
  }

  setupIslandDefinitions() {
    const angleStep = (Math.PI * 2) / 7;
    const baseAngle = -Math.PI / 2; // Island 1 at front (South)
    const dist = 26;

    this.islandDefs = {
      'island-center': {
        id: 'island-center',
        name: '彰化基督教醫院 內分泌暨新陳代謝科',
        pos: new THREE.Vector3(0, 0, 0),
        radius: 9.2,
        height: 2.5,
        color: 0x48cae4, // Lagoon crystal turquoise base
        grassColor: 0x5eead4, // Bright candy mint grass
        topY: 2.2,
        tagY: 5.8
      },
      'island-01': {
        id: 'island-01',
        order: 1,
        name: '糖尿病迷思島',
        angle: baseAngle,
        pos: new THREE.Vector3(Math.cos(baseAngle) * dist, 0, Math.sin(baseAngle) * dist),
        radius: 6.8,
        height: 2.1,
        color: 0x38bdf8,
        grassColor: 0x6ee7b7, // Mint green
        roofColor: 0xf43f5e,  // Strawberry red
        topY: 1.8,
        tagY: 5.0
      },
      'island-02': {
        id: 'island-02',
        order: 2,
        name: '健康減重迷思島',
        angle: baseAngle + angleStep,
        pos: new THREE.Vector3(Math.cos(baseAngle + angleStep) * dist, 0, Math.sin(baseAngle + angleStep) * dist),
        radius: 6.8,
        height: 2.1,
        color: 0x38bdf8,
        grassColor: 0xfde047, // Cheerful lemon-lime
        roofColor: 0xf97316,  // Cheerful orange
        topY: 1.8,
        tagY: 5.0
      },
      'island-03': {
        id: 'island-03',
        order: 3,
        name: '骨質疏鬆迷思島',
        angle: baseAngle + angleStep * 2,
        pos: new THREE.Vector3(Math.cos(baseAngle + angleStep * 2) * dist, 0, Math.sin(baseAngle + angleStep * 2) * dist),
        radius: 6.8,
        height: 2.1,
        color: 0x38bdf8,
        grassColor: 0xa7f3d0, // Soft milk pastel
        roofColor: 0x06b6d4,  // Milk blue
        topY: 1.8,
        tagY: 5.0
      },
      'island-04': {
        id: 'island-04',
        order: 4,
        name: '肌少症迷思島',
        angle: baseAngle + angleStep * 3,
        pos: new THREE.Vector3(Math.cos(baseAngle + angleStep * 3) * dist, 0, Math.sin(baseAngle + angleStep * 3) * dist),
        radius: 6.8,
        height: 2.1,
        color: 0x38bdf8,
        grassColor: 0xfbcfe8, // Cheerful candy rose
        roofColor: 0xd946ef,  // Bubblegum magenta
        topY: 1.8,
        tagY: 5.0
      },
      'island-05': {
        id: 'island-05',
        order: 5,
        name: '代謝症候群迷思島',
        angle: baseAngle + angleStep * 4,
        pos: new THREE.Vector3(Math.cos(baseAngle + angleStep * 4) * dist, 0, Math.sin(baseAngle + angleStep * 4) * dist),
        radius: 6.8,
        height: 2.1,
        color: 0x38bdf8,
        grassColor: 0xfef08a, // Golden sunshine
        roofColor: 0xef4444,  // Bright red
        topY: 1.8,
        tagY: 5.0
      },
      'island-06': {
        id: 'island-06',
        order: 6,
        name: '牙周病共病迷思島',
        angle: baseAngle + angleStep * 5,
        pos: new THREE.Vector3(Math.cos(baseAngle + angleStep * 5) * dist, 0, Math.sin(baseAngle + angleStep * 5) * dist),
        radius: 6.8,
        height: 2.1,
        color: 0x38bdf8,
        grassColor: 0xbae6fd, // Clean sky cyan
        roofColor: 0x3b82f6,  // Bright tooth blue
        topY: 1.8,
        tagY: 5.0
      },
      'island-07': {
        id: 'island-07',
        order: 7,
        name: '甲狀腺疾病迷思島',
        angle: baseAngle + angleStep * 6,
        pos: new THREE.Vector3(Math.cos(baseAngle + angleStep * 6) * dist, 0, Math.sin(baseAngle + angleStep * 6) * dist),
        radius: 6.8,
        height: 2.1,
        color: 0x38bdf8,
        grassColor: 0xe9d5ff, // Dreamy lavender
        roofColor: 0x8b5cf6,  // Butterfly purple
        topY: 1.8,
        tagY: 5.0
      }
    };
  }

  getIslandDef(id) {
    return this.islandDefs[id] || null;
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // Detect software WebGL
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return false;
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const rendererStr = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
      return /SwiftShader|llvmpipe|Software/i.test(rendererStr);
    })();

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 500);
    this.camera.position.set(0, 36, 52);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18; // Bright, rich, vibrant exposure
    this.container.appendChild(this.renderer.domElement);

    // 4. Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.15;
    this.controls.minDistance = 14;
    this.controls.maxDistance = 120;
    this.controls.target.set(0, 0, 0);

    // 5. Lighting
    this.setupLighting();

    // 6. Build Scene Objects (Cartoon Sky, Rainbow, Ocean, 8 Islands, Bridges, Boats, Fluffy Clouds)
    this.buildSkyAndRainbow();
    this.buildOcean();
    this.buildPuffyClouds();
    this.buildArchipelago();
    this.buildBridgesAndBoats();
    this.buildVillagers();
    this.buildSparkles();

    // 7. Event Listeners
    window.addEventListener('resize', () => this.onWindowResize());
    this.container.addEventListener('pointermove', (e) => this.onPointerMove(e));
    this.container.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.container.addEventListener('click', (e) => this.onClick(e));

    // 8. Start Loop
    this.clock = new THREE.Clock();
    this.animate();
  }

  // --- Vibrant & Bright Lighting Setup ---
  setupLighting() {
    // Rich, warm ambient lighting for cheerful cartoon clarity
    this.ambientLight = new THREE.AmbientLight(0xfff5ea, 1.05);
    this.scene.add(this.ambientLight);

    // Golden cartoon sunlight
    this.dirLight = new THREE.DirectionalLight(0xfff0db, 1.5);
    this.dirLight.position.set(30, 52, 26);
    if (!this.isSoftwareGl) {
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.width = 2048;
      this.dirLight.shadow.mapSize.height = 2048;
      this.dirLight.shadow.camera.near = 10;
      this.dirLight.shadow.camera.far = 150;
      this.dirLight.shadow.camera.left = -45;
      this.dirLight.shadow.camera.right = 45;
      this.dirLight.shadow.camera.top = 45;
      this.dirLight.shadow.camera.bottom = -45;
      this.dirLight.shadow.bias = -0.0004;
    }
    this.scene.add(this.dirLight);

    // Cheerful sky / ground fill light
    this.hemisphereLight = new THREE.HemisphereLight(0xbae6fd, 0x86efac, 0.7);
    this.scene.add(this.hemisphereLight);

    this.applyDayNightLighting(this.dayNightMode);
    this.applyThemeColors(this.currentTheme);
  }

  applyDayNightLighting(mode) {
    this.dayNightMode = mode;
    if (mode === 'day') {
      this.ambientLight.intensity = 1.05;
      this.ambientLight.color.setHex(0xfff8ee);
      this.dirLight.intensity = 1.5;
      this.dirLight.color.setHex(0xfff0db);
      this.dirLight.position.set(30, 52, 26);
      this.hemisphereLight.intensity = 0.7;
      this.hemisphereLight.color.setHex(0xbae6fd);
      this.hemisphereLight.groundColor.setHex(0x86efac);
    } else if (mode === 'sunset') {
      this.ambientLight.intensity = 0.9;
      this.ambientLight.color.setHex(0xffdfcb);
      this.dirLight.intensity = 1.35;
      this.dirLight.color.setHex(0xffa07a);
      this.dirLight.position.set(45, 22, 22);
      this.hemisphereLight.intensity = 0.55;
      this.hemisphereLight.color.setHex(0xfecdd3);
      this.hemisphereLight.groundColor.setHex(0xfb923c);
    } else if (mode === 'night') {
      this.ambientLight.intensity = 0.5;
      this.ambientLight.color.setHex(0x4c6ef5);
      this.dirLight.intensity = 0.75;
      this.dirLight.color.setHex(0xc084fc);
      this.dirLight.position.set(-25, 40, -25);
      this.hemisphereLight.intensity = 0.45;
      this.hemisphereLight.color.setHex(0x38bdf8);
      this.hemisphereLight.groundColor.setHex(0x1e293b);
    }
  }

  applyThemeColors(theme) {
    this.currentTheme = theme;
    // Default bright, rich sunny cyan-turquoise lagoon
    let oceanColor = 0x22d3ee;
    let skyFogColor = 0xe0f2fe;

    if (theme === 'paper') {
      oceanColor = 0xfacc15;
      skyFogColor = 0xfef9c3;
    } else if (theme === 'ink') {
      oceanColor = 0x1e293b;
      skyFogColor = 0x0f172a;
    }

    if (this.oceanMesh) {
      this.oceanMesh.material.color.setHex(oceanColor);
    }
    this.scene.background = new THREE.Color(skyFogColor);
    this.scene.fog = new THREE.FogExp2(skyFogColor, 0.0055); // Very clear view
  }

  // --- Cartoon Sky & Rainbow ---
  buildSkyAndRainbow() {
    // Pastel Rainbow Arch across the horizon
    const rainbowGroup = new THREE.Group();
    rainbowGroup.position.set(0, 0, -42);
    rainbowGroup.rotation.y = 0.15;

    const colors = [0xf43f5e, 0xfb923c, 0xfacc15, 0x4ade80, 0x38bdf8, 0xa855f7];
    colors.forEach((col, idx) => {
      const radius = 55 + idx * 0.7;
      const arcGeo = new THREE.TorusGeometry(radius, 0.35, 8, 48, Math.PI);
      const arcMat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide
      });
      const arcMesh = new THREE.Mesh(arcGeo, arcMat);
      arcMesh.rotation.x = Math.PI / 18;
      rainbowGroup.add(arcMesh);
    });
    this.scene.add(rainbowGroup);
  }

  // --- Tropical Lagoon Ocean with Wave Ripples ---
  buildOcean() {
    const oceanGeo = new THREE.PlaneGeometry(280, 280, 48, 48);
    oceanGeo.rotateX(-Math.PI / 2);

    const pos = oceanGeo.attributes.position;
    this.oceanInitialY = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const wave = Math.sin(x * 0.08) * 0.18 + Math.cos(z * 0.08) * 0.18;
      pos.setY(i, wave - 0.2);
      this.oceanInitialY[i] = wave - 0.2;
    }
    oceanGeo.computeVertexNormals();

    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x22d3ee, // Crystal turquoise
      roughness: 0.15,
      metalness: 0.1,
      flatShading: true,
      transparent: true,
      opacity: 0.94
    });

    this.oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    this.oceanMesh.position.y = -0.1;
    this.oceanMesh.receiveShadow = !this.isSoftwareGl;
    this.scene.add(this.oceanMesh);
  }

  // --- Fluffy 3D Cartoon Clouds drifting in the sky ---
  buildPuffyClouds() {
    const cloudConfigs = [
      { x: -38, y: 24, z: -15, scale: 1.4, speed: 0.35 },
      { x: 35, y: 28, z: -25, scale: 1.6, speed: 0.28 },
      { x: -15, y: 30, z: 25, scale: 1.2, speed: 0.4 },
      { x: 28, y: 22, z: 20, scale: 1.5, speed: 0.32 },
      { x: 0, y: 32, z: -35, scale: 1.8, speed: 0.25 },
      { x: -45, y: 26, z: 15, scale: 1.3, speed: 0.38 }
    ];

    cloudConfigs.forEach((cfg) => {
      const cloud = this.createCartoonCloud(cfg.scale);
      cloud.position.set(cfg.x, cfg.y, cfg.z);
      this.scene.add(cloud);
      this.clouds.push({ mesh: cloud, speed: cfg.speed, startX: cfg.x });
    });
  }

  createCartoonCloud(scale = 1) {
    const cloud = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      flatShading: true
    });

    // Cluster of 5 puffy overlapping spheres
    const spheres = [
      { r: 1.8, x: 0, y: 0, z: 0 },
      { r: 1.4, x: -1.6, y: -0.2, z: 0 },
      { r: 1.3, x: 1.6, y: -0.2, z: 0 },
      { r: 1.2, x: -0.8, y: 0.7, z: 0.4 },
      { r: 1.1, x: 0.8, y: 0.6, z: -0.3 }
    ];

    spheres.forEach((s) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(s.r * scale, 8, 8), cloudMat);
      mesh.position.set(s.x * scale, s.y * scale, s.z * scale);
      cloud.add(mesh);
    });

    return cloud;
  }

  // --- Cartoon Floating Sparkles (Fairy Dust over Archipelago) ---
  buildSparkles() {
    const sparkleGeo = new THREE.OctahedronGeometry(0.18, 0);
    const sparkleMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.85 });

    for (let i = 0; i < 24; i++) {
      const sparkle = new THREE.Mesh(sparkleGeo, sparkleMat);
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 30;
      sparkle.position.set(Math.cos(a) * r, 2.5 + Math.random() * 8, Math.sin(a) * r);
      this.scene.add(sparkle);
      this.sparkles.push({
        mesh: sparkle,
        speed: 0.5 + Math.random() * 0.8,
        offset: Math.random() * Math.PI * 2,
        baseY: sparkle.position.y
      });
    }
  }

  // --- Cute Cartoon Island Base Generator ---
  createCartoonIsland(radius, height, segments, grassColor, pos) {
    const islandGroup = new THREE.Group();
    islandGroup.position.copy(pos);

    // 1. Soft golden sand base (chubby cylinder)
    const sandGeo = new THREE.CylinderGeometry(radius * 1.14, radius * 0.75, height, segments);
    const sandMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a, // Warm butter-yellow beach sand
      roughness: 0.6,
      flatShading: true
    });
    const sandMesh = new THREE.Mesh(sandGeo, sandMat);
    sandMesh.position.y = height / 2 - 0.7;
    sandMesh.receiveShadow = !this.isSoftwareGl;
    islandGroup.add(sandMesh);

    // 2. White seafoam ring around island
    const foamGeo = new THREE.RingGeometry(radius * 1.08, radius * 1.25, segments);
    foamGeo.rotateX(-Math.PI / 2);
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    const foamMesh = new THREE.Mesh(foamGeo, foamMat);
    foamMesh.position.y = 0.05;
    islandGroup.add(foamMesh);

    // 3. Cute puffy grass top (vibrant candy pastel)
    const grassGeo = new THREE.CylinderGeometry(radius * 0.98, radius * 1.05, 0.7, segments);
    const grassMat = new THREE.MeshStandardMaterial({
      color: grassColor || 0x4ade80,
      roughness: 0.7,
      flatShading: true
    });
    const grassMesh = new THREE.Mesh(grassGeo, grassMat);
    grassMesh.position.y = height - 0.15;
    grassMesh.receiveShadow = !this.isSoftwareGl;
    islandGroup.add(grassMesh);

    return { islandGroup, topY: height + 0.2, radius };
  }

  // --- Build Entire Archipelago (Center + 7 Outer Islands) ---
  buildArchipelago() {
    // 1. Central Island: 彰化基督教醫院 內分泌暨新陳代謝科
    const centerDef = this.islandDefs['island-center'];
    const center = this.createCartoonIsland(centerDef.radius, centerDef.height, 22, centerDef.grassColor, centerDef.pos);
    this.centerIslandGroup = center.islandGroup;
    this.centerIslandGroup.userData = { id: 'island-center', name: centerDef.name, type: 'island', center: centerDef.pos };
    this.scene.add(this.centerIslandGroup);
    this.islandMeshes.push(this.centerIslandGroup);

    this.buildCartoonMedicalCastle(this.centerIslandGroup, center.topY);
    this.decorateCartoonIsland(this.centerIslandGroup, center.topY, centerDef.radius * 0.85);

    // 2. 7 Surrounding Outer Islands
    const outerKeys = ['island-01', 'island-02', 'island-03', 'island-04', 'island-05', 'island-06', 'island-07'];
    outerKeys.forEach((key) => {
      const def = this.islandDefs[key];
      const isl = this.createCartoonIsland(def.radius, def.height, 18, def.grassColor, def.pos);
      const group = isl.islandGroup;
      group.userData = { id: def.id, name: def.name, order: def.order, type: 'island', center: def.pos };
      this.scene.add(group);
      this.islandMeshes.push(group);

      // Cute 2D cartoon landmark building
      this.buildCartoonLandmark(group, def, isl.topY);

      // Cute storybook mushroom/candy cottages
      this.buildCartoonMythCottages(group, def, isl.topY);

      // Cute colorful trees, daisies, mushrooms
      this.decorateCartoonIsland(group, isl.topY, def.radius * 0.82);
    });
  }

  // --- Central Island: Cute 2D Cartoon Fairy-tale Medical Castle ---
  buildCartoonMedicalCastle(group, topY) {
    const hub = new THREE.Group();
    hub.position.set(0, topY, 0);

    // 1. Tiered Candy Base (Pastel Peach)
    const basePodium = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 4.8, 0.45, 18),
      new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.5, flatShading: true })
    );
    basePodium.position.y = 0.22;
    hub.add(basePodium);

    // 2. Cute Main Castle Rotunda (Cream White)
    const castleBody = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 3.0, 2.6, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, flatShading: true })
    );
    castleBody.position.y = 1.6;
    hub.add(castleBody);

    // 4 Cute Round Turret Towers around corners
    const turretMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const coneMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 }); // Sky blue cone roofs
    const turretRadius = 3.2;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const tx = Math.cos(a) * turretRadius;
      const tz = Math.sin(a) * turretRadius;

      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 2.8, 10), turretMat);
      tower.position.set(tx, 1.6, tz);
      hub.add(tower);

      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.4, 10), coneMat);
      roof.position.set(tx, 3.6, tz);
      hub.add(roof);
    }

    // 3. Giant Cute 3D Red Health Cross Emblem (with rounded edges)
    const crossMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.2, emissive: 0xb91c1c, emissiveIntensity: 0.3 });
    const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.38, 0.16), crossMat);
    crossH.position.set(0, 2.1, 2.92);
    hub.add(crossH);
    const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.2, 0.16), crossMat);
    crossV.position.set(0, 2.1, 2.92);
    hub.add(crossV);

    // 4. Striped Candy Awning over Main Entrance
    const awningMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.4 });
    const awning = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.3, 10, 1, false, 0, Math.PI), awningMat);
    awning.position.set(0, 1.25, 2.9);
    awning.rotation.x = -Math.PI / 8;
    hub.add(awning);

    // 5. Fluffy Cartoon Dome (Candy Coral / Rose)
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.3, flatShading: true })
    );
    dome.position.y = 2.9;
    hub.add(dome);

    // 6. Cute Central Clock Spire with Smiling Clock
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.85, 2.4, 10),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
    );
    spire.position.y = 5.2;
    hub.add(spire);

    // Smiling Clock Face
    const clockDial = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.3 })
    );
    clockDial.rotation.x = Math.PI / 2;
    clockDial.position.set(0, 5.2, 0.72);
    hub.add(clockDial);

    // Spinning Golden Star Beacon
    const starGeo = new THREE.OctahedronGeometry(0.85, 0);
    const starMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.9,
      roughness: 0.1
    });
    this.starBeacon = new THREE.Mesh(starGeo, starMat);
    this.starBeacon.position.y = 7.1;
    hub.add(this.starBeacon);
    this.animatedObjects.push({ obj: this.starBeacon, type: 'star' });

    // Cute Doctor Signboard
    const signGroup = new THREE.Group();
    signGroup.position.set(-2.2, 0, 3.6);
    const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.3, 6), new THREE.MeshStandardMaterial({ color: 0x854d0e }));
    signPost.position.y = 0.65;
    signGroup.add(signPost);
    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.0, 0.12), new THREE.MeshStandardMaterial({ color: 0x10b981 }));
    signBoard.position.set(0, 1.25, 0);
    signGroup.add(signBoard);
    hub.add(signGroup);

    hub.userData = {
      id: 'landmark-center',
      islandId: 'island-center',
      title: '彰化基督教醫院 內分泌暨新陳代謝科 醫療總部',
      type: 'landmark'
    };
    group.add(hub);
    this.buildingMeshes.push(hub);
  }

  // --- 7 Cute 2D Cartoon Landmarks per Medical Specialty ---
  buildCartoonLandmark(group, def, topY) {
    const lm = new THREE.Group();
    lm.position.set(0, topY, -1.2);

    if (def.id === 'island-01') {
      // 1. 糖尿病迷思島：草莓奶油控糖燈塔 + 胰島素萌萌針筒塔
      const tower = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.5, 3.6, 12),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
      );
      tower.position.y = 1.8;
      lm.add(tower);

      // Strawberry roof with white polka dots
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(1.6, 1.6, 12),
        new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.3 })
      );
      roof.position.y = 4.2;
      lm.add(roof);

      // Cute Insulin syringe meter with rainbow potion
      const potion = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 2.2, 10),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.4 })
      );
      potion.position.set(2.0, 1.2, 0.8);
      lm.add(potion);

      // Smiling Heart & Kidney flower beds
      const heart = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.5 })
      );
      heart.scale.set(1.2, 0.8, 1.0);
      heart.position.set(-1.8, 0.45, 1.0);
      lm.add(heart);
    } else if (def.id === 'island-02') {
      // 2. 健康減重迷思島：酪梨萌萌運動館 + 芝士平衡天平
      const avocado = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.5 })
      );
      avocado.scale.set(1.0, 1.3, 0.9);
      avocado.position.y = 1.8;
      lm.add(avocado);

      // Avocado Seed Door (Brown sphere)
      const seed = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 })
      );
      seed.position.set(0, 1.4, 0.85);
      lm.add(seed);

      // Balance Scale (天平) with cute pastel weights
      const scaleBar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.15, 0.15), new THREE.MeshStandardMaterial({ color: 0xfbbf24 }));
      scaleBar.position.set(0, 3.4, 0);
      lm.add(scaleBar);

      const w1 = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0xf43f5e }));
      w1.position.set(-1.1, 2.8, 0);
      lm.add(w1);
      const w2 = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0x10b981 }));
      w2.position.set(1.1, 2.6, 0);
      lm.add(w2);
    } else if (def.id === 'island-03') {
      // 3. 骨質疏鬆迷思島：高鈣鮮奶屋 (🥛) + 萌萌骨頭拱門
      const milkCarton = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 3.2, 2.2),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
      );
      milkCarton.position.y = 1.6;
      lm.add(milkCarton);

      const cartonRoof = new THREE.Mesh(
        new THREE.ConeGeometry(1.7, 1.4, 4),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 })
      );
      cartonRoof.position.y = 3.8;
      cartonRoof.rotation.y = Math.PI / 4;
      lm.add(cartonRoof);

      // Cute white bone arch with pink bow
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
      const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.8, 8), boneMat);
      b1.rotation.z = Math.PI / 2;
      b1.position.set(0, 2.4, 1.3);
      lm.add(b1);

      // Smiling Sunflower sun on top
      const sun = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 0.6 })
      );
      sun.position.set(0, 4.8, 0);
      lm.add(sun);
    } else if (def.id === 'island-04') {
      // 4. 肌少症迷思島：壺鈴元氣運動館 + 荷包蛋蛋白質屋
      const kettlebell = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 12, 12),
        new THREE.MeshStandardMaterial({ color: 0xd946ef, roughness: 0.3 })
      );
      kettlebell.position.y = 1.6;
      lm.add(kettlebell);

      // Handle on top
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.8, 0.16, 8, 16, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x475569 })
      );
      handle.position.set(0, 3.1, 0);
      lm.add(handle);

      // Giant cute dumbbell
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 6), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, 3.4, 1.0);
      lm.add(bar);
    } else if (def.id === 'island-05') {
      // 5. 代謝症候群迷思島：黃金皮尺歡樂城堡 + 愛心噴泉
      const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
      const tape = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.25, 10, 24), ribbonMat);
      tape.rotation.x = Math.PI / 2;
      tape.position.y = 0.8;
      lm.add(tape);

      const castle = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.4, 2.6, 12),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 })
      );
      castle.position.y = 1.8;
      lm.add(castle);

      // Spouting blue water drop fountain
      const fountain = new THREE.Mesh(
        new THREE.SphereGeometry(0.65, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2 })
      );
      fountain.position.set(0, 3.4, 0);
      lm.add(fountain);
    } else if (def.id === 'island-06') {
      // 6. 牙周病共病迷思島：超萌潔白牙齒微笑城堡 (🦷)
      const toothMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15 });
      const toothBody = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.1, 2.2, 14), toothMat);
      toothBody.position.y = 1.4;
      lm.add(toothBody);

      const toothCap = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), toothMat);
      toothCap.position.y = 2.4;
      lm.add(toothCap);

      // Two cute cartoon dark eyes
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
      const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), eyeMat);
      eye1.position.set(-0.45, 2.0, 1.35);
      lm.add(eye1);
      const eye2 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), eyeMat);
      eye2.position.set(0.45, 2.0, 1.35);
      lm.add(eye2);

      // Rosy cheeks (Blushing pink)
      const blushMat = new THREE.MeshBasicMaterial({ color: 0xf472b6 });
      const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), blushMat);
      b1.position.set(-0.7, 1.7, 1.25);
      lm.add(b1);
      const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), blushMat);
      b2.position.set(0.7, 1.7, 1.25);
      lm.add(b2);

      // Sky-blue Dental-floss arch
      const flossMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 });
      const arch = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.12, 8, 20, Math.PI), flossMat);
      arch.position.set(0, 1.4, 0.8);
      lm.add(arch);
    } else if (def.id === 'island-07') {
      // 7. 甲狀腺疾病迷思島：夢幻粉紫蝴蝶魔法城堡
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.7, 2.4, 8),
        new THREE.MeshStandardMaterial({ color: 0xf5f3ff, roughness: 0.4 })
      );
      stem.position.y = 1.2;
      lm.add(stem);

      // Giant Cartoon Fluttering Butterfly Wings (Pink & Purple)
      const wingMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.3, side: THREE.DoubleSide });
      const leftWing = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 10), wingMat);
      leftWing.scale.set(1.5, 1.1, 0.3);
      leftWing.rotation.z = Math.PI / 5;
      leftWing.position.set(-1.3, 2.4, 0);
      lm.add(leftWing);

      const rightWing = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 10), wingMat);
      rightWing.scale.set(1.5, 1.1, 0.3);
      rightWing.rotation.z = -Math.PI / 5;
      rightWing.position.set(1.3, 2.4, 0);
      lm.add(rightWing);

      // Magical glowing crystal antennae
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.45, 0),
        new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xec4899, emissiveIntensity: 0.7 })
      );
      crystal.position.set(0, 3.2, 0);
      lm.add(crystal);
    }

    lm.userData = {
      id: `landmark-${def.id}`,
      islandId: def.id,
      title: def.name,
      type: 'landmark'
    };
    group.add(lm);
    this.buildingMeshes.push(lm);
  }

  // --- Cute Storybook Mushroom / Candy Cottages ("迷思解答亭") ---
  buildCartoonMythCottages(group, def, topY) {
    const cottagePositions = [
      { x: -2.7, z: 1.8, roofColor: def.roofColor },
      { x: 2.7, z: 1.8, roofColor: def.roofColor },
      { x: 0, z: 3.3, roofColor: 0xfacc15 } // Cheerful yellow
    ];

    cottagePositions.forEach((pos, idx) => {
      const cottage = new THREE.Group();
      cottage.position.set(pos.x, topY, pos.z);

      // Chubby round walls (Warm cream)
      const wall = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.9, 1.2, 12),
        new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.6, flatShading: true })
      );
      wall.position.y = 0.6;
      wall.castShadow = !this.isSoftwareGl;
      cottage.add(wall);

      // Puffy Mushroom/Candy Roof (Vibrant color)
      const roof = new THREE.Mesh(
        new THREE.SphereGeometry(1.15, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: pos.roofColor, roughness: 0.3, flatShading: true })
      );
      roof.position.y = 1.15;
      roof.castShadow = !this.isSoftwareGl;
      cottage.add(roof);

      // White polka dots on roof (2D cartoon mushroom look)
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      for (let i = 0; i < 4; i++) {
        const da = (i / 4) * Math.PI * 2;
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.18, 8), dotMat);
        dot.position.set(Math.cos(da) * 0.85, 1.6, Math.sin(da) * 0.85);
        dot.lookAt(new THREE.Vector3(0, 3, 0));
        cottage.add(dot);
      }

      // Rounded arched wooden door
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.65, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.7 })
      );
      door.position.set(0, 0.35, 0.85);
      cottage.add(door);

      // Cute stone chimney puffing cartoon smoke bubble
      const chimney = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.16, 0.6, 6),
        new THREE.MeshStandardMaterial({ color: 0xb45309 })
      );
      chimney.position.set(0.65, 1.8, -0.3);
      cottage.add(chimney);

      const smokeBubble = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })
      );
      smokeBubble.position.set(0.65, 2.25, -0.3);
      cottage.add(smokeBubble);

      cottage.userData = {
        id: `pavilion-${def.id}-${idx + 1}`,
        islandId: def.id,
        title: `${def.name} · 迷思解答亭 #${idx + 1}`,
        type: 'pavilion'
      };
      group.add(cottage);
      this.buildingMeshes.push(cottage);
    });
  }

  // --- Cartoon Arch Bridges & Striped Sailboats ---
  buildBridgesAndBoats() {
    const keys = ['island-01', 'island-02', 'island-03', 'island-04', 'island-05', 'island-06', 'island-07'];
    keys.forEach((key) => {
      const def = this.islandDefs[key];
      const start = new THREE.Vector3(Math.cos(def.angle) * 8.8, 1.4, Math.sin(def.angle) * 8.8);
      const end = new THREE.Vector3(Math.cos(def.angle) * 19.5, 1.2, Math.sin(def.angle) * 19.5);
      this.createCartoonBridge(start, end);
    });

    // Cute cruising sailboats with striped sails
    const boat1 = this.createCartoonBoat(new THREE.Vector3(-13, 0.1, -15), 0.85, 0xf43f5e);
    const boat2 = this.createCartoonBoat(new THREE.Vector3(15, 0.1, 12), 0.75, 0x38bdf8);
    const boat3 = this.createCartoonBoat(new THREE.Vector3(18, 0.1, -14), 0.7, 0xfbbf24);
    this.animatedObjects.push(
      { obj: boat1, type: 'boat', speed: 0.38, radius: 18, center: new THREE.Vector3(0, 0, 0), phase: 0 },
      { obj: boat2, type: 'boat', speed: -0.32, radius: 22, center: new THREE.Vector3(0, 0, 0), phase: 2.4 },
      { obj: boat3, type: 'boat', speed: 0.28, radius: 16, center: new THREE.Vector3(0, 0, 0), phase: 4.6 }
    );
  }

  createCartoonBridge(start, end) {
    const bridge = new THREE.Group();
    const distance = start.distanceTo(end);
    const plankMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.7 }); // Sunny yellow planks
    const railMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.8 });  // Orange handrails

    const steps = 11;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const pos = new THREE.Vector3().lerpVectors(start, end, t);
      pos.y += Math.sin(t * Math.PI) * 1.1; // Gentle cheerful parabolic arch

      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.18, distance / steps * 0.95), plankMat);
      plank.position.copy(pos);
      plank.lookAt(end);
      bridge.add(plank);

      if (i === 3 || i === 8) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, pos.y + 0.8, 8), railMat);
        pillar.position.set(pos.x, pos.y / 2 - 0.4, pos.z);
        bridge.add(pillar);
      }
    }
    this.scene.add(bridge);
  }

  createCartoonBoat(pos, scale = 1, sailColor = 0xf43f5e) {
    const boat = new THREE.Group();
    boat.position.copy(pos);
    boat.scale.set(scale, scale, scale);

    // Chubby round boat hull
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.5, 2.6, 8), hullMat);
    hull.rotation.z = Math.PI / 2;
    hull.rotation.y = Math.PI / 2;
    boat.add(hull);

    // Mast
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), new THREE.MeshStandardMaterial({ color: 0x92400e }));
    mast.position.set(0, 1.2, 0);
    boat.add(mast);

    // Striped Cartoon Sail
    const sailMat = new THREE.MeshStandardMaterial({ color: sailColor, roughness: 0.3, side: THREE.DoubleSide });
    const sailGeo = new THREE.BufferGeometry();
    const verts = new Float32Array([0, 0, 0, 0, 2.2, 0, 1.2, 0.3, 0]);
    sailGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    sailGeo.computeVertexNormals();
    const sail = new THREE.Mesh(sailGeo, sailMat);
    sail.position.set(0, 0.3, 0);
    boat.add(sail);

    this.scene.add(boat);
    return boat;
  }

  // --- Cartoon Lollipop Trees, Mushrooms & Daisies ---
  decorateCartoonIsland(group, topY, maxRadius) {
    // 1. Cute Round Lollipop Trees in 5 vibrant candy colors
    const treePalette = [0xf472b6, 0x4ade80, 0x38bdf8, 0xfbbf24, 0xc084fc]; // Pink blossom, mint, cyan, sunflower, lilac
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.4;
      const r = maxRadius * (0.75 + Math.random() * 0.22);
      const col = treePalette[i % treePalette.length];
      this.createLollipopTree(group, new THREE.Vector3(Math.cos(a) * r, topY, Math.sin(a) * r), col, 0.8 + Math.random() * 0.4);
    }

    // 2. Cute Cartoon Red Mushrooms with white dots
    for (let j = 0; j < 4; j++) {
      const ma = Math.random() * Math.PI * 2;
      const mr = maxRadius * (0.6 + Math.random() * 0.3);
      this.createCartoonMushroom(group, new THREE.Vector3(Math.cos(ma) * mr, topY, Math.sin(ma) * mr));
    }

    // 3. Cheerful Daisies
    for (let k = 0; k < 5; k++) {
      const fa = Math.random() * Math.PI * 2;
      const fr = maxRadius * (0.5 + Math.random() * 0.35);
      this.createDaisy(group, new THREE.Vector3(Math.cos(fa) * fr, topY, Math.sin(fa) * fr));
    }
  }

  createLollipopTree(group, pos, foliageColor, scale = 1) {
    const tree = new THREE.Group();
    tree.position.copy(pos);
    tree.scale.set(scale, scale, scale);

    // Slim trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 1.1, 8),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 })
    );
    trunk.position.y = 0.55;
    tree.add(trunk);

    // Round puffed lollipop sphere canopy
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.85, 12, 12),
      new THREE.MeshStandardMaterial({ color: foliageColor, roughness: 0.4, flatShading: true })
    );
    puff.position.y = 1.6;
    puff.castShadow = !this.isSoftwareGl;
    tree.add(puff);

    group.add(tree);
  }

  createCartoonMushroom(group, pos) {
    const shroom = new THREE.Group();
    shroom.position.copy(pos);

    // White stem
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.25, 6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    stem.position.y = 0.12;
    shroom.add(stem);

    // Red cap
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0xef4444 }));
    cap.position.y = 0.32;
    shroom.add(cap);

    group.add(shroom);
  }

  createDaisy(group, pos) {
    const daisy = new THREE.Group();
    daisy.position.copy(pos);

    // Yellow center
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
    center.position.y = 0.12;
    daisy.add(center);

    // White petals
    const petals = new THREE.Mesh(new THREE.RingGeometry(0.08, 0.25, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    petals.rotation.x = -Math.PI / 2;
    petals.position.y = 0.11;
    daisy.add(petals);

    group.add(daisy);
  }

  // --- Cute Cartoon Villagers ---
  buildVillagers() {
    const configs = [
      { color: 0x06b6d4, speed: 0.55, radius: 5.2, offset: 0 },
      { color: 0xf43f5e, speed: 0.45, radius: 4.8, offset: 2.1 },
      { color: 0xf59e0b, speed: 0.5, radius: 5.6, offset: 4.2 }
    ];

    configs.forEach((cfg) => {
      const person = this.createCartoonPerson(cfg.color);
      this.centerIslandGroup.add(person);
      this.villagers.push({ person, speed: cfg.speed, radius: cfg.radius, offset: cfg.offset, angle: cfg.offset });
    });
  }

  createCartoonPerson(color) {
    const person = new THREE.Group();
    // Cute big round head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.5 })
    );
    head.position.y = 1.05;
    person.add(head);

    // Cute cap / hat
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x10b981 }));
    hat.position.y = 1.35;
    person.add(hat);

    // Body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.26, 0.65, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 })
    );
    body.position.y = 0.5;
    person.add(body);

    person.position.y = 2.2;
    return person;
  }

  // --- Pointer & Raycasting Interactions ---
  onPointerMove(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.checkHover();
  }

  onPointerDown(e) {
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
  }

  checkHover() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = [];
    this.buildingMeshes.forEach((g) => targets.push(...g.children));

    const hits = this.raycaster.intersectObjects(targets, true);
    document.body.style.cursor = hits.length > 0 ? 'pointer' : 'default';
  }

  onClick(e) {
    if (this.pointerDownPos) {
      const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (dist > 6) return;
    }

    this.raycaster.setFromCamera(this.pointer, this.camera);

    // 1. Check Buildings & Landmarks
    const buildingTargets = [];
    this.buildingMeshes.forEach((g) => buildingTargets.push(...g.children));
    const buildingHits = this.raycaster.intersectObjects(buildingTargets, true);

    if (buildingHits.length > 0) {
      let hit = buildingHits[0].object;
      while (hit && !hit.userData?.id && hit.parent) {
        hit = hit.parent;
      }
      if (hit && hit.userData?.id && hit.userData.islandId) {
        this.focusIsland(hit.userData.islandId);
        this.onSelectIsland(hit.userData.islandId);
        return;
      }
    }

    // 2. Check Island bases
    const islandTargets = [];
    this.islandMeshes.forEach((g) => islandTargets.push(...g.children));
    const islandHits = this.raycaster.intersectObjects(islandTargets, true);

    if (islandHits.length > 0) {
      let hit = islandHits[0].object;
      while (hit && !hit.userData?.id && hit.parent) {
        hit = hit.parent;
      }
      if (hit && hit.userData?.id) {
        this.focusIsland(hit.userData.id);
        this.onSelectIsland(hit.userData.id);
      }
    }
  }

  // --- Smooth Camera Navigation ---
  focusIsland(islandId) {
    this.selectedIslandId = islandId;
    this.selectedBuildingId = null;

    const def = this.getIslandDef(islandId);
    if (!def) return;

    if (islandId === 'island-center') {
      this.cameraTargetPos.set(0, 11, 16);
      this.controlsTargetPos.set(0, 2.5, -1);
    } else {
      this.cameraTargetPos.set(def.pos.x * 0.72, 10.5, def.pos.z * 0.72 + 12);
      this.controlsTargetPos.set(def.pos.x, 2.0, def.pos.z);
    }
    this.isAnimatingCamera = true;
  }

  resetToOverview() {
    this.selectedIslandId = null;
    this.selectedBuildingId = null;
    this.cameraTargetPos.set(0, 36, 52);
    this.controlsTargetPos.set(0, 0, 0);
    this.isAnimatingCamera = true;
  }

  getScreenPosition(worldVector) {
    const vector = worldVector.clone();
    vector.project(this.camera);
    const halfWidth = this.container.clientWidth / 2;
    const halfHeight = this.container.clientHeight / 2;
    return {
      x: Math.round(vector.x * halfWidth + halfWidth),
      y: Math.round(-vector.y * halfHeight + halfHeight),
      visible: vector.z < 1.0
    };
  }

  getIslandScreenPosition(islandId) {
    const def = this.getIslandDef(islandId);
    if (!def) return { visible: false };

    const p = def.pos.clone();
    p.y = def.tagY || 5.0;
    return this.getScreenPosition(p);
  }

  onWindowResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  setReducedMotion(reduced) {
    this.reducedMotion = reduced;
  }

  // --- Animation Render Loop ---
  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // 1. Camera Spring Interpolation
    if (this.isAnimatingCamera) {
      const factor = this.reducedMotion ? 0.15 : 0.055;
      this.camera.position.lerp(this.cameraTargetPos, factor);
      this.controls.target.lerp(this.controlsTargetPos, factor);

      if (this.camera.position.distanceTo(this.cameraTargetPos) < 0.2) {
        this.camera.position.copy(this.cameraTargetPos);
        this.controls.target.copy(this.controlsTargetPos);
        this.isAnimatingCamera = false;
      }
    }

    // 2. Wave Motion
    if (!this.reducedMotion && this.oceanMesh && this.oceanInitialY) {
      const pos = this.oceanMesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const wave = Math.sin(x * 0.1 + time * 1.3) * 0.18 + Math.cos(z * 0.1 + time * 1.0) * 0.18;
        pos.setY(i, this.oceanInitialY[i] + wave);
      }
      this.oceanMesh.geometry.attributes.position.needsUpdate = true;
    }

    // 3. Clouds Drifting across the sky
    if (!this.reducedMotion) {
      this.clouds.forEach((c) => {
        c.mesh.position.x += delta * c.speed * 2.5;
        if (c.mesh.position.x > 75) {
          c.mesh.position.x = -75;
        }
      });

      // 4. Floating Sparkles
      this.sparkles.forEach((s) => {
        s.mesh.position.y = s.baseY + Math.sin(time * 2.0 + s.offset) * 0.45;
        s.mesh.rotation.y += delta * s.speed;
      });

      // 5. Star Beacon & Boats
      this.animatedObjects.forEach((item) => {
        if (item.type === 'star') {
          item.obj.rotation.y += delta * 1.2;
          item.obj.position.y = 7.1 + Math.sin(time * 2.5) * 0.15;
        } else if (item.type === 'boat') {
          const a = time * item.speed + item.phase;
          item.obj.position.x = item.center.x + Math.cos(a) * item.radius;
          item.obj.position.z = item.center.z + Math.sin(a) * item.radius;
          item.obj.rotation.y = -a + (item.speed > 0 ? 0 : Math.PI);
          item.obj.rotation.z = Math.sin(time * 2.8) * 0.09;
        }
      });

      // 6. Cartoon Villagers walking
      this.villagers.forEach((v) => {
        v.angle += delta * v.speed * 0.35;
        v.person.position.x = Math.cos(v.angle) * v.radius;
        v.person.position.z = Math.sin(v.angle) * v.radius;
        v.person.rotation.y = -v.angle - Math.PI / 2;
        v.person.position.y = 2.2 + Math.abs(Math.sin(time * 7 * v.speed)) * 0.1;
      });
    }

    this.controls.update();

    if (this.options.onRenderFrame) {
      this.options.onRenderFrame();
    }

    this.renderer.render(this.scene, this.camera);
  }
}
