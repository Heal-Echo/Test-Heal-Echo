// healecho-infra/lambda/billing-update-key.ts
// ==========================================
// 결제 수단 변경 (빌링키 교체) Lambda
// POST /user/billing/update-key
// 요청: { authKey, customerKey, programId }
//
// ★ issue-key와의 차이:
//   - PaymentsTable의 빌링키·카드 정보만 업데이트
//   - SubscriptionsTable은 일절 건드리지 않음
//   - 구독 상태(free_trial, paid 등)를 변경하지 않음
// ==========================================

import AWS from "aws-sdk";
import https from "https";

const dynamo = new AWS.DynamoDB.DocumentClient();
const PAYMENTS_TABLE = process.env.PAYMENTS_TABLE_NAME as string;
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY as string;

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

/** 토스 issuerCode → 카드사명 매핑 (billing-issue-key.ts와 동일) */
const ISSUER_CODE_MAP: Record<string, string> = {
  "3K": "기업비씨",
  "46": "광주",
  "71": "롯데",
  "30": "산업",
  "31": "BC",
  "51": "삼성",
  "38": "새마을",
  "41": "신한",
  "62": "신협",
  "36": "씨티",
  "33": "우리",
  "W1": "우리BC",
  "37": "우체국",
  "39": "저축",
  "35": "전북",
  "42": "제주",
  "15": "카카오뱅크",
  "3A": "케이뱅크",
  "24": "토스뱅크",
  "21": "하나",
  "61": "현대",
  "11": "KB국민",
  "91": "NH농협",
  "34": "Sh수협",
};

function resolveCardCompany(cardInfo: Record<string, any>): string {
  if (cardInfo.company) return cardInfo.company;
  if (cardInfo.issuerCode && ISSUER_CODE_MAP[cardInfo.issuerCode]) {
    return ISSUER_CODE_MAP[cardInfo.issuerCode];
  }
  if (cardInfo.acquirerCode && ISSUER_CODE_MAP[cardInfo.acquirerCode]) {
    return ISSUER_CODE_MAP[cardInfo.acquirerCode];
  }
  return "";
}

function resolveCardLast4(cardInfo: Record<string, any>): string {
  const num = cardInfo.number || "";
  if (!num) return "";
  const last4 = num.slice(-4);
  const digits = last4.replace(/\*/g, "");
  return digits.length >= 3 ? digits : last4;
}

/** 토스 API 호출 헬퍼 */
function callTossApi(
  method: string,
  path: string,
  body?: Record<string, any>
): Promise<any> {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64");
    const postData = body ? JSON.stringify(body) : "";

    const options = {
      hostname: "api.tosspayments.com",
      port: 443,
      path,
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject({ statusCode: res.statusCode, ...parsed });
          }
        } catch {
          reject({ statusCode: res.statusCode, raw: data });
        }
      });
    });

    req.on("error", reject);
    if (postData) req.write(postData);
    req.end();
  });
}

export const handler = async (event: any) => {
  try {
    const claims = event.requestContext?.authorizer?.jwt?.claims;
    const userId = claims?.sub;

    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Unauthorized" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const { authKey, customerKey, programId } = body;

    if (!authKey || !customerKey || !programId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "authKey, customerKey, programId are required" }),
      };
    }

    // 1) 기존 결제 레코드 존재 확인
    const existing = await dynamo
      .get({
        TableName: PAYMENTS_TABLE,
        Key: { userId, paymentId: `billing_${programId}` },
      })
      .promise();

    if (!existing.Item) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          ok: false,
          error: "기존 결제 수단이 없습니다. 먼저 구독을 시작해주세요.",
        }),
      };
    }

    // 2) 토스 API: 새 빌링키 발급
    console.log("[BillingUpdateKey] Requesting new billing key for user:", userId);

    const tossResult = await callTossApi(
      "POST",
      "/v1/billing/authorizations/issue",
      { authKey, customerKey }
    );

    const newBillingKey = tossResult.billingKey;
    const cardInfo = tossResult.card || {};

    console.log("[BillingUpdateKey] New billing key issued:", newBillingKey?.substring(0, 10) + "...");

    // 3) PaymentsTable 업데이트 (빌링키 + 카드 정보만 교체)
    const now = new Date().toISOString();

    await dynamo
      .update({
        TableName: PAYMENTS_TABLE,
        Key: { userId, paymentId: `billing_${programId}` },
        UpdateExpression: "SET billingKey = :bk, customerKey = :ck, cardLast4 = :cl, cardCompany = :cc, updatedAt = :ua",
        ExpressionAttributeValues: {
          ":bk": newBillingKey,
          ":ck": customerKey,
          ":cl": resolveCardLast4(cardInfo),
          ":cc": resolveCardCompany(cardInfo),
          ":ua": now,
        },
      })
      .promise();

    console.log("[BillingUpdateKey] Payment method updated for user:", userId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        cardLast4: resolveCardLast4(cardInfo),
        cardCompany: resolveCardCompany(cardInfo),
      }),
    };
  } catch (err: any) {
    console.error("[BillingUpdateKey] error:", err);

    if (err.code || err.message) {
      return {
        statusCode: err.statusCode || 500,
        headers,
        body: JSON.stringify({
          ok: false,
          error: err.message || "결제 수단 변경 실패",
          code: err.code || "UNKNOWN",
        }),
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        ok: false,
        error: "Internal server error",
      }),
    };
  }
};
