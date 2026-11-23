import { z } from "zod";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * One schema for both login tabs. The active tab is part of the form values so
 * the resolver only enforces sign-up rules when the sign-up fields are shown.
 */
export const authFormSchema = z
  .object({
    mode: z.enum(["login", "signup"]),
    fullName: z.string(),
    email: z
      .string()
      .trim()
      .min(1, "Email wajib diisi.")
      .regex(EMAIL_PATTERN, "Format email tidak valid."),
    password: z.string().min(1, "Kata sandi wajib diisi."),
  })
  .superRefine((values, ctx) => {
    if (values.mode !== "signup") return;

    const fullName = values.fullName.trim();
    if (!fullName) {
      ctx.addIssue({
        code: "custom",
        path: ["fullName"],
        message: "Nama lengkap wajib diisi.",
      });
    } else if (fullName.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["fullName"],
        message: "Nama lengkap minimal 2 karakter.",
      });
    }

    if (values.password.length > 0 && values.password.length < 6) {
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: "Kata sandi minimal 6 karakter.",
      });
    }
  });

export type AuthFormValues = z.infer<typeof authFormSchema>;
export type AuthMode = AuthFormValues["mode"];
