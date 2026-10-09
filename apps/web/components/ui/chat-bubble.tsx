import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Balão da conversa. `from="lead"` à esquerda; `from="team"` (IA ou corretor) à direita. */
export function ChatBubble({
  from,
  time,
  children,
}: {
  from: 'lead' | 'team';
  time?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex max-w-[85%] flex-col gap-1 rounded-lg px-3.5 py-2.5 text-14 animate-message-in',
        from === 'lead' ? 'self-start bg-surface' : 'self-end bg-ink text-surface',
      )}
    >
      <p>{children}</p>
      {time ? (
        <span className={cn('font-mono text-12', from === 'lead' ? 'text-ink-3' : 'text-nav-text')}>
          {time}
        </span>
      ) : null}
    </div>
  );
}
