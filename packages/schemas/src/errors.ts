import { z } from 'zod';

/** Every non-2xx JSON response from the API has this shape. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
