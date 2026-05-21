import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PhoneShell, PageHeader } from "@/components/PhoneShell";

export const Route = createFileRoute("/diagnosis")({
  head: () => ({
    meta: [
      { title: "재무 진단 — 머니파일럿" },
      {
        name: "description",
        content: "수입, 지출, 자산을 입력하고 나의 재무건강 점수를 확인하세요.",
      },
    ],
  }),
  component: Diagnosis,
});

function Diagnosis() {
  const navigate = useNavigate();
  const [income, setIncome] = useState("320");
  const [expense, setExpense] = useState("180");
  const [assets, setAssets] = useState("1500");
  const [debt, setDebt] = useState("300");

  return (
    <PhoneShell showTabs={false}>
      <PageHeader
        title="내 재무 정보 입력"
        subtitle="단위는 만원이에요. 정확하지 않아도 괜찮아요."
        back="/"
      />

      <div className="px-5 space-y-3">
        <Field label="월 실수령액" suffix="만원" value={income} onChange={setIncome} />
        <Field
          label="월 고정 지출"
          suffix="만원"
          value={expense}
          onChange={setExpense}
          hint="월세, 통신비, 구독료 등"
        />
        <Field
          label="총 자산"
          suffix="만원"
          value={assets}
          onChange={setAssets}
          hint="예적금, 투자, 현금 합계"
        />
        <Field
          label="총 부채"
          suffix="만원"
          value={debt}
          onChange={setDebt}
          hint="학자금, 신용대출 등"
        />
      </div>

      <div className="px-5 mt-8 space-y-3">
        <button
          onClick={() =>
            navigate({
              to: "/dashboard",
              search: { income, expense, assets, debt } as never,
            })
          }
          className="w-full bg-primary text-primary-foreground font-semibold py-4 rounded-2xl active:scale-[0.98] transition-transform"
        >
          진단 결과 보기
        </button>
        <Link to="/dashboard" className="block text-center text-muted-foreground text-sm py-1">
          나중에 입력할게요
        </Link>
      </div>
    </PhoneShell>
  );
}

function Field({
  label,
  suffix,
  value,
  onChange,
  hint,
}: {
  label: string;
  suffix: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="block bg-surface border border-border rounded-2xl px-4 py-3.5 focus-within:border-primary transition-colors">
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
      <div className="flex items-baseline gap-2 mt-1">
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
          maxLength={7}
          className="min-w-0 flex-1 bg-transparent text-xl font-bold outline-none placeholder:text-muted-foreground/50"
          placeholder="0"
        />
        <span className="text-sm text-muted-foreground font-medium">{suffix}</span>
      </div>
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </label>
  );
}
