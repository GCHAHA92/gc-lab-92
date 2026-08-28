# Supabase 연결

## 1. 새 프로젝트 만들기

1. [Supabase Dashboard](https://supabase.com/dashboard)에서 새 프로젝트를 만듭니다.
2. 가까운 리전을 선택하고 데이터베이스 비밀번호를 안전하게 보관합니다.
3. 프로젝트 생성이 끝날 때까지 기다립니다.

## 2. 방명록 DB 만들기

1. Supabase Dashboard의 **SQL Editor**를 엽니다.
2. `guestbook.sql` 전체 내용을 붙여넣고 실행합니다.
3. 오류 없이 완료됐는지 확인합니다.

## 3. GC LAB에 공개 연결정보 입력하기

Supabase Dashboard의 **Project Settings → API**에서 다음 값을 확인합니다.

- Project URL
- Publishable key 또는 legacy `anon` key

`apps/guestbook/config.js`에 값을 입력합니다.

```js
window.GC_SUPABASE = {
  url: 'https://YOUR_PROJECT.supabase.co',
  publishableKey: 'YOUR_PUBLISHABLE_KEY',
};
```

Publishable key와 legacy `anon` key는 브라우저에서 사용하는 공개 키입니다. `secret` 또는 `service_role` 키는 절대 입력하거나 GitHub에 올리지 않습니다.

## 보안 구조

- 원본 테이블은 `anon`과 `authenticated` 역할에서 직접 접근할 수 없습니다.
- 브라우저는 허용된 DB 함수만 실행합니다.
- 공개 목록 함수는 비밀글 본문을 반환하지 않습니다.
- 비밀번호는 PostgreSQL `pgcrypto`의 bcrypt 해시로만 저장합니다.
- 수정, 삭제, 비밀글 열람은 DB 내부에서 비밀번호를 검증합니다.

공개 방명록은 자동 등록 공격에 노출될 수 있습니다. 실제 이용량을 본 뒤 Cloudflare Turnstile과 요청 횟수 제한을 추가하는 것을 권장합니다.
