import raw from "./demo-data.json";
import { demoDataSchema, type DemoData } from "./types";

/**
 * The only source of demo content (copied from design/demo-data.json).
 * Validated once at module load so every consumer gets fully typed data;
 * a mismatch between the JSON and the schema throws immediately in development.
 */
export const demoData: DemoData = demoDataSchema.parse(raw);

