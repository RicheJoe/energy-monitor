import { getClusterLayout, getPcsLayout } from "@/components/ess3d/layout.js";
import { createDeviceData } from "@/components/ess3d/telemetry.js";

export const STATION = {
  name: "城东储能电站",
  code: "ESS-CD-01",
  location: "城东工业园 3 号站",
  ratedPower: 1200,
  ratedEnergy: 2500
};

export const CABINETS = [
  { id: "C01", name: "1# 储能柜", mode: "discharge", online: true, seed: 0 },
  { id: "C02", name: "2# 储能柜", mode: "charge", online: true, seed: 1 },
  { id: "C03", name: "3# 储能柜", mode: "discharge", online: true, seed: 2 },
  { id: "C04", name: "4# 储能柜", mode: "idle", online: false, seed: 3 }
];

export const LEVEL_LABEL = {
  critical: "严重",
  warning: "一般",
  info: "提示"
};

function powerSign(mode) {
  if (mode === "charge") return -1;
  if (mode === "discharge") return 1;
  return 0;
}

function alarmLevel(text) {
  if (text.includes("过温") || text.includes("绝缘") || text.includes("通讯")) return "critical";
  return "warning";
}

export function buildDevices() {
  const clusters = getClusterLayout();
  const pcsList = getPcsLayout();
  const devices = [];

  CABINETS.forEach(meta => {
    const data = createDeviceData(clusters, pcsList, meta.seed);
    const sign = powerSign(meta.mode);
    [...data.clusters, ...data.pcs].forEach(item => {
      const signedPower =
        item.power == null ? null : Number((Math.abs(item.power) * sign).toFixed(1));
      devices.push({
        ...item,
        key: `${meta.id}-${item.kind}-${item.id}`,
        cabinetId: meta.id,
        cabinetName: meta.name,
        online: meta.online,
        power: meta.online ? signedPower : 0,
        current: meta.online ? item.current : 0,
        alarm: meta.online ? item.alarm : false,
        alarmText: meta.online ? item.alarmText : "通讯中断"
      });
    });
  });

  return devices;
}

export function buildAlarms(devices, now = Date.now()) {
  const active = devices
    .filter(item => item.alarm)
    .map((item, index) => ({
      id: `dev-${item.key}`,
      level: alarmLevel(item.alarmText),
      cabinetId: item.cabinetId,
      cabinetName: item.cabinetName,
      deviceName: item.name,
      message: item.alarmText,
      time: now - (6 + index * 14) * 60 * 1000,
      acknowledged: false
    }));

  const extra = [
    {
      id: "cab-c04-offline",
      level: "critical",
      cabinetId: "C04",
      cabinetName: "4# 储能柜",
      deviceName: "柜体通讯",
      message: "通讯中断",
      time: now - 46 * 60 * 1000,
      acknowledged: false
    },
    {
      id: "hist-strategy",
      level: "info",
      cabinetId: "C01",
      cabinetName: "1# 储能柜",
      deviceName: "能量管理系统",
      message: "运行策略切换为峰谷套利",
      time: now - 5 * 60 * 60 * 1000,
      acknowledged: true
    },
    {
      id: "hist-fan",
      level: "warning",
      cabinetId: "C02",
      cabinetName: "2# 储能柜",
      deviceName: "PCS-2",
      message: "散热风机转速偏低，已恢复",
      time: now - 26 * 60 * 60 * 1000,
      acknowledged: true
    }
  ];

  return [...active, ...extra].sort((a, b) => b.time - a.time);
}

function profile(hour) {
  const wobble = (h, amp) => amp * Math.sin(h * 1.7);
  if (hour < 6) return { charge: 240 + wobble(hour, 28), discharge: 0 };
  if (hour < 8) return { charge: 90, discharge: 20 };
  if (hour < 10) return { charge: 30, discharge: 40 };
  if (hour < 15) return { charge: 0, discharge: 340 + wobble(hour, 36) };
  if (hour < 18) return { charge: 40, discharge: 70 };
  if (hour < 21) return { charge: 0, discharge: 460 + wobble(hour, 30) };
  if (hour < 23) return { charge: 110, discharge: 20 };
  return { charge: 220, discharge: 0 };
}

export function buildCurve() {
  return Array.from({ length: 48 }, (_, index) => {
    const hour = index / 2;
    const point = profile(hour);
    const hh = String(Math.floor(hour)).padStart(2, "0");
    const mm = index % 2 ? "30" : "00";
    return {
      index,
      label: `${hh}:${mm}`,
      charge: Number(point.charge.toFixed(1)),
      discharge: Number(point.discharge.toFixed(1))
    };
  });
}

export function runMode(cabinet) {
  if (!cabinet.online) return { key: "offline", label: "离线" };
  if (cabinet.mode === "charge") return { key: "charge", label: "充电" };
  if (cabinet.mode === "discharge") return { key: "discharge", label: "放电" };
  return { key: "idle", label: "待机" };
}

export function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatClock(ts) {
  const date = new Date(ts);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function relativeTime(ts, now) {
  const minutes = Math.max(0, Math.round((now - ts) / 60000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

export function formatNumber(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return "—";
  return Number(value).toFixed(digits);
}
