import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const Req = z.object({
  videoId: z.string(),
  eventType: z.enum(['impression', 'play', 'pause', 'ended', 'progress']),
  currentTimeSec: z.number().optional(),
  durationSec: z.number().optional(),
  page: z.string().optional(),
  userAgent: z.string().optional()
});

export const handler = async (event: any) => {
  try {
    const body = Req.parse(JSON.parse(event.body || '{}'));
    const table = process.env.TABLE_ANALYTICS!;
    const ip = event.requestContext?.identity?.sourceIp || event.headers?.['X-Forwarded-For'] || '0.0.0.0';

    await ddb.send(new PutCommand({
      TableName: table,
      Item: {
        videoId: body.videoId,
        eventTime: new Date().toISOString(),
        eventType: body.eventType,
        currentTimeSec: body.currentTimeSec ?? null,
        durationSec: body.durationSec ?? null,
        page: body.page ?? null,
        ua: body.userAgent ?? null,
        ip: ip // 운영에서는 해시 권장
      }
    }));

    return { statusCode: 204, body: '' };
  } catch (e: any) {
    return { statusCode: 400, body: JSON.stringify({ message: e.message }) };
  }
};
