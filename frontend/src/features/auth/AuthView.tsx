import type { Session } from "@supabase/supabase-js";
import { LogIn, Mail, ShieldCheck, UserPlus } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { isSupabaseConfigured, supabase } from "../../lib/supabase";

type AuthViewProps = {
  onAuthenticated: (session: Session) => void;
};

type AuthMode = "sign-in" | "sign-up";

function getAuthErrorMessage(error: unknown, fallback: string) {
  if (error instanceof TypeError && error.message === "Failed to fetch") {
    return "Supabase에 연결할 수 없습니다. .env.local의 Supabase URL과 Anon Key를 확인해주세요.";
  }

  return error instanceof Error ? error.message : fallback;
}

export function AuthView({ onAuthenticated }: AuthViewProps) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSignUp = mode === "sign-up";

  const resetPassword = async () => {
    setError(null);
    setMessage(null);

    if (!supabase || !isSupabaseConfigured) {
      setError("Supabase 환경변수가 설정되지 않았습니다. .env.local을 확인해주세요.");
      return;
    }

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("비밀번호 재설정 링크를 받을 이메일을 입력해주세요.");
      return;
    }

    setSubmitting(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: window.location.origin,
      });

      if (resetError) throw resetError;

      setMessage("비밀번호 재설정 링크를 이메일로 보냈습니다. 메일함을 확인해주세요.");
    } catch (resetError) {
      setError(getAuthErrorMessage(resetError, "비밀번호 재설정 요청에 실패했습니다."));
    } finally {
      setSubmitting(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!supabase || !isSupabaseConfigured) {
      setError("Supabase 환경변수가 설정되지 않았습니다. .env.local을 확인해주세요.");
      return;
    }

    if (!email.trim() || password.length < 6) {
      setError("이메일과 6자 이상의 비밀번호를 입력해주세요.");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error: authError } = isSignUp
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });

      if (authError) throw authError;

      if (data.session) {
        onAuthenticated(data.session);
        return;
      }

      setMessage("회원가입이 완료되었습니다. 이메일 인증이 켜져 있다면 메일 확인 후 로그인해주세요.");
      setMode("sign-in");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "인증 요청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-5">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <ShieldCheck size={24} />
          </div>
          <h1 className="text-2xl font-black text-slate-100">Money Pilot</h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-400">
            보유자산 저장과 가격 갱신을 위해 Supabase 계정으로 로그인합니다.
          </p>
        </div>

        <Card>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`rounded-xl px-3 py-2 text-xs font-extrabold ${
                mode === "sign-in" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
              }`}
              onClick={() => setMode("sign-in")}
            >
              로그인
            </button>
            <button
              type="button"
              className={`rounded-xl px-3 py-2 text-xs font-extrabold ${
                mode === "sign-up" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"
              }`}
              onClick={() => setMode("sign-up")}
            >
              회원가입
            </button>
          </div>

          <form className="space-y-3" onSubmit={submit}>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-400">이메일</span>
              <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5">
                <Mail size={14} className="text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-slate-100 outline-none placeholder:text-slate-500"
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-slate-400">비밀번호</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                placeholder="6자 이상"
              />
            </label>

            {!isSignUp ? (
              <button
                type="button"
                className="text-xs font-semibold text-blue-300 underline-offset-4 hover:text-blue-200 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                onClick={resetPassword}
                disabled={submitting}
              >
                비밀번호를 잊으셨나요?
              </button>
            ) : null}

            {error ? <p className="rounded-xl border border-rose-800 bg-rose-950 p-3 text-xs font-semibold text-rose-300">{error}</p> : null}
            {message ? <p className="rounded-xl border border-blue-800 bg-slate-900 p-3 text-xs font-semibold text-blue-200">{message}</p> : null}

            <Button className="w-full" variant="secondary" type="submit" disabled={submitting}>
              {isSignUp ? <UserPlus size={15} /> : <LogIn size={15} />}
              {submitting ? "처리 중..." : isSignUp ? "회원가입" : "로그인"}
            </Button>
          </form>
        </Card>

        <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-400">
          Supabase Auth 이메일/비밀번호 인증을 사용합니다. 자산 데이터는 로그인한 사용자 본인 row만 접근합니다.
        </p>
      </div>
    </main>
  );
}
