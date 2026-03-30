// healecho-infra/lambda/billing-charge.ts
// ==========================================
// 빌링키로 자동 결제 실행 Lambda
// EventBridge 또는 직접 invoke로 호출
// 입력: { userId, programId }
// ==========================================

import AWS from "aws-sdk";
import https from "https";

const dynamo = new AWS.DynamoDB.DocumentClient();
const PAYMENTS_TABLE = process.env.PAYMENTS_TABLE_NAME as string;
const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE_NAME as string;
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY as string;

/** 플랜별 가격 */
const PLAN_PRICES: Record<string, number> = {
  monthly: 56000,
  annual: 432000,
};

/** 플랜별 주문명 */
const PLAN_ORDER_NAMES: Record<string, string> = {
  monthly: "힐에코 웰니스 솔루션 (월간)",
  annual: "힐에코 웰니스 솔루션 (연간)",
};

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

/** 다음 결제일 계산 */
function calculateNextChargeDate(planType: string): string {
  const next = new Date();
  if (planType === "annual") {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next.toISOString().split("T")[0];
}

export const handler = async (event: any) => {
  try {
    // Lambda invoke 또는 EventBridge에서 직접 전달
    const { userId, programId } = typeof event.body === "string"
      ? JSON.parse(event.body)
      : event;

    if (!userId || !programId) {
      console.error("[BillingCharge] Missing userId or programId");
      return { statusCode: 400, body: JSON.stringify({ error: "userId and programId required" }) };
    }

    console.log("[BillingCharge] Processing charge for:", userId, programId);

    // 1) PaymentsTable에서 빌링키 조회
    const billingResult = await dynamo
      .get({
        TableName: PAYMENTS_TABLE,
        Key: { userId, paymentId: `billing_${programId}` },
      })
      .promise();

    if (!billingResult.Item) {
      console.error("[BillingCharge] No billing record found for:", userId, programId);
      return { statusCode: 404, body: JSON.stringify({ error: "No billing key found" }) };
    }

    const billing = billingResult.Item;

    if (billing.status === "cancelled") {
      console.log("[BillingCharge] Billing is cancelled, skipping:", userId);
      return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: "cancelled" }) };
    }

    const { billingKey, customerKey, planType } = billing;
    const amount = PLAN_PRICES[planType] || PLAN_PRICES.monthly;
    const orderName = PLAN_ORDER_NAMES[planType] || PLAN_ORDER_NAMES.monthly;

    // 2) 주문 ID 생성
    const orderId = `healecho_${userId.substring(0, 8)}_${Date.now()}`;

    // 3) 토스 API: 결제 실행
    console.log("[BillingCharge] Charging:", amount, "won for order:", orderId);

    const tossResult = await callTossApi(
      "POST",
      `/v1/billing/${billingKey}`,
      {
        customerKey,
        amount,
        orderId,
        orderName,
      }
    );

    const now = new Date().toISOString();

    // 4) PaymentsTable에 결제 내역 저장
    await dynamo
      .put({
        TableName: PAYMENTS_TABLE,
        Item: {
          userId,
          paymentId: `txn_${orderId}`,
          orderId,
          paymentKey: tossResult.paymentKey || "",
          amount,
          status: "success",
          chargedAt: now,
        },
      })
      .promise();

    // 5) 다음 결제일 계산 & PaymentsTable 빌링키 레코드 업데이트
    const nextChargeDate = calculateNextChargeDate(planType);

    await dynamo
      .update({
        TableName: PAYMENTS_TABLE,
        Key: { userId, paymentId: `billing_${programId}` },
        UpdateExpression: "SET nextChargeDate = :ncd, updatedAt = :now",
        ExpressionAttributeValues: {
          ":ncd": nextChargeDate,
          ":now": now,
        },
      })
      .promise();

    // 6) SubscriptionsTable 갱신: free_trial → paid
    const existingSub = await dynamo
      .get({
        TableName: SUBSCRIPTIONS_TABLE,
        Key: { userId, programId },
      })
      .promise();

    if (existingSub.Item) {
      await dynamo
        .update({
          TableName: SUBSCRIPTIONS_TABLE,
          Key: { userId, programId },
          UpdateExpression: "SET subscriptionType = :st, #s = :active, updatedAt = :now",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":st": "paid",
            ":active": "active",
            ":now": now,
          },
        })
        .promise();
    }

    console.log("[BillingCharge] Charge successful:", orderId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        orderId,
        amount,
        nextChargeDate,
      }),
    };
  } catch (err: any) {
    console.error("[BillingCharge] error:", err);

    // 결제 실패 시 에러 기록
    try {
      const { userId, programId } = typeof event.body === "string"
        ? JSON.parse(event.body)
        : event;

      if (userId) {
        const now = new Date().toISOString();
        const failOrderId = `fail_${userId.substring(0, 8)}_${Date.now()}`;

        await dynamo
          .put({
            TableName: PAYMENTS_TABLE,
            Item: {
              userId,
              paymentId: `txn_${failOrderId}`,
              orderId: failOrderId,
              paymentKey: "",
              amount: 0,
              status: "failed",
              chargedAt: now,
              errorCode: err.code || "UNKNOWN",
              errorMessage: err.message || "결제 실패",
            },
          })
          .promise();
      }
    } catch (logErr) {
      console.error("[BillingCharge] Failed to log error:", logErr);
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        ok: false,
        error: err.message || "결제 실행 실패",
      }),
    };
  }
};
