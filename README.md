# 우리 가계부

부부 두 사람이 하나의 household를 공유하는 모바일 우선 가계부입니다.

현재는 Phase 2까지 구현되어 있습니다. 계정 생성, 로그인, 가계부 생성, 일회용 배우자 초대와 household 단위 보안 정책을 포함합니다. 거래 화면과 예산 화면은 아직 없습니다.

## 필요한 환경

- Node.js 20.9 이상
- pnpm
- hosted Supabase 프로젝트

Docker나 로컬 Supabase 서버는 사용하지 않습니다.

## 처음 한 번 설정하기

1. Supabase Dashboard에서 새 프로젝트를 만듭니다.
2. 프로젝트의 URL과 Publishable key를 확인합니다. Service role key는 브라우저 환경변수에 넣지 않습니다.
3. `.env.local.example`을 `.env.local`로 복사하고 실제 값을 채웁니다.
4. Supabase Auth의 URL Configuration에서 Site URL을 `http://localhost:3000`으로 지정하고 Redirect URL에 `http://localhost:3000/auth/callback`을 추가합니다.
5. 아래 명령으로 패키지를 설치하고 hosted 프로젝트를 연결합니다.

```powershell
pnpm install
pnpm supabase login
pnpm supabase link --project-ref YOUR_PROJECT_REF
pnpm supabase db push
pnpm supabase gen types typescript --linked > src/lib/supabase/database.types.ts
```

`database.types.ts`는 실제 hosted DB에서 생성되는 파일이며 DB 타입의 기준입니다. 테이블을 그대로 복제한 수동 TypeScript interface는 만들지 않습니다. DB migration이 바뀔 때마다 타입 생성 명령도 다시 실행합니다.

## 실행과 검사

```powershell
pnpm dev
pnpm typecheck
pnpm lint
pnpm build
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 직접 확인할 시나리오

1. 첫 번째 이메일로 가입하고 로그인합니다.
2. `우리 집` 가계부를 만듭니다.
3. 배우자 초대 링크를 만듭니다.
4. 시크릿 창 또는 다른 브라우저에서 링크를 열고 두 번째 이메일로 가입합니다.
5. 두 번째 계정으로 초대를 수락한 뒤 같은 가계부 이름이 보이는지 확인합니다.
6. 같은 초대 링크를 다시 사용했을 때 거부되는지 확인합니다.
7. 24시간이 지난 링크가 거부되는지 확인합니다.

이메일 확인 기능을 켠 경우 실제 수신 가능한 이메일 주소가 필요합니다. 개발 중 이메일 확인을 끄더라도 운영 환경에서는 다시 켜는 것이 안전합니다.

## 중요한 보안 구조

- 모든 가계부 데이터는 사용자 개인이 아니라 household에 연결됩니다.
- RLS는 DB가 로그인 사용자의 household 가입 여부를 확인한 뒤 행 접근을 허용하는 기능입니다. 화면을 조작해 다른 household ID를 보내도 DB가 거절합니다.
- 한 계정은 `UNIQUE(user_id)` 제약으로 하나의 household에만 가입할 수 있습니다.
- 초대 원본 토큰은 DB에 저장하지 않고 SHA-256 해시만 저장합니다.
- 초대는 관리자만 만들 수 있고 24시간 후 만료되며 한 번만 사용할 수 있습니다.
- membership을 브라우저에서 직접 추가할 권한은 없습니다. 검증된 DB 함수만 가입 행을 생성합니다.
- `SECURITY DEFINER` helper는 노출되지 않는 `private` schema에 두고 고정된 빈 `search_path`와 명시적인 schema 이름을 사용합니다.
- `.env.local`은 Git에서 제외되며 service role key는 클라이언트에 사용하지 않습니다.

## Migration

DB 구조는 [`supabase/migrations`](./supabase/migrations)에 순서대로 기록합니다. Dashboard에서 임의로 테이블을 바꾸기보다 새 migration을 추가해 변경 이력을 Git에 남깁니다.
