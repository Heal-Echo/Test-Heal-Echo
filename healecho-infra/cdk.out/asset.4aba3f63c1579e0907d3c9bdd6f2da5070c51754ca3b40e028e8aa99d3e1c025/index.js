"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lambda/admin-complete-upload.ts
var admin_complete_upload_exports = {};
__export(admin_complete_upload_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(admin_complete_upload_exports);
var import_aws_sdk = __toESM(require("aws-sdk"));
var ddb = new import_aws_sdk.default.DynamoDB.DocumentClient();
var TABLE_NAME = process.env.TABLE_NAME;
function getUserId(event) {
  try {
    const ctx = event.requestContext;
    const claims = ctx?.authorizer?.jwt?.claims || ctx?.authorizer?.claims || void 0;
    return claims?.sub ?? "anonymous";
  } catch {
    return "anonymous";
  }
}
var handler = async (event) => {
  console.log("AdminCompleteUpload event:", JSON.stringify(event));
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };
  try {
    const videoId = event.pathParameters?.videoId;
    if (!videoId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "videoId is required" })
      };
    }
    const body = event.body ? JSON.parse(event.body) : {};
    const { key, title, description } = body;
    if (!key || !title) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: "key and title are required" })
      };
    }
    const userId = getUserId(event);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const item = {
      id: videoId,
      userId,
      title,
      description: description ?? "",
      key,
      createdAt: now,
      updatedAt: now
    };
    await ddb.put({
      TableName: TABLE_NAME,
      Item: item
    }).promise();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(item)
    };
  } catch (error) {
    console.error("Complete upload error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to complete upload",
        error: error?.message || "Unknown error"
      })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
