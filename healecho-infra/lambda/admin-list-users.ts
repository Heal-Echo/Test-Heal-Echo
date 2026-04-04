import AWS from "aws-sdk";

const cognito = new AWS.CognitoIdentityServiceProvider();
const dynamo = new AWS.DynamoDB.DocumentClient();

const USER_POOL_ID = process.env.USER_POOL_ID as string;
const USERS_TABLE = process.env.USERS_TABLE_NAME as string;
const SUBSCRIPTIONS_TABLE = process.env.SUBSCRIPTIONS_TABLE_NAME as string;

type CognitoUser = {
  userId: string;
  name?: string;
  email?: string;
  phone?: string;
  createdAt?: string;
  status?: string;
  enabled?: boolean;
};

/** Cognito 사용자 속성을 간단한 객체로 변환 */
function parseCognitoUser(u: AWS.CognitoIdentityServiceProvider.UserType): CognitoUser {
  const attrs: Record<string, string> = {};
  for (const a of u.Attributes || []) {
    if (a.Name && a.Value) attrs[a.Name] = a.Value;
  }

  return {
    userId: attrs["sub"] || u.Username || "",
    name: attrs["name"] || attrs["custom:name"] || u.Username || "",
    email: attrs["email"] || "",
    phone: attrs["phone_number"] || "",
    createdAt: u.UserCreateDate?.toISOString() || "",
    status: u.UserStatus || "",
    enabled: u.Enabled ?? true,
  };
}

export const handler = async (event: any) => {
  try {
    const qs = event.queryStringParameters || {};
    const search = qs.search?.trim();
    const typeFilter = qs.type; // browser | browser_selected | free_trial | paid | free_stopped | paid_stopped

    // ── Cognito에서 사용자 목록 가져오기 ──
    let filterExpr: string | undefined;

    if (search && search.includes("@")) {
      filterExpr = `email = "${search}"`;
    } else if (search) {
      filterExpr = `name ^= "${search}"`;
    }

    const cognitoParams: AWS.CognitoIdentityServiceProvider.ListUsersRequest = {
      UserPoolId: USER_POOL_ID,
      Limit: 60,
      Filter: filterExpr,
    };

    const cognitoRes = await cognito.listUsers(cognitoParams).promise();
    const cognitoUsers = (cognitoRes.Users || []).map(parseCognitoUser);

    // ── DynamoDB에서 추가 데이터 병합 (구독 유형, 메모 등) ──
    // UsersTable: 프로필, 메모, 마지막 접속 등
    // SubscriptionsTable: 실시간 subscriptionType, programId (구독의 원본 데이터)
    const enriched = await Promise.all(
      cognitoUsers.map(async (cu) => {
        try {
          // 1) UsersTable에서 프로필/관리 데이터 조회
          const dbRes = await dynamo
            .get({ TableName: USERS_TABLE, Key: { userId: cu.userId } })
            .promise();

          const dbData = dbRes.Item || {};

          // 2) SubscriptionsTable에서 최신 구독 데이터 조회
          //    userId 파티션키로 query → 가장 최근 업데이트된 구독 사용
          let subType = "browser";
          let subProgramId: string | null = null;
          let subStatus = "active";
          let subStartDate: string | null = null;
          let subCurrentWeek: number | null = null;

          const subRes = await dynamo
            .query({
              TableName: SUBSCRIPTIONS_TABLE,
              KeyConditionExpression: "userId = :uid",
              ExpressionAttributeValues: { ":uid": cu.userId },
            })
            .promise();

          if (subRes.Items && subRes.Items.length > 0) {
            // 가장 최근 업데이트된 구독 레코드 선택
            const sorted = subRes.Items.sort((a, b) =>
              (b.updatedAt || "").localeCompare(a.updatedAt || "")
            );
            const latestSub = sorted[0];
            subType = latestSub.subscriptionType || "browser";
            subProgramId = latestSub.programId || null;
            subStatus = latestSub.status || "active";
            subStartDate = latestSub.startDate || null;
            subCurrentWeek = latestSub.currentWeek || null;
          }

          // 프로필 완료 판단:
          // 1) profileSetupDone 플래그
          // 2) 실제 프로필 데이터 존재 여부 (nickname, dietHabit 등)
          // 3) profileRepairedAt 존재 = repair Lambda가 처리 = 원래 profileSetupDone=true였던 사용자
          const hasProfileData = !!(
            dbData.wellnessGoal || dbData.nickname || dbData.dietHabit ||
            dbData.sleepHabit || dbData.experience || dbData.birthDate || dbData.gender
          );
          const isProfileDone = !!(dbData.profileSetupDone || hasProfileData || dbData.profileRepairedAt);

          return {
            ...cu,
            subscriptionType: subType,
            subscriptionStatus: subStatus,
            startDate: subStartDate,
            currentWeek: subCurrentWeek,
            lastLoginAt: dbData.lastLoginAt || null,
            adminMemo: dbData.adminMemo || "",
            programId: subProgramId,
            // 프로필 온보딩 필드 (전체)
            profileSetupDone: isProfileDone,
            wellnessGoal: dbData.wellnessGoal || null,
            dietHabit: dbData.dietHabit || null,
            sleepHabit: dbData.sleepHabit || null,
            experience: dbData.experience || null,
            nickname: dbData.nickname || null,
            birthDate: dbData.birthDate || null,
            gender: dbData.gender || null,
            marketingConsent: dbData.marketingConsent || false,
            profileUpdatedAt: dbData.profileUpdatedAt || null,
          };
        } catch {
          return {
            ...cu,
            subscriptionType: "browser",
            subscriptionStatus: "active",
          };
        }
      })
    );

    // ── 고객 유형 필터 (클라이언트 사이드) ──
    let items = enriched;
    if (typeFilter) {
      items = items.filter((u) => u.subscriptionType === typeFilter);
    }

    // 가입일 최신순 정렬
    items.sort((a, b) => {
      const da = a.createdAt || "";
      const db = b.createdAt || "";
      return db.localeCompare(da);
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, lastKey: null }),
    };
  } catch (err) {
    console.error("admin-list-users error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Failed to list users" }),
    };
  }
};
