# GC LAB 92

업무와 일상을 조금 편하게 만드는 개인 실험용 웹 도구 모음입니다.

## 서비스

- **금천한끼**: 카카오맵 음식점 검색 및 점심 룰렛
- **출장여비 검증**: 엑셀 파일을 브라우저 안에서 검사하고 결과 엑셀 생성
- **퇴근 대시**: 보관 중인 미니게임 실험

## 운영 구조

- 화면: GitHub Pages
- 식당 보완자료: MongoDB Atlas
- 데이터 동기화: GitHub Actions
- 카카오 장소 검색: Kakao Maps JavaScript SDK

출장여비 검증 파일은 사용자의 브라우저 안에서만 처리되며 외부 서버로 전송하거나 저장하지 않습니다.

## 폴더

- `/index.html`: 금천한끼
- `/lab/`: GC LAB 92 포털
- `/lab/travel/`: 출장여비 검증
- `/run/`: 퇴근 대시
- `/data/`: 공개 가능한 식당 보완자료
- `/scripts/`: MongoDB 공개자료 변환
- `/.github/workflows/`: 정기 동기화

## 환경설정

- `config.js`: 카카오 JavaScript 키
- GitHub Actions Secret `MONGODB_URI`: MongoDB Atlas 연결 문자열

MongoDB 비밀번호와 연결 문자열은 코드 또는 `config.js`에 입력하지 않습니다.

> 본 저장소의 서비스는 개인적으로 제작한 비공식 실험 서비스입니다.
