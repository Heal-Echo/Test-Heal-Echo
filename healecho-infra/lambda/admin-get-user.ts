import AWS from "aws-sdk";

const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamo = new AWS.DynamoDB.DocumentClient();

const USER_POOL_ID = process.env.USER_POOL_ID as string;
const USERS_TABLE = process.env.USERS_TABLE_NAME as string;
const WATCH_TABLE = process.env.WATCH_RECORDS_TABLE_NAME as string;
const PREFERENCES_TABLE = process.env.USER_PREFERENCES_TABLE_NAME as string;

export const handler = async (event: any) => {
  try {
    const userId = event.pathParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "userId is required" }),
      };
    }

    // ── Cognito에서 사용자 찾기 (sub = userId) ──
    let cognitoData: Record<string, any> = {};

    try {
      const cognitoRes = await cognito
        .listUsers({
          UserPoolId: USER_POOL_ID,
          Filter: `sub = "${userId}"`,
          Limit: 1,
        })
        .promise();

      const cu = cognitoRes.Users?.[0];
      if (cu) {
        const attrs: Record<string, string> = {};
        for (const a of cu.Attributes || []) {
          if (a.Name && a.Value) attrs[a.Name] = a.Value;
        }
        cognitoData = {
          userId: attrs["sub"] || cu.Username || "",
          name: attrs["name"] || attrs["custom:name"] || cu.Username || "",
          email: attrs["email"] || "",
          phone: attrs["phone_number"] || "",
          createdAt: cu.UserCreateDate?.toISOString() || "",
          cognitoStatus: cu.UserStatus || "",
          enabled: cu.Enabled ?? true,
        };
      }
    } catch (e) {
      console.warn("Cognito lookup failed:", e);
    }

    // ── DynamoDB에서 추가 데이터 ──
    const dbRes = await dynamo
      .get({ TableName: USERS_TABLE, Key: { userId } })
      .promise();

    const dbData = dbRes.Item || {};

    // 프로필 완료 판단:
    // 1) profileSetupDone 플래그
    // 2) 실제 프로필 데이터 존재 여부
    // 3) profileRepairedAt 존재 = repair Lambda가 처리한 사용자 = 원래 완료였음
    const hasProfileData = !!(
      dbData.wellnessGoal || dbData.nickname || dbData.dietHabit ||
      dbData.sleepHabit || dbData.experience || dbData.birthDate || dbData.gender
    );

    // 병합: Cognito 기본 정보 + DynamoDB 추가 정보
    const user: Record<string, any> = {
      ...cognitoData,
      ...dbData,
      userId,
      // Cognito 값 우선 (이름, 이메일은 Cognito가 원본)
      name: cognitoData.name || dbData.name || "",
      email: cognitoData.email || dbData.email || "",
      phone: cognitoData.phone || dbData.phone || "",
      createdAt: cognitoData.createdAt || dbData.createdAt || "",
      subscriptionType: dbData.subscriptionType || "browser",
      status: dbData.status || "active",
      profileSetupDone: !!(dbData.profileSetupDone || hasProfileData || dbData.profileRepairedAt),
    };

    if (!cognitoData.userId && !dbRes.Item) {
      return {
        statusCode: 404,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "User not found" }),
      };
    }

    // ── UserPreferencesTable에서 솔루션 선택 정보 조회 ──
    try {
      const prefsRes = await dynamo
        .get({ TableName: PREFERENCES_TABLE, Key: { userId } })
        .promise();

      if (prefsRes.Item) {
        const prefs = prefsRes.Item;
        if (prefs.weekly_habit_selected_program) {
          user.programId = prefs.weekly_habit_selected_program;
        }
        if (prefs.weekly_habit_program_confirmed === "true") {
          user.programConfirmed = true;
        }
      }
    } catch (e) {
      console.warn("Preferences lookup failed:", e);
    }

    // ── 시청 기록 (최근 90일) ──
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const sinceDate = ninetyDaysAgo.toISOString().split("T")[0];

    const watchRes = await dynamo
      .query({
        TableName: WATCH_TABLE,
        KeyConditionExpression: "userId = :uid AND watchDate >= :since",
        ExpressionAttributeValues: {
          ":uid": userId,
          ":since": sinceDate,
        },
        ScanIndexForward: false,
      })
      .promise();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user,
        watchRecords: watchRes.Items || [],
      }),
    };
  } catch (err) {
    console.error("admin-get-user error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Failed to get user" }),
    };
  }
};
