# 유료 구독(paid) 동기부여 문구 설계

> 작성일: 2026-03-17
> 목적: 구독 관리 페이지 — paid 구독자 실천 패턴별 문구 정의
> 관련 문서: `trial-day1-3-motivation-messages.md`, `trial-day4-7-motivation-messages.md`

---

## free_trial과의 핵심 차이

| 구분 | free_trial | paid |
|---|---|---|
| 핵심 관점 | 체험 기간 내 실천 → 유료 전환 | 꾸준한 실천 → 웰니스 라이프스타일 정착 |
| 시간 축 | 7일 (단기) | 수주~수개월 (장기) |
| 톤 | 시작 / 첫걸음 / 습관 형성 | 루틴 확립 / 깊어짐 / 일상화 |
| 사용자 심리 | "이게 나한테 맞을까?" | "계속할 가치가 있는가?" |
| 카운트다운 | ⑩에서만 "얼마 남지 않았어요" | 완전 배제 |

---

## 판별 변수

| 변수 | 설명 | 출처 |
|---|---|---|
| `participationDays` | 총 실천 일수 (paid 전환 후 누적) | `/api/user/practice-record` |
| `streak` | 현재 연속 실천일 | `/api/user/practice-record` |
| `practicedToday` | 오늘 실천 여부 | `/api/user/practice-record` |
| `weekNumber` | 현재 프로그램 주차 | `subscription.startDate` 기반 계산 |
| `userName` | 사용자 이름 | `getUserName()` |

### 주차 기반 단계 분류

| 단계 | 주차 | 설명 |
|---|---|---|
| 정착기 | 2~4주차 | 유료 전환 직후. 결제 가치 확인, 습관 정착 |
| 성장기 | 5~12주차 | 중기. 변화 체감, 루틴 심화 |
| 안정기 | 13주차+ | 장기. 웰니스 라이프스타일 확립 |

---

## 전체 패턴 분류

| 패턴 | 조건 | 상황 설명 |
|---|---|---|
| P-① 장기 연속 실천 | streak≥7, practicedToday | 일주일 이상 매일 실천 |
| P-② 중기 연속 실천 | streak 4~6, practicedToday | 습관 고착 구간 |
| P-③ 단기 연속 실천 | streak 2~3, practicedToday | 연속 실천 시작 |
| P-④ 쉬다 돌아온 실천 | participation≥2, streak=1, practicedToday | 쉬었다 다시 실천 |
| P-⑤ 첫/초기 실천 | participation≤1, streak=1, practicedToday | 이번 구독 주기 첫 실천 |
| P-⑥ 꾸준한 실천자 쉬는 중 | participation≥7, !practicedToday | 실천 이력 풍부, 오늘은 아직 |
| P-⑦ 중간 실천자 쉬는 중 | participation 3~6, !practicedToday | 어느 정도 실천했으나 쉬는 중 |
| P-⑧ 저참여 쉬는 중 | participation 1~2, !practicedToday | 거의 참여하지 않은 상태 |
| P-⑨ 미참여 | participation=0, !practicedToday | 유료 전환 후 아직 실천 없음 |

---

## 패턴별 동기부여 문구

### P-① 장기 연속 실천 (streak≥7, practicedToday)

**정착기 (2~4주차):**
```
{streak}일 연속 실천.
웰니스가 일상이 되고 있습니다.
```

**성장기 (5~12주차):**
```
{streak}일 연속.
{userName}님의 루틴이 빛나고 있어요.
```

**안정기 (13주차+):**
```
{streak}일 연속.
이미 웰니스가 삶의 일부입니다.
```

**CTA:** "나의 웰니스 기록 보기"
**awardFooter:** "웰니스가 일상이 되었어요"

**설계 의도:** 7일 이상 연속은 paid에서만 가능한 성취. free_trial의 ⑮(streak≥4)보다 높은 기준. 단계별로 톤을 달리하되, "루틴이 되었다"는 메시지를 일관되게 전달. 안정기에서는 userName을 빼고 보편적 표현으로 전환하여 과도한 칭찬을 피함.

---

### P-② 중기 연속 실천 (streak 4~6, practicedToday)

**정착기 (2~4주차):**
```
{streak}일 연속, 루틴이 자리잡고 있어요.
{userName}님의 선택이 변화를 만들고 있습니다.
```

**성장기+ (5주차+):**
```
꾸준한 실천이 깊어지고 있어요.
{userName}님의 웰니스 루틴이 단단해지고 있습니다.
```

**CTA:** "나의 웰니스 기록 보기"
**awardFooter:** "꾸준함이 빛나고 있어요"

**설계 의도:** free_trial ⑮와 유사하나, "자리잡고 있어요" → "깊어지고 있어요"로 톤 상승. 정착기에서는 "님의 선택"으로 결제 결정을 긍정적으로 프레이밍. 성장기부터는 streak 숫자를 빼고 질적 표현으로 전환 (동적 숫자 미노출 원칙 확장 적용).

---

### P-③ 단기 연속 실천 (streak 2~3, practicedToday)

**streak = participationDays일 때:**
```
{streak}일 연속, 몸이 달라지고 있어요.
꾸준함이 변화를 만듭니다.
```

**streak ≠ participationDays일 때:**
```
다시 이어가는 리듬.
꾸준함이 변화를 만듭니다.
```

**CTA:** "나의 실천 기록 보기"
**awardFooter:** "꾸준함이 변화를 만듭니다"

**설계 의도:** free_trial ⑭와 동일한 동적 숫자 미노출 원칙 적용. "다시 이어가는 리듬"은 paid 환경에서 연속이 끊겼다가 재개된 상태를 자연스럽게 표현. free_trial에서는 "웰니스 루틴이 만들어지고 있어요"였으나, paid에서는 이미 루틴이 있다는 전제이므로 "리듬"으로 변경.

---

### P-④ 쉬다 돌아온 실천 (participation≥2, streak=1, practicedToday)

```
다시 돌아오셨군요.
쉬어가는 것도 루틴의 일부입니다.
```

**CTA:** "나의 실천 기록 보기"
**awardFooter:** "다시 시작하는 것이 중요합니다"

**설계 의도:** free_trial ⑤/⑬의 "바쁜 하루 속에서도 다시 찾아주셨어요"와 톤이 다르다. paid에서는 결제가 진행 중이므로 "찾아주셨어요"(감사)보다 "쉬어가는 것도 루틴"(정상화)이 적절. 장기 구독에서 쉬는 날이 있는 것은 자연스러운 일이라는 메시지로 죄책감을 해소.

---

### P-⑤ 첫/초기 실천 (participation≤1, streak=1, practicedToday)

**정착기 (2~4주차):**
```
{userName}님의 여정이 계속되고 있어요.
이번 주도 {userName}님의 웰니스를 함께합니다.
```

**성장기+ (5주차+):**
```
다시 시작하는 날이 새로운 1일차예요.
지금부터가 {userName}님의 여정입니다.
```

**CTA:** "오늘의 기록 확인하기"
**awardFooter:** "이어가는 것이 가장 큰 실천입니다"

**설계 의도:** paid 사용자는 이미 결제라는 행동적 몰입(behavioral commitment)을 완료한 상태이므로, "새로운 시작"보다 **연속성(continuity)** 프레이밍이 인지 부조화를 피하고 매몰 비용 심리를 긍정적으로 활용한다. 정착기에서는 "여정이 계속되고 있어요"로 기존 경험의 축적을 인정. 성장기에서는 free_trial ⑦의 리프레이밍("시작한 날이 1일차")을 재활용.

---

### P-⑥ 꾸준한 실천자 쉬는 중 (participation≥7, !practicedToday)

**정착기 (2~4주차):**
```
{participationDays}일의 실천이 쌓여 있어요.
오늘도 이어가 볼까요?
```

**성장기+ (5주차+):**
```
{participationDays}일의 웰니스가 {userName}님 안에 있어요.
오늘도 15분, 이어가 볼까요?
```

**CTA:** "오늘의 솔루션 시작하기"
**awardFooter:** "{participationDays}일의 실천이 빛나고 있어요"

**설계 의도:** free_trial ⑯의 확장. 7일 이상 실천한 paid 사용자는 충성도가 높다. "쌓여 있어요" → 성장기에서 "님 안에 있어요"로 내면화된 변화를 강조. 숫자를 보여주는 것이 긍정적인 구간이므로 participationDays를 노출.

---

### P-⑦ 중간 실천자 쉬는 중 (participation 3~6, !practicedToday)

```
지금까지의 실천은 사라지지 않아요.
오늘 15분이면 다시 이어갈 수 있습니다.
```

**CTA:** "오늘의 솔루션 시작하기"
**awardFooter:** "실천의 감각이 남아 있어요"

**설계 의도:** 신체 감각 귀인("몸에 남아 있다")은 장기 휴식 후 고객의 실제 경험과 충돌하여 심리적 반발(Psychological Reactance)을 유발할 수 있다. "사라지지 않아요"는 신체 감각이 아닌 **기록/축적의 사실**에 기반하므로 고객이 반박할 수 없는 객관적 프레이밍이다. 근거 기반 동기부여(evidence-based motivation)로 신뢰도 손상 위험을 회피.

---

### P-⑧ 저참여 쉬는 중 (participation 1~2, !practicedToday)

```
지난번에 시작한 여정, 아직 열려 있어요.
오늘 15분이면 다시 이어갈 수 있습니다.
```

**CTA:** "오늘의 솔루션 시작하기"
**awardFooter:** "{participationDays}일의 기록이 여기 있어요"

**설계 의도:** 저참여 구간(1~2일)에서 "몸에 남아 있다"는 신체 귀인은 현실과 불일치할 가능성이 높다. 대신 **객관적 데이터({participationDays}일)**를 근거로 하여 고객이 반박할 수 없는 사실을 제시. "기록이 여기 있어요"는 서비스가 고객의 실천을 기억하고 있다는 메시지로, 소유감(psychological ownership)을 자극한다. paid 저참여자에게 결제 관련 언급은 절대 하지 않는다 (해지 동기 자극 방지).

---

### P-⑨ 미참여 (participation=0, !practicedToday)

**정착기 (2~4주차):**
```
{userName}님을 위한 솔루션이 준비되어 있어요.
하루 15분, 시작해 볼까요?
```

**성장기+ (5주차+):**
```
아직 경험하지 못한 솔루션이 기다리고 있어요.
오늘, 나를 위한 15분을 만들어보세요.
```

**CTA:** "첫 번째 솔루션 시작하기"
**awardFooter:** "당신의 웰니스 여정이 기다리고 있어요"

**설계 의도:** free_trial ⑨/⑩의 확장. paid에서 participation=0은 매우 드문 경우(무료 체험에서 실천 없이 유료 전환). "0일"이라는 데이터를 직접 노출하지 않는 원칙을 유지. 정착기에서는 userName을 사용하여 개인화된 초대를 하고, 성장기에서는 "아직 경험하지 못한"으로 시간 압박 없이 기회를 제시.

---

## 분기 로직 우선순위

```
 1. streak≥7  AND practicedToday                     → P-① 장기 연속
 2. streak 4~6 AND practicedToday                    → P-② 중기 연속
 3. streak 2~3 AND practicedToday                    → P-③ 단기 연속
 4. participation≥2, streak=1, practicedToday         → P-④ 쉬다 돌아옴
 5. participation≤1, streak=1, practicedToday          → P-⑤ 첫/초기 실천
 6. participation≥7, !practicedToday                  → P-⑥ 꾸준한 실천자 쉬는 중
 7. participation 3~6, !practicedToday                → P-⑦ 중간 실천자 쉬는 중
 8. participation 1~2, !practicedToday                → P-⑧ 저참여 쉬는 중
 9. participation=0, !practicedToday                  → P-⑨ 미참여
```

---

## free_trial(①~⑯)과의 대응 관계

| paid 패턴 | 대응하는 free_trial 패턴 | 변경점 |
|---|---|---|
| P-① 장기 연속 | ⑮ 장기 연속 (streak≥4) | 기준 상향(≥7), 단계별 톤 분화 |
| P-② 중기 연속 | ⑮ 장기 연속 | 별도 분리, "깊어짐" 톤 |
| P-③ 단기 연속 | ⑭ 연속 실천 중 | "리듬" 표현으로 변경 |
| P-④ 쉬다 돌아옴 | ⑤/⑬ 쉬다 돌아옴 | "쉬어가는 것도 루틴" 정상화 |
| P-⑤ 첫/초기 | ②/⑦ 첫 실천/늦은 시작 | "새로운 여정" 톤 |
| P-⑥ 꾸준한 쉬는 중 | ⑯ 꾸준한 실천자 쉬는 중 | 기준 상향(≥7), 내면화 표현 |
| P-⑦ 중간 쉬는 중 | (신규) | free_trial에 없는 구간 |
| P-⑧ 저참여 쉬는 중 | ⑥/⑪ 쉬는 중 | 동일 문구 재활용 |
| P-⑨ 미참여 | ①/⑨/⑩ 미참여 | 카운트다운 완전 배제 |

---

## 톤앤매너 원칙 (paid 전용)

1. **카운트다운 완전 배제:** "N일 남았습니다"뿐 아니라 "얼마 남지 않았어요"도 사용하지 않는다. paid에는 체험 종료라는 개념이 없다.
2. **결제 언급 금지:** "구독료", "결제", "가격" 등의 단어를 동기부여 문구에 사용하지 않는다. 해지 동기를 자극하지 않는다.
3. **신체 감각 중심:** free_trial과 동일. "몸이 기억한다", "몸에 남아 있다" — 힐에코의 요가/웰니스 맥락.
4. **정상화 톤:** 쉬는 것을 죄책감이 아닌 자연스러운 과정으로 프레이밍한다. "쉬어가는 것도 루틴의 일부."
5. **깊어짐 표현:** free_trial의 "만들어지고 있어요" → paid에서는 "깊어지고 있어요", "단단해지고 있습니다"로 진행감을 반영.
6. **개인화 강화:** free_trial보다 userName 사용 빈도를 높인다 (P-①②⑤⑥에서 사용). 결제한 고객에 대한 존중.
7. **짧은 호흡:** free_trial과 동일. 한 줄당 15자 내외.
8. **판단 배제:** free_trial과 동일. "0일", "빈 상태" 같은 부정적 데이터를 직접 노출하지 않는다.

---

## 구현 참고 사항

### weekNumber 계산

```
// paid 전환 후 경과 주차
const paidStartDate = subscription.startDate;  // paid 시작일
const daysSincePaid = calcDaysElapsed(paidStartDate);
const weekNumber = Math.floor(daysSincePaid / 7) + 2;  // +2: free_trial 1주차 이후
```

### 단계 판별

```
function getPaidPhase(weekNumber: number): "settling" | "growing" | "stable" {
  if (weekNumber <= 4) return "settling";   // 정착기
  if (weekNumber <= 12) return "growing";   // 성장기
  return "stable";                           // 안정기
}
```

### 함수 시그니처 (예시)

```
function getPaidMotivationMessage(
  participationDays: number,
  streak: number,
  practicedToday: boolean,
  weekNumber: number,
  userName: string
): MotivationMessage
```
