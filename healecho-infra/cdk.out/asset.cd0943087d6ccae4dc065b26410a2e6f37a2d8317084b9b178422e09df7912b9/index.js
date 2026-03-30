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

// lambda/admin-balance-complete-upload.ts
var admin_balance_complete_upload_exports = {};
__export(admin_balance_complete_upload_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(admin_balance_complete_upload_exports);
var import_aws_sdk = __toESM(require("aws-sdk"));
var dynamo = new import_aws_sdk.default.DynamoDB.DocumentClient();
var TABLE = process.env.BALANCE_VIDEOS_TABLE_NAME;
var handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    if (!body.program || !body.weekNumber || !body.videoId || !body.key || !body.title) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "program, weekNumber, videoId, key, title \uB294 \uD544\uC218\uC785\uB2C8\uB2E4. (Balance complete)"
        })
      };
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await dynamo.put({
      TableName: TABLE,
      Item: {
        program: body.program,
        weekNumber: body.weekNumber,
        videoId: body.videoId,
        key: body.key,
        thumbnailKey: body.thumbnailKey ?? null,
        title: body.title,
        description: body.description ?? "",
        isPublished: true,
        createdAt: now,
        updatedAt: now
      }
    }).promise();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error("admin-balance-complete-upload error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Failed to complete balance video upload"
      })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
