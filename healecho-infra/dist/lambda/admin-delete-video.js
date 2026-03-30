"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const s3 = new client_s3_1.S3Client({});
const ddb = lib_dynamodb_1.DynamoDBDocumentClient.from(new client_dynamodb_1.DynamoDBClient({}));
const handler = async (event) => {
    const table = process.env.TABLE_VIDEOS;
    const bucket = process.env.BUCKET_VIDEOS;
    const videoId = event.pathParameters?.videoId;
    if (!videoId)
        return { statusCode: 400, body: 'videoId required' };
    const got = await ddb.send(new lib_dynamodb_1.GetCommand({ TableName: table, Key: { videoId } }));
    const key = got.Item?.key;
    if (key) {
        await s3.send(new client_s3_1.DeleteObjectCommand({ Bucket: bucket, Key: key }));
    }
    await ddb.send(new lib_dynamodb_1.DeleteCommand({ TableName: table, Key: { videoId } }));
    return { statusCode: 204, body: '' };
};
exports.handler = handler;
