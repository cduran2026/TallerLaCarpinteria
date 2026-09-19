let threePromise;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = [...document.scripts].find(script => script.src === src);
    if (existing?.dataset.loaded === 'true') { resolve(); return; }
    const script = existing || document.createElement('script');
    script.src = src;
    script.addEventListener('load', () => { script.dataset.loaded = 'true'; resolve(); }, { once: true });
    script.addEventListener('error', () => reject(new Error('No se pudo cargar el visor 3D.')), { once: true });
    if (!existing) document.head.append(script);
  });
}

async function loadThree() {
  if (window.THREE?.OrbitControls) return window.THREE;
  if (!threePromise) {
    const root = new URL('../../../', import.meta.url);
    threePromise = loadScript(new URL('assets/vendor/three.min.js', root).href)
      .then(() => loadScript(new URL('assets/vendor/OrbitControls.js', root).href))
      .then(() => window.THREE);
  }
  return threePromise;
}

function resolved(component) {
  return Math.max(0, Number(component?.quantity?.resolved) || 0);
}

export async function createClosetViewer(container, onSelect) {
  const THREE = await loadThree();
  const canvas = document.createElement('canvas');
  canvas.className = 'closet-viewer-canvas';
  container.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f1e8);
  const camera = new THREE.PerspectiveCamera(35, 1, .01, 100);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = .07;
  controls.maxPolarAngle = Math.PI * .62;
  controls.minDistance = 2;
  controls.maxDistance = 10;
  scene.add(new THREE.HemisphereLight(0xfffbef, 0x59685e, .9));
  const key = new THREE.DirectionalLight(0xffffff, .85);
  key.position.set(3, 5, 4); key.castShadow = true; scene.add(key);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0xe7e0d3, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(12, 24, 0xc8bda9, 0xded7ca);
  grid.material.opacity = .35; grid.material.transparent = true; scene.add(grid);
  let furniture = new THREE.Group(); scene.add(furniture);
  let widthM = 1.8, heightM = 2.4, activeView = 'perspective', framed = false;

  function box(width, height, depth, material, x, y, z, moduleId) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.moduleId = moduleId; furniture.add(mesh); return mesh;
  }

  function disposeGroup(group) {
    const geometries = new Set(); const materials = new Set();
    group.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (Array.isArray(object.material)) object.material.forEach(material => materials.add(material));
      else if (object.material) materials.add(object.material);
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }

  function renderState(envelope, activeId) {
    scene.remove(furniture); disposeGroup(furniture); furniture = new THREE.Group(); scene.add(furniture);
    const configuration = envelope.configuration;
    const modules = configuration.modules.slice().sort((a, b) => a.order - b.order);
    widthM = configuration.layout.runs[0].lengthMm / 1000;
    heightM = configuration.dimensions.heightMm / 1000;
    const panel = configuration.standards.snapshot.panels.carcassThicknessMm / 1000;
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xcbb999, roughness: .76 });
    const selectedMaterial = new THREE.MeshStandardMaterial({ color: 0xb8954c, roughness: .7 });
    const insideMaterial = new THREE.MeshStandardMaterial({ color: 0xddd0b8, roughness: .82 });
    const frontMaterial = new THREE.MeshStandardMaterial({ color: 0x395444, roughness: .6 });
    const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x7d817d, metalness: .75, roughness: .28 });
    let cursor = -widthM / 2;
    for (const module of modules) {
      const width = module.dimensions.widthMm / 1000;
      const height = module.dimensions.heightMm / 1000;
      const depth = module.dimensions.depthMm / 1000;
      const center = cursor + width / 2;
      const carcass = module.id === activeId ? selectedMaterial : bodyMaterial;
      box(panel, height, depth, carcass, cursor + panel / 2, height / 2, 0, module.id);
      box(panel, height, depth, carcass, cursor + width - panel / 2, height / 2, 0, module.id);
      box(Math.max(.01, width - panel * 2), panel, depth, carcass, center, panel / 2, 0, module.id);
      box(Math.max(.01, width - panel * 2), panel, depth, carcass, center, height - panel / 2, 0, module.id);
      box(Math.max(.01, width - panel * 2), Math.max(.01, height - panel * 2), .008, insideMaterial, center, height / 2, -depth / 2, module.id);
      for (const component of module.components) {
        const amount = resolved(component);
        if (component.type === 'shelfSet' && amount) {
          for (let index = 1; index <= amount; index++) {
            const y = panel + (height - panel * 2) * index / (amount + 1);
            box(Math.max(.01, width - panel * 2), panel, Math.max(.05, depth - panel), insideMaterial, center, y, 0, module.id);
          }
        }
        if (component.type === 'drawerStack' && amount) {
          const drawerHeight = Math.min(.22, Math.max(.13, (height * .48) / amount));
          for (let index = 0; index < amount; index++) {
            box(Math.max(.01, width - panel * 2.5), drawerHeight - .012, .035, frontMaterial,
              center, panel + drawerHeight / 2 + index * drawerHeight, depth / 2 + .02, module.id);
          }
        }
        if (component.type === 'rodSet' && amount) {
          for (let index = 0; index < amount; index++) {
            const geometry = new THREE.CylinderGeometry(.012, .012, Math.max(.05, width - panel * 3), 18);
            const rod = new THREE.Mesh(geometry, metalMaterial); rod.rotation.z = Math.PI / 2;
            rod.position.set(center, Math.min(height - .25, (component.options.heightMm || 1650) / 1000 - index * .16), 0);
            rod.castShadow = true; rod.userData.moduleId = module.id; furniture.add(rod);
          }
        }
        if (component.type === 'doorSet' && amount) {
          const leafWidth = (width - .014) / amount;
          for (let index = 0; index < amount; index++) {
            box(leafWidth - .008, height - .025, .018, frontMaterial,
              cursor + .007 + leafWidth * (index + .5), height / 2, depth / 2 + .025, module.id);
          }
        }
      }
      cursor += width;
    }
    if (!framed) { setView(activeView); framed = true; }
  }

  function setView(view) {
    activeView = view;
    const center = new THREE.Vector3(0, heightM * .48, 0);
    const distance = Math.max(4, widthM * 1.55, heightM * 1.75);
    if (view === 'front') camera.position.set(0, heightM * .52, distance);
    else if (view === 'top') camera.position.set(0, Math.max(4.2, heightM * 1.9), .01);
    else camera.position.set(widthM * .85, heightM * .82, distance);
    controls.target.copy(center); controls.update();
  }

  const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2();
  canvas.addEventListener('pointerup', event => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(furniture.children, false).find(item => item.object.userData.moduleId);
    if (hit) onSelect?.(hit.object.userData.moduleId);
  });

  const resize = new ResizeObserver(() => {
    const width = Math.max(1, container.clientWidth); const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
  });
  resize.observe(container);
  let frame;
  const animate = () => { frame = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); };
  animate();
  let disposed = false;

  return {
    setState: renderState,
    setView,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame); resize.disconnect(); controls.dispose(); disposeGroup(furniture);
      floor.geometry.dispose(); floor.material.dispose(); renderer.dispose(); canvas.remove();
    },
  };
}
