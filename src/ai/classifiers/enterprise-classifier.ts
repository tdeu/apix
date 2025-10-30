import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { logger } from '../../utils/logger';
import {
  EnterpriseRequirement,
  EnterpriseContext,
  EnterpriseClassification,
  BusinessIntent,
  IndustryClassification,
  TechnicalComplexity,
  ComplianceClassification,
  ConfidenceScore,
  RecommendedApproach,
  EnterpriseIndustry,
  BusinessIntentCategory,
  RegulatoryFramework
} from '../../types/enterprise';

/**
 * Enterprise AI Classifier
 * 
 * Analyzes enterprise requirements and provides intelligent classification
 * for optimal Hedera service selection and implementation approach.
 */
export class EnterpriseClassifier {
  private primaryLLM: ChatOpenAI | null = null;
  private secondaryLLM: ChatAnthropic | null = null;
  private classificationPrompt: PromptTemplate | null = null;
  private industryKnowledgeBase: Map<EnterpriseIndustry, IndustryKnowledge> = new Map();

  constructor() {
    this.initializeLLMs();
    this.initializePrompts();
    this.initializeIndustryKnowledge();
  }

  /**
   * Classify enterprise requirement with AI analysis
   */
  async classifyRequirement(
    requirement: string,
    context?: Partial<EnterpriseContext>
  ): Promise<EnterpriseClassification> {
    try {
      logger.info('Starting enterprise requirement classification', { 
        requirementLength: requirement.length,
        hasContext: !!context 
      });

      // Step 1: Multi-dimensional analysis
      const analysis = await this.performMultiDimensionalAnalysis(requirement, context);
      
      // Step 2: Industry-specific validation
      const industryValidation = await this.validateIndustryContext(analysis, context);
      
      // Step 3: Confidence scoring
      const confidenceScore = this.calculateConfidenceScore(analysis, industryValidation);
      
      // Step 4: Generate recommendations
      const recommendedApproach = await this.generateRecommendations(
        analysis, 
        industryValidation, 
        confidenceScore
      );

      const classification: EnterpriseClassification = {
        businessIntent: analysis.businessIntent,
        businessContext: analysis.businessIntent, // Alias for backward compatibility
        industrySpecific: industryValidation,
        technicalComplexity: analysis.technicalComplexity,
        complianceRequirements: analysis.complianceRequirements,
        confidence: confidenceScore,
        recommendedApproach,
        recommendedServices: this.generateRecommendedServices(analysis.businessIntent, industryValidation)
      };

      logger.info('Enterprise classification completed', {
        businessIntent: classification.businessIntent.primary,
        industry: classification.industrySpecific.industry,
        confidence: classification.confidence.overall
      });

      return classification;

    } catch (error: any) {
      logger.error('Enterprise classification failed', { error: error?.message });
      return this.createFallbackClassification(requirement);
    }
  }

  /**
   * Perform comprehensive multi-dimensional analysis
   */
  private async performMultiDimensionalAnalysis(
    requirement: string,
    context?: Partial<EnterpriseContext>
  ): Promise<{
    businessIntent: BusinessIntent;
    technicalComplexity: TechnicalComplexity;
    complianceRequirements: ComplianceClassification;
  }> {

    // If no LLMs available, use rule-based classification
    if (!this.primaryLLM && !this.secondaryLLM) {
      logger.info('No LLMs available, using rule-based classification');
      return this.performRuleBasedAnalysis(requirement, context);
    }

    if (!this.classificationPrompt) {
      logger.warn('Classification prompt not available, using simplified analysis');
      return this.performRuleBasedAnalysis(requirement, context);
    }

    const analysisPrompt = await this.classificationPrompt.format({
      requirement,
      context: context ? JSON.stringify(context, null, 2) : 'No additional context provided',
      industryExamples: this.getIndustryExamples(),
      complianceFrameworks: this.getComplianceFrameworks(),
      technicalPatterns: this.getTechnicalPatterns()
    });

    try {
      // Use primary LLM for analysis
      if (this.primaryLLM) {
        const response = await this.primaryLLM.invoke([
          { role: 'system', content: this.getSystemPrompt() },
          { role: 'user', content: analysisPrompt }
        ]);

        const analysis = this.parseAnalysisResponse(response.content as string);
        return analysis;
      }

    } catch (error: any) {
      logger.warn('Primary LLM failed, falling back to secondary', { error: error?.message });

      // Fallback to secondary LLM
      try {
        if (this.secondaryLLM) {
          const response = await this.secondaryLLM.invoke([
            { role: 'system', content: this.getSystemPrompt() },
            { role: 'user', content: analysisPrompt }
          ]);

          return this.parseAnalysisResponse(response.content as string);
        }
      } catch (secondaryError: any) {
        logger.warn('Secondary LLM also failed, using rule-based analysis', { error: secondaryError?.message });
      }
    }

    // Final fallback to rule-based analysis
    return this.performRuleBasedAnalysis(requirement, context);
  }

  /**
   * Validate industry context and enhance classification
   */
  private async validateIndustryContext(
    analysis: any,
    context?: Partial<EnterpriseContext>
  ): Promise<IndustryClassification> {
    
    const industry = context?.industry || analysis.detectedIndustry || 'technology';
    const industryKnowledge = this.industryKnowledgeBase.get(industry);

    if (!industryKnowledge) {
      logger.warn(`No industry knowledge found for: ${industry}`);
      return this.createBasicIndustryClassification(industry);
    }

    // Enhance classification with industry-specific knowledge
    const enhancedClassification: IndustryClassification = {
      industry,
      subCategory: this.determineSubCategory(analysis, industryKnowledge),
      regulatoryContext: this.identifyRegulatoryContext(analysis, industryKnowledge),
      industryStandards: industryKnowledge.standards,
      commonIntegrations: industryKnowledge.commonIntegrations,
      confidence: this.calculateIndustryConfidence(analysis, industryKnowledge)
    };

    return enhancedClassification;
  }

  /**
   * Calculate comprehensive confidence score
   */
  private calculateConfidenceScore(
    analysis: any,
    industryValidation: IndustryClassification
  ): ConfidenceScore {
    
    // Business intent confidence based on keyword matching and pattern recognition
    const businessIntentConfidence = this.calculateBusinessIntentConfidence(analysis);
    
    // Technical feasibility based on Hedera service capabilities
    const technicalFeasibilityConfidence = this.calculateTechnicalFeasibility(analysis);
    
    // Regulatory compliance based on framework matching
    const regulatoryComplianceConfidence = this.calculateRegulatoryCompliance(analysis);
    
    // Template availability based on existing template coverage
    const templateAvailabilityConfidence = this.calculateTemplateAvailability(analysis);
    
    // AI capability assessment for custom requirements
    const aiCapabilityConfidence = this.calculateAICapability(analysis);

    const breakdown = {
      businessIntent: businessIntentConfidence,
      technicalFeasibility: technicalFeasibilityConfidence,
      regulatoryCompliance: regulatoryComplianceConfidence,
      templateAvailability: templateAvailabilityConfidence,
      aiCapability: aiCapabilityConfidence
    };

    // Calculate weighted overall confidence
    const overall = Math.round(
      (breakdown.businessIntent * 0.25) +
      (breakdown.technicalFeasibility * 0.25) +
      (breakdown.regulatoryCompliance * 0.20) +
      (breakdown.templateAvailability * 0.20) +
      (breakdown.aiCapability * 0.10)
    );

    return { overall, breakdown };
  }

  /**
   * Generate strategic recommendations
   */
  private async generateRecommendations(
    analysis: any,
    industryValidation: IndustryClassification,
    confidenceScore: ConfidenceScore
  ): Promise<RecommendedApproach> {
    
    // Determine optimal strategy based on confidence scores
    let strategy: RecommendedApproach['strategy'];
    
    if (confidenceScore.breakdown.templateAvailability > 80) {
      strategy = 'template-based';
    } else if (confidenceScore.breakdown.aiCapability > 70 && confidenceScore.overall > 60) {
      strategy = 'ai-composition';
    } else if (confidenceScore.overall > 50) {
      strategy = 'hybrid';
    } else {
      strategy = 'expert-consultation';
    }

    // Generate specific recommendations
    const templateSuggestions = this.generateTemplateSuggestions(analysis, industryValidation);
    const customDevelopmentNeeds = this.identifyCustomDevelopmentNeeds(analysis);
    const expertConsultationAreas = this.identifyExpertConsultationAreas(analysis, confidenceScore);
    
    // Estimate effort and assess risks
    const estimatedEffort = this.estimateEffort(analysis, strategy);
    const riskAssessment = this.assessRisks(analysis, strategy);

    return {
      strategy,
      templateSuggestions,
      customDevelopmentNeeds,
      expertConsultationAreas,
      estimatedEffort,
      riskAssessment
    };
  }

  /**
   * Initialize LLM instances
   */
  private initializeLLMs(): void {
    try {
      // Initialize primary LLM (OpenAI)
      if (process.env.OPENAI_API_KEY) {
        this.primaryLLM = new ChatOpenAI({
          modelName: process.env.PRIMARY_MODEL || 'gpt-4o-mini',
          temperature: 0.1, // Low temperature for consistent classification
          maxTokens: 2000,
          apiKey: process.env.OPENAI_API_KEY
        });
        logger.internal('info', 'OpenAI ChatGPT initialized for enterprise classification');
      } else {
        logger.info('OpenAI API key not found - will use rule-based classification with Anthropic fallback');
      }

      // Initialize secondary LLM (Anthropic)
      if (process.env.ANTHROPIC_API_KEY) {
        this.secondaryLLM = new ChatAnthropic({
          modelName: process.env.SECONDARY_MODEL || 'claude-3-5-sonnet-20241022',
          temperature: 0.1,
          maxTokens: 2000,
          apiKey: process.env.ANTHROPIC_API_KEY
        });
        logger.info('Anthropic Claude initialized as secondary classifier');
      } else {
        logger.internal('info', 'Anthropic API key not found - will use rule-based classification if OpenAI unavailable');
      }

      // Log AI capabilities status
      const aiCapabilities = [];
      if (this.primaryLLM) aiCapabilities.push('OpenAI GPT');
      if (this.secondaryLLM) aiCapabilities.push('Anthropic Claude');

      if (aiCapabilities.length > 0) {
        logger.internal('info', `Enterprise classifier initialized with AI models: ${aiCapabilities.join(', ')}`);
      } else {
        logger.info('Enterprise classifier initialized with rule-based analysis (no AI models available)');
      }

    } catch (error) {
      logger.error('Failed to initialize LLMs:', error);
      this.primaryLLM = null;
      this.secondaryLLM = null;
    }
  }

  /**
   * Initialize classification prompts
   */
  private initializePrompts(): void {
    try {
      this.classificationPrompt = PromptTemplate.fromTemplate(`
# Enterprise Requirement Classification

## Requirement Description
{requirement}

## Context Information
{context}

## Classification Task
Analyze this enterprise requirement across multiple dimensions and provide structured classification.

### 1. Business Intent Analysis
Identify the primary business intent from these categories:
- supply-chain-compliance
- financial-automation  
- document-verification
- identity-management
- asset-tokenization
- audit-trail
- regulatory-reporting
- oracle-integration
- multi-party-automation
- data-verification

### 2. Industry Classification
Determine the most likely industry context:
{industryExamples}

### 3. Technical Complexity Assessment
Evaluate complexity across these factors (0-100 scale):
- Integration complexity with existing systems
- Regulatory compliance requirements
- Technical novelty and innovation needs
- Scalability and performance requirements
- Security and privacy requirements

### 4. Compliance Requirements
Identify applicable regulatory frameworks:
{complianceFrameworks}

### 5. Hedera Service Mapping
Map to optimal Hedera services:
{technicalPatterns}

## Response Format
Provide analysis in structured JSON format with confidence scores (0-100) for each classification.

## Important Guidelines
- Be honest about uncertainty - use lower confidence scores when unsure
- Consider enterprise context and scale requirements
- Focus on practical implementation feasibility
- Identify gaps that may require expert consultation
- Prioritize regulatory compliance and security considerations

Analyze the requirement and provide detailed classification:
    `);
    } catch (error) {
      logger.error('Failed to initialize prompts:', error);
      this.classificationPrompt = null;
    }
  }

  /**
   * Initialize industry knowledge base
   */
  private initializeIndustryKnowledge(): void {
    this.industryKnowledgeBase = new Map();

    // Pharmaceutical industry knowledge
    this.industryKnowledgeBase.set('pharmaceutical', {
      standards: ['GMP', 'FDA-21CFR11', 'ISO-27001', 'HIPAA'],
      commonIntegrations: ['ERP', 'MES', 'LIMS', 'Regulatory-Systems'],
      regulatoryFrameworks: ['FDA-21CFR11', 'HIPAA', 'GMP'],
      businessPatterns: ['supply-chain-tracking', 'batch-compliance', 'clinical-trials'],
      riskFactors: ['regulatory-violations', 'product-recalls', 'audit-failures'],
      dataRetentionYears: 25
    });

    // Financial services industry knowledge
    this.industryKnowledgeBase.set('financial-services', {
      standards: ['SOX', 'PCI-DSS', 'SOC2', 'NIST'],
      commonIntegrations: ['Core-Banking', 'Risk-Management', 'Compliance-Systems'],
      regulatoryFrameworks: ['SOX', 'PCI-DSS', 'SOC2'],
      businessPatterns: ['payment-automation', 'fraud-detection', 'regulatory-reporting'],
      riskFactors: ['security-breaches', 'regulatory-fines', 'fraud-losses'],
      dataRetentionYears: 7
    });

    // Insurance industry knowledge
    this.industryKnowledgeBase.set('insurance', {
      standards: ['SOX', 'SOC2', 'NIST', 'ISO-27001'],
      commonIntegrations: ['Policy-Management', 'Claims-Processing', 'Oracle-Data'],
      regulatoryFrameworks: ['SOX', 'SOC2'],
      businessPatterns: ['claims-automation', 'risk-assessment', 'oracle-integration'],
      riskFactors: ['claim-fraud', 'regulatory-changes', 'catastrophic-losses'],
      dataRetentionYears: 10
    });

    // Add more industries as needed
  }

  /**
   * Get system prompt for AI classification
   */
  private getSystemPrompt(): string {
    return `You are an expert enterprise blockchain consultant specializing in Hedera Hashgraph integration analysis. Your role is to:

1. Analyze enterprise requirements with deep understanding of business context
2. Classify requirements across multiple dimensions with confidence scoring
3. Recommend optimal implementation strategies based on enterprise needs
4. Identify regulatory compliance requirements and industry standards
5. Assess technical complexity and feasibility for Hedera integration
6. Provide honest assessments of AI capabilities and limitations

Focus on practical, implementable solutions that meet enterprise standards for security, compliance, and scalability.`;
  }

  /**
   * Parse AI analysis response
   */
  private parseAnalysisResponse(response: string): any {
    try {
      // Extract JSON from response (handling various response formats)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback parsing for non-JSON responses
      return this.parseUnstructuredResponse(response);
      
    } catch (error: any) {
      logger.warn('Failed to parse AI response', { error: error?.message });
      return this.createDefaultAnalysis();
    }
  }

  /**
   * Generate template suggestions based on analysis
   */
  private generateTemplateSuggestions(analysis: any, industryValidation: IndustryClassification): string[] {
    const suggestions: string[] = [];
    
    // Industry-specific template mapping
    const industryTemplateMap = {
      'pharmaceutical': ['fda-compliance-audit', 'supply-chain-tracking', 'batch-verification'],
      'financial-services': ['payment-automation', 'regulatory-reporting', 'audit-trail'],
      'insurance': ['oracle-claims-automation', 'parametric-insurance', 'risk-assessment'],
      'manufacturing': ['iso-quality-management', 'supply-chain-compliance', 'asset-tracking'],
      'healthcare': ['hipaa-compliance', 'patient-data-management', 'credential-verification']
    };

    const industryTemplates = industryTemplateMap[industryValidation.industry as keyof typeof industryTemplateMap] || [];
    suggestions.push(...industryTemplates);

    // Business intent specific templates
    if (analysis.businessIntent?.primary) {
      const intentTemplates = this.getTemplatesForBusinessIntent(analysis.businessIntent.primary);
      suggestions.push(...intentTemplates);
    }

    return [...new Set(suggestions)]; // Remove duplicates
  }

  /**
   * Helper methods for classification calculations
   */
  private calculateBusinessIntentConfidence(analysis: any): number {
    let confidence = 50; // Base confidence

    // Check if analysis has clear business intent
    if (analysis.businessIntent?.primary) {
      confidence += 20;

      // Check if keywords align with intent
      if (analysis.businessIntent?.keywords?.length > 0) {
        confidence += 10;
      }

      // Check if patterns are identified
      if (analysis.businessIntent?.patterns?.length > 0) {
        confidence += 10;
      }

      // High confidence intents
      const highConfidenceIntents = [
        'supply-chain-compliance',
        'financial-automation',
        'audit-trail',
        'document-verification'
      ];

      if (highConfidenceIntents.includes(analysis.businessIntent.primary)) {
        confidence += 15;
      }
    }

    // Confidence based on analysis quality
    if (analysis.confidence && typeof analysis.confidence === 'number') {
      confidence = Math.round((confidence + analysis.confidence) / 2);
    }

    return Math.max(0, Math.min(100, confidence));
  }

  private calculateTechnicalFeasibility(analysis: any): number {
    let feasibility = 60; // Base feasibility

    // Check Hedera service mapping
    const hederaServices = ['HTS', 'HCS', 'Smart Contracts', 'File Service', 'Account Service'];
    const mentionedServices = hederaServices.filter(service =>
      JSON.stringify(analysis).toLowerCase().includes(service.toLowerCase())
    );

    // More service coverage = higher feasibility
    feasibility += mentionedServices.length * 8;

    // Technical complexity assessment
    if (analysis.technicalComplexity) {
      const complexityScore = analysis.technicalComplexity.overallScore || 50;

      // Lower complexity = higher feasibility
      if (complexityScore < 30) {
        feasibility += 20;
      } else if (complexityScore < 60) {
        feasibility += 10;
      } else if (complexityScore > 80) {
        feasibility -= 15;
      }
    }

    // Check for integration requirements
    if (analysis.integrationComplexity) {
      if (analysis.integrationComplexity < 50) {
        feasibility += 10;
      } else {
        feasibility -= 5;
      }
    }

    // Novel requirements reduce feasibility
    if (analysis.novelty === 'high' || (analysis.technicalNovelty && analysis.technicalNovelty > 70)) {
      feasibility -= 20;
    }

    return Math.max(0, Math.min(100, feasibility));
  }

  private calculateRegulatoryCompliance(analysis: any): number {
    let compliance = 70; // Base compliance confidence

    // Check if regulatory frameworks are identified
    if (analysis.complianceRequirements?.applicableFrameworks?.length > 0) {
      compliance += 15;

      // Well-known frameworks increase confidence
      const knownFrameworks = ['FDA-21CFR11', 'SOX', 'GDPR', 'HIPAA', 'SOC2', 'PCI-DSS'];
      const identifiedKnown = analysis.complianceRequirements.applicableFrameworks.filter(
        (framework: string) => knownFrameworks.includes(framework)
      );

      compliance += identifiedKnown.length * 5;
    }

    // Industry-specific compliance assessment
    if (analysis.industry) {
      const highComplianceIndustries = ['pharmaceutical', 'financial-services', 'healthcare'];
      if (highComplianceIndustries.includes(analysis.industry)) {
        // These industries have well-defined compliance requirements
        compliance += 10;
      }
    }

    // Check audit requirements
    if (analysis.complianceRequirements?.auditRequirements?.length > 0) {
      compliance += 5;
    }

    // Data protection needs
    if (analysis.complianceRequirements?.dataProtectionNeeds?.length > 0) {
      compliance += 5;
    }

    // Reduce confidence for complex compliance scenarios
    if (analysis.complianceLevel === 'complex' || analysis.complianceLevel === 'novel') {
      compliance -= 15;
    }

    return Math.max(0, Math.min(100, compliance));
  }

  private calculateTemplateAvailability(analysis: any): number {
    let availability = 60; // Base availability

    // Check against known template categories
    const availableTemplates = {
      'supply-chain-compliance': ['pharmaceutical-fda', 'food-safety-haccp', 'manufacturing-iso'],
      'financial-automation': ['insurance-automation', 'royalty-distribution', 'cross-border-payments'],
      'document-verification': ['audit-trail-integration', 'credential-issuance'],
      'identity-management': ['employee-credentials', 'contractor-verification', 'customer-kyc'],
      'asset-tokenization': ['real-estate-fractionalization', 'ip-licensing', 'carbon-credit-trading']
    };

    // Check if business intent matches available templates
    if (analysis.businessIntent?.primary && availableTemplates[analysis.businessIntent.primary as keyof typeof availableTemplates]) {
      availability += 25;

      // Bonus for industry-specific templates
      if (analysis.industry) {
        const industryTemplates = availableTemplates[analysis.businessIntent.primary as keyof typeof availableTemplates].filter(
          (template: string) => template.includes(analysis.industry) ||
                               template.includes(analysis.industry.split('-')[0])
        );
        availability += industryTemplates.length * 5;
      }
    }

    // Check technical complexity - simpler requirements have better template coverage
    if (analysis.technicalComplexity?.overallScore) {
      if (analysis.technicalComplexity.overallScore < 40) {
        availability += 15; // Simple requirements well covered
      } else if (analysis.technicalComplexity.overallScore > 80) {
        availability -= 20; // Complex requirements may need custom development
      }
    }

    // Novel requirements reduce template availability
    if (analysis.novelty === 'high' || analysis.isNovel) {
      availability -= 30;
    }

    return Math.max(0, Math.min(100, availability));
  }

  private calculateAICapability(analysis: any): number {
    let capability = 65; // Base AI capability

    // AI is good at standard enterprise patterns
    const aiStrengthAreas = [
      'audit-trail',
      'document-verification',
      'supply-chain-compliance',
      'financial-automation'
    ];

    if (analysis.businessIntent?.primary && aiStrengthAreas.includes(analysis.businessIntent.primary)) {
      capability += 15;
    }

    // Technical complexity assessment
    if (analysis.technicalComplexity?.overallScore) {
      if (analysis.technicalComplexity.overallScore < 50) {
        capability += 20; // AI handles simple requirements well
      } else if (analysis.technicalComplexity.overallScore > 80) {
        capability -= 25; // AI struggles with highly complex requirements
      }
    }

    // Regulatory complexity affects AI capability
    if (analysis.complianceRequirements?.applicableFrameworks?.length > 2) {
      capability -= 10; // Multiple compliance frameworks are challenging
    }

    // Novel requirements reduce AI capability
    if (analysis.novelty === 'high') {
      capability -= 20;
    } else if (analysis.novelty === 'medium') {
      capability -= 10;
    }

    // Industry-specific knowledge
    const aiKnownIndustries = ['pharmaceutical', 'financial-services', 'insurance', 'manufacturing'];
    if (analysis.industry && aiKnownIndustries.includes(analysis.industry)) {
      capability += 10;
    }

    // Check for clear requirements vs vague requirements
    if (analysis.requirementClarity === 'high') {
      capability += 10;
    } else if (analysis.requirementClarity === 'low') {
      capability -= 15;
    }

    return Math.max(0, Math.min(100, capability));
  }

  /**
   * Generate recommended Hedera services based on business intent and industry
   */
  private generateRecommendedServices(businessIntent: BusinessIntent, industry: IndustryClassification): string[] {
    const services: string[] = [];

    // Base services based on business intent
    switch (businessIntent.primary) {
      case 'asset-tokenization':
        services.push('HTS', 'Smart Contracts');
        break;
      case 'audit-trail':
        services.push('HCS', 'File Service');
        break;
      case 'financial-automation':
        services.push('HTS', 'Smart Contracts', 'Account Service');
        break;
      case 'document-verification':
        services.push('HCS', 'File Service');
        break;
      case 'identity-management':
        services.push('Account Service', 'HCS');
        break;
      default:
        services.push('HCS', 'Account Service');
    }

    // Add industry-specific services
    if (industry.industry === 'pharmaceutical') {
      services.push('File Service'); // For compliance documentation
    } else if (industry.industry === 'financial-services') {
      services.push('HTS'); // For payment tokens
    }

    return [...new Set(services)]; // Remove duplicates
  }

  /**
   * Create fallback classification for error cases
   */
  private createFallbackClassification(requirement: string): EnterpriseClassification {
    return {
      businessIntent: {
        primary: 'data-verification',
        secondary: [],
        confidence: 50,
        keywords: [],
        patterns: []
      },
      businessContext: {
        primary: 'data-verification',
        secondary: [],
        confidence: 50,
        keywords: [],
        patterns: []
      },
      industrySpecific: {
        industry: 'technology',
        subCategory: 'general',
        regulatoryContext: [],
        industryStandards: [],
        commonIntegrations: [],
        confidence: 50
      },
      technicalComplexity: {
        overallScore: 50,
        factors: {
          integrationComplexity: 50,
          regulatoryComplexity: 50,
          technicalNovelty: 50,
          scalabilityRequirements: 50,
          securityRequirements: 50
        },
        riskFactors: ['Unknown requirements complexity'],
        mitigationStrategies: ['Expert consultation recommended']
      },
      complianceRequirements: {
        applicableFrameworks: [],
        complianceLevel: 'basic',
        auditRequirements: [],
        dataProtectionNeeds: [],
        reportingRequirements: []
      },
      confidence: {
        overall: 50,
        breakdown: {
          businessIntent: 50,
          technicalFeasibility: 50,
          regulatoryCompliance: 50,
          templateAvailability: 50,
          aiCapability: 50
        }
      },
      recommendedApproach: {
        strategy: 'expert-consultation',
        templateSuggestions: [],
        customDevelopmentNeeds: ['Full requirement analysis needed'],
        expertConsultationAreas: ['Business requirements', 'Technical architecture'],
        estimatedEffort: {
          development: 0,
          testing: 0,
          compliance: 0,
          integration: 0,
          total: 0,
          confidence: 0
        },
        riskAssessment: {
          technicalRisks: [],
          businessRisks: [],
          complianceRisks: [],
          mitigationStrategies: []
        }
      },
      recommendedServices: ['HCS', 'Account Service'] // Default services
    };
  }

  /**
   * Rule-based analysis fallback when LLMs are not available
   */
  private async performRuleBasedAnalysis(
    requirement: string,
    context?: Partial<EnterpriseContext>
  ): Promise<{
    businessIntent: BusinessIntent;
    technicalComplexity: TechnicalComplexity;
    complianceRequirements: ComplianceClassification;
  }> {
    const reqLower = requirement.toLowerCase();

    // Rule-based business intent detection
    let primaryIntent: BusinessIntentCategory = 'data-verification';
    const keywords: string[] = [];
    const patterns: string[] = [];

    if (reqLower.includes('supply') || reqLower.includes('track') || reqLower.includes('trace')) {
      primaryIntent = 'supply-chain-compliance';
      keywords.push('supply', 'tracking', 'traceability');
      patterns.push('supply-chain-tracking');
    } else if (reqLower.includes('payment') || reqLower.includes('financial') || reqLower.includes('money')) {
      primaryIntent = 'financial-automation';
      keywords.push('payment', 'financial', 'automation');
      patterns.push('payment-automation');
    } else if (reqLower.includes('audit') || reqLower.includes('compliance') || reqLower.includes('regulatory')) {
      primaryIntent = 'audit-trail';
      keywords.push('audit', 'compliance', 'regulatory');
      patterns.push('audit-trail');
    } else if (reqLower.includes('token') || reqLower.includes('asset') || reqLower.includes('nft')) {
      primaryIntent = 'asset-tokenization';
      keywords.push('token', 'asset', 'tokenization');
      patterns.push('asset-tokenization');
    } else if (reqLower.includes('identity') || reqLower.includes('credential') || reqLower.includes('verification')) {
      primaryIntent = 'identity-management';
      keywords.push('identity', 'credential', 'verification');
      patterns.push('identity-management');
    }

    const businessIntent: BusinessIntent = {
      primary: primaryIntent,
      secondary: [],
      confidence: 75,
      keywords,
      patterns
    };

    // Rule-based technical complexity assessment
    let complexityScore = 50;
    if (reqLower.includes('complex') || reqLower.includes('enterprise') || reqLower.includes('integration')) complexityScore += 20;
    if (reqLower.includes('simple') || reqLower.includes('basic')) complexityScore -= 20;
    if (reqLower.includes('compliance') || reqLower.includes('regulatory')) complexityScore += 15;

    const technicalComplexity: TechnicalComplexity = {
      overallScore: Math.max(0, Math.min(100, complexityScore)),
      factors: {
        integrationComplexity: complexityScore,
        regulatoryComplexity: reqLower.includes('compliance') ? complexityScore + 20 : complexityScore - 10,
        technicalNovelty: reqLower.includes('novel') || reqLower.includes('new') ? complexityScore + 30 : complexityScore,
        scalabilityRequirements: reqLower.includes('scale') || reqLower.includes('enterprise') ? complexityScore + 15 : complexityScore,
        securityRequirements: reqLower.includes('security') || reqLower.includes('secure') ? complexityScore + 25 : complexityScore
      },
      riskFactors: [],
      mitigationStrategies: []
    };

    // Rule-based compliance detection
    const applicableFrameworks: RegulatoryFramework[] = [];
    if (reqLower.includes('fda') || reqLower.includes('pharmaceutical')) applicableFrameworks.push('FDA-21CFR11');
    if (reqLower.includes('sox') || reqLower.includes('financial')) applicableFrameworks.push('SOX');
    if (reqLower.includes('gdpr') || reqLower.includes('privacy')) applicableFrameworks.push('GDPR');
    if (reqLower.includes('hipaa') || reqLower.includes('healthcare')) applicableFrameworks.push('HIPAA');

    const complianceRequirements: ComplianceClassification = {
      applicableFrameworks,
      complianceLevel: applicableFrameworks.length > 0 ? 'advanced' : 'basic',
      auditRequirements: applicableFrameworks.length > 0 ? ['audit-trail', 'compliance-reporting'] : [],
      dataProtectionNeeds: reqLower.includes('privacy') || reqLower.includes('protection') ? ['encryption', 'access-control'] : [],
      reportingRequirements: applicableFrameworks.length > 0 ? ['regulatory-reporting'] : []
    };

    return {
      businessIntent,
      technicalComplexity,
      complianceRequirements
    };
  }

  // Additional helper methods with real implementations
  private getIndustryExamples(): string {
    return `
- pharmaceutical: Drug manufacturing, clinical trials, FDA compliance
- financial-services: Banking, payments, trading, regulatory reporting
- insurance: Claims processing, risk assessment, parametric insurance
- manufacturing: Supply chain, quality control, ISO compliance
- healthcare: Patient records, HIPAA compliance, medical devices
    `;
  }

  private getComplianceFrameworks(): string {
    return `
- FDA-21CFR11: Pharmaceutical electronic records and signatures
- SOX: Financial reporting and internal controls
- GDPR: European data protection and privacy
- HIPAA: Healthcare information privacy and security
- SOC2: Service organization security controls
- PCI-DSS: Payment card industry data security
    `;
  }

  private getTechnicalPatterns(): string {
    return `
- HTS (Token Service): Tokenization, payments, asset management
- HCS (Consensus Service): Audit trails, logging, timestamping
- Smart Contracts: Business logic, automation, compliance
- File Service: Document storage, integrity verification
- Account Service: Identity management, access control
    `;
  }

  private createBasicIndustryClassification(industry: EnterpriseIndustry): IndustryClassification {
    return {
      industry,
      subCategory: 'general',
      regulatoryContext: [],
      industryStandards: [],
      commonIntegrations: [],
      confidence: 50
    };
  }

  private determineSubCategory(analysis: any, knowledge: IndustryKnowledge): string {
    return analysis.subCategory || 'general';
  }

  private identifyRegulatoryContext(analysis: any, knowledge: IndustryKnowledge): RegulatoryFramework[] {
    return knowledge.regulatoryFrameworks || [];
  }

  private calculateIndustryConfidence(analysis: any, knowledge: IndustryKnowledge): number {
    return 80;
  }

  private identifyCustomDevelopmentNeeds(analysis: any): string[] {
    const needs = [];
    if (analysis.novelty === 'high') needs.push('Custom business logic development');
    if (analysis.technicalComplexity?.overallScore > 80) needs.push('Complex integration development');
    if (analysis.complianceRequirements?.applicableFrameworks?.length > 2) needs.push('Multi-framework compliance implementation');
    return needs;
  }

  private identifyExpertConsultationAreas(analysis: any, confidence: ConfidenceScore): string[] {
    const areas = [];
    if (confidence.overall < 50) areas.push('Requirements clarification');
    if (confidence.breakdown.regulatoryCompliance < 60) areas.push('Regulatory compliance specialist');
    if (confidence.breakdown.technicalFeasibility < 60) areas.push('Technical architecture review');
    return areas;
  }

  private estimateEffort(analysis: any, strategy: string): any {
    const baseEffort = strategy === 'template-based' ? 40 : strategy === 'ai-composition' ? 80 : 120;

    return {
      development: baseEffort,
      testing: Math.round(baseEffort * 0.3),
      compliance: analysis.complianceRequirements?.applicableFrameworks?.length > 0 ? Math.round(baseEffort * 0.4) : Math.round(baseEffort * 0.1),
      integration: Math.round(baseEffort * 0.2),
      total: Math.round(baseEffort * 1.9),
      confidence: 70
    };
  }

  private assessRisks(analysis: any, strategy: string): any {
    return {
      technicalRisks: strategy === 'expert-consultation' ? ['Complex requirements', 'Technical uncertainty'] : [],
      businessRisks: analysis.technicalComplexity?.overallScore > 80 ? ['Timeline risk', 'Cost overrun risk'] : [],
      complianceRisks: analysis.complianceRequirements?.applicableFrameworks?.length > 1 ? ['Multi-framework compliance complexity'] : [],
      mitigationStrategies: ['Incremental development', 'Regular stakeholder review', 'Compliance validation checkpoints']
    };
  }

  private parseUnstructuredResponse(response: string): any {
    // Basic text parsing for non-JSON responses
    return {
      businessIntent: { primary: 'data-verification', confidence: 60 },
      technicalComplexity: { overallScore: 50 },
      complianceRequirements: { applicableFrameworks: [] }
    };
  }

  private createDefaultAnalysis(): any {
    return {
      businessIntent: { primary: 'data-verification', confidence: 50 },
      technicalComplexity: { overallScore: 50 },
      complianceRequirements: { applicableFrameworks: [] }
    };
  }

  private getTemplatesForBusinessIntent(intent: BusinessIntentCategory): string[] {
    const templateMap: Record<BusinessIntentCategory, string[]> = {
      'supply-chain-compliance': ['supply-chain-tracking', 'traceability-audit'],
      'financial-automation': ['payment-automation', 'financial-reporting'],
      'document-verification': ['document-integrity', 'verification-system'],
      'identity-management': ['identity-verification', 'credential-management'],
      'asset-tokenization': ['token-creation', 'asset-management'],
      'audit-trail': ['audit-logging', 'compliance-tracking'],
      'regulatory-reporting': ['regulatory-compliance', 'automated-reporting'],
      'oracle-integration': ['oracle-data-feeds', 'external-integration'],
      'multi-party-automation': ['multi-party-workflows', 'consensus-automation'],
      'data-verification': ['data-integrity', 'verification-protocols']
    };

    return templateMap[intent] || [];
  }
}

interface IndustryKnowledge {
  standards: string[];
  commonIntegrations: string[];
  regulatoryFrameworks: RegulatoryFramework[];
  businessPatterns: string[];
  riskFactors: string[];
  dataRetentionYears: number;
}

export default EnterpriseClassifier;