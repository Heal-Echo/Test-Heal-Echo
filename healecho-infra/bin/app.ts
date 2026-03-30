import 'dotenv/config';
import * as cdk from 'aws-cdk-lib';

// 방탄 import: 모듈 모양(CJS/ESM, named/default)을 전부 흡수
// eslint-disable-next-line @typescript-eslint/no-var-requires
const StackMod = require('../lib/HealechoStack');
const HealechoStack =
  StackMod.HealechoStack ??
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
