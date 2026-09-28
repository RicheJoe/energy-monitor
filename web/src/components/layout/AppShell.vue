<script setup>
import { computed, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { formatClock } from "@/data/station.js";
import { startMonitor, useMonitor } from "@/stores/monitor.js";

const route = useRoute();
const router = useRouter();
const { state, station, activeAlarms, stationMode, stationPower } = useMonitor();

const nav = [
  {
    name: "overview",
    label: "运行总览",
    icon: "M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z"
  },
  {
    name: "cabinet",
    label: "柜体监控",
    icon: "M7 3h10l3 4v14H4V7l3-4zm0 7h10M12 10v8"
  },
  {
    name: "devices",
    label: "设备台账",
    icon: "M5 6h14M5 12h14M5 18h10"
  },
  {
    name: "alarms",
    label: "告警中心",
    icon: "M12 4a5 5 0 0 1 5 5v2.2l1.2 2.4a1 1 0 0 1-.9 1.4H6.7a1 1 0 0 1-.9-1.4L7 11.2V9a5 5 0 0 1 5-5zm-2 12a2 2 0 0 0 4 0"
  }
];

const clock = computed(() => formatClock(state.now));
const flush = computed(() => Boolean(route.meta.flush));
const powerText = computed(() => {
  const value = Math.abs(stationPower.value);
  return `${stationMode.value.label} ${value.toFixed(0)} kW`;
});

let stop = null;

function open(item) {
  if (item.name === "cabinet") {
    router.push({ name: "cabinet", params: { id: "C01" } });
    return;
  }
  router.push({ name: item.name });
}

onMounted(() => {
  stop = startMonitor();
});

onUnmounted(() => {
  stop?.();
});
</script>

<template>
  <div class="shell">
    <aside class="sider">
      <div class="brand">
        <span class="mark" aria-hidden="true" />
        <div>
          <strong>储能监控</strong>
          <p>{{ station.code }}</p>
        </div>
      </div>
      <nav>
        <button
          v-for="item in nav"
          :key="item.name"
          type="button"
          :class="{ active: route.name === item.name }"
          @click="open(item)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path :d="item.icon" />
          </svg>
          <span>{{ item.label }}</span>
          <em v-if="item.name === 'alarms' && activeAlarms.length" class="count num">
            {{ activeAlarms.length }}
          </em>
        </button>
      </nav>
      <div class="sider-foot" :class="{ error: state.error }">
        <span class="live" />
        {{ state.error || (state.ready ? "遥测刷新中" : "正在连接监测服务") }}
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div>
          <h1>{{ route.meta.title }}</h1>
          <p>{{ station.name }} · {{ station.location }}</p>
        </div>
        <div class="top-meta">
          <span class="mode" :class="stationMode.key">{{ powerText }}</span>
          <time class="num">{{ clock }}</time>
        </div>
      </header>
      <div class="content" :class="{ flush }">
        <router-view />
      </div>
    </div>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(900px 420px at 0% -10%, rgba(60, 240, 255, 0.08), transparent 55%),
    var(--bg);
}

.sider {
  display: flex;
  flex-direction: column;
  width: 220px;
  flex: none;
  border-right: 1px solid var(--line);
  background: rgba(7, 16, 24, 0.92);
}

.brand {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 22px 18px 18px;
}

.mark {
  width: 36px;
  height: 36px;
  border: 2px solid var(--cyan);
  border-radius: 8px;
  box-shadow: inset 0 0 0 6px rgba(30, 179, 148, 0.9), 0 0 16px rgba(60, 240, 255, 0.25);
}

.brand strong {
  display: block;
  font-size: 16px;
}

.brand p {
  margin: 2px 0 0;
  color: var(--muted);
  font-size: 12px;
}

nav {
  display: grid;
  gap: 4px;
  padding: 8px 12px;
}

nav button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--faint);
  text-align: left;
}

nav button svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

nav button.active {
  background: rgba(60, 240, 255, 0.1);
  color: var(--text);
  box-shadow: inset 2px 0 0 var(--cyan);
}

nav button:hover {
  background: rgba(255, 255, 255, 0.04);
}

.count {
  margin-left: auto;
  min-width: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: rgba(255, 64, 48, 0.2);
  color: #ffb0aa;
  font-size: 12px;
  font-style: normal;
  line-height: 18px;
  text-align: center;
}

.sider-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding: 16px 18px 20px;
  color: var(--muted);
  font-size: 12px;
}

.live {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #7dffc9;
  box-shadow: 0 0 8px #7dffc9;
}

.sider-foot.error {
  color: #ffb0aa;
}

.sider-foot.error .live {
  background: #ff5a52;
  box-shadow: 0 0 8px #ff5a52;
}

.main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.topbar {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
}

.topbar h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.topbar p {
  margin: 4px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.top-meta {
  display: flex;
  align-items: center;
  gap: 14px;
  color: var(--faint);
  font-size: 13px;
}

.mode {
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(60, 240, 255, 0.1);
  color: #bff9ff;
}

.mode.charge {
  background: rgba(210, 97, 26, 0.18);
  color: #ffc59a;
}

.mode.idle,
.mode.offline {
  background: rgba(138, 162, 170, 0.14);
  color: #d5e2e6;
}

.content {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px 18px 22px;
}

.content.flush {
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

@media (max-width: 860px) {
  .shell {
    flex-direction: column;
    height: auto;
    min-height: 100vh;
  }

  .sider {
    width: 100%;
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }

  nav {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  nav button {
    justify-content: center;
    padding: 8px 4px;
    font-size: 12px;
  }

  nav button svg,
  .sider-foot,
  .brand p,
  .count {
    display: none;
  }

  .content.flush {
    height: calc(100vh - 132px);
    min-height: 560px;
  }
}
</style>
