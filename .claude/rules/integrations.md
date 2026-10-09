---
paths:
  - "packages/integrations/**"
  - "apps/web/app/api/**"
  - "apps/worker/**"
---

# Regras de integrações e jobs

- Consulte a documentação atual do provedor antes de escrever ou mudar um adaptador; guarde
  payloads reais de exemplo em `tests/fixtures/<provedor>/` e teste contra eles.
- Webhook: autentica, valida com Zod, grava em `webhook_events` (único por provedor + id
  externo), enfileira, responde 200. Processamento sempre no worker.
- Jobs idempotentes (use `singletonKey` quando fizer sentido), com retry e backoff.
- Repositórios usados pelo worker exigem `tenantId` explícito.
- Todo envio de WhatsApp passa por `WhatsAppGateway`, que verifica opt-out e janela de
  atendimento.
- Toda chamada ao LLM grava `ai_decisions` (modelo, versão do prompt, entrada resumida sem
  dados pessoais desnecessários, saída, latência).
- Timeouts explícitos em toda chamada de rede.
