# Advanced Options Console

This module introduces a centralized admin experience for toggling dropdown catalogs, amenities, and bulk data warping. It ties into the `/admin/advanced-options` route and reuses the new dropdowning service everywhere those values are consumed.

## Backend APIs

### Dropdowns

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/api/dropdowns` | List all dropdown categories with their options. |
| `POST` | `/api/dropdowns` | Create a new dropdown category (requires `key` + `name`). |
| `GET` | `/api/dropdowns/:key` | Fetch options for the given category key (e.g., `property.status`). |
| `POST` | `/api/dropdowns/:key` | Add a new option to the category (label + value). |
| `PUT` | `/api/dropdowns/options/:id` | Update a single option by id. |
| `DELETE` | `/api/dropdowns/options/:id` | Remove a single option. |

### Amenities

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/api/amenities` | List all master amenities. |
| `POST` | `/api/amenities` | Create a new amenity record. |
| `PUT` | `/api/amenities/:id` | Update an existing amenity. |
| `DELETE` | `/api/amenities/:id` | Delete an amenity. |

### Bulk Data

#### Full export / import
`/api/advanced-options/export/full-csv` produces a single CSV where each row carries the module, table, and JSON payload; the UI exposes an “Export CSV” button that downloads this file. Uploading that CSV via `/api/advanced-options/import/full-csv` (triggered by the sidebar import button) replays every row against the correct table, so added records show up immediately and existing ones update.

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/api/advanced-options/export` | Return JSON payloads for each requested table (properties, deals, ledger entries, transactions, payments, tenant payments, amenities, dropdown_options). |
| `POST` | `/api/advanced-options/import` | Accept a `table` + `rows` payload and upsert each row (returns counts of inserted/updated/failed rows). |

All routes are guarded with `authenticate` + `requireAdmin` and log to `audit_log`.

## Frontend Hooks

- `hooks/use-dropdowns.ts` exposes `useDropdownCategories()` and `useDropdownOptions(categoryKey)` so forms can pull the latest options and automatically refresh after updates.
- `hooks/use-amenities.ts` returns the current amenity master list with revalidation helpers.

Existing forms now use these hooks:

- `components/properties/add-property-dialog.tsx` pulls `property.status` and the amenity catalog for the multi-select field.
- `components/crm/add-deal-dialog.tsx` sources `deal.stage` and `deal.status` from the dropdown service.

## Advanced Options Page

Located at `/admin/advanced-options`, it renders:

1. `DropdownManager` – browse categories, add new ones, and CRUD options.
2. `AmenitiesManager` – manage amenity metadata and activation status.
3. `BulkExport` / `BulkImport` – export JSON data and build Excel/CSV downloads (front-end bundles the files via `xlsx` / `jszip`).
4. Placeholder "Other Options" controls for future features (rows per page, audit toggles).

## Example `curl` commands

Replace `TOKEN` with a valid admin bearer token (`Bearer <token>`). The curl commands assume the API runs at `http://localhost:3001`.

```bash
# List property status options
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/dropdowns/property.status

# Add a new dropdown option to deal stage
curl -X POST -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"label":"Negotiation Prep","value":"negotiation-prep","sortOrder":8}' \
  http://localhost:3001/api/dropdowns/deal.stage

# Export selected tables (JSON output consumed by the UI)
curl -X POST -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"tables":["properties","deals","ledger_entries"]}' \
  http://localhost:3001/api/advanced-options/export > export.json

# Import rows for ledger entries
curl -X POST -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"table":"ledger_entries","rows":[{"id":"123","dealId":"abc","accountDebit":"cash","accountCredit":"revenue","amount":25000}]}' \
  http://localhost:3001/api/advanced-options/import
```

## Security Notes

- The page and APIs require admin privileges or a permission that begins with `advanced.*` (nav entry only shows when the current user has that permission).
- All CRUD operations feed into `audit_log`, capturing the user, action, before/after values, and metadata.

