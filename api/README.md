# API 数据模型与接口

储能监测服务使用 PostgreSQL 存设备快照、历史遥测和告警，使用 Redis 存设备最新状态。Prisma 模型在 `prisma/schema.prisma`。

## 环境变量

本地配置在 `api/.env`。进程里已经存在的变量不会被 `.env` 覆盖，Docker Compose 注入的地址优先。

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串，例如 `postgresql://energy:energy@localhost:5432/energy?schema=public` |
| `REDIS_URL` | Redis 连接串，默认 `redis://localhost:6379` |
| `PORT` | HTTP 端口，默认 `3000` |

## 启动

```bash
cd api
npm run prisma:deploy   # 已有库只应用迁移
npm run dev             # 开发
npm run build && npm start
```

`docker compose up` 会在 API 容器启动时执行 `prisma migrate deploy`。

已有库如果 `Device.kind` 或 `Alarm.level` 里出现枚举以外的值，迁移 `20260928090000_align_models` 会失败。合法值见下面的枚举。

## 表

`Device` 保存设备当前快照。`id` 由调用方传入，对应前端的设备标识。`kind` 只能是 `cluster`（电池簇）或 `pcs`。`createdAt` 是入库时间，`updatedAt` 在 Prisma 每次更新时刷新。

`Telemetry` 按时间追加采样。`id` 是 `BIGSERIAL`，接口里序列化成字符串。删除设备时，该设备的遥测级联删除。

`Alarm` 保存告警记录。`level` 只能是 `critical`、`warning`、`info`。`cabinetName` 和 `deviceName` 是告警发生时的名称快照，设备之后改名不会回写历史告警。`deviceId` 可空，用来表示不挂在具体设备上的柜体告警；设备被删除时，告警保留，`deviceId` 置空。

索引：

- `Device (cabinetId, kind)`，按柜体和设备类型过滤
- `Telemetry (deviceId, createdAt)`，按设备查时间序列
- `Alarm (acknowledged, createdAt)`、`(cabinetId, createdAt)`、`(deviceId, createdAt)`、`(createdAt DESC)`

## 接口

校验失败返回 `400`。`details.fieldErrors` 是字段错误，`details.formErrors` 包含无法归到字段上的错误，例如未知字段。主键冲突返回 `409`，关联设备不存在返回 `400`，记录不存在返回 `404`。

`GET /health` 同时探测数据库和 Redis。两者都可用时 `200`，否则 `503`：

```json
{ "ok": true, "db": true, "redis": true }
```

### 设备

`GET /api/devices`

查询参数：`cabinetId`、`kind`（`cluster` | `pcs`）、`online`（`true` | `false`）。按 `updatedAt` 降序。

`POST /api/devices`

```json
{
  "id": "C01-cluster-1",
  "cabinetId": "C01",
  "cabinetName": "1# 储能柜",
  "kind": "cluster",
  "name": "电池簇 1",
  "soc": 86.2,
  "soh": 97.1,
  "voltage": 742.4,
  "current": 28.6,
  "temp": 29.4,
  "power": 18.2
}
```

`id`、`cabinetId`、`cabinetName`、`kind`、`name` 必填。测点字段可省略，数据库默认值为 `0`。未知字段会返回 `400`。

`GET /api/devices/:id` 返回设备快照。

`PATCH /api/devices/:id` 局部更新快照，不写遥测历史。请求体至少包含一个可更新字段。

`GET /api/devices/:id/latest` 优先读 Redis 哈希 `device:{id}:latest`，并带上 `"source": "redis"`。Redis 没有数据时回退到 `Device` 快照，`"source": "db"`。设备不存在返回 `404`。

`POST /api/devices/:id/telemetry` 写入一条遥测，并在同一事务里更新设备快照。`soc`、`soh`、`voltage`、`current`、`temp`、`power` 必填。`online`、`alarm`、`alarmText` 可选，只更新快照。

`GET /api/devices/:id/telemetry` 按 `createdAt` 降序返回历史。`GET /api/devices/:id/readings` 是同一接口。

查询参数：

- `limit`：默认 `100`，最大 `1000`
- `from`、`to`：ISO 时间，对应 `createdAt` 的闭区间

遥测 `id` 在 JSON 里是字符串，例如 `"1"`。

### 告警

`GET /api/alarms`

查询参数：`cabinetId`、`deviceId`、`acknowledged`（`true` | `false`）、`limit`（默认 `100`，最大 `500`）。按 `createdAt` 降序。

`POST /api/alarms`

```json
{
  "deviceId": "C01-cluster-1",
  "level": "warning",
  "cabinetId": "C01",
  "cabinetName": "1# 储能柜",
  "deviceName": "电池簇 1",
  "message": "SOC 过低"
}
```

`deviceId` 可省略或传 `null`。`id` 可省略，省略时由数据库生成。

`PATCH /api/alarms/:id/ack` 将 `acknowledged` 设为 `true`。
