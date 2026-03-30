// healecho-infra/lambda/user-withdraw.ts
// ==========================================
// 회원 탈퇴 요청 Lambda
// POST /user/withdraw
// 요청: { reason, confirmText, password }
// ==========================================
// 흐름:
//   1. 구독 상태 확인 → paid/free_trial이면 차단
//   2. 비밀번호 검증 (Cognito AdminInitiateAuth)
//   3. Cognito AdminDisableUser (로그인 차단)
//   4. UsersTable에 탈퇴 상태 기록
// ==========================================

import AWS from "aws-sdk";

const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamo = new AWS.DynamoDB.DocumentClient();

const USER_POOL_ID = process.env.USER_POOL_ID as string;
const USER_POOL_CLIENT_ID = process.env.USER_POOL_CLIENT_ID as string;
const USERS_TABLE = process.env.USERS_TABLE_NAME as string;
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
    const email = claims?.email;

    if (!userId || !email) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: "Unauthorized" }),
      };
    }

    const body = JSON.parse(event.body || "{}");
    const { reason, confirmText, password } = body;

    // ── 입력 검증 ──
    if (!reason || !confirmText || !password) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "reason, confirmText, password are required" }),
      };
    }

    if (confirmText !== "탈퇴합니다") {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "확인 텍스트가 일치하지 않습니다." }),
      };
    }

    // ── 1) 구독 상태 확인: paid/free_trial이면 탈퇴 차단 ──
    const subRes = await dynamo
      .query({
        TableName: SUBSCRIPTIONS_TABLE,
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": userId },
      })
      .promise();

    if (subRes.Items && subRes.Items.length > 0) {
      const activeSubscription = subRes.Items.find(
        (item) =>
          (item.subscriptionType === "paid" || item.subscriptionType === "free_trial") &&
          item.status === "active"
      );

      if (activeSubscription) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            message: "구독 해지 후 탈퇴해 주세요.",
            code: "ACTIVE_SUBSCRIPTION",
          }),
        };
      }
    }

    // ── 2) 비밀번호 검증 (Cognito AdminInitiateAuth) ──
    try {
      await cognito
        .adminInitiateAuth({
          UserPoolId: USER_POOL_ID,
          ClientId: USER_POOL_CLIENT_ID,
          AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
          AuthParameters: {
            USERNAME: email,
            PASSWORD: password,
          },
        })
        .promise();
    } catch (authErr: any) {
      console.error("[UserWithdraw] Password verification failed:", authErr.code);

      if (authErr.code === "NotAuthorizedException") {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({
            message: "비밀번호가 올바르지 않습니다.",
            code: "INVALID_PASSWORD",
          }),
        };
      }

      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          message: "인증에 실패했습니다.",
          code: authErr.code || "AUTH_FAILED",
        }),
      };
    }

    // ── 3) Cognito AdminDisableUser (로그인 차단) ──
    await cognito
      .adminDisableUser({
        UserPoolId: USER_POOL_ID,
        Username: userId,
      })
      .promise();

    console.log("[UserWithdraw] User disabled in Cognito:", userId);

    // ── 4) UsersTable에 탈퇴 상태 기록 ──
    const now = new Date().toISOString();

    await dynamo
      .update({
        TableName: USERS_TABLE,
        Key: { userId },
        UpdateExpression:
          "SET #s = :withdrawing, withdrawRequestedAt = :now, withdrawReason = :reason, updatedAt = :now",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":withdrawing": "withdrawing",
          ":now": now,
          ":reason": reason,
        },
      })
      .promise();

    console.log("[UserWithdraw] Withdrawal initiated for:", userId, "reason:", reason);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        message: "탈퇴 요청이 접수되었습니다. 30일 후 계정이 영구 삭제됩니다.",
        withdrawRequestedAt: now,
      }),
    };
  } catch (err: any) {
    console.error("[UserWithdraw] error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Internal server error" }),
    };
  }
};
