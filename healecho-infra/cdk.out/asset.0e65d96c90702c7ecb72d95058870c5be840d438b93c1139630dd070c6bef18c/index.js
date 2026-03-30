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

// lambda/admin-update-video.ts
var admin_update_video_exports = {};
__export(admin_update_video_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(admin_update_video_exports);
var import_aws_sdk = __toESM(require("aws-sdk"));
var ddb = new import_aws_sdk.default.DynamoDB.DocumentClient();
var TABLE_NAME = process.env.TABLE_NAME;
var handler = async (event) => {
  console.log("AdminUpdateVideo event:", JSON.stringify(event));
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
    const { title, description, thumbnailKey } = body;
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    if (typeof title === "string") {
      expressionAttributeNames["#title"] = "title";
      expressionAttributeValues[":title"] = title;
      updateExpressions.push("#title = :title");
    }
    if (typeof description === "string") {
      expressionAttributeNames["#description"] = "description";
      expressionAttributeValues[":description"] = description;
      updateExpressions.push("#description = :description");
    }
    if (typeof thumbnailKey === "string" || thumbnailKey === null) {
      expressionAttributeNames["#thumbnailKey"] = "thumbnailKey";
      expressionAttributeValues[":thumbnailKey"] = thumbnailKey;
      updateExpressions.push("#thumbnailKey = :thumbnailKey");
    }
    if (updateExpressions.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          message: "No valid fields to update"
        })
      };
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    expressionAttributeNames["#updatedAt"] = "updatedAt";
    expressionAttributeValues[":updatedAt"] = now;
    updateExpressions.push("#updatedAt = :updatedAt");
    expressionAttributeNames["#id"] = "id";
    const params = {
      TableName: TABLE_NAME,
      Key: { id: videoId },
      UpdateExpression: "SET " + updateExpressions.join(", "),
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: "attribute_exists(#id)",
      ReturnValues: "ALL_NEW"
    };
    const result = await ddb.update(params).promise();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result.Attributes ?? {})
    };
  } catch (error) {
    console.error("Update video error:", error);
    if (error.code === "ConditionalCheckFailedException") {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          message: "Video not found"
        })
      };
    }
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to update video",
        error: error?.message || "Unknown error"
      })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
