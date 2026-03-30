/**
 * 일괄 패치 스크립트: 기존 사용자의 cardCompany / cardLast4 업데이트
 *
 * 동작:
 *   1. PaymentsTable에서 cardCompany가 빈 레코드를 찾는다
 *   2. 각 레코드의 billingKey로 토스 빌링키 조회 API를 호출한다
 *   3. issuerCode → 카드사명 매핑 후 DynamoDB를 업데이트한다
 *
 * 실행 방법 (로컬):
 *   npx ts-node scripts/patch-card-company.ts
 *
 * 필요 환경변수:
 *   PAYMENTS_TABLE_NAME  — DynamoDB 테이블명 (예: HealechoStack-PaymentsTableXXX)
 *   TOSS_SECRET_KEY      — 토스 시크릿 키 (test_sk_... 또는 live_sk_...)
 *   AWS_REGION           — (선택) 기본값 ap-northeast-2
 */

import AWS from "aws-sdk";
import https from "https";

// ── 환경변수 ──
const PAYMENTS_TABLE = process.env.PAYMENTS_TABLE_NAME;
const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY;
const REGION = process.env.AWS_REGION || "ap-northeast-2";

if (!PAYMENTS_TABLE || !TOSS_SECRET_KEY) {
  console.error("❌ 환경변수를 설정하세요:");
  console.error("   PAYMENTS_TABLE_NAME=<테이블명>");
  console.error("   TOSS_SECRET_KEY=<토스 시크릿 키>");
  process.exit(1);
}

AWS.config.update({ region: REGION });
const dynamo = new AWS.DynamoDB.DocumentClient();

// ── issuerCode → 카드사명 매핑 (billing-issue-key.ts와 동일) ──
const ISSUER_CODE_MAP: Record<string, string> = {
  "3K": "기업비씨",
  "46": "광주",
  "71": "롯데",
  "30": "산업",
  "31": "BC",
  "51": "삼성",
  "38": "새마을",
  "41": "신한",
  "62": "신협",
  "36": "씨티",
  "33": "우리",
  "W1": "우리BC",
  "37": "우체국",
  "39": "저축",
  "35": "전북",
  "42": "제주",
  "15": "카카오뱅크",
  "3A": "케이뱅크",
  "24": "토스뱅크",
  "21": "하나",
  "61": "현대",
  "11": "KB국민",
  "91": "NH농협",
  "34": "Sh수협",
};

// ── 토스 API 호출 ──
function callTossApi(billingKey: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64");
    const options = {
      hostname: "api.tosspayments.com",
      port: 443,
      path: `/v1/billing/authorizations/${billingKey}`,
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject({ statusCode: res.statusCode, ...parsed });
          }
        } catch {
          reject({ statusCode: res.statusCode, raw: data });
        }
      });
    });

    req.on("error", reject);
    req.end();
  });
}

// ── 카드사명 해석 ──
function resolveCardCompany(cardInfo: Record<string, any>): string {
  if (cardInfo.company) return cardInfo.company;
  if (cardInfo.issuerCode && ISSUER_CODE_MAP[cardInfo.issuerCode]) {
    return ISSUER_CODE_MAP[cardInfo.issuerCode];
  }
  if (cardInfo.acquirerCode && ISSUER_CODE_MAP[cardInfo.acquirerCode]) {
    return ISSUER_CODE_MAP[cardInfo.acquirerCode];
  }
  return "";
}

// ── 카드 끝 4자리 해석 ──
function resolveCardLast4(cardInfo: Record<string, any>): string {
  const num = cardInfo.number || "";
  if (!num) return "";
  const last4 = num.slice(-4);
  const digits = last4.replace(/\*/g, "");
  return digits.length >= 3 ? digits : last4;
}

// ── 메인 실행 ──
async function main() {
  console.log("🔍 PaymentsTable 스캔 중...");
  console.log(`   테이블: ${PAYMENTS_TABLE}`);

  // 1) PaymentsTable 전체 스캔 (소규모 테이블 가정)
  const scanResult = await dynamo
    .scan({
      TableName: PAYMENTS_TABLE!,
      FilterExpression:
        "attribute_exists(billingKey) AND (cardCompany = :empty OR attribute_not_exists(cardCompany))",
      ExpressionAttributeValues: {
        ":empty": "",
      },
    })
    .promise();

  const items = scanResult.Items || [];
  console.log(`📋 패치 대상: ${items.length}건\n`);

  if (items.length === 0) {
    console.log("✅ 패치할 레코드가 없습니다.");
    return;
  }

  // 2) 각 레코드 처리
  for (const item of items) {
    const { userId, paymentId, billingKey, cardCompany, cardLast4 } = item;
    console.log(`── 처리 중: userId=${userId}, paymentId=${paymentId}`);
    console.log(`   현재값: cardCompany="${cardCompany}", cardLast4="${cardLast4}"`);

    try {
      // 토스 빌링키 조회
      const tossResult = await callTossApi(billingKey);
      const cardInfo = tossResult.card || {};

      const newCompany = resolveCardCompany(cardInfo);
      const newLast4 = resolveCardLast4(cardInfo);

      console.log(`   토스 응답: issuerCode="${cardInfo.issuerCode}", number="${cardInfo.number}"`);
      console.log(`   → cardCompany="${newCompany}", cardLast4="${newLast4}"`);

      if (!newCompany && !newLast4) {
        console.log(`   ⚠️  토스에서 카드 정보를 가져올 수 없습니다. 건너뜁니다.\n`);
        continue;
      }

      // 3) DynamoDB 업데이트
      await dynamo
        .update({
          TableName: PAYMENTS_TABLE!,
          Key: { userId, paymentId },
          UpdateExpression:
            "SET cardCompany = :company, cardLast4 = :last4, updatedAt = :now",
          ExpressionAttributeValues: {
            ":company": newCompany,
            ":last4": newLast4 || cardLast4, // 새 값이 없으면 기존 유지
            ":now": new Date().toISOString(),
          },
        })
        .promise();

      console.log(`   ✅ 업데이트 완료\n`);
    } catch (err: any) {
      console.error(`   ❌ 실패:`, err.message || err);
      console.log();
    }
  }

  console.log("🎉 패치 완료!");
}

main().catch((err) => {
  console.error("스크립트 오류:", err);
  process.exit(1);
});
