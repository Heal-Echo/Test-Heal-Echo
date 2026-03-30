// healecho-infra/lambda/user-sleep-log.ts
// 사용자 수면 기록 + 습관 체크 + 설정(습관 목록, 트래커 시작일) 저장/조회

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE = process.env.USER_SLEEP_LOG_TABLE_NAME as string;

/* ── 요청 바디 타입 ── */

type SleepLogBody = {
  date: string; // YYYY-MM-DD
  sleepTime: string; // HH:MM
  wakeTime: string; // HH:MM
  wakeCount: number;
  hadDream: boolean | null;
  locked: boolean;
  hadNap: boolean; // 어제의 낮잠 여부
  napStart: string; // HH:MM (낮잠 시작)
  napEnd: string; // HH:MM (낮잠 종료)
  sleepMood: string; // 어젯밤 수면 한마디 (감정 태그)
  sleepNote: string; // 수면에 영향을 준 한 가지
  checkedHabits: string[]; // 체크된 습관 이름 배열
};

type ConfigBody = {
  habitItems?: string[]; // 사용자 정의 습관 목록
  startDate?: string; // 트래커 시작일 (YYYY-MM-DD)
};

export const handler = async (event: any) => {
  const method = event.requestContext?.http?.method || event.httpMethod;
  const rawPath = event.rawPath || event.path || "";
  const headers = { "Content-Type": "application/json" };

  try {
    // JWT에서 사용자 ID 추출
    const claims = event.requestContext?.authorizer?.jwt?.claims;
    const userId = claims?.sub;

    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Unauthorized" }),
      };
    }

    const isConfigPath = rawPath.endsWith("/config");

    /* ──────────────────────────────────────
       POST /user/sleep-log/config — 설정 저장
       ────────────────────────────────────── */
    if (method === "POST" && isConfigPath) {
      const body: ConfigBody = JSON.parse(event.body || "{}");
      const now = new Date().toISOString();

      // 기존 CONFIG 조회
      const existing = await dynamo
        .get({
          TableName: TABLE,
          Key: { userId, logKey: "CONFIG" },
        })
        .promise();

      const item: any = {
        userId,
        logKey: "CONFIG",
        updatedAt: now,
        ...(existing.Item?.createdAt
          ? { createdAt: existing.Item.createdAt }
          : { createdAt: now }),
      };

      // habitItems가 전달되면 업데이트
      if (body.habitItems !== undefined) {
        item.habitItems = body.habitItems;
      } else if (existing.Item?.habitItems) {
        item.habitItems = existing.Item.habitItems;
      }

      // startDate가 전달되면 업데이트
      if (body.startDate !== undefined) {
        item.startDate = body.startDate;
      } else if (existing.Item?.startDate) {
        item.startDate = existing.Item.startDate;
      }

      await dynamo
        .put({ TableName: TABLE, Item: item })
        .promise();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, item }),
      };
    }

    /* ──────────────────────────────────────
       GET /user/sleep-log/config — 설정 조회
       ────────────────────────────────────── */
    if (method === "GET" && isConfigPath) {
      const res = await dynamo
        .get({
          TableName: TABLE,
          Key: { userId, logKey: "CONFIG" },
        })
        .promise();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ item: res.Item || null }),
      };
    }

    /* ──────────────────────────────────────
       POST /user/sleep-log — 수면 기록 저장
       ────────────────────────────────────── */
    if (method === "POST" && !isConfigPath) {
      const body: SleepLogBody = JSON.parse(event.body || "{}");

      if (!body.date) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ message: "date는 필수입니다." }),
        };
      }

      const now = new Date().toISOString();

      // 기존 기록 조회 (createdAt 보존용)
      const existing = await dynamo
        .get({
          TableName: TABLE,
          Key: { userId, logKey: body.date },
        })
        .promise();

      const item = {
        userId,
        logKey: body.date,
        sleepTime: body.sleepTime ?? "",
        wakeTime: body.wakeTime ?? "",
        wakeCount: body.wakeCount ?? 0,
        hadDream: body.hadDream ?? null,
        locked: body.locked ?? false,
        hadNap: body.hadNap ?? false,
        napStart: body.napStart ?? "",
        napEnd: body.napEnd ?? "",
        sleepMood: body.sleepMood ?? "",
        sleepNote: body.sleepNote ?? "",
        checkedHabits: body.checkedHabits ?? [],
        updatedAt: now,
        ...(existing.Item?.createdAt
          ? { createdAt: existing.Item.createdAt }
          : { createdAt: now }),
      };

      await dynamo
        .put({ TableName: TABLE, Item: item })
        .promise();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: true, item }),
      };
    }

    /* ──────────────────────────────────────
       GET /user/sleep-log — 수면 기록 조회
       query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
       ────────────────────────────────────── */
    if (method === "GET" && !isConfigPath) {
      const startDate = event.queryStringParameters?.startDate;
      const endDate = event.queryStringParameters?.endDate;

      let params: AWS.DynamoDB.DocumentClient.QueryInput;

      if (startDate && endDate) {
        params = {
          TableName: TABLE,
          KeyConditionExpression:
            "userId = :uid AND logKey BETWEEN :start AND :end",
          ExpressionAttributeValues: {
            ":uid": userId,
            ":start": startDate,
            ":end": endDate,
          },
        };
      } else if (startDate) {
        params = {
          TableName: TABLE,
          KeyConditionExpression:
            "userId = :uid AND logKey >= :start",
          ExpressionAttributeValues: {
            ":uid": userId,
            ":start": startDate,
          },
        };
      } else {
        // 전체 조회 (CONFIG 키 제외)
        params = {
          TableName: TABLE,
          KeyConditionExpression:
            "userId = :uid AND logKey BETWEEN :min AND :max",
          ExpressionAttributeValues: {
            ":uid": userId,
            ":min": "0000-00-00",
            ":max": "9999-99-99",
          },
        };
      }

      const res = await dynamo.query(params).promise();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ items: res.Items || [] }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ message: "Invalid request" }),
    };
  } catch (err) {
    console.error("user-sleep-log error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
