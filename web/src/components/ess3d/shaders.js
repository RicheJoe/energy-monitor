export const clusterVertexShader = /* glsl */ `
attribute float aAlarm;
attribute float aSoc;
attribute float aSelected;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;
varying float vAlarm;
varying float vSoc;
varying float vSelected;

void main() {
  vUv = uv;
  vAlarm = aAlarm;
  vSoc = aSoc;
  vSelected = aSelected;

  vec3 objectNormal = vec3(normal);
  vec4 mvPosition = vec4(position, 1.0);

  #ifdef USE_INSTANCING
    mat3 m = mat3(instanceMatrix);
    vec3 ns = vec3(dot(m[0], m[0]), dot(m[1], m[1]), dot(m[2], m[2]));
    objectNormal = normalize(m * (objectNormal / ns));
    mvPosition = instanceMatrix * mvPosition;
  #endif

  vec4 viewPos = modelViewMatrix * mvPosition;
  vViewPosition = -viewPos.xyz;
  vNormal = normalize(normalMatrix * objectNormal);
  gl_Position = projectionMatrix * viewPos;
}
`;

export const clusterFragmentShader = /* glsl */ `
uniform float uTime;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;
varying float vAlarm;
varying float vSoc;
varying float vSelected;

void main() {
  float soc01 = clamp(vSoc / 100.0, 0.0, 1.0);
  vec3 lowCol = vec3(0.82, 0.38, 0.1);
  vec3 highCol = vec3(0.12, 0.7, 0.58);
  vec3 base = mix(lowCol, highCol, soc01);

  float pulse = 0.45 + 0.55 * abs(sin(uTime * 5.5));
  vec3 alarmCol = vec3(1.0, 0.08, 0.07);
  vec3 color = mix(base, alarmCol, vAlarm * pulse);

  color = mix(color, vec3(1.0, 0.9, 0.28), vSelected * 0.42);

  vec3 n = normalize(vNormal);
  vec3 l = normalize(vec3(0.35, 0.8, 0.45));
  float diff = max(dot(n, l), 0.0);
  float rim = pow(1.0 - max(dot(n, normalize(vViewPosition)), 0.0), 2.2);
  float edge = smoothstep(0.02, 0.08, min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y)));
  vec3 lit = color * (0.28 + 0.72 * diff) + vec3(0.35, 0.55, 0.7) * rim * 0.22;
  lit *= mix(0.55, 1.0, edge);

  float glow = vAlarm * pulse * 0.55;
  gl_FragColor = vec4(lit + alarmCol * glow, 1.0);
}
`;

export const flowVertexShader = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  vUv = uv;
  vec3 objectNormal = vec3(normal);
  vec4 mvPosition = vec4(position, 1.0);

  #ifdef USE_INSTANCING
    mat3 m = mat3(instanceMatrix);
    vec3 ns = vec3(dot(m[0], m[0]), dot(m[1], m[1]), dot(m[2], m[2]));
    objectNormal = normalize(m * (objectNormal / ns));
    mvPosition = instanceMatrix * mvPosition;
  #endif

  vec4 viewPos = modelViewMatrix * mvPosition;
  vViewPosition = -viewPos.xyz;
  vNormal = normalize(normalMatrix * objectNormal);
  gl_Position = projectionMatrix * viewPos;
}
`;

export const flowFragmentShader = /* glsl */ `
uniform float uTime;
uniform vec3 uBaseColor;
uniform vec3 uFlowColor;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;

void main() {
  float t = fract(vUv.x * 3.4 - uTime * 0.85);
  float band = smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.22, 0.4, t));
  float tail = pow(1.0 - abs(vUv.y - 0.5) * 2.0, 1.4);
  vec3 color = mix(uBaseColor, uFlowColor, band * (0.55 + 0.45 * tail));

  vec3 n = normalize(vNormal);
  float diff = 0.35 + 0.65 * max(dot(n, normalize(vec3(0.2, 0.9, 0.35))), 0.0);
  float glow = band * 0.65;
  gl_FragColor = vec4(color * diff + uFlowColor * glow, 1.0);
}
`;
