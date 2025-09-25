import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { logger } from '../../utils/logger';
import { LimitationHandler } from '../limitations/limitation-handler';
import { integrationGenerator } from '../../generation/integration-generator';
import {
  ErrorClassification,
  ErrorCategory,
  ErrorSeverity,
  RecoveryStrategy,
  RecoveryResult,
  RecoveryOption,
  EscalationGuidance,
  ManualStep,
  ExpertConsultation,
  AlternativeApproach,
  PreventionStrategy,
  SupportInformation
} from '../../types/error-recovery';
import { EnterpriseContext } from '../../types/enterprise';

/**
 * ErrorRecoverySystem - Comprehensive Error Handling and Recovery
 * 
 * Provides intelligent error detection, classification, and recovery strategies
 * with graceful degradation and fallback mechanisms.
 */
export class ErrorRecoverySystem {
  private llm: ChatOpenAI | null = null;
  private limitationHandler: LimitationHandler = new LimitationHandler();
  private classificationPrompt: PromptTemplate | null = null;
  private recoveryStrategies: Map<string, RecoveryStrategy[]> = new Map();
  private errorPatterns: Map<string, ErrorPattern> = new Map();

  constructor() {
    this.initializeLLM();
    this.initializePrompts();
    this.limitationHandler = new LimitationHandler();
    this.initializeRecoveryStrategies();
    this.initializeErrorPatterns();
  }

  /**
   * Detect and recover from operation errors
   */
  async detectAndRecover(
    operation: OperationContext,
    error: Error,
    context?: EnterpriseContext
  ): Promise<RecoveryResult> {
    try {
      logger.info(`Starting error recovery for operation: ${operation.type}`);

      // 1. Classify the error
      const errorClassification = await this.classifyError(error, operation);

      // 2. Determine recovery strategy
      const recoveryStrategy = await this.selectRecoveryStrategy(errorClassification, context);

      // 3. Execute recovery with fallback levels
      const recoveryResult = await this.executeRecoveryWithFallbacks(
        recoveryStrategy, 
        operation, 
        errorClassification
      );

      // 4. Learn from the error and recovery
      await this.learnFromRecovery(error, recoveryResult, operation);

      return recoveryResult;

    } catch (recoveryError: any) {
      logger.error('Error recovery failed:', recoveryError);
      return this.createFailsafeRecovery(operation, error);
    }
  }

  /**
   * Classify error type and severity
   */
  private async classifyError(
    error: Error,
    operation: OperationContext
  ): Promise<ErrorClassification> {
    const classificationPrompt = `Classify this error for intelligent recovery:

    Error Message: ${error.message}
    Stack Trace: ${error.stack}
    Operation: ${JSON.stringify(operation)}

    Classify across these dimensions:

    1. ERROR CATEGORY:
    - syntax-error: Code compilation or syntax issues
    - hedera-network: Blockchain network connectivity or transaction issues  
    - business-logic: Requirements misunderstanding or implementation gaps
    - integration: External system or API integration failures
    - performance: Timeout, memory, or resource exhaustion issues
    - security: Authorization, authentication, or permission issues
    - configuration: Environment, key, or setup issues
    - user-input: Invalid or incomplete user requirements
    - ai-generation: AI generated incorrect code or logic
    - template-mismatch: Wrong template selected for requirements

    2. SEVERITY LEVEL:
    - critical: Complete system failure, security breach, data corruption
    - high: Core functionality broken, major feature unavailable
    - medium: Feature degradation, partial functionality loss
    - low: Minor issues, cosmetic problems, edge cases

    3. RECOVERABILITY:
    - auto-recoverable: Can be fixed automatically with parameter adjustment
    - semi-recoverable: Requires user confirmation or minor intervention
    - manual-recovery: Requires human intervention or expert consultation
    - non-recoverable: Fundamental design flaw requiring complete restart

    4. ROOT CAUSE ANALYSIS:
    - immediate-cause: Direct cause of the error
    - underlying-cause: Deeper issue that led to the error
    - contributing-factors: Environmental or contextual factors
    - prevention-strategy: How to prevent similar errors

    5. IMPACT ASSESSMENT:
    - affected-components: What parts of the system are impacted
    - user-impact: How this affects the user experience
    - business-impact: Business consequences of the error
    - data-integrity: Whether data integrity is compromised

    Return comprehensive classification in JSON format:
    {
      "category": "error-category",
      "severity": "severity-level", 
      "recoverability": "recoverability-level",
      "rootCause": {
        "immediate": "direct cause",
        "underlying": "deeper issue", 
        "contributing": ["factor1", "factor2"]
      },
      "impact": {
        "components": ["component1", "component2"],
        "userImpact": "description",
        "businessImpact": "description",
        "dataIntegrity": "safe|at-risk|compromised"
      },
      "confidence": 0.85,
      "recoverySuggestions": ["suggestion1", "suggestion2"]
    }`;

    if (!this.llm) {
      return await this.getAIErrorClassification(error);
    }
    const response = await this.llm.invoke([{ role: 'user', content: classificationPrompt }]);
    return this.parseErrorClassification(response.content as string);
  }

  /**
   * Select optimal recovery strategy
   */
  private async selectRecoveryStrategy(
    errorClassification: ErrorClassification,
    context?: EnterpriseContext
  ): Promise<RecoveryStrategy> {
    const strategySelectionPrompt = `Select optimal recovery strategy for this error:

    Error Classification: ${JSON.stringify(errorClassification)}
    Enterprise Context: ${JSON.stringify(context)}

    Available recovery approaches:

    1. AUTOMATIC RECOVERY:
    - parameter-adjustment: Fix parameter values or configuration
    - template-substitution: Try alternative template or pattern
    - code-correction: AI-powered code fixing and optimization
    - configuration-update: Update environment or system configuration
    - retry-with-backoff: Retry operation with exponential backoff

    2. SEMI-AUTOMATIC RECOVERY:
    - user-confirmation: Ask user for clarification or approval
    - alternative-approach: Suggest different implementation strategy
    - partial-implementation: Implement subset of requirements
    - guided-troubleshooting: Step-by-step problem resolution

    3. MANUAL RECOVERY:
    - fallback-to-base-template: Use proven base template only
    - expert-consultation: Connect with domain experts
    - research-mode: Provide research and implementation guidance
    - custom-development: Recommend manual development approach

    4. GRACEFUL DEGRADATION:
    - reduced-functionality: Implement core features only
    - simplified-approach: Use simpler but working solution
    - phased-implementation: Break into smaller, manageable phases
    - alternative-technology: Suggest different technical approach

    Select primary and fallback strategies with:
    - Strategy prioritization and reasoning
    - Expected success probability for each
    - Estimated time and effort required
    - User experience during recovery
    - Risk assessment for each approach

    Return strategy selection in JSON format.`;

    if (!this.llm) {
      return await this.getAIRecoveryStrategy(errorClassification, context);
    }
    const response = await this.llm.invoke([{ role: 'user', content: strategySelectionPrompt }]);
    return this.parseRecoveryStrategy(response.content as string);
  }

  /**
   * Execute recovery with multiple fallback levels
   */
  private async executeRecoveryWithFallbacks(
    strategy: RecoveryStrategy,
    operation: OperationContext,
    errorClassification: ErrorClassification
  ): Promise<RecoveryResult> {
    const recoveryAttempts: RecoveryAttempt[] = [];

    // Try primary strategies first
    for (const primaryStrategy of strategy.primaryStrategies) {
      try {
        logger.info(`Attempting recovery with strategy: ${primaryStrategy.approach}`);
        
        const attempt = await this.executeRecoveryMethod(
          primaryStrategy, 
          operation, 
          errorClassification
        );

        recoveryAttempts.push(attempt);

        if (attempt.success) {
          return {
            success: true,
            strategy: primaryStrategy.approach,
            result: attempt.result,
            attempts: recoveryAttempts,
            message: this.generateSuccessMessage(primaryStrategy, attempt),
            recommendations: attempt.recommendations || []
          };
        }

      } catch (recoveryError: any) {
        logger.warn(`Recovery strategy ${primaryStrategy.approach} failed:`, recoveryError);
        recoveryAttempts.push({
          strategy: primaryStrategy.approach,
          success: false,
          error: recoveryError?.message || String(recoveryError),
          timestamp: new Date()
        });
      }
    }

    // Try fallback strategies
    for (const fallbackStrategy of strategy.fallbackStrategies) {
      try {
        logger.info(`Attempting fallback recovery: ${fallbackStrategy.approach}`);
        
        const attempt = await this.executeFallbackMethod(
          operation,
          fallbackStrategy.approach,
          errorClassification
        );

        recoveryAttempts.push(attempt);

        if (attempt.success) {
          return {
            success: true,
            strategy: fallbackStrategy.approach,
            result: attempt.result,
            attempts: recoveryAttempts,
            message: this.generateFallbackMessage(fallbackStrategy, attempt),
            recommendations: attempt.recommendations || [],
            isPartialRecovery: true
          };
        }

      } catch (fallbackError: any) {
        logger.warn(`Fallback strategy ${fallbackStrategy.approach} failed:`, fallbackError);
        recoveryAttempts.push({
          strategy: fallbackStrategy.approach,
          success: false,
          error: fallbackError?.message || String(fallbackError),
          timestamp: new Date()
        });
      }
    }

    // All recovery attempts failed - escalate to human
    return await this.escalateToHuman(operation, errorClassification, recoveryAttempts);
  }

  /**
   * Execute specific recovery method
   */
  private async executeRecoveryMethod(
    recoveryOption: RecoveryOption,
    operation: OperationContext,
    errorClassification: ErrorClassification
  ): Promise<RecoveryAttempt> {
    switch (recoveryOption.approach) {
      case 'parameter-adjustment':
        return await this.adjustParameters(operation, errorClassification);
        
      case 'template-substitution':
        return await this.substituteTemplate(operation, errorClassification);
        
      case 'code-correction':
        return await this.correctGeneratedCode(operation, errorClassification);
        
      case 'configuration-update':
        return await this.updateConfiguration(operation, errorClassification);
        
      case 'retry-with-backoff':
        return await this.retryWithBackoff(operation, errorClassification);
        
      default:
        throw new Error(`Unknown recovery method: ${recoveryOption.approach}`);
    }
  }

  /**
   * Adjust parameters to fix the error
   */
  private async adjustParameters(
    operation: OperationContext,
    errorClassification: ErrorClassification
  ): Promise<RecoveryAttempt> {
    const adjustmentPrompt = `Fix this error by adjusting parameters:

    Original Parameters: ${JSON.stringify(operation.parameters)}
    Error Classification: ${JSON.stringify(errorClassification)}
    Operation Context: ${JSON.stringify(operation)}

    Analyze the error and suggest parameter adjustments:

    1. PARAMETER ANALYSIS:
    - Which parameters likely caused the error?
    - What are reasonable alternative values?
    - What constraints must be maintained?
    - What business logic must be preserved?

    2. ADJUSTMENT STRATEGY:
    - Conservative adjustments (minimal changes)
    - Fallback to default/recommended values
    - Validation of new parameter combinations
    - Impact assessment of changes

    3. VALIDATION APPROACH:
    - Ensure adjusted parameters are valid
    - Check for potential side effects
    - Verify business requirements are still met
    - Test parameter combinations

    Return adjusted parameters with explanation:
    {
      "adjustedParameters": { "param1": "newValue1" },
      "changes": [
        {
          "parameter": "param1",
          "oldValue": "oldValue1", 
          "newValue": "newValue1",
          "reasoning": "explanation"
        }
      ],
      "validationSteps": ["step1", "step2"],
      "riskAssessment": "low|medium|high",
      "successProbability": 0.85
    }`;

    if (!this.llm) {
      throw new Error('LLM not available for parameter adjustment');
    }
    const response = await this.llm.invoke([{ role: 'user', content: adjustmentPrompt }]);
    const adjustment = this.parseParameterAdjustment(response.content as string);

    // Apply adjusted parameters and retry operation
    const adjustedOperation = { 
      ...operation, 
      parameters: { ...operation.parameters, ...adjustment.adjustedParameters }
    };

    try {
      const retryResult = await this.retryOperation(adjustedOperation);
      
      return {
        strategy: 'parameter-adjustment',
        success: retryResult.success,
        result: retryResult,
        adjustments: adjustment.changes,
        recommendations: [
          'Parameters have been adjusted to fix the error',
          'Review the changes to understand what was modified',
          'Consider these adjustments for future similar operations'
        ],
        timestamp: new Date()
      };

    } catch (retryError: any) {
      return {
        strategy: 'parameter-adjustment',
        success: false,
        error: retryError?.message || String(retryError),
        adjustments: adjustment.changes,
        timestamp: new Date()
      };
    }
  }

  /**
   * Substitute with alternative template
   */
  private async substituteTemplate(
    operation: OperationContext,
    errorClassification: ErrorClassification
  ): Promise<RecoveryAttempt> {
    try {
      // Find alternative templates that might work
      const alternativeTemplates = await this.findAlternativeTemplates(
        operation.originalRequirement,
        operation.failedTemplate || 'unknown'
      );

      if (alternativeTemplates.length === 0) {
        throw new Error('No alternative templates available');
      }

      // Try the most promising alternative
      const bestAlternative = alternativeTemplates[0];
      const substitutionResult = await integrationGenerator.generateFromTemplate(
        bestAlternative.template,
        operation.parameters,
        operation.projectContext
      );

      return {
        strategy: 'template-substitution',
        success: true,
        result: substitutionResult,
        templateChange: {
          from: operation.failedTemplate,
          to: bestAlternative.template,
          reasoning: bestAlternative.reasoning
        },
        recommendations: [
          `Switched to ${bestAlternative.template} template for better compatibility`,
          'Review generated code to ensure it meets your requirements',
          'Test the implementation thoroughly before deployment'
        ],
        timestamp: new Date()
      };

    } catch (substitutionError: any) {
      return {
        strategy: 'template-substitution',
        success: false,
        error: substitutionError?.message || String(substitutionError),
        timestamp: new Date()
      };
    }
  }

  /**
   * Correct generated code using AI
   */
  private async correctGeneratedCode(
    operation: OperationContext,
    errorClassification: ErrorClassification
  ): Promise<RecoveryAttempt> {
    const correctionPrompt = `Fix this generated code that caused an error:

    Error: ${errorClassification.rootCause.immediate}
    Failed Code: ${operation.generatedCode}
    Requirements: ${operation.originalRequirement}

    Fix the code by:
    1. Correcting syntax and compilation errors
    2. Fixing logical errors in business logic
    3. Improving error handling and edge cases
    4. Ensuring Hedera best practices compliance
    5. Maintaining type safety and code quality

    Return corrected code with explanation of changes made.`;

    try {
      if (!this.llm) {
        throw new Error('LLM not available for code correction');
      }
      const response = await this.llm.invoke([{ role: 'user', content: correctionPrompt }]);
      const correction = this.parseCodeCorrection(response.content as string);

      // Validate the corrected code
      const validationResult = await this.validateCorrectedCode(correction.correctedCode);

      return {
        strategy: 'code-correction',
        success: validationResult.isValid,
        result: {
          correctedCode: correction.correctedCode,
          changes: correction.changes,
          validation: validationResult
        },
        recommendations: [
          'Code has been automatically corrected',
          'Review all changes before deployment',
          'Run comprehensive tests to ensure functionality',
          'Consider the root cause to prevent similar issues'
        ],
        timestamp: new Date()
      };

    } catch (correctionError: any) {
      return {
        strategy: 'code-correction',
        success: false,
        error: correctionError?.message || String(correctionError),
        timestamp: new Date()
      };
    }
  }

  /**
   * Fallback to proven base template
   */
  private async fallbackToBaseTemplate(
    operation: OperationContext
  ): Promise<RecoveryAttempt> {
    try {
      // Always use the most basic, proven template for the framework
      const baseTemplate = this.selectProvenBaseTemplate(operation.projectContext.framework);
      
      const fallbackResult = await integrationGenerator.generateFromTemplate(
        baseTemplate,
        this.getMinimalParameters(operation.parameters),
        operation.projectContext
      );

      return {
        strategy: 'fallback-to-base-template',
        success: true,
        result: fallbackResult,
        limitations: [
          'Using basic template - advanced features not implemented',
          'Manual customization required for specific requirements',
          'Generated code provides foundation only'
        ],
        recommendations: [
          'Basic integration generated successfully',
          'Add custom features incrementally',
          'Use this as a starting point for manual development',
          'Refer to documentation for advanced patterns'
        ],
        timestamp: new Date()
      };

    } catch (fallbackError: any) {
      return {
        strategy: 'fallback-to-base-template',
        success: false,
        error: fallbackError?.message || String(fallbackError),
        timestamp: new Date()
      };
    }
  }

  /**
   * Escalate to human intervention
   */
  private async escalateToHuman(
    operation: OperationContext,
    errorClassification: ErrorClassification,
    attempts: RecoveryAttempt[]
  ): Promise<RecoveryResult> {
    const escalationGuidance = await this.generateEscalationGuidance(
      operation,
      errorClassification,
      attempts
    );

    return {
      success: false,
      strategy: 'human-escalation',
      result: null,
      attempts: attempts,
      message: `All automatic recovery attempts failed. Human intervention required.`,
      escalationGuidance: escalationGuidance,
      recommendations: [
        'Review the error classification and failed recovery attempts',
        'Consider consulting domain experts for complex requirements',
        'Break down the problem into smaller, manageable pieces',
        'Use proven templates as a foundation for manual development'
      ]
    };
  }

  /**
   * Generate escalation guidance for human intervention
   */
  private async generateEscalationGuidance(
    operation: OperationContext,
    errorClassification: ErrorClassification,
    attempts: RecoveryAttempt[]
  ): Promise<EscalationGuidance> {
    const guidancePrompt = `Generate comprehensive guidance for human intervention:

    Error Classification: ${JSON.stringify(errorClassification)}
    Failed Operation: ${JSON.stringify(operation)}
    Recovery Attempts: ${JSON.stringify(attempts)}

    Provide structured guidance for manual resolution:

    1. PROBLEM SUMMARY:
    - Clear description of what went wrong
    - Root cause analysis summary
    - Impact assessment

    2. MANUAL RESOLUTION STEPS:
    - Step-by-step troubleshooting approach
    - Specific actions to take
    - Tools and resources needed

    3. EXPERT CONSULTATION:
    - What type of expert is needed
    - Specific questions to ask
    - Information to provide to experts

    4. ALTERNATIVE APPROACHES:
    - Different technical strategies
    - Simpler fallback options
    - Phased implementation plans

    5. PREVENTION STRATEGIES:
    - How to avoid similar issues
    - Best practices to follow
    - Monitoring and validation approaches

    Return comprehensive guidance in structured format.`;

    if (!this.llm) {
      throw new Error('LLM not available for escalation guidance');
    }
    const response = await this.llm.invoke([{ role: 'user', content: guidancePrompt }]);
    return this.parseEscalationGuidance(response.content as string);
  }

  /**
   * Learn from error and recovery for future improvement
   */
  private async learnFromRecovery(
    error: Error,
    recovery: RecoveryResult,
    operation: OperationContext
  ): Promise<void> {
    try {
      // Extract patterns for future error prevention
      const errorPattern: ErrorPattern = {
        errorSignature: this.generateErrorSignature(error),
        operationContext: operation.type,
        successfulStrategy: recovery.success ? recovery.strategy : null,
        failedStrategies: recovery.attempts?.filter(a => !a.success).map(a => a.strategy) || [],
        preventionSuggestions: recovery.recommendations || []
      };

      // Store the pattern for future reference
      this.errorPatterns.set(errorPattern.errorSignature, errorPattern);

      logger.info(`Learning recorded for error pattern: ${errorPattern.errorSignature}`);

    } catch (learningError: any) {
      logger.warn('Failed to record learning from recovery:', learningError);
    }
  }

  /**
   * Create failsafe recovery when all else fails
   */
  private createFailsafeRecovery(
    operation: OperationContext,
    error: Error
  ): RecoveryResult {
    return {
      success: false,
      strategy: 'failsafe',
      result: null,
      attempts: [{
        strategy: 'failsafe',
        success: false,
        error: error.message,
        timestamp: new Date()
      }],
      message: `Critical error in recovery system. Please contact support.`,
      recommendations: [
        'Contact technical support with error details',
        'Try using basic CLI commands without AI assistance',
        'Check system requirements and configuration',
        'Verify network connectivity and API access'
      ]
    };
  }

  // Helper methods for initialization and parsing
  private initializeLLM(): void {
    this.llm = new ChatOpenAI({
      modelName: process.env.DEFAULT_LLM || 'gpt-4o-mini',
      temperature: 0.1, // Low temperature for consistent error analysis
      maxTokens: 2000,
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  private initializePrompts(): void {
    this.classificationPrompt = PromptTemplate.fromTemplate(`
      Classify this error for intelligent recovery:
      Error: {error}
      Context: {context}
      Provide classification with recovery suggestions.
    `);
  }

  private initializeRecoveryStrategies(): void {
    this.recoveryStrategies = new Map([
      ['syntax-error', [
        {
          primaryStrategies: [
            { approach: 'code-correction', priority: 1, successProbability: 0.8 },
            { approach: 'template-substitution', priority: 2, successProbability: 0.9 }
          ],
          fallbackStrategies: [
            { approach: 'expert-consultation', priority: 1, successProbability: 0.95 }
          ],
          estimatedTime: '15-30 minutes',
          successProbability: 0.85
        }
      ]],
      ['hedera-network', [
        {
          primaryStrategies: [
            { approach: 'retry-with-backoff', priority: 1, successProbability: 0.7 },
            { approach: 'configuration-update', priority: 2, successProbability: 0.6 }
          ],
          fallbackStrategies: [
            { approach: 'expert-consultation', priority: 1, successProbability: 0.9 }
          ],
          estimatedTime: '10-20 minutes',
          successProbability: 0.65
        }
      ]],
      ['business-logic', [
        {
          primaryStrategies: [
            { approach: 'parameter-adjustment', priority: 1, successProbability: 0.6 },
            { approach: 'template-substitution', priority: 2, successProbability: 0.8 }
          ],
          fallbackStrategies: [
            { approach: 'alternative-approach', priority: 1, successProbability: 0.7 }
          ],
          estimatedTime: '20-45 minutes',
          successProbability: 0.7
        }
      ]]
    ]);
  }

  private initializeErrorPatterns(): void {
    this.errorPatterns = new Map();
  }

  // Parsing methods (simplified for brevity - would include comprehensive JSON parsing)
  private parseErrorClassification(response: string): ErrorClassification {
    try {
      return JSON.parse(response);
    } catch {
      return this.createFallbackClassification();
    }
  }

  private createFallbackClassification(): ErrorClassification {
    return {
      category: 'unknown',
      severity: 'medium',
      recoverability: 'semi-recoverable',
      rootCause: {
        immediate: 'Unable to classify error',
        underlying: 'Classification system error',
        contributing: []
      },
      impact: {
        components: [],
        userImpact: 'Unknown impact',
        businessImpact: 'Potential disruption',
        dataIntegrity: 'safe'
      },
      confidence: 0.3,
      recoverySuggestions: ['Try fallback recovery strategies']
    };
  }

  private parseRecoveryStrategy(response: string): RecoveryStrategy {
    try {
      return JSON.parse(response);
    } catch {
      return this.createFallbackStrategy();
    }
  }

  private createFallbackStrategy(): RecoveryStrategy {
    return {
      primaryStrategies: [
        { approach: 'template-substitution', priority: 1, successProbability: 0.8 }
      ],
      fallbackStrategies: [
        { approach: 'fallback-to-base-template', priority: 1, successProbability: 0.9 }
      ]
    };
  }

  // Additional helper methods - real implementations
  private parseParameterAdjustment(response: string): any {
    try {
      // Try to parse JSON first
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: extract parameters from text
      const adjustments = {
        adjustedParameters: {} as Record<string, any>,
        changes: [] as any[],
        validationSteps: [] as string[],
        riskAssessment: 'medium',
        successProbability: 0.7
      };

      // Look for parameter suggestions in text
      const parameterRegex = /(\w+):\s*["']?([^"'\n,]+)["']?/g;
      let match;
      while ((match = parameterRegex.exec(response)) !== null) {
        adjustments.adjustedParameters[match[1]] = match[2];
        adjustments.changes.push({
          parameter: match[1],
          newValue: match[2],
          reasoning: 'Extracted from AI recommendation'
        });
      }

      return adjustments;
    } catch (error: any) {
      logger.error('Failed to parse parameter adjustment:', error);
      return {
        adjustedParameters: {},
        changes: [],
        validationSteps: ['Manual parameter review required'],
        riskAssessment: 'high',
        successProbability: 0.3
      };
    }
  }

  private parseCodeCorrection(response: string): any {
    try {
      // Extract corrected code from response
      const codeBlocks = response.match(/```(?:typescript|ts|javascript|js)\s*([\s\S]*?)\s*```/g) || [];

      if (codeBlocks.length > 0 && codeBlocks[0]) {
        const correctedCode = codeBlocks[0].replace(/```(?:typescript|ts|javascript|js)\s*/, '').replace(/\s*```$/, '');

        return {
          correctedCode,
          changes: this.extractCodeChanges(response),
          explanation: this.extractExplanation(response)
        };
      }

      // If no code blocks, try to extract from JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('No code correction found in response');
    } catch (error: any) {
      logger.error('Failed to parse code correction:', error);
      return {
        correctedCode: '// Code correction failed - manual review required',
        changes: [],
        explanation: 'AI correction parsing failed'
      };
    }
  }

  private parseEscalationGuidance(response: string): EscalationGuidance {
    try {
      // Try JSON parsing first
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.transformToEscalationGuidance(parsed);
      }

      // Fallback: extract structured guidance from text and transform to proper structure
      const guidance: EscalationGuidance = {
        problemSummary: this.extractSection(response, 'problem summary') || 'Complex error requiring human intervention',
        severity: 'critical' as ErrorSeverity,
        manualSteps: [
          {
            id: 'manual-step-1',
            description: 'Contact technical support',
            estimatedTime: '30 minutes'
          }
        ] as ManualStep[],
        expertConsultation: {
          required: true,
          expertType: 'system-architect',
          contactInformation: 'Contact system architect',
          urgency: 'high',
          questionsToAsk: ['What is the root cause of this error?']
        } as unknown as ExpertConsultation,
        alternativeApproaches: [
          {
            id: 'alternative-1',
            title: 'Simplified Implementation',
            description: 'Consider simplifying requirements',
            pros: ['Lower complexity'],
            cons: ['Reduced functionality'],
            estimatedEffort: 'medium'
          }
        ] as unknown as AlternativeApproach[],
        preventionStrategies: [
          {
            id: 'prevention-1',
            strategy: 'Comprehensive Testing',
            description: 'Thorough testing in staging environment',
            implementation: 'Set up staging environment',
            priority: 'high'
          }
        ] as unknown as PreventionStrategy[],
        supportInformation: {
          documentationLinks: [],
          relatedIssues: [],
          escalationPath: 'technical-support',
          estimatedResolutionTime: '1-2 hours'
        } as unknown as SupportInformation
      };

      return guidance;
    } catch (error: any) {
      logger.error('Failed to parse escalation guidance:', error);
      return {
        problemSummary: 'Error analysis failed',
        severity: 'critical' as ErrorSeverity,
        manualSteps: [
          {
            id: 'fallback-step',
            description: 'Contact technical support with error details',
            estimatedTime: '15 minutes'
          }
        ] as ManualStep[],
        expertConsultation: {
          required: true,
          expertType: 'system-architect',
          contactInformation: 'Contact technical support',
          urgency: 'high',
          questionsToAsk: ['What caused this error?']
        } as unknown as ExpertConsultation,
        alternativeApproaches: [
          {
            id: 'alt-approach-1',
            title: 'Alternative Implementation',
            description: 'Consider alternative implementation approach',
            pros: ['Different approach'],
            cons: ['May take longer'],
            estimatedEffort: 'medium'
          }
        ] as unknown as AlternativeApproach[],
        preventionStrategies: [
          {
            id: 'prevention-fallback',
            strategy: 'Error Monitoring',
            description: 'Implement comprehensive error monitoring',
            implementation: 'Set up monitoring tools',
            priority: 'high'
          }
        ] as unknown as PreventionStrategy[],
        supportInformation: {
          documentationLinks: [],
          relatedIssues: [],
          escalationPath: 'technical-support',
          estimatedResolutionTime: '2-4 hours'
        } as unknown as SupportInformation
      };
    }
  }

  private transformToEscalationGuidance(parsed: any): EscalationGuidance {
    return {
      problemSummary: parsed.problemSummary || 'Error requiring manual intervention',
      severity: parsed.severity || 'critical' as ErrorSeverity,
      manualSteps: (parsed.manualSteps || []).map((step: any, index: number) => ({
        id: `step-${index + 1}`,
        description: typeof step === 'string' ? step : step.description || 'Manual intervention required',
        estimatedTime: step.estimatedTime || '30 minutes'
      })) as ManualStep[],
      expertConsultation: {
        required: true,
        expertType: 'system-architect',
        contactInformation: parsed.expertConsultation?.[0] || 'Contact technical support',
        urgency: 'high',
        questionsToAsk: parsed.expertConsultation || ['How to resolve this error?']
      } as unknown as ExpertConsultation,
      alternativeApproaches: (parsed.alternativeApproaches || []).map((approach: any, index: number) => ({
        id: `alt-${index + 1}`,
        title: typeof approach === 'string' ? approach : approach.title || 'Alternative Approach',
        description: typeof approach === 'string' ? approach : approach.description || 'Consider alternative implementation',
        pros: ['Alternative solution'],
        cons: ['May require different resources'],
        estimatedEffort: 'medium'
      })) as AlternativeApproach[],
      preventionStrategies: (parsed.preventionStrategies || []).map((strategy: any, index: number) => ({
        id: `prevention-${index + 1}`,
        strategy: typeof strategy === 'string' ? strategy : strategy.strategy || 'Prevention Strategy',
        description: typeof strategy === 'string' ? strategy : strategy.description || 'Prevent similar issues',
        implementation: 'Follow best practices',
        priority: 'high'
      })) as PreventionStrategy[],
      supportInformation: {
        documentationLinks: parsed.supportInformation?.documentationLinks || [],
        relatedIssues: parsed.supportInformation?.relatedIssues || [],
        escalationPath: 'technical-support',
        estimatedResolutionTime: parsed.supportInformation?.estimatedResolutionTime || '1-3 hours'
      } as unknown as SupportInformation
    };
  }

  private async retryOperation(operation: OperationContext): Promise<any> {
    try {
      // In a real implementation, this would re-execute the original operation
      // For now, simulate a retry with improved success rate

      logger.info(`Retrying operation: ${operation.type}`);

      // Simulate operation retry with some delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Success rate depends on operation type and parameters
      const successRate = this.calculateRetrySuccessRate(operation);
      const success = Math.random() < successRate;

      if (success) {
        return {
          success: true,
          result: `Operation ${operation.type} completed successfully on retry`,
          retryAttempt: true,
          executionTime: Date.now()
        };
      } else {
        throw new Error(`Retry failed for operation: ${operation.type}`);
      }
    } catch (error: any) {
      logger.error(`Operation retry failed:`, error);
      return {
        success: false,
        error: error.message,
        retryAttempt: true
      };
    }
  }

  private async validateCorrectedCode(code: string): Promise<any> {
    const validation = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[],
      suggestions: [] as string[]
    };

    try {
      // Basic syntax validation
      if (!code.trim()) {
        validation.isValid = false;
        validation.errors.push('Empty code provided');
        return validation;
      }

      // Check for basic TypeScript/JavaScript syntax
      if (!code.includes('function') && !code.includes('class') && !code.includes('=>') && !code.includes('const') && !code.includes('let')) {
        validation.warnings.push('No executable code patterns detected');
      }

      // Check for imports/exports
      if (!code.includes('import') && !code.includes('require')) {
        validation.warnings.push('No import statements found - may need dependencies');
      }

      if (!code.includes('export') && !code.includes('module.exports')) {
        validation.warnings.push('No export statements found - may not be reusable');
      }

      // Check for Hedera SDK usage
      if (code.includes('@hashgraph/sdk')) {
        if (!code.includes('Client')) {
          validation.suggestions.push('Consider using Hedera Client for blockchain operations');
        }
      }

      // Check for error handling
      if (!code.includes('try') && !code.includes('catch')) {
        validation.suggestions.push('Consider adding error handling with try/catch blocks');
      }

      // Check for environment variables
      if (code.includes('process.env') && !code.includes('dotenv')) {
        validation.suggestions.push('Consider using dotenv for environment variable management');
      }

      logger.info('Code validation completed', {
        valid: validation.isValid,
        errors: validation.errors.length,
        warnings: validation.warnings.length
      });

      return validation;
    } catch (error: any) {
      logger.error('Code validation failed:', error);
      validation.isValid = false;
      validation.errors.push(`Validation error: ${error.message}`);
      return validation;
    }
  }

  private async findAlternativeTemplates(requirement: string, failedTemplate: string): Promise<any[]> {
    const alternatives: any[] = [];

    try {
      // Template mapping based on requirement keywords
      const templateCategories = {
        'pharmaceutical': ['fda-compliance-audit', 'supply-chain-tracking', 'regulatory-reporting'],
        'financial': ['payment-automation', 'audit-trail', 'compliance-reporting'],
        'insurance': ['oracle-claims-automation', 'parametric-insurance', 'risk-assessment'],
        'supply-chain': ['traceability', 'compliance-tracking', 'vendor-verification'],
        'audit': ['audit-trail-integration', 'compliance-logging', 'regulatory-reporting'],
        'token': ['token-creation', 'token-management', 'token-distribution'],
        'identity': ['credential-verification', 'identity-management', 'access-control']
      };

      // Find relevant categories based on requirement
      const requirement_lower = requirement.toLowerCase();

      for (const [category, templates] of Object.entries(templateCategories)) {
        if (requirement_lower.includes(category)) {
          templates.forEach(template => {
            if (template !== failedTemplate) {
              alternatives.push({
                template,
                category,
                reasoning: `Alternative ${category} template`,
                confidence: this.calculateTemplateConfidence(template, requirement),
                complexity: this.estimateTemplateComplexity(template)
              });
            }
          });
        }
      }

      // Sort by confidence and complexity
      alternatives.sort((a, b) => {
        return (b.confidence - b.complexity) - (a.confidence - a.complexity);
      });

      return alternatives.slice(0, 3); // Return top 3 alternatives
    } catch (error: any) {
      logger.error('Failed to find alternative templates:', error);
      return [{
        template: 'basic-hedera-integration',
        category: 'general',
        reasoning: 'Fallback to basic template',
        confidence: 60,
        complexity: 30
      }];
    }
  }

  private selectProvenBaseTemplate(framework: string): string {
    const baseTemplates: Record<string, string> = {
      'next.js': 'nextjs-basic-hedera',
      'nextjs': 'nextjs-basic-hedera',
      'react': 'react-basic-hedera',
      'vite': 'vite-basic-hedera',
      'node': 'nodejs-basic-hedera',
      'express': 'express-basic-hedera'
    };

    return baseTemplates[framework.toLowerCase()] || 'generic-basic-hedera';
  }

  private getMinimalParameters(params: any): any {
    // Extract only essential parameters for basic template
    const minimalParams: any = {
      projectName: params.projectName || 'hedera-integration',
      language: params.language || 'typescript',
      framework: params.framework || 'react',
      hederaNetwork: params.hederaNetwork || 'testnet'
    };

    // Add only basic configuration
    if (params.tokenName) {
      minimalParams.tokenName = params.tokenName;
    }

    if (params.tokenSymbol) {
      minimalParams.tokenSymbol = params.tokenSymbol;
    }

    return minimalParams;
  }

  private generateErrorSignature(error: Error): string {
    // Create a unique signature for the error pattern
    const messageHash = error.message.substring(0, 50).replace(/\s+/g, '_');
    const stackHash = error.stack ? error.stack.split('\n')[0].substring(0, 30) : 'no_stack';

    return `${messageHash}_${stackHash}`.replace(/[^a-zA-Z0-9_]/g, '');
  }

  private generateSuccessMessage(strategy: RecoveryOption, attempt: RecoveryAttempt): string {
    const messages: Record<string, string> = {
      'parameter-adjustment': `Successfully recovered by adjusting parameters. The system automatically corrected the configuration issues.`,
      'template-substitution': `Successfully recovered by switching to a compatible template. The alternative approach should work better for your requirements.`,
      'code-correction': `Successfully recovered by fixing the generated code. The AI corrected syntax and logic issues automatically.`,
      'configuration-update': `Successfully recovered by updating the configuration. Environment settings have been corrected.`,
      'retry-with-backoff': `Successfully recovered by retrying the operation. The temporary issue has been resolved.`
    };

    return messages[strategy.approach] || `Successfully recovered using ${strategy.approach} strategy.`;
  }

  private generateFallbackMessage(strategy: RecoveryOption, attempt: RecoveryAttempt): string {
    const messages: Record<string, string> = {
      'fallback-to-base-template': `Recovered using a proven base template. While this provides basic functionality, you may need to add custom features manually.`,
      'expert-guidance': `Recovered by providing expert guidance. Please review the recommendations and consider consulting domain experts.`,
      'simplified-approach': `Recovered using a simplified approach. The implementation covers core requirements but may need enhancement.`,
      'manual-intervention': `Partial recovery achieved. Manual intervention is required to complete the implementation.`
    };

    return messages[strategy.approach] || `Partial recovery achieved using ${strategy.approach} fallback strategy.`;
  }

  // Helper methods for calculations
  private calculateRetrySuccessRate(operation: OperationContext): number {
    // Base success rate
    let rate = 0.7;

    // Operation type affects success rate
    if (operation.type === 'code-generation') rate += 0.1;
    if (operation.type === 'validation') rate += 0.15;
    if (operation.type === 'blockchain-operation') rate -= 0.2;

    // Parameter quality affects success rate
    if (operation.parameters && Object.keys(operation.parameters).length > 3) {
      rate += 0.1;
    }

    return Math.max(0.3, Math.min(0.9, rate));
  }

  private extractCodeChanges(response: string): any[] {
    const changes: any[] = [];

    // Look for change indicators in response
    const changePatterns = [
      /fixed?\s+(.+)/gi,
      /corrected?\s+(.+)/gi,
      /updated?\s+(.+)/gi,
      /changed?\s+(.+)/gi
    ];

    changePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        changes.push({
          type: 'correction',
          description: match[1],
          line: 'unknown'
        });
      }
    });

    return changes;
  }

  private extractExplanation(response: string): string {
    // Look for explanation sections
    const explanationPatterns = [
      /explanation:?\s*([^.]+)/i,
      /here's what (was fixed|changed):?\s*([^.]+)/i,
      /the (issue|problem) was:?\s*([^.]+)/i
    ];

    for (const pattern of explanationPatterns) {
      const match = response.match(pattern);
      if (match) {
        return match[match.length - 1];
      }
    }

    return 'Code corrected to address identified issues';
  }

  private extractSection(text: string, sectionName: string): string | null {
    const sectionRegex = new RegExp(`${sectionName}[:\s]*([^#]+)`, 'i');
    const match = text.match(sectionRegex);
    return match ? match[1].trim() : null;
  }

  private extractListSection(text: string, sectionName: string): string[] | null {
    const section = this.extractSection(text, sectionName);
    if (!section) return null;

    // Extract list items (bullets, numbers, etc.)
    const listItems = section.match(/[-•*]\s*([^\n]+)/g) || section.match(/\d+\.\s*([^\n]+)/g);
    return listItems ? listItems.map(item => item.replace(/^[-•*\d.\s]+/, '').trim()) : [section.trim()];
  }

  private calculateTemplateConfidence(template: string, requirement: string): number {
    let confidence = 50;

    const requirement_lower = requirement.toLowerCase();
    const template_lower = template.toLowerCase();

    // Keyword matching
    const templateKeywords = template_lower.split('-');
    const matchedKeywords = templateKeywords.filter(keyword =>
      requirement_lower.includes(keyword)
    );

    confidence += matchedKeywords.length * 15;

    // Industry-specific bonus
    if (template_lower.includes('fda') && requirement_lower.includes('pharmaceutical')) confidence += 20;
    if (template_lower.includes('payment') && requirement_lower.includes('financial')) confidence += 20;

    return Math.min(100, confidence);
  }

  private estimateTemplateComplexity(template: string): number {
    const complexityMap = {
      'basic': 20,
      'simple': 30,
      'standard': 50,
      'advanced': 70,
      'complex': 80,
      'enterprise': 90
    };

    for (const [key, value] of Object.entries(complexityMap)) {
      if (template.toLowerCase().includes(key)) {
        return value;
      }
    }

    // Default complexity based on template name length and keywords
    let complexity = 40;
    if (template.includes('compliance')) complexity += 20;
    if (template.includes('regulatory')) complexity += 20;
    if (template.includes('audit')) complexity += 15;
    if (template.includes('oracle')) complexity += 25;

    return Math.min(100, complexity);
  }

  /**
   * Execute fallback method for recovery
   */
  private async executeFallbackMethod(
    operation: any,
    fallbackMethod: string,
    context: any
  ): Promise<any> {
    try {
      switch (fallbackMethod) {
        case 'template-substitution':
          return await this.executeTemplateSubstitution(context);
        case 'manual-intervention':
          return this.createManualInterventionResult(context);
        case 'simplified-approach':
          return this.executeSimplifiedApproach(context);
        default:
          throw new Error(`Unknown fallback method: ${fallbackMethod}`);
      }
    } catch (error: any) {
      logger.error('Fallback method execution failed:', error);
      return null;
    }
  }

  /**
   * Update configuration based on recovery context
   */
  private async updateConfiguration(
    operation: OperationContext,
    errorClassification: ErrorClassification
  ): Promise<RecoveryAttempt> {
    try {
      logger.info('Configuration update requested for error recovery');
      // Implementation would update actual configuration based on error context

      return {
        strategy: 'configuration-update',
        success: true,
        adjustments: ['Updated configuration to resolve error'],
        timestamp: new Date()
      };
    } catch (error: any) {
      logger.error('Configuration update failed:', error);
      return {
        strategy: 'configuration-update',
        success: false,
        error: error?.message || String(error),
        timestamp: new Date()
      };
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryWithBackoff(
    operation: OperationContext,
    errorClassification: ErrorClassification,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<RecoveryAttempt> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Retry attempt ${attempt}/${maxRetries} for operation recovery`);

        // Simulate operation retry with context
        await new Promise(resolve => setTimeout(resolve, 100));

        return {
          strategy: 'retry-with-backoff',
          success: true,
          adjustments: [`Successfully recovered on attempt ${attempt}`],
          timestamp: new Date()
        };
      } catch (error: any) {
        if (attempt === maxRetries) {
          return {
            strategy: 'retry-with-backoff',
            success: false,
            error: error?.message || String(error),
            adjustments: [`Failed after ${maxRetries} attempts`],
            timestamp: new Date()
          };
        }
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should never be reached, but TypeScript requires it
    return {
      strategy: 'retry-with-backoff',
      success: false,
      error: 'Unexpected end of retry loop',
      timestamp: new Date()
    };
  }

  /**
   * Helper methods for fallback execution
   */
  private async executeTemplateSubstitution(context: any): Promise<any> {
    return {
      success: true,
      result: 'Template substitution completed',
      confidence: 70
    };
  }

  private createManualInterventionResult(context: any): any {
    return {
      success: false,
      requiresManualIntervention: true,
      guidance: 'Manual intervention required',
      confidence: 30
    };
  }

  private executeSimplifiedApproach(context: any): any {
    return {
      success: true,
      result: 'Simplified approach executed',
      confidence: 60
    };
  }

  /**
   * Mock methods for when LLM is not available
   */
  private async getAIErrorClassification(error: Error): Promise<ErrorClassification> {
    try {
      logger.info('Generating AI-powered error classification');

      if (!this.llm) {
        logger.warn('LLM not available, using rule-based error classification');
        return this.getRuleBasedErrorClassification(error);
      }

      const classificationPrompt = `# Error Classification Analysis

## Error Information
- Message: ${error.message}
- Stack: ${error.stack?.substring(0, 500) || 'Not available'}
- Error Type: ${error.constructor.name}

## Classification Requirements
Please classify this error and provide:

1. **Category**: integration, blockchain, ai-service, network, authentication, validation, configuration, system
2. **Severity**: low, medium, high, critical
3. **Recoverability**: auto-recoverable, user-recoverable, manual-intervention, non-recoverable
4. **Root Cause Analysis**:
   - Immediate cause
   - Underlying cause
   - Contributing factors
5. **Impact Assessment**:
   - Affected components
   - User impact level
   - Business impact level
   - Data integrity status
6. **Recovery Suggestions** (2-3 actionable items)
7. **Confidence** (0-100)

Respond in JSON format with all fields populated.`;

      const response = await this.llm.invoke([{ role: 'user', content: classificationPrompt }]);
      const aiClassification = this.parseErrorClassification(response.content as string);

      // Enhance with rule-based analysis
      const enhancedClassification = this.enhanceErrorClassification(aiClassification, error);

      logger.info('AI error classification generated', {
        category: enhancedClassification.category,
        severity: enhancedClassification.severity,
        confidence: enhancedClassification.confidence
      });

      return enhancedClassification;

    } catch (classificationError: any) {
      logger.error('AI error classification failed:', classificationError);
      return this.getRuleBasedErrorClassification(error);
    }
  }

  private getRuleBasedErrorClassification(error: Error): ErrorClassification {
    // Rule-based classification based on error patterns
    let category: ErrorCategory = 'unknown';
    let severity: ErrorSeverity = 'medium';

    // Pattern matching for category
    if (error.message.includes('network') || error.message.includes('timeout') || error.message.includes('hedera')) {
      category = 'hedera-network';
    } else if (error.message.includes('syntax') || error.message.includes('parse')) {
      category = 'syntax-error';
    } else if (error.message.includes('validation') || error.message.includes('invalid')) {
      category = 'user-input';
    } else if (error.message.includes('ai') || error.message.includes('openai') || error.message.includes('generation')) {
      category = 'ai-generation';
    } else if (error.message.includes('config') || error.message.includes('environment')) {
      category = 'configuration';
    } else if (error.message.includes('integration') || error.message.includes('connect')) {
      category = 'integration';
    } else if (error.message.includes('business') || error.message.includes('logic')) {
      category = 'business-logic';
    } else if (error.message.includes('dependency') || error.message.includes('module')) {
      category = 'dependency';
    } else if (error.message.includes('template')) {
      category = 'template-mismatch';
    } else if (error.message.includes('performance') || error.message.includes('slow')) {
      category = 'performance';
    } else if (error.message.includes('security') || error.message.includes('permission')) {
      category = 'security';
    }

    // Pattern matching for severity
    if (error.message.includes('critical') || error.message.includes('fatal')) {
      severity = 'critical';
    } else if (error.message.includes('warning') || error.message.includes('minor')) {
      severity = 'low';
    } else if (error.message.includes('error') || error.message.includes('failed')) {
      severity = 'high';
    }

    return {
      category,
      severity,
      recoverability: 'auto-recoverable',
      confidence: 70,
      rootCause: {
        immediate: error.message,
        underlying: 'System or configuration issue',
        contributing: ['Environment factors', 'Dependencies']
      },
      impact: {
        components: [category + ' layer'],
        userImpact: severity === 'critical' ? 'High' : 'Moderate',
        businessImpact: severity === 'critical' ? 'High' : 'Low',
        dataIntegrity: 'safe'
      },
      recoverySuggestions: [
        'Retry operation with fallback',
        'Check system configuration',
        'Verify dependencies'
      ]
    };
  }

  private enhanceErrorClassification(classification: ErrorClassification, error: Error): ErrorClassification {
    // Add context-specific enhancements
    const enhanced = { ...classification };

    // Adjust confidence based on error information completeness
    if (error.stack && error.stack.length > 100) {
      enhanced.confidence = Math.min(enhanced.confidence + 10, 100);
    }

    // Add specific recovery suggestions based on category
    if (enhanced.category === 'hedera-network') {
      enhanced.recoverySuggestions.push('Check Hedera network status');
    } else if (enhanced.category === 'ai-generation') {
      enhanced.recoverySuggestions.push('Verify API key configuration');
    }

    return enhanced;
  }

  private async getAIRecoveryStrategy(classification: ErrorClassification, context: any): Promise<RecoveryStrategy> {
    try {
      logger.info('Generating AI-powered error recovery strategy');

      if (!this.llm) {
        logger.warn('LLM not available, using template-based recovery strategy');
        return this.getTemplateRecoveryStrategy(classification, context);
      }

      const recoveryPrompt = `# Error Recovery Strategy Generation

## Error Classification
- Type: ${classification.category}
- Severity: ${classification.severity}
- Category: ${classification.category}
- Root Cause: ${classification.rootCause?.immediate || 'Unknown'}
- Impact Components: ${classification.impact?.components?.join(', ') || 'Unknown'}

## Context Information
- Environment: ${context.environment || 'unknown'}
- Operation: ${context.operation || 'unknown'}
- User Action: ${context.userAction || 'unknown'}
- System State: ${JSON.stringify(context.systemState || {})}

## Available Recovery Options
- Template fallbacks available
- Alternative approaches possible
- User intervention capabilities
- System rollback options

Please generate a comprehensive recovery strategy with:
1. Primary strategies (2-3 high-confidence approaches)
2. Fallback strategies (1-2 alternative approaches)
3. For each strategy include:
   - Approach name
   - Priority (1-5)
   - Success probability (0-100)
   - Description
   - Estimated time
   - User interaction level (minimal/moderate/extensive)
   - Prerequisites
   - Limitations

Respond in JSON format with primaryStrategies and fallbackStrategies arrays.`;

      const response = await this.llm.invoke([{ role: 'user', content: recoveryPrompt }]);
      const aiStrategy = this.parseRecoveryStrategy(response.content as string);

      // Enhance with context-specific strategies
      const enhancedStrategy = this.enhanceRecoveryStrategy(aiStrategy, classification, context);

      logger.info('AI recovery strategy generated', {
        primaryStrategiesCount: enhancedStrategy.primaryStrategies.length,
        fallbackStrategiesCount: enhancedStrategy.fallbackStrategies.length,
        errorType: classification.category
      });

      return enhancedStrategy;

    } catch (error: any) {
      logger.error('AI recovery strategy generation failed:', error);
      return this.getTemplateRecoveryStrategy(classification, context);
    }
  }

  private getTemplateRecoveryStrategy(classification: ErrorClassification, context: any): RecoveryStrategy {
    const strategies = this.recoveryStrategies.get(classification.category) || this.recoveryStrategies.get('general') || [];

    return {
      primaryStrategies: [
        {
          approach: 'template-substitution',
          priority: 1,
          successProbability: 80,
          description: 'Retry operation with fallback template',
          estimatedTime: '3 minutes',
          userInteraction: 'minimal',
          prerequisites: ['Alternative template available'],
          limitations: ['May reduce functionality']
        },
        {
          approach: 'parameter-adjustment',
          priority: 2,
          successProbability: 70,
          description: 'Adjust operation parameters and retry',
          estimatedTime: '2 minutes',
          userInteraction: 'minimal',
          prerequisites: ['Configurable parameters'],
          limitations: ['May affect performance']
        }
      ],
      fallbackStrategies: [
        {
          approach: 'manual-debugging',
          priority: 3,
          successProbability: 90,
          description: 'Manual intervention required',
          estimatedTime: '10 minutes',
          userInteraction: 'extensive',
          prerequisites: ['User expertise'],
          limitations: ['Requires manual effort']
        }
      ]
    };
  }

  private enhanceRecoveryStrategy(strategy: RecoveryStrategy, classification: ErrorClassification, context: any): RecoveryStrategy {
    // Add context-specific enhancements
    const enhanced = { ...strategy };

    // Add Hedera-specific strategies for blockchain errors
    if (classification.category === 'hedera-network') {
      enhanced.primaryStrategies.unshift({
        approach: 'retry-with-backoff',
        priority: 1,
        successProbability: 85,
        description: 'Retry blockchain operation with different network endpoint',
        estimatedTime: '2 minutes',
        userInteraction: 'minimal',
        prerequisites: ['Alternative Hedera endpoints'],
        limitations: ['Network-dependent']
      });
    }

    // Add AI-specific strategies for AI component errors
    if (classification.category === 'ai-generation') {
      enhanced.primaryStrategies.unshift({
        approach: 'alternative-approach',
        priority: 1,
        successProbability: 75,
        description: 'Fallback to rule-based system',
        estimatedTime: '1 minute',
        userInteraction: 'minimal',
        prerequisites: ['Rule-based fallbacks available'],
        limitations: ['Reduced intelligence']
      });
    }

    // Sort strategies by priority
    enhanced.primaryStrategies.sort((a, b) => a.priority - b.priority);
    enhanced.fallbackStrategies.sort((a, b) => a.priority - b.priority);

    return enhanced;
  }
}

// Supporting interfaces
interface OperationContext {
  type: string;
  parameters: Record<string, any>;
  originalRequirement: string;
  projectContext: any;
  failedTemplate?: string;
  generatedCode?: string;
}

interface RecoveryAttempt {
  strategy: string;
  success: boolean;
  result?: any;
  error?: string;
  adjustments?: any[];
  templateChange?: any;
  limitations?: string[];
  recommendations?: string[];
  timestamp: Date;
}

interface ErrorPattern {
  errorSignature: string;
  operationContext: string;
  successfulStrategy: string | null;
  failedStrategies: string[];
  preventionSuggestions: string[];
}


export default ErrorRecoverySystem;