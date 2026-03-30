"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const zod_1 = require("zod");
const ddb = lib_dynamodb_1.DynamoDBDocumentClient.from(new client_dynamodb_1.DynamoDBClient({}));
const Req = zod_1.z.object({
    videoId: zod_1.z.string(),
    eventType: zod_1.z.enum(['impression', 'play', 'pause', 'ended', 'progress']),
    currentTimeSec: zod_1.z.number().optional(),
    durationSec: zod_1.z.number().optional(),
    page: zod_1.z.string().optional(),
    userAgent: zod_1.z.string().optional()
});
const handler = async (event) => {
    try {
        const body = Req.parse(JSON.parse(event.body || '{}'));
        const table = process.env.TABLE_ANALYTICS;
        const ip = event.requestContext?.identity?.sourceIp || event.headers?.['X-Forwarded-For'] || '0.0.0.0';
        await ddb.send(new lib_dynamodb_1.PutCommand({
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
    }
    catch (e) {
        return { statusCode: 400, body: JSON.stringify({ message: e.message }) };
    }
};
exports.handler = handler;
