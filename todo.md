energy-monitor/
├── docker-compose.yml
├── .env
├── api/                    # Node.js 后端
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/schema.prisma
│   └── src/
│       ├── index.ts
│       ├── db.ts
│       ├── redis.ts
│       ├── mqtt.ts          # MQTT 订阅
│       ├── queue.ts         # RabbitMQ 生产/消费
│       ├── ws.ts            # WebSocket 推送
│       ├── routes/devices.ts
│       └── middleware/errorHandler.ts
├── simulator/               # 设备模拟器
│   ├── Dockerfile
│   └── index.js             # 定时发 MQTT 消息
└── web/                     # 前端大屏
    └── (Vite + vue)



Node.js 全栈	Express + TypeScript Vue 前端
MQTT 协议	设备用 MQTT 上报数据，后端订阅
PostgreSQL	存历史数据、设备表、告警表
Redis	缓存设备最新状态、做限流
RabbitMQ	接收 MQTT 消息后入队，消费者写库
Docker	一键起 db/redis/rabbitmq/api/web
性能/安全/可扩展	限流、心跳检测、消息削峰、优雅关闭