"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const ddb = lib_dynamodb_1.DynamoDBDocumentClient.from(new client_dynamodb_1.DynamoDBClient({}));
function parseRange(r) {
    if (!r)
        return 7;
    if (r.endsWith('d'))
        return parseInt(r);
    if (r.endsWith('w'))
        return parseInt(r) * 7;
    if (r.endsWith('m'))
        return parseInt(r) * 30;
    return 7;
}
const handler = async (event) => {
    const videoId = event.queryStringParameters?.videoId;
    const range = event.queryStringParameters?.range || '7d';
    if (!videoId)
        return { statusCode: 400, body: 'videoId required' };
    const days = parseRange(range);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const table = process.env.TABLE_ANALYTICS;
    // 간단 구현: 파티션 videoId로 스캔(초기 버전)
    const res = await ddb.send(new lib_dynamodb_1.ScanCommand({
        TableName: table,
        FilterExpression: '#v = :vid AND #t >= :since',
        ExpressionAttributeNames: { '#v': 'videoId', '#t': 'eventTime' },
        ExpressionAttributeValues: { ':vid': videoId, ':since': since }
    }));
    const items = res.Items || [];
    let impressions = 0, plays = 0, pauses = 0, ended = 0;
    let progressBuckets = {};
    let totalWatch = 0;
    for (const it of items) {
        const et = it.eventType;
        if (et === 'impression')
            impressions++;
        if (et === 'play')
            plays++;
        if (et === 'pause')
            pauses++;
        if (et === 'ended')
            ended++;
        if (et === 'progress' && typeof it.currentTimeSec === 'number') {
            const bucket = Math.floor(it.currentTimeSec / 10) * 10;
            progressBuckets[bucket] = (progressBuckets[bucket] || 0) + 1;
            totalWatch += 5; // 5초 주기 가정
        }
    }
    const ctr = impressions ? plays / impressions : 0;
    const completion = plays ? ended / plays : 0;
    const peakTimes = Object.entries(progressBuckets)
        .map(([start, count]) => ({ tStart: Number(start), tEnd: Number(start) + 10, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
            impressions,
            clicks: plays,
            ctr,
            avgWatchTimeSec: totalWatch && plays ? Math.round(totalWatch / plays) : 0,
            completionRate: completion,
            peakTimes
        })
    };
};
exports.handler = handler;
