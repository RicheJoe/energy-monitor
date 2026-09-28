/** 储能柜与设备节点的统一尺寸，柜体 glTF 与运行时 InstancedMesh 共用。 */

export const CABINET = {
  width: 2.62,
  height: 2.28,
  depth: 1.02,
  wall: 0.045,
  baseH: 0.1,
  dividerX: 0.72
};

export const CLUSTER = {
  cols: 4,
  rows: 5,
  size: [0.34, 0.26, 0.64],
  gapX: 0.055,
  gapY: 0.05
};

export const PCS = {
  count: 2,
  size: [0.46, 0.72, 0.68],
  gapY: 0.1
};

export function getClusterLayout() {
  const [cw, ch, cd] = CLUSTER.size;
  const bayLeft = -CABINET.width / 2 + CABINET.wall + 0.12;
  const bayRight = CABINET.dividerX - 0.08;
  const usableW = bayRight - bayLeft;
  const totalW = CLUSTER.cols * cw + (CLUSTER.cols - 1) * CLUSTER.gapX;
  const originX = bayLeft + (usableW - totalW) / 2 + cw / 2;
  const originY = CABINET.baseH + 0.16 + ch / 2;
  const z = 0.02;
  const items = [];
  let id = 0;
  for (let row = 0; row < CLUSTER.rows; row++) {
    for (let col = 0; col < CLUSTER.cols; col++) {
      items.push({
        id,
        kind: "cluster",
        name: `电池簇 ${String(id + 1).padStart(2, "0")}`,
        x: originX + col * (cw + CLUSTER.gapX),
        y: originY + row * (ch + CLUSTER.gapY),
        z,
        w: cw,
        h: ch,
        d: cd
      });
      id += 1;
    }
  }
  return items;
}

export function getPcsLayout() {
  const [pw, ph, pd] = PCS.size;
  const bayLeft = CABINET.dividerX + 0.08;
  const bayRight = CABINET.width / 2 - CABINET.wall - 0.08;
  const x = (bayLeft + bayRight) / 2;
  const originY = CABINET.baseH + 0.18 + ph / 2;
  const items = [];
  for (let i = 0; i < PCS.count; i++) {
    items.push({
      id: i,
      kind: "pcs",
      name: `PCS-${i + 1}`,
      x,
      y: originY + i * (ph + PCS.gapY),
      z: 0,
      w: pw,
      h: ph,
      d: pd
    });
  }
  return items;
}
