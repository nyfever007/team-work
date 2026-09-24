import { z } from "zod";

export const memberInput = z.object({
  teamId: z.coerce.number({ message: "팀을 선택하세요" }).int().positive("팀을 선택하세요"),
  name: z.string().trim().min(1, "이름을 입력하세요").max(100),
  position: z.string().trim().min(1, "직책을 입력하세요").max(100),
  rank: z.string().trim().max(50, "직급은 50자 이내로 입력하세요"),
  email: z.string().trim().toLowerCase().email("이메일 형식을 확인하세요").max(120),
  phone: z
    .string()
    .trim()
    .max(30, "전화번호가 너무 깁니다")
    .refine((v) => v === "" || /^[0-9+\-\s()]{7,30}$/.test(v), "전화번호 형식을 확인하세요"),
  joinedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "입사일을 입력하세요")
    .refine((v) => !Number.isNaN(new Date(v).getTime()), "올바른 날짜가 아닙니다"),
  /** "" → auto (policy); otherwise a fixed entitlement per leave year. */
  annualOverride: z.union([
    z.literal("").transform(() => null),
    z.coerce
      .number({ message: "연차는 숫자로 입력하세요" })
      .min(0, "연차는 0 이상이어야 합니다")
      .max(365, "연차 값이 너무 큽니다")
      .multipleOf(0.5, "0.5일 단위로 입력하세요"),
  ]),
});

export type MemberInput = z.infer<typeof memberInput>;
export type MemberFieldErrors = Partial<Record<keyof MemberInput | "password", string>>;
