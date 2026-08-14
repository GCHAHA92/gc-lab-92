# 금천 한끼

금천구청 및 동주민센터 주변 점심 식당을 카카오맵으로 검색하고 룰렛으로 추천하는 웹 앱입니다.

## Vercel 환경변수

- `MONGODB_URI`: MongoDB Atlas 연결 문자열
- `MONGODB_DB`: 데이터베이스 이름(기본값 `geumcheonLunch`)
- `ALLOWED_ORIGIN`: 허용할 웹 주소. Vercel에서 같은 도메인으로 운영하면 `*` 또는 배포 주소를 사용합니다.

MongoDB 접속 문자열이나 비밀번호는 `config.js` 또는 GitHub 저장소에 넣지 않습니다.
