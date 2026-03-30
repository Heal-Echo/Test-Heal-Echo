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

// lambda/admin-presign-upload.ts
var admin_presign_upload_exports = {};
__export(admin_presign_upload_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(admin_presign_upload_exports);
var import_aws_sdk = __toESM(require("aws-sdk"));
var import_crypto = __toESM(require("crypto"));
var path = __toESM(require("path"));
var s3 = new import_aws_sdk.default.S3({ signatureVersion: "v4" });
var BUCKET_NAME = process.env.UPLOAD_BUCKET;
var URL_EXPIRATION_SECONDS = 60 * 5;
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
  console.log("AdminPresignUpload event:", JSON.stringify(event));
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const fileName = body.fileName;
    const fileType = body.fileType || "video/mp4";
    if (!fileName) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: "fileName is required" })
      };
    }
    const cleanFileName = path.basename(fileName);
    const userId = getUserId(event);
    const videoId = import_crypto.default.randomUUID();
    const folder = `${userId}/${videoId}`;
    const key = `uploads/${folder}/${cleanFileName}`;
    const uploadUrl = await s3.getSignedUrlPromise(
      "putObject",
      {
        Bucket: BUCKET_NAME,
        Key: key,
        Expires: URL_EXPIRATION_SECONDS,
        ContentType: fileType
      }
    );
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": "true",
      "Content-Type": "application/json"
    };
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        uploadUrl,
        key,
        contentType: fileType,
        videoId
      })
    };
  } catch (error) {
    console.error("Presign error:", error);
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    };
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        message: "Failed to generate upload URL",
        error: error?.message || "Unknown error"
      })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
