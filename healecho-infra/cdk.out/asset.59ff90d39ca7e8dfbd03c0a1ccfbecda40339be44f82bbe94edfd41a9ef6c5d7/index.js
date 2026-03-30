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

// lambda/admin-balance-multipart-complete.ts
var admin_balance_multipart_complete_exports = {};
__export(admin_balance_multipart_complete_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(admin_balance_multipart_complete_exports);
var import_aws_sdk = __toESM(require("aws-sdk"));
var s3 = new import_aws_sdk.default.S3({ signatureVersion: "v4" });
var BUCKET_NAME = process.env.UPLOAD_BUCKET;
var handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { key, uploadId, parts } = body;
    if (!key || !uploadId || !Array.isArray(parts) || parts.length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "key, uploadId, parts[] are required" })
      };
    }
    const sorted = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);
    const result = await s3.completeMultipartUpload({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sorted.map((p) => ({ ETag: p.ETag, PartNumber: p.PartNumber }))
      }
    }).promise();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true, key, location: result.Location })
    };
  } catch (err) {
    console.error("multipart complete error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Failed to complete multipart upload", error: err?.message })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
