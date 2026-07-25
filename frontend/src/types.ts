export enum Status {
  Idle = "idle",
  Running = "running",
  Done = "done",
  Error = "error",
}

export enum JobEventType {
  Log = "log",
  Done = "done",
  Error = "error",
}

export type Result = { text: string; filename: string; format: string };
export type EngineInfo = { name: string; available: boolean; note: string };
export type Cookies = { present: boolean; name: string | null };
