<script setup>
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import DeviceDetail from "@/components/ess/DeviceDetail.vue";
import { CABINETS, formatNumber } from "@/data/station.js";
import { useMonitor } from "@/stores/monitor.js";

const router = useRouter();
const { state } = useMonitor();

const keyword = ref("");
const cabinetId = ref("all");
const kind = ref("all");
const status = ref("all");
const selectedKey = ref("");

const filtered = computed(() => {
  const text = keyword.value.trim().toLowerCase();
  return state.devices.filter(item => {
    if (cabinetId.value !== "all" && item.cabinetId !== cabinetId.value) return false;
    if (kind.value !== "all" && item.kind !== kind.value) return false;
    if (status.value === "alarm" && !item.alarm) return false;
    if (status.value === "offline" && item.online) return false;
    if (status.value === "normal" && (!item.online || item.alarm)) return false;
    if (!text) return true;
    const blob = `${item.cabinetName} ${item.name} ${item.alarmText}`.toLowerCase();
    return blob.includes(text);
  });
});

const selected = computed(() => state.devices.find(item => item.key === selectedKey.value) || null);

watch(
  filtered,
  list => {
    if (!selectedKey.value && list.length) {
      const preferred = list.find(item => item.alarm) || list[0];
      selectedKey.value = preferred.key;
      return;
    }
    if (selectedKey.value && !list.some(item => item.key === selectedKey.value)) {
      selectedKey.value = list[0]?.key || "";
    }
  },
  { immediate: true }
);

function kindLabel(value) {
  return value === "cluster" ? "电池簇" : "PCS";
}

function statusLabel(item) {
  if (!item.online) return "离线";
  return item.alarm ? item.alarmText : "正常";
}

function openInCabinet() {
  if (!selected.value) return;
  router.push({
    name: "cabinet",
    params: { id: selected.value.cabinetId },
    query: { kind: selected.value.kind, device: String(selected.value.id) }
  });
}
</script>

<template>
  <div class="page">
    <div class="filters">
      <input v-model="keyword" type="search" placeholder="搜索柜体、设备或告警" />
      <select v-model="cabinetId">
        <option value="all">全部柜体</option>
        <option v-for="item in CABINETS" :key="item.id" :value="item.id">{{ item.name }}</option>
      </select>
      <select v-model="kind">
        <option value="all">全部类型</option>
        <option value="cluster">电池簇</option>
        <option value="pcs">PCS</option>
      </select>
      <select v-model="status">
        <option value="all">全部状态</option>
        <option value="normal">正常</option>
        <option value="alarm">告警</option>
        <option value="offline">离线</option>
      </select>
      <span class="count num">{{ filtered.length }} 台</span>
    </div>

    <div class="split">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>柜体</th>
              <th>类型</th>
              <th>设备</th>
              <th>SOC</th>
              <th>SOH</th>
              <th>电压</th>
              <th>电流</th>
              <th>温度</th>
              <th>功率</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in filtered"
              :key="item.key"
              :class="{ active: item.key === selectedKey, alarm: item.alarm, off: !item.online }"
              @click="selectedKey = item.key"
            >
              <td>{{ item.cabinetName }}</td>
              <td>{{ kindLabel(item.kind) }}</td>
              <td>{{ item.name }}</td>
              <td class="num">{{ formatNumber(item.soc) }}%</td>
              <td class="num">{{ formatNumber(item.soh) }}%</td>
              <td class="num">{{ formatNumber(item.voltage) }}</td>
              <td class="num">{{ formatNumber(item.current) }}</td>
              <td class="num">{{ formatNumber(item.temp) }}</td>
              <td class="num">{{ item.kind === "pcs" ? formatNumber(item.power) : "—" }}</td>
              <td>
                <span class="tag" :class="{ danger: item.alarm, off: !item.online }">
                  {{ statusLabel(item) }}
                </span>
              </td>
            </tr>
            <tr v-if="!filtered.length">
              <td colspan="10" class="empty">没有符合条件的设备</td>
            </tr>
          </tbody>
        </table>
      </div>

      <aside class="side">
        <DeviceDetail v-if="selected" :device="selected" :cabinet-name="selected.cabinetName" />
        <p v-else class="placeholder">选择一台设备查看遥测</p>
        <button v-if="selected" type="button" class="link" @click="openInCabinet">在柜体中定位</button>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 100%;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

input,
select {
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: rgba(12, 24, 34, 0.8);
}

input {
  width: min(280px, 100%);
}

.count {
  margin-left: auto;
  color: var(--muted);
  font-size: 13px;
}

.split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 12px;
  min-height: 0;
}

.table-wrap,
.side {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(12, 24, 34, 0.78);
}

.table-wrap {
  overflow: auto;
  max-height: calc(100vh - 168px);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th,
td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(90, 196, 210, 0.1);
  text-align: left;
  white-space: nowrap;
}

th {
  position: sticky;
  top: 0;
  background: #101c26;
  color: var(--muted);
  font-weight: 500;
}

tbody tr {
  cursor: pointer;
}

tbody tr:hover,
tbody tr.active {
  background: rgba(60, 240, 255, 0.06);
}

.tag {
  color: #7dffc9;
}

.tag.danger {
  color: #ff8d86;
}

.tag.off,
tr.off {
  color: #9cb4bc;
}

.empty,
.placeholder {
  color: var(--muted);
  text-align: center;
}

.side {
  padding: 16px;
  align-self: start;
}

.link {
  width: 100%;
  margin-top: 16px;
  padding: 8px 10px;
  border: 1px solid rgba(60, 240, 255, 0.28);
  border-radius: 10px;
  background: rgba(60, 240, 255, 0.08);
  color: #d8fbff;
}

@media (max-width: 980px) {
  .split {
    grid-template-columns: 1fr;
  }

  .table-wrap {
    max-height: none;
  }

  .count {
    margin-left: 0;
  }
}
</style>
