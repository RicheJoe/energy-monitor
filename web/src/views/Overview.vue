<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import PowerChart from "@/components/charts/PowerChart.vue";
import { LEVEL_LABEL, formatNumber, relativeTime, runMode } from "@/data/station.js";
import { useMonitor } from "@/stores/monitor.js";

const router = useRouter();
const {
  state,
  station,
  cabinets,
  stationPower,
  stationSoc,
  stationSoh,
  activeAlarms,
  nowIndex,
  todayEnergy,
  socBuckets,
  stationMode
} = useMonitor();

const onlineCount = computed(() => cabinets.value.filter(item => item.online).length);
const bucketMax = computed(() => Math.max(...socBuckets.value.map(item => item.count), 1));

const kpis = computed(() => [
  {
    label: "实时功率",
    value: formatNumber(Math.abs(stationPower.value), 0),
    unit: "kW",
    hint: stationMode.value.label
  },
  {
    label: "今日充电",
    value: formatNumber(todayEnergy.value.charge, 0),
    unit: "kWh",
    hint: "截至当前"
  },
  {
    label: "今日放电",
    value: formatNumber(todayEnergy.value.discharge, 0),
    unit: "kWh",
    hint: "截至当前"
  },
  {
    label: "电站 SOC",
    value: formatNumber(stationSoc.value, 1),
    unit: "%",
    hint: `SOH ${formatNumber(stationSoh.value, 1)}%`
  },
  {
    label: "在线柜体",
    value: `${onlineCount.value}/${cabinets.value.length}`,
    unit: "",
    hint: `${station.ratedPower / 1000} MW / ${station.ratedEnergy / 1000} MWh`
  },
  {
    label: "活动告警",
    value: String(activeAlarms.value.length),
    unit: "",
    hint: activeAlarms.value.length ? "待确认" : "无活动告警",
    danger: activeAlarms.value.length > 0
  }
]);

function openCabinet(id) {
  router.push({ name: "cabinet", params: { id } });
}

function openAlarms() {
  router.push({ name: "alarms" });
}
</script>

<template>
  <div class="page">
    <section class="kpis">
      <article v-for="item in kpis" :key="item.label" class="kpi" :class="{ danger: item.danger }">
        <p>{{ item.label }}</p>
        <strong class="num">{{ item.value }}<small>{{ item.unit }}</small></strong>
        <span>{{ item.hint }}</span>
      </article>
    </section>

    <section class="split">
      <article class="panel">
        <header class="panel-head">
          <div>
            <h2>今日功率曲线</h2>
            <p>充电与放电功率，半小时一个点</p>
          </div>
          <ul class="legend">
            <li><i class="swatch discharge" />放电</li>
            <li><i class="swatch charge" />充电</li>
          </ul>
        </header>
        <PowerChart :points="state.curve" :now-index="nowIndex" />
      </article>

      <article class="panel">
        <header class="panel-head">
          <div>
            <h2>活动告警</h2>
            <p>{{ activeAlarms.length }} 条未确认</p>
          </div>
          <button type="button" class="text-btn" @click="openAlarms">全部</button>
        </header>
        <ul v-if="activeAlarms.length" class="alarms">
          <li v-for="item in activeAlarms.slice(0, 5)" :key="item.id">
            <span class="level" :class="item.level">{{ LEVEL_LABEL[item.level] }}</span>
            <div>
              <strong>{{ item.message }}</strong>
              <p>{{ item.cabinetName }} · {{ item.deviceName }}</p>
            </div>
            <time>{{ relativeTime(item.time, state.now) }}</time>
          </li>
        </ul>
        <p v-else class="empty">当前没有未确认告警</p>
      </article>
    </section>

    <section class="lower">
      <article class="panel grow">
        <header class="panel-head">
          <div>
            <h2>储能柜</h2>
            <p>点击进入柜体三维监控</p>
          </div>
        </header>
        <div class="cards">
          <button
            v-for="item in cabinets"
            :key="item.id"
            type="button"
            class="card"
            :class="{ off: !item.online }"
            @click="openCabinet(item.id)"
          >
            <div class="card-top">
              <strong>{{ item.name }}</strong>
              <span class="pill" :class="runMode(item).key">{{ runMode(item).label }}</span>
            </div>
            <div class="soc-line">
              <span>SOC</span>
              <b class="num">{{ formatNumber(item.soc) }}%</b>
            </div>
            <div class="bar"><i :style="{ width: `${Math.min(item.soc, 100)}%` }" /></div>
            <dl>
              <div>
                <dt>功率</dt>
                <dd class="num">{{ formatNumber(Math.abs(item.power), 0) }} kW</dd>
              </div>
              <div>
                <dt>最高温度</dt>
                <dd class="num">{{ formatNumber(item.temp) }} ℃</dd>
              </div>
              <div>
                <dt>告警</dt>
                <dd class="num" :class="{ hot: item.alarmCount }">{{ item.alarmCount }}</dd>
              </div>
              <div>
                <dt>设备</dt>
                <dd class="num">{{ item.clusterCount }} 簇 / {{ item.pcsCount }} PCS</dd>
              </div>
            </dl>
          </button>
        </div>
      </article>

      <article class="panel soc-panel">
        <header class="panel-head">
          <div>
            <h2>簇 SOC 分布</h2>
            <p>在线电池簇</p>
          </div>
        </header>
        <ul class="buckets">
          <li v-for="item in socBuckets" :key="item.label">
            <div class="bucket-row">
              <span>{{ item.label }}</span>
              <b class="num">{{ item.count }}</b>
            </div>
            <div class="bar">
              <i :class="item.tone" :style="{ width: `${(item.count / bucketMax) * 100}%` }" />
            </div>
          </li>
        </ul>
      </article>
    </section>
  </div>
</template>

<style scoped>
.page {
  display: grid;
  gap: 16px;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}

.kpi,
.panel,
.card {
  border: 1px solid var(--line);
  border-radius: 14px;
  background: rgba(12, 24, 34, 0.78);
}

.kpi {
  padding: 14px 14px 12px;
}

.kpi p,
.kpi span {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.kpi strong {
  display: block;
  margin: 8px 0 6px;
  font-size: 26px;
  font-weight: 620;
  letter-spacing: -0.03em;
}

.kpi small {
  margin-left: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
}

.kpi.danger strong {
  color: #ffb0aa;
}

.split,
.lower {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.8fr);
  gap: 16px;
}

.panel {
  padding: 14px 16px 16px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 8px;
}

.panel-head h2 {
  margin: 0;
  font-size: 15px;
}

.panel-head p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.legend {
  display: flex;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--faint);
  font-size: 12px;
}

.legend li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.swatch {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.swatch.discharge {
  background: #3cf0ff;
}

.swatch.charge {
  background: #e08945;
}

.text-btn {
  border: 0;
  background: transparent;
  color: #7fd8d0;
  font-size: 12px;
}

.alarms {
  display: grid;
  gap: 10px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.alarms li {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
}

.alarms strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
}

.alarms p,
.alarms time,
.empty {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.level {
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 12px;
}

.level.critical {
  background: rgba(255, 64, 48, 0.16);
  color: #ff8d86;
}

.level.warning {
  background: rgba(255, 193, 77, 0.14);
  color: #ffd27a;
}

.level.info {
  background: rgba(60, 240, 255, 0.1);
  color: #b7f6ff;
}

.cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 8px;
}

.card {
  padding: 14px;
  color: inherit;
  text-align: left;
}

.card.off {
  opacity: 0.72;
}

.card:hover {
  border-color: rgba(60, 240, 255, 0.45);
}

.card-top,
.soc-line,
.bucket-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.pill {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(60, 240, 255, 0.12);
  color: #bff9ff;
  font-size: 12px;
}

.pill.charge {
  background: rgba(210, 97, 26, 0.18);
  color: #ffc59a;
}

.pill.offline,
.pill.idle {
  background: rgba(138, 162, 170, 0.16);
  color: #d5e2e6;
}

.soc-line {
  margin-top: 12px;
  color: var(--muted);
  font-size: 12px;
}

.soc-line b {
  color: var(--text);
  font-size: 14px;
}

.bar {
  height: 8px;
  margin: 8px 0 12px;
  overflow: hidden;
  border-radius: 99px;
  background: #1c2c34;
}

.card .bar i,
.buckets .bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #d2611a, #1eb394);
}

.buckets .bar i.low {
  background: #ff6b64;
}

.buckets .bar i.mid {
  background: #e08945;
}

.buckets .bar i.high {
  background: #1eb394;
}

.buckets .bar i.full {
  background: #3cf0ff;
}

.card dl {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 12px;
  margin: 0;
}

.card dt {
  color: var(--muted);
  font-size: 12px;
}

.card dd {
  margin: 2px 0 0;
  font-size: 13px;
}

.hot {
  color: #ff8d86;
}

.buckets {
  display: grid;
  gap: 14px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.bucket-row {
  margin-bottom: 6px;
  font-size: 13px;
}

@media (max-width: 1280px) {
  .kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .split,
  .lower,
  .cards {
    grid-template-columns: 1fr;
  }
}
</style>
