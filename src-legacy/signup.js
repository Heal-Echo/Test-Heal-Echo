// ── 0-A) 직전 페이지 자동 기록(모든 페이지에서 동작) ──
(function () {
  // login.html 자체는 기록하지 않음(되돌림 루프 방지)
  var isLoginPage = /\/login\.html?$/.test(location.pathname);

  function saveHere() {
    if (isLoginPage) return;
    var here = location.pathname + location.search + location.hash;
    try {
      sessionStorage.setItem('last_url', here);  // 필요시 localStorage로 바꿔도 됨
    } catch (e) {
      console.warn('last_url 저장 실패(무시 가능):', e);
    }
  }

  // 들어왔을 때/앞뒤 이동/해시 변경/떠나기 직전 등 상황에서 기록
  window.addEventListener('pageshow', saveHere);
  window.addEventListener('hashchange', saveHere);
  window.addEventListener('beforeunload', saveHere);
})();

// ── 0-B) 로그인 후 돌아갈 곳 계산 & 안전 리다이렉트 ──
function getReturnTo() {
  var url = new URL(location.href);

  // 1) 쿼리스트링 ?returnTo= 가 최우선
  var qp = url.searchParams.get('returnTo');
  if (qp) return qp;

  // 2) 세션에 저장된 직전 페이지
  var saved = sessionStorage.getItem('last_url');
  if (saved && !/\/login\.html?$/.test(saved)) return saved;

  // 3) 같은 오리진의 referrer
  try {
    var ref = new URL(document.referrer, location.origin);
    if (ref.origin === location.origin && !/\/login\.html?$/.test(ref.pathname)) {
      return ref.pathname + ref.search + ref.hash;
    }
  } catch (e) {}

  // 4) 아무 것도 없으면 홈
  return 'index.html';
}

function safeRedirect(urlStr) {
  try {
    var u = new URL(urlStr, location.origin);
    if (u.origin === location.origin) {
      location.replace(u.href);
      return;
    }
  } catch (e) {}
  location.replace('index.html'); // 최후의 안전장치
}

// ── 0-C) 토큰 저장(만료시각 포함) ──
function storeIdToken(idToken) {
  if (!idToken) return;
  sessionStorage.setItem('id_token', idToken);
  try {
    var payload = JSON.parse(atob(idToken.split('.')[1]));
    if (payload && payload.exp) {
      sessionStorage.setItem('expires_at', String(payload.exp * 1000));
    }
  } catch (e) {
    // exp 파싱 실패 시 1시간 유효로 가정
    sessionStorage.setItem('expires_at', String(Date.now() + 3600 * 1000));
  }
}



// signup.js

// ── 1) AWS Cognito 설정 ──

// AWS 콘솔에서 복사해 온 UserPoolId, ClientId로 바꿔 주세요.
const poolData = {
  UserPoolId: 'ap-northeast-2_68VMdEqHX',
  ClientId:   '3dgbll5fnagbru09gcil8nvhof',
};
const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

// (선택) COGNITO_DOMAIN도 그대로 두세요.
const COGNITO_DOMAIN = 'https://healecho-admin.auth.ap-northeast-2.amazoncognito.com';

// ── 비밀번호 요구 사항 검사 함수 ──
function meetsPasswordRequirements(pw) {
  return [
    pw.length >= 8,
    /[A-Z]/.test(pw),
    /[a-z]/.test(pw),
    /[0-9]/.test(pw),
    /[^A-Za-z0-9]/.test(pw)
  ].every(v => v);
}

// ── 2) 회원가입(signUp) 함수 ──
function signUp() {
  // 2-1) 입력값 가져오기
  const familyName      = document.getElementById('familyName').value.trim();
  const givenName       = document.getElementById('givenName').value.trim();
  const email           = document.getElementById('email').value.trim();
  const password        = document.getElementById('password').value;
  const passwordConfirm = document.getElementById('passwordConfirm').value;

  // 2-2) 빈칸 검사
  if (!familyName || !givenName || !email || !password || !passwordConfirm) {
    alert('모든 필드를 입력해주세요.');
    return;
  }

  // 2-3) 이메일 형식 검사
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert('올바른 이메일 주소 형식이 아닙니다.');
    return;
  }

  // ── 2-4-전) 비밀번호 요구 사항 전체 검사 ──
  if (!meetsPasswordRequirements(password)) {
    alert('비밀번호는 최소 8자 이상, 대문자·소문자·숫자·특수문자를 각각 하나 이상 포함해야 합니다.');
    return;
  }
  // ── 2-4) 기존 비밀번호 길이·일치 검사 유지 ──


  // 2-4) 비밀번호 길이·일치 검사
  if (password.length < 8) {
    alert('비밀번호는 최소 8자 이상이어야 합니다.');
    return;
  }
  if (password !== passwordConfirm) {
    alert('비밀번호가 일치하지 않습니다.');
    return;
  }

  // 2-5) CognitoUserAttribute 생성
  const attributeList = [
    new AmazonCognitoIdentity.CognitoUserAttribute({
      Name:  'family_name',
      Value: familyName
    }),
    new AmazonCognitoIdentity.CognitoUserAttribute({
      Name:  'given_name',
      Value: givenName
    }),
    new AmazonCognitoIdentity.CognitoUserAttribute({
      Name:  'email',
      Value: email
    })
  ];

  // ── 3) Cognito에 회원가입 요청 ──
userPool.signUp(email, password, attributeList, null, (err, result) => {
  if (err) {
    if (err.code === 'UsernameExistsException') {
      alert('이미 가입된 이메일 주소입니다. 다른 이메일로 시도해 주세요.');
    } else {
      alert('회원가입 중 오류가 발생했습니다:\n' + err.message);
    }
    console.error(err);
    return;
  }
  alert('회원가입 요청이 완료되었습니다. 이메일 인증을 확인해주세요.');
  // …인증 링크 이메일로 발송 후 처리를 이어갑니다.

  document.getElementById('signupForm').style.display       = 'none'; // 기존 폼 숨김  <-- 수정
    document.getElementById('confirm-container').style.display = 'block'; // 인증 폼 보이기 <-- 수정
});
} 

// ── 4) DOM 준비 완료 후 이벤트 등록 ──
document.addEventListener('DOMContentLoaded', () => {
  const confirmContainer   = document.getElementById('confirm-container');
const confirmationInput  = document.getElementById('confirmationCode');
const confirmButton      = document.getElementById('confirmButton');

  // form의 submit 이벤트를 가로채서 signUp() 호출
  const signupForm = document.getElementById('signupForm');
  signupForm.addEventListener('submit', e => {
    e.preventDefault();  // 브라우저 새로고침 방지
    signUp();
  });
  
  
// ★ 추가: 인증 코드 확인 버튼 핸들러
confirmButton.addEventListener('click', () => {
  const email = document.getElementById('email').value.trim();
  const code  = confirmationInput.value.trim();

  if (!code) {
    alert('인증 코드를 입력해주세요.');
    return;
  }

  // CognitoUser 생성
  const userData = { Username: email, Pool: userPool };
  const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);


  // 인증 코드 확인 요청
  cognitoUser.confirmRegistration(code, true, (err, result) => {
    if (err) {
      alert('인증 오류: ' + err.message);
      console.error(err);
      return;
    }
    alert('이메일 인증이 완료되었습니다! 로그인 페이지로 이동합니다.');
    // 인증 성공 콜백 안에서
document.getElementById('signup-container').style.display  = 'none';
document.getElementById('login-container').style.display   = 'flex';
 // 인증 완료 후 이동할 페이지 <-- 수정
  });
});

  // ── 비밀번호 요구 사항 체크 UI ──
  const passwordInput   = document.getElementById('password');
  const reqBox          = document.getElementById('password-requirements');
  const reqEls = {
    length:    document.getElementById('req-length'),
    uppercase: document.getElementById('req-uppercase'),
    lowercase: document.getElementById('req-lowercase'),
    number:    document.getElementById('req-number'),
    special:   document.getElementById('req-special'),
  };

  // 포커스 시 표시
  passwordInput.addEventListener('focus', () => {
    reqBox.style.display = 'block';
  });

  passwordInput.addEventListener('blur', () => {
    reqBox.style.display = 'none';
  });

  // 입력값 변화마다 개별 요구 사항 토글
  passwordInput.addEventListener('input', () => {
    const v = passwordInput.value;
    reqEls.length.classList.toggle('valid',    v.length >= 8);
    reqEls.length.classList.toggle('invalid',  v.length <  8);
    reqEls.uppercase.classList.toggle('valid', /[A-Z]/.test(v));
    reqEls.uppercase.classList.toggle('invalid', !/[A-Z]/.test(v));
    reqEls.lowercase.classList.toggle('valid', /[a-z]/.test(v));
    reqEls.lowercase.classList.toggle('invalid', !/[a-z]/.test(v));
    reqEls.number.classList.toggle('valid',    /[0-9]/.test(v));
    reqEls.number.classList.toggle('invalid',  !/[0-9]/.test(v));
    reqEls.special.classList.toggle('valid',   /[^A-Za-z0-9]/.test(v));
    reqEls.special.classList.toggle('invalid', !/[^A-Za-z0-9]/.test(v));

    // 모두 충족 시 박스 숨김
    if (meetsPasswordRequirements(v)) {
      reqBox.style.display = 'none';
    }
  });


  // (선택) 기존에 쓰시던 소셜 로그인 핸들러도 여기 안에 넣어 주세요
  const redirectUri = encodeURIComponent(window.location.href);
  [['kakaoBtn', 'Kakao'],
   ['naverBtn', 'Naver'],
   ['googleBtn','Google'],
   ['appleBtn', 'Apple']].forEach(([id, provider]) => {
    document.getElementById(id)?.addEventListener('click', e => {
      e.preventDefault();
      const url = `https://ap-northeast-2jftolfbri.auth.ap-northeast-2.amazoncognito.com/oauth2/authorize`
                + `?identity_provider=${provider}`
                + `&response_type=code`
                + `&client_id=${poolData.ClientId}`
                + `&redirect_uri=${redirectUri}`
                + `&scope=email+openid`;
      window.location.href = url;
    });
  });

// ★ 추가: 로그인 버튼 핸들러
const loginButton = document.getElementById('loginButton');
loginButton.addEventListener('click', () => {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    alert('이메일과 비밀번호를 모두 입력해주세요.');
    return;
  }

  // 1) AuthenticationDetails 생성
  const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
    Username: email,
    Password: password
  });

  // 2) CognitoUser 객체 생성
  const userData = { Username: email, Pool: userPool };
  const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

  // 3) authenticateUser 호출
  cognitoUser.authenticateUser(authDetails, {
    onSuccess: (result) => {
      // (선택) 토큰 저장해 두면 보호 페이지 구현 등에 유용
      try {
        var idToken = result.getIdToken && result.getIdToken().getJwtToken
          ? result.getIdToken().getJwtToken()
          : null;
        if (idToken) storeIdToken(idToken);
      } catch (e) { /* 토큰 저장 실패는 치명적 아님 */ }
    
      // 로그인 시작 직전 페이지로 복귀
      var dest = getReturnTo();
      safeRedirect(dest);
    },
    
    onFailure: (err) => {
      alert('로그인 실패: ' + err.message);
      console.error(err);
    },
    newPasswordRequired: (userAttributes, requiredAttributes) => {
      // (선택) 비밀번호 재설정이 필요한 경우 처리
      alert('비밀번호 재설정이 필요합니다.');
    }
  });
});
});
 // End of DOMContentLoaded

