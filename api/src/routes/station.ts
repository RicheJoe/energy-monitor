import { Router } from 'express';
import { prisma } from '../db';

const router = Router();

router.get('/curve', async (_req, res) => {
  const rows = await prisma.$queryRaw<Array<{ bucket: string; charge: number; discharge: number }>>`
    WITH samples AS (
      SELECT
        t."deviceId",
        t.power,
        t."createdAt",
        date_trunc('hour', timezone('Asia/Shanghai', t."createdAt" AT TIME ZONE 'UTC'))
          + FLOOR(EXTRACT(MINUTE FROM timezone('Asia/Shanghai', t."createdAt" AT TIME ZONE 'UTC')) / 30)
            * INTERVAL '30 minutes' AS bucket
      FROM "Telemetry" t
      JOIN "Device" d ON d.id = t."deviceId"
      WHERE d.kind::text = 'pcs'
        AND timezone('Asia/Shanghai', t."createdAt" AT TIME ZONE 'UTC')
          >= date_trunc('day', timezone('Asia/Shanghai', NOW()))
    ),
    latest AS (
      SELECT DISTINCT ON ("deviceId", bucket) power, bucket
      FROM samples
      ORDER BY "deviceId", bucket, "createdAt" DESC
    )
    SELECT
      to_char(bucket, 'YYYY-MM-DD"T"HH24:MI:SS') || '+08:00' AS bucket,
      COALESCE(SUM(CASE WHEN power < 0 THEN -power ELSE 0 END), 0)::float AS charge,
      COALESCE(SUM(CASE WHEN power > 0 THEN power ELSE 0 END), 0)::float AS discharge
    FROM latest
    GROUP BY bucket
    ORDER BY bucket
  `;

  res.json(
    rows.map((row) => ({
      bucket: row.bucket,
      charge: Number(row.charge),
      discharge: Number(row.discharge),
    }))
  );
});

export default router;
