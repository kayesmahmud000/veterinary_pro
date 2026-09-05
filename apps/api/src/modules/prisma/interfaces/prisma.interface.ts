export interface DatabaseHealthResult {
  status: "up" | "down";
  latencyMs: number;
  timestamp: string;
  error?: string;
}

export interface IPrismaService {
  onModuleInit(): Promise<void>;
  onModuleDestroy(): Promise<void>;
  ping(): Promise<DatabaseHealthResult>;
  isHealthy(): Promise<boolean>;
}
