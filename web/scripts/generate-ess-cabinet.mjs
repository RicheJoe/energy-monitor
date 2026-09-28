/**
 * 生成储能柜外壳 glTF/GLB（不含电池簇 / PCS，那些由运行时 InstancedMesh 绘制）。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const W = 2.62;
const H = 2.28;
const D = 1.02;
const WALL = 0.045;
const BASE = 0.1;
const DIV_X = 0.72;

function rotateY([x, y, z], rad) {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [x * c + z * s, y, -x * s + z * c];
}

function appendBox(buffers, { size, position, rotationY = 0, color }) {
  const [sx, sy, sz] = size;
  const [cx, cy, cz] = position;
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const faces = [
    { n: [0, 0, 1], v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
    { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
    { n: [1, 0, 0], v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
    { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
    { n: [0, 1, 0], v: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
    { n: [0, -1, 0], v: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] }
  ];
  const uvs = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1]
  ];
  const baseIndex = buffers.positions.length / 3;
  for (const face of faces) {
    const n = rotateY(face.n, rotationY);
    for (let i = 0; i < 4; i++) {
      const p = rotateY(face.v[i], rotationY);
      buffers.positions.push(p[0] + cx, p[1] + cy, p[2] + cz);
      buffers.normals.push(n[0], n[1], n[2]);
      buffers.uvs.push(uvs[i][0], uvs[i][1]);
      buffers.colors.push(color[0], color[1], color[2]);
    }
  }
  const idx = [0, 1, 2, 0, 2, 3];
  for (let f = 0; f < 6; f++) {
    for (const i of idx) buffers.indices.push(baseIndex + f * 4 + i);
  }
}

function buildCabinet() {
  const buffers = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
  const metal = [0.18, 0.22, 0.28];
  const dark = [0.08, 0.1, 0.13];
  const accent = [0.08, 0.55, 0.52];

  appendBox(buffers, { size: [W, BASE, D], position: [0, BASE / 2, 0], color: dark });
  appendBox(buffers, {
    size: [W + 0.04, 0.035, D + 0.04],
    position: [0, H - 0.018, 0],
    color: metal
  });
  appendBox(buffers, {
    size: [WALL, H - BASE, D],
    position: [-W / 2 + WALL / 2, BASE + (H - BASE) / 2, 0],
    color: metal
  });
  appendBox(buffers, {
    size: [WALL, H - BASE, D],
    position: [W / 2 - WALL / 2, BASE + (H - BASE) / 2, 0],
    color: metal
  });
  appendBox(buffers, {
    size: [W, H - BASE, WALL],
    position: [0, BASE + (H - BASE) / 2, -D / 2 + WALL / 2],
    color: metal
  });
  appendBox(buffers, {
    size: [WALL * 1.2, H - BASE - 0.08, D - 0.12],
    position: [DIV_X, BASE + (H - BASE) / 2, 0.02],
    color: dark
  });
  appendBox(buffers, {
    size: [W - WALL * 2, 0.05, 0.04],
    position: [0, BASE + 0.04, D / 2 - 0.04],
    color: dark
  });
  appendBox(buffers, {
    size: [0.06, H - BASE - 0.06, 0.06],
    position: [-W / 2 + 0.09, BASE + (H - BASE) / 2, D / 2 - 0.05],
    color: dark
  });
  appendBox(buffers, {
    size: [0.06, H - BASE - 0.06, 0.06],
    position: [W / 2 - 0.09, BASE + (H - BASE) / 2, D / 2 - 0.05],
    color: dark
  });
  appendBox(buffers, {
    size: [W - 0.12, 0.03, 0.02],
    position: [0, H - 0.09, D / 2 - 0.01],
    color: accent
  });
  appendBox(buffers, {
    size: [0.42, 0.08, 0.02],
    position: [-0.35, H - 0.16, D / 2 - WALL],
    color: accent
  });

  appendBox(buffers, {
    size: [0.9, 0.04, 0.9],
    position: [0, 0.02, 0],
    color: dark
  });

  return buffers;
}

function pad4(n) {
  return (4 - (n % 4)) % 4;
}

function buildGlb(buffers) {
  const pos = new Float32Array(buffers.positions);
  const nor = new Float32Array(buffers.normals);
  const uv = new Float32Array(buffers.uvs);
  const col = new Float32Array(buffers.colors);
  const maxIndex = Math.max(...buffers.indices);
  const use32 = maxIndex > 65535;
  const idx = use32 ? new Uint32Array(buffers.indices) : new Uint16Array(buffers.indices);

  const chunks = [pos.buffer, nor.buffer, uv.buffer, col.buffer, idx.buffer];
  const offsets = [];
  let cursor = 0;
  const packed = [];
  for (const buf of chunks) {
    const pad = pad4(cursor);
    if (pad) {
      packed.push(new Uint8Array(pad));
      cursor += pad;
    }
    offsets.push(cursor);
    packed.push(new Uint8Array(buf));
    cursor += buf.byteLength;
  }
  const binPad = pad4(cursor);
  if (binPad) {
    packed.push(new Uint8Array(binPad));
    cursor += binPad;
  }
  const bin = new Uint8Array(cursor);
  let o = 0;
  for (const part of packed) {
    bin.set(part, o);
    o += part.byteLength;
  }

  const posLen = pos.byteLength;
  const norLen = nor.byteLength;
  const uvLen = uv.byteLength;
  const colLen = col.byteLength;
  const idxLen = idx.byteLength;
  const vertexCount = pos.length / 3;

  const json = {
    asset: { version: "2.0", generator: "qds-ess-cabinet" },
    scene: 0,
    scenes: [{ name: "ESSCabinet", nodes: [0] }],
    nodes: [
      {
        name: "EnergyStorageCabinet",
        mesh: 0,
        extras: { type: "cabinet-shell" }
      }
    ],
    meshes: [
      {
        name: "CabinetShell",
        primitives: [
          {
            attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2, COLOR_0: 3 },
            indices: 4,
            material: 0
          }
        ]
      }
    ],
    materials: [
      {
        name: "CabinetMetal",
        pbrMetallicRoughness: {
          baseColorFactor: [1, 1, 1, 1],
          metallicFactor: 0.72,
          roughnessFactor: 0.38
        },
        extras: { vertexColor: true }
      }
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: vertexCount,
        type: "VEC3",
        min: min3(pos),
        max: max3(pos)
      },
      { bufferView: 1, componentType: 5126, count: vertexCount, type: "VEC3" },
      { bufferView: 2, componentType: 5126, count: vertexCount, type: "VEC2" },
      { bufferView: 3, componentType: 5126, count: vertexCount, type: "VEC3" },
      {
        bufferView: 4,
        componentType: use32 ? 5125 : 5123,
        count: idx.length,
        type: "SCALAR"
      }
    ],
    bufferViews: [
      { buffer: 0, byteOffset: offsets[0], byteLength: posLen, target: 34962 },
      { buffer: 0, byteOffset: offsets[1], byteLength: norLen, target: 34962 },
      { buffer: 0, byteOffset: offsets[2], byteLength: uvLen, target: 34962 },
      { buffer: 0, byteOffset: offsets[3], byteLength: colLen, target: 34962 },
      { buffer: 0, byteOffset: offsets[4], byteLength: idxLen, target: 34963 }
    ],
    buffers: [{ byteLength: bin.byteLength }]
  };

  const jsonText = JSON.stringify(json);
  const jsonBytesRaw = new TextEncoder().encode(jsonText);
  const jsonPad = pad4(jsonBytesRaw.length);
  const jsonBytes = new Uint8Array(jsonBytesRaw.length + jsonPad);
  jsonBytes.set(jsonBytesRaw);
  jsonBytes.fill(0x20, jsonBytesRaw.length);

  const total = 12 + 8 + jsonBytes.length + 8 + bin.length;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  const binHeader = 20 + jsonBytes.length;
  view.setUint32(binHeader, bin.length, true);
  view.setUint32(binHeader + 4, 0x004e4942, true);
  out.set(bin, binHeader + 8);
  return out;
}

function min3(pos) {
  let x = Infinity;
  let y = Infinity;
  let z = Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    x = Math.min(x, pos[i]);
    y = Math.min(y, pos[i + 1]);
    z = Math.min(z, pos[i + 2]);
  }
  return [x, y, z];
}

function max3(pos) {
  let x = -Infinity;
  let y = -Infinity;
  let z = -Infinity;
  for (let i = 0; i < pos.length; i += 3) {
    x = Math.max(x, pos[i]);
    y = Math.max(y, pos[i + 1]);
    z = Math.max(z, pos[i + 2]);
  }
  return [x, y, z];
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), "../public/models");
mkdirSync(outDir, { recursive: true });
const glb = buildGlb(buildCabinet());
const file = join(outDir, "ess-cabinet.glb");
writeFileSync(file, glb);
console.log(`wrote ${file} (${glb.byteLength} bytes)`);
