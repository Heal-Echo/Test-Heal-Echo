"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
var cdk = require("aws-cdk-lib");
var HealechoStack_1 = require("../lib/HealechoStack");
var app = new cdk.App();
new HealechoStack_1.HealechoStack(app, 'HealechoStack', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'ap-northeast-2' }
});
