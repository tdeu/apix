// Error Recovery System Type Definitions for APIX AI

/**
 * Error Classification Schema
 */
export interface ErrorClassification {
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverability: RecoverabilityLevel;
  rootCause: RootCauseAnalysis;
  impact: ImpactAssessment;
  confidence: number;
  recoverySuggestions: string[];
}

export type ErrorCategory = 
  | 'syntax-error'
  | 'hedera-network'
  | 'business-logic'
  | 'integration'
  | 'performance'
  | 'security'
  | 'configuration'
  | 'user-input'
  | 'ai-generation'
  | 'template-mismatch'
  | 'dependency'
  | 'unknown';

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';

export type RecoverabilityLevel = 
  | 'auto-recoverable'
  | 'semi-recoverable'
  | 'manual-recovery'
  | 'non-recoverable';

/**
 * Root Cause Analysis
 */
export interface RootCauseAnalysis {
  immediate: string;
  underlying: string;
  contributing: string[];
}

/**
 * Impact Assessment
 */
export interface ImpactAssessment {
  components: string[];
  userImpact: string;
  businessImpact: string;
  dataIntegrity: 'safe' | 'at-risk' | 'compromised';
}

/**
 * Recovery Strategy
 */
export interface RecoveryStrategy {
  primaryStrategies: RecoveryOption[];
  fallbackStrategies: RecoveryOption[];
  estimatedTime?: string;
  successProbability?: number;
  userExperience?: string;
  riskAssessment?: string;
}

/**
 * Recovery Option
 */
export interface RecoveryOption {
  approach: RecoveryApproach;
  priority: number;
  successProbability: number;
  description?: string;
  estimatedTime?: string;
  userInteraction?: UserInteractionLevel;
  prerequisites?: string[];
  limitations?: string[];
}

export type RecoveryApproach = 
  // Automatic Recovery
  | 'parameter-adjustment'
  | 'template-substitution'
  | 'code-correction'
  | 'configuration-update'
  | 'retry-with-backoff'
  | 'cache-clear'
  | 'dependency-update'
  
  // Semi-Automatic Recovery
  | 'user-confirmation'
  | 'alternative-approach'
  | 'partial-implementation'
  | 'guided-troubleshooting'
  | 'interactive-debugging'
  
  // Manual Recovery
  | 'fallback-to-base-template'
  | 'expert-consultation'
  | 'research-mode'
  | 'custom-development'
  | 'manual-debugging'
  
  // Graceful Degradation
  | 'reduced-functionality'
  | 'simplified-approach'
  | 'phased-implementation'
  | 'alternative-technology'
  | 'safe-mode';

export type UserInteractionLevel = 'none' | 'minimal' | 'moderate' | 'extensive';

/**
 * Recovery Result
 */
export interface RecoveryResult {
  success: boolean;
  strategy: string;
  result: any;
  attempts: RecoveryAttempt[];
  message: string;
  recommendations: string[];
  isPartialRecovery?: boolean;
  escalationGuidance?: EscalationGuidance;
  limitations?: string[];
  nextSteps?: string[];
}

/**
 * Recovery Attempt
 */
export interface RecoveryAttempt {
  strategy: string;
  success: boolean;
  result?: any;
  error?: string;
  duration?: number;
  timestamp: Date;
  adjustments?: ParameterAdjustment[];
  templateChange?: TemplateChange;
  codeChanges?: CodeChange[];
  limitations?: string[];
  recommendations?: string[];
}

/**
 * Parameter Adjustment
 */
export interface ParameterAdjustment {
  parameter: string;
  oldValue: any;
  newValue: any;
  reasoning: string;
  confidence: number;
}

/**
 * Template Change
 */
export interface TemplateChange {
  from: string;
  to: string;
  reasoning: string;
  compatibilityScore: number;
  featureComparison: FeatureComparison;
}

/**
 * Feature Comparison
 */
export interface FeatureComparison {
  preserved: string[];
  lost: string[];
  added: string[];
  modified: string[];
}

/**
 * Code Change
 */
export interface CodeChange {
  file: string;
  type: 'addition' | 'modification' | 'deletion' | 'replacement';
  description: string;
  oldCode?: string;
  newCode?: string;
  reasoning: string;
  impact: 'low' | 'medium' | 'high';
}

/**
 * Escalation Guidance
 */
export interface EscalationGuidance {
  problemSummary: string;
  severity: ErrorSeverity;
  manualSteps: ManualStep[];
  expertConsultation: ExpertConsultation;
  alternativeApproaches: AlternativeApproach[];
  preventionStrategies: PreventionStrategy[];
  supportInformation: SupportInformation;
}

/**
 * Manual Step
 */
export interface ManualStep {
  id: string;
  description: string;
  commands?: string[];
  expectedOutput?: string;
  troubleshooting?: TroubleshootingTip[];
  estimatedTime: string;
  difficulty: 'easy' | 'moderate' | 'difficult' | 'expert';
}

/**
 * Expert Consultation
 */
export interface ExpertConsultation {
  requiredExpertise: string[];
  urgency: 'low' | 'medium' | 'high' | 'critical';
  informationToProvide: string[];
  questionsToAsk: string[];
  expectedOutcome: string;
}

/**
 * Alternative Approach
 */
export interface AlternativeApproach {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  timeline: string;
  successProbability: number;
  resourceRequirements: string[];
}

/**
 * Prevention Strategy
 */
export interface PreventionStrategy {
  category: 'validation' | 'testing' | 'monitoring' | 'configuration' | 'process';
  description: string;
  implementation: string[];
  benefits: string[];
  effort: 'low' | 'medium' | 'high';
}

/**
 * Support Information
 */
export interface SupportInformation {
  errorCode?: string;
  logFiles: string[];
  systemInformation: Record<string, any>;
  reproductionSteps: string[];
  contactChannels: ContactChannel[];
}

/**
 * Contact Channel
 */
export interface ContactChannel {
  type: 'documentation' | 'community' | 'support' | 'expert';
  name: string;
  url?: string;
  description: string;
  expectedResponseTime?: string;
}

/**
 * Troubleshooting Tip
 */
export interface TroubleshootingTip {
  issue: string;
  solution: string;
  commands?: string[];
  references?: string[];
}

/**
 * Error Recovery Events
 */
export type ErrorRecoveryEvent = 
  | { type: 'error-detected'; classification: ErrorClassification; timestamp: Date }
  | { type: 'recovery-started'; strategy: RecoveryStrategy; timestamp: Date }
  | { type: 'recovery-attempt'; attempt: RecoveryAttempt; timestamp: Date }
  | { type: 'recovery-succeeded'; result: RecoveryResult; timestamp: Date }
  | { type: 'recovery-failed'; attempts: RecoveryAttempt[]; timestamp: Date }
  | { type: 'escalation-triggered'; guidance: EscalationGuidance; timestamp: Date }
  | { type: 'manual-intervention'; description: string; timestamp: Date };

/**
 * Recovery Configuration
 */
export interface RecoveryConfiguration {
  maxAutoRetries: number;
  retryDelayMs: number;
  maxRecoveryTime: number;
  enabledStrategies: RecoveryApproach[];
  fallbackToManual: boolean;
  escalationThreshold: number;
  userConfirmationRequired: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Recovery Analytics
 */
export interface RecoveryAnalytics {
  totalErrors: number;
  successfulRecoveries: number;
  failedRecoveries: number;
  averageRecoveryTime: number;
  mostCommonErrors: ErrorFrequency[];
  mostSuccessfulStrategies: StrategyEffectiveness[];
  userSatisfactionScore: number;
  improvementSuggestions: string[];
}

/**
 * Error Frequency
 */
export interface ErrorFrequency {
  category: ErrorCategory;
  count: number;
  percentage: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

/**
 * Strategy Effectiveness
 */
export interface StrategyEffectiveness {
  strategy: RecoveryApproach;
  successRate: number;
  averageTime: number;
  userSatisfaction: number;
  applicableScenarios: string[];
}