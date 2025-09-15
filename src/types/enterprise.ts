// Enterprise AI Type Definitions for APIX AI

import { ProjectContext, SupportedFramework } from './index';

// =============================================================================
// ENTERPRISE CONTEXT TYPES
// =============================================================================

export interface EnterpriseContext {
  industry: EnterpriseIndustry;
  size: OrganizationSize;
  regulations: RegulatoryFramework[];
  technicalStack: TechnicalStack;
  compliance: ComplianceRequirement[];
  businessModel: BusinessModel;
  integrationNeeds: IntegrationRequirement[];
}

export type EnterpriseIndustry = 
  | 'pharmaceutical'
  | 'financial-services'
  | 'insurance' 
  | 'manufacturing'
  | 'healthcare'
  | 'supply-chain'
  | 'energy'
  | 'real-estate'
  | 'agriculture'
  | 'technology'
  | 'government'
  | 'education';

export type OrganizationSize = 
  | 'startup'
  | 'small-business'
  | 'mid-market'
  | 'enterprise'
  | 'global-enterprise';

export type RegulatoryFramework = 
  | 'FDA-21CFR11'
  | 'SOX'
  | 'GDPR'
  | 'HIPAA'
  | 'PCI-DSS'
  | 'ISO-27001'
  | 'ISO-9001'
  | 'HACCP'
  | 'GMP'
  | 'SOC2'
  | 'NIST'
  | 'FIPS-140-2';

export interface TechnicalStack {
  frameworks: SupportedFramework[];
  databases: string[];
  cloudProviders: CloudProvider[];
  securityTools: string[];
  monitoringTools: string[];
  cicd: string[];
}

export type CloudProvider = 'aws' | 'azure' | 'gcp' | 'oracle' | 'ibm' | 'on-premise';

export interface ComplianceRequirement {
  framework: RegulatoryFramework;
  scope: string[];
  auditFrequency: 'annual' | 'semi-annual' | 'quarterly' | 'monthly';
  dataRetention: number; // years
  reportingRequired: boolean;
}

export type BusinessModel = 
  | 'b2b'
  | 'b2c'
  | 'b2b2c'
  | 'marketplace'
  | 'saas'
  | 'platform'
  | 'supply-chain'
  | 'fintech';

export interface IntegrationRequirement {
  systemType: 'ERP' | 'CRM' | 'MES' | 'WMS' | 'HCM' | 'Financial' | 'Custom';
  systemName: string;
  integrationMethod: 'API' | 'Database' | 'File' | 'Message-Queue' | 'Webhook';
  dataFlow: 'bidirectional' | 'inbound' | 'outbound';
  criticality: 'high' | 'medium' | 'low';
}

// =============================================================================
// ENTERPRISE REQUIREMENT TYPES
// =============================================================================

export interface EnterpriseRequirement {
  id: string;
  description: string;
  industry: EnterpriseIndustry;
  businessContext: BusinessContext;
  technicalRequirements: TechnicalRequirement[];
  complianceRequirements: ComplianceRequirement[];
  integrationRequirements: IntegrationRequirement[];
  complexity: RequirementComplexity;
  priority: RequirementPriority;
  timeline: RequirementTimeline;
}

export interface BusinessContext {
  businessGoals: string[];
  keyStakeholders: string[];
  businessProcesses: string[];
  performanceMetrics: string[];
  riskFactors: string[];
  successCriteria: string[];
}

export interface TechnicalRequirement {
  category: 'performance' | 'security' | 'scalability' | 'reliability' | 'integration';
  description: string;
  priority: 'must-have' | 'should-have' | 'could-have';
  measurable: boolean;
  metrics?: string[];
}

export type RequirementComplexity = 'simple' | 'moderate' | 'complex' | 'highly-complex';
export type RequirementPriority = 'low' | 'medium' | 'high' | 'critical';

export interface RequirementTimeline {
  estimatedDuration: number; // days
  dependencies: string[];
  milestones: string[];
  deliverables: string[];
}

// =============================================================================
// AI CLASSIFICATION TYPES
// =============================================================================

export interface EnterpriseClassification {
  businessIntent: BusinessIntent;
  businessContext: BusinessIntent; // Alias for backward compatibility
  industrySpecific: IndustryClassification;
  technicalComplexity: TechnicalComplexity;
  complianceRequirements: ComplianceClassification;
  confidence: ConfidenceScore;
  recommendedApproach: RecommendedApproach;
  recommendedServices: string[]; // Hedera services recommended for this classification
}

export interface BusinessIntent {
  primary: BusinessIntentCategory;
  secondary: BusinessIntentCategory[];
  confidence: number; // 0-100
  keywords: string[];
  patterns: string[];
}

export type BusinessIntentCategory = 
  | 'supply-chain-compliance'
  | 'financial-automation'
  | 'document-verification'
  | 'identity-management'
  | 'asset-tokenization'
  | 'audit-trail'
  | 'regulatory-reporting'
  | 'oracle-integration'
  | 'multi-party-automation'
  | 'data-verification';

export interface IndustryClassification {
  industry: EnterpriseIndustry;
  subCategory: string;
  regulatoryContext: RegulatoryFramework[];
  industryStandards: string[];
  commonIntegrations: string[];
  confidence: number;
}

export interface TechnicalComplexity {
  overallScore: number; // 0-100
  factors: {
    integrationComplexity: number;
    regulatoryComplexity: number;
    technicalNovelty: number;
    scalabilityRequirements: number;
    securityRequirements: number;
  };
  riskFactors: string[];
  mitigationStrategies: string[];
}

export interface ComplianceClassification {
  applicableFrameworks: RegulatoryFramework[];
  complianceLevel: 'basic' | 'standard' | 'advanced' | 'critical';
  auditRequirements: string[];
  dataProtectionNeeds: string[];
  reportingRequirements: string[];
}

export interface ConfidenceScore {
  overall: number; // 0-100
  breakdown: {
    businessIntent: number;
    technicalFeasibility: number;
    regulatoryCompliance: number;
    templateAvailability: number;
    aiCapability: number;
  };
}

export interface RecommendedApproach {
  strategy: 'template-based' | 'ai-composition' | 'hybrid' | 'expert-consultation';
  templateSuggestions: string[];
  customDevelopmentNeeds: string[];
  expertConsultationAreas: string[];
  estimatedEffort: EffortEstimate;
  riskAssessment: RiskAssessment;
}

export interface EffortEstimate {
  development: number; // hours
  testing: number; // hours
  compliance: number; // hours
  integration: number; // hours
  total: number; // hours
  confidence: number; // 0-100
}

export interface RiskAssessment {
  technicalRisks: Risk[];
  businessRisks: Risk[];
  complianceRisks: Risk[];
  mitigationStrategies: MitigationStrategy[];
}

export interface Risk {
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  category: 'technical' | 'business' | 'compliance' | 'security';
}

export interface MitigationStrategy {
  riskCategory: string;
  strategy: string;
  effort: number; // hours
  effectiveness: number; // 0-100
}

// =============================================================================
// TEMPLATE STRATEGY TYPES
// =============================================================================

export interface EnterpriseTemplateStrategy {
  approach: TemplateApproach;
  baseTemplates: BaseTemplate[];
  enterpriseVariants: EnterpriseVariant[];
  customComponents: CustomComponent[];
  integrationPoints: IntegrationPoint[];
  validationStrategy: ValidationStrategy;
}

export type TemplateApproach = 
  | 'direct-template-match'
  | 'template-combination'
  | 'template-with-customization'
  | 'ai-composition'
  | 'novel-implementation';

export interface BaseTemplate {
  id: string;
  name: string;
  description: string;
  framework: SupportedFramework;
  services: HederaService[];
  maturity: 'stable' | 'beta' | 'experimental';
  usageComplexity: 'simple' | 'moderate' | 'complex';
}

export interface EnterpriseVariant {
  id: string;
  baseTemplateId: string;
  industry: EnterpriseIndustry;
  complianceFrameworks: RegulatoryFramework[];
  customizations: TemplateCustomization[];
  integrationRequirements: string[];
}

export interface TemplateCustomization {
  component: string;
  modificationType: 'enhancement' | 'replacement' | 'addition';
  description: string;
  complexity: 'low' | 'medium' | 'high';
  effort: number; // hours
}

export interface CustomComponent {
  id: string;
  name: string;
  description: string;
  generationMethod: 'ai-composition' | 'template-based' | 'manual';
  dependencies: string[];
  complexity: RequirementComplexity;
  estimatedEffort: number; // hours
}

export interface IntegrationPoint {
  systemType: string;
  integrationMethod: string;
  dataFlow: string;
  securityRequirements: string[];
  complianceRequirements: string[];
}

export interface ValidationStrategy {
  validationMethods: ValidationMethod[];
  testingApproach: TestingApproach;
  complianceValidation: ComplianceValidation;
  securityValidation: SecurityValidation;
}

export interface ValidationMethod {
  method: 'static-analysis' | 'unit-testing' | 'integration-testing' | 'live-blockchain-testing';
  scope: string[];
  automatedPercentage: number; // 0-100
  effort: number; // hours
}

export interface TestingApproach {
  unitTests: boolean;
  integrationTests: boolean;
  e2eTests: boolean;
  performanceTests: boolean;
  securityTests: boolean;
  complianceTests: boolean;
}

export interface ComplianceValidation {
  frameworks: RegulatoryFramework[];
  validationMethods: string[];
  reportingRequirements: string[];
  auditTrailRequirements: string[];
}

export interface SecurityValidation {
  securityStandards: string[];
  penetrationTesting: boolean;
  vulnerabilityScanning: boolean;
  codeSecurityAnalysis: boolean;
  accessControlValidation: boolean;
}

// =============================================================================
// AI LIMITATION TYPES
// =============================================================================

export interface LimitationAssessment {
  overallConfidence: number; // 0-100
  limitationCategories: LimitationCategory[];
  highConfidenceAreas: ConfidenceArea[];
  mediumConfidenceAreas: ConfidenceArea[];
  lowConfidenceAreas: ConfidenceArea[];
  recommendedStrategy: string;
  nextSteps: string[];
  expertRecommendations: ExpertRecommendation[];
}

export interface LimitationCategory {
  category: 'knowledge' | 'technical' | 'business-logic' | 'scope';
  description: string;
  confidence: number; // 0-100
  mitigationOptions: string[];
  expertConsultationRequired: boolean;
}

export interface ConfidenceArea {
  name: string;
  description: string;
  confidence: number; // 0-100
  estimatedTimeline: string;
  complexityReasons?: string[];
  recommendedExperts?: string[];
}

export interface ExpertRecommendation {
  expertiseArea: string;
  recommendedExperts: string[];
  consultationScope: string[];
  estimatedTimeline: string;
  alternatives: string[];
}

// =============================================================================
// AI COMPOSITION TYPES
// =============================================================================

export interface AICompositionRequest {
  requirement: EnterpriseRequirement;
  context: EnterpriseContext;
  constraints: CompositionConstraint[];
  preferences: CompositionPreference[];
}

export interface CompositionConstraint {
  type: 'regulatory' | 'technical' | 'business' | 'timeline' | 'budget';
  description: string;
  mandatory: boolean;
  impact: 'high' | 'medium' | 'low';
}

export interface CompositionPreference {
  category: string;
  preference: string;
  weight: number; // 0-100
  rationale: string;
}

export interface AICompositionResult {
  generatedCode: GeneratedCode[];
  compositionStrategy: CompositionStrategy;
  qualityAssessment: QualityAssessment;
  validationResults: ValidationResults;
  deploymentGuidance: DeploymentGuidance;
  limitationAcknowledgment: LimitationAcknowledgment;
  // Legacy properties for backward compatibility
  code: GeneratedCode[]; // Alias for generatedCode
  explanation: string; // Human-readable explanation of the composition
  confidence: number; // Overall confidence score (0-100)
}

export interface GeneratedCode {
  filePath: string;
  content: string;
  language: 'typescript' | 'javascript' | 'solidity' | 'json';
  purpose: string;
  dependencies: string[];
  generationMethod: 'ai-composition' | 'template-based' | 'hybrid';
  confidence: number; // 0-100
}

export interface CompositionStrategy {
  approach: string;
  componentsUsed: string[];
  novelPatterns: string[];
  templateCombinations: string[];
  customLogicGenerated: string[];
  integrationPatterns: string[];
}

export interface QualityAssessment {
  overallScore: number; // 0-100
  codeQuality: number; // 0-100
  businessLogicAccuracy: number; // 0-100
  securityCompliance: number; // 0-100
  performanceOptimization: number; // 0-100
  maintainability: number; // 0-100
  testability: number; // 0-100
  issues: QualityIssue[];
  recommendations: string[];
}

export interface QualityIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'syntax' | 'logic' | 'security' | 'performance' | 'compliance';
  description: string;
  file: string;
  line?: number;
  suggestedFix: string;
}

export interface ValidationResults {
  staticAnalysis: StaticAnalysisResult;
  securityScan: SecurityScanResult;
  complianceCheck: ComplianceCheckResult;
  performanceAnalysis: PerformanceAnalysisResult;
  liveBlockchainTest?: LiveBlockchainTestResult;
}

export interface StaticAnalysisResult {
  passed: boolean;
  errors: AnalysisError[];
  warnings: AnalysisWarning[];
  metrics: CodeMetrics;
}

export interface AnalysisError {
  type: string;
  message: string;
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
}

export interface AnalysisWarning {
  type: string;
  message: string;
  file: string;
  line: number;
  recommendation: string;
}

export interface CodeMetrics {
  linesOfCode: number;
  complexity: number;
  maintainabilityIndex: number;
  testCoverage: number;
  duplication: number;
}

export interface SecurityScanResult {
  passed: boolean;
  vulnerabilities: SecurityVulnerability[];
  securityScore: number; // 0-100
  complianceStatus: string;
}

export interface SecurityVulnerability {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  file: string;
  mitigation: string;
}

export interface ComplianceCheckResult {
  frameworks: RegulatoryFramework[];
  compliant: boolean;
  violations: ComplianceViolation[];
  recommendations: string[];
}

export interface ComplianceViolation {
  framework: RegulatoryFramework;
  requirement: string;
  violation: string;
  severity: 'minor' | 'major' | 'critical';
  remediation: string;
}

export interface PerformanceAnalysisResult {
  score: number; // 0-100
  bottlenecks: PerformanceBottleneck[];
  optimizations: string[];
  scalabilityAssessment: string;
}

export interface PerformanceBottleneck {
  component: string;
  issue: string;
  impact: 'low' | 'medium' | 'high';
  optimization: string;
}

export interface LiveBlockchainTestResult {
  testsPassed: number;
  testsTotal: number;
  transactionResults: TransactionResult[];
  networkPerformance: NetworkPerformance;
}

export interface TransactionResult {
  operation: string;
  success: boolean;
  transactionId?: string;
  executionTime: number;
  gasUsed?: number;
  error?: string;
}

export interface NetworkPerformance {
  averageResponseTime: number;
  throughput: number;
  reliability: number; // 0-100
}

export interface DeploymentGuidance {
  deploymentSteps: DeploymentStep[];
  environmentRequirements: EnvironmentRequirement[];
  configurationNeeds: ConfigurationNeed[];
  monitoringSetup: MonitoringSetup;
  maintenanceGuidance: MaintenanceGuidance;
}

export interface DeploymentStep {
  step: number;
  description: string;
  commands: string[];
  verification: string;
  rollbackProcedure: string;
}

export interface EnvironmentRequirement {
  component: string;
  requirement: string;
  version?: string;
  optional: boolean;
}

export interface ConfigurationNeed {
  file: string;
  settings: Record<string, any>;
  securityConsiderations: string[];
}

export interface MonitoringSetup {
  metrics: string[];
  alerts: AlertConfiguration[];
  dashboards: string[];
  logging: LoggingConfiguration;
}

export interface AlertConfiguration {
  metric: string;
  threshold: number;
  action: string;
  notification: string[];
}

export interface LoggingConfiguration {
  level: 'debug' | 'info' | 'warn' | 'error';
  destinations: string[];
  retention: number; // days
  compliance: boolean;
}

export interface MaintenanceGuidance {
  updateProcedures: string[];
  backupRequirements: string[];
  securityConsiderations: string[];
  complianceRequirements: string[];
}

export interface LimitationAcknowledgment {
  aiGeneratedComponents: string[];
  manualReviewRequired: string[];
  expertConsultationRecommended: string[];
  testingRequirements: string[];
  complianceVerificationNeeds: string[];
  disclaimers: string[];
}

// =============================================================================
// HEDERA SERVICE TYPES
// =============================================================================

export type HederaService = 
  | 'HTS' // Token Service
  | 'HCS' // Consensus Service
  | 'HSCS' // Smart Contract Service
  | 'HFS' // File Service
  | 'HGAS' // Account Service
  | 'HNS'; // Network Service