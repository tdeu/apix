import { AIClient, createAIClient } from '../provider';
import { parseAIJson } from '../json';
import { z } from 'zod';
import { logger } from '../../utils/logger';
import { 
  LimitationAssessment, 
  CapabilityArea, 
  FallbackOption,
  UserIntent 
} from '../../types/conversation';
import { 
  EnterpriseRequirement, 
  EnterpriseClassification,
  TechnicalComplexity 
} from '../../types/enterprise';

/**
 * LimitationHandler - Honest AI Capability Assessment
 * 
 * Provides transparent assessment of AI capabilities and limitations,
 * offers fallback strategies, and guides users toward successful outcomes.
 */
export class LimitationHandler {
  private client: AIClient | null;
  private readonly command?: string;
  private capabilityKnowledgeBase!: Map<string, CapabilityAssessment>;

  constructor(options: { client?: AIClient; command?: string } = {}) {
    this.client = options.client ?? null;
    this.command = options.command;
    this.initializeCapabilityKnowledge();
  }

  /**
   * Assess AI limitations for enterprise requirement
   */
  async assessLimitations(
    requirement: string,
    classification?: EnterpriseClassification
  ): Promise<LimitationAssessment> {
    {
      logger.info('Assessing AI limitations for requirement');

      // Analyze requirement complexity and scope
      const complexityAnalysis = await this.analyzeComplexity(requirement, classification);

      // Assess capability areas
      const capabilityAssessment = await this.assessCapabilityAreas(requirement, complexityAnalysis);

      // Generate fallback strategies
      const fallbackStrategies = await this.generateFallbackStrategies(capabilityAssessment);

      // Create comprehensive assessment
      const assessment: LimitationAssessment = {
        overallConfidence: this.calculateOverallConfidence(capabilityAssessment),
        highConfidenceAreas: capabilityAssessment.filter(area => area.confidence >= 0.8),
        mediumConfidenceAreas: capabilityAssessment.filter(area => area.confidence >= 0.5 && area.confidence < 0.8),
        lowConfidenceAreas: capabilityAssessment.filter(area => area.confidence < 0.5),
        recommendedStrategy: this.determineRecommendedStrategy(capabilityAssessment),
        nextSteps: this.generateNextSteps(capabilityAssessment),
        expertConsultationAreas: this.identifyExpertConsultationAreas(capabilityAssessment),
        fallbackOptions: fallbackStrategies
      };

      return assessment;
    }
  }

  /** Throws AIUnavailableError when no AI key is configured */
  private getClient(): AIClient {
    this.client ??= createAIClient({ tier: 'default', command: this.command });
    return this.client;
  }

  private async ask(prompt: string): Promise<string> {
    return this.getClient().complete({ prompt, maxTokens: 2000, temperature: 0.3 });
  }

  /**
   * Analyze requirement complexity
   */
  private async analyzeComplexity(
    requirement: string,
    classification?: EnterpriseClassification
  ): Promise<ComplexityAnalysis> {
    const complexityPrompt = `Analyze the complexity of this enterprise requirement for AI implementation:

    Requirement: "${requirement}"
    Enterprise Classification: ${JSON.stringify(classification)}

    Assess complexity across these dimensions:

    1. TECHNICAL COMPLEXITY:
    - Algorithm complexity (mathematical models, ML/AI requirements)
    - Integration complexity (number of systems, API complexity)
    - Data complexity (formats, volumes, real-time requirements)
    - Performance requirements (throughput, latency, scalability)

    2. BUSINESS LOGIC COMPLEXITY:
    - Business rule complexity (conditional logic, workflows)
    - Customization requirements (unique processes, proprietary logic)
    - Stakeholder complexity (approval chains, multi-party logic)
    - Regulatory complexity (compliance requirements, audit trails)

    3. DOMAIN KNOWLEDGE COMPLEXITY:
    - Industry-specific knowledge requirements
    - Regulatory framework understanding
    - Technical standard compliance
    - Best practice application

    4. NOVELTY ASSESSMENT:
    - Similarity to existing patterns (template coverage)
    - Innovation requirements (cutting-edge functionality)
    - Research requirements (experimental approaches)
    - Risk tolerance (proven vs experimental solutions)

    Rate each dimension 1-5 (1=simple, 5=extremely complex) and provide reasoning.

    Return JSON format:
    {
      "technicalComplexity": { "score": 3, "reasoning": "..." },
      "businessLogicComplexity": { "score": 4, "reasoning": "..." },
      "domainKnowledgeComplexity": { "score": 2, "reasoning": "..." },
      "noveltyScore": { "score": 3, "reasoning": "..." },
      "overallComplexity": 3.0,
      "primaryChallenges": ["challenge1", "challenge2"],
      "knownPatterns": ["pattern1", "pattern2"],
      "unknownAreas": ["area1", "area2"]
    }`;

    return parseAIJson<ComplexityAnalysis>(this.getClient().provider, await this.ask(complexityPrompt), 'complexity analysis');
  }

  /**
   * Assess specific capability areas
   */
  private async assessCapabilityAreas(
    requirement: string,
    complexityAnalysis: ComplexityAnalysis
  ): Promise<CapabilityArea[]> {
    const capabilityPrompt = `Assess AI capability for implementing this requirement across specific areas:

    Requirement: "${requirement}"
    Complexity Analysis: ${JSON.stringify(complexityAnalysis)}

    Assess confidence for each capability area:

    1. TEMPLATE MATCHING & SELECTION:
    - Ability to identify relevant existing templates
    - Capability to select optimal template combinations
    - Understanding of enterprise requirements mapping

    2. CODE GENERATION & COMPOSITION:
    - Custom business logic generation accuracy
    - Integration code quality and correctness
    - Type safety and compilation success
    - Security and best practice adherence

    3. HEDERA SERVICE INTEGRATION:
    - Appropriate service selection (HTS, HCS, Smart Contracts, File Service)
    - Service interaction pattern accuracy
    - Transaction flow design correctness
    - Performance optimization understanding

    4. ENTERPRISE CONTEXT UNDERSTANDING:
    - Industry-specific requirement comprehension
    - Regulatory compliance implementation
    - Security and audit trail requirements
    - Scalability and performance considerations

    5. VALIDATION & TESTING:
    - Test case generation appropriateness
    - Edge case identification completeness
    - Integration testing strategy soundness
    - Performance testing adequacy

    6. ERROR HANDLING & RECOVERY:
    - Exception handling completeness
    - Graceful degradation implementation
    - User experience during failures
    - Monitoring and alerting integration

    For each area, provide:
    - Confidence score (0.0-1.0)
    - Reasoning for the confidence level
    - Specific limitations or concerns
    - Mitigation strategies

    Return JSON array of capability assessments.`;

    return parseAIJson<CapabilityArea[]>(this.getClient().provider, await this.ask(capabilityPrompt), 'capability assessment');
  }

  /**
   * Generate fallback strategies
   */
  private async generateFallbackStrategies(
    capabilityAssessment: CapabilityArea[]
  ): Promise<FallbackOption[]> {
    const lowConfidenceAreas = capabilityAssessment.filter(area => area.confidence < 0.7);
    
    if (lowConfidenceAreas.length === 0) {
      return [{
        approach: 'template-based',
        description: 'Use proven templates with AI enhancements',
        pros: ['Fast implementation', 'Tested templates', 'Builds as generated'],
        cons: ['Limited customization'],
        estimatedEffort: '1-2 days',
        successProbability: 0.95
      }];
    }

    const fallbackPrompt = `Generate fallback strategies for areas with low AI confidence:

    Low Confidence Areas: ${JSON.stringify(lowConfidenceAreas)}

    For each fallback approach, consider:

    1. TEMPLATE-BASED APPROACH:
    - Use existing proven templates as foundation
    - Manual customization for specific requirements
    - AI assistance for parameter generation

    2. HYBRID DEVELOPMENT:
    - AI generates foundation code
    - Human developers add complex business logic
    - Iterative refinement with AI assistance

    3. EXPERT CONSULTATION:
    - Connect with domain experts
    - Provide AI-generated foundation for review
    - Collaborative development approach

    4. MANUAL DEVELOPMENT:
    - Provide architectural guidance
    - Supply best practices and patterns
    - Code review and validation assistance

    For each approach, provide:
    - Clear description of the approach
    - Pros and cons
    - Estimated effort and timeline
    - Success probability
    - When to choose this approach

    Return array of fallback options in JSON format.`;

    return parseAIJson<FallbackOption[]>(this.getClient().provider, await this.ask(fallbackPrompt), 'list of alternative approaches');
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(capabilityAssessment: CapabilityArea[]): number {
    if (capabilityAssessment.length === 0) return 0.5;

    const weightedScores = capabilityAssessment.map(area => {
      // Weight critical areas more heavily
      const weight = this.getAreaWeight(area.name);
      return area.confidence * weight;
    });

    const totalWeight = capabilityAssessment.reduce((sum, area) => sum + this.getAreaWeight(area.name), 0);
    const weightedAverage = weightedScores.reduce((sum, score) => sum + score, 0) / totalWeight;

    return Math.round(weightedAverage * 100) / 100;
  }

  /**
   * Get weight for capability area
   */
  private getAreaWeight(areaName: string): number {
    const weights: Record<string, number> = {
      'Template Matching & Selection': 2.0,
      'Code Generation & Composition': 3.0,
      'Hedera Service Integration': 3.0,
      'Enterprise Context Understanding': 2.5,
      'Validation & Testing': 2.0,
      'Error Handling & Recovery': 1.5
    };

    return weights[areaName] || 1.0;
  }

  /**
   * Determine recommended strategy
   */
  private determineRecommendedStrategy(capabilityAssessment: CapabilityArea[]): string {
    const overallConfidence = this.calculateOverallConfidence(capabilityAssessment);
    const criticalLowAreas = capabilityAssessment.filter(
      area => area.confidence < 0.5 && this.getAreaWeight(area.name) >= 2.5
    );

    if (overallConfidence >= 0.8) {
      return 'Proceed with AI-powered implementation. High confidence across all areas.';
    } else if (overallConfidence >= 0.6 && criticalLowAreas.length === 0) {
      return 'Hybrid approach recommended. AI foundation with targeted manual development.';
    } else if (overallConfidence >= 0.4) {
      return 'Expert consultation recommended. AI can provide foundation but requires domain expertise.';
    } else {
      return 'Manual development with AI assistance. Complex requirements exceed current AI capabilities.';
    }
  }

  /**
   * Generate next steps
   */
  private generateNextSteps(capabilityAssessment: CapabilityArea[]): string[] {
    const overallConfidence = this.calculateOverallConfidence(capabilityAssessment);
    const lowAreas = capabilityAssessment.filter(area => area.confidence < 0.6);

    const steps: string[] = [];

    if (overallConfidence >= 0.7) {
      steps.push('Proceed with AI code generation for high-confidence areas');
      steps.push('Review and test generated code thoroughly');
    } else {
      steps.push('Start with proven template foundation');
      steps.push('Identify specific areas requiring custom development');
    }

    if (lowAreas.length > 0) {
      steps.push('Consult domain experts for: ' + lowAreas.map(a => a.name).join(', '));
      steps.push('Consider breaking complex requirements into smaller phases');
    }

    steps.push('Plan validation and testing strategy');
    steps.push('Set up monitoring and error handling framework');

    return steps;
  }

  /**
   * Identify areas requiring expert consultation
   */
  private identifyExpertConsultationAreas(capabilityAssessment: CapabilityArea[]): string[] {
    return capabilityAssessment
      .filter(area => area.confidence < 0.5)
      .map(area => area.name);
  }

  /**
   * Explain overall AI capabilities
   */
  async explainCapabilities(): Promise<CapabilityExplanation> {
    return {
      strengths: [
        'Hedera integrations (HTS, HCS, smart contracts, wallet) generated for Next.js (App Router, TypeScript)',
        'Wallet integration on React/Vite (experimental)',
        'AI explanations, comparisons and assessments (needs an Anthropic or OpenAI key)',
        'Input validation and clear errors before anything is sent to Hedera'
      ],
      limitations: [
        'Complex mathematical algorithms requiring domain expertise',
        'Novel regulatory scenarios without established patterns',
        'Highly customized legacy system integrations',
        'Real-time performance optimization for extreme scale',
        'Proprietary business rules requiring deep domain knowledge',
        'Cutting-edge research implementations'
      ],
      confidenceAreas: {
        high: [
          'Standard HTS token operations',
          'Basic wallet integration patterns',
          'Common audit trail implementations',
          'Template-based enterprise patterns'
        ],
        medium: [
          'Custom business logic generation',
          'Multi-service Hedera integrations',
          'Regulatory compliance implementations',
          'Performance optimization strategies'
        ],
        low: [
          'Novel consensus mechanisms',
          'Complex financial derivatives',
          'Experimental cryptographic implementations',
          'Real-time trading algorithms'
        ]
      },
      fallbackStrategies: [
        'Template-based foundation with manual customization',
        'Hybrid AI-human development approach',
        'Expert consultation with AI assistance',
        'Phased implementation with iterative refinement'
      ]
    };
  }

  /**
   * Assess confidence for specific user intent
   */
  async assessIntentConfidence(userIntent: UserIntent): Promise<number> {
    const complexityMultiplier = {
      'simple': 1.0,
      'moderate': 0.8,
      'complex': 0.6,
      'expert': 0.4
    };

    const intentMultiplier = {
      'requirement-gathering': 0.9,
      'solution-exploration': 0.8,
      'implementation-request': 0.7,
      'clarification-seeking': 0.95,
      'validation-request': 0.8,
      'troubleshooting': 0.6,
      'capability-inquiry': 1.0,
      'general-inquiry': 0.85
    };

    const baseConfidence = userIntent.confidence || 0.7;
    const complexityAdjustment = complexityMultiplier[userIntent.technicalComplexity] || 0.7;
    const intentAdjustment = intentMultiplier[userIntent.primaryIntent] || 0.7;

    return Math.min(1.0, baseConfidence * complexityAdjustment * intentAdjustment);
  }

  /**
   * Initialize capability knowledge base
   */
  private initializeCapabilityKnowledge(): void {
    this.capabilityKnowledgeBase = new Map([
      ['hts-operations', {
        confidence: 0.9,
        description: 'Standard HTS token operations',
        limitations: ['Complex tokenomics models', 'Novel token mechanics']
      }],
      ['wallet-integration', {
        confidence: 0.85,
        description: 'Standard wallet connectivity patterns',
        limitations: ['Custom wallet implementations', 'Hardware wallet integration']
      }],
      ['smart-contracts', {
        confidence: 0.7,
        description: 'Basic smart contract patterns',
        limitations: ['Complex financial logic', 'Novel consensus mechanisms']
      }],
      ['compliance-audit', {
        confidence: 0.75,
        description: 'Standard audit trail implementations',
        limitations: ['Novel regulatory requirements', 'Complex multi-jurisdiction compliance']
      }]
    ]);
  }

}

/**
 * Supporting interfaces
 */
interface ComplexityAnalysis {
  technicalComplexity: { score: number; reasoning: string };
  businessLogicComplexity: { score: number; reasoning: string };
  domainKnowledgeComplexity: { score: number; reasoning: string };
  noveltyScore: { score: number; reasoning: string };
  overallComplexity: number;
  primaryChallenges: string[];
  knownPatterns: string[];
  unknownAreas: string[];
}

interface CapabilityAssessment {
  confidence: number;
  description: string;
  limitations: string[];
}

interface CapabilityExplanation {
  strengths: string[];
  limitations: string[];
  confidenceAreas: {
    high: string[];
    medium: string[];
    low: string[];
  };
  fallbackStrategies: string[];
}

export default LimitationHandler;