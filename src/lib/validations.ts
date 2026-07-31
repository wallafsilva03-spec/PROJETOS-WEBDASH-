import { z } from 'zod';

const requiredText = (field: string, min = 2, max = 200) =>
  z
    .string({ required_error: `${field} é obrigatório.` })
    .trim()
    .min(min, `${field} deve ter ao menos ${min} caracteres.`)
    .max(max, `${field} deve ter no máximo ${max} caracteres.`);

/* ------------------------------------------------------------------ Auth */
export const loginSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido.'),
  password: z.string().min(6, 'A senha deve ter ao menos 6 caracteres.'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signUpSchema = z
  .object({
    fullName: requiredText('Nome completo', 3, 120),
    email: z.string().trim().email('Informe um e-mail válido.'),
    password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

/* --------------------------------------------------------------- Projeto */
export const projectSchema = z
  .object({
    code: requiredText('Código', 2, 20).regex(/^[A-Za-z0-9-]+$/, 'Use apenas letras, números e hífen.'),
    name: requiredText('Nome', 3, 160),
    description: z.string().trim().max(4000).optional().or(z.literal('')),
    department_id: z.string().uuid().nullable().optional(),
    client_id: z.string().uuid().nullable().optional(),
    owner_id: z.string().uuid().nullable().optional(),
    status: z.enum(['backlog', 'planejamento', 'em_desenvolvimento', 'homologacao', 'concluido', 'cancelado']),
    priority: z.enum(['baixa', 'media', 'alta', 'critica']),
    complexity: z.enum(['baixa', 'media', 'alta', 'muito_alta']),
    category: z.string().trim().max(80).optional().or(z.literal('')),
    start_date: z.string().min(1, 'Informe a data de início.'),
    due_date: z.string().min(1, 'Informe o prazo final.'),
    budget: z.coerce.number().min(0, 'O orçamento não pode ser negativo.').default(0),
    planned_hours: z.coerce.number().min(0, 'As horas planejadas não podem ser negativas.').default(0),
    tags: z.array(z.string()).default([]),
  })
  .refine((data) => new Date(data.due_date) >= new Date(data.start_date), {
    path: ['due_date'],
    message: 'O prazo final deve ser igual ou posterior ao início.',
  });
export type ProjectInput = z.infer<typeof projectSchema>;

/* --------------------------------------------------------------- Tarefa */
export const taskSchema = z
  .object({
    title: requiredText('Título', 3, 200),
    description: z.string().trim().max(4000).optional().or(z.literal('')),
    status: z.enum(['backlog', 'planejamento', 'em_desenvolvimento', 'homologacao', 'concluido']),
    priority: z.enum(['baixa', 'media', 'alta', 'critica']),
    assignee_id: z.string().uuid().nullable().optional(),
    start_date: z.string().optional().or(z.literal('')),
    due_date: z.string().optional().or(z.literal('')),
    estimated_hours: z.coerce.number().min(0).max(9999).default(0),
    progress: z.coerce.number().min(0).max(100).default(0),
    is_milestone: z.boolean().default(false),
  })
  .refine(
    (data) => !data.start_date || !data.due_date || new Date(data.due_date) >= new Date(data.start_date),
    { path: ['due_date'], message: 'A data fim deve ser posterior à data início.' },
  );
export type TaskInput = z.infer<typeof taskSchema>;

/* ----------------------------------------------------------------- Risco */
export const riskSchema = z.object({
  title: requiredText('Título', 3, 160),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  probability: z.coerce.number().int().min(1).max(5),
  impact: z.coerce.number().int().min(1).max(5),
  status: z.enum(['identificado', 'em_mitigacao', 'mitigado', 'aceito', 'materializado']),
  mitigation: z.string().trim().max(2000).optional().or(z.literal('')),
  owner_id: z.string().uuid().nullable().optional(),
});
export type RiskInput = z.infer<typeof riskSchema>;

/* ----------------------------------------------------------------- Marco */
export const milestoneSchema = z.object({
  name: requiredText('Nome', 3, 160),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  due_date: z.string().min(1, 'Informe a data do marco.'),
  status: z.enum(['pendente', 'em_andamento', 'concluido', 'atrasado']).default('pendente'),
});
export type MilestoneInput = z.infer<typeof milestoneSchema>;

/* ------------------------------------------------------------ Apontamento */
export const timeEntrySchema = z.object({
  task_id: z.string().uuid().nullable().optional(),
  work_date: z.string().min(1, 'Informe a data.'),
  hours: z.coerce.number().positive('Informe um valor maior que zero.').max(24, 'Máximo de 24h por lançamento.'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
});
export type TimeEntryInput = z.infer<typeof timeEntrySchema>;

/* ---------------------------------------------------------------- Perfil */
export const profileSchema = z.object({
  full_name: requiredText('Nome', 3, 120),
  job_title: z.string().trim().max(120).optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  department_id: z.string().uuid().nullable().optional(),
  weekly_capacity_hours: z.coerce.number().min(0).max(80),
});
export type ProfileInput = z.infer<typeof profileSchema>;

/* ----------------------------------------------------------- Comentário */
export const commentSchema = z.object({
  body: z.string().trim().min(1, 'Escreva algo antes de enviar.').max(4000),
});
export type CommentInput = z.infer<typeof commentSchema>;
