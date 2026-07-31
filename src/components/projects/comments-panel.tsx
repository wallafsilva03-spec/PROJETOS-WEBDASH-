'use client';

import * as React from 'react';
import { AtSign, MessageSquare, Send, Smile, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { UserAvatar } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/misc';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useComments, useDeleteComment, useSendComment } from '@/hooks/use-comments';
import { useProjectMembers } from '@/hooks/use-projects';
import { useSession } from '@/hooks/use-session';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';

const EMOJIS = ['👍', '🎉', '🚀', '✅', '⚠️', '🔥', '💡', '📌', '🙏', '👏', '😀', '😅', '🤝', '📊', '⏰', '❤️'];

/** Destaca @menções no corpo do comentário. */
function renderBody(body: string) {
  return body.split(/(@[\p{L}][\p{L}\d._-]*)/gu).map((chunk, index) =>
    chunk.startsWith('@') ? (
      <span key={index} className="rounded bg-primary/10 px-1 font-medium text-primary">
        {chunk}
      </span>
    ) : (
      <React.Fragment key={index}>{chunk}</React.Fragment>
    ),
  );
}

interface CommentsPanelProps {
  projectId: string;
  taskId?: string | null;
  compact?: boolean;
}

export function CommentsPanel({ projectId, taskId = null, compact = false }: CommentsPanelProps) {
  const { profile } = useSession();
  const { data, isLoading } = useComments(projectId, taskId);
  const sendComment = useSendComment(projectId, taskId);
  const deleteComment = useDeleteComment(projectId, taskId);
  const members = useProjectMembers(projectId);

  const [body, setBody] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const comments = data ?? [];

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [comments.length]);

  function insert(text: string) {
    setBody((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}${text}`);
    textareaRef.current?.focus();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = body.trim();
    if (!value) return;
    await sendComment.mutateAsync(value);
    setBody('');
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit(event as unknown as React.FormEvent);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex-1 space-y-4 overflow-y-auto pr-1 scrollbar-thin',
          compact ? 'max-h-72' : 'max-h-[28rem]',
        )}
      >
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : comments.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Nenhum comentário"
            description="Inicie a conversa. Use @ para mencionar alguém da equipe."
            className="border-0 bg-transparent py-8"
          />
        ) : (
          comments.map((comment) => {
            const isMine = comment.author_id === profile?.id;
            return (
              <article key={comment.id} className="group flex gap-3">
                <UserAvatar
                  userId={comment.author?.id}
                  name={comment.author?.full_name}
                  src={comment.author?.avatar_url}
                  className="size-8 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <header className="flex items-center gap-2">
                    <span className="text-sm font-medium">{comment.author?.full_name ?? 'Usuário'}</span>
                    <time className="text-xs text-muted-foreground" dateTime={comment.created_at}>
                      {formatRelative(comment.created_at)}
                    </time>
                    {isMine && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="ml-auto opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={() => deleteComment.mutate(comment.id)}
                        aria-label="Excluir comentário"
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    )}
                  </header>
                  <p className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-secondary px-3 py-2 text-sm">
                    {renderBody(comment.body)}
                  </p>
                </div>
              </article>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="mt-4 space-y-2 border-t pt-4">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={onKeyDown}
          rows={compact ? 2 : 3}
          placeholder="Escreva um comentário… use @nome para mencionar (Ctrl+Enter envia)"
          aria-label="Novo comentário"
        />
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Inserir emoji">
                <Smile className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <div className="grid grid-cols-8 gap-1">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => insert(emoji)}
                    className="rounded p-1 text-lg transition-colors hover:bg-secondary"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Mencionar alguém">
                <AtSign className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-1">
              <div className="max-h-56 overflow-y-auto scrollbar-thin">
                {(members.data ?? []).map((member) => (
                  <button
                    key={member.user_id}
                    type="button"
                    onClick={() => insert(`@${(member.profile?.full_name ?? '').split(' ')[0]}`)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
                  >
                    <UserAvatar
                      userId={member.user_id}
                      name={member.profile?.full_name}
                      src={member.profile?.avatar_url}
                      className="size-6"
                    />
                    <span className="truncate">{member.profile?.full_name}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            type="submit"
            variant="brand"
            size="sm"
            className="ml-auto"
            loading={sendComment.isPending}
            disabled={!body.trim()}
          >
            <Send className="size-3.5" />
            Enviar
          </Button>
        </div>
      </form>
    </div>
  );
}
