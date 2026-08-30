# JISUNG 92 · Astro migration

업무와 일상을 조금 편하게 만드는 개인 작업실입니다. Astro가 개인 홈페이지와 콘텐츠 페이지를 정적으로 생성하고, 기존 브라우저 도구는 독립 HTML·JavaScript 앱으로 유지합니다. 방명록 데이터와 인증은 Supabase를 사용합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

프로덕션 빌드는 `npm run build`로 생성합니다. 실행 전에 기존 도구와 방명록 파일을 Astro 공개 폴더로 동기화하므로 개발 서버와 배포 결과에서 기존 주소를 동일하게 유지합니다.

## 주요 경로

- `/` — Astro 개인 홈페이지
- `/about/` — Astro 소개
- `/notes/` — Markdown 콘텐츠 컬렉션
- `/guestbook/` — 방명록
- `/changelog/` — 변경 기록
- `/tools/` — Astro 도구 목록 및 독립 정적 도구
- `/src/` — Astro 페이지, 컴포넌트, 콘텐츠
- `/assets/` — 공통 스타일, 스크립트, 이미지
- `/data/` — 공개 정적 데이터
- `/supabase/migrations/` — DB 변경 이력
- `/docs/` — 디자인·개발 문서

기존 `/apps/` 주소는 새 `/tools/` 또는 `/guestbook/` 주소로 이동합니다.

## 배포 주소

기본 배포 주소는 `https://gchaha92.github.io/gc-lab-92/`입니다. `SITE_URL` 환경변수를 지정하면 사용자 도메인용 루트 경로로 빌드합니다.
