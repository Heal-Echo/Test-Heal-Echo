// healecho-infra/lambda/billing-info.ts
// ==========================================
// 결제 정보 조회 Lambda
// GET /user/billing/info?programId=autobalance
// 반환: { planType, cardLast4, cardCompany, nextChargeDate, status }
// ==========================================

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const PAYMENTS_TABLE = process.env.PAYMENTS_TABLE_NAME as string;

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

export const handler = async (event: any) => {
  console.log("[BillingInfo] event:", JSON.stringify(event));

  try {
    // userId 추출 (Cognito Authorizer)
    const userId =
      event.requestContext?.authorizer?.jwt?.claims?.sub ||
      event.requestContext?.authorizer?.claims?.sub;

    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    // programId 쿼리 파라미터
    const programId =
      event.queryStringParameters?.programId || "autobalance";

    // PaymentsTable에서 billing 레코드 조회
    const result = await dynamo
      .get({
        TableName: PAYMENTS_TABLE,
        Key: {
          userId,
          paymentId: `billing_${programId}`,
        },
      })
      .promise();

    if (!result.Item) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ found: false }),
      };
    }

    // billingKey는 보안상 반환하지 않음
    const {
      planType,
      cardLast4,
      cardCompany,
      nextChargeDate,
      status,
    } = result.Item;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        found: true,
        planType,
        cardLast4,
        cardCompany,
        nextChargeDate,
        status,
      }),
    };
  } catch (err) {
    console.error("[BillingInfo] error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
