# Correção do Mapeamento de Campos de Centro (Center Field Mapping)

## Problema Identificado
Ao criar eventos com hình thức Offline, os campos de **address** e **cơ sở** (center) não estavam sendo exibidos corretamente no formulário, pois o mapeamento dos dados do banco de dados estava inconsistente.

### Raiz do Problema
1. **Database centers table** (V74) contém:
   - `full_name`: "MindX Hoàng Đạo Thúy" (nome longo formal)
   - `display_name`: "Hoàng Đạo Thúy" (nome curto para display)
   - `address`: "Tầng 2, Tòa 29T1 Hoàng Đạo Thúy, Cầu Giấy, Hà Nội" (endereço curto)
   - `full_address`: "Tầng 2, Tòa 29T1 Hoàng Đạo Thúy, Cầu Giấy, Hà Nội" (endereço completo, V74)
   - `map_url`: Google Maps link (V74)
   - `map_link`: Google Maps link (legacy)

2. **API /api/event-schedules/centers** estava retornando:
   ```javascript
   center_name: row.full_name  // ❌ Deveria ser display_name
   ```
   Resultado: Dropdown mostra "MindX Hoàng Đạo Thúy" (muito longo) em vez de "Hoàng Đạo Thúy" (limpo)

3. **API /api/event-schedules GET** estava retornando:
   ```sql
   c.full_name AS center_name,           -- ❌ Deveria priorizar display_name
   c.address AS center_address,          -- ❌ Deveria priorizar full_address
   ```
   Resultado: Eventos carregados mostravam endereço incompleto

## Correções Aplicadas

### 1. Arquivo: `/app/api/event-schedules/centers/route.ts`
**Mudança**: Atualizar mapeamento para usar `display_name` como `center_name`

```javascript
// ❌ Antes
center_name: row.full_name,

// ✅ Depois
center_name: row.display_name || row.full_name,
full_name: row.full_name,  // Adicionar para referência se necessário
```

**Impacto**:
- Dropdown de centros agora exibe "Hoàng Đạo Thúy" em vez de "MindX Hoàng Đạo Thúy"
- UI form recebe dados corretos para exibição

### 2. Arquivo: `/app/api/event-schedules/route.ts`
**Mudança**: Atualizar query SQL para priorizar campos mais completos

```sql
-- ❌ Antes
c.full_name AS center_name,
c.address AS center_address,

-- ✅ Depois  
COALESCE(c.display_name, c.full_name) AS center_name,
COALESCE(c.full_address, c.address) AS center_address,
```

**Impacto**:
- Eventos carregados do banco mostram `display_name` (curto, limpo)
- Endereço utiliza `full_address` (completo) da V74, fallback para `address` se necessário
- Consistência entre criar novo evento e carregar eventos existentes

## Schema de Dados Resultante

### Centers Table (após V74)
| Campo | Tipo | Exemplo | Uso |
|-------|------|---------|-----|
| `id` | INT | 1 | Primary Key |
| `full_name` | VARCHAR(255) | "MindX Hoàng Đạo Thúy" | Registro formal |
| `display_name` | VARCHAR(255) | "Hoàng Đạo Thúy" | **UI Dropdown** |
| `address` | VARCHAR(500) | "Tầng 2, Tòa 29T1..." | Fallback |
| `full_address` | TEXT | "Tầng 2, Tòa 29T1..." (V74) | **UI Display (prioritário)** |
| `map_url` | TEXT | "https://maps.google.com/..." | **Bảng đồ** |
| `map_link` | VARCHAR(500) | "https://maps.google.com/..." | Fallback |
| `latitude` | DECIMAL(10,7) | 20.9935 | Localização |
| `longitude` | DECIMAL(10,7) | 105.7972 | Localização |
| `hotline` | VARCHAR(50) | "090-123-4567" | Contacto |

### Event Schedule Form - Center Preview
```
┌─────────────────────────────────────────┐
│ Hoàng Đạo Thúy                  (curto)│  ← display_name
│ Tầng 2, Tòa 29T1 Hoàng Đạo...  (longo)│  ← full_address
│ [Copy địa chỉ] [Xem bản đồ]             │
└─────────────────────────────────────────┘
```

## Testing Checklist
- ✅ **Dropdown**: Selecionar "Hoàng Đạo Thúy" (display_name)
- ✅ **Form Preview**: Mostra "Hoàng Đạo Thúy" + endereço completo
- ✅ **Create Event**: POST com `center_id` + `room` + endereço correto
- ✅ **Load Event**: GET mostra `display_name` + `full_address`
- ✅ **Copy Address**: Funciona com `full_address`
- ✅ **View Map**: Link abre Google Maps com `map_url`

## Deployment Notes
- Nenhuma migração de banco necessária
- Mudanças apenas em API mapping
- Retrocompatibilidade total (ambos `full_name` e `display_name` existem)
- Fallback automático se `display_name` for NULL

## Related Files Modified
1. `app/api/event-schedules/centers/route.ts` - Centers list API
2. `app/api/event-schedules/route.ts` - Event schedules GET query

## Related Files Unchanged (mas válidas)
- `app/admin/page4/lich-danh-gia/page.tsx` - UI form (usa dados corrigidos)
- `app/api/event-schedules/route.ts` POST - Event creation (salva center_id)
- `lib/migrations.ts` - V74 migration (schemas corretos)
