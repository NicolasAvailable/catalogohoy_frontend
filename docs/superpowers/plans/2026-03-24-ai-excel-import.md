# AI-Powered Excel Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to import Excel files with arbitrary column formats by falling back to Claude AI for column mapping and data normalization when the standard parser fails.

**Architecture:** Standard parse attempt first; on failure, extract raw Excel data, send to a Supabase Edge Function that calls Claude API for mapping+normalization, return `ProductExcelRow[]` to the existing preview flow. New `ai-analyzing` view with animated status messages during the AI call.

**Tech Stack:** Angular 20, Supabase Edge Functions (Deno), Claude API (`claude-sonnet-4-6`), XLSX, NgRx Signals, Lucide icons, `@sweet-monads/either`

**Spec:** `docs/superpowers/specs/2026-03-24-ai-excel-import-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `supabase/functions/ai-excel-mapper/index.ts` | Edge Function: receives raw Excel data, calls Claude API, returns mapped `ProductExcelRow[]` |
| Create | `libs/catalogohoy/product/src/domain/product-ai-excel.service.ts` | Abstract service contract for AI Excel parsing |
| Create | `libs/catalogohoy/product/src/infrastructure/product-ai-excel.service.ts` | Concrete service: calls Edge Function via `supabase.functions.invoke()` |
| Modify | `libs/catalogohoy/product/src/domain/index.ts` | Add barrel export for `BaseProductAiExcelService` |
| Modify | `libs/catalogohoy/product/src/infrastructure/index.ts` | Add barrel export for `ProductAiExcelService` |
| Modify | `libs/catalogohoy/product/src/infrastructure/product-excel.service.ts` | Add `extractRawData()` method |
| Modify | `libs/catalogohoy/product/src/presenter/views/import-export/import-export-hub.ts` | Add AI fallback flow, `ai-analyzing` view, rotating messages |
| Modify | `libs/catalogohoy/product/src/presenter/views/import-export/import-export-hub.html` | Add `ai-analyzing` template, update hub tile to "Importar con IA" |
| Modify | `libs/catalogohoy/core/src/providers/icons/providers/lucide.provide.ts` | Register `WandSparkles` icon |

---

### Task 1: Register new Lucide icons

**Files:**
- Modify: `libs/catalogohoy/core/src/providers/icons/providers/lucide.provide.ts`

- [ ] **Step 1: Add WandSparkles import and registration**

In the import block (line 2-110), add to the import list:

```typescript
WandSparkles,
```

In the `LucideAngularModule.pick({...})` object (line 114-221), add:

```typescript
WandSparkles,
```

- [ ] **Step 2: Verify the app still compiles**

Run: `npx nx build catalogohoy --skip-nx-cache 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add libs/catalogohoy/core/src/providers/icons/providers/lucide.provide.ts
git commit -m "feat(product): register WandSparkles and BrainCircuit Lucide icons"
```

---

### Task 2: Create the Supabase Edge Function `ai-excel-mapper`

**Files:**
- Create: `supabase/functions/ai-excel-mapper/index.ts`

- [ ] **Step 1: Create the Edge Function file**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const TARGET_SCHEMA = `TARGET FORMAT - each product must have these fields:
- name (string, required): product name
- description (string): product description, empty string if not found
- price (number, required): numeric price without currency symbols
- pricePromotional (number | null): promotional/sale price, null if not found
- stock (string | null): stock quantity as plain number string, null if not found or unlimited
- sku (string | null): SKU/product code, null if not found
- productionCost (number | null): production/manufacturing cost as number, null if not found
- categories (string): comma-separated category names, empty string if not found`;

const INSTRUCTIONS = `INSTRUCTIONS:
1. Identify which source column corresponds to each target field using fuzzy matching (e.g. "Articulo"->name, "Valor"->price, "Cantidad"->stock)
2. Normalize values: strip currency symbols ($, USD, RD$, etc.), extract numbers from strings like "50 unidades" or "$15.00", trim whitespace
3. For fields with no matching source column, use null (or empty string for name/description/categories)
4. price is REQUIRED - if you cannot determine a price for a row, set it to 0
5. Return ONLY a valid JSON array of objects with the target fields. No markdown fences, no explanation, no extra text.`;

function buildPrompt(
  headers: string[],
  rows: Record<string, unknown>[]
): string {
  return `You are a product data mapping assistant.

${TARGET_SCHEMA}

SOURCE DATA:
Column headers: ${JSON.stringify(headers)}
Rows (${rows.length} total):
${JSON.stringify(rows)}

${INSTRUCTIONS}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  // Verify JWT - reject anonymous calls
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ success: false, error: "Missing authorization header" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ success: false, error: "AI service not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { headers, rows } = await req.json() as {
      headers: string[];
      rows: Record<string, unknown>[];
    };

    if (!headers?.length || !rows?.length) {
      return new Response(JSON.stringify({ success: false, error: "Headers and rows are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (rows.length > 1000) {
      return new Response(JSON.stringify({
        success: false,
        error: "El archivo tiene demasiadas filas. El limite es 1000.",
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const prompt = buildPrompt(headers, rows);
    const maxTokens = Math.min(Math.max(4096, rows.length * 200), 64000);

    const response = await callClaude(prompt, maxTokens);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Claude API error:", errorBody);
      return new Response(JSON.stringify({ success: false, error: "Error al procesar con IA. Intenta de nuevo." }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const claudeResult = await response.json();
    const content = claudeResult.content?.[0]?.text ?? "";

    let mappedRows;
    try {
      mappedRows = JSON.parse(content);
    } catch {
      // Retry once with stricter instruction
      const retryResponse = await callClaude(
        prompt + "\n\nCRITICAL: Your previous response was not valid JSON. RESPOND WITH VALID JSON ONLY. No markdown fences.",
        maxTokens
      );
      if (!retryResponse.ok) {
        return new Response(JSON.stringify({ success: false, error: "Error al procesar con IA. Intenta de nuevo." }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
      const retryResult = await retryResponse.json();
      const retryContent = retryResult.content?.[0]?.text ?? "";
      try {
        mappedRows = JSON.parse(retryContent);
      } catch {
        return new Response(JSON.stringify({ success: false, error: "La IA no pudo procesar el archivo correctamente. Intenta con la plantilla." }), {
          status: 422,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    if (!Array.isArray(mappedRows)) {
      return new Response(JSON.stringify({ success: false, error: "La IA devolvio un formato inesperado." }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, mappedRows }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ success: false, error: "Error interno del servidor" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function callClaude(prompt: string, maxTokens: number): Promise<Response> {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
}
```

- [ ] **Step 2: Deploy the Edge Function via Supabase MCP**

Use the Supabase MCP `deploy_edge_function` tool to deploy the function. Then set the `ANTHROPIC_API_KEY` secret via `supabase secrets set ANTHROPIC_API_KEY=<key>` (ask user for the key value).

- [ ] **Step 3: Test the Edge Function manually**

Call the function via the Supabase MCP `execute_sql` or use curl to verify it returns a valid response with test data:

```json
{
  "headers": ["Articulo", "Valor", "Cantidad"],
  "rows": [
    { "Articulo": "Camisa azul", "Valor": "$15.00", "Cantidad": "50 unidades" }
  ]
}
```

Expected response: `{ "success": true, "mappedRows": [{ "name": "Camisa azul", "price": 15, ... }] }`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/ai-excel-mapper/index.ts
git commit -m "feat(product): add ai-excel-mapper Supabase Edge Function"
```

---

### Task 3: Create domain abstract service contract

**Files:**
- Create: `libs/catalogohoy/product/src/domain/product-ai-excel.service.ts`
- Modify: `libs/catalogohoy/product/src/domain/index.ts`

- [ ] **Step 1: Create the abstract service interface**

```typescript
import { E } from '@shared/domain';
import { ProductExcelRow } from './product-import-export.type';

export interface BaseProductAiExcelService {
  aiParse(
    headers: string[],
    rows: Record<string, unknown>[]
  ): Promise<E.Either<Error, ProductExcelRow[]>>;
}
```

- [ ] **Step 2: Add barrel export**

In `libs/catalogohoy/product/src/domain/index.ts`, add:

```typescript
export * from './product-ai-excel.service';
```

- [ ] **Step 3: Commit**

```bash
git add libs/catalogohoy/product/src/domain/product-ai-excel.service.ts libs/catalogohoy/product/src/domain/index.ts
git commit -m "feat(product): add BaseProductAiExcelService domain contract"
```

---

### Task 4: Create infrastructure AI Excel service

**Files:**
- Create: `libs/catalogohoy/product/src/infrastructure/product-ai-excel.service.ts`
- Modify: `libs/catalogohoy/product/src/infrastructure/index.ts`

- [ ] **Step 1: Create the concrete service**

```typescript
import { Injectable } from '@angular/core';
import { E } from '@shared/domain';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { BaseProductAiExcelService, ProductExcelRow } from '../domain';

@Injectable({ providedIn: 'root' })
export class ProductAiExcelService implements BaseProductAiExcelService {
  private readonly client = SupabaseClientProvider.getInstance();

  async aiParse(
    headers: string[],
    rows: Record<string, unknown>[]
  ): Promise<E.Either<Error, ProductExcelRow[]>> {
    const { data, error } = await this.client.functions.invoke('ai-excel-mapper', {
      body: { headers, rows },
    });

    if (error) {
      return E.left(new Error(error.message ?? 'Error al conectar con el servicio de IA'));
    }

    if (!data?.success) {
      return E.left(new Error(data?.error ?? 'Error desconocido del servicio de IA'));
    }

    return E.right(data.mappedRows as ProductExcelRow[]);
  }
}
```

- [ ] **Step 2: Add barrel export**

In `libs/catalogohoy/product/src/infrastructure/index.ts`, add:

```typescript
export * from './product-ai-excel.service';
```

- [ ] **Step 3: Verify compilation**

Run: `npx nx build catalogohoy --skip-nx-cache 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add libs/catalogohoy/product/src/infrastructure/product-ai-excel.service.ts libs/catalogohoy/product/src/infrastructure/index.ts
git commit -m "feat(product): add ProductAiExcelService infrastructure implementation"
```

---

### Task 5: Add `extractRawData()` method to `ProductExcelService`

**Files:**
- Modify: `libs/catalogohoy/product/src/infrastructure/product-excel.service.ts`

- [ ] **Step 1: Add the extractRawData method**

Add this method to the `ProductExcelService` class (after `parseExcelFile`, before `importRow`):

```typescript
public extractRawData(
  file: File
): Promise<E.Either<Error, { headers: string[]; rows: Record<string, unknown>[] }>> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        if (jsonRows.length === 0) {
          resolve(E.left(new Error('El archivo no contiene datos')));
          return;
        }

        const headers = Object.keys(jsonRows[0]);
        resolve(E.right({ headers, rows: jsonRows }));
      } catch {
        resolve(
          E.left(new Error('Error al leer el archivo. Asegurate de que sea un .xlsx valido.'))
        );
      }
    };

    reader.onerror = () => resolve(E.left(new Error('Error al leer el archivo')));
    reader.readAsArrayBuffer(file);
  });
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx nx build catalogohoy --skip-nx-cache 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add libs/catalogohoy/product/src/infrastructure/product-excel.service.ts
git commit -m "feat(product): add extractRawData method for AI fallback"
```

---

### Task 6: Update `import-export-hub.ts` with AI fallback logic

**Files:**
- Modify: `libs/catalogohoy/product/src/presenter/views/import-export/import-export-hub.ts`

- [ ] **Step 1: Add the AI analyzing view type and new imports**

Update the `View` type and add imports:

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  ViewChild,
} from '@angular/core';
```

Add to the existing domain import:

```typescript
import {
  ImportRowResult,
  ImportRowStatus,
  ImportSummary,
  ProductExcelRow,
} from '../../../domain';
```

Add new infrastructure import:

```typescript
import { ProductAiExcelService, ProductExcelService, ProductStore } from '../../../infrastructure';
```

Update the `View` type:

```typescript
type View =
  | 'hub'
  | 'export'
  | 'import-upload'
  | 'import-preview'
  | 'import-progress'
  | 'import-done'
  | 'ai-analyzing';
```

Add the AI status messages constant (outside the class):

```typescript
const AI_STATUS_MESSAGES = [
  { text: 'Analizando tu archivo...', icon: 'sparkles' },
  { text: 'Identificando columnas...', icon: 'search' },
  { text: 'Mapeando datos...', icon: 'arrow-up-down' },
  { text: 'Normalizando informacion...', icon: 'wand-sparkles' },
  { text: 'Preparando vista previa...', icon: 'eye' },
];
```

- [ ] **Step 2: Add new signals and inject AI service**

Add to the component class:

```typescript
private readonly aiExcelService = inject(ProductAiExcelService);
private readonly destroyRef = inject(DestroyRef);

public readonly aiStatusMessage = signal(AI_STATUS_MESSAGES[0]);
private aiMessageInterval: ReturnType<typeof setInterval> | null = null;
```

- [ ] **Step 3: Add AI status message rotation methods**

Add these private methods to the class:

```typescript
private startAiMessages(): void {
  let index = 0;
  this.aiStatusMessage.set(AI_STATUS_MESSAGES[0]);
  this.aiMessageInterval = setInterval(() => {
    index = (index + 1) % AI_STATUS_MESSAGES.length;
    this.aiStatusMessage.set(AI_STATUS_MESSAGES[index]);
  }, 3000);
}

private stopAiMessages(): void {
  if (this.aiMessageInterval) {
    clearInterval(this.aiMessageInterval);
    this.aiMessageInterval = null;
  }
}
```

- [ ] **Step 4: Replace the `processFile` method with AI fallback**

Replace the existing `processFile` method:

```typescript
private async processFile(file: File): Promise<void> {
  const result = await this.excelService.parseExcelFile(file);

  if (result.isRight()) {
    this.parsedRows.set(result.value);
    this.view.set('import-preview');
    return;
  }

  // Standard parse failed — try AI fallback
  this.view.set('ai-analyzing');
  this.startAiMessages();

  const rawResult = await this.excelService.extractRawData(file);

  if (rawResult.isLeft()) {
    this.stopAiMessages();
    toast.error(rawResult.value.message);
    this.view.set('import-upload');
    return;
  }

  const { headers, rows } = rawResult.value;
  const aiResult = await this.aiExcelService.aiParse(headers, rows);

  this.stopAiMessages();

  if (aiResult.isRight()) {
    this.parsedRows.set(aiResult.value);
    this.view.set('import-preview');
    toast.success('Archivo analizado con IA correctamente');
  } else {
    toast.error(aiResult.value.message);
    this.view.set('import-upload');
  }
}
```

- [ ] **Step 5: Add cleanup on destroy**

Add to the constructor area (or use `DestroyRef`):

```typescript
constructor() {
  this.destroyRef.onDestroy(() => this.stopAiMessages());
}
```

- [ ] **Step 6: Commit**

```bash
git add libs/catalogohoy/product/src/presenter/views/import-export/import-export-hub.ts
git commit -m "feat(product): add AI fallback logic to import-export hub"
```

---

### Task 7: Update `import-export-hub.html` template

**Files:**
- Modify: `libs/catalogohoy/product/src/presenter/views/import-export/import-export-hub.html`

- [ ] **Step 1: Update the Import tile in hub view**

Find the Import tile button (around line 39-55) and replace:

```html
<!-- Import tile -->
<button
  (click)="onImport()"
  class="flex flex-col items-center gap-4 p-8 border-2 border-gray-100 rounded-2xl
         hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group"
>
  <div
    class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center
           group-hover:bg-blue-100 transition-colors"
  >
    <ui-icon name="sparkles" styleClass="w-8 h-8 text-blue-600" />
  </div>
  <h3 class="text-lg font-bold text-gray-900">Importar con IA</h3>
  <p class="text-sm text-gray-500 text-center">
    Sube cualquier archivo Excel y la IA mapeara tus productos automaticamente
  </p>
</button>
```

- [ ] **Step 2: Add the `ai-analyzing` view template**

Add this block after the `import-upload` section (before `import-preview`):

```html
<!-- AI ANALYZING VIEW -->
@if (view() === 'ai-analyzing') {
<section class="flex flex-col items-center gap-6 p-12">
  <div
    class="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center"
  >
    <ui-icon
      [name]="aiStatusMessage().icon"
      styleClass="w-10 h-10 text-blue-500 animate-pulse"
    />
  </div>
  <div class="text-center">
    <p class="text-lg font-semibold text-gray-700">
      {{ aiStatusMessage().text }}
    </p>
    <p class="text-sm text-gray-400 mt-2">
      Esto puede tardar unos segundos
    </p>
  </div>
  <div class="w-full max-w-xs">
    <div class="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        class="h-full bg-blue-500 rounded-full indeterminate-bar"
        style="width: 40%"
      ></div>
    </div>
  </div>
</section>
}
```

- [ ] **Step 3: Add the indeterminate animation CSS**

Add a `styles` property to the component decorator in `import-export-hub.ts`:

```typescript
styles: [`
  .indeterminate-bar {
    animation: indeterminate 1.5s ease-in-out infinite;
  }
  @keyframes indeterminate {
    0% { transform: translateX(-100%); }
    50% { transform: translateX(100%); }
    100% { transform: translateX(200%); }
  }
`],
```

- [ ] **Step 4: Verify compilation and visual check**

Run: `npx nx build catalogohoy --skip-nx-cache 2>&1 | tail -5`
Expected: Build succeeds

Optionally serve and visually verify: `npm run serve:catalogohoy`

- [ ] **Step 5: Commit**

```bash
git add libs/catalogohoy/product/src/presenter/views/import-export/import-export-hub.html libs/catalogohoy/product/src/presenter/views/import-export/import-export-hub.ts
git commit -m "feat(product): add AI analyzing view and update import tile UI"
```

---

### Task 8: Final integration test

- [ ] **Step 1: Serve the app and test the full flow**

Run: `npm run serve:catalogohoy`

Manual test checklist:
1. Open Products page → click "Importar / Exportar"
2. Verify the Import tile shows "Importar con IA" with sparkles icon
3. Verify the X close button appears on the dialog
4. Click Import → upload an Excel with standard format (`nombre`, `precio` columns) → should go directly to preview (no AI call)
5. Click Import → upload an Excel with non-standard columns (e.g. "Articulo", "Valor") → should show AI analyzing animation → then preview with mapped data
6. Verify the rotating messages cycle every ~3 seconds
7. From preview, click Import → verify products are created correctly

- [ ] **Step 2: Test error cases**

1. Upload an empty Excel → should show error toast
2. Upload a non-xlsx file → should show error toast
3. Disconnect network during AI analysis → should show error and return to upload view

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(product): address integration test findings"
```
