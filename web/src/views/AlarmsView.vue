<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { LEVEL_LABEL, formatClock, relativeTime } from "@/data/station.js";
import { acknowledgeAlarm, acknowledgeAll, useMonitor } from "@/stores/monitor.js";

const router = useRouter();
const { state, activeAlarms } = useMonitor();

const level = ref("all");
const scope = ref("open");

const counts = computed(() => ({
  critical: state.alarms.filter(item => item.level === "critical" && !item.acknowledged).length,
  warning: state.alarms.filter(item => item.level === "warning" && !item.acknowledged).length,
  info: state.alarms.filter(item => item.level === "info" && !item.acknowledged).length
}));

const filtered = computed(() =>
  state.alarms.filter(item => {
    if (level.value !== "all" && item.level !== level.value) return false;
    if (scope.value === "open" && item.acknowledged) return false;
    if (scope.value === "done" && !item.acknowledged) return false;
    return true;
  })
);

function openCabinet(item) {
  router.push({ name: "cabinet", params: { id: item.cabinetId } });
}
</script>

<template>
  <div class="page">
    <section class="summary">
      <button type="button" :class="{ on: level === 'all' }" @click="level = 'all'">
        <span>活动告警</span>
        <strong class="num">{{ activeAlarms.length }}</strong>
      </button>
      <button type="button" :class="{ on: level === 'critical' }" @click="level = 'critical'">
        <span>严重</span>
        <strong class="num critical">{{ counts.critical }}</strong>
      </button>
      <button type="button" :class="{ on: level === 'warning' }" @click="level = 'warning'">
        <span>一般</span>
        <strong class="num warning">{{ counts.warning }}</strong>
      </button>
      <button type="button" :class="{ on: level === 'info' }" @click="level = 'info'">
        <span>提示</span>
        <strong class="num info">{{ counts.info }}</strong>
      </button>
    </section>

    <div class="toolbar">
      <div class="scopes">
        <button type="button" :class="{ on: scope === 'open' }" @click="scope = 'open'">未确认</button>
        <button type="button" :class="{ on: scope === 'all' }" @click="scope = 'all'">全部</button>
        <button type="button" :class="{ on: scope === 'done' }" @click="scope = 'done'">已确认</button>
      </div>
      <button type="button" class="ack" :disabled="!activeAlarms.length" @click="acknowledgeAll">
        全部确认
      </button>
    </div>

    <ul v-if="filtered.length" class="list">
      <li v-for="item in filtered" :key="item.id" :class="{ done: item.acknowledged }">
        <div class="rail" :class="item.level" />
        <div class="body">
          <div class="row">
            <span class="level" :class="item.level">{{ LEVEL_LABEL[item.level] }}</span>
            <strong>{{ item.message }}</strong>
            <span class="state">{{ item.acknowledged ? "已确认" : "未确认" }}</span>
          </div>
          <p>{{ item.cabinetName }} · {{ item.deviceName }}</p>
          <p class="time num">{{ formatClock(item.time) }} · {{ relativeTime(item.time, state.now) }}</p>
        </div>
        <div class="actions">
          <button type="button" @click="openCabinet(item)">查看柜体</button>
          <button v-if="!item.acknowledged" type="button" class="primary" @click="acknowledgeAlarm(item.id)">
            确认
          </button>
        </div>
      </li>
    </ul>
    <p v-else class="empty">这个筛选条件下没有告警</p>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  gap: 14px;
}

.summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.summary button,
.list li,
.scopes {
  border: 1px solid var(--line);
  background: rgba(12, 24, 34, 0.78);
}

.summary button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-radius: 14px;
  text-align: left;
}

.summary button.on {
  border-color: rgba(60, 240, 255, 0.45);
}

.summary span {
  color: var(--muted);
  font-size: 13px;
}

.summary strong {
  font-size: 24px;
}

.critical {
  color: #ff8d86;
}

.warning {
  color: #ffd27a;
}

.info {
  color: #b7f6ff;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.scopes {
  display: flex;
  padding: 4px;
  border-radius: 12px;
}

.scopes button,
.actions button,
.ack {
  border: 0;
  background: transparent;
  color: var(--faint);
}

.scopes button {
  padding: 6px 12px;
  border-radius: 8px;
}

.scopes button.on {
  background: rgba(60, 240, 255, 0.12);
  color: var(--text);
}

.ack {
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
}

.ack:disabled {
  opacity: 0.4;
  cursor: default;
}

.list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.list li {
  display: grid;
  grid-template-columns: 4px 1fr auto;
  gap: 14px;
  align-items: center;
  padding: 12px 14px 12px 0;
  border-radius: 14px;
  overflow: hidden;
}

.list li.done {
  opacity: 0.62;
}

.rail {
  height: 100%;
  min-height: 52px;
}

.rail.critical {
  background: #ff5a52;
}

.rail.warning {
  background: #ffc14d;
}

.rail.info {
  background: #3cf0ff;
}

.row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.level {
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 12px;
}

.level.critical {
  background: rgba(255, 64, 48, 0.16);
}

.level.warning {
  background: rgba(255, 193, 77, 0.14);
}

.level.info {
  background: rgba(60, 240, 255, 0.1);
}

.body p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.state {
  margin-left: auto;
  color: var(--muted);
  font-size: 12px;
}

.actions {
  display: flex;
  gap: 8px;
}

.actions button {
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
}

.actions .primary {
  background: rgba(60, 240, 255, 0.12);
  color: #d8fbff;
}

.empty {
  margin: 24px 0;
  color: var(--muted);
  text-align: center;
}

@media (max-width: 860px) {
  .summary {
    grid-template-columns: 1fr 1fr;
  }

  .list li {
    grid-template-columns: 4px 1fr;
  }

  .actions {
    grid-column: 2;
  }
}
</style>
