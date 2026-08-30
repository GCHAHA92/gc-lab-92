export type ToolStatus = 'live' | 'wait';

export interface ToolItem {
  title: string;
  description: string;
  iconPath: string;
  href?: string;
  status: string;
  statusType: ToolStatus;
  message?: string;
}

export const tools: ToolItem[] = [
  {
    title: '초과근무 검증',
    description: '지급자료 비교 · 오류 확인 · 결과 다운로드',
    iconPath: 'assets/icons/clock.svg',
    status: '준비 중',
    statusType: 'wait',
    message: '초과근무 검증기는 연결 준비 중입니다.',
  },
  {
    title: '출장여비 검증',
    description: '중복 지급 · 시간 오류 · 여비 산정 점검',
    iconPath: 'assets/icons/travel.svg',
    href: 'tools/travel/',
    status: '사용 가능',
    statusType: 'live',
  },
  {
    title: '금천한끼',
    description: '오늘 점심을 대신 고민해주는 룰렛',
    iconPath: 'assets/icons/lunch.svg',
    href: 'tools/lunch/',
    status: '사용 가능',
    statusType: 'live',
  },
  {
    title: '연가보상비 계산기',
    description: '직급·호봉과 미사용 연가로 예상 지급액 계산',
    iconPath: 'assets/icons/leave.svg',
    href: 'tools/leave/',
    status: '사용 가능',
    statusType: 'live',
  },
  {
    title: 'QR코드 생성기',
    description: '주소를 QR 이미지로 만들고 복사·다운로드',
    iconPath: 'assets/icons/qr.svg',
    href: 'tools/qr/',
    status: '사용 가능',
    statusType: 'live',
  },
  {
    title: '중간지문 점검',
    description: '주말 출퇴근시간과 지문인식 내역 비교',
    iconPath: 'assets/icons/fingerprint.svg',
    href: 'tools/fingerprint/',
    status: '실험 중',
    statusType: 'live',
  },
  {
    title: '방명록',
    description: '닉네임으로 짧은 글과 비밀글 남기기',
    iconPath: 'assets/icons/guestbook.svg',
    href: 'guestbook/',
    status: '사용 가능',
    statusType: 'live',
  },
  {
    title: 'EMPTY SLOT',
    description: '다음 실험을 기다리는 빈 자리',
    iconPath: 'assets/icons/empty.svg',
    status: '비어 있음',
    statusType: 'wait',
    message: '다음 실험을 기다리는 빈 자리입니다.',
  },
];
