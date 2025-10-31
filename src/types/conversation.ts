// Conversation System Type Definitions for APIX AI

import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { EnterpriseContext, EnterpriseClassification } from './enterprise';

/**
 * User Intent Analysis
 */
export interface UserIntent {
  primaryIntent: 'requirement-gathering' | 'solution-exploration' | 'implementation-request' | 
                 'clarification-seeking' | 'validation-request' | 'troubleshooting' | 
                 'capability-inquiry' | 'general-inquiry';
  technicalComplexity: 'simple' | 'moderate' | 'complex' | 'expert';
  conversationState: 'initial' | 'continuing' | 'refining' | 'finalizing';
  enterpriseContext: {
    industry: string | null;
    businessFunction: string | null;
    urgency: 'low' | 'medium' | 'high';
  };
  extractedRequirements: string[];
  confidence: number;
}

/**
 * Conversation Context
 */
export interface ConversationContext {
  industry: string | null;
  companySize: 'startup' | 'small' | 'medium' | 'large' | 'enterprise' | 'unknown';
  technicalStack: string[];
  currentProject: string | null;
  urgency: 'low' | 'medium' | 'high';
  previousInteractions?: ConversationSummary[];
}

/**
 * Conversation Session
 */
export interface ConversationSession {
  id: string;
  messages: (HumanMessage | AIMessage | SystemMessage)[];
  context: ConversationContext;
  createdAt: Date;
  lastActivity: Date;
  metadata?: {
    userPreferences?: UserPreferences;
    projectContext?: ProjectContext;
    enterpriseClassifications?: EnterpriseClassification[];
  };
}

/**
 * Conversation Response
 */
export interface ConversationResponse {
  content: string;
  intent: string;
  suggestions: string[];
  confidence: number;
  requiresAction: boolean;
  sessionId: string;
  context: ConversationContext;
  enterpriseClassification?: EnterpriseClassification;
  limitations?: LimitationAssessment;
  actionItems?: ActionItem[];
  cliCommands?: CLICommand[];
  error?: {
    message: string;
    details?: string;
    status?: number;
  };
}

/**
 * User Preferences
 */
export interface UserPreferences {
  preferredLLM: 'openai' | 'anthropic' | 'auto';
  verbosityLevel: 'concise' | 'detailed' | 'comprehensive';
  technicalLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  focusAreas: string[];
  communicationStyle: 'formal' | 'casual' | 'technical';
}

/**
 * Project Context
 */
export interface ProjectContext {
  framework: string;
  language: string;
  existingIntegrations: string[];
  targetEnvironment: 'development' | 'staging' | 'production';
  deploymentModel: 'cloud' | 'on-premise' | 'hybrid';
  teamSize: number;
  timeline: string;
}

/**
 * Conversation Summary
 */
export interface ConversationSummary {
  sessionId: string;
  date: Date;
  topics: string[];
  outcomes: string[];
  followUpActions: string[];
  satisfactionScore?: number;
}

/**
 * Action Item
 */
export interface ActionItem {
  id: string;
  description: string;
  type: 'cli-command' | 'manual-task' | 'research' | 'consultation';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedTime: string;
  dependencies?: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
}

/**
 * CLI Command Suggestion
 */
export interface CLICommand {
  command: string;
  description: string;
  parameters?: Record<string, any>;
  expectedOutput: string;
  successCriteria: string[];
  troubleshooting?: TroubleshootingStep[];
}

/**
 * Troubleshooting Step
 */
export interface TroubleshootingStep {
  issue: string;
  solution: string;
  commands?: string[];
  documentation?: string;
}

/**
 * Limitation Assessment
 */
export interface LimitationAssessment {
  overallConfidence: number;
  highConfidenceAreas: CapabilityArea[];
  mediumConfidenceAreas: CapabilityArea[];
  lowConfidenceAreas: CapabilityArea[];
  recommendedStrategy: string;
  nextSteps: string[];
  expertConsultationAreas: string[];
  fallbackOptions: FallbackOption[];
}

/**
 * Capability Area
 */
export interface CapabilityArea {
  name: string;
  description: string;
  confidence: number;
  reasoning: string;
  estimatedTimeline?: string;
  complexityReasons?: string[];
  recommendedExperts?: string[];
}

/**
 * Fallback Option
 */
export interface FallbackOption {
  approach: 'template-based' | 'hybrid-development' | 'expert-consultation' | 'manual-development';
  description: string;
  pros: string[];
  cons: string[];
  estimatedEffort: string;
  successProbability: number;
}

/**
 * Conversation Analytics
 */
export interface ConversationAnalytics {
  sessionDuration: number;
  messageCount: number;
  topicProgression: string[];
  userSatisfaction: number;
  goalAchievement: boolean;
  commonPatterns: string[];
  improvementSuggestions: string[];
}

/**
 * Enterprise Conversation Events
 */
export type ConversationEvent = 
  | { type: 'session-started'; sessionId: string; context: ConversationContext }
  | { type: 'message-received'; sessionId: string; message: string; intent: UserIntent }
  | { type: 'response-generated'; sessionId: string; response: ConversationResponse }
  | { type: 'action-triggered'; sessionId: string; action: ActionItem }
  | { type: 'limitation-identified'; sessionId: string; limitation: LimitationAssessment }
  | { type: 'session-ended'; sessionId: string; summary: ConversationSummary };

/**
 * Conversation State Machine
 */
export interface ConversationState {
  current: 'welcome' | 'gathering' | 'analyzing' | 'recommending' | 'implementing' | 'validating' | 'troubleshooting' | 'concluded';
  previous?: ConversationState['current'];
  transitions: ConversationTransition[];
  context: Record<string, any>;
}

/**
 * Conversation Transition
 */
export interface ConversationTransition {
  from: ConversationState['current'];
  to: ConversationState['current'];
  trigger: string;
  conditions?: string[];
  actions?: string[];
}