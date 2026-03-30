// healecho-infra/lambda/billing-charge-scheduler.ts
// ==========================================
// 매일 실행: 만료된 체험 + 결제 예정 구독 자동 결제
// EventBridge → 이 Lambda → billing-charge Lambda invoke
// ==========================================

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const lambdaClient = new AWS.Lambda();
const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE_NAME as string;
const PAYMENTS_TABLE = process.env.PAYMENTS_TABLE_NAME as string;
const BILLING_CHARGE_FUNCTION_NAME = process.env.BILLING_CHARGE_FUNCTION_NAME as string;

export const handler = async () => {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0]; // YYYY-MM-DD

  console.log("[BillingScheduler] Running for date:", todayStr);

  let chargeTargets: Array<{ userId: string; programId: string }> = [];

  try {
    // 1) 만료된 무료 체험 찾기 (trialEndDate <= 오늘)
    // SubscriptionsTable 전체 스캔 (소규모 서비스이므로 허용)
    const scanResult = await dynamo
      .scan({
        TableName: SUBSCRIPTIONS_TABLE,
        FilterExpression:
          "subscriptionType = :ft AND #s = :active AND trialEndDate <= :today",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":ft": "free_trial",
          ":active": "active",
          ":today": todayStr,
        },
      })
      .promise();

    if (scanResult.Items && scanResult.Items.length > 0) {
      console.log("[BillingScheduler] Found expired trials:", scanResult.Items.length);

      for (const item of scanResult.Items) {
        chargeTargets.push({
          userId: item.userId,
          programId: item.programId,
        });
      }
    }

    // 2) 유료 구독 중 결제 예정일이 지난 항목 찾기
    // PaymentsTable에서 nextChargeDate <= 오늘인 활성 빌링키 검색
    const paymentScan = await dynamo
      .scan({
        TableName: PAYMENTS_TABLE,
        FilterExpression:
          "begins_with(paymentId, :prefix) AND #s = :active AND nextChargeDate <= :today",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: {
          ":prefix": "billing_",
          ":active": "active",
          ":today": todayStr,
        },
      })
      .promise();

    if (paymentScan.Items && paymentScan.Items.length > 0) {
      // free_trial과 중복 방지: 이미 chargeTargets에 있는 userId+programId 제외
      const existingKeys = new Set(
        chargeTargets.map((t) => `${t.userId}__${t.programId}`)
      );

      for (const item of paymentScan.Items) {
        // paymentId = "billing_{programId}" → programId 추출
        const programId = item.paymentId.replace("billing_", "");
        const key = `${item.userId}__${programId}`;

        if (!existingKeys.has(key)) {
          chargeTargets.push({
            userId: item.userId,
            programId,
          });
        }
      }

      console.log("[BillingScheduler] Found recurring charges:", paymentScan.Items.length);
    }

    // 3) 각 대상에 대해 billing-charge Lambda invoke
    console.log("[BillingScheduler] Total charge targets:", chargeTargets.length);

    const results = await Promise.allSettled(
      chargeTargets.map((target) =>
        lambdaClient
          .invoke({
            FunctionName: BILLING_CHARGE_FUNCTION_NAME,
            InvocationType: "Event", // 비동기 호출
            Payload: JSON.stringify(target),
          })
          .promise()
      )
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log("[BillingScheduler] Invoked:", succeeded, "succeeded,", failed, "failed");

    return {
      statusCode: 200,
      body: JSON.stringify({
        date: todayStr,
        totalTargets: chargeTargets.length,
        invoked: succeeded,
        failed,
      }),
    };
  } catch (err) {
    console.error("[BillingScheduler] error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Scheduler execution failed" }),
    };
  }
};
