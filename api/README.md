# 储能监测 API

`api` 是储能电站的监测服务。设备通过 MQTT 上报遥测，服务把消息放入 RabbitMQ，消费者写入 PostgreSQL 并刷新 Redis。前端通过 HTTP 读取设备快照、告警和今日功率曲线。

```text
模拟器 / 设备
    │  MQTT  energy/v1/devices/{id}/telemetry
    ▼
EMQX ──订阅──► API ──投递──► RabbitMQ energy.telemetry.persist
                                │
                                ▼
                         PostgreSQL（快照、历史、告警）
                         Redis device:{id}:latest
                                │
                                ▼
                         HTTP  /api/*  ──► 前端（每 3 秒轮询）
```

测点单位：SOC / SOH 为百分比，电压 V，电流 A，温度 ℃，功率 kW。功率为正表示放电，为负表示充电。

## 目录

```text
api/
├── prisma/schema.prisma          # 模型
├── prisma/migrations/            # PostgreSQL 迁移
├── prisma/seed.js                # 城东储能电站初始数据
├── src/index.ts                  # HTTP 入口与进程退出
├── src/routes/                   # devices、alarms、station
├── src/mqtt.ts                   # 订阅 EMQX
├── src/queue.ts                  # RabbitMQ 生产与消费
├── src/ingest.ts                 # 写库并更新 Redis
└── Dockerfile
```

仓库里相关的其他目录：`simulator/` 定时向 EMQX 发遥测，`web/` 是监控页面。

## 依赖服务

本地账号与 `docker-compose.yml` 一致。

| 服务 | 地址 | 账号 |
|---|---|---|
| PostgreSQL 16 | `localhost:5432`，库 `energy` | `energy` / `energy` |
| Redis 7 | `localhost:6379` | 无 |
| RabbitMQ | AMQP `localhost:5672`，管理台 `http://localhost:15672` | `energy` / `energy` |
| EMQX 5 | MQTT `localhost:1883`，控制台 `http://localhost:18083` | 允许匿名连接 |

先启动这四个服务：

```bash
docker compose up -d db redis rabbitmq emqx
```

## 环境变量

配置写在 `api/.env`。进程里已经存在的变量不会被 `.env` 覆盖，因此 Compose 注入的容器地址优先于本地文件。

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL 连接串，必填 |
| `REDIS_URL` | `redis://localhost:6379` | 最新状态缓存 |
| `MQTT_URL` | `mqtt://localhost:1883` | EMQX |
| `MQTT_TOPIC` | `energy/v1/devices/+/telemetry` | 订阅主题 |
| `RABBITMQ_URL` | `amqp://energy:energy@localhost:5672` | RabbitMQ |
| `PORT` | `3000` | HTTP 端口 |

本地示例：

```text
DATABASE_URL="postgresql://energy:energy@localhost:5432/energy?schema=public"
REDIS_URL="redis://localhost:6379"
MQTT_URL="mqtt://localhost:1883"
RABBITMQ_URL="amqp://energy:energy@localhost:5672"
PORT=3000
```

## 启动

```bash
cd api
npm install
npm run prisma:deploy    # 把已有迁移应用到数据库
npm run prisma:generate  # 生成 Prisma Client（部署后通常已自动生成）
npm run prisma:seed      # 写入初始设备和告警
npm run dev              # ts-node-dev 热更新，http://localhost:3000
```

生产构建：

```bash
npm run build            # 输出 dist/
npm start                # node dist/index.js
```

`npm run prisma:migrate` 会创建新的开发迁移，已有环境只需要 `prisma:deploy`。

收到 `SIGINT` 或 `SIGTERM` 时，进程先停止 MQTT 订阅和 RabbitMQ 消费，再断开数据库和 Redis。

模拟器另开一个终端：

```bash
cd simulator
npm start
```

`SIM_INTERVAL_MS` 默认 `5000`，`SIM_BATCH_SIZE` 默认 `4`。它按设备编号轮流发布，编号与种子数据一致。

整套容器：

```bash
docker compose up --build
```

API 容器启动命令是 `prisma migrate deploy && node dist/index.js`。镜像构建时会生成 Prisma Client 并编译 TypeScript。

前端开发服务器：

```bash
cd web
npm run dev    # http://localhost:5173，/api 代理到 localhost:3000
```

## 数据模型

模型在 `prisma/schema.prisma`。表名保持 Prisma 默认的 PascalCase，SQL 中需要加引号，例如 `"Device"`。

### Device

设备当前快照。`id` 由调用方指定，格式是 `{柜体}-{类型}-{序号}`，序号从 0 开始。例如 `C01-cluster-0` 是 1 号柜的「电池簇 01」，`C02-pcs-1` 是 2 号柜的 PCS-2。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 主键，无默认值 |
| `cabinetId` / `cabinetName` | string | 所属柜体 |
| `kind` | `cluster` \| `pcs` | 电池簇或 PCS |
| `name` | string | 显示名称 |
| `online` | boolean | 默认 `true` |
| `soc` `soh` `voltage` `current` `temp` `power` | float | 当前测点，默认 `0` |
| `alarm` / `alarmText` | boolean / string | 告警标志，文案默认「正常」 |
| `createdAt` | datetime | 入库时间 |
| `updatedAt` | datetime | Prisma 每次更新时刷新 |

索引：`(cabinetId, kind)`。

### Telemetry

历史采样，只追加。`id` 是 `BIGSERIAL`，JSON 里序列化成字符串。删除设备时，该设备的遥测级联删除。

字段为 `deviceId`、六项测点、`createdAt`。索引：`(deviceId, createdAt)`。

### Alarm

告警记录。`level` 为 `critical`、`warning`、`info`。`cabinetName` 和 `deviceName` 是发生当时的名称，设备后来改名不会回写。`deviceId` 可空，用来表示不挂在具体设备上的柜体告警；设备被删除时告警保留，`deviceId` 置空。

索引：`(acknowledged, createdAt)`、`(cabinetId, createdAt)`、`(deviceId, createdAt)`、`(createdAt DESC)`。

迁移 `20260928090000_align_models` 会把已有的 `kind`、`level` 收成枚举。库里如果出现枚举以外的值，这一步会失败，需要先改成合法值。

## 初始数据

`npm run prisma:seed` 可以重复执行。它会清掉这四台柜已有的遥测和相关告警，再重建：

| 表 | 数量 | 内容 |
|---|---|---|
| `Device` | 88 | `C01`–`C04`，每柜 20 个电池簇、2 台 PCS |
| `Telemetry` | 1056 | 每台设备 12 条，间隔 10 分钟 |
| `Alarm` | 9 | 6 条设备告警，外加 4 号柜通讯中断和 2 条已确认历史告警 |

1 号柜、3 号柜放电，2 号柜充电，4 号柜离线。离线柜当前电流和功率为 0，告警文案是「通讯中断」，历史遥测停在中断之前。

## 采集链路

1. 设备向 `energy/v1/devices/{deviceId}/telemetry` 发布 JSON，QoS 1。
2. API 订阅 `energy/v1/devices/+/telemetry`。主题中的设备编号必须和消息体 `deviceId` 一致，否则直接丢弃。
3. 通过校验的消息写入持久化交换机 `energy.telemetry`，路由键 `persist`。
4. 队列 `energy.telemetry.persist` 预取 32 条。消费者在一个事务里更新 `Device` 并插入 `Telemetry`，然后把最新值写入 Redis 哈希 `device:{deviceId}:latest`。Redis 写失败只记日志，数据库提交后仍然确认消息。

消息体：

```json
{
  "deviceId": "C01-cluster-0",
  "soc": 78.2,
  "soh": 96,
  "voltage": 730,
  "current": 24.1,
  "temp": 29.4,
  "power": 16,
  "online": true,
  "alarm": false,
  "alarmText": "正常"
}
```

`soc`、`soh`、`voltage`、`current`、`temp`、`power` 必填。`online`、`alarm`、`alarmText` 可选，只更新快照，不写入遥测表。

告警只在状态变化时新增一行：`alarm` 从 false 变为 true，或 `online` 从 true 变为 false。同一告警重复上报不会再插入。离线产生的告警级别是 `critical`。

进死信队列 `energy.telemetry.persist.dlq` 的情况：

- JSON 无法解析，或字段校验失败
- `deviceId` 在 `Device` 中不存在
- 写库失败并已重试 3 次

RabbitMQ 断线后自动重连，并重新声明交换机、队列和消费者。MQTT 断线后每 2 秒重连并重新订阅。

## HTTP 接口

未知路径返回 `404`：`{ "error": "Not Found" }`。

校验失败返回 `400`：

```json
{
  "error": "Validation failed",
  "details": {
    "formErrors": ["Unrecognized key: \"location\""],
    "fieldErrors": { "id": ["Invalid input: expected string, received undefined"] }
  }
}
```

`fieldErrors` 是字段错误，`formErrors` 是无法归到单个字段的错误，例如未知字段。主键冲突返回 `409`，外键指向的设备不存在返回 `400`，更新或确认的记录不存在返回 `404`。其他未捕获错误返回 `500`。

### 健康检查

`GET /health`

数据库、Redis、MQTT、RabbitMQ 都连通时返回 `200`，否则 `503`。HTTP 服务本身仍会启动，采集连接在后台重试。

```json
{ "ok": true, "db": true, "redis": true, "mqtt": true, "rabbitmq": true }
```

### 设备

`GET /api/devices`

查询参数都可选：`cabinetId`、`kind`（`cluster` 或 `pcs`）、`online`（`true` 或 `false`）。按 `updatedAt` 降序，相同时按 `id` 升序。

`POST /api/devices` 创建设备，返回 `201`。

```json
{
  "id": "C01-cluster-0",
  "cabinetId": "C01",
  "cabinetName": "1# 储能柜",
  "kind": "cluster",
  "name": "电池簇 01",
  "soc": 86.2,
  "soh": 97.1,
  "voltage": 742.4,
  "current": 28.6,
  "temp": 29.4,
  "power": 18.2
}
```

`id`、`cabinetId`、`cabinetName`、`kind`、`name` 必填。测点可省略，数据库默认 `0`。未知字段返回 `400`。

`GET /api/devices/:id` 返回快照。不存在时 `404`。

`PATCH /api/devices/:id` 局部更新快照，不写遥测。请求体至少包含一个字段，可改柜体、类型、名称和测点。

`GET /api/devices/:id/latest` 优先读 Redis。有缓存时 `source` 为 `redis`，字段值是字符串。没有缓存时回退数据库快照，`source` 为 `db`，测点是数字。设备不存在返回 `404`。

```json
{
  "deviceId": "C01-cluster-0",
  "source": "redis",
  "soc": "78.2",
  "soh": "96",
  "voltage": "730",
  "current": "24.1",
  "temp": "29.4",
  "power": "16",
  "online": "true",
  "alarm": "false",
  "alarmText": "正常",
  "updatedAt": "2026-09-28T09:07:20.611Z"
}
```

`POST /api/devices/:id/telemetry` 与 MQTT 消费走同一类写入：同一事务更新快照并追加历史，返回 `201`。

```json
{
  "soc": 80,
  "soh": 97,
  "voltage": 740,
  "current": 20,
  "temp": 30,
  "power": -12.5,
  "alarm": true,
  "alarmText": "SOC 过低"
}
```

响应包含更新后的 `device` 和新的 `point`。`point.id` 是字符串。

`GET /api/devices/:id/telemetry` 按 `createdAt` 降序返回历史。`GET /api/devices/:id/readings` 是同一接口。

| 参数 | 说明 |
|---|---|
| `limit` | 默认 `100`，最大 `1000`，必须是正整数 |
| `from` / `to` | 可解析的时间，对应 `createdAt` 闭区间 |

### 告警

`GET /api/alarms`

| 参数 | 说明 |
|---|---|
| `cabinetId` | 柜体 |
| `deviceId` | 设备 |
| `acknowledged` | `true` 或 `false` |
| `limit` | 默认 `100`，最大 `500` |

按 `createdAt` 降序。

`POST /api/alarms` 返回 `201`。`id` 可省略，省略时生成 cuid。`deviceId` 可省略或传 `null`。

```json
{
  "deviceId": "C01-cluster-3",
  "level": "warning",
  "cabinetId": "C01",
  "cabinetName": "1# 储能柜",
  "deviceName": "电池簇 04",
  "message": "SOC 过低"
}
```

`PATCH /api/alarms/:id/ack` 把 `acknowledged` 设为 `true` 并返回该条告警。

### 电站曲线

`GET /api/station/curve`

返回今天（Asia/Shanghai）每个有数据的半小时桶。只统计 PCS。每个设备在每个时段取最新一条遥测，再把各 PCS 的功率相加。负功率的绝对值计入 `charge`，正功率计入 `discharge`，单位都是 kW。没有采样的时段不会出现在结果里。

```json
[
  { "bucket": "2026-09-28T17:00:00+08:00", "charge": 280.6, "discharge": 560.4 }
]
```

前端把这些点铺到当天 48 个半小时槽位上，空槽按 0 绘制，并用 `功率 × 0.5 小时` 估算今日电量。

## 前端读取方式

页面不直连 MQTT。`web` 每 3 秒请求：

- `GET /api/devices`：总览、设备台账、柜体状态和三维测点
- `GET /api/alarms?limit=500`：告警列表
- `GET /api/station/curve`：今日功率曲线

确认告警调用 `PATCH /api/alarms/:id/ack`。设备编号 `C01-cluster-0` 在页面上拆成柜体 `C01`、类型 `cluster`、三维序号 `0`。
