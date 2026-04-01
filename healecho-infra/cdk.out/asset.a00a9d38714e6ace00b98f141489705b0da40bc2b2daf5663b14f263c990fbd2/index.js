"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lambda/cognito-backup.ts
var cognito_backup_exports = {};
__export(cognito_backup_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(cognito_backup_exports);
var import_client_cognito_identity_provider = require("@aws-sdk/client-cognito-identity-provider");
var import_client_s3 = require("@aws-sdk/client-s3");
var cognitoClient = new import_client_cognito_identity_provider.CognitoIdentityProviderClient({});
var s3Client = new import_client_s3.S3Client({});
var USER_POOL_ID = process.env.USER_POOL_ID;
var BACKUP_BUCKET = process.env.BACKUP_BUCKET;
var BACKUP_PREFIX = process.env.BACKUP_PREFIX || "backups/cognito/";
var handler = async () => {
  console.log("Cognito \uC0AC\uC6A9\uC790 \uBC31\uC5C5 \uC2DC\uC791...");
  try {
    const allUsers = [];
    let paginationToken;
    do {
      const command = new import_client_cognito_identity_provider.ListUsersCommand({
        UserPoolId: USER_POOL_ID,
        Limit: 60,
        // AWS 최대값
        PaginationToken: paginationToken
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
            )
          });
        }
      }
      paginationToken = response.PaginationToken;
    } while (paginationToken);
    const now = /* @__PURE__ */ new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toISOString().replace(/[:.]/g, "-");
    const key = `${BACKUP_PREFIX}${dateStr}/users-${timeStr}.json`;
    const backupData = {
      backupDate: now.toISOString(),
      userPoolId: USER_POOL_ID,
      totalUsers: allUsers.length,
      users: allUsers
    };
    await s3Client.send(
      new import_client_s3.PutObjectCommand({
        Bucket: BACKUP_BUCKET,
        Key: key,
        Body: JSON.stringify(backupData, null, 2),
        ContentType: "application/json"
      })
    );
    console.log(
      `\u2705 \uBC31\uC5C5 \uC644\uB8CC: ${allUsers.length}\uBA85 \u2192 s3://${BACKUP_BUCKET}/${key}`
    );
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Cognito \uBC31\uC5C5 \uC644\uB8CC",
        totalUsers: allUsers.length,
        backupKey: key
      })
    };
  } catch (error) {
    console.error("\u274C Cognito \uBC31\uC5C5 \uC2E4\uD328:", error);
    throw error;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
