# 임시 사이트 · Astro migration

업무와 일상을 조금 편하게 만드는 개인 작업실입니다. Astro가 개인 홈페이지와 콘텐츠 페이지를 정적으로 생성하고, 기존 브라우저 도구는 독립 HTML·JavaScript 앱으로 유지합니다. 방명록 데이터와 인증은 Supabase를 사용합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

프로덕션 빌드는 `npm run build`로 생성합니다. 기존 도구와 방명록은 `public/`에서 가공 없이 그대로 배포되므로 기존 주소를 유지합니다.

## 주요 경로

- `/` — Astro 개인 홈페이지
- `/about/` — Astro 소개
- `/notes/` — Markdown 콘텐츠 컬렉션
- `/guestbook/` — 방명록
- `/changelog/` — 변경 기록
- `/tools/` — Astro 도구 목록 및 독립 정적 도구
- `/src/` — Astro 페이지, 컴포넌트, 레이아웃, 콘텐츠
- `/public/assets/` — 공통 스타일, 스크립트, 이미지
- `/public/tools/` — 독립 HTML·JavaScript 도구
- `/public/guestbook/` — 독립 HTML·JavaScript 방명록
- `/public/data/` — 브라우저가 읽는 공개 정적 데이터
- `/supabase/migrations/` — DB 변경 이력
- `/docs/` — 디자인·개발 문서

## 배포 주소

기본 배포 주소는 `https://nonbisa.com/`입니다. GitHub Pages의 프로젝트 주소는 사용자 도메인으로 연결되며, `SITE_URL` 환경변수로 별도의 배포 주소를 지정할 수 있습니다.
