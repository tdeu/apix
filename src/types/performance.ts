// Performance Optimization Type Definitions for APIX AI

export interface PerformanceConfiguration {
  caching: CachingConfiguration;
  batching: BatchingConfiguration;
  optimization: OptimizationConfiguration;
  monitoring: MonitoringConfiguration;
  resourceManagement: ResourceManagementConfiguration;
}

export interface CachingConfiguration {
  enabled: boolean;
  defaultTTL: number; // milliseconds
  maxAIResponses: number;
  maxTemplates: number;
  maxParameters: number;
  templateTTL: number;
  parameterTTL: number;
  warmupEnabled: boolean;
  compressionEnabled: boolean;
  persistentCache: boolean;
}

export interface BatchingConfiguration {
  enabled: boolean;
  maxBatchSize: number;
  batchTimeout: number; // milliseconds
  priorityLevels: string[];
  backpressureHandling: 'queue' | 'drop' | 'throttle';
  maxQueueSize: number;
}

export interface OptimizationConfiguration {
  autoOptimizationEnabled: boolean;
  gcThreshold: number; // MB
  memoryThreshold: number; // MB
  responseTimeThreshold: number; // milliseconds
  cacheHitThreshold: number; // percentage (0-1)
  optimizationInterval: number; // milliseconds
}

export interface MonitoringConfiguration {
  enabled: boolean;
  metricsInterval: number; // milliseconds
  retentionPeriod: number; // milliseconds
  alertThresholds: AlertThresholds;
  exportEnabled: boolean;
  exportFormat: 'prometheus' | 'json' | 'csv';
}

export interface ResourceManagementConfiguration {
  connectionPooling: ConnectionPoolConfiguration;
  workerThreads: WorkerThreadConfiguration;
  memoryManagement: MemoryManagementConfiguration;
  cpuOptimization: CPUOptimizationConfiguration;
}

export interface AlertThresholds {
  highMemoryUsage: number; // MB
  slowResponseTime: number; // milliseconds
  lowCacheHitRatio: number; // percentage (0-1)
  highErrorRate: number; // percentage (0-1)
  cpuUsageThreshold: number; // percentage (0-1)
}

export interface ConnectionPoolConfiguration {
  enabled: boolean;
  maxConnections: number;
  minConnections: number;
  idleTimeout: number; // milliseconds
  connectionTimeout: number; // milliseconds
  retryAttempts: number;
}

export interface WorkerThreadConfiguration {
  enabled: boolean;
  maxWorkers: number;
  taskQueueSize: number;
  workerIdleTimeout: number; // milliseconds
}

export interface MemoryManagementConfiguration {
  heapSizeLimit: number; // MB
  gcStrategy: 'adaptive' | 'aggressive' | 'conservative';
  memoryLeakDetection: boolean;
  objectPooling: boolean;
}

export interface CPUOptimizationConfiguration {
  loadBalancing: boolean;
  priorityScheduling: boolean;
  cpuIntensiveTaskThreshold: number; // milliseconds
  asyncOperationBatching: boolean;
}

export interface PerformanceMetrics {
  startTime: number;
  uptime?: number;
  totalRequests: number;
  totalAIRequests: number;
  requestsPerSecond?: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRatio?: number;
  templateCacheHits: number;
  templateCacheMisses: number;
  aiRequestErrors: number;
  templateLoadErrors: number;
  averageResponseTime?: number;
  responseTimes: Map<string, number[]>;
  memoryUsage: NodeJS.MemoryUsage;
  batchOperations: number;
  resourceOptimizations: number;
  timestamp?: number;
  cpuUsage?: CPUUsage;
  networkStats?: NetworkStats;
  diskStats?: DiskStats;
}

export interface CPUUsage {
  user: number;
  system: number;
  idle: number;
  total: number;
  percentage: number;
}

export interface NetworkStats {
  bytesReceived: number;
  bytesSent: number;
  requestsReceived: number;
  requestsSent: number;
  activeConnections: number;
}

export interface DiskStats {
  bytesRead: number;
  bytesWritten: number;
  operationsRead: number;
  operationsWritten: number;
  freeSpace: number;
  totalSpace: number;
}

export interface OptimizationResult {
  success: boolean;
  duration: number;
  optimizations: string[];
  metrics: PerformanceMetrics;
  error?: string;
  recommendations?: string[];
}

export interface CacheStrategy {
  type: 'LRU' | 'LFU' | 'FIFO' | 'TTL';
  maxSize: number;
  ttl?: number;
  updateAgeOnGet?: boolean;
  allowStale?: boolean;
  evictionPolicy?: EvictionPolicy;
}

export interface EvictionPolicy {
  maxAge: number;
  maxSize: number;
  evictOnWrite: boolean;
  evictOnRead: boolean;
}

export interface BatchingStrategy {
  batchSize: number;
  batchTimeout: number;
  priorityLevels: PriorityLevel[];
  backpressureHandling: BackpressureStrategy;
  failureHandling: FailureHandlingStrategy;
}

export interface PriorityLevel {
  name: string;
  weight: number;
  maxWaitTime: number;
  timeoutAction: 'drop' | 'fallback' | 'error';
}

export interface BackpressureStrategy {
  type: 'queue' | 'throttle' | 'circuit-breaker';
  maxQueueSize?: number;
  throttleRate?: number;
  circuitBreakerThreshold?: number;
}

export interface FailureHandlingStrategy {
  retryAttempts: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  fallbackStrategy: 'partial' | 'cache' | 'error';
}

export interface PerformanceReport {
  period: {
    start: Date;
    end: Date;
    duration: number;
  };
  summary: PerformanceSummary;
  trends: PerformanceTrends;
  bottlenecks: Bottleneck[];
  recommendations: PerformanceRecommendation[];
  alerts: PerformanceAlert[];
}

export interface PerformanceSummary {
  totalRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  cacheHitRatio: number;
  throughput: number;
  uptime: number;
  availability: number;
}

export interface PerformanceTrends {
  responseTime: TrendData;
  throughput: TrendData;
  errorRate: TrendData;
  memoryUsage: TrendData;
  cachePerformance: TrendData;
}

export interface TrendData {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  direction: 'up' | 'down' | 'stable';
}

export interface Bottleneck {
  component: string;
  type: 'memory' | 'cpu' | 'io' | 'network' | 'cache';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  detectedAt: Date;
  duration: number;
  metrics: Record<string, number>;
}

export interface PerformanceRecommendation {
  category: 'caching' | 'batching' | 'resource-allocation' | 'optimization';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  expectedImpact: string;
  implementation: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
  roi: number; // Return on investment score
}

export interface PerformanceAlert {
  id: string;
  type: 'threshold' | 'anomaly' | 'trend' | 'system';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  triggeredAt: Date;
  resolvedAt?: Date;
  metrics: Record<string, number>;
  actions: string[];
  escalated: boolean;
}

export interface LoadTestConfiguration {
  targetEndpoints: string[];
  concurrentUsers: number;
  rampUpTime: number; // seconds
  testDuration: number; // seconds
  requestsPerSecond: number;
  scenarios: LoadTestScenario[];
}

export interface LoadTestScenario {
  name: string;
  weight: number; // percentage of total load
  steps: LoadTestStep[];
  thinkTime: number; // milliseconds between requests
}

export interface LoadTestStep {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: any;
  expectedStatusCode: number;
  timeout: number;
}

export interface LoadTestResult {
  configuration: LoadTestConfiguration;
  execution: {
    startTime: Date;
    endTime: Date;
    duration: number;
    status: 'completed' | 'failed' | 'aborted';
  };
  metrics: LoadTestMetrics;
  errors: LoadTestError[];
  recommendations: string[];
}

export interface LoadTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  medianResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  throughput: number;
  errorRate: number;
  concurrencyLevel: number;
}

export interface LoadTestError {
  timestamp: Date;
  endpoint: string;
  statusCode: number;
  errorMessage: string;
  responseTime: number;
  scenario: string;
}

export interface ScalabilityMetrics {
  horizontalScaling: ScalingMetrics;
  verticalScaling: ScalingMetrics;
  resourceUtilization: ResourceUtilization;
  performanceCharacteristics: PerformanceCharacteristics;
}

export interface ScalingMetrics {
  maxCapacity: number;
  currentCapacity: number;
  utilizationRate: number;
  scalingLatency: number;
  costEfficiency: number;
  bottlenecks: string[];
}

export interface ResourceUtilization {
  cpu: UtilizationMetric;
  memory: UtilizationMetric;
  disk: UtilizationMetric;
  network: UtilizationMetric;
}

export interface UtilizationMetric {
  current: number;
  average: number;
  peak: number;
  threshold: number;
  efficiency: number;
}

export interface PerformanceCharacteristics {
  latency: LatencyCharacteristics;
  throughput: ThroughputCharacteristics;
  reliability: ReliabilityCharacteristics;
  scalability: ScalabilityCharacteristics;
}

export interface LatencyCharacteristics {
  baseline: number;
  underLoad: number;
  degradationPoint: number;
  recoveryTime: number;
}

export interface ThroughputCharacteristics {
  maximum: number;
  sustained: number;
  degradationPattern: 'linear' | 'exponential' | 'cliff';
  saturationPoint: number;
}

export interface ReliabilityCharacteristics {
  uptime: number;
  mtbf: number; // Mean Time Between Failures
  mttr: number; // Mean Time To Recovery
  errorRate: number;
  failurePatterns: string[];
}

export interface ScalabilityCharacteristics {
  linearScalingRange: number;
  maxScalingFactor: number;
  scalingBottlenecks: string[];
  costScalingFactor: number;
}

export interface PerformanceBudget {
  responseTime: {
    target: number;
    warning: number;
    critical: number;
  };
  throughput: {
    minimum: number;
    target: number;
    maximum: number;
  };
  resourceUsage: {
    memory: ResourceBudget;
    cpu: ResourceBudget;
    disk: ResourceBudget;
    network: ResourceBudget;
  };
  availability: {
    target: number; // percentage (0-100)
    sla: number;
  };
  errorRate: {
    target: number; // percentage (0-1)
    threshold: number;
  };
}

export interface ResourceBudget {
  allocated: number;
  warning: number;
  critical: number;
  unit: string;
}

export type PerformanceEvent = 
  | { type: 'cache-hit'; key: string; responseTime: number }
  | { type: 'cache-miss'; key: string; responseTime: number }
  | { type: 'batch-executed'; batchSize: number; responseTime: number }
  | { type: 'optimization-triggered'; reason: string; duration: number }
  | { type: 'threshold-exceeded'; metric: string; value: number; threshold: number }
  | { type: 'bottleneck-detected'; component: string; severity: string }
  | { type: 'performance-degradation'; metric: string; change: number }
  | { type: 'resource-exhaustion'; resource: string; utilization: number };