import mqtt, { MqttClient } from 'mqtt';
import { publishTelemetry } from './queue';
import { deviceIdFromTopic, TELEMETRY_TOPIC, telemetryMessageSchema } from './telemetryMessage';

let client: MqttClient | null = null;
let ready = false;

export function mqttReady(): boolean {
  return ready;
}

export function startMqtt(): void {
  const url = process.env.MQTT_URL || 'mqtt://localhost:1883';
  const topic = process.env.MQTT_TOPIC || TELEMETRY_TOPIC;
  const next = mqtt.connect(url, {
    clientId: `energy-api-${process.pid}`,
    reconnectPeriod: 2000,
    clean: true,
  });

  next.on('connect', () => {
    next.subscribe(topic, { qos: 1 }, (error) => {
      if (error) {
        ready = false;
        console.error('MQTT subscribe failed', error);
        return;
      }
      ready = true;
      console.log(`MQTT subscribed ${topic}`);
    });
  });

  next.on('close', () => {
    ready = false;
  });

  next.on('error', (error) => {
    console.error('MQTT client error', error.message);
  });

  next.on('message', (receivedTopic, payload) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload.toString());
    } catch {
      console.error('MQTT payload is not JSON', receivedTopic);
      return;
    }

    const result = telemetryMessageSchema.safeParse(parsed);
    if (!result.success) {
      console.error('MQTT payload rejected', result.error.issues[0]?.message);
      return;
    }

    const topicDeviceId = deviceIdFromTopic(receivedTopic);
    if (topicDeviceId && topicDeviceId !== result.data.deviceId) {
      console.error(`MQTT deviceId mismatch topic=${topicDeviceId} body=${result.data.deviceId}`);
      return;
    }

    void publishTelemetry(result.data).catch((error) => {
      console.error('Failed to enqueue telemetry', error);
    });
  });

  client = next;
}

export async function stopMqtt(): Promise<void> {
  ready = false;
  const current = client;
  client = null;
  if (!current) return;
  await current.endAsync();
}
