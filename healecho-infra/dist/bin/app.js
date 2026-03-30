"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const cdk = __importStar(require("aws-cdk-lib"));
// 방탄 import: 모듈 모양(CJS/ESM, named/default)을 전부 흡수
// eslint-disable-next-line @typescript-eslint/no-var-requires
const StackMod = require('../lib/HealechoStack');
const HealechoStack = StackMod.HealechoStack ??
    StackMod.default ??
    StackMod;
if (typeof HealechoStack !== 'function') {
    console.error('Loaded module shape:', StackMod);
    throw new TypeError('HealechoStack symbol is not a constructor. Check exports in lib/HealechoStack.ts');
}
const app = new cdk.App();
new HealechoStack(app, 'HealechoStack', {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'ap-northeast-2' }
});
