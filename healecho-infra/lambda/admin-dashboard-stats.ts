// healecho-infra/lambda/admin-dashboard-stats.ts
// ==========================================
// 관리자 대시보드 통계 집계 Lambda
// GET /admin/dashboard-stats — 전체 회원 프로필 통계
// ==========================================

import AWS from "aws-sdk";

const dynamo = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();
const USERS_TABLE = process.env.USERS_TABLE_NAME as string;
const USER_POOL_ID = process.env.USER_POOL_ID as string;

export const handler = async (event: any) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    // ── 1. Cognito에서 전체 회원 수 + 최근 7일 가입 추이 ──
    let totalCognitoUsers = 0;
    let paginationToken: string | undefined;
    const recentSignups: string[] = [];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    do {
      const res = await cognito
        .listUsers({
          UserPoolId: USER_POOL_ID,
          Limit: 60,
          PaginationToken: paginationToken,
        })
        .promise();

      const users = res.Users || [];
      totalCognitoUsers += users.length;

      for (const u of users) {
        if (u.UserCreateDate && u.UserCreateDate >= sevenDaysAgo) {
          const dateStr = u.UserCreateDate.toISOString().split("T")[0];
          recentSignups.push(dateStr);
        }
      }

      paginationToken = res.PaginationToken;
    } while (paginationToken);

    // ── 2. DynamoDB에서 프로필 데이터 집계 ──
    let profileCompleted = 0;
    const goalCounts: Record<string, number> = {};
    const dietCounts: Record<string, number> = {};
    const sleepCounts: Record<string, number> = {};
    const expCounts: Record<string, number> = {};
    const genderCounts: Record<string, number> = {};
    let marketingConsented = 0;
    let pushEnabled = 0;
    let emailEnabled = 0;

    let lastEvaluatedKey: any;
    do {
      const scanRes = await dynamo
        .scan({
          TableName: USERS_TABLE,
          ExclusiveStartKey: lastEvaluatedKey,
        })
        .promise();

      for (const item of scanRes.Items || []) {
        if (item.profileSetupDone) {
          profileCompleted++;

          if (item.wellnessGoal) {
            goalCounts[item.wellnessGoal] = (goalCounts[item.wellnessGoal] || 0) + 1;
          }
          if (item.dietHabit) {
            dietCounts[item.dietHabit] = (dietCounts[item.dietHabit] || 0) + 1;
          }
          if (item.sleepHabit) {
            sleepCounts[item.sleepHabit] = (sleepCounts[item.sleepHabit] || 0) + 1;
          }
          if (item.experience) {
            expCounts[item.experience] = (expCounts[item.experience] || 0) + 1;
          }
          if (item.gender) {
            genderCounts[item.gender] = (genderCounts[item.gender] || 0) + 1;
          }
          if (item.marketingConsent) marketingConsented++;
          if (item.pushNotification) pushEnabled++;
          if (item.emailNotification) emailEnabled++;
        }
      }

      lastEvaluatedKey = scanRes.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    // ── 3. 최근 7일 가입 추이 ──
    const signupTrend: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      signupTrend[d.toISOString().split("T")[0]] = 0;
    }
    for (const dateStr of recentSignups) {
      if (signupTrend[dateStr] !== undefined) {
        signupTrend[dateStr]++;
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        totalUsers: totalCognitoUsers,
        profileCompleted,
        profileIncomplete: totalCognitoUsers - profileCompleted,
        goalDistribution: goalCounts,
        dietDistribution: dietCounts,
        sleepDistribution: sleepCounts,
        experienceDistribution: expCounts,
        genderDistribution: genderCounts,
        marketingConsented,
        pushEnabled,
        emailEnabled,
        signupTrend,
      }),
    };
  } catch (err) {
    console.error("admin-dashboard-stats error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: "Failed to get dashboard stats" }),
    };
  }
};
