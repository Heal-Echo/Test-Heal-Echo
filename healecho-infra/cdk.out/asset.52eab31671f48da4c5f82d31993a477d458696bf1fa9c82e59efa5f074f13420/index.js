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

// lambda/admin-balance-list-videos.ts
var admin_balance_list_videos_exports = {};
__export(admin_balance_list_videos_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(admin_balance_list_videos_exports);
var import_aws_sdk = __toESM(require("aws-sdk"));
var dynamo = new import_aws_sdk.default.DynamoDB.DocumentClient();
var TABLE = process.env.BALANCE_VIDEOS_TABLE_NAME;
var handler = async (event) => {
  try {
    const program = event.pathParameters?.program;
    if (!program) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "program path param is required" })
      };
    }
    const res = await dynamo.query({
      TableName: TABLE,
      KeyConditionExpression: "program = :p",
      ExpressionAttributeValues: {
        ":p": program
      }
    }).promise();
    const items = (res.Items || []).sort(
      (a, b) => (a.weekNumber ?? 0) - (b.weekNumber ?? 0)
    );
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items })
    };
  } catch (err) {
    console.error("admin-balance-list-videos error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Failed to list balance videos"
      })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
