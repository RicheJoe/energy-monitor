function rand(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const ALARM_PRESETS = [
  [3, 11, 16],
  [7],
  [1, 14],
  []
];

const ALARM_TEXT = {
  1: "单体过压",
  3: "SOC 过低",
  7: "绝缘告警",
  11: "过温告警",
  14: "压差过大",
  16: "SOC 过低"
};

export function createDeviceData(clusters, pcsList, seed = 0) {
  const alarmIds = new Set(ALARM_PRESETS[Math.abs(seed) % ALARM_PRESETS.length]);
  const clustersData = clusters.map((item, i) => {
    const alarm = alarmIds.has(i);
    const shift = seed * 17;
    const soc = alarm ? 18 + rand(i + 2 + shift) * 16 : 55 + rand(i + 1 + shift) * 40;
    const soh = alarm ? 78 + rand(i + 5 + shift) * 8 : 90 + rand(i + 3 + shift) * 9;
    return {
      ...item,
      soc: Number(soc.toFixed(1)),
      soh: Number(soh.toFixed(1)),
      voltage: Number((720 + rand(i + 9 + shift) * 40).toFixed(1)),
      current: Number((alarm ? 8 + rand(i + shift) * 6 : 20 + rand(i + 4 + shift) * 25).toFixed(1)),
      temp: Number((alarm ? 41 + rand(i + 7 + shift) * 8 : 26 + rand(i + 8 + shift) * 8).toFixed(1)),
      alarm,
      alarmText: alarm ? ALARM_TEXT[i] || "SOC 过低" : "正常"
    };
  });

  const pcsData = pcsList.map((item, i) => ({
    ...item,
    soc: Number((62 + rand(i + 21 + seed * 3) * 20).toFixed(1)),
    soh: Number((93 + rand(i + 22 + seed * 3) * 5).toFixed(1)),
    voltage: Number((690 + rand(i + 23 + seed * 3) * 20).toFixed(1)),
    current: Number((80 + rand(i + 24 + seed * 3) * 40).toFixed(1)),
    temp: Number((32 + rand(i + 25 + seed * 3) * 6).toFixed(1)),
    power: Number((120 + rand(i + 26 + seed * 3) * 40).toFixed(1)),
    alarm: false,
    alarmText: "正常"
  }));

  return { clusters: clustersData, pcs: pcsData };
}

export function tickDeviceData(data, dt) {
  data.clusters.forEach((item, i) => {
    if (item.baseSoc == null) item.baseSoc = item.soc;
    if (item.baseCurrent == null) item.baseCurrent = item.current;
    const soc = item.baseSoc + Math.sin(dt * 0.35 + i) * 0.6;
    item.soc = Number(Math.min(item.alarm ? 38 : 99, Math.max(item.alarm ? 12 : 40, soc)).toFixed(1));
    item.current = Number(Math.max(2, item.baseCurrent + Math.sin(dt * 0.8 + i * 0.4) * 1.5).toFixed(1));
  });
}
