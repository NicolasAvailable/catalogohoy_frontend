# AI-Powered Excel Import

## Overview

Allow users to import product data from Excel files that don't follow the app's expected format. When the standard parser fails (missing `nombre`/`precio` columns), the system falls back to a Supabase Edge Function that uses Claude API to map and normalize the user's columns into the expected `ProductExcelRow` format.

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Where does AI run? | Supabase Edge Function | API key stays server-side; Supabase MCP available for deployment |
| When does AI activate? | Only when standard `parseExcelFile()` fails | Saves tokens when user already has correct format |
| What data goes to Claude? | Headers + all rows as JSON | Frontend already has XLSX lib; sending JSON is cheaper than binary |
| What does Claude do? | Map columns + normalize values | Users have messy data ($15.00, "50 unidades") that needs cleaning |
| UX during analysis? | Animated rotating status messages | Gives the user feedback during the ~5-15s wait |

## Architecture

```
User uploads .xlsx
       |
       v
ProductExcelService.parseExcelFile(file)
       |
   Has "nombre" + "precio" columns?
      / \
    YES   NO
     |      |
     v      v
  Existing  ProductAiExcelService.aiParse(headers, rows)
  flow           |
     |           v
     |     Supabase Edge Function: ai-excel-mapper
     |           |
     |           v
     |     Claude API: map + normalize all rows
     |           |
     |           v
     |     Returns ProductExcelRow[]
     |           |
     v           v
  parsedRows signal <- merged entry point
       |
       v
  Existing preview -> confirm -> import flow
```

## Supabase Edge Function: `ai-excel-mapper`

### Request

```typescript
POST /functions/v1/ai-excel-mapper

{
  headers: string[],          // column names from the user's Excel
  rows: Record<string, any>[] // all data rows as key-value objects
}
```

### Logic

1. Verify JWT from `Authorization` header — reject anonymous calls to prevent API token abuse
2. Validate input (headers present, rows non-empty, reject if rows > 1000 with error message)
3. Build Claude prompt with:
   - Target schema description (ProductExcelRow fields, types, constraints)
   - User's headers
   - All rows to map and normalize
4. Call Claude API (`claude-sonnet-4-6` for speed/cost balance) with `max_tokens` scaled to row count
5. Parse Claude's JSON response (if invalid JSON, retry once with `"RESPOND WITH VALID JSON ONLY"` appended)
6. Return mapped rows

### Response

```typescript
{
  success: true,
  mappedRows: ProductExcelRow[]
}
// or
{
  success: false,
  error: string
}
```

### Claude Prompt (schema)

```
You are a product data mapping assistant.

TARGET FORMAT - each product must have these fields:
- name (string, required): product name
- description (string): product description, empty string if not found
- price (number, required): numeric price without currency symbols
- pricePromotional (number | null): promotional price, null if not found
- stock (string | null): stock quantity as plain number string, null if not found
- sku (string | null): SKU code, null if not found
- productionCost (number | null): production cost as number, null if not found
- categories (string): comma-separated category names, empty string if not found

SOURCE DATA:
Headers: {headers}
Rows: {rows}

INSTRUCTIONS:
1. Identify which source column corresponds to each target field (fuzzy match: "Articulo"→name, "Valor"→price, etc.)
2. Normalize values: strip currency symbols ($, USD, etc.), extract numbers from strings like "50 unidades", trim whitespace
3. For fields with no matching column, use null (or empty string for name/description/categories)
4. price is REQUIRED — if you cannot determine a price for a row, set it to 0
5. Return ONLY a JSON array of objects with the target fields. No explanation.
```

### Environment Variables

- `ANTHROPIC_API_KEY`: Claude API key (set in Supabase Edge Function secrets)

## Frontend Changes

### 1. New service: `ProductAiExcelService`

**Location:** `libs/catalogohoy/product/src/infrastructure/product-ai-excel.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class ProductAiExcelService {
  private readonly client = SupabaseClientProvider.getInstance();

  async aiParse(
    headers: string[],
    rows: Record<string, any>[]
  ): Promise<Either<Error, ProductExcelRow[]>> {
    // calls this.client.functions.invoke('ai-excel-mapper', { body: { headers, rows } })
    // returns Either<Error, ProductExcelRow[]>
  }
}
```

**Domain contract:** Define abstract `BaseProductAiExcelService` in `libs/catalogohoy/product/src/domain/product-ai-excel.service.ts` with the `aiParse` signature. Export from `domain/index.ts`.

**Barrel export:** Export `ProductAiExcelService` from `libs/catalogohoy/product/src/infrastructure/index.ts`.

### 2. New method in `ProductExcelService`

```typescript
extractRawData(file: File): Promise<Either<Error, { headers: string[], rows: Record<string, any>[] }>>
```

Parses the Excel file with XLSX and returns raw headers + rows without any column validation. This is the data that gets sent to the AI service.

### 3. Modified `import-export-hub.ts`

**View type update:** Add `'ai-analyzing'` to the `View` union type.

**New signals:**
- `isAiAnalyzing: Signal<boolean>` — controls the AI analyzing view
- `aiStatusMessage: Signal<string>` — current rotating status message

**Modified `processFile(file: File)`:**
```
1. Try parseExcelFile(file)
2. If success → existing flow (set parsedRows, show preview)
3. If error (missing columns) →
   a. Set isAiAnalyzing = true, view = 'ai-analyzing'
   b. Start rotating status messages
   c. Call extractRawData(file) to get headers + rows
   d. Call aiExcelService.aiParse(headers, rows)
   e. If success → set parsedRows with result, view = 'import-preview'
   f. If error → show error with retry option
   g. Set isAiAnalyzing = false
```

**New view `ai-analyzing`:**
```
+------------------------------------------+
|                  [X]                      |
|                                           |
|          ✨ (animated sparkles)           |
|                                           |
|     "Identificando columnas..."           |
|     (rotates every 3 seconds)             |
|                                           |
|     ████████░░░░░░░░ (indeterminate)      |
|                                           |
+------------------------------------------+
```

Rotating messages (cycle every ~3s) — use `transloco` keys (`product.import.ai.*`):
1. "Analizando tu archivo..." (sparkles icon)
2. "Identificando columnas..." (search icon)
3. "Mapeando datos..." (arrows icon)
4. "Normalizando informacion..." (wand-sparkles icon)
5. "Preparando vista previa..." (eye icon)

### 4. Modified hub view

The import tile text changes from "Importar" to "Importar con IA" with a sparkles icon:

```html
<!-- Import tile -->
<button (click)="onImport()">
  <div class="icon-circle bg-blue-50">
    <ui-icon name="sparkles" />   <!-- changed from "upload" -->
  </div>
  <h3>Importar con IA</h3>
  <p>Sube cualquier archivo Excel y la IA mapeara tus productos automaticamente</p>
</button>
```

## Data Flow Summary

```
Excel file (.xlsx)
  → [Frontend] XLSX.parse → { headers, rows } (raw)
  → [Frontend] try standard parse first
  → [Frontend] if fails → POST to Edge Function
  → [Supabase Edge Function] build Claude prompt
  → [Claude API] analyze + map + normalize
  → [Edge Function] parse JSON response → ProductExcelRow[]
  → [Frontend] set parsedRows signal
  → [Frontend] existing preview → confirm → import-row-by-row
```

## Error Handling

| Scenario | Handling |
|---|---|
| Edge Function unreachable | Show error toast, offer retry or template download |
| Claude API error (rate limit, timeout) | Show error with retry button |
| Claude returns invalid JSON | Retry once appending "RESPOND WITH VALID JSON ONLY", then show error |
| Claude can't map required field (name) | Set name to first text-like column, price to 0; user validates in preview |
| Excel has > 1000 rows | Show error "El archivo tiene demasiadas filas. El limite es 1000." and offer template download |
| Empty Excel | Show "El archivo no contiene datos" error |

## Scope

### In scope
- Supabase Edge Function `ai-excel-mapper`
- `ProductAiExcelService` (new service)
- `extractRawData()` method in `ProductExcelService`
- Modified `processFile()` flow with AI fallback
- `ai-analyzing` view with rotating messages
- Hub tile update ("Importar con IA" + sparkles)

### Lucide icons to register

New icons needed in Lucide icon registry (`libs/catalogohoy/core/src/providers/icons/providers/lucide.provide.ts`):

- `Sparkles` — already registered, no action needed
- `WandSparkles` — AI analyzing rotating message (correct Lucide export name)
- `BrainCircuit` — AI analyzing rotating message (alternative)

### Out of scope

- Batch processing for very large files (can add later)
- Column mapping review/edit screen (Claude handles it)
- Saving mapping rules for repeated imports
- Export changes (stays as-is)
