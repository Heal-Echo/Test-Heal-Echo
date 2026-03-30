// healecho-infra/lambda/billing-issue-key.ts
// ==========================================
// 빌링키 발급 + 무료 체험 시작 Lambda
// POST /user/billing/issue-key
// 요청: { authKey, customerKey, programId, planType }
// ==========================================

import AWS from "aws-sdk";
import https from "https";

const dynamo = new AWS.DynamoDB.DocumentClient();
const PAYMENTS_TABLE = process.env.PAYMENTS_TABLE_NAME as string;
const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE_NAME as string;
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY as string;

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

/** 토스 issuerCode → 카드사명 매핑 */
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
  // 1) card.company가 있으면 우선 사용 (결제 승인 응답 등)
  if (cardInfo.company) return cardInfo.company;
  // 2) issuerCode로 매핑 (빌링키 발급 응답)
  if (cardInfo.issuerCode && ISSUER_CODE_MAP[cardInfo.issuerCode]) {
    return ISSUER_CODE_MAP[cardInfo.issuerCode];
  }
  // 3) acquirerCode 폴백
  if (cardInfo.acquirerCode && ISSUER_CODE_MAP[cardInfo.acquirerCode]) {
    return ISSUER_CODE_MAP[cardInfo.acquirerCode];
  }
  return "";
}

/** 마스킹된 카드번호에서 끝 4자리 추출 (예: "433012******018*" → "018*") */
function resolveCardLast4(cardInfo: Record<string, any>): string {
  const num = cardInfo.number || "";
  if (!num) return "";
  // 카드번호 뒤 4자리 영역만 추출 (마스킹 포함)
  const last4 = num.slice(-4);
  // 뒤 4자리 영역에서 숫자만 추출 (마스킹 문자 제거)
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

    const body = JSON.parse(event.body || "{}");
    const { authKey, customerKey, programId, planType } = body;

    if (!authKey || !customerKey || !programId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "authKey, customerKey, programId are required" }),
      };
    }

    const validPlanType = planType === "annual" ? "annual" : "monthly";

    // 1) 토스 API: 빌링키 발급
    console.log("[BillingIssueKey] Requesting billing key for user:", userId);

    const tossResult = await callTossApi(
      "POST",
      "/v1/billing/authorizations/issue",
      { authKey, customerKey }
    );

    const billingKey = tossResult.billingKey;
    const cardInfo = tossResult.card || {};

    console.log("[BillingIssueKey] Billing key issued:", billingKey?.substring(0, 10) + "...");

    // 2) PaymentsTable에 빌링키 레코드 저장
    const now = new Date().toISOString();

    // 무료 체험 종료일 = 지금 + 7일
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);
    const trialEndDate = trialEnd.toISOString().split("T")[0]; // YYYY-MM-DD

    // 첫 결제 예정일 = 체험 종료일
    const nextChargeDate = trialEndDate;

    await dynamo
      .put({
        TableName: PAYMENTS_TABLE,
        Item: {
          userId,
          paymentId: `billing_${programId}`,
          billingKey,
          customerKey,
          cardLast4: resolveCardLast4(cardInfo),
          cardCompany: resolveCardCompany(cardInfo),
          planType: validPlanType,
          status: "active",
          nextChargeDate,
          createdAt: now,
          updatedAt: now,
        },
      })
      .promise();

    // 3) SubscriptionsTable 갱신: browser / browser_selected → free_trial
    const startDate = now.split("T")[0]; // YYYY-MM-DD

    // 기존 레코드 조회 (createdAt 보존)
    const existing = await dynamo
      .get({
        TableName: SUBSCRIPTIONS_TABLE,
        Key: { userId, programId },
      })
      .promise();

    await dynamo
      .put({
        TableName: SUBSCRIPTIONS_TABLE,
        Item: {
          userId,
          programId,
          subscriptionType: "free_trial",
          startDate,
          currentWeek: 1,
          status: "active",
          pausedAt: null,
          trialEndDate,
          createdAt: existing.Item?.createdAt || now,
          updatedAt: now,
        },
      })
      .promise();

    console.log("[BillingIssueKey] Subscription updated to free_trial for user:", userId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        billingKey: billingKey?.substring(0, 10) + "...", // 부분만 반환
        cardLast4: resolveCardLast4(cardInfo),
        cardCompany: resolveCardCompany(cardInfo),
        subscription: {
          subscriptionType: "free_trial",
          startDate,
          trialEndDate,
        },
      }),
    };
  } catch (err: any) {
    console.error("[BillingIssueKey] error:", err);

    // 토스 API 에러인 경우
    if (err.code || err.message) {
      return {
        statusCode: err.statusCode || 500,
        headers,
        body: JSON.stringify({
          ok: false,
          error: err.message || "빌링키 발급 실패",
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
