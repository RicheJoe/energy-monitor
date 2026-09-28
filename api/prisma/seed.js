const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CABINETS = [
  { id: 'C01', name: '1# 储能柜', mode: 'discharge', online: true, seed: 0 },
  { id: 'C02', name: '2# 储能柜', mode: 'charge', online: true, seed: 1 },
  { id: 'C03', name: '3# 储能柜', mode: 'discharge', online: true, seed: 2 },
  { id: 'C04', name: '4# 储能柜', mode: 'idle', online: false, seed: 3 },
];

const CLUSTER_COUNT = 20;
const PCS_COUNT = 2;
const HISTORY_POINTS = 12;
const HISTORY_STEP_MINUTES = 10;

const ALARM_PRESETS = [[3, 11, 16], [7], [1, 14], []];
const ALARM_TEXT = {
  1: '单体过压',
  3: 'SOC 过低',
  7: '绝缘告警',
  11: '过温告警',
  14: '压差过大',
  16: 'SOC 过低',
};

function rand(seed) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function round1(value) {
  return Number(value.toFixed(1));
}

function powerSign(mode) {
  if (mode === 'charge') return -1;
  if (mode === 'discharge') return 1;
  return 0;
}

function alarmLevel(text) {
  if (text.includes('过温') || text.includes('绝缘') || text.includes('通讯')) return 'critical';
  return 'warning';
}

function buildDevices() {
  const devices = [];

  for (const cabinet of CABINETS) {
    const alarmIds = new Set(ALARM_PRESETS[Math.abs(cabinet.seed) % ALARM_PRESETS.length]);
    const shift = cabinet.seed * 17;
    const sign = powerSign(cabinet.mode);

    for (let i = 0; i < CLUSTER_COUNT; i += 1) {
      const alarm = alarmIds.has(i);
      const soc = alarm ? 18 + rand(i + 2 + shift) * 16 : 55 + rand(i + 1 + shift) * 40;
      const soh = alarm ? 78 + rand(i + 5 + shift) * 8 : 90 + rand(i + 3 + shift) * 9;
      const voltage = 720 + rand(i + 9 + shift) * 40;
      const current = alarm ? 8 + rand(i + shift) * 6 : 20 + rand(i + 4 + shift) * 25;
      const temp = alarm ? 41 + rand(i + 7 + shift) * 8 : 26 + rand(i + 8 + shift) * 8;
      const livePower = round1(Math.abs((voltage * current) / 1000) * sign);
      devices.push({
        id: `${cabinet.id}-cluster-${i}`,
        cabinetId: cabinet.id,
        cabinetName: cabinet.name,
        kind: 'cluster',
        name: `电池簇 ${String(i + 1).padStart(2, '0')}`,
        online: cabinet.online,
        soc: round1(soc),
        soh: round1(soh),
        voltage: round1(voltage),
        current: cabinet.online ? round1(current) : 0,
        temp: round1(temp),
        power: cabinet.online ? livePower : 0,
        alarm: cabinet.online ? alarm : false,
        alarmText: cabinet.online ? (alarm ? ALARM_TEXT[i] || 'SOC 过低' : '正常') : '通讯中断',
        historyCurrent: round1(current),
        historyPower: livePower,
      });
    }

    for (let i = 0; i < PCS_COUNT; i += 1) {
      const voltage = 690 + rand(i + 23 + cabinet.seed * 3) * 20;
      const current = 80 + rand(i + 24 + cabinet.seed * 3) * 40;
      const magnitude = 120 + rand(i + 26 + cabinet.seed * 3) * 40;
      const livePower = round1(Math.abs(magnitude) * sign);
      devices.push({
        id: `${cabinet.id}-pcs-${i}`,
        cabinetId: cabinet.id,
        cabinetName: cabinet.name,
        kind: 'pcs',
        name: `PCS-${i + 1}`,
        online: cabinet.online,
        soc: round1(62 + rand(i + 21 + cabinet.seed * 3) * 20),
        soh: round1(93 + rand(i + 22 + cabinet.seed * 3) * 5),
        voltage: round1(voltage),
        current: cabinet.online ? round1(current) : 0,
        temp: round1(32 + rand(i + 25 + cabinet.seed * 3) * 6),
        power: cabinet.online ? livePower : 0,
        alarm: false,
        alarmText: cabinet.online ? '正常' : '通讯中断',
        historyCurrent: round1(current),
        historyPower: livePower,
      });
    }
  }

  return devices;
}

function buildTelemetry(devices, now) {
  const points = [];
  for (const device of devices) {
    const offline = !device.online;
    for (let i = 0; i < HISTORY_POINTS; i += 1) {
      const minutesAgo = (offline ? 46 : 0) + i * HISTORY_STEP_MINUTES;
      const wobble = Math.sin(i / 2) * 0.6;
      const latest = i === 0;
      points.push({
        deviceId: device.id,
        soc: round1(Math.min(100, Math.max(0, device.soc + (latest ? 0 : wobble)))),
        soh: device.soh,
        voltage: round1(Math.max(0, device.voltage + (latest ? 0 : wobble))),
        current: latest ? device.historyCurrent : round1(Math.max(0, device.historyCurrent + wobble)),
        temp: round1(device.temp + (latest ? 0 : wobble * 0.4)),
        power: latest ? device.historyPower : round1(device.historyPower + wobble),
        createdAt: new Date(now - minutesAgo * 60 * 1000),
      });
    }
  }
  return points;
}

function buildAlarms(devices, now) {
  const active = devices
    .filter((item) => item.alarm)
    .map((item, index) => ({
      id: `dev-${item.id}`,
      deviceId: item.id,
      level: alarmLevel(item.alarmText),
      cabinetId: item.cabinetId,
      cabinetName: item.cabinetName,
      deviceName: item.name,
      message: item.alarmText,
      acknowledged: false,
      createdAt: new Date(now - (6 + index * 14) * 60 * 1000),
    }));

  return [
    ...active,
    {
      id: 'cab-c04-offline',
      deviceId: null,
      level: 'critical',
      cabinetId: 'C04',
      cabinetName: '4# 储能柜',
      deviceName: '柜体通讯',
      message: '通讯中断',
      acknowledged: false,
      createdAt: new Date(now - 46 * 60 * 1000),
    },
    {
      id: 'hist-strategy',
      deviceId: null,
      level: 'info',
      cabinetId: 'C01',
      cabinetName: '1# 储能柜',
      deviceName: '能量管理系统',
      message: '运行策略切换为峰谷套利',
      acknowledged: true,
      createdAt: new Date(now - 5 * 60 * 60 * 1000),
    },
    {
      id: 'hist-fan',
      deviceId: 'C02-pcs-1',
      level: 'warning',
      cabinetId: 'C02',
      cabinetName: '2# 储能柜',
      deviceName: 'PCS-2',
      message: '散热风机转速偏低，已恢复',
      acknowledged: true,
      createdAt: new Date(now - 26 * 60 * 60 * 1000),
    },
  ];
}

function toDeviceRow(device) {
  const { historyCurrent, historyPower, ...row } = device;
  return row;
}

async function main() {
  const now = Date.now();
  const devices = buildDevices();
  const deviceIds = devices.map((item) => item.id);
  const alarms = buildAlarms(devices, now);
  const telemetry = buildTelemetry(devices, now);

  await prisma.telemetry.deleteMany({ where: { deviceId: { in: deviceIds } } });
  await prisma.alarm.deleteMany({
    where: {
      OR: [{ id: { in: alarms.map((item) => item.id) } }, { deviceId: { in: deviceIds } }],
    },
  });

  for (const device of devices) {
    const row = toDeviceRow(device);
    await prisma.device.upsert({
      where: { id: row.id },
      create: row,
      update: row,
    });
  }

  const batchSize = 500;
  for (let i = 0; i < telemetry.length; i += batchSize) {
    await prisma.telemetry.createMany({ data: telemetry.slice(i, i + batchSize) });
  }
  await prisma.alarm.createMany({ data: alarms });

  const [deviceCount, telemetryCount, alarmCount] = await Promise.all([
    prisma.device.count(),
    prisma.telemetry.count(),
    prisma.alarm.count(),
  ]);
  console.log(`Seeded devices=${deviceCount} telemetry=${telemetryCount} alarms=${alarmCount}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
