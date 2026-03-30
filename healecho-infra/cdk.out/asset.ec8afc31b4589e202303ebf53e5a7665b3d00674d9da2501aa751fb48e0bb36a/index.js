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

// lambda/admin-balance-multipart-initiate.ts
var admin_balance_multipart_initiate_exports = {};
__export(admin_balance_multipart_initiate_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(admin_balance_multipart_initiate_exports);
var import_aws_sdk = __toESM(require("aws-sdk"));
var path = __toESM(require("path"));
var s3 = new import_aws_sdk.default.S3({ signatureVersion: "v4" });
var BUCKET_NAME = process.env.UPLOAD_BUCKET;
var URL_EXPIRATION_SECONDS = 60 * 10;
var handler = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const {
      fileName,
      fileType = "application/octet-stream",
      folder,
      videoId
    } = body;
    if (!fileName || !folder || !videoId) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "fileName, folder, videoId are required" })
      };
    }
    const cleanFileName = path.basename(fileName);
    const key = `${folder}/${cleanFileName}`;
    const created = await s3.createMultipartUpload({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType
    }).promise();
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId: created.UploadId,
        key,
        videoId,
        contentType: fileType,
        expiresInSeconds: URL_EXPIRATION_SECONDS
      })
    };
  } catch (err) {
    console.error("multipart initiate error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Failed to initiate multipart upload", error: err?.message })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
