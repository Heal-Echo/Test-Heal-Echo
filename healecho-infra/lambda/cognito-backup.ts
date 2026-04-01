/**
 * Cognito 사용자 백업 Lambda
 * 매일 02:00 KST에 EventBridge가 실행
 * Cognito User Pool의 모든 사용자 정보를 S3에 JSON으로 백업
 */

import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const cognitoClient = new CognitoIdentityProviderClient({});
const s3Client = new S3Client({});

const USER_POOL_ID = process.env.USER_POOL_ID!;
const BACKUP_BUCKET = process.env.BACKUP_BUCKET!;
const BACKUP_PREFIX = process.env.BACKUP_PREFIX || "backups/cognito/";

export const handler = async () => {
  console.log("Cognito 사용자 백업 시작...");

  try {
    // 모든 사용자 수집 (페이지네이션 처리)
    const allUsers: any[] = [];
    let paginationToken: string | undefined;

    do {
      const command = new ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        Limit: 60, // AWS 최대값
        PaginationToken: paginationToken,
      });

      const response = await cognitoClient.send(command);

      if (response.Users) {
        for (const user of response.Users) {
          allUsers.push({
            username: user.Username,
            status: user.UserStatus,
            enabled: user.Enabled,
            createdAt: user.UserCreateDate?.toISOString(),
            lastModified: user.UserLastModifiedDate?.toISOString(),
            attributes: Object.fromEntries(
              (user.Attributes || []).map((attr) => [attr.Name, attr.Value])
            ),
          });
        }
      }

      paginationToken = response.PaginationToken;
    } while (paginationToken);

    // S3에 백업 파일 저장 (날짜별 폴더 구조)
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
    const timeStr = now.toISOString().replace(/[:.]/g, "-");
    const key = `${BACKUP_PREFIX}${dateStr}/users-${timeStr}.json`;

    const backupData = {
      backupDate: now.toISOString(),
      userPoolId: USER_POOL_ID,
      totalUsers: allUsers.length,
      users: allUsers,
    };

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BACKUP_BUCKET,
        Key: key,
        Body: JSON.stringify(backupData, null, 2),
        ContentType: "application/json",
      })
    );

    console.log(
      `✅ 백업 완료: ${allUsers.length}명 → s3://${BACKUP_BUCKET}/${key}`
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Cognito 백업 완료",
        totalUsers: allUsers.length,
        backupKey: key,
      }),
    };
  } catch (error) {
    console.error("❌ Cognito 백업 실패:", error);
    throw error;
  }
};
