async function request(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) {
    throw new Error(`${response.status} ${path}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function fetchDevices() {
  return request("/api/devices");
}

export function fetchAlarms() {
  return request("/api/alarms?limit=500");
}

export function fetchPowerCurve() {
  return request("/api/station/curve");
}

export function ackAlarm(id) {
  return request(`/api/alarms/${encodeURIComponent(id)}/ack`, { method: "PATCH" });
}
