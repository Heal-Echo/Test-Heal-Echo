import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

const s3 = new S3Client({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const handler = async (event: any) => {
  const table = process.env.TABLE_VIDEOS!;
  const bucket = process.env.BUCKET_VIDEOS!;
  const videoId = event.pathParameters?.videoId;

  if (!videoId) return { statusCode: 400, body: 'videoId required' };

  const got = await ddb.send(new GetCommand({ TableName: table, Key: { videoId } }));
  const key = got.Item?.key;
  if (key) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
  await ddb.send(new DeleteCommand({ TableName: table, Key: { videoId } }));

  return { statusCode: 204, body: '' };
};
