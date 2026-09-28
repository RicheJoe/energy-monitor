const mqtt = require('mqtt');

const url = process.env.MQTT_URL || 'mqtt://localhost:1883';
const intervalMs = Number(process.env.SIM_INTERVAL_MS) || 5000;
const batchSize = Number(process.env.SIM_BATCH_SIZE) || 4;

const CABINETS = [
  { id: 'C01', mode: 'discharge', online: true, alarms: new Set([3, 11, 16]) },
  { id: 'C02', mode: 'charge', online: true, alarms: new Set([7]) },
  { id: 'C03', mode: 'discharge', online: true, alarms: new Set([1, 14]) },
  { id: 'C04', mode: 'idle', online: false, alarms: new Set() },
];

const ALARM_TEXT = {
  1: '单体过压',
  3: 'SOC 过低',
  7: '绝缘告警',
  11: '过温告警',
  14: '压差过大',
  16: 'SOC 过低',
};

function sign(mode) {
  if (mode === 'charge') return -1;
  if (mode === 'discharge') return 1;
  return 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round1(value) {
  return Number(value.toFixed(1));
}

const devices = [];
for (const cabinet of CABINETS) {
  const direction = sign(cabinet.mode);
  for (let i = 0; i < 20; i += 1) {
    const alarm = cabinet.alarms.has(i);
    devices.push({
      id: `${cabinet.id}-cluster-${i}`,
      online: cabinet.online,
      alarm,
      alarmText: cabinet.online ? (alarm ? ALARM_TEXT[i] || 'SOC 过低' : '正常') : '通讯中断',
      soc: alarm ? 22 : 78,
      soh: alarm ? 86 : 96,
      voltage: 730,
      current: cabinet.online ? 24 : 0,
      temp: alarm ? 43 : 29,
      power: cabinet.online ? round1(16 * direction) : 0,
    });
  }
  for (let i = 0; i < 2; i += 1) {
    devices.push({
      id: `${cabinet.id}-pcs-${i}`,
      online: cabinet.online,
      alarm: false,
      alarmText: cabinet.online ? '正常' : '通讯中断',
      soc: 70,
      soh: 95,
      voltage: 700,
      current: cabinet.online ? 90 : 0,
      temp: 34,
      power: cabinet.online ? round1(140 * direction) : 0,
    });
  }
}

let cursor = 0;

function step(device) {
  if (!device.online) {
    return {
      deviceId: device.id,
      soc: device.soc,
      soh: device.soh,
      voltage: device.voltage,
      current: 0,
      temp: device.temp,
      power: 0,
      online: false,
      alarm: false,
      alarmText: '通讯中断',
    };
  }

  device.soc = round1(clamp(device.soc + (Math.random() - 0.5) * 0.6, device.alarm ? 12 : 40, device.alarm ? 38 : 99));
  device.current = round1(clamp(device.current + (Math.random() - 0.5) * 1.2, 2, 160));
  device.temp = round1(clamp(device.temp + (Math.random() - 0.5) * 0.3, 20, device.alarm ? 55 : 40));
  const direction = device.power < 0 ? -1 : device.power > 0 ? 1 : 0;
  device.power = round1(Math.abs(device.power) + (Math.random() - 0.5) * 0.8) * direction;

  return {
    deviceId: device.id,
    soc: device.soc,
    soh: device.soh,
    voltage: device.voltage,
    current: device.current,
    temp: device.temp,
    power: round1(device.power),
    online: true,
    alarm: device.alarm,
    alarmText: device.alarmText,
  };
}

function publishBatch(client) {
  const count = Math.min(batchSize, devices.length);
  for (let i = 0; i < count; i += 1) {
    const device = devices[(cursor + i) % devices.length];
    const payload = step(device);
    client.publish(`energy/v1/devices/${device.id}/telemetry`, JSON.stringify(payload), { qos: 1 });
  }
  cursor = (cursor + count) % devices.length;
  console.log(`Published ${count} telemetry messages`);
}

const client = mqtt.connect(url, {
  clientId: `energy-simulator-${process.pid}`,
  reconnectPeriod: 2000,
  clean: true,
});

client.on('connect', () => {
  console.log(`Simulator connected ${url}`);
  publishBatch(client);
});

client.on('error', (error) => {
  console.error('Simulator MQTT error', error.message);
});

const timer = setInterval(() => {
  if (client.connected) publishBatch(client);
}, intervalMs);

function shutdown() {
  clearInterval(timer);
  client.end(false, () => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
