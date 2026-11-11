import raw from "./demo-data.json";
import { demoDataSchema, type DemoData } from "./types";

/**
 * The only source of demo content: design/demo-data.json (V2.1), written to src/data/demo-data.json by
 * `npm run data:sync` (series and coin packs converted to the V1 shape that the backend seed also reads).
 * Validated once at module load so every consumer gets fully typed data;
 * a mismatch between the JSON and the schema throws immediately in development.
 */
export const demoData: DemoData = demoDataSchema.parse(raw);
