import { z } from "zod";

export const USER_TOKEN_HEADER = "x-openkarta-user-token" as const;

export const UserTokenPayload = z.object({
  sub: z.string().min(1),
  aud: z.string().min(1),
  iss: z.string().min(1),
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
  scopes: z
    .array(z.enum(["discover", "search", "get", "quote", "checkout", "status", "cancel", "return"]))
    .min(1),
});
export type UserTokenPayload = z.infer<typeof UserTokenPayload>;
