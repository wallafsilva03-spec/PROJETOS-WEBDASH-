'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { signUpSchema, type SignUpInput } from '@/lib/validations';

export default function CadastroPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  async function onSubmit(values: SignUpInput) {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { full_name: values.fullName } },
    });

    if (error) {
      toast.error(`Não foi possível criar a conta: ${error.message}`);
      return;
    }

    // Com confirmação de e-mail ativada o Supabase não devolve sessão.
    if (!data.session) {
      toast.success('Conta criada! Confirme o e-mail para acessar a plataforma.');
      router.push('/login');
      return;
    }

    toast.success('Conta criada com sucesso.');
    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h2 className="font-display text-2xl font-semibold tracking-tight">Criar conta</h2>
        <p className="text-sm text-muted-foreground">
          O acesso inicial é de analista. Um administrador pode ajustar seu perfil depois.
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Field label="Nome completo" htmlFor="fullName" error={errors.fullName?.message} required>
          <Input id="fullName" autoComplete="name" placeholder="Maria Souza" {...register('fullName')} />
        </Field>

        <Field label="E-mail corporativo" htmlFor="email" error={errors.email?.message} required>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="nome@grupomoreno.com.br"
            {...register('email')}
          />
        </Field>

        <Field
          label="Senha"
          htmlFor="password"
          error={errors.password?.message}
          hint="Mínimo de 8 caracteres."
          required
        >
          <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
        </Field>

        <Field label="Confirmar senha" htmlFor="confirmPassword" error={errors.confirmPassword?.message} required>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword')}
          />
        </Field>

        <Button type="submit" variant="brand" className="w-full" loading={isSubmitting}>
          <UserPlus className="size-4" />
          Criar conta
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Já possui acesso?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
