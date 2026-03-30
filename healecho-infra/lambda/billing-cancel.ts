// healecho-infra/lambda/billing-cancel.ts
// ==========================================
// 구독 해지 Lambda
// POST /user/billing/cancel
// 요청: { programId, cancelReason?, cancelFeedback? }
// ==========================================

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const PAYMENTS_TABLE = process.env.PAYMENTS_TABLE_NAME as string;
const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE_NAME as string;

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

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
    const { programId, cancelReason, cancelFeedback } = body;

    if (!programId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "programId is required" }),
      };
    }

    const now = new Date().toISOString();

    // 1) PaymentsTable: 빌링키 상태를 "cancelled"로 변경
    const billingResult = await dynamo
      .get({
        TableName: PAYMENTS_TABLE,
        Key: { userId, paymentId: `billing_${programId}` },
      })
      .promise();

    if (billingResult.Item) {
      await dynamo
        .update({
          TableName: PAYMENTS_TABLE,
          Key: { userId, paymentId: `billing_${programId}` },
          UpdateExpression: "SET #s = :cancelled, updatedAt = :now",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":cancelled": "cancelled",
            ":now": now,
          },
        })
        .promise();

      console.log("[BillingCancel] Billing key cancelled for:", userId, programId);
    }

    // 2) SubscriptionsTable: status를 "cancelled"로 변경 + subscriptionType 전환
    //    free_trial → free_stopped / paid → paid_stopped
    const subResult = await dynamo
      .get({
        TableName: SUBSCRIPTIONS_TABLE,
        Key: { userId, programId },
      })
      .promise();

    if (subResult.Item) {
      const currentType = subResult.Item.subscriptionType || "browser";
      let newType = currentType;

      if (currentType === "free_trial") {
        newType = "free_stopped";
      } else if (currentType === "paid") {
        newType = "paid_stopped";
      }

      // 해지 사유 필드 구성 (선택적 — 프론트엔드에서 전달하지 않아도 기존 로직 동작)
      let updateExpr = "SET #s = :cancelled, subscriptionType = :newType, updatedAt = :now, cancelledAt = :now";
      const exprNames: Record<string, string> = { "#s": "status" };
      const exprValues: Record<string, any> = {
        ":cancelled": "cancelled",
        ":newType": newType,
        ":now": now,
      };

      if (cancelReason) {
        updateExpr += ", cancelReason = :cr";
        exprValues[":cr"] = cancelReason;
      }
      if (cancelFeedback) {
        updateExpr += ", cancelFeedback = :cf";
        exprValues[":cf"] = cancelFeedback;
      }

      await dynamo
        .update({
          TableName: SUBSCRIPTIONS_TABLE,
          Key: { userId, programId },
          UpdateExpression: updateExpr,
          ExpressionAttributeNames: exprNames,
          ExpressionAttributeValues: exprValues,
        })
        .promise();

      console.log("[BillingCancel] Subscription cancelled for:", userId, programId, "type:", currentType, "→", newType, "reason:", cancelReason || "none");
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        message: "구독이 해지되었습니다. 현재 결제 기간이 끝날 때까지 이용 가능합니다.",
      }),
    };
  } catch (err) {
    console.error("[BillingCancel] error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
