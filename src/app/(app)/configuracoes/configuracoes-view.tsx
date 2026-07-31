'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Palette, Save, ShieldCheck, UserCog } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { BrandPills } from '@/components/brand/logo';
import { SkeletonTable } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { qk } from '@/lib/query-keys';
import { ROLE_META, ROLE_OPTIONS, BRAND } from '@/lib/constants';
import { profileSchema, type ProfileInput } from '@/lib/validations';
import { useDepartments, useProfiles } from '@/hooks/use-catalogs';
import { useSession } from '@/hooks/use-session';
import type { AppRole } from '@/types/database';

const NONE = '__none__';

export function ConfiguracoesView() {
  const { profile, isAdmin, isLoading } = useSession();
  const departments = useDepartments();
  const people = useProfiles();
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { full_name: '', job_title: '', phone: '', department_id: null, weekly_capacity_hours: 40 },
  });

  React.useEffect(() => {
    if (!profile) return;
    reset({
      full_name: profile.full_name,
      job_title: profile.job_title ?? '',
      phone: profile.phone ?? '',
      department_id: profile.department_id,
      weekly_capacity_hours: Number(profile.weekly_capacity_hours),
    });
  }, [profile, reset]);

  async function saveProfile(values: ProfileInput) {
    if (!profile) return;

    const { error } = await createClient()
      .from('profiles')
      .update({
        full_name: values.full_name,
        job_title: values.job_title || null,
        phone: values.phone || null,
        department_id: values.department_id,
        weekly_capacity_hours: values.weekly_capacity_hours,
      })
      .eq('id', profile.id);

    if (error) {
      toast.error(`Falha ao salvar: ${error.message}`);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: qk.session });
    await queryClient.invalidateQueries({ queryKey: qk.profiles });
    toast.success('Perfil atualizado.');
  }

  async function changeRole(userId: string, role: AppRole) {
    const { error } = await createClient().from('profiles').update({ role }).eq('id', userId);

    if (error) {
      toast.error(`Falha ao alterar o perfil: ${error.message}`);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: qk.profiles });
    toast.success('Perfil de acesso atualizado.');
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Administração"
        title="Configurações"
        description="Dados do seu perfil, permissões da plataforma e identidade visual."
      />

      <Tabs defaultValue="perfil">
        <TabsList>
          <TabsTrigger value="perfil">
            <UserCog /> Meu perfil
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="acessos">
              <ShieldCheck /> Acessos
            </TabsTrigger>
          )}
          <TabsTrigger value="marca">
            <Palette /> Identidade visual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base">Dados pessoais</CardTitle>
              <CardDescription>
                A capacidade semanal alimenta o cálculo de workload e disponibilidade da equipe.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <SkeletonTable rows={4} />
              ) : (
                <form onSubmit={handleSubmit(saveProfile)} className="space-y-4" noValidate>
                  <div className="flex items-center gap-4">
                    <UserAvatar
                      userId={profile?.id}
                      name={profile?.full_name}
                      src={profile?.avatar_url}
                      className="size-14"
                    />
                    <div>
                      <p className="font-medium">{profile?.email}</p>
                      {profile && (
                        <Badge variant="soft" className="mt-1 bg-gradient-brand-soft text-foreground">
                          {ROLE_META[profile.role].label}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Field label="Nome completo" htmlFor="full_name" error={errors.full_name?.message} required>
                    <Input id="full_name" {...register('full_name')} />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Cargo" htmlFor="job_title">
                      <Input id="job_title" placeholder="Gerente de Projetos" {...register('job_title')} />
                    </Field>
                    <Field label="Telefone" htmlFor="phone">
                      <Input id="phone" placeholder="(00) 00000-0000" {...register('phone')} />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Controller
                      control={control}
                      name="department_id"
                      render={({ field }) => (
                        <Field label="Departamento">
                          <Select
                            value={field.value ?? NONE}
                            onValueChange={(value) => field.onChange(value === NONE ? null : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NONE}>Sem departamento</SelectItem>
                              {departments.data?.map((department) => (
                                <SelectItem key={department.id} value={department.id}>
                                  {department.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      )}
                    />

                    <Field
                      label="Capacidade semanal (h)"
                      htmlFor="weekly_capacity_hours"
                      error={errors.weekly_capacity_hours?.message}
                    >
                      <Input
                        id="weekly_capacity_hours"
                        type="number"
                        min="0"
                        max="80"
                        step="1"
                        {...register('weekly_capacity_hours')}
                      />
                    </Field>
                  </div>

                  <Button type="submit" variant="brand" loading={isSubmitting}>
                    <Save className="size-4" />
                    Salvar alterações
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="acessos">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Perfis de acesso</CardTitle>
                <CardDescription>
                  As permissões são aplicadas no banco via Row Level Security — alterar aqui muda o que a
                  pessoa enxerga imediatamente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {people.isLoading ? (
                  <SkeletonTable rows={5} />
                ) : (
                  <ul className="divide-y">
                    {people.data?.map((person) => (
                      <li key={person.id} className="flex flex-wrap items-center gap-3 py-3">
                        <UserAvatar userId={person.id} name={person.full_name} src={person.avatar_url} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{person.full_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{person.email}</p>
                        </div>
                        <Select
                          value={person.role}
                          onValueChange={(value) => changeRole(person.id, value as AppRole)}
                          disabled={person.id === profile?.id}
                        >
                          <SelectTrigger className="w-48" aria-label={`Perfil de ${person.full_name}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {ROLE_OPTIONS.map((option) => (
                    <div key={option.value} className="rounded-lg border p-3">
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {ROLE_META[option.value].description}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="marca">
          <Card className="max-w-3xl">
            <CardHeader>
              <CardTitle className="text-base">Paleta institucional Grupo Moreno</CardTitle>
              <CardDescription>
                Cores aplicadas em toda a plataforma, nos gráficos e nos relatórios exportados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <BrandPills />

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { name: 'Verde institucional', hex: BRAND.green, use: 'Sucesso, saúde no prazo, conclusão' },
                  { name: 'Verde-limão', hex: BRAND.lime, use: 'Destaques, execução em andamento' },
                  { name: 'Azul institucional', hex: BRAND.blue, use: 'Cor primária, navegação e gráficos' },
                ].map((color) => (
                  <div key={color.hex} className="overflow-hidden rounded-lg border">
                    <div className="h-20" style={{ backgroundColor: color.hex }} />
                    <div className="p-3">
                      <p className="text-sm font-semibold">{color.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{color.hex}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{color.use}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                O tema claro/escuro é ajustado no menu do usuário e respeita a preferência do sistema
                operacional.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
