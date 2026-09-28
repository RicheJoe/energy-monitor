import { computed, reactive } from "vue";
import { ackAlarm, fetchAlarms, fetchDevices, fetchPowerCurve } from "@/api.js";
import { CABINETS, STATION, buildCurve } from "@/data/station.js";

const state = reactive({
  now: Date.now(),
  devices: [],
  alarms: [],
  curve: buildCurve().map(point => ({ ...point, charge: 0, discharge: 0 })),
  error: "",
  ready: false
});

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toDevice(row) {
  const match = String(row.id).match(/-(cluster|pcs)-(\d+)$/);
  const layoutId = match ? Number(match[2]) : 0;
  return {
    ...row,
    key: row.id,
    id: layoutId,
    apiId: row.id
  };
}

function toAlarm(row) {
  return {
    ...row,
    time: new Date(row.createdAt).getTime()
  };
}

function toCurve(rows) {
  const curve = buildCurve().map(point => ({ ...point, charge: 0, discharge: 0 }));
  for (const row of rows) {
    const date = new Date(row.bucket);
    const index = date.getHours() * 2 + (date.getMinutes() >= 30 ? 1 : 0);
    const slot = curve[index];
    if (!slot) continue;
    slot.charge = Number(row.charge) || 0;
    slot.discharge = Number(row.discharge) || 0;
  }
  return curve;
}

let refreshing = false;

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    const [devices, alarms, curve] = await Promise.all([
      fetchDevices(),
      fetchAlarms(),
      fetchPowerCurve()
    ]);
    state.devices = devices.map(toDevice);
    state.alarms = alarms.map(toAlarm);
    state.curve = toCurve(curve);
    state.error = "";
    state.ready = true;
  } catch {
    state.error = "无法连接监测服务";
  } finally {
    refreshing = false;
  }
}

export async function acknowledgeAlarm(id) {
  await ackAlarm(id);
  const item = state.alarms.find(alarm => alarm.id === id);
  if (item) item.acknowledged = true;
}

export async function acknowledgeAll() {
  const open = state.alarms.filter(alarm => !alarm.acknowledged);
  await Promise.all(open.map(alarm => ackAlarm(alarm.id)));
  open.forEach(alarm => {
    alarm.acknowledged = true;
  });
}

let stopMonitor = null;

export function startMonitor() {
  if (stopMonitor) return stopMonitor;
  const clock = setInterval(() => {
    state.now = Date.now();
  }, 1000);
  const poll = setInterval(() => {
    void refresh();
  }, 3000);
  void refresh();
  stopMonitor = () => {
    clearInterval(clock);
    clearInterval(poll);
    stopMonitor = null;
  };
  return stopMonitor;
}

export function useMonitor() {
  const cabinets = computed(() =>
    CABINETS.map(meta => {
      const devices = state.devices.filter(item => item.cabinetId === meta.id);
      const clusters = devices.filter(item => item.kind === "cluster");
      const pcs = devices.filter(item => item.kind === "pcs");
      const power = pcs.reduce((sum, item) => sum + (item.online ? item.power || 0 : 0), 0);
      let mode = meta.mode;
      if (devices.length) {
        if (power > 30) mode = "discharge";
        else if (power < -30) mode = "charge";
        else mode = "idle";
      }
      return {
        ...meta,
        online: devices.length ? devices.some(item => item.online) : meta.online,
        mode,
        soc: average(clusters.map(item => item.soc)),
        soh: average(clusters.map(item => item.soh)),
        temp: devices.length ? Math.max(...devices.map(item => item.temp)) : 0,
        power,
        alarmCount: devices.filter(item => item.alarm).length,
        clusterCount: clusters.length,
        pcsCount: pcs.length
      };
    })
  );

  const onlineClusters = computed(() =>
    state.devices.filter(item => item.online && item.kind === "cluster")
  );

  const stationPower = computed(() =>
    cabinets.value.reduce((sum, item) => sum + item.power, 0)
  );

  const stationSoc = computed(() => average(onlineClusters.value.map(item => item.soc)));
  const stationSoh = computed(() => average(onlineClusters.value.map(item => item.soh)));

  const activeAlarms = computed(() => state.alarms.filter(item => !item.acknowledged));

  const nowIndex = computed(() => {
    const date = new Date(state.now);
    return Math.min(47, date.getHours() * 2 + (date.getMinutes() >= 30 ? 1 : 0));
  });

  const todayEnergy = computed(() => {
    const passed = state.curve.slice(0, nowIndex.value + 1);
    const charge = passed.reduce((sum, item) => sum + item.charge, 0) * 0.5;
    const discharge = passed.reduce((sum, item) => sum + item.discharge, 0) * 0.5;
    return { charge, discharge };
  });

  const socBuckets = computed(() => {
    const clusters = onlineClusters.value;
    const count = predicate => clusters.filter(predicate).length;
    return [
      { label: "<20%", count: count(item => item.soc < 20), tone: "low" },
      { label: "20–50%", count: count(item => item.soc >= 20 && item.soc < 50), tone: "mid" },
      { label: "50–80%", count: count(item => item.soc >= 50 && item.soc < 80), tone: "high" },
      { label: "≥80%", count: count(item => item.soc >= 80), tone: "full" }
    ];
  });

  const stationMode = computed(() => {
    if (stationPower.value > 30) return { key: "discharge", label: "放电" };
    if (stationPower.value < -30) return { key: "charge", label: "充电" };
    return { key: "idle", label: "待机" };
  });

  return {
    state,
    station: STATION,
    cabinets,
    stationPower,
    stationSoc,
    stationSoh,
    activeAlarms,
    nowIndex,
    todayEnergy,
    socBuckets,
    stationMode
  };
}
