<script setup>
import { onMounted, onUnmounted, ref, watch } from "vue";
import { mountEssScene } from "@/components/ess3d/essCabinetScene.js";

const props = defineProps({
  seed: { type: Number, default: 0 },
  devices: { type: Array, default: () => [] }
});

const emit = defineEmits(["select", "hover", "telemetry", "ready"]);

const canvasHost = ref(null);
const loading = ref(true);
const errorText = ref("");
const hoverName = ref("");
let sceneApi = null;

function onSelect(item) {
  emit("select", item);
}

function onHover(item) {
  hoverName.value = item ? item.name : "";
  emit("hover", item);
}

function onTelemetry(item) {
  emit("telemetry", item);
}

onMounted(async () => {
  try {
    sceneApi = await mountEssScene(canvasHost.value, {
      onSelect,
      onHover,
      onTelemetry,
      seed: props.seed
    });
    emit("ready", {
      close() {
        sceneApi?.selectNone();
      },
      selectById(kind, id) {
        sceneApi?.selectById(kind, id);
      }
    });
    sceneApi.applyLive(props.devices);
  } catch (err) {
    errorText.value = err?.message || "模型加载失败";
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  sceneApi?.dispose();
});

watch(
  () => props.devices,
  rows => {
    sceneApi?.applyLive(rows);
  },
  { deep: true }
);
</script>

<template>
  <div ref="canvasHost" class="viewport">
    <div v-if="loading" class="state">正在加载柜体模型…</div>
    <div v-else-if="errorText" class="state error">{{ errorText }}</div>
    <div v-if="hoverName" class="hover-tag">{{ hoverName }}</div>
  </div>
</template>

<style scoped>
.viewport {
  position: relative;
  width: 100%;
  height: 100%;
}

.viewport :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}

.state {
  position: absolute;
  z-index: 2;
  inset: 0;
  display: grid;
  place-items: center;
  color: #c5d8df;
  font-size: 14px;
  pointer-events: none;
}

.state.error {
  color: #ff8b80;
}

.hover-tag {
  position: absolute;
  left: 20px;
  bottom: 18px;
  z-index: 2;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(8, 18, 26, 0.78);
  color: #d7eef3;
  font-size: 12px;
  pointer-events: none;
}
</style>
