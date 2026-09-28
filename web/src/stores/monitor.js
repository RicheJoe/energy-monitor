import { computed, reactive } from "vue";
import {
  CABINETS,
  STATION,
  buildAlarms,
  buildCurve,
  buildDevices
} from "@/data/station.js";

const startedAt = Date.now();
const devices = buildDevices();

const state = reactive({
  now: startedAt,
  devices,
  alarms: buildAlarms(devices, startedAt),
  curve: buildCurve()
});

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function acknowledgeAlarm(id) {
  const item = state.alarms.find(alarm => alarm.id === id);
  if (item) item.acknowledged = true;
}

export function acknowledgeAll() {
  state.alarms.forEach(alarm => {
    alarm.acknowledged = true;
  });
}

function tick(dt) {
  state.devices.forEach((item, index) => {
    if (!item.online) return;
    if (item.baseCurrent == null) item.baseCurrent = item.current;
    if (item.baseTemp == null) item.baseTemp = item.temp;
    if (item.basePower == null) item.basePower = item.power;
    item.current = Number(
      Math.max(2, item.baseCurrent + Math.sin(dt * 0.8 + index * 0.4) * 1.2).toFixed(1)
    );
    item.temp = Number(
      Math.min(item.alarm ? 55 : 42, Math.max(22, item.baseTemp + Math.sin(dt * 0.25 + index) * 0.3)).toFixed(1)
    );
    if (item.kind === "pcs" && item.basePower) {
      const sign = Math.sign(item.basePower);
      const magnitude = Math.abs(item.basePower) + Math.sin(dt * 0.5 + index) * 4;
      item.power = Number((sign * Math.max(10, magnitude)).toFixed(1));
    }
  });
}

let stopMonitor = null;

export function startMonitor() {
  if (stopMonitor) return stopMonitor;
  const clock = setInterval(() => {
    state.now = Date.now();
  }, 1000);
  const telem = setInterval(() => {
    tick((Date.now() - startedAt) / 1000);
  }, 1000);
  stopMonitor = () => {
    clearInterval(clock);
    clearInterval(telem);
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
      return {
        ...meta,
        soc: average(clusters.map(item => item.soc)),
        soh: average(clusters.map(item => item.soh)),
        temp: devices.length ? Math.max(...devices.map(item => item.temp)) : 0,
        power: pcs.reduce((sum, item) => sum + (item.online ? item.power || 0 : 0), 0),
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
