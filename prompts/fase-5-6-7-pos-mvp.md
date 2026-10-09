# Fases 5, 6 e 7: Pós-MVP

Só comece depois de 2 a 4 semanas de uso real do MVP. Revise este arquivo com o que aprendeu.

---

## Fase 5: Imóveis

### 5.1 · Plano
**Modelo:** `opus` · **Esforço:** `medium` · **Modo:** plano
```
Leia CLAUDE.md e docs/ARCHITECTURE.md. Proponha o modelo de imóveis para o nosso público
(empreendimentos com várias unidades + imóveis avulsos), fotos no Supabase Storage com RLS,
status (disponível, reservado, vendido), proprietário, corretor captador, e a tabela deals
(lead + imóvel + corretor vendedor + valor em centavos). Inclua como a IA da triagem vai
consultar a lista de imóveis disponíveis sem inventar preço. Escreva os critérios de aceite
da fase em docs/VALIDATION.md. Espere aprovação.
```

### 5.2 · Implementação
**Modelo:** `sonnet` · **Esforço:** `medium`
```
Implemente o plano 5.1: migrations com RLS e testes, CRUD de imóveis com upload de fotos
(compressão no cliente), vínculo na ficha do lead, criação de negócio ao mover para Fechado,
e ferramenta de consulta de imóveis para a IA (só dados publicados pelo tenant).
```

### 5.3 · Revisão
**Modelo:** `opus` · **Esforço:** `high`
```
/revisar-fase 5
```

---

## Fase 6: Comissões

Responda Q11 de `docs/DECISIONS.md` **com exemplos reais** de vendas da imobiliária antes de começar.

### 6.1 · Plano
**Modelo:** `opus` · **Esforço:** `xhigh` · **Modo:** plano
```
Leia CLAUDE.md, docs/DECISIONS.md (ADR-004 e Q11) e docs/VALIDATION.md (requisitos de
comissões). Proponha:
- modelo de dados: commission_rules (versionadas, nunca editadas depois de usadas),
  commission_splits, commission_entries (por beneficiário) e commission_entry_history;
- ciclo prevista → a receber → liberada → paga, estorno por distrato com lançamentos negativos;
- gatilho de liberação configurável;
- divisão com método do maior resto e prova de que a soma bate ao centavo;
- preparação para comissão parcelada e parceria entre imobiliárias (só no modelo);
- papel financeiro e permissões.
Monte 8 casos de teste a partir dos exemplos reais da Q11. Escreva os critérios em
docs/VALIDATION.md. Faça perguntas onde a regra for ambígua. Espere aprovação.
```

### 6.2 · Motor de cálculo
**Modelo:** `opus` · **Esforço:** `high`
```
Implemente em packages/core o cálculo de comissão (puro, só inteiros), com testes de tabela
para os 8 casos do plano e testes baseados em propriedades (fast-check): para qualquer valor e
qualquer divisão, a soma dos lançamentos é exatamente o total e nenhum valor é negativo fora
de estorno.
```

### 6.3 · Persistência, ciclo de vida e telas
**Modelo:** `sonnet` · **Esforço:** `high`
```
Implemente migrations com RLS e audit_log por trigger, geração de lançamentos ao fechar
negócio, transições de status com checagem de papel, estorno, e as telas: configuração de
regras (admin), lançamentos do negócio, extrato do corretor.
```

### 6.4 · Revisão
**Modelo:** `opus` · **Esforço:** `xhigh`
```
/revisar-fase 6
Tente quebrar o cálculo: valores de 1 centavo, divisões que não fecham 100%, estorno de
estorno, alteração de regra depois de lançamentos gerados.
```

---

## Fase 7: Relatórios e extrato

### 7.1 · Implementação
**Modelo:** `sonnet` · **Esforço:** `medium`
```
Implemente relatórios para gerente e financeiro: conversão por origem e por corretor (funil
com taxas entre etapas), tempo médio de 1º contato, desempenho da IA (triagens concluídas,
distribuição por status), extrato mensal de comissões por corretor com fechamento do mês e
exportação CSV. Gráficos simples e legíveis, cores dos tokens do docs/DESIGN.md. Use views ou
funções SQL com RLS; nada de cálculo pesado no cliente.
```

### 7.2 · Revisão
**Modelo:** `opus` · **Esforço:** `high`
```
/revisar-fase 7
Confira se cada número dos relatórios bate com uma query independente.
```
