// src/app/api/user/billing/confirm-payment/route.ts
// ==========================================
// POST /api/user/billing/confirm-payment
// 빌링키 기반 자동결제 승인 API
// ==========================================
//
// [현재] 토스 빌링키 결제 API를 직접 호출
// [향후] Lambda 전환 시 이 파일 내부만 프록시로 교체
//        → API 계약(요청/응답) 동일
//
// 사용 시점:
//   - 무료 체험 종료 후 첫 자동 과금 (Lambda 스케줄러에서 호출)
//   - 정기 과금 (월간/연간 갱신 시)
//
// API 계약:
//   Request:  { billingKey, customerKey, amount, orderId, orderName,
//               programId, planType }
//   Response: { ok, payment?: { paymentKey, orderId, status,
//               totalAmount, method, approvedAt }, error?, code? }
// ==========================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import type { BillingChargeRequest, BillingChargeResponse } from "@/types/billing";

function extractToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  return parts.length === 2 ? parts[1] : null;
}

export async function POST(req: Request) {
  try {
    // ── 인증 확인 ──
    const token = extractToken(req);
    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" } satisfies BillingChargeResponse,
        { status: 401 }
      );
    }

    // ── 요청 파싱 ──
    const body: BillingChargeRequest = await req.json();
    const { billingKey, customerKey, amount, orderId, orderName, programId, planType } = body;

    if (!billingKey || !customerKey || !amount || !orderId || !orderName) {
      return NextResponse.json(
        {
          ok: false,
          error: "billingKey, customerKey, amount, orderId, orderName은 필수입니다.",
        } satisfies BillingChargeResponse,
        { status: 400 }
      );
    }

    // ── 시크릿 키 확인 ──
    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      console.error("[ConfirmPayment] TOSS_SECRET_KEY not configured");
      return NextResponse.json(
        { ok: false, error: "결제 시스템 설정 오류" } satisfies BillingChargeResponse,
        { status: 500 }
      );
    }

    // ── 토스 빌링키 결제 승인 API 호출 ──
    // POST https://api.tosspayments.com/v1/billing/{billingKey}
    // Authorization: Basic {base64(secretKey:)}
    const authHeaderValue = "Basic " + Buffer.from(secretKey + ":").toString("base64");

    console.log("[ConfirmPayment] Charging with billing key:", {
      billingKey: billingKey.slice(0, 8) + "...",
      amount,
      orderId,
      programId,
      planType,
    });

    const tossRes = await fetch(`https://api.tosspayments.com/v1/billing/${billingKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeaderValue,
      },
      body: JSON.stringify({
        customerKey,
        amount,
        orderId,
        orderName,
      }),
    });

    const tossData = await tossRes.json();

    if (!tossRes.ok) {
      console.error("[ConfirmPayment] Toss API error:", tossData);
      return NextResponse.json(
        {
          ok: false,
          error: tossData.message || "결제 승인에 실패했습니다.",
          code: tossData.code,
        } satisfies BillingChargeResponse,
        { status: tossRes.status }
      );
    }

    // ── 결제 승인 성공 ──
    console.log("[ConfirmPayment] Payment confirmed:", {
      paymentKey: tossData.paymentKey,
      orderId: tossData.orderId,
      status: tossData.status,
      method: tossData.method,
      totalAmount: tossData.totalAmount,
    });

    // ─────────────────────────────────────────
    // ★ AWS 연동 포인트 (향후 Lambda에서 처리)
    //
    // Lambda 전환 시 아래 작업이 Lambda 내부에서 수행됨:
    // 1. PaymentsTable에 TransactionRecord 저장
    //    - PK: userId, SK: "txn_{orderId}"
    // 2. SubscriptionsTable 업데이트
    //    - subscriptionType: "paid"
    //    - nextChargeDate 갱신 (월간: +30일, 연간: +365일)
    // 3. BillingRecord의 nextChargeDate 업데이트
    // ─────────────────────────────────────────

    const response: BillingChargeResponse = {
      ok: true,
      payment: {
        paymentKey: tossData.paymentKey,
        orderId: tossData.orderId,
        status: tossData.status,
        totalAmount: tossData.totalAmount,
        method: tossData.method,
        approvedAt: tossData.approvedAt,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[ConfirmPayment] error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "결제 승인 처리 중 오류가 발생했습니다.",
      } satisfies BillingChargeResponse,
      { status: 500 }
    );
  }
}
