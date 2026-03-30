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

// lambda/admin-balance-update-video.ts
var admin_balance_update_video_exports = {};
__export(admin_balance_update_video_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(admin_balance_update_video_exports);
var import_aws_sdk = __toESM(require("aws-sdk"));
var dynamo = new import_aws_sdk.default.DynamoDB.DocumentClient();
var TABLE = process.env.BALANCE_VIDEOS_TABLE_NAME;
var handler = async (event) => {
  try {
    const program = event.pathParameters?.program;
    const weekNumberRaw = event.pathParameters?.weekNumber;
    const weekNumber = weekNumberRaw ? Number(weekNumberRaw) : NaN;
    if (!program || !weekNumber || Number.isNaN(weekNumber)) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "program, weekNumber path params are required"
        })
      };
    }
    const body = JSON.parse(event.body || "{}");
    const expr = [];
    const names = {};
    const values = {};
    if (body.title !== void 0) {
      expr.push("#t = :t");
      names["#t"] = "title";
      values[":t"] = body.title;
    }
    if (body.description !== void 0) {
      expr.push("#d = :d");
      names["#d"] = "description";
      values[":d"] = body.description;
    }
    if (body.isPublished !== void 0) {
      expr.push("#p = :p");
      names["#p"] = "isPublished";
      values[":p"] = body.isPublished;
    }
    if (body.thumbnailKey !== void 0) {
      expr.push("#th = :th");
      names["#th"] = "thumbnailKey";
      values[":th"] = body.thumbnailKey;
    }
    expr.push("#u = :u");
    names["#u"] = "updatedAt";
    values[":u"] = (/* @__PURE__ */ new Date()).toISOString();
    if (expr.length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "No fields to update" })
      };
    }
    await dynamo.update({
      TableName: TABLE,
      Key: { program, weekNumber },
      UpdateExpression: "SET " + expr.join(", "),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values
    }).promise();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error("admin-balance-update-video error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Failed to update balance video"
      })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
