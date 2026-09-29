import { logger } from '../../utils/logger';
import { AIClient, createAIClient } from '../provider';
import { parseAIJson } from '../json';
import {
  ErrorClassification,
  RecoveryOption,
  RecoveryResult,
  RecoveryStrategy
} from '../../types/error-recovery';
import { EnterpriseContext } from '../../types/enterprise';

/**
 * ErrorRecoverySystem: AI diagnosis of a failure.
 *
 * It classifies an error and suggests recovery strategies. It never retries
 * or changes anything: an OperationContext is a description of what failed,
 * not something that can be run again, so any "recovery" reported here would
 * be invented. Results always say so (success: false, NOT_RETRIED).
 */

export const NOT_RETRIED = 'Diagnosis only: APIX did not retry, change or regenerate anything.';

export interface OperationContext {
  type: string;
  parameters: Record<string, any>;
  originalRequirement: string;
  projectContext: any;
  failedTemplate?: string;
  generatedCode?: string;
}

export interface Diagnosis {
  classification: ErrorClassification;
  /** Suggested by the AI, in priority order; none of them were executed */
  suggestedStrategies: RecoveryOption[];
}

export class ErrorRecoverySystem {
  private client: AIClient | null;
  private readonly command?: string;

  constructor(options: { client?: AIClient; command?: string } = {}) {
    this.client = options.client ?? null;
    this.command = options.command;
  }

  /** Throws AIUnavailableError when no AI key is configured */
  private getClient(): AIClient {
    this.client ??= createAIClient({ tier: 'default', command: this.command });
    return this.client;
  }

  /**
   * Classify the error and suggest strategies. Throws AIUnavailableError /
   * AIRequestError; there is no rule-based stand-in.
   */
  async diagnose(error: Error, operation: OperationContext, context?: EnterpriseContext): Promise<Diagnosis> {
    logger.debug(`Diagnosing failure of operation: ${operation.type}`);
    const classification = await this.classifyError(error, operation);
    const strategy = await this.suggestStrategies(classification, context);
    const suggestedStrategies = [...(strategy.primaryStrategies ?? []), ...(strategy.fallbackStrategies ?? [])]
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    return { classification, suggestedStrategies };
  }

  /**
   * Kept for existing callers: a diagnosis shaped as a RecoveryResult. It is
   * never a success, because nothing is attempted.
   */
  async detectAndRecover(
    operation: OperationContext,
    error: Error,
    context?: EnterpriseContext
  ): Promise<RecoveryResult> {
    const { classification, suggestedStrategies } = await this.diagnose(error, operation, context);
    return {
      success: false,
      strategy: 'diagnosis-only',
      result: classification,
      attempts: [],
      message: NOT_RETRIED,
      recommendations: [
        ...(classification.recoverySuggestions ?? []),
        ...suggestedStrategies.map(option =>
          option.description ? `${option.approach}: ${option.description}` : option.approach
        )
      ]
    };
  }

  private async classifyError(error: Error, operation: OperationContext): Promise<ErrorClassification> {
    const prompt = `Classify this error from a Hedera development tool (APIX).

Error message: ${error.message}
Operation: ${JSON.stringify(operation)}

Return only JSON, in this shape:
{
  "category": "syntax-error | hedera-network | business-logic | integration | performance | security | configuration | user-input | ai-generation | template-mismatch",
  "severity": "critical | high | medium | low",
  "recoverability": "auto-recoverable | semi-recoverable | manual-recovery | non-recoverable",
  "rootCause": { "immediate": "direct cause", "underlying": "deeper issue", "contributing": ["factor"] },
  "impact": { "components": ["component"], "userImpact": "description", "businessImpact": "description", "dataIntegrity": "safe | at-risk | compromised" },
  "confidence": 0.0,
  "recoverySuggestions": ["concrete step the user can take"]
}`;
    const client = this.getClient();
    const answer = await client.complete({ prompt, maxTokens: 2000, temperature: 0.2 });
    return parseAIJson<ErrorClassification>(client.provider, answer, 'error classification');
  }

  private async suggestStrategies(
    classification: ErrorClassification,
    context?: EnterpriseContext
  ): Promise<RecoveryStrategy> {
    const prompt = `Suggest how a developer could recover from this classified error. The tool will not
run these suggestions; the developer will.

Error classification: ${JSON.stringify(classification)}
Context: ${JSON.stringify(context ?? {})}

Allowed approaches: parameter-adjustment, template-substitution, code-correction,
configuration-update, retry-with-backoff, user-confirmation, alternative-approach,
partial-implementation, guided-troubleshooting, fallback-to-base-template,
expert-consultation, research-mode, custom-development, reduced-functionality,
simplified-approach, phased-implementation, alternative-technology.

Return only JSON, in this shape:
{
  "primaryStrategies": [{ "approach": "one of the allowed approaches", "priority": 1, "successProbability": 0.0, "description": "what the developer should do" }],
  "fallbackStrategies": [{ "approach": "...", "priority": 2, "successProbability": 0.0, "description": "..." }]
}`;
    const client = this.getClient();
    const answer = await client.complete({ prompt, maxTokens: 2000, temperature: 0.2 });
    return parseAIJson<RecoveryStrategy>(client.provider, answer, 'list of recovery strategies');
  }
}

export default ErrorRecoverySystem;
