/**
 * 彰基糖友島 - 3D 群島視覺核心 (Three.js Low-Poly Archipelago)
 * 依照 references/island-type.md、theme.md 與 threejs 技能規範實作
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export class IslandScene {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.onSelectIsland = options.onSelectIsland || (() => {});
    this.onSelectBuilding = options.onSelectBuilding || (() => {});

    this.currentTheme = options.currentTheme || 'mint';
    this.dayNightMode = options.dayNightMode || 'day'; // 'day' | 'sunset' | 'night'
    this.reducedMotion = options.reducedMotion || false;

    this.selectedIslandId = null;
    this.selectedBuildingId = null;

    // Camera animation state
    this.cameraTargetPos = new THREE.Vector3(0, 18, 38);
    this.controlsTargetPos = new THREE.Vector3(0, 0, 0);
    this.isAnimatingCamera = false;

    // Interactable objects
    this.islandMeshes = [];
    this.buildingMeshes = [];
    this.villagers = [];
    this.boats = [];
    this.animatedObjects = [];

    // Raycasting
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-999, -999);
    this.hoveredObject = null;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    // 1. Detect software WebGL
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // 3. Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 300);
    this.camera.position.set(0, 20, 36);

    // 4. Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't look under the water
    this.controls.minDistance = 8;
    this.controls.maxDistance = 65;
    this.controls.target.set(0, 1, 0);

    // Cancel camera animation on user manual input
    this.controls.addEventListener('start', () => {
      this.isAnimatingCamera = false;
    });

    // 5. Studio Environment Map
    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    } catch (e) {
      console.warn('RoomEnvironment generation skipped:', e);
    }

    // 6. Build Scene
    this.setupLights();
    this.buildOcean();
    this.buildArchipelago();
    this.buildBridgesAndBoats();
    this.buildVillagers();

    // 7. Event listeners
    this.onWindowResize = this.onWindowResize.bind(this);
    window.addEventListener('resize', this.onWindowResize);

    this.onPointerMove = this.onPointerMove.bind(this);
    this.onClick = this.onClick.bind(this);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('click', this.onClick);

    // Apply initial theme & lighting
    this.applyTheme(this.currentTheme);
    this.applyDayNight(this.dayNightMode);

    // 8. Start Loop
    this.startTime = performance.now();
    this.lastTime = performance.now();
    this.animate = this.animate.bind(this);
    this.frameId = requestAnimationFrame(this.animate);
  }

  setupLights() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xfff8f0, 0x3d7065, 0.6);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff5e6, 1.3);
    this.dirLight.position.set(25, 40, 20);
    if (!this.isSoftwareGl) {
      this.dirLight.castShadow = true;
      this.dirLight.shadow.mapSize.width = 2048;
      this.dirLight.shadow.mapSize.height = 2048;
      this.dirLight.shadow.camera.near = 5;
      this.dirLight.shadow.camera.far = 120;
      const d = 35;
      this.dirLight.shadow.camera.left = -d;
      this.dirLight.shadow.camera.right = d;
      this.dirLight.shadow.camera.top = d;
      this.dirLight.shadow.camera.bottom = -d;
      this.dirLight.shadow.bias = -0.0005;
      this.dirLight.shadow.normalBias = 0.02;
    }
    this.scene.add(this.dirLight);

    // Night/Sunset decorative point lights
    this.lighthouseBeacon = new THREE.PointLight(0xfff0a0, 0, 25);
    this.lighthouseBeacon.position.set(0, 9.8, 0);
    this.scene.add(this.lighthouseBeacon);
  }

  buildOcean() {
    // Large stylized ocean plane
    const oceanGeo = new THREE.PlaneGeometry(160, 160, 32, 32);
    oceanGeo.rotateX(-Math.PI / 2);

    this.oceanMat = new THREE.MeshStandardMaterial({
      color: 0x5ea89b,
      roughness: 0.2,
      metalness: 0.15,
      flatShading: true,
      transparent: true,
      opacity: 0.92
    });

    this.oceanMesh = new THREE.Mesh(oceanGeo, this.oceanMat);
    this.oceanMesh.position.y = -0.15;
    this.oceanMesh.receiveShadow = !this.isSoftwareGl;
    this.scene.add(this.oceanMesh);

    // Submerged sea floor for depth
    const floorGeo = new THREE.PlaneGeometry(180, 180);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x1f4740 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = -4;
    this.scene.add(floorMesh);
  }

  createLowPolyIsland(radius, height, segments, color, pos) {
    const islandGroup = new THREE.Group();
    islandGroup.position.copy(pos);

    // Island rock base (tapered cylinder with jagged jitter)
    const baseGeo = new THREE.CylinderGeometry(radius * 0.95, radius * 0.6, height, segments, 3);
    const posAttr = baseGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      if (y > -height / 2 + 0.1) {
        // subtle jitter for low-poly rocky look
        const jitterX = (Math.sin(i * 13.5) * 0.15) * radius * 0.1;
        const jitterZ = (Math.cos(i * 17.2) * 0.15) * radius * 0.1;
        posAttr.setX(i, posAttr.getX(i) + jitterX);
        posAttr.setZ(i, posAttr.getZ(i) + jitterZ);
      }
    }
    baseGeo.computeVertexNormals();

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x5a5247,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true
    });
    const rockMesh = new THREE.Mesh(baseGeo, rockMat);
    rockMesh.position.y = height / 2 - 1.2;
    rockMesh.castShadow = !this.isSoftwareGl;
    rockMesh.receiveShadow = !this.isSoftwareGl;
    islandGroup.add(rockMesh);

    // Beach sand ring
    const sandGeo = new THREE.CylinderGeometry(radius * 1.02, radius * 0.95, 0.45, segments);
    const sandMat = new THREE.MeshStandardMaterial({
      color: 0xebd99f,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true
    });
    const sandMesh = new THREE.Mesh(sandGeo, sandMat);
    sandMesh.position.y = height - 1.0;
    sandMesh.receiveShadow = !this.isSoftwareGl;
    islandGroup.add(sandMesh);

    // Top grassy plateau
    const grassGeo = new THREE.CylinderGeometry(radius * 0.9, radius * 0.96, 0.5, segments);
    const grassMat = new THREE.MeshStandardMaterial({
      color: color || 0x489672,
      roughness: 0.75,
      metalness: 0.05,
      flatShading: true
    });
    const grassMesh = new THREE.Mesh(grassGeo, grassMat);
    grassMesh.position.y = height - 0.7;
    grassMesh.receiveShadow = !this.isSoftwareGl;
    islandGroup.add(grassMesh);

    return { islandGroup, topY: height - 0.45, radius };
  }

  buildArchipelago() {
    // 1. Central Island: 彰基糖友島 (Center Library)
    const centerPos = new THREE.Vector3(0, 0, -2);
    const centerIsland = this.createLowPolyIsland(9.5, 2.5, 16, 0x3d9c75, centerPos);
    this.centerIslandGroup = centerIsland.islandGroup;
    this.centerIslandGroup.userData = { id: 'island-center', name: '彰基糖友島', type: 'island', center: centerPos };
    this.scene.add(this.centerIslandGroup);
    this.islandMeshes.push(this.centerIslandGroup);

    this.buildCenterLighthouseLibrary(this.centerIslandGroup, centerIsland.topY);
    this.decorateCentralIsland(this.centerIslandGroup, centerIsland.topY);

    // 2. Island 1: 糖尿病知識島 (West / Left)
    const island1Pos = new THREE.Vector3(-18.5, 0, 3.5);
    const island1 = this.createLowPolyIsland(7.5, 2.2, 14, 0x4aa57b, island1Pos);
    this.island1Group = island1.islandGroup;
    this.island1Group.userData = { id: 'island-01', name: '糖尿病知識島', type: 'island', center: island1Pos };
    this.scene.add(this.island1Group);
    this.islandMeshes.push(this.island1Group);

    this.buildKnowledgeIslandLandmark(this.island1Group, island1.topY);
    this.buildIsland1Buildings(this.island1Group, island1.topY);
    this.decorateIsland(this.island1Group, island1.topY, 7.0, 'knowledge');

    // 3. Island 2: 醫師人員島 (East / Right)
    const island2Pos = new THREE.Vector3(18.5, 0, 2.5);
    const island2 = this.createLowPolyIsland(7.8, 2.2, 14, 0x48a080, island2Pos);
    this.island2Group = island2.islandGroup;
    this.island2Group.userData = { id: 'island-02', name: '醫師人員島', type: 'island', center: island2Pos };
    this.scene.add(this.island2Group);
    this.islandMeshes.push(this.island2Group);

    this.buildDoctorIslandLandmark(this.island2Group, island2.topY);
    this.buildIsland2Buildings(this.island2Group, island2.topY);
    this.decorateIsland(this.island2Group, island2.topY, 7.2, 'doctor');
  }

  // --- Central Island Landmark: Central Library & Lighthouse ---
  buildCenterLighthouseLibrary(group, topY) {
    const libGroup = new THREE.Group();
    libGroup.position.set(0, topY, 0);

    // Base podium with circular steps
    const step1 = new THREE.Mesh(
      new THREE.CylinderGeometry(4.2, 4.4, 0.35, 16),
      new THREE.MeshStandardMaterial({ color: 0xdfd9ce, roughness: 0.6, flatShading: true })
    );
    step1.position.y = 0.175;
    step1.receiveShadow = !this.isSoftwareGl;
    libGroup.add(step1);

    const step2 = new THREE.Mesh(
      new THREE.CylinderGeometry(3.6, 3.8, 0.35, 16),
      new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.6, flatShading: true })
    );
    step2.position.y = 0.525;
    step2.receiveShadow = !this.isSoftwareGl;
    libGroup.add(step2);

    // Rotunda columns
    const colMat = new THREE.MeshStandardMaterial({ color: 0xf5f3ee, roughness: 0.4, flatShading: true });
    const colCount = 8;
    for (let i = 0; i < colCount; i++) {
      const angle = (i / colCount) * Math.PI * 2;
      const x = Math.cos(angle) * 2.8;
      const z = Math.sin(angle) * 2.8;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.2, 8), colMat);
      col.position.set(x, 1.8, z);
      col.castShadow = !this.isSoftwareGl;
      libGroup.add(col);
    }

    // Inner Library Chamber (Rotunda Core)
    const coreMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 2.2, 16),
      new THREE.MeshStandardMaterial({ color: 0x2a8a74, roughness: 0.5, flatShading: true })
    );
    coreMesh.position.y = 1.8;
    coreMesh.castShadow = !this.isSoftwareGl;
    libGroup.add(coreMesh);

    // Archway entrance door
    const doorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.4, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x8a4b2a, roughness: 0.7 })
    );
    doorMesh.position.set(0, 1.4, 2.2);
    libGroup.add(doorMesh);

    // Library Architrave & Balcony Ring
    const ringMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.2, 0.4, 16),
      new THREE.MeshStandardMaterial({ color: 0xdfd9ce, roughness: 0.5, flatShading: true })
    );
    ringMesh.position.y = 3.1;
    ringMesh.castShadow = !this.isSoftwareGl;
    libGroup.add(ringMesh);

    // Lighthouse Crystal Lantern Tower
    const towerMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.4, 1.8, 2.2, 12),
      new THREE.MeshStandardMaterial({ color: 0xf8f5f0, roughness: 0.3, flatShading: true })
    );
    towerMesh.position.y = 4.4;
    towerMesh.castShadow = !this.isSoftwareGl;
    libGroup.add(towerMesh);

    // Glowing crystalline lantern room
    const lanternGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 1.2, 12),
      new THREE.MeshStandardMaterial({
        color: 0xfff2a8,
        emissive: 0xffd966,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        transparent: true,
        opacity: 0.85
      })
    );
    lanternGlass.position.y = 6.1;
    libGroup.add(lanternGlass);

    // Top Dome Roof
    const domeRoof = new THREE.Mesh(
      new THREE.ConeGeometry(1.5, 1.2, 16),
      new THREE.MeshStandardMaterial({ color: 0xe46a5e, roughness: 0.4, flatShading: true })
    );
    domeRoof.position.y = 7.3;
    domeRoof.castShadow = !this.isSoftwareGl;
    libGroup.add(domeRoof);

    // Spire & Golden Compass Star
    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.08, 1.4, 8),
      new THREE.MeshStandardMaterial({ color: 0xf4b740, metalness: 0.7, roughness: 0.2 })
    );
    spire.position.y = 8.5;
    libGroup.add(spire);

    const starCrest = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35),
      new THREE.MeshStandardMaterial({ color: 0xffd147, metalness: 0.8, roughness: 0.2 })
    );
    starCrest.position.y = 9.2;
    libGroup.add(starCrest);
    this.animatedObjects.push({ mesh: starCrest, rotSpeed: 0.02 });

    libGroup.userData = {
      id: 'center-library-landmark',
      islandId: 'island-center',
      title: '彰基糖友中央圖書館',
      type: 'landmark'
    };
    group.add(libGroup);
    this.buildingMeshes.push(libGroup);
  }

  decorateCentralIsland(group, topY) {
    // Plaza cobblestone circle
    const plaza = new THREE.Mesh(
      new THREE.RingGeometry(4.3, 7.8, 16),
      new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.9, side: THREE.DoubleSide })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = topY + 0.02;
    plaza.receiveShadow = !this.isSoftwareGl;
    group.add(plaza);

    // Surrounding scholar benches, street lamps, and garden trees
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5 });
    const lampGlassMat = new THREE.MeshStandardMaterial({ color: 0xffe680, emissive: 0xffca28, emissiveIntensity: 0.4 });

    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + 0.3;
      const x = Math.cos(angle) * 6.2;
      const z = Math.sin(angle) * 6.2;

      // Lamp post
      const lamp = new THREE.Group();
      lamp.position.set(x, topY, z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.6, 6), lampMat);
      post.position.y = 0.8;
      lamp.add(post);
      const lantern = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2), lampGlassMat);
      lantern.position.y = 1.6;
      lamp.add(lantern);
      group.add(lamp);

      // Trees
      this.createTree(group, new THREE.Vector3(x * 1.25, topY, z * 1.25), 1.2);
    }
  }

  // --- Island 1: 糖尿病知識島 (Landmark & 4 Literature Buildings) ---
  buildKnowledgeIslandLandmark(group, topY) {
    const lmGroup = new THREE.Group();
    lmGroup.position.set(0, topY, -1.8);

    // Life Clock Tower (鐘樓)
    const towerBase = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 3.6, 2.0),
      new THREE.MeshStandardMaterial({ color: 0xf1ebe1, roughness: 0.6, flatShading: true })
    );
    towerBase.position.y = 1.8;
    towerBase.castShadow = !this.isSoftwareGl;
    lmGroup.add(towerBase);

    // Clock faces on 4 sides
    const clockMat = new THREE.MeshStandardMaterial({ color: 0x2a8a74, roughness: 0.3 });
    const dialMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    for (let i = 0; i < 4; i++) {
      const clockRim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.08, 12), clockMat);
      clockRim.rotation.x = Math.PI / 2;
      clockRim.position.set(
        i === 0 ? 0 : i === 1 ? 1.02 : i === 2 ? 0 : -1.02,
        2.5,
        i === 0 ? 1.02 : i === 1 ? 0 : i === 2 ? -1.02 : 0
      );
      if (i % 2 === 1) clockRim.rotation.z = Math.PI / 2;
      lmGroup.add(clockRim);

      const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.09, 12), dialMat);
      dial.rotation.x = Math.PI / 2;
      dial.position.copy(clockRim.position);
      if (i % 2 === 1) dial.rotation.z = Math.PI / 2;
      lmGroup.add(dial);
    }

    // Pyramid roof
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.6, 1.5, 4),
      new THREE.MeshStandardMaterial({ color: 0xe46a5e, roughness: 0.4, flatShading: true })
    );
    roof.position.y = 4.35;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = !this.isSoftwareGl;
    lmGroup.add(roof);

    // Organ Flowerbed: Heart (Red) & Kidney (Green) sculpted low-poly bushes
    const heartBed = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xe46a5e, roughness: 0.8, flatShading: true })
    );
    heartBed.scale.set(1.2, 0.8, 1.0);
    heartBed.position.set(-2.0, 0.35, 1.2);
    lmGroup.add(heartBed);

    const kidneyBed = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.45, 0.6, 6, 8),
      new THREE.MeshStandardMaterial({ color: 0x3d8b68, roughness: 0.8, flatShading: true })
    );
    kidneyBed.rotation.z = Math.PI / 3;
    kidneyBed.position.set(2.0, 0.35, 1.2);
    lmGroup.add(kidneyBed);

    // Small footbridge over canal
    const bridgePlank = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.15, 2.5),
      new THREE.MeshStandardMaterial({ color: 0xa87342, roughness: 0.8 })
    );
    bridgePlank.position.set(0, 0.1, 2.6);
    lmGroup.add(bridgePlank);

    lmGroup.userData = {
      id: 'landmark-island-01',
      islandId: 'island-01',
      title: '生命之河鐘樓與器官保護花園',
      type: 'landmark'
    };
    group.add(lmGroup);
    this.buildingMeshes.push(lmGroup);
  }

  buildIsland1Buildings(group, topY) {
    // 4 literature houses around the island
    const lits = [
      { id: 'lit-01', pos: new THREE.Vector3(-3.6, topY, -1.2), color: 0x2a8a74, shape: 'villa', title: '年鑑流行與存活研究' },
      { id: 'lit-02', pos: new THREE.Vector3(-2.8, topY, 3.2), color: 0x3b82f6, shape: 'dome', title: 'IDF 全球糖尿病地圖' },
      { id: 'lit-03', pos: new THREE.Vector3(3.2, topY, -2.6), color: 0xe46a5e, shape: 'cottage', title: '大小血管併發症研究' },
      { id: 'lit-04', pos: new THREE.Vector3(3.6, topY, 2.8), color: 0xf59e0b, shape: 'hall', title: '健保大數據醫療費用' }
    ];

    lits.forEach((lit) => {
      const house = this.createLiteratureHouse(lit, 'island-01');
      group.add(house);
      this.buildingMeshes.push(house);
    });
  }

  // --- Island 2: 醫師人員島 (Landmark & 4 Literature Buildings) ---
  buildDoctorIslandLandmark(group, topY) {
    const lmGroup = new THREE.Group();
    lmGroup.position.set(0, topY, -1.5);

    // Modern White Medical Bell Tower
    const towerBody = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 4.2, 2.4),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, flatShading: true })
    );
    towerBody.position.y = 2.1;
    towerBody.castShadow = !this.isSoftwareGl;
    lmGroup.add(towerBody);

    // Medical Red Cross on tower front
    const crossH = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.35, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xe46a5e, roughness: 0.4 })
    );
    crossH.position.set(0, 3.0, 1.24);
    lmGroup.add(crossH);

    const crossV = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 1.2, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xe46a5e, roughness: 0.4 })
    );
    crossV.position.set(0, 3.0, 1.24);
    lmGroup.add(crossV);

    // Slanted Modern Canopy / Spire
    const topCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 1.6, 1.0, 4),
      new THREE.MeshStandardMaterial({ color: 0x2a8a74, roughness: 0.4, flatShading: true })
    );
    topCap.position.y = 4.7;
    topCap.rotation.y = Math.PI / 4;
    lmGroup.add(topCap);

    // Prescription Capsule Gazebo (膠囊觀景亭)
    const capsulePavilion = new THREE.Group();
    capsulePavilion.position.set(-2.5, 0, 1.5);
    const pillHalf1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 })
    );
    pillHalf1.position.y = 1.2;
    capsulePavilion.add(pillHalf1);
    const pillBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.6, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    pillBody.position.y = 0.9;
    capsulePavilion.add(pillBody);
    lmGroup.add(capsulePavilion);

    // Vaccine Shield Arch (疫苗防護拱門)
    const archMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3, metalness: 0.2 });
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 8, 16, Math.PI), archMat);
    arch.position.set(2.4, 0.9, 1.5);
    arch.rotation.x = -Math.PI / 12;
    lmGroup.add(arch);

    lmGroup.userData = {
      id: 'landmark-island-02',
      islandId: 'island-02',
      title: '白色現代醫療鐘塔與處方守護站',
      type: 'landmark'
    };
    group.add(lmGroup);
    this.buildingMeshes.push(lmGroup);
  }

  buildIsland2Buildings(group, topY) {
    // 4 literature houses for Island 2
    const lits = [
      { id: 'lit-05', pos: new THREE.Vector3(-3.8, topY, -1.8), color: 0x2a8a74, shape: 'tower', title: '臺灣糖尿病臨床照護指引' },
      { id: 'lit-06', pos: new THREE.Vector3(-3.0, topY, 3.2), color: 0x3b82f6, shape: 'pavilion', title: 'SGLT2i 統合分析 (Lancet)' },
      { id: 'lit-07', pos: new THREE.Vector3(3.2, topY, -2.2), color: 0xec4899, shape: 'pavilion', title: 'GLP-1 RA 統合分析 (Lancet)' },
      { id: 'lit-08', pos: new THREE.Vector3(3.5, topY, 2.6), color: 0x8b5cf6, shape: 'station', title: '高血糖急症處置共識' }
    ];

    lits.forEach((lit) => {
      const house = this.createLiteratureHouse(lit, 'island-02');
      group.add(house);
      this.buildingMeshes.push(house);
    });
  }

  // Helper: Create stylized Literature House (1 文獻 = 1 棟房子)
  createLiteratureHouse(spec, islandId) {
    const houseGroup = new THREE.Group();
    houseGroup.position.copy(spec.pos);

    const wallColor = 0xfaf8f5;
    const roofColor = spec.color || 0x2a8a74;

    // 1. House Body
    const bodyGeo = new THREE.BoxGeometry(1.6, 1.3, 1.4);
    const bodyMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.6, flatShading: true });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.65;
    body.castShadow = !this.isSoftwareGl;
    body.receiveShadow = !this.isSoftwareGl;
    houseGroup.add(body);

    // 2. Distinct Roof Shape based on literature type
    let roofMesh;
    const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.45, flatShading: true });

    if (spec.shape === 'dome') {
      roofMesh = new THREE.Mesh(new THREE.SphereGeometry(1.05, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), roofMat);
      roofMesh.position.y = 1.3;
    } else if (spec.shape === 'tower') {
      roofMesh = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.4, 4), roofMat);
      roofMesh.position.y = 1.3 + 0.7;
      roofMesh.rotation.y = Math.PI / 4;
    } else if (spec.shape === 'hall') {
      roofMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.2, 0.9, 4), roofMat);
      roofMesh.position.y = 1.3 + 0.45;
      roofMesh.rotation.y = Math.PI / 4;
    } else {
      // Gable villa/cottage roof
      const gableGeo = new THREE.ConeGeometry(1.3, 0.85, 4);
      gableGeo.rotateY(Math.PI / 4);
      roofMesh = new THREE.Mesh(gableGeo, roofMat);
      roofMesh.position.y = 1.3 + 0.42;
    }

    roofMesh.castShadow = !this.isSoftwareGl;
    houseGroup.add(roofMesh);

    // 3. Front Door & Windows
    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 0.65),
      new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.8 })
    );
    door.position.set(0, 0.35, 0.71);
    houseGroup.add(door);

    const windowMat = new THREE.MeshStandardMaterial({
      color: 0x90caf9,
      roughness: 0.2,
      emissive: 0x223344,
      emissiveIntensity: 0.2
    });

    const win1 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.35), windowMat);
    win1.position.set(-0.48, 0.75, 0.71);
    houseGroup.add(win1);

    const win2 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.35), windowMat);
    win2.position.set(0.48, 0.75, 0.71);
    houseGroup.add(win2);

    // 4. Floating Literature Indicator Pill
    const tagCanvas = document.createElement('canvas');
    tagCanvas.width = 128;
    tagCanvas.height = 48;
    const ctx = tagCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.roundRect(4, 4, 120, 40, 20);
    ctx.fill();
    ctx.strokeStyle = '#2a8a74';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#1e3a34';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('文獻 📖', 64, 24);

    const tagTexture = new THREE.CanvasTexture(tagCanvas);
    const tagSpriteMat = new THREE.SpriteMaterial({ map: tagTexture, transparent: true, opacity: 0.85 });
    const tagSprite = new THREE.Sprite(tagSpriteMat);
    tagSprite.scale.set(1.4, 0.55, 1);
    tagSprite.position.set(0, 2.5, 0);
    houseGroup.add(tagSprite);

    // Save metadata
    houseGroup.userData = {
      id: spec.id,
      islandId: islandId,
      title: spec.title,
      type: 'literature',
      color: roofColor
    };

    return houseGroup;
  }

  // --- Bridges and Bay Sailing Boats ---
  buildBridgesAndBoats() {
    // 1. Curved Wooden Bridge between Center & Island 1 (Left)
    this.createBridge(new THREE.Vector3(-1.8, 1.4, 0), new THREE.Vector3(-11.5, 1.2, 2.2));

    // 2. Curved Wooden Bridge between Center & Island 2 (Right)
    this.createBridge(new THREE.Vector3(1.8, 1.4, 0), new THREE.Vector3(11.5, 1.2, 1.6));

    // 3. Stylized Low-poly Sailboats cruising in the lagoon
    const boat1 = this.createBoat(new THREE.Vector3(-8, 0.1, -12), 0.7);
    this.scene.add(boat1);
    this.boats.push({ mesh: boat1, speed: 0.008, radius: 14, angle: 0 });

    const boat2 = this.createBoat(new THREE.Vector3(10, 0.1, -10), 0.6);
    this.scene.add(boat2);
    this.boats.push({ mesh: boat2, speed: 0.006, radius: 16, angle: Math.PI });
  }

  createBridge(start, end) {
    const bridgeGroup = new THREE.Group();
    const distance = start.distanceTo(end);
    const dir = new THREE.Vector3().subVectors(end, start).normalize();

    const plankCount = 14;
    const plankMat = new THREE.MeshStandardMaterial({ color: 0xa87747, roughness: 0.85, flatShading: true });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x6e4b2a, roughness: 0.9 });

    for (let i = 0; i <= plankCount; i++) {
      const t = i / plankCount;
      const x = THREE.MathUtils.lerp(start.x, end.x, t);
      const z = THREE.MathUtils.lerp(start.z, end.z, t);
      // Arch curve in Y
      const archY = Math.sin(t * Math.PI) * 0.9;
      const y = THREE.MathUtils.lerp(start.y, end.y, t) + archY;

      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.1, 1.6), plankMat);
      plank.position.set(x, y, z);
      plank.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      plank.receiveShadow = !this.isSoftwareGl;
      bridgeGroup.add(plank);

      if (i % 3 === 0) {
        // Vertical support piles
        const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, y + 0.3, 6), postMat);
        pile.position.set(x, y / 2, z);
        bridgeGroup.add(pile);
      }
    }

    this.scene.add(bridgeGroup);
  }

  createBoat(pos, scale = 1) {
    const boat = new THREE.Group();
    boat.position.copy(pos);
    boat.scale.setScalar(scale);

    // Hull
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x8a532d, roughness: 0.7, flatShading: true });
    const hull = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 5), hullMat);
    hull.rotation.z = Math.PI / 2;
    hull.scale.set(0.5, 1, 0.6);
    boat.add(hull);

    // Mast
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6),
      new THREE.MeshStandardMaterial({ color: 0x473322 })
    );
    mast.position.y = 0.9;
    boat.add(mast);

    // White Sail
    const sailGeo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 0.2, 0,
      0, 1.7, 0,
      1.1, 0.4, 0
    ]);
    sailGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    sailGeo.computeVertexNormals();

    const sail = new THREE.Mesh(
      sailGeo,
      new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.4 })
    );
    boat.add(sail);

    return boat;
  }

  // --- Little People (Villagers) strolling on islands ---
  buildVillagers() {
    // 3 villagers on center island, 2 on island 1, 2 on island 2
    const spots = [
      { island: 'island-center', center: new THREE.Vector3(0, 2.05, -2), radius: 5.5, speed: 0.012, color: 0x3b82f6 },
      { island: 'island-center', center: new THREE.Vector3(0, 2.05, -2), radius: 6.8, speed: -0.009, color: 0xe46a5e },
      { island: 'island-01', center: new THREE.Vector3(-18.5, 1.75, 3.5), radius: 4.8, speed: 0.015, color: 0x10b981 },
      { island: 'island-01', center: new THREE.Vector3(-18.5, 1.75, 3.5), radius: 3.5, speed: -0.011, color: 0xf59e0b },
      { island: 'island-02', center: new THREE.Vector3(18.5, 1.75, 2.5), radius: 5.0, speed: 0.013, color: 0x8b5cf6 },
      { island: 'island-02', center: new THREE.Vector3(18.5, 1.75, 2.5), radius: 3.8, speed: -0.014, color: 0x06b6d4 }
    ];

    spots.forEach((cfg) => {
      const person = this.createPerson(cfg.color);
      this.scene.add(person);
      this.villagers.push({
        mesh: person,
        center: cfg.center,
        radius: cfg.radius,
        speed: cfg.speed,
        angle: Math.random() * Math.PI * 2,
        baseY: cfg.center.y
      });
    });
  }

  createPerson(color) {
    const person = new THREE.Group();

    // Body
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 0.45, 6),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true })
    );
    body.position.y = 0.35;
    person.add(body);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xfad0b0, roughness: 0.8, flatShading: true })
    );
    head.position.y = 0.65;
    person.add(head);

    // Hat / Hair cap
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(0.16, 0.14, 6),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 })
    );
    cap.position.y = 0.78;
    person.add(cap);

    return person;
  }

  // --- Environment Trees & Nature Decor ---
  createTree(group, pos, scale = 1) {
    const tree = new THREE.Group();
    tree.position.copy(pos);
    tree.scale.setScalar(scale);

    // Trunk
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.16, 0.9, 6),
      new THREE.MeshStandardMaterial({ color: 0x6e4726, roughness: 0.9, flatShading: true })
    );
    trunk.position.y = 0.45;
    trunk.castShadow = !this.isSoftwareGl;
    tree.add(trunk);

    // Low-poly Foliage (3 tiered cones)
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x2e7d56,
      roughness: 0.8,
      flatShading: true
    });

    const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.85, 0.9, 7), leafMat);
    c1.position.y = 1.1;
    c1.castShadow = !this.isSoftwareGl;
    tree.add(c1);

    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.8, 7), leafMat);
    c2.position.y = 1.6;
    c2.castShadow = !this.isSoftwareGl;
    tree.add(c2);

    const c3 = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.65, 7), leafMat);
    c3.position.y = 2.1;
    c3.castShadow = !this.isSoftwareGl;
    tree.add(c3);

    group.add(tree);
  }

  decorateIsland(group, topY, maxRadius, type) {
    // Random trees & flowering bushes on islands
    const count = 7;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 3.5 + Math.random() * (maxRadius - 4.2);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      this.createTree(group, new THREE.Vector3(x, topY, z), 0.8 + Math.random() * 0.4);
    }
  }

  // --- Theme & Day / Night Handling ---
  applyTheme(themeId) {
    this.currentTheme = themeId;
    if (themeId === 'mint') {
      this.scene.background = new THREE.Color(0xe7f5f0);
      this.scene.fog = new THREE.FogExp2(0xe7f5f0, 0.015);
      if (this.oceanMat) this.oceanMat.color.setHex(0x5ea89b);
    } else if (themeId === 'paper') {
      this.scene.background = new THREE.Color(0xf8f4ea);
      this.scene.fog = new THREE.FogExp2(0xf8f4ea, 0.015);
      if (this.oceanMat) this.oceanMat.color.setHex(0x6fb0a3);
    } else if (themeId === 'ink') {
      this.scene.background = new THREE.Color(0x13191c);
      this.scene.fog = new THREE.FogExp2(0x13191c, 0.018);
      if (this.oceanMat) this.oceanMat.color.setHex(0x1a3835);
    }
  }

  applyDayNight(mode) {
    this.dayNightMode = mode;
    if (mode === 'day') {
      this.dirLight.intensity = 1.35;
      this.dirLight.color.setHex(0xfff6e6);
      this.dirLight.position.set(25, 40, 20);
      this.ambientLight.intensity = 0.55;
      this.lighthouseBeacon.intensity = 0;
    } else if (mode === 'sunset') {
      this.dirLight.intensity = 1.1;
      this.dirLight.color.setHex(0xff9944);
      this.dirLight.position.set(35, 18, -25);
      this.ambientLight.intensity = 0.4;
      this.ambientLight.color.setHex(0xffd5b3);
      this.lighthouseBeacon.intensity = 1.5;
    } else if (mode === 'night') {
      this.dirLight.intensity = 0.25;
      this.dirLight.color.setHex(0x8ab4f8);
      this.dirLight.position.set(-15, 30, -20);
      this.ambientLight.intensity = 0.25;
      this.ambientLight.color.setHex(0x38546b);
      this.lighthouseBeacon.intensity = 4.0;
    }
  }

  setReducedMotion(enabled) {
    this.reducedMotion = enabled;
  }

  // --- Interaction & Raycasting ---
  onPointerMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.checkHover();
  }

  checkHover() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // Raycast against building meshes and island groups
    const targets = [];
    this.buildingMeshes.forEach((g) => targets.push(...g.children));
    this.islandMeshes.forEach((g) => targets.push(...g.children));

    const intersects = this.raycaster.intersectObjects(targets, true);

    if (intersects.length > 0) {
      let found = intersects[0].object;
      while (found && !found.userData?.type && found.parent) {
        found = found.parent;
      }
      if (found && found.userData?.type) {
        this.renderer.domElement.style.cursor = 'pointer';
        return;
      }
    }
    this.renderer.domElement.style.cursor = 'default';
  }

  onClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    // 1. First priority: Check Literature / Landmark buildings
    const buildingTargets = [];
    this.buildingMeshes.forEach((g) => buildingTargets.push(...g.children));
    const buildingHits = this.raycaster.intersectObjects(buildingTargets, true);

    if (buildingHits.length > 0) {
      let hit = buildingHits[0].object;
      while (hit && !hit.userData?.id && hit.parent) {
        hit = hit.parent;
      }
      if (hit && hit.userData?.id) {
        if (hit.userData.type === 'literature') {
          this.focusBuilding(hit);
          this.onSelectBuilding(hit.userData);
          return;
        } else if (hit.userData.type === 'landmark') {
          this.focusIsland(hit.userData.islandId);
          this.onSelectIsland(hit.userData.islandId);
          return;
        }
      }
    }

    // 2. Second priority: Check Islands
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
        return;
      }
    }
  }

  // --- Smooth Camera Navigation ---
  focusIsland(islandId) {
    this.selectedIslandId = islandId;
    this.selectedBuildingId = null;

    if (islandId === 'island-center') {
      this.cameraTargetPos.set(0, 10, 16);
      this.controlsTargetPos.set(0, 2.5, -2);
    } else if (islandId === 'island-01') {
      this.cameraTargetPos.set(-18.5, 9, 17);
      this.controlsTargetPos.set(-18.5, 2.2, 3.5);
    } else if (islandId === 'island-02') {
      this.cameraTargetPos.set(18.5, 9, 16);
      this.controlsTargetPos.set(18.5, 2.2, 2.5);
    }
    this.isAnimatingCamera = true;
  }

  focusBuilding(buildingGroup) {
    this.selectedBuildingId = buildingGroup.userData.id;
    const worldPos = new THREE.Vector3();
    buildingGroup.getWorldPosition(worldPos);

    this.cameraTargetPos.set(worldPos.x, worldPos.y + 4.5, worldPos.z + 8);
    this.controlsTargetPos.set(worldPos.x, worldPos.y + 1.2, worldPos.z);
    this.isAnimatingCamera = true;
  }

  resetToOverview() {
    this.selectedIslandId = null;
    this.selectedBuildingId = null;
    this.cameraTargetPos.set(0, 20, 36);
    this.controlsTargetPos.set(0, 1, 0);
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
      visible: vector.z < 1.0 // In front of camera
    };
  }

  getIslandScreenPosition(islandId) {
    let pos;
    if (islandId === 'island-center') pos = new THREE.Vector3(0, 5.2, -2);
    else if (islandId === 'island-01') pos = new THREE.Vector3(-18.5, 4.8, 3.5);
    else if (islandId === 'island-02') pos = new THREE.Vector3(18.5, 4.8, 2.5);
    else return { visible: false };
    return this.getScreenPosition(pos);
  }

  onWindowResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // --- Animation Render Loop ---
  animate() {
    this.frameId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    const time = (now - this.startTime) / 1000;

    // Smooth camera damping if animating
    if (this.isAnimatingCamera) {
      this.camera.position.lerp(this.cameraTargetPos, 0.05);
      this.controls.target.lerp(this.controlsTargetPos, 0.05);

      if (
        this.camera.position.distanceTo(this.cameraTargetPos) < 0.1 &&
        this.controls.target.distanceTo(this.controlsTargetPos) < 0.1
      ) {
        this.isAnimatingCamera = false;
      }
    }

    // Auto slow rotate when idle and motion enabled
    if (!this.reducedMotion && !this.selectedIslandId && !this.isAnimatingCamera) {
      this.scene.rotation.y = Math.sin(time * 0.08) * 0.05;
    }

    // Animated elements (rotations, boats, villagers, ocean waves)
    if (!this.reducedMotion) {
      // Rotating crests
      this.animatedObjects.forEach((item) => {
        item.mesh.rotation.y += item.rotSpeed || 0.01;
      });

      // Cruising sailboats
      this.boats.forEach((b) => {
        b.angle += b.speed;
        b.mesh.position.x = Math.cos(b.angle) * b.radius;
        b.mesh.position.z = Math.sin(b.angle) * b.radius;
        b.mesh.rotation.y = -b.angle - Math.PI / 2;
        b.mesh.position.y = 0.1 + Math.sin(time * 2 + b.angle) * 0.08;
      });

      // Strolling villagers
      this.villagers.forEach((v) => {
        v.angle += v.speed;
        v.mesh.position.x = v.center.x + Math.cos(v.angle) * v.radius;
        v.mesh.position.z = v.center.z + Math.sin(v.angle) * v.radius;
        v.mesh.rotation.y = -v.angle + (v.speed > 0 ? -Math.PI / 2 : Math.PI / 2);
        // Step bounce
        v.mesh.position.y = v.baseY + Math.abs(Math.sin(time * 6 + v.angle * 4)) * 0.1;
      });

      // Subtle water wave displacement
      if (this.oceanMesh) {
        this.oceanMesh.position.y = -0.15 + Math.sin(time * 1.5) * 0.06;
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    // Emit event for UI HTML label tracking
    if (this.options.onRenderFrame) {
      this.options.onRenderFrame();
    }
  }

  destroy() {
    cancelAnimationFrame(this.frameId);
    window.removeEventListener('resize', this.onWindowResize);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('click', this.onClick);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
