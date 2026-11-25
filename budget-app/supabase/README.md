# Supabase 연결 (두 사람이 함께 쓰기)

가계부 내용은 각 기기에서 **가계부 비밀번호로 암호화(AES-GCM, PBKDF2 600,000회)** 한 뒤 Supabase에 올립니다.
Supabase에는 알아볼 수 없는 암호문과 기록 종류·무작위 id·수정 시각만 저장됩니다.
가계부 비밀번호는 어디에도 저장되지 않으므로, **잊으면 서버 데이터를 되살릴 수 없습니다.**

## 1. 프로젝트 만들기
1. https://supabase.com 가입 → **New project**
2. Region: **Northeast Asia (Seoul)** / Database password는 본인만 보관 (앱에는 필요 없음)

## 2. 데이터베이스 설정
**SQL Editor → New query** 에 [`schema.sql`](./schema.sql) 전체를 붙여 넣고 **Run**.
(여러 번 실행해도 안전합니다. 실행 후 **Advisors → Security Advisor** 에 경고가 없는지 확인하세요.)

## 3. 로그인 설정
**Authentication → URL Configuration**
- Site URL: `https://nuranino.github.io/NuraNino/`
- Redirect URLs: `https://nuranino.github.io/NuraNino/` 추가

**Authentication → Emails → Templates** — 홈 화면 앱(PWA)에서는 메일 링크가 사파리로 열리므로 6자리 코드도 넣어 둡니다.
- **Magic Link** 와 **Confirm signup** 템플릿 본문에 아래 한 줄을 추가:
  ```html
  <p>로그인 코드: <strong>{{ .Token }}</strong></p>
  ```

> 무료 플랜의 기본 메일 발송은 시간당 몇 통으로 제한됩니다. 로그인은 기기마다 한 번이면 되므로 보통 문제없습니다.

## 4. 앱에 연결
**Project Settings → API Keys** 에서 두 값을 복사합니다.
- Project URL (`https://xxxx.supabase.co`)
- **anon / publishable** 키 (공개용. `service_role`/secret 키는 절대 쓰지 마세요)

GitHub 저장소 **Settings → Secrets and variables → Actions → Variables 탭 → New repository variable**
- `SUPABASE_URL` = Project URL
- `SUPABASE_ANON_KEY` = anon(publishable) 키

그다음 **Actions → Deploy budget-app to GitHub Pages → Run workflow** 로 다시 배포하면 앱의 설정 화면에 "함께 쓰기"가 나타납니다.

## 5. 사용 순서
1. (남편) 앱 → 설정 → 함께 쓰기 → 이메일 로그인 → **새 가계부 만들기** (가계부 비밀번호 정하기) → 이 기기 데이터가 암호화되어 올라감
2. (남편) **배우자 초대 링크 만들기** → 링크 보내기. 가계부 비밀번호는 **다른 경로로**(말로, 다른 메신저로) 알려 주기
3. (아내) 링크 열기 → 이메일 로그인 → **초대받아 참여** → 가계부 비밀번호 입력
4. 이후 한쪽에서 입력하면 다른 쪽에 몇 초 안에 반영됩니다. 오프라인에서 입력한 것은 연결되면 올라갑니다.

## 개발자용: 접근 규칙 테스트
```bash
createdb budget_test
PGDATABASE=budget_test supabase/test/run.sh   # 로컬 PostgreSQL에서 schema.sql + RLS 테스트
```
