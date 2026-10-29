export interface CanvasAssignmentGroup {
  id: number;  // TypeScript doesn't have `ulong`, so using `number` for large integers.
  name: string;
  position: number;
  group_weight: number;
  // sis_source_id?: string;  // Uncomment if needed.
  // integration_data?: Record<string, string>;  // Uncomment if needed.
  /** Present when asked for with include[]=assignments. */
  assignments?: { id: number }[];
  // rules?: any;  // Assuming 'rules' is of unknown type, so using 'any' here.
}