# config

Application-wide configuration. Feature-specific configuration stays in its feature package
(for example `payment.service.PayWayConfig`).

- `AppProperties`: the typed `phumreader.*` settings. `RequiredSettings` stops the app at start-up and names
  any missing required setting.
- `SecurityConfig`: which routes are public and the access-token filter.
- `OpenApiConfig` and `RecordFieldsRequiredConverter`: the OpenAPI description behind
  `backend/openapi/openapi.json`.
- `ClockConfig`: the `Clock` bean, so tests can fix the time.

`config` may use any feature's `service` and `web` filters to wire them together; no feature uses `config`
classes directly except through Spring injection.
