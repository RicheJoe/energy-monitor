<script setup>
import { computed } from "vue";
import { formatNumber } from "@/data/station.js";

const props = defineProps({
  device: { type: Object, required: true },
  cabinetName: { type: String, default: "" },
  showClose: { type: Boolean, default: false }
});

defineEmits(["close"]);

const kindLabel = computed(() => (props.device.kind === "cluster" ? "电池簇" : "PCS"));
const offline = computed(() => props.device.online === false);
</script>

<template>
  <article class="device-card">
    <div class="detail-head">
      <div>
        <p class="kind">{{ cabinetName ? `${cabinetName} · ` : "" }}{{ kindLabel }}</p>
        <h2>{{ device.name }}</h2>
      </div>
      <button v-if="showClose" type="button" class="close" @click="$emit('close')">关闭</button>
    </div>

    <div class="badge" :class="{ danger: device.alarm, off: offline }">
      {{ offline ? "通讯中断" : device.alarmText }}
    </div>

    <div class="metric">
      <div class="metric-row">
        <span>SOC</span>
        <strong class="num">{{ formatNumber(device.soc) }}%</strong>
      </div>
      <div class="bar">
        <i :style="{ width: `${Math.min(device.soc, 100)}%` }" />
      </div>
    </div>
    <div class="metric">
      <div class="metric-row">
        <span>SOH</span>
        <strong class="num">{{ formatNumber(device.soh) }}%</strong>
      </div>
      <div class="bar soh">
        <i :style="{ width: `${Math.min(device.soh, 100)}%` }" />
      </div>
    </div>

    <dl class="kv">
      <div>
        <dt>电压</dt>
        <dd class="num">{{ formatNumber(device.voltage) }} V</dd>
      </div>
      <div>
        <dt>电流</dt>
        <dd class="num">{{ formatNumber(device.current) }} A</dd>
      </div>
      <div>
        <dt>温度</dt>
        <dd class="num">{{ formatNumber(device.temp) }} ℃</dd>
      </div>
      <div>
        <dt>功率</dt>
        <dd class="num">{{ device.power == null ? "—" : `${formatNumber(device.power)} kW` }}</dd>
      </div>
    </dl>
  </article>
</template>

<style scoped>
.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.kind {
  margin: 0;
  font-size: 12px;
  color: #7fd8d0;
}

h2 {
  margin: 4px 0 0;
  font-size: 18px;
}

.close {
  border: 0;
  background: transparent;
  color: #9cb4bc;
}

.badge {
  display: inline-block;
  margin: 12px 0;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(46, 184, 140, 0.18);
  color: #7dffc9;
  font-size: 12px;
}

.badge.danger {
  background: rgba(255, 64, 48, 0.18);
  color: #ff8d86;
}

.badge.off {
  background: rgba(138, 162, 170, 0.16);
  color: #b7c9cf;
}

.metric {
  margin-bottom: 12px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13px;
}

.bar {
  height: 8px;
  overflow: hidden;
  border-radius: 99px;
  background: #1c2c34;
}

.bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #d2611a, #1eb394);
}

.bar.soh i {
  background: linear-gradient(90deg, #3b82f6, #67e8f9);
}

.kv {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 12px;
  margin: 8px 0 0;
}

.kv dt {
  font-size: 12px;
  color: #8aa2aa;
}

.kv dd {
  margin: 2px 0 0;
  font-size: 14px;
}
</style>
