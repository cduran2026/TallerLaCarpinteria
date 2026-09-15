(function () {
  "use strict";
  // Script clásico (no ES module): usa los globales THREE / THREE.OrbitControls
  // que cargan assets/vendor/three.min.js y assets/vendor/OrbitControls.js antes que este archivo.
  // Así funciona también abriendo index.html directamente (file://), sin depender de un servidor.
  const wrap = document.querySelector("[data-furniture-viewer]");
  if (wrap) {
    try { initFurnitureConfigurator(wrap); }
    catch (error) {
      const status = wrap.querySelector("#furniture-loading span:last-child");
      if (status) status.textContent = "Vista 3D no disponible. Puedes seguir configurando y cotizando tu proyecto.";
      console.error("No se pudo iniciar el visor 3D", error);
    }
  }

  function initFurnitureConfigurator(wrap) {
  const canvas = wrap.querySelector("#furniture-canvas");
  const loading = wrap.querySelector("#furniture-loading");
  const readout = document.querySelector("#furniture-readout");

  const PANEL_THICKNESS = 0.018; // 1.8 cm, in meters
  const state = window.TALLER_CONFIGURATION.getState();
  // ---- Renderer / scene / camera ----------------------------------------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  camera.position.set(2.5, 1.55, 2.85);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.1;
  controls.maxDistance = 16;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, state.height / 200, 0);

  // ---- Lighting -----------------------------------------------------------
  scene.add(new THREE.HemisphereLight(0xf6f1e7, 0x362f27, 0.85));

  const keyLight = new THREE.DirectionalLight(0xfff3df, 2.8);
  keyLight.position.set(3.2, 4.6, 3.4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 20;
  keyLight.shadow.camera.left = -6;
  keyLight.shadow.camera.right = 6;
  keyLight.shadow.camera.top = 6;
  keyLight.shadow.camera.bottom = -6;
  keyLight.shadow.bias = -0.0015;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xcfe0ff, 0.55);
  fillLight.position.set(-3.4, 2.4, -2.2);
  scene.add(fillLight);

  // Piso y pared de fondo: para que el mueble se sienta instalado en un pequeño ambiente
  // y no como bloques flotando en el vacío. Colores e intensidades distintas entre ambos
  // para dar profundidad y separación visual clara mueble/pared/piso.
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(9, 64),
    new THREE.MeshStandardMaterial({ color: 0xc9b596, roughness: 0.95, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 4.2),
    new THREE.MeshStandardMaterial({ color: 0xf1ece1, roughness: 0.98, metalness: 0 })
  );
  backWall.position.set(0, 2.1, 0);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const sideWall = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 4.2),
    new THREE.MeshStandardMaterial({ color: 0xeae4d6, roughness: 0.98, metalness: 0 })
  );
  sideWall.position.set(0, 2.1, 0);
  sideWall.rotation.y = Math.PI / 2;
  sideWall.receiveShadow = true;
  scene.add(sideWall);

  // Paredes pegadas al mueble: se reposicionan en cada rebuild porque la profundidad
  // y el ancho son configurables (si no, quedarían muy lejos o atravesando el mobiliario).
  function updateRoom() {
    const d = state.depth / 100;
    const w = state.width / 100;
    const legExtra = state.type === "kitchen" && state.kitchenLayout === "l" ? state.secondLeg / 100 : 0;
    backWall.position.z = -d / 2 - 0.03;
    sideWall.position.x = -(w / 2 + 0.7);
    sideWall.position.z = legExtra > 0 ? legExtra / 2 : 0;
  }

  const furnitureGroup = new THREE.Group();
  const dimensionGroup = new THREE.Group();
  scene.add(furnitureGroup, dimensionGroup);

  // ---- Helpers --------------------------------------------------------------
  function disposeGroup(group) {
    const disposedMaterials = new Set();
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((mat) => {
          if (sharedMaterials.has(mat) || disposedMaterials.has(mat)) return;
          disposedMaterials.add(mat);
          if (mat.map) mat.map.dispose();
          mat.dispose();
        });
      }
    });
    group.clear();
  }

  function materialRoughness(type) {
    if (type === "premium") return { roughness: 0.42, metalness: 0.06 };
    return { roughness: 0.8, metalness: 0.02 };
  }

  function makePanelMaterial() {
    const props = materialRoughness(state.material);
    return new THREE.MeshStandardMaterial({ color: state.color, roughness: props.roughness, metalness: props.metalness });
  }
  const interiorMaterial = new THREE.MeshStandardMaterial({ color: 0xf2eee6, roughness: 0.92, metalness: 0 });
  const handleMaterial = new THREE.MeshStandardMaterial({ color: 0xc9a85b, roughness: 0.32, metalness: 0.68 });
  const counterMaterial = new THREE.MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.28, metalness: 0.04 });
  const toeKickMaterial = new THREE.MeshStandardMaterial({ color: 0x1c1a17, roughness: 0.85, metalness: 0.05 });
  const sinkMaterial = new THREE.MeshStandardMaterial({ color: 0x3a3f42, roughness: 0.3, metalness: 0.65 });
  const ovenFrameMaterial = new THREE.MeshStandardMaterial({ color: 0xb9bcc0, roughness: 0.32, metalness: 0.78 });
  const ovenGlassMaterial = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.16, metalness: 0.45 });
  const ovenHandleMaterial = new THREE.MeshStandardMaterial({ color: 0xdadcde, roughness: 0.25, metalness: 0.82 });
  const hoodMaterial = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.3, metalness: 0.7 });

  const sharedMaterials = new Set([interiorMaterial, handleMaterial, counterMaterial, toeKickMaterial, sinkMaterial, ovenFrameMaterial, ovenGlassMaterial, ovenHandleMaterial, hoodMaterial]);

  function addBox(group, mat, sx, sy, sz, px, py, pz, { shadow = true, receive = true } = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(sx, 0.001), Math.max(sy, 0.001), Math.max(sz, 0.001)), mat);
    mesh.position.set(px, py, pz);
    mesh.castShadow = shadow;
    mesh.receiveShadow = receive;
    group.add(mesh);
    return mesh;
  }

  function addHandle(group, px, py, pz, horizontal, length, material) {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, length, 10), material || handleMaterial);
    if (horizontal) handle.rotation.z = Math.PI / 2;
    handle.position.set(px, py, pz);
    handle.castShadow = true;
    group.add(handle);
    return handle;
  }

  // ---- Furniture builder: dispatch by type -----------------------------------
  function buildFurniture() {
    disposeGroup(furnitureGroup);
    if (state.type === "kitchen") buildKitchen();
    else buildCloset();
  }

  // ---- Closet: paneles abiertos, barra, repisas y cajones --------------------
  function buildCloset() {
    const w = state.width / 100;
    const h = state.height / 100;
    const d = state.depth / 100;
    const T = PANEL_THICKNESS;
    const panelMat = makePanelMaterial();

    addBox(furnitureGroup, panelMat, T, h, d, -w / 2 + T / 2, h / 2, 0);
    addBox(furnitureGroup, panelMat, T, h, d, w / 2 - T / 2, h / 2, 0);
    addBox(furnitureGroup, panelMat, w - 2 * T, T, d, 0, h - T / 2, 0);
    addBox(furnitureGroup, panelMat, w - 2 * T, T, d, 0, T / 2, 0);
    addBox(furnitureGroup, panelMat, w - 2 * T, h - 2 * T, T, 0, h / 2, -d / 2 + T / 2);
    addBox(furnitureGroup, interiorMaterial, w - 2 * T - 0.002, h - 2 * T - 0.002, 0.001, 0, h / 2, -d / 2 + T + 0.001, { shadow: false });

    const innerW = w - 2 * T;
    const innerH = h - 2 * T;
    const drawerCount = state.drawers;
    const drawerUnitH = drawerCount > 0 ? Math.min(0.3, (innerH * 0.6) / drawerCount) : 0;
    const drawerStackH = drawerUnitH * drawerCount;

    for (let i = 0; i < drawerCount; i++) {
      const cy = T + drawerUnitH * i + drawerUnitH / 2;
      addBox(furnitureGroup, panelMat, innerW - 0.006, drawerUnitH - 0.006, T * 0.9, 0, cy, d / 2 - T * 0.45);
      addHandle(furnitureGroup, 0, cy, d / 2 + 0.012, true, Math.max(innerW * 0.32, 0.05));
    }

    const shelvesTop = h - T;
    const shelvesBottom = T + drawerStackH;
    const availableH = shelvesTop - shelvesBottom;
    if (state.shelves > 0 && availableH > 0.08) {
      const gap = availableH / (state.shelves + 1);
      for (let i = 1; i <= state.shelves; i++) {
        const y = shelvesBottom + gap * i;
        addBox(furnitureGroup, interiorMaterial, innerW - 0.004, 0.02, d - T - 0.01, 0, y, T / 2);
      }
    }

    if (state.rod) {
      const rodY = Math.max(shelvesBottom + 0.05, h - T - 0.12);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, innerW - 0.05, 12), handleMaterial);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(0, rodY, 0);
      rod.castShadow = true;
      furnitureGroup.add(rod);
    }
  }

  // ---- Cocina: muebles inferiores + mesón, superiores opcionales, en L y artefactos ------
  function buildKitchen() {
    const main = new THREE.Group();
    furnitureGroup.add(main);
    buildKitchenRun(main, state.width / 100, true);
    if (state.kitchenLayout === "l") {
      const leg = new THREE.Group();
      furnitureGroup.add(leg);
      buildKitchenRun(leg, state.secondLeg / 100, false);
      leg.rotation.y = -Math.PI / 2;
      leg.position.set((state.width - state.depth) / 200, 0, (state.depth + state.secondLeg) / 200);
    }
  }

  function buildKitchenRun(group, w, appliances) {
    const d = state.depth / 100;
    const T = PANEL_THICKNESS;
    const panelMat = makePanelMaterial();

    // Proporciones de cocina real (fijas, no dependen del alto total de 2.4 m):
    // base ~87 cm con cubierta, ~55 cm de espacio de respiro, aéreo ~70 cm de alto y ~33 cm de fondo.
    // Antes el aéreo llenaba todo el espacio restante hasta el techo (hasta 1.4 m) y por eso
    // se veía como un segundo closet apilado sobre la base; ahora queda una franja angosta real.
    const baseH = 0.87;
    const counterT = 0.04;
    const upperGap = 0.55;
    const upperH = 0.7;
    const upperD = Math.min(d * 0.55, 0.33);
    const upperBottom = baseH + counterT + upperGap;
    const numModules = Math.max(2, Math.min(6, Math.round(w / 0.6)));
    const moduleW = w / numModules;

    if (state.lower) {
      addBox(group, panelMat, T, baseH, d, -w / 2 + T / 2, baseH / 2, 0);
      addBox(group, panelMat, T, baseH, d, w / 2 - T / 2, baseH / 2, 0);
      addBox(group, panelMat, w - 2 * T, T, d, 0, T / 2, 0);
      addBox(group, panelMat, w - 2 * T, baseH - 2 * T, T, 0, baseH / 2, -d / 2 + T / 2);
      addBox(group, toeKickMaterial, w - 2 * T, 0.09, T, 0, 0.045, d / 2 - T / 2 - 0.02, { shadow: false });

      const drawerModules = 1; // un módulo con cajones, fijo, sólo de apoyo visual
      // El horno ocupa un módulo completo (el del medio): ese módulo no dibuja su puerta
      // ni manilla normal, porque el horno pone su propio frente encima.
      const ovenModuleIndex = (appliances && state.oven) ? Math.min(numModules - 1, Math.floor(numModules / 2)) : -1;
      for (let i = 0; i < numModules; i++) {
        if (i === ovenModuleIndex) continue;
        const cx = -w / 2 + moduleW * i + moduleW / 2;
        const frontZ = d / 2 - T * 0.4;
        if (i < drawerModules) {
          const stack = 2;
          const frontH = (baseH - T * 1.4) / stack;
          for (let s = 0; s < stack; s++) {
            const cy = T * 0.7 + frontH * s + frontH / 2;
            addBox(group, panelMat, moduleW - 0.01, frontH - 0.006, T * 0.8, cx, cy, frontZ);
            addHandle(group, cx, cy, frontZ + T * 0.4 + 0.01, true, moduleW * 0.4);
          }
        } else {
          const frontH = baseH - T * 1.4;
          const cy = T * 0.7 + frontH / 2;
          const side = cx < 0 ? 1 : -1;
          addBox(group, panelMat, moduleW - 0.01, frontH, T * 0.8, cx, cy, frontZ);
          addHandle(group, cx + side * (moduleW * 0.32), cy, frontZ + T * 0.4 + 0.01, false, 0.13);
        }
      }

      addBox(group, counterMaterial, w + 0.02, counterT, d + 0.03, 0, baseH + counterT / 2, 0.01);

      if (appliances && state.sink) {
        addBox(group, sinkMaterial, Math.min(0.5, w * 0.3), 0.02, Math.min(0.36, d * 0.55), 0, baseH + counterT - 0.008, 0, { shadow: false });
      }
      if ((appliances && state.oven)) {
        // Horno con marco de acero, vidrio oscuro, panel de control y manilla horizontal
        // (en vez de una manilla vertical como las puertas), para que se lea como
        // electrodoméstico y no como un simple panel de otro color. Ocupa el módulo
        // completo calculado arriba (ovenModuleIndex), que no dibujó su puerta ni manilla.
        const ovenCx = -w / 2 + moduleW * ovenModuleIndex + moduleW / 2;
        const ovenW = Math.min(moduleW - 0.02, 0.58);
        const ovenH = baseH - T * 1.6;
        const ovenCy = T * 0.8 + ovenH / 2;
        const frontZ = d / 2 - T * 0.25;
        addBox(group, ovenFrameMaterial, ovenW, ovenH, T * 0.55, ovenCx, ovenCy, frontZ);
        const glassW = ovenW - 0.045;
        const glassH = ovenH - 0.05;
        const glassZ = frontZ + T * 0.32;
        addBox(group, ovenGlassMaterial, glassW, glassH * 0.72, T * 0.15, ovenCx, ovenCy - glassH * 0.06, glassZ);
        addBox(group, ovenFrameMaterial, glassW, glassH * 0.14, T * 0.15, ovenCx, ovenCy + glassH * 0.43, glassZ);
        addHandle(group, ovenCx, ovenCy + glassH * 0.3, glassZ + 0.02, true, ovenW * 0.68, ovenHandleMaterial);
      }
    }

    if (state.upper && upperH > 0.15) {
      const upperCenterZ = -d / 2 + upperD / 2;
      const upperCy = upperBottom + upperH / 2;
      addBox(group, panelMat, T, upperH, upperD, -w / 2 + T / 2, upperCy, upperCenterZ);
      addBox(group, panelMat, T, upperH, upperD, w / 2 - T / 2, upperCy, upperCenterZ);
      addBox(group, panelMat, w - 2 * T, T, upperD, 0, upperBottom + upperH - T / 2, upperCenterZ);
      addBox(group, panelMat, w - 2 * T, T, upperD, 0, upperBottom + T / 2, upperCenterZ);
      addBox(group, panelMat, w - 2 * T, upperH - 2 * T, T, 0, upperCy, -d / 2 + T / 2);

      const doorZ = -d / 2 + upperD - T * 0.4;
      for (let i = 0; i < numModules; i++) {
        const cx = -w / 2 + moduleW * i + moduleW / 2;
        const side = cx < 0 ? 1 : -1;
        addBox(group, panelMat, moduleW - 0.01, upperH - 2 * T, T * 0.8, cx, upperCy, doorZ);
        addHandle(group, cx + side * (moduleW * 0.32), upperCy, doorZ + T * 0.4 + 0.01, false, 0.12);
      }
    }

    if (appliances && state.hood) {
      // Campana montada justo bajo la línea de los aéreos (o de donde irían si no están
      // activos), con un ducto corto de conexión hacia arriba para que se vea integrada.
      const hoodW = Math.min(w * 0.34, 0.85);
      const hoodD = Math.min(d * 0.62, 0.4);
      const hoodH = 0.2;
      const hoodZ = -d / 2 + hoodD / 2 + 0.04;
      const canopyTop = upperBottom - 0.06;
      addBox(group, hoodMaterial, hoodW, hoodH, hoodD, 0, canopyTop - hoodH / 2, hoodZ, { shadow: false });
      const ductH = 0.06;
      addBox(group, hoodMaterial, hoodW * 0.4, ductH, hoodD * 0.6, 0, canopyTop + ductH / 2, hoodZ, { shadow: false });
    }

  }

  // ---- Dimension lines (cotas) ------------------------------------------------
  function formatMeasure(cmValue) {
    return state.unit === "mm" ? `${Math.round(cmValue * 10)} mm` : `${Math.round(cmValue)} cm`;
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function makeTextSprite(text) {
    const canvasEl = document.createElement("canvas");
    const ctx = canvasEl.getContext("2d");
    const scale = 2;
    const cw = 220;
    const ch = 68;
    canvasEl.width = cw * scale;
    canvasEl.height = ch * scale;
    ctx.scale(scale, scale);
    ctx.font = "700 28px Inter, Arial, sans-serif";
    const textWidth = ctx.measureText(text).width;
    const boxW = Math.min(cw - 8, textWidth + 32);
    const boxH = 40;
    const x = (cw - boxW) / 2;
    const y = (ch - boxH) / 2;
    ctx.fillStyle = "rgba(28,36,30,0.92)";
    roundRectPath(ctx, x, y, boxW, boxH, 10);
    ctx.fill();
    ctx.fillStyle = "#F4EFEA";
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(text, cw / 2, y + boxH / 2 + 1);
    const texture = new THREE.CanvasTexture(canvasEl);
    texture.encoding = THREE.sRGBEncoding;
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.46, (0.46 * ch) / cw, 1);
    return sprite;
  }

  function makeLine(points, color) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: color ?? 0xbfa15f, depthTest: false, transparent: true, opacity: 0.9 });
    return new THREE.Line(geometry, material);
  }

  function buildDimensions() {
    disposeGroup(dimensionGroup);
    const bounds = new THREE.Box3().setFromObject(furnitureGroup);
    const size = bounds.getSize(new THREE.Vector3());
    const w = size.x;
    const h = size.y;
    const d = size.z;
    dimensionGroup.position.set(bounds.getCenter(new THREE.Vector3()).x, bounds.min.y, bounds.getCenter(new THREE.Vector3()).z);
    const V3 = THREE.Vector3;
    const margin = 0.24;
    const tick = 0.05;
    const extColor = 0x9c8a63;

    const zW = d / 2 + margin;
    dimensionGroup.add(makeLine([new V3(-w / 2, 0, zW), new V3(w / 2, 0, zW)]));
    dimensionGroup.add(makeLine([new V3(-w / 2, -tick / 2, zW), new V3(-w / 2, tick / 2, zW)]));
    dimensionGroup.add(makeLine([new V3(w / 2, -tick / 2, zW), new V3(w / 2, tick / 2, zW)]));
    dimensionGroup.add(makeLine([new V3(-w / 2, 0, d / 2), new V3(-w / 2, 0, zW)], extColor));
    dimensionGroup.add(makeLine([new V3(w / 2, 0, d / 2), new V3(w / 2, 0, zW)], extColor));
    const widthLabel = makeTextSprite(formatMeasure(w * 100));
    widthLabel.position.set(0, 0, zW + 0.05);
    dimensionGroup.add(widthLabel);

    const xH = w / 2 + margin;
    dimensionGroup.add(makeLine([new V3(xH, 0, 0), new V3(xH, h, 0)]));
    dimensionGroup.add(makeLine([new V3(xH - tick / 2, 0, 0), new V3(xH + tick / 2, 0, 0)]));
    dimensionGroup.add(makeLine([new V3(xH - tick / 2, h, 0), new V3(xH + tick / 2, h, 0)]));
    dimensionGroup.add(makeLine([new V3(w / 2, 0, 0), new V3(xH, 0, 0)], extColor));
    dimensionGroup.add(makeLine([new V3(w / 2, h, 0), new V3(xH, h, 0)], extColor));
    const heightLabel = makeTextSprite(formatMeasure(h * 100));
    heightLabel.position.set(xH + 0.06, h / 2, 0);
    dimensionGroup.add(heightLabel);

    const xD = w / 2 + margin;
    const yD = h + margin * 0.55;
    dimensionGroup.add(makeLine([new V3(xD, yD, -d / 2), new V3(xD, yD, d / 2)]));
    dimensionGroup.add(makeLine([new V3(xD - tick / 2, yD, -d / 2), new V3(xD + tick / 2, yD, -d / 2)]));
    dimensionGroup.add(makeLine([new V3(xD - tick / 2, yD, d / 2), new V3(xD + tick / 2, yD, d / 2)]));
    dimensionGroup.add(makeLine([new V3(w / 2, h, -d / 2), new V3(xD, yD, -d / 2)], extColor));
    dimensionGroup.add(makeLine([new V3(w / 2, h, d / 2), new V3(xD, yD, d / 2)], extColor));
    const depthLabel = makeTextSprite(formatMeasure(d * 100));
    depthLabel.position.set(xD, yD + 0.06, 0);
    dimensionGroup.add(depthLabel);
    if (state.type === "kitchen" && state.kitchenLayout === "l") {
      const center = bounds.getCenter(new THREE.Vector3());
      const x = bounds.max.x - center.x + 0.45;
      const z0 = state.depth / 200 - center.z;
      const z1 = z0 + state.secondLeg / 100;
      dimensionGroup.add(makeLine([new V3(x, 0, z0), new V3(x, 0, z1)]));
      const label = makeTextSprite("Tramo " + formatMeasure(state.secondLeg));
      label.position.set(x, 0.12, (z0 + z1) / 2);
      dimensionGroup.add(label);
    }
  }

  // ---- Camera framing ---------------------------------------------------------
  let lastFrameKey = "";
  function frameCamera() {
    // Bounding sphere in meters also accounts for portrait viewports and dimension labels.
    const bounds = new THREE.Box3().setFromObject(furnitureGroup);
    const frameKey = [...bounds.min.toArray(), ...bounds.max.toArray(), camera.aspect].join(",");
    if (frameKey === lastFrameKey) return;
    lastFrameKey = frameKey;
    bounds.expandByScalar(0.35);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
    const distance = sphere.radius / Math.sin(Math.min(verticalFov, horizontalFov) / 2);
    const direction = camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(sphere.center);
    camera.position.copy(sphere.center).addScaledVector(direction, distance);
    controls.maxDistance = Math.max(16, distance * 2);
  }

  // ---- Render loop --------------------------------------------------------------
  let dirty = true;
  let firstFrame = true;

  function resize() {
    const rect = wrap.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (furnitureGroup.children.length) frameCamera();
  }

  function syncReadout() {
    if (!readout) return;
    const size = new THREE.Box3().setFromObject(furnitureGroup).getSize(new THREE.Vector3());
    const legText = state.type === "kitchen" && state.kitchenLayout === "l" ? ` · Segundo tramo: ${formatMeasure(state.secondLeg)}` : "";
    readout.textContent = `Dimensiones exteriores: ${formatMeasure(size.x * 100)} × ${formatMeasure(size.y * 100)} × ${formatMeasure(size.z * 100)}${legText}`;

  }

  function animate() {
    if (dirty) {
      buildFurniture();
      buildDimensions();
      updateRoom();
      frameCamera();
      syncReadout();
      dirty = false;
      if (firstFrame) {
        firstFrame = false;
        if (loading) loading.hidden = true;
      }
    }
    controls.update();
    renderer.render(scene, camera);
  }

  resize();
  renderer.setAnimationLoop(animate);

  if ("ResizeObserver" in window) {
    new ResizeObserver(() => resize()).observe(wrap);
  } else {
    window.addEventListener("resize", resize);
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          renderer.setAnimationLoop(entry.isIntersecting ? animate : null);
        });
      },
      { threshold: 0.02 }
    ).observe(wrap);
  }

  window.TALLER_CONFIGURATION.subscribe((configuration) => {
    Object.assign(state, configuration);
    dirty = true;
  });
  }
})();
