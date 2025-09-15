// Security Framework Type Definitions for APIX AI

/**
 * Security Framework Configuration
 */
export interface SecurityFramework {
  dataProtection: DataProtectionConfig;
  accessControl: AccessControlConfig;
  codeSecurity: CodeSecurityConfig;
  compliance: ComplianceConfig;
  auditLogging: AuditLoggingConfig;
  encryption: EncryptionConfig;
}

/**
 * Data Protection Configuration
 */
export interface DataProtectionConfig {
  encryptionAtRest: EncryptionConfig;
  encryptionInTransit: TransportSecurityConfig;
  keyManagement: KeyManagementConfig;
  dataClassification: DataClassificationConfig;
  dataRetention: DataRetentionConfig;
}

/**
 * Access Control Configuration
 */
export interface AccessControlConfig {
  enabled: boolean;
  authentication: AuthenticationConfig;
  authorization: AuthorizationConfig;
  roleBasedAccess: RBACConfig;
  sessionManagement: SessionConfig;
  multiFactorAuth: MFAConfig;
}

/**
 * Code Security Configuration
 */
export interface CodeSecurityConfig {
  enabled: boolean;
  staticAnalysis: StaticAnalysisConfig;
  dependencyScanning: DependencyScanConfig;
  secretsManagement: SecretsManagementConfig;
  codeInjectionPrevention: InjectionPreventionConfig;
  vulnerabilityScanning: VulnerabilityScanConfig;
}

/**
 * Compliance Configuration
 */
export interface ComplianceConfig {
  frameworks: ComplianceFramework[];
  gdprCompliance: GDPRConfig;
  soc2Compliance: SOC2Config;
  hipaaCompliance: HIPAAConfig;
  isoCompliance: ISOConfig;
  customCompliance: CustomComplianceConfig[];
}

/**
 * Audit Logging Configuration
 */
export interface AuditLoggingConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  destinations: LogDestination[];
  retention: RetentionPolicy;
  encryption: boolean;
  realTimeMonitoring: boolean;
  alerting: AlertingConfig;
}

/**
 * Encryption Configuration
 */
export interface EncryptionConfig {
  enabled: boolean;
  algorithm: 'aes-128-gcm' | 'aes-256-gcm' | 'chacha20-poly1305';
  keySize: 128 | 256;
  keyRotation: KeyRotationConfig;
  keyStorage: 'env' | 'hsm' | 'vault' | 'file';
  saltLength: number;
}

/**
 * Security Configuration
 */
export interface SecurityConfiguration {
  encryptionConfig: EncryptionConfig;
  accessConfig: AccessControlConfig;
  auditConfig: AuditLoggingConfig;
  codeSecurityConfig: CodeSecurityConfig;
  complianceConfig: ComplianceConfig;
  securityLevel: 'basic' | 'enhanced' | 'enterprise' | 'government';
}

/**
 * Security Validation Result
 */
export interface SecurityValidationResult {
  passed: boolean;
  securityScore: number;
  vulnerabilities: SecurityVulnerability[];
  dataClassification: DataClassification;
  complianceStatus: ComplianceStatus;
  recommendations: string[];
  scanDetails: CodeSecurityScan;
  timestamp?: Date;
}

/**
 * Security Vulnerability
 */
export interface SecurityVulnerability {
  id: string;
  type: VulnerabilityType;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  location: VulnerabilityLocation;
  impact: SecurityImpact;
  remediation: RemediationGuidance;
  cwe?: string; // Common Weakness Enumeration
  cvss?: CVSSScore;
  discovered: Date;
  status: 'open' | 'in-progress' | 'resolved' | 'accepted' | 'false-positive';
}

/**
 * Data Classification
 */
export interface DataClassification {
  level: 'public' | 'internal' | 'confidential' | 'restricted';
  category: DataCategory[];
  sensitivity: number; // 1-10 scale
  requiresEncryption: boolean;
  retentionPeriod: string;
  accessRestrictions: AccessRestriction[];
  complianceRequirements: string[];
  dataElements: DataElement[];
}

/**
 * Compliance Status
 */
export interface ComplianceStatus {
  framework: ComplianceFramework;
  overallStatus: 'compliant' | 'non-compliant' | 'partially-compliant' | 'unknown';
  score: number; // 0-100
  controls: ComplianceControl[];
  gaps: ComplianceGap[];
  recommendations: string[];
  lastAssessment: Date;
  nextAssessment: Date;
}

/**
 * Code Security Scan
 */
export interface CodeSecurityScan {
  passed: boolean;
  scanId: string;
  scanType: 'static' | 'dynamic' | 'interactive' | 'dependency';
  scanTimestamp: Date;
  duration: number;
  codeMetrics: CodeMetrics;
  vulnerabilities: SecurityVulnerability[];
  qualityGate: QualityGate;
  tools: ScanTool[];
  coverage: ScanCoverage;
  false_positives: number;
  suppressed_issues: number;
  codeQualityScore: number; // Overall code quality score (0-100)
}

/**
 * Audit Event
 */
export interface AuditEvent {
  id?: string;
  type: AuditEventType;
  category: 'authentication' | 'authorization' | 'data-access' | 'system' | 'security' | 'compliance';
  severity: 'info' | 'warn' | 'error' | 'critical';
  description: string;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  outcome: 'success' | 'failure' | 'denied' | 'error';
  metadata?: Record<string, any>;
  riskScore?: number;
  geolocation?: Geolocation;
}

// Supporting Types

export type VulnerabilityType = 
  | 'injection'
  | 'broken-authentication'
  | 'sensitive-data-exposure'
  | 'xml-external-entities'
  | 'broken-access-control'
  | 'security-misconfiguration'
  | 'cross-site-scripting'
  | 'insecure-deserialization'
  | 'vulnerable-components'
  | 'insufficient-logging'
  | 'hardcoded-secrets'
  | 'weak-cryptography'
  | 'race-condition'
  | 'buffer-overflow'
  | 'path-traversal';

export type ComplianceFramework = 
  | 'SOC2'
  | 'GDPR'
  | 'HIPAA'
  | 'PCI-DSS'
  | 'ISO-27001'
  | 'NIST'
  | 'FedRAMP'
  | 'FISMA'
  | 'CCPA'
  | 'SOX'
  | 'GLBA'
  | 'FERPA'
  | 'PIPEDA'
  | 'Custom';

export type DataCategory = 
  | 'PII'
  | 'PHI'
  | 'PCI'
  | 'Financial'
  | 'Biometric'
  | 'Credentials'
  | 'API-Keys'
  | 'Business-Confidential'
  | 'Government-Classified'
  | 'Trade-Secrets';

export type AuditEventType =
  | 'user-login'
  | 'user-logout'
  | 'permission-granted'
  | 'permission-denied'
  | 'data-access'
  | 'data-modification'
  | 'code-generation'
  | 'security-scan'
  | 'code-security-scan'
  | 'compliance-check'
  | 'system-configuration'
  | 'error-occurred'
  | 'security-incident'
  | 'security-initialization'
  | 'code-security-validation'
  | 'code-security-error';

export interface VulnerabilityLocation {
  file: string;
  line: number;
  column?: number;
  function?: string;
  component?: string;
  codeSnippet?: string;
}

export interface SecurityImpact {
  confidentiality: 'none' | 'partial' | 'complete';
  integrity: 'none' | 'partial' | 'complete';
  availability: 'none' | 'partial' | 'complete';
  scope: 'unchanged' | 'changed';
  dataAtRisk: string[];
  businessImpact: string;
}

export interface RemediationGuidance {
  priority: 'critical' | 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  steps: string[];
  codeExample?: string;
  references: string[];
  automated: boolean;
  deadline?: Date;
}

export interface CVSSScore {
  version: '3.1' | '3.0' | '2.0';
  vector: string;
  baseScore: number;
  temporalScore?: number;
  environmentalScore?: number;
  overallScore: number;
}

export interface AccessRestriction {
  type: 'role-based' | 'attribute-based' | 'time-based' | 'location-based';
  rules: string[];
  exceptions: string[];
}

export interface DataElement {
  name: string;
  type: string;
  classification: string;
  required: boolean;
  sensitive: boolean;
}

export interface ComplianceControl {
  id: string;
  name: string;
  description: string;
  status: 'implemented' | 'partial' | 'missing' | 'not-applicable';
  evidence: string[];
  gaps: string[];
  lastReviewed: Date;
}

export interface ComplianceGap {
  control: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  remediation: string[];
  timeline: string;
  responsible: string;
}

export interface CodeMetrics {
  linesOfCode: number;
  complexity: number;
  duplicateCode: number;
  testCoverage: number;
  maintainabilityIndex: number;
  securityHotspots: number;
}

export interface QualityGate {
  passed: boolean;
  conditions: QualityCondition[];
  threshold: number;
  score: number;
}

export interface QualityCondition {
  metric: string;
  operator: 'GT' | 'LT' | 'EQ' | 'NE';
  threshold: number;
  actual: number;
  passed: boolean;
}

export interface ScanTool {
  name: string;
  version: string;
  type: 'SAST' | 'DAST' | 'IAST' | 'SCA' | 'Secret';
  configuration: Record<string, any>;
}

export interface ScanCoverage {
  files: number;
  lines: number;
  functions: number;
  branches: number;
  percentage: number;
}

export interface Geolocation {
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
}

// Configuration Types

export interface TransportSecurityConfig {
  tlsVersion: '1.2' | '1.3';
  certificatePinning: boolean;
  hsts: boolean;
  cipherSuites: string[];
}

export interface KeyManagementConfig {
  provider: 'local' | 'hsm' | 'cloud-kms' | 'vault';
  rotation: KeyRotationConfig;
  backup: KeyBackupConfig;
  access: KeyAccessConfig;
}

export interface KeyRotationConfig {
  enabled: boolean;
  frequency: number; // days
  automatic: boolean;
  gracePeriod: number; // days
}

export interface KeyBackupConfig {
  enabled: boolean;
  encryption: boolean;
  location: string;
  schedule: string;
}

export interface KeyAccessConfig {
  multiPersonControl: boolean;
  approvalRequired: boolean;
  auditLogging: boolean;
  timeRestrictions: boolean;
}

export interface DataClassificationConfig {
  enabled: boolean;
  defaultLevel: string;
  autoClassification: boolean;
  userOverride: boolean;
  markingRequired: boolean;
}

export interface DataRetentionConfig {
  policies: RetentionPolicy[];
  automaticDeletion: boolean;
  legalHold: boolean;
  archiving: ArchivingConfig;
}

export interface RetentionPolicy {
  dataType: string;
  retentionPeriod: string;
  disposalMethod: 'secure-delete' | 'anonymize' | 'archive';
  legalBasis: string;
}

export interface ArchivingConfig {
  enabled: boolean;
  location: string;
  encryption: boolean;
  compression: boolean;
}

export interface AuthenticationConfig {
  methods: AuthMethod[];
  passwordPolicy: PasswordPolicy;
  lockoutPolicy: LockoutPolicy;
  sessionTimeout: number;
}

export interface AuthorizationConfig {
  model: 'RBAC' | 'ABAC' | 'MAC' | 'DAC';
  defaultDeny: boolean;
  principleOfLeastPrivilege: boolean;
  segregationOfDuties: boolean;
}

export interface RBACConfig {
  roles: Role[];
  permissions: Permission[];
  hierarchical: boolean;
  inheritance: boolean;
}

export interface SessionConfig {
  timeout: number;
  renewalRequired: boolean;
  concurrentSessions: number;
  secureFlag: boolean;
  sameSite: 'strict' | 'lax' | 'none';
}

export interface MFAConfig {
  enabled: boolean;
  required: boolean;
  methods: MFAMethod[];
  backupCodes: boolean;
  rememberDevice: boolean;
}

export interface AuthMethod {
  type: 'password' | 'certificate' | 'token' | 'biometric' | 'sso';
  enabled: boolean;
  primary: boolean;
}

export interface PasswordPolicy {
  minLength: number;
  complexity: boolean;
  history: number;
  expiration: number;
  lockout: LockoutPolicy;
}

export interface LockoutPolicy {
  enabled: boolean;
  attempts: number;
  duration: number;
  progressive: boolean;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  inherits?: string[];
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  conditions?: string[];
}

export interface MFAMethod {
  type: 'totp' | 'sms' | 'email' | 'push' | 'hardware';
  enabled: boolean;
  required: boolean;
}

// Compliance-specific configurations

export interface GDPRConfig {
  enabled: boolean;
  dataProcessingBasis: string[];
  consentManagement: boolean;
  rightToErasure: boolean;
  dataPortability: boolean;
  privacyByDesign: boolean;
}

export interface SOC2Config {
  enabled: boolean;
  trustServices: ('security' | 'availability' | 'processing-integrity' | 'confidentiality' | 'privacy')[];
  controls: SOC2Control[];
  auditFrequency: 'annual' | 'continuous';
}

export interface HIPAAConfig {
  enabled: boolean;
  coveredEntity: boolean;
  businessAssociate: boolean;
  safeguards: ('administrative' | 'physical' | 'technical')[];
  breachNotification: boolean;
}

export interface ISOConfig {
  enabled: boolean;
  standard: '27001' | '27002' | '27017' | '27018';
  controls: ISOControl[];
  riskAssessment: boolean;
}

export interface CustomComplianceConfig {
  name: string;
  description: string;
  requirements: ComplianceRequirement[];
  controls: CustomControl[];
}

export interface SOC2Control {
  id: string;
  category: string;
  description: string;
  implemented: boolean;
}

export interface ISOControl {
  id: string;
  category: string;
  description: string;
  implemented: boolean;
}

export interface ComplianceRequirement {
  id: string;
  description: string;
  mandatory: boolean;
  evidence: string[];
}

export interface CustomControl {
  id: string;
  name: string;
  description: string;
  testProcedure: string;
  frequency: string;
}

export interface StaticAnalysisConfig {
  enabled: boolean;
  tools: string[];
  rules: string[];
  excludePatterns: string[];
  failOnHigh: boolean;
}

export interface DependencyScanConfig {
  enabled: boolean;
  sources: string[];
  autoUpdate: boolean;
  allowedLicenses: string[];
  blockedPackages: string[];
}

export interface SecretsManagementConfig {
  enabled: boolean;
  detector: string;
  patterns: string[];
  excludeFiles: string[];
  failOnDetection: boolean;
}

export interface InjectionPreventionConfig {
  enabled: boolean;
  techniques: string[];
  validation: boolean;
  sanitization: boolean;
  encoding: boolean;
}

export interface VulnerabilityScanConfig {
  enabled: boolean;
  databases: string[];
  updateFrequency: string;
  severity: string[];
  autoRemediation: boolean;
}

export interface LogDestination {
  type: 'file' | 'database' | 'siem' | 'cloud' | 'syslog';
  configuration: Record<string, any>;
  format: 'json' | 'plaintext' | 'cef' | 'leef';
}

export interface AlertingConfig {
  enabled: boolean;
  channels: AlertChannel[];
  rules: AlertRule[];
  escalation: EscalationPolicy;
}

export interface AlertChannel {
  type: 'email' | 'sms' | 'slack' | 'webhook' | 'pagerduty';
  configuration: Record<string, any>;
  severity: string[];
}

export interface AlertRule {
  id: string;
  condition: string;
  severity: string;
  message: string;
  enabled: boolean;
}

export interface EscalationPolicy {
  levels: EscalationLevel[];
  timeout: number;
  repeat: boolean;
}

export interface EscalationLevel {
  delay: number;
  channels: string[];
  personnel: string[];
}