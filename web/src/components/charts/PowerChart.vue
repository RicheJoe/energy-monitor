<script setup>
import { computed, ref } from "vue";

const props = defineProps({
  points: { type: Array, required: true },
  nowIndex: { type: Number, required: true }
});

const W = 720;
const H = 228;
const pad = { l: 46, r: 16, t: 18, b: 30 };
const hover = ref(null);

const visible = computed(() => props.points.slice(0, Math.max(props.nowIndex + 1, 1)));

const maxY = computed(() => {
  const peak = Math.max(...visible.value.flatMap(item => [item.charge, item.discharge]), 100);
  return Math.ceil(peak / 100) * 100;
});

function xAt(index) {
  const count = Math.max(visible.value.length - 1, 1);
  return pad.l + (index / count) * (W - pad.l - pad.r);
}

function yAt(value) {
  return pad.t + (1 - value / maxY.value) * (H - pad.t - pad.b);
}

function linePath(key) {
  return visible.value
    .map((item, index) => `${index === 0 ? "M" : "L"}${xAt(index).toFixed(1)},${yAt(item[key]).toFixed(1)}`)
    .join(" ");
}

function areaPath(key) {
  if (!visible.value.length) return "";
  const last = visible.value.length - 1;
  const base = yAt(0);
  return `${linePath(key)} L${xAt(last).toFixed(1)},${base.toFixed(1)} L${xAt(0).toFixed(1)},${base.toFixed(1)} Z`;
}

const yTicks = computed(() =>
  [0, 1, 2, 3, 4].map(step => {
    const value = (maxY.value / 4) * step;
    return { value, y: yAt(value) };
  })
);

const xTicks = computed(() =>
  visible.value
    .map((item, index) => ({ ...item, index }))
    .filter(item => item.index % 8 === 0)
);

const tip = computed(() => {
  if (hover.value == null) return null;
  const item = visible.value[hover.value];
  if (!item) return null;
  return {
    ...item,
    left: `${(xAt(hover.value) / W) * 100}%`
  };
});

function onMove(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  const px = ((event.clientX - rect.left) / rect.width) * W;
  const count = Math.max(visible.value.length - 1, 1);
  let index = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * count);
  index = Math.max(0, Math.min(visible.value.length - 1, index));
  hover.value = index;
}
</script>

<template>
  <div class="chart" @mousemove="onMove" @mouseleave="hover = null">
    <svg :viewBox="`0 0 ${W} ${H}`" role="img" aria-label="今日充放电功率曲线">
      <line
        v-for="tick in yTicks"
        :key="tick.value"
        :x1="pad.l"
        :x2="W - pad.r"
        :y1="tick.y"
        :y2="tick.y"
        class="grid"
      />
      <text v-for="tick in yTicks" :key="`y-${tick.value}`" :x="pad.l - 8" :y="tick.y + 4" class="axis">
        {{ tick.value.toFixed(0) }}
      </text>
      <text v-for="tick in xTicks" :key="tick.label" :x="xAt(tick.index)" :y="H - 8" class="axis x">
        {{ tick.label }}
      </text>
      <path :d="areaPath('charge')" class="area charge" />
      <path :d="areaPath('discharge')" class="area discharge" />
      <path :d="linePath('charge')" class="line charge" />
      <path :d="linePath('discharge')" class="line discharge" />
      <line
        v-if="tip"
        :x1="xAt(hover)"
        :x2="xAt(hover)"
        :y1="pad.t"
        :y2="H - pad.b"
        class="cursor"
      />
    </svg>
    <div v-if="tip" class="tip" :style="{ left: tip.left }">
      <strong>{{ tip.label }}</strong>
      <span><i class="swatch charge" />充电 {{ tip.charge.toFixed(0) }} kW</span>
      <span><i class="swatch discharge" />放电 {{ tip.discharge.toFixed(0) }} kW</span>
    </div>
  </div>
</template>

<style scoped>
.chart {
  position: relative;
  height: 260px;
}

svg {
  width: 100%;
  height: 100%;
  display: block;
}

.grid {
  stroke: rgba(90, 196, 210, 0.12);
  stroke-width: 1;
}

.axis {
  fill: #8aa2aa;
  font-size: 11px;
  text-anchor: end;
}

.axis.x {
  text-anchor: middle;
}

.area {
  stroke: none;
}

.area.charge {
  fill: rgba(210, 97, 26, 0.18);
}

.area.discharge {
  fill: rgba(60, 240, 255, 0.14);
}

.line {
  fill: none;
  stroke-width: 2;
}

.line.charge {
  stroke: #e08945;
}

.line.discharge {
  stroke: #3cf0ff;
}

.cursor {
  stroke: rgba(232, 244, 248, 0.35);
  stroke-dasharray: 3 3;
}

.tip {
  position: absolute;
  top: 12px;
  transform: translateX(-50%);
  display: grid;
  gap: 4px;
  min-width: 132px;
  padding: 8px 10px;
  border: 1px solid rgba(90, 196, 210, 0.25);
  border-radius: 10px;
  background: rgba(8, 18, 26, 0.92);
  font-size: 12px;
  pointer-events: none;
}

.tip strong {
  font-size: 13px;
}

.tip span {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #d5e6ec;
}

.swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.swatch.charge {
  background: #e08945;
}

.swatch.discharge {
  background: #3cf0ff;
}
</style>
