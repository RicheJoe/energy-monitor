<script setup>
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import DeviceDetail from "@/components/ess/DeviceDetail.vue";
import EssScene from "@/components/ess/EssScene.vue";
import { runMode } from "@/data/station.js";
import { useMonitor } from "@/stores/monitor.js";

const route = useRoute();
const router = useRouter();
const { cabinets, state } = useMonitor();

const selected = ref(null);
const sceneApi = ref(null);

const cabinetId = computed(() => String(route.params.id || "C01"));
const cabinetDevices = computed(() =>
  state.devices.filter(item => item.cabinetId === cabinetId.value)
);
const cabinet = computed(
  () => cabinets.value.find(item => item.id === cabinetId.value) || cabinets.value[0]
);

watch(
  cabinets,
  list => {
    if (!list.length) return;
    if (!list.some(item => item.id === cabinetId.value)) {
      router.replace({ name: "cabinet", params: { id: list[0].id } });
    }
  },
  { immediate: true }
);

watch(cabinetId, () => {
  selected.value = null;
  sceneApi.value = null;
});

function openCabinet(id) {
  router.push({ name: "cabinet", params: { id } });
}

function onSelect(item) {
  selected.value = item;
}

function onTelemetry(item) {
  if (selected.value && selected.value.kind === item.kind && selected.value.id === item.id) {
    selected.value = item;
  }
}

function onReady(api) {
  sceneApi.value = api;
  const kind = String(route.query.kind || "");
  const deviceId = Number(route.query.device);
  if ((kind === "cluster" || kind === "pcs") && Number.isFinite(deviceId)) {
    api.selectById(kind, deviceId);
  }
}

function closePanel() {
  sceneApi.value?.close();
}
</script>

<template>
  <div v-if="cabinet" class="ess-page">
    <header class="hud">
      <div>
        <h1>{{ cabinet.name }}</h1>
        <p>拖拽旋转 · 滚轮缩放 · 右键平移 · 点击电池簇 / PCS 查看详情</p>
        <div class="switcher">
          <button
            v-for="item in cabinets"
            :key="item.id"
            type="button"
            :class="{ active: item.id === cabinet.id, off: !item.online }"
            @click="openCabinet(item.id)"
          >
            <span>{{ item.name }}</span>
            <em :class="runMode(item).key">{{ runMode(item).label }}</em>
          </button>
        </div>
      </div>
      <ul class="legend">
        <li><span class="dot flow" />电流流动</li>
        <li><span class="dot alarm" />告警红闪</li>
        <li><span class="dot soc" />SOC 色带</li>
      </ul>
    </header>

    <EssScene
      :key="cabinet.id"
      :seed="cabinet.seed"
      :devices="cabinetDevices"
      @select="onSelect"
      @telemetry="onTelemetry"
      @ready="onReady"
    />

    <div v-if="!cabinet.online" class="offline-banner">通讯中断，以下为最近一次缓存画面</div>

    <aside v-if="selected" class="detail">
      <DeviceDetail
        :device="selected"
        :cabinet-name="cabinet.name"
        show-close
        @close="closePanel"
      />
    </aside>
  </div>
</template>

<style scoped>
.ess-page {
  position: relative;
  flex: 1;
  width: 100%;
  height: 100%;
  min-height: 560px;
  overflow: hidden;
  background: #071018;
}

.hud {
  position: absolute;
  z-index: 2;
  left: 20px;
  right: 20px;
  top: 16px;
  display: flex;
  justify-content: space-between;
  gap: 16px;
  pointer-events: none;
}

.hud h1 {
  margin: 0;
  font-size: 22px;
}

.hud p {
  margin: 6px 0 0;
  color: rgba(196, 220, 228, 0.72);
  font-size: 13px;
}

.switcher {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  pointer-events: auto;
}

.switcher button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid rgba(90, 196, 210, 0.2);
  border-radius: 999px;
  background: rgba(8, 18, 26, 0.72);
  color: #d5e6ec;
  font-size: 12px;
}

.switcher button.active {
  border-color: rgba(60, 240, 255, 0.55);
  color: #f3fdff;
}

.switcher em {
  font-style: normal;
  color: #7fd8d0;
}

.switcher em.charge {
  color: #ffc59a;
}

.switcher em.offline,
.switcher em.idle {
  color: #9cb4bc;
}

.switcher button.off {
  opacity: 0.75;
}

.legend {
  display: flex;
  gap: 14px;
  align-items: center;
  height: fit-content;
  margin: 0;
  padding: 8px 12px;
  list-style: none;
  border-radius: 999px;
  background: rgba(8, 18, 26, 0.72);
  color: #d5e6ec;
  font-size: 12px;
}

.dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin-right: 6px;
  border-radius: 50%;
}

.dot.flow {
  background: #3cf0ff;
  box-shadow: 0 0 8px #3cf0ff;
}

.dot.alarm {
  background: #ff2d2a;
  box-shadow: 0 0 8px #ff2d2a;
}

.dot.soc {
  background: linear-gradient(90deg, #d2611a, #1eb394);
}

.offline-banner {
  position: absolute;
  z-index: 2;
  left: 50%;
  bottom: 18px;
  transform: translateX(-50%);
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 64, 48, 0.16);
  color: #ffb0aa;
  font-size: 12px;
  pointer-events: none;
}

.detail {
  position: absolute;
  top: 86px;
  right: 18px;
  z-index: 3;
  width: 280px;
  padding: 16px;
  border: 1px solid rgba(90, 196, 210, 0.25);
  border-radius: 14px;
  background: rgba(9, 18, 26, 0.92);
  backdrop-filter: blur(10px);
}

@media (max-width: 860px) {
  .hud {
    flex-direction: column;
  }

  .legend {
    width: fit-content;
  }

  .detail {
    top: auto;
    right: 12px;
    bottom: 12px;
    left: 12px;
    width: auto;
  }
}
</style>
