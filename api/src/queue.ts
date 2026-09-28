import amqp, { Channel, ChannelModel, ConfirmChannel, ConsumeMessage, RecoveringChannelModel } from 'amqplib';
import { isUnknownDevice, persistTelemetry } from './ingest';
import { TelemetryMessage, telemetryMessageSchema } from './telemetryMessage';

const EXCHANGE = 'energy.telemetry';
const DLX = 'energy.telemetry.dlx';
const QUEUE = 'energy.telemetry.persist';
const DLQ = 'energy.telemetry.persist.dlq';
const ROUTING_KEY = 'persist';
const MAX_RETRIES = 3;

let connection: RecoveringChannelModel | null = null;
let publishChannel: ConfirmChannel | null = null;
let ready = false;

export function rabbitReady(): boolean {
  return ready;
}

async function assertTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(EXCHANGE, 'direct', { durable: true });
  await channel.assertExchange(DLX, 'direct', { durable: true });
  await channel.assertQueue(DLQ, { durable: true });
  await channel.bindQueue(DLQ, DLX, ROUTING_KEY);
  await channel.assertQueue(QUEUE, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': DLX,
      'x-dead-letter-routing-key': ROUTING_KEY,
    },
  });
  await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEY);
}

async function handleMessage(channel: Channel, message: ConsumeMessage): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(message.content.toString());
  } catch {
    channel.nack(message, false, false);
    return;
  }

  const result = telemetryMessageSchema.safeParse(parsed);
  if (!result.success) {
    channel.nack(message, false, false);
    return;
  }

  try {
    await persistTelemetry(result.data);
    channel.ack(message);
  } catch (error) {
    if (isUnknownDevice(error)) {
      console.error(error instanceof Error ? error.message : error);
      channel.nack(message, false, false);
      return;
    }

    const retries = Number(message.properties.headers?.['x-retry'] ?? 0);
    if (!Number.isInteger(retries) || retries >= MAX_RETRIES) {
      console.error('Telemetry dropped after retries', error);
      channel.nack(message, false, false);
      return;
    }

    channel.publish(EXCHANGE, ROUTING_KEY, message.content, {
      persistent: true,
      contentType: 'application/json',
      headers: { 'x-retry': retries + 1 },
    });
    channel.ack(message);
    console.error('Telemetry persist failed, retry scheduled', error);
  }
}

export function publishTelemetry(message: TelemetryMessage): Promise<void> {
  const channel = publishChannel;
  if (!channel) return Promise.reject(new Error('RabbitMQ is not connected'));

  const body = Buffer.from(JSON.stringify(message));
  return new Promise((resolve, reject) => {
    channel.publish(
      EXCHANGE,
      ROUTING_KEY,
      body,
      { persistent: true, contentType: 'application/json' },
      (error) => {
        if (error) reject(error);
        else resolve();
      }
    );
  });
}

export async function startQueue(): Promise<void> {
  const url = process.env.RABBITMQ_URL || 'amqp://energy:energy@localhost:5672';
  const recovering = await amqp.connect(url, {
    recovery: {
      waitForConnect: false,
      initialDelay: 500,
      maxDelay: 10000,
      async setup(model: ChannelModel) {
        const publisher = await model.createConfirmChannel();
        await assertTopology(publisher);
        publishChannel = publisher;

        const consumer = await model.createChannel();
        await consumer.prefetch(32);
        await consumer.consume(QUEUE, (message: ConsumeMessage | null) => {
          if (!message) return;
          void handleMessage(consumer, message).catch((error) => {
            console.error('Telemetry consumer failed', error);
          });
        });
        ready = true;
        console.log('RabbitMQ consumer ready');
      },
    },
  });

  recovering.on('disconnect', () => {
    ready = false;
    publishChannel = null;
  });
  recovering.on('connect-failed', (error) => {
    ready = false;
    console.error('RabbitMQ connect failed', error.message);
  });
  connection = recovering;
}

export async function stopQueue(): Promise<void> {
  ready = false;
  publishChannel = null;
  if (!connection) return;
  const current = connection;
  connection = null;
  await current.close();
}
