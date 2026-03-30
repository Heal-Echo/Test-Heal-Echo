// /partials/header.js

(function () {
  // 현재 스크립트의 디렉토리 계산
  const thisScript = document.currentScript;
  const base =
    thisScript && thisScript.src
      ? thisScript.src.replace(/\/[^\/]*$/, "/")
      : "/partials/";

  // CSS 주입(중복 방지)
  const cssId = "he-header-css";
  if (!document.getElementById(cssId)) {
    const link = document.createElement("link");
    link.id = cssId;
    link.rel = "stylesheet";
    link.href = base + "header.css";
    document.head.appendChild(link);
  }

  // 헤더 넣을 자리 찾기 (#site-header)
  const mount = document.getElementById("site-header");
  if (!mount) {
    console.warn("[HealEcho] #site-header 요소가 없습니다.");
    return;
  }

  // header.html 불러와 삽입
  fetch(base + "header.html", { credentials: "same-origin" })
    .then((r) => r.text())
    .then((html) => {
      mount.innerHTML = html;

      // -----------------------------
      // 1) 활성 탭 표시: data-active 또는 현재 URL로 추정
      // -----------------------------
      const activeKey = (mount.getAttribute("data-active") || "").trim();
      const markActive = (key) => {
        const links = mount.querySelectorAll(`[data-key="${key}"]`);
        links.forEach((a) => a.classList.add("is-active"));
      };

      if (activeKey) {
        markActive(activeKey);
      } else {
        // URL 기반 자동 추정 (간단 매핑)
        const p = location.pathname;
        if (p.includes("autosolution")) markActive("auto");
        else if (p.includes("login")) markActive("login");
        else if (p.includes("balance")) markActive("trial");
        // 필요 시 추가 매핑 가능
      }

      // -----------------------------
      // 2) 모바일 메뉴 토글 (모바일 메뉴가 있을 경우)
      // -----------------------------
      const btn = mount.querySelector(".he-menu-btn");
      const panel = mount.querySelector("#he-mobile");
      if (btn && panel) {
        btn.addEventListener("click", () => {
          const open = panel.hasAttribute("hidden") ? false : true;
          if (open) {
            panel.setAttribute("hidden", "");
            btn.setAttribute("aria-expanded", "false");
          } else {
            panel.removeAttribute("hidden");
            btn.setAttribute("aria-expanded", "true");
          }
        });

        // 포커스 밖 클릭 시 닫기
        document.addEventListener("click", (e) => {
          if (!panel || panel.hasAttribute("hidden")) return;
          const within = panel.contains(e.target) || btn.contains(e.target);
          if (!within) {
            panel.setAttribute("hidden", "");
            btn.setAttribute("aria-expanded", "false");
          }
        });
      }

      // -----------------------------
      // 3) ✅ 로그인 상태에 따라 guest / user 영역 토글
      // -----------------------------
      let hasIdToken = false;

      try {
        const guestArea = mount.querySelector('[data-when="guest"]');
        const userArea = mount.querySelector('[data-when="user"]');

        if (!guestArea || !userArea) {
          console.warn("[HealEcho] guest/user 영역을 찾지 못했습니다.");
        } else {
          // LocalStorage에 저장된 키들을 전부 확인
          const keys = Object.keys(window.localStorage || {});
          console.log("[HealEcho] localStorage keys:", keys);

          // Cognito에서 흔히 쓰는 idToken 패턴:
          //   - something.idToken
          //   - idToken
          //   - id_token
          const tokenKey = keys.find((k) =>
            /id[_-]?token/i.test(k)
          );

          hasIdToken =
            !!tokenKey && !!window.localStorage.getItem(tokenKey || "");

          console.log(
            "[HealEcho] 선택된 토큰 키:",
            tokenKey,
            "로그인 여부:",
            hasIdToken
          );

          if (hasIdToken) {
            // ✅ 로그인 상태 → guest 숨기고, user 보이기
            guestArea.style.display = "none";
            userArea.style.display = "";
          } else {
            // ✅ 비로그인 상태 → guest 보이고, user 숨기기
            guestArea.style.display = "";
            userArea.style.display = "none";
          }
        }
      } catch (e) {
        console.error("[HealEcho] 로그인 상태 판별 중 오류:", e);
      }

      // -----------------------------
      // 4) ✅ 로그아웃 버튼 동작 추가
      // -----------------------------
      const logoutBtn = mount.querySelector("#logoutBtn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
          e.preventDefault();

          try {
            // 1) LocalStorage에 저장된 Cognito 토큰 삭제
            const keys = Object.keys(window.localStorage || {});
            keys.forEach((k) => {
              if (
                /id[_-]?token/i.test(k) ||
                /access[_-]?token/i.test(k) ||
                /refresh[_-]?token/i.test(k)
              ) {
                window.localStorage.removeItem(k);
              }
            });
            console.log("[HealEcho] 로그아웃: 토큰 삭제 완료");
          } catch (err) {
            console.error("[HealEcho] 로그아웃 중 오류:", err);
          }

          // 2) 페이지 새로고침 (또는 메인으로 이동) → 헤더 상태 다시 계산
          //    S3/CloudFront 루트가 홈이라면 "/" 가 안전합니다.
          window.location.href = "/";
          // 필요하면 위 줄 대신 아래 줄로 바꿔도 됩니다.
          // window.location.reload();
        });
      }
    })
    .catch((err) => {
      console.error("[HealEcho] header 로딩 실패:", err);
    });
})();
