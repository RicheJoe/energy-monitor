import { startMqtt, stopMqtt } from './mqtt';
import { startQueue, stopQueue } from './queue';

export async function startIngestion(): Promise<void> {
  await startQueue();
  startMqtt();
}

export async function stopIngestion(): Promise<void> {
  await stopMqtt();
  await stopQueue();
}
