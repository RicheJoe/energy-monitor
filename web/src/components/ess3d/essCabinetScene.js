import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { getClusterLayout, getPcsLayout, CLUSTER, PCS } from "./layout.js";
import { createDeviceData, tickDeviceData } from "./telemetry.js";
import {
  clusterFragmentShader,
  clusterVertexShader,
  flowFragmentShader,
  flowVertexShader
} from "./shaders.js";

const MODEL_URL = "/models/ess-cabinet.glb";

function makeBoxWithLengthUv(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    uv.setXY(i, (x + w / 2) / w, (pos.getY(i) + h / 2) / h);
  }
  uv.needsUpdate = true;
  return geo;
}

function setInstanceAttr(mesh, name, values) {
  let attr = mesh.geometry.getAttribute(name);
  if (!attr || attr.count !== values.length) {
    attr = new THREE.InstancedBufferAttribute(new Float32Array(values.length), 1);
    mesh.geometry.setAttribute(name, attr);
  }
  attr.array.set(values);
  attr.needsUpdate = true;
}

function createInstancedDevices(kind, items, size, material) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geo, material, items.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.userData.kind = kind;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  items.forEach((item, i) => {
    dummy.position.set(item.x, item.y, item.z);
    dummy.scale.set(size[0], size[1], size[2]);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

function createBusbars(clusters, pcsList) {
  const group = new THREE.Group();
  group.name = "CurrentBus";
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color("#0a2a36") },
      uFlowColor: { value: new THREE.Color("#3cf0ff") }
    },
    vertexShader: flowVertexShader,
    fragmentShader: flowFragmentShader
  });

  const topY = Math.max(...clusters.map(c => c.y)) + CLUSTER.size[1] / 2 + 0.07;
  const minX = Math.min(...clusters.map(c => c.x));
  const maxX = Math.max(...pcsList.map(p => p.x));
  const z = 0.34;
  const length = maxX - minX + 0.2;
  const rail = new THREE.Mesh(makeBoxWithLengthUv(length, 0.03, 0.03), material);
  rail.position.set((minX + maxX) / 2, topY, z);
  group.add(rail);

  clusters.forEach(item => {
    const dropH = topY - (item.y + CLUSTER.size[1] / 2);
    const drop = new THREE.Mesh(makeBoxWithLengthUv(0.018, dropH, 0.018), material);
    drop.position.set(item.x, topY - dropH / 2, z);
    drop.rotation.z = Math.PI / 2;
    const geo = drop.geometry;
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getY(i) + dropH / 2) / dropH, (pos.getX(i) + 0.009) / 0.018);
    }
    uv.needsUpdate = true;
    group.add(drop);
  });

  pcsList.forEach(item => {
    const dropH = topY - (item.y + PCS.size[1] / 2) + 0.04;
    const drop = new THREE.Mesh(makeBoxWithLengthUv(0.028, Math.abs(dropH) + 0.04, 0.028), material);
    drop.position.set(item.x, topY - 0.08, z);
    group.add(drop);
  });

  return { group, material };
}

function createGround() {
  const group = new THREE.Group();
  const grid = new THREE.GridHelper(12, 24, 0x1d3a44, 0x13222a);
  grid.position.y = 0;
  group.add(grid);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(6.5, 48),
    new THREE.MeshStandardMaterial({
      color: 0x0b141c,
      roughness: 0.92,
      metalness: 0.08
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);
  return group;
}

export async function mountEssScene(container, handlers = {}) {
  const clusters = getClusterLayout();
  const pcsList = getPcsLayout();
  const data = createDeviceData(clusters, pcsList, handlers.seed ?? 0);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#071018");
  scene.fog = new THREE.Fog("#071018", 8, 18);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.08, 50);
  camera.position.set(2.4, 1.85, 3.9);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 2.2;
  controls.maxDistance = 10;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 1.1, 0);

  scene.add(new THREE.HemisphereLight(0xb7d4ff, 0x0c1418, 0.7));
  const key = new THREE.DirectionalLight(0xf2f6ff, 1.35);
  key.position.set(4.2, 6.5, 3.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 18;
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  scene.add(key);
  const fill = new THREE.PointLight(0x2ee6c6, 18, 8, 2);
  fill.position.set(-0.4, 1.6, 0.8);
  scene.add(fill);

  scene.add(createGround());

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(MODEL_URL);
  const cabinet = gltf.scene;
  cabinet.traverse(obj => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.material) {
        obj.material.vertexColors = true;
        obj.material.metalness = 0.62;
        obj.material.roughness = 0.4;
      }
    }
  });
  scene.add(cabinet);

  const clusterMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: clusterVertexShader,
    fragmentShader: clusterFragmentShader
  });
  const pcsMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: clusterVertexShader,
    fragmentShader: clusterFragmentShader
  });

  const clusterMesh = createInstancedDevices("cluster", data.clusters, CLUSTER.size, clusterMat);
  const pcsMesh = createInstancedDevices("pcs", data.pcs, PCS.size, pcsMat);
  scene.add(clusterMesh, pcsMesh);

  const bus = createBusbars(clusters, pcsList);
  scene.add(bus.group);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let selected = null;
  let hovering = false;
  let disposed = false;
  let usingLive = false;
  let frame = 0;
  let lastTelemetry = 0;
  const clock = new THREE.Clock();

  const syncInstanceAttrs = () => {
    setInstanceAttr(
      clusterMesh,
      "aAlarm",
      data.clusters.map(d => (d.alarm ? 1 : 0))
    );
    setInstanceAttr(
      clusterMesh,
      "aSoc",
      data.clusters.map(d => d.soc)
    );
    setInstanceAttr(
      clusterMesh,
      "aSelected",
      data.clusters.map(d => (selected?.kind === "cluster" && selected.id === d.id ? 1 : 0))
    );
    setInstanceAttr(
      pcsMesh,
      "aAlarm",
      data.pcs.map(d => (d.alarm ? 1 : 0))
    );
    setInstanceAttr(
      pcsMesh,
      "aSoc",
      data.pcs.map(d => d.soc)
    );
    setInstanceAttr(
      pcsMesh,
      "aSelected",
      data.pcs.map(d => (selected?.kind === "pcs" && selected.id === d.id ? 1 : 0))
    );
  };
  syncInstanceAttrs();

  const resize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };

  const toPointer = event => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  const pick = () => {
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects([clusterMesh, pcsMesh], false);
    if (!hits.length) return null;
    const hit = hits[0];
    const kind = hit.object.userData.kind;
    const id = hit.instanceId ?? 0;
    const source = kind === "cluster" ? data.clusters : data.pcs;
    return source[id] ? { ...source[id] } : null;
  };

  const onPointerMove = event => {
    toPointer(event);
    const hit = pick();
    hovering = Boolean(hit);
    renderer.domElement.style.cursor = hovering ? "pointer" : "grab";
    handlers.onHover?.(hit);
  };

  const onClick = event => {
    toPointer(event);
    const hit = pick();
    selected = hit;
    syncInstanceAttrs();
    handlers.onSelect?.(hit);
  };

  const onPointerLeave = () => {
    hovering = false;
    renderer.domElement.style.cursor = "grab";
    handlers.onHover?.(null);
  };

  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("click", onClick);
  renderer.domElement.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("resize", resize);
  resize();

  const animate = () => {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    if (!usingLive) tickDeviceData(data, t);
    syncInstanceAttrs();
    clusterMat.uniforms.uTime.value = t;
    pcsMat.uniforms.uTime.value = t;
    bus.material.uniforms.uTime.value = t;
    if (selected && t - lastTelemetry > 0.2) {
      lastTelemetry = t;
      const list = selected.kind === "cluster" ? data.clusters : data.pcs;
      const live = list[selected.id];
      if (live) handlers.onTelemetry?.({ ...live });
    }
    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  return {
    getData: () => data,
    selectNone() {
      selected = null;
      syncInstanceAttrs();
      handlers.onSelect?.(null);
    },
    applyLive(rows) {
      if (!Array.isArray(rows) || !rows.length) return;
      usingLive = true;
      rows.forEach(row => {
        const list = row.kind === "pcs" ? data.pcs : data.clusters;
        const target = list.find(item => item.id === row.id);
        if (!target) return;
        target.soc = row.soc;
        target.soh = row.soh;
        target.voltage = row.voltage;
        target.current = row.current;
        target.temp = row.temp;
        target.power = row.power;
        target.alarm = Boolean(row.alarm);
        target.alarmText = row.alarmText;
        target.online = row.online;
      });
      if (selected) {
        const list = selected.kind === "pcs" ? data.pcs : data.clusters;
        const live = list.find(item => item.id === selected.id);
        if (live) handlers.onTelemetry?.({ ...live });
      }
    },
    selectById(kind, id) {
      const list = kind === "cluster" ? data.clusters : data.pcs;
      const hit = list.find(item => item.id === id);
      selected = hit ? { ...hit } : null;
      syncInstanceAttrs();
      handlers.onSelect?.(selected);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      controls.dispose();
      renderer.dispose();
      clusterMesh.geometry.dispose();
      pcsMesh.geometry.dispose();
      clusterMat.dispose();
      pcsMat.dispose();
      bus.material.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    }
  };
}
