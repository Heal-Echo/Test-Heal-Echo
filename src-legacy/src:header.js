// src/header.js
(async function loadHeader() {
    // 1) 플레이스홀더 찾고, 부분파일 경로 결정
    var slot = document.getElementById('site-header');
    if (!slot) return;
    var src = slot.getAttribute('data-header-src') || '/partials/header.html';
  
    // 2) 헤더 읽어와서 끼워넣기
    try {
      var res = await fetch(src, { cache: 'no-cache' });
      if (!res.ok) throw new Error('Header fetch failed: ' + res.status);
      var html = await res.text();
      slot.innerHTML = html;
    } catch (e) {
      console.error(e);
      slot.innerHTML = '<div style="color:red;padding:8px;">헤더 로드 실패</div>';
      return;
    }
  
    // ---------- 유틸: 로그인 상태/로그아웃/returnTo ----------
    function isLoggedIn() {
      var token = sessionStorage.getItem('id_token');
      var exp   = Number(sessionStorage.getItem('expires_at') || 0);
      return !!token && Date.now() < exp - 10_000; // 만료 10초 전 버퍼
    }
    function logout() {
      sessionStorage.removeItem('id_token');
      sessionStorage.removeItem('expires_at');
      // 필요 시 서버 세션/쿠키 로그아웃도 함께 처리
      location.replace('/index.html');
    }
    function attachReturnTo(aEl) {
      aEl.addEventListener('click', function () {
        var here = location.pathname + location.search + location.hash;
        aEl.href = '/login.html?returnTo=' + encodeURIComponent(here);
      });
    }
  
    // 3) 로그인 링크에 returnTo 자동 부착
    slot.querySelectorAll('a.login-link').forEach(attachReturnTo);
  
    // 4) 로그인 상태에 따라 UI 조정 (간단 예시)
    var actions = slot.querySelector('.menu-actions');
    if (actions) {
      if (isLoggedIn()) {
        // 로그인 상태면 로그인 링크 감추고 로그아웃 버튼 추가
        var loginLink = actions.querySelector('.login-link');
        if (loginLink) loginLink.style.display = 'none';
  
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'logoutButton';
        btn.className = 'btn btn-secondary';
        btn.textContent = '로그아웃';
        btn.addEventListener('click', logout);
        actions.insertBefore(btn, actions.firstChild);
      } else {
        // 미로그인: 로그인 링크 보이기(혹시 숨겨졌다면)
        var loginLink2 = actions.querySelector('.login-link');
        if (loginLink2) loginLink2.style.display = '';
      }
    }
  
    // 5) (선택) 메뉴 아이콘 토글 동작 연결 (모바일 메뉴 쓰실 때)
    var menuBtn = slot.querySelector('.menu-icon');
    var menuList = slot.querySelector('.menu-list');
    if (menuBtn && menuList) {
      menuBtn.addEventListener('click', function () {
        var shown = getComputedStyle(menuList).display !== 'none';
        menuList.style.display = shown ? 'none' : 'flex'; // 필요 시 클래스 토글로 대체
      });
    }
  
    // 6) (선택) 현재 페이지를 세션에 저장 — 로그인 후 '직전 페이지'로 복귀용
    (function saveHere() {
      var isLoginPage = /\/login\.html?$/.test(location.pathname);
      if (isLoginPage) return;
      var here = location.pathname + location.search + location.hash;
      try { sessionStorage.setItem('last_url', here); } catch (_) {}
    })();
  })();
  