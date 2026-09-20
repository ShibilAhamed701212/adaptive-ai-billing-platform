import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).trim(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  organizationName: z.string().min(2, 'Organization name is required').max(200).trim(),
  billingModel: z.enum(['retail', 'subscription', 'usage_based', 'rental', 'professional_services', 'healthcare', 'logistics', 'custom']).optional(),
  businessType: z.enum(['retail', 'saas', 'services', 'general']).optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
