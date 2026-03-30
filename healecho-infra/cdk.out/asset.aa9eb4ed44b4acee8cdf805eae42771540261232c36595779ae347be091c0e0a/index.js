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
var dynamo = new import_aws_sdk.default.DynamoDB();
var TABLE = process.env.VIDEO_TABLE_NAME;
var handler = async () => {
  try {
    const result = await dynamo.getItem({
      TableName: TABLE,
      Key: { id: { S: "featured" } }
    }).promise();
    if (!result.Item) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] })
      };
    }
    const item = result.Item;
    const video = {
      id: item.id.S,
      key: item.key.S,
      thumbnailKey: item.thumbnailKey?.S ?? null,
      title: item.title.S,
      description: item.description?.S ?? "",
      userId: item.userId?.S ?? null,
      createdAt: item.createdAt.S,
      updatedAt: item.updatedAt?.S ?? item.createdAt.S
    };
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [video] })
    };
  } catch (err) {
    console.error("public-get-videos error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to fetch public videos" })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
