import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/overview" },
    {
      path: "/overview",
      name: "overview",
      component: () => import("@/views/Overview.vue"),
      meta: { title: "运行总览" }
    },
    {
      path: "/cabinet/:id?",
      name: "cabinet",
      component: () => import("@/views/CabinetView.vue"),
      meta: { title: "柜体监控", flush: true }
    },
    {
      path: "/devices",
      name: "devices",
      component: () => import("@/views/DevicesView.vue"),
      meta: { title: "设备台账" }
    },
    {
      path: "/alarms",
      name: "alarms",
      component: () => import("@/views/AlarmsView.vue"),
      meta: { title: "告警中心" }
    }
  ]
});

router.afterEach(to => {
  document.title = to.meta.title ? `${to.meta.title} · 储能设备监控` : "储能设备监控系统";
});

export default router;
