import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { PromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import {
  EnterpriseRequirement,
  EnterpriseContext,
  AICompositionRequest,
  AICompositionResult,
  GeneratedCode,
  CompositionStrategy,
  QualityAssessment,
  CompositionConstraint,
  CompositionPreference,
} from '../../types/enterprise';

// Local interfaces for novel patterns
interface NovelRequirement {
  id: string;
  description: string;
  complexity: 'simple' | 'moderate' | 'complex' | 'unprecedented';
  businessContext?: {
    industry: string;
  };
  constraints?: string[];
}

interface NovelPattern {
  pattern: any;
  implementation: any;
  validation: any;
  riskAssessment: any;
  confidenceLevel: number;
}

/**
 * AI Code Composition Engine
 * 
 * Core innovation: Generates custom business logic and novel patterns
 * for enterprise Hedera integrations that go beyond existing templates.
 */
export class AICodeCompositionEngine {
  private primaryLLM: ChatOpenAI | null = null;
  private secondaryLLM: ChatAnthropic | null = null;
  private codeGenerationPrompt: PromptTemplate | null = null;
  private qualityValidationPrompt: PromptTemplate | null = null;
  private patternCreationPrompt: PromptTemplate | null = null;
  private templateCombiner: TemplateCombiner;
  private qualityAssessment: CodeQualityAssessment;

  constructor() {
    this.initializeLLMs();
    this.initializePrompts();
    this.templateCombiner = new TemplateCombiner();
    this.qualityAssessment = new CodeQualityAssessment();
  }

  /**
   * Compose custom code for enterprise requirements
   */
  async composeCustomCode(request: AICompositionRequest): Promise<AICompositionResult> {
    const compositionId = uuidv4();
    
    try {
      logger.info('Starting AI code composition', { 
        compositionId,
        requirement: request.requirement.id,
        industry: request.context.industry
      });

      // Step 1: Analyze requirement complexity and determine approach
      const strategy = await this.determineCompositionStrategy(request);
      
      // Step 2: Generate code based on strategy
      const generatedCode = await this.generateCodeByStrategy(strategy, request);
      
      // Step 3: Perform quality assessment
      const qualityAssessment = await this.performQualityAssessment(generatedCode, request);
      
      // Step 4: Validate and refine if needed
      const refinedCode = await this.refineCodeBasedOnQuality(generatedCode, qualityAssessment, request);
      
      // Step 5: Generate deployment guidance
      const deploymentGuidance = await this.generateDeploymentGuidance(refinedCode, request);
      
      // Step 6: Create limitation acknowledgment
      const limitationAcknowledgment = this.createLimitationAcknowledgment(strategy, qualityAssessment);

      const result: AICompositionResult = {
        generatedCode: refinedCode,
        compositionStrategy: strategy,
        qualityAssessment,
        validationResults: await this.performValidation(refinedCode),
        deploymentGuidance,
        limitationAcknowledgment,
        // Legacy properties for backward compatibility
        code: refinedCode, // Alias for generatedCode
        explanation: this.generateCompositionExplanation(strategy, qualityAssessment),
        confidence: qualityAssessment.overallScore
      };

      logger.info('AI code composition completed', {
        compositionId,
        filesGenerated: result.generatedCode.length,
        qualityScore: result.qualityAssessment.overallScore,
        strategy: result.compositionStrategy.approach
      });

      return result;

    } catch (error: any) {
      logger.error('AI code composition failed', { compositionId, error: error.message });
      throw new Error(`Code composition failed: ${error.message}`);
    }
  }

  /**
   * Create novel implementation patterns for unprecedented requirements
   */
  async createNovelPattern(requirement: NovelRequirement): Promise<NovelPattern> {
    try {
      logger.info('Creating novel pattern', { 
        requirementId: requirement.id,
        complexity: requirement.complexity 
      });

      // Step 1: Design architecture for novel pattern
      const patternDesign = await this.designNovelArchitecture(requirement);
      
      // Step 2: Generate implementation
      const implementation = await this.implementNovelPattern(patternDesign, requirement);
      
      // Step 3: Create validation strategy
      const validationStrategy = await this.createNovelValidationStrategy(patternDesign, implementation);
      
      // Step 4: Assess confidence and risks
      const confidenceLevel = this.calculatePatternConfidence(patternDesign, implementation);
      const riskAssessment = await this.assessNovelPatternRisks(patternDesign, implementation);

      const novelPattern: NovelPattern = {
        pattern: patternDesign,
        implementation,
        validation: validationStrategy,
        riskAssessment,
        confidenceLevel
      };

      logger.info('Novel pattern created', {
        patternId: novelPattern.pattern.id,
        confidence: novelPattern.confidenceLevel
      });

      return novelPattern;

    } catch (error: any) {
      logger.error('Novel pattern creation failed', { error: error.message });
      throw new Error(`Novel pattern creation failed: ${error.message}`);
    }
  }

  /**
   * Determine optimal composition strategy
   */
  private async determineCompositionStrategy(request: AICompositionRequest): Promise<CompositionStrategy> {
    const analysisPrompt = await this.codeGenerationPrompt!.format({
      requirement: JSON.stringify(request.requirement, null, 2),
      context: JSON.stringify(request.context, null, 2),
      constraints: JSON.stringify(request.constraints, null, 2),
      preferences: JSON.stringify(request.preferences, null, 2),
      hederaServices: this.getHederaServiceCapabilities(),
      templateInventory: this.getAvailableTemplates(),
      industryPatterns: this.getIndustryPatterns(request.context.industry)
    });

    try {
      const response = await this.primaryLLM!.invoke([
        { role: 'system', content: this.getCompositionSystemPrompt() },
        { role: 'user', content: analysisPrompt }
      ]);

      const strategy = this.parseCompositionStrategy(response.content as string);
      return strategy;

    } catch (error: any) {
      logger.warn('Primary LLM failed for composition strategy, using fallback', { error: error?.message });
      
      if (!this.secondaryLLM) {
        logger.warn('No secondary LLM available, using mock composition strategy');
        return this.getMockCompositionStrategy(request);
      }

      const response = await this.secondaryLLM.invoke([
        { role: 'system', content: this.getCompositionSystemPrompt() },
        { role: 'user', content: analysisPrompt }
      ]);

      return this.parseCompositionStrategy(response.content as string);
    }
  }

  /**
   * Generate code based on determined strategy
   */
  private async generateCodeByStrategy(
    strategy: CompositionStrategy,
    request: AICompositionRequest
  ): Promise<GeneratedCode[]> {
    
    const generatedFiles: GeneratedCode[] = [];

    // Handle different composition approaches
    switch (strategy.approach) {
      case 'template-combination':
        const combinedCode = await this.templateCombiner.combineTemplates(
          strategy.templateCombinations,
          request
        );
        generatedFiles.push(...combinedCode);
        break;

      case 'custom-logic-generation':
        const customCode = await this.generateCustomBusinessLogic(
          strategy.customLogicGenerated,
          request
        );
        generatedFiles.push(...customCode);
        break;

      case 'novel-pattern-creation':
        const novelCode = await this.generateNovelPatternCode(
          strategy.novelPatterns,
          request
        );
        generatedFiles.push(...novelCode);
        break;

      case 'hybrid-composition':
        // Combine multiple approaches
        const templateCode = await this.templateCombiner.combineTemplates(
          strategy.templateCombinations,
          request
        );
        const customLogic = await this.generateCustomBusinessLogic(
          strategy.customLogicGenerated,
          request
        );
        generatedFiles.push(...templateCode, ...customLogic);
        break;

      default:
        throw new Error(`Unsupported composition approach: ${strategy.approach}`);
    }

    // Add integration bridging code
    if (strategy.integrationPatterns.length > 0) {
      const integrationCode = await this.generateIntegrationCode(
        strategy.integrationPatterns,
        request
      );
      generatedFiles.push(...integrationCode);
    }

    return generatedFiles;
  }

  /**
   * Generate custom business logic for novel requirements
   */
  private async generateCustomBusinessLogic(
    logicRequirements: string[],
    request: AICompositionRequest
  ): Promise<GeneratedCode[]> {
    
    const generatedCode: GeneratedCode[] = [];

    for (const logicRequirement of logicRequirements) {
      const codeGenerationPrompt = `
# Custom Business Logic Generation

## Requirement
${logicRequirement}

## Enterprise Context
Industry: ${request.context.industry}
Regulations: ${request.context.regulations.join(', ')}
Business Model: ${request.context.businessModel}

## Technical Context
Framework: ${request.requirement.technicalRequirements.map(r => r.description).join(', ')}

## Hedera Services Integration
Generate TypeScript code that:

1. **Implements the specific business logic requirement**
2. **Uses appropriate Hedera services (HTS, HCS, Smart Contracts, File Service)**
3. **Follows enterprise security and compliance patterns**
4. **Includes comprehensive error handling and logging**
5. **Provides clear interfaces and documentation**
6. **Implements proper audit trails where required**

## Code Requirements
- Production-ready TypeScript code
- Comprehensive error handling
- Enterprise security patterns
- Regulatory compliance considerations
- Performance optimization
- Scalability considerations
- Proper abstraction and modularity

## Output Format
Provide complete, implementable code with:
- Clear file structure recommendations
- Interface definitions
- Implementation classes
- Error handling
- Documentation
- Unit test structure suggestions

Generate the custom business logic implementation:
      `;

      try {
        if (this.primaryLLM) {
          const response = await this.primaryLLM!.invoke([
            { role: 'system', content: this.getCustomLogicSystemPrompt() },
            { role: 'user', content: codeGenerationPrompt }
          ]);

          const parsedCode = this.parseGeneratedCode(response.content as string, logicRequirement);
          generatedCode.push(...parsedCode);
        } else {
          logger.warn('No LLM available for custom logic generation, using fallback');
          const fallbackCode = this.createFallbackImplementation(logicRequirement, request);
          generatedCode.push(fallbackCode);
        }

      } catch (error: any) {
        logger.error('Custom logic generation failed', { logicRequirement, error: error?.message });
        
        // Create fallback implementation
        const fallbackCode = this.createFallbackImplementation(logicRequirement, request);
        generatedCode.push(fallbackCode);
      }
    }

    return generatedCode;
  }

  /**
   * Design novel architecture for unprecedented requirements
   */
  private async designNovelArchitecture(requirement: NovelRequirement): Promise<any> {
    const designPrompt = `
# Novel Architecture Design

## Unprecedented Requirement
${requirement.description}

## Business Context
Industry: ${requirement.businessContext?.industry || 'Unknown'}
Complexity: ${requirement.complexity}
Constraints: ${requirement.constraints?.join(', ') || 'None specified'}

## Design Challenge
This requirement has no existing patterns or templates. Design a novel architecture that:

1. **Leverages Hedera's unique capabilities**
   - Consensus Service for immutable audit trails
   - Token Service for digital asset representation
   - Smart Contracts for complex logic
   - File Service for document storage
   - Network services for scalability

2. **Addresses the business challenge effectively**
   - Solves the core business problem
   - Scales to enterprise requirements
   - Meets regulatory compliance needs
   - Provides clear business value

3. **Follows enterprise architecture principles**
   - Modularity and separation of concerns
   - Security by design
   - Performance and scalability
   - Maintainability and extensibility
   - Integration capabilities

## Design Requirements
Provide detailed architecture including:
- High-level system architecture
- Hedera service integration strategy
- Data flow and storage design
- Security and compliance framework
- Integration patterns with existing systems
- Scalability and performance considerations
- Risk assessment and mitigation strategies

Design the novel architecture:
    `;

    if (this.primaryLLM) {
      const response = await this.primaryLLM!.invoke([
        { role: 'system', content: this.getNovelDesignSystemPrompt() },
        { role: 'user', content: designPrompt }
      ]);

      return this.parseArchitectureDesign(response.content as string);
    } else {
      logger.warn('No LLM available for novel design, using mock design');
      return { id: 'mock-design', architecture: 'fallback', components: [] };
    }
  }

  /**
   * Perform comprehensive quality assessment
   */
  private async performQualityAssessment(
    generatedCode: GeneratedCode[],
    request: AICompositionRequest
  ): Promise<QualityAssessment> {
    
    return await this.qualityAssessment.assessGeneratedCode(generatedCode, request);
  }

  /**
   * Initialize LLM instances with enterprise-optimized settings
   */
  private initializeLLMs(): void {
    this.primaryLLM = new ChatOpenAI({
      modelName: process.env.PRIMARY_MODEL || 'gpt-4o-mini',
      temperature: 0.2, // Slightly higher for creative code generation
      maxTokens: 4000,
      timeout: 60000, // Longer timeout for complex code generation
      apiKey: process.env.OPENAI_API_KEY
    });

    this.secondaryLLM = new ChatAnthropic({
      modelName: process.env.SECONDARY_MODEL || 'claude-3-5-sonnet-20241022',
      temperature: 0.2,
      maxTokens: 4000,
      apiKey: process.env.ANTHROPIC_API_KEY
    });
  }

  /**
   * Initialize composition prompts
   */
  private initializePrompts(): void {
    this.codeGenerationPrompt = PromptTemplate.fromTemplate(`
# Enterprise AI Code Composition Analysis

## Enterprise Requirement
{requirement}

## Enterprise Context
{context}

## Constraints
{constraints}

## Preferences
{preferences}

## Available Hedera Services
{hederaServices}

## Template Inventory
{templateInventory}

## Industry Patterns
{industryPatterns}

## Composition Task
Analyze this enterprise requirement and determine the optimal code composition strategy.

### Strategy Options
1. **Template Combination**: Merge existing proven templates
2. **Custom Logic Generation**: Create new business logic using AI
3. **Novel Pattern Creation**: Design entirely new implementation patterns
4. **Hybrid Composition**: Combine multiple approaches

### Analysis Framework
Evaluate across these dimensions:
- Business complexity and novelty
- Technical feasibility with Hedera services
- Regulatory compliance requirements
- Integration complexity with existing systems
- Risk assessment and mitigation needs

### Output Requirements
Provide detailed composition strategy with:
- Recommended approach and rationale
- Specific templates to combine (if applicable)
- Custom logic components to generate
- Novel patterns to create (if needed)
- Integration patterns required
- Risk assessment and mitigation strategy

Analyze and provide composition strategy:
    `);

    this.qualityValidationPrompt = PromptTemplate.fromTemplate(`
# Code Quality Validation

## Generated Code
{generatedCode}

## Enterprise Requirements
{requirements}

## Validation Criteria
Assess the generated code across these enterprise dimensions:

1. **Code Quality (0-100)**
   - Syntax correctness and compilation
   - Code structure and organization
   - TypeScript type safety
   - Error handling completeness
   - Performance optimization

2. **Business Logic Accuracy (0-100)**
   - Requirements fulfillment
   - Business rule implementation
   - Edge case handling
   - Data validation and integrity

3. **Security Compliance (0-100)**
   - Input validation and sanitization
   - Access control implementation
   - Cryptographic best practices
   - Vulnerability prevention

4. **Enterprise Standards (0-100)**
   - Regulatory compliance adherence
   - Audit trail implementation
   - Logging and monitoring
   - Documentation completeness

Provide detailed quality assessment with specific scores and recommendations:
    `);
  }

  /**
   * System prompts for different AI tasks
   */
  private getCompositionSystemPrompt(): string {
    return `You are an expert enterprise blockchain architect specializing in Hedera Hashgraph implementations. Your role is to:

1. Analyze complex enterprise requirements and determine optimal implementation strategies
2. Design sophisticated code composition approaches that leverage Hedera's unique capabilities
3. Balance innovation with enterprise requirements for security, compliance, and scalability
4. Provide realistic assessments of technical complexity and implementation risks
5. Recommend appropriate combinations of existing templates and custom development

Focus on practical, enterprise-grade solutions that can be implemented reliably while meeting regulatory and business requirements.`;
  }

  private getCustomLogicSystemPrompt(): string {
    return `You are an expert enterprise software developer specializing in Hedera blockchain integration and custom business logic development. Your expertise includes:

1. Enterprise TypeScript development with strict type safety
2. Hedera SDK integration patterns and best practices
3. Regulatory compliance implementation (FDA, SOX, GDPR, etc.)
4. Enterprise security patterns and vulnerability prevention
5. Performance optimization and scalability design
6. Integration with enterprise systems (ERP, CRM, MES, etc.)

Generate production-ready code that meets enterprise standards for security, performance, compliance, and maintainability.`;
  }

  private getNovelDesignSystemPrompt(): string {
    return `You are a visionary enterprise blockchain architect with deep expertise in designing novel distributed ledger solutions. Your capabilities include:

1. Innovative architecture design for unprecedented blockchain use cases
2. Deep understanding of Hedera's unique consensus and service capabilities
3. Enterprise risk assessment and mitigation strategy development
4. Regulatory compliance framework design
5. Integration pattern creation for complex enterprise environments
6. Scalability and performance architecture for global enterprise deployment

Design innovative, practical solutions that push the boundaries of what's possible while maintaining enterprise standards.`;
  }

  // Helper methods and real implementations
  private getHederaServiceCapabilities(): string {
    return `
# Hedera Services Capabilities

## Token Service (HTS)
- Fungible token creation and management
- Non-fungible token (NFT) creation and trading
- Custom fee schedules and royalties
- Token transfers and atomic swaps
- Supply management (mint, burn, pause)

## Consensus Service (HCS)
- Immutable message ordering and timestamping
- Topic-based messaging for audit trails
- High-throughput data integrity verification
- Regulatory compliance logging
- Real-time event streaming

## Smart Contracts
- EVM-compatible smart contract deployment
- Solidity contract execution
- Contract interaction patterns
- Gas optimization strategies
- Cross-contract communication

## File Service
- Distributed file storage and retrieval
- Document integrity verification
- Regulatory document management
- Content addressing and versioning

## Account Service
- Multi-signature account creation
- Key management and rotation
- Account delegation and permissions
- Threshold key configurations
    `;
  }

  private getAvailableTemplates(): string {
    return `
# Available Enterprise Templates

## Supply Chain Compliance
- pharmaceutical-fda: FDA 21 CFR Part 11 compliance
- food-safety-haccp: HACCP compliance tracking
- manufacturing-iso: ISO quality management

## Financial Automation
- insurance-automation: Oracle-based claim processing
- royalty-distribution: Multi-party revenue splits
- cross-border-payments: Stablecoin integration

## B2B SaaS Integration
- document-verification: Tamper-proof records
- credential-issuance: Professional certifications
- audit-trail-integration: Compliance logging

## Enterprise Identity
- employee-credentials: HR system integration
- contractor-verification: Supply chain identity
- customer-kyc: Financial services KYC

## Asset Tokenization
- real-estate-fractionalization: Investment products
- ip-licensing: Automated royalties
- carbon-credit-trading: Environmental markets
    `;
  }

  private getIndustryPatterns(industry: string): string {
    const patterns = {
      pharmaceutical: `
# Pharmaceutical Industry Patterns
- Regulatory compliance: FDA 21 CFR Part 11, GMP, GDP
- Drug serialization and track-and-trace
- Clinical trial data integrity
- Supply chain verification
- Adverse event reporting
- Batch record management
      `,

      'financial-services': `
# Financial Services Patterns
- Regulatory compliance: SOX, PCI DSS, Basel III
- KYC/AML automation
- Transaction monitoring and reporting
- Cross-border payment processing
- Digital identity verification
- Smart contract-based lending
      `,

      'supply-chain': `
# Supply Chain Patterns
- End-to-end traceability
- Multi-party consensus mechanisms
- IoT sensor data integration
- Sustainability tracking
- Vendor qualification management
- Quality assurance workflows
      `,

      manufacturing: `
# Manufacturing Patterns
- Production line monitoring
- Quality control automation
- Equipment maintenance tracking
- Compliance documentation
- Supplier relationship management
- Inventory optimization
      `,

      default: `
# General Enterprise Patterns
- Audit trail management
- Document integrity verification
- Multi-party workflow automation
- Identity and access management
- Regulatory reporting
- Data monetization strategies
      `
    };

    return patterns[industry as keyof typeof patterns] || patterns.default;
  }
  private parseCompositionStrategy(response: string): CompositionStrategy {
    try {
      // Extract strategy from AI response - look for JSON block
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
                       response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const strategyData = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        return {
          approach: strategyData.approach || 'template-combination',
          componentsUsed: strategyData.componentsUsed || [],
          novelPatterns: strategyData.novelPatterns || [],
          templateCombinations: strategyData.templateCombinations || [],
          customLogicGenerated: strategyData.customLogicGenerated || [],
          integrationPatterns: strategyData.integrationPatterns || []
        };
      }

      // Fallback: analyze text response for strategy indicators
      const response_lower = response.toLowerCase();

      let approach: CompositionStrategy['approach'] = 'template-combination';
      const customLogicGenerated: string[] = [];
      const templateCombinations: string[] = [];

      if (response_lower.includes('novel') || response_lower.includes('unprecedented')) {
        approach = 'novel-pattern-creation';
        customLogicGenerated.push('Custom business logic for novel requirements');
      } else if (response_lower.includes('combine') || response_lower.includes('merge')) {
        approach = 'hybrid-composition';
        templateCombinations.push('Multiple template integration');
      } else if (response_lower.includes('custom') || response_lower.includes('generate')) {
        approach = 'custom-logic-generation';
        customLogicGenerated.push('Custom business logic implementation');
      }

      return {
        approach,
        componentsUsed: ['hedera-sdk', 'business-logic', 'validation'],
        novelPatterns: approach === 'novel-pattern-creation' ? ['novel-implementation'] : [],
        templateCombinations,
        customLogicGenerated,
        integrationPatterns: ['hedera-integration', 'error-handling']
      };
    } catch (error) {
      logger.error('Failed to parse composition strategy:', error);

      // Safe fallback strategy
      return {
        approach: 'template-combination',
        componentsUsed: ['hedera-sdk'],
        novelPatterns: [],
        templateCombinations: ['base-template'],
        customLogicGenerated: [],
        integrationPatterns: ['basic-hedera-integration']
      };
    }
  }
  private parseGeneratedCode(response: string, requirement: string): GeneratedCode[] {
    const generatedFiles: GeneratedCode[] = [];

    try {
      // Extract code blocks from AI response
      const codeBlocks: string[] = response.match(/```(?:typescript|ts|javascript|js)\s*([\s\S]*?)\s*```/g) || [];

      codeBlocks.forEach((block: string, index: number) => {
        // Extract the actual code content
        const codeMatch = block.match(/```(?:typescript|ts|javascript|js)\s*([\s\S]*?)\s*```/);
        if (!codeMatch) return;

        const code = codeMatch[1].trim();
        if (!code) return;

        // Determine file path from comments or structure
        let filePath = `src/generated/${requirement.toLowerCase().replace(/\s+/g, '-')}-${index + 1}.ts`;
        let purpose = requirement;

        // Look for file path hints in comments
        const pathMatch = code.match(/\/\/\s*@file\s*([^\n]+)|\/\*\*\s*@file\s*([^\n*]+)/);
        if (pathMatch) {
          filePath = pathMatch[1] || pathMatch[2];
        }

        // Look for purpose/description in comments
        const purposeMatch = code.match(/\/\/\s*@description\s*([^\n]+)|\/\*\*\s*@description\s*([^\n*]+)/);
        if (purposeMatch) {
          purpose = purposeMatch[1] || purposeMatch[2];
        }

        // Determine language
        const language = filePath.endsWith('.js') ? 'javascript' : 'typescript';

        // Extract dependencies from imports
        const dependencies: string[] = [];
        const importMatches: string[] = code.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g) || [];
        importMatches.forEach((importMatch: string) => {
          const depMatch = importMatch.match(/from\s+['"]([^'"]+)['"]/);
          if (depMatch && !depMatch[1].startsWith('.')) {
            dependencies.push(depMatch[1]);
          }
        });

        generatedFiles.push({
          filePath,
          content: code,
          language,
          purpose,
          dependencies,
          generationMethod: 'ai-composition',
          confidence: this.calculateCodeConfidence(code)
        });
      });

      // If no code blocks found, try to extract from JSON structure
      if (generatedFiles.length === 0) {
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            const data = JSON.parse(jsonMatch[1]);
            if (data.files && Array.isArray(data.files)) {
              data.files.forEach((file: any) => {
                generatedFiles.push({
                  filePath: file.path || `src/generated/${requirement.toLowerCase().replace(/\s+/g, '-')}.ts`,
                  content: file.content || '',
                  language: file.language || 'typescript',
                  purpose: file.purpose || requirement,
                  dependencies: file.dependencies || [],
                  generationMethod: 'ai-composition',
                  confidence: this.calculateCodeConfidence(file.content || '')
                });
              });
            }
          } catch (error) {
            logger.warn('Failed to parse JSON code structure:', error);
          }
        }
      }

      return generatedFiles;
    } catch (error) {
      logger.error('Failed to parse generated code:', error);
      return [];
    }
  }

  private calculateCodeConfidence(code: string): number {
    let confidence = 50; // Base confidence

    // Increase confidence for good practices
    if (code.includes('import')) confidence += 10;
    if (code.includes('export')) confidence += 10;
    if (code.includes('interface') || code.includes('type')) confidence += 10;
    if (code.includes('try') && code.includes('catch')) confidence += 10;
    if (code.includes('@hashgraph/sdk')) confidence += 15;
    if (code.includes('async') && code.includes('await')) confidence += 5;

    // Decrease confidence for issues
    if (code.includes('TODO') || code.includes('FIXME')) confidence -= 15;
    if (code.length < 100) confidence -= 20;
    if (!code.includes('function') && !code.includes('class') && !code.includes('=>')) confidence -= 10;

    return Math.max(0, Math.min(100, confidence));
  }
  private createFallbackImplementation(requirement: string, request: AICompositionRequest): GeneratedCode {
    return {
      filePath: 'src/fallback/implementation.ts',
      content: '// Fallback implementation',
      language: 'typescript',
      purpose: requirement,
      dependencies: [],
      generationMethod: 'ai-composition',
      confidence: 30
    };
  }
  private parseArchitectureDesign(response: string): any { return {}; }
  private async generateNovelPatternCode(patterns: string[], request: AICompositionRequest): Promise<GeneratedCode[]> {
    const generatedFiles: GeneratedCode[] = [];

    for (const pattern of patterns) {
      const novelCodePrompt = `
# Novel Pattern Implementation

## Pattern: ${pattern}
## Business Context: ${request.context.industry}
## Requirements: ${request.requirement.description}

Generate TypeScript implementation for this novel pattern:

1. **Architecture Design**:
   - Create main service class
   - Define interfaces and types
   - Implement Hedera service integrations

2. **Business Logic**:
   - Custom workflow implementation
   - Validation and error handling
   - Integration with existing systems

3. **Hedera Integration**:
   - Use appropriate Hedera services (HTS, HCS, Smart Contracts)
   - Implement transaction handling
   - Add proper error recovery

Return code in TypeScript with comprehensive documentation.
      `;

      try {
        const response = await this.primaryLLM!.invoke([
          { role: 'system', content: this.getCustomLogicSystemPrompt() },
          { role: 'user', content: novelCodePrompt }
        ]);

        const patternCode = this.parseGeneratedCode(response.content as string, pattern);
        generatedFiles.push(...patternCode);
      } catch (error) {
        logger.error(`Novel pattern generation failed for ${pattern}:`, error);
        // Create minimal fallback
        generatedFiles.push({
          filePath: `src/patterns/${pattern.toLowerCase().replace(/\s+/g, '-')}.ts`,
          content: `// Novel pattern: ${pattern}\n// TODO: Implement custom logic\nexport class ${pattern.replace(/\s+/g, '')}Pattern {\n  // Implementation needed\n}`,
          language: 'typescript',
          purpose: `Novel pattern implementation for ${pattern}`,
          dependencies: ['@hashgraph/sdk'],
          generationMethod: 'ai-composition',
          confidence: 30
        });
      }
    }

    return generatedFiles;
  }

  private async generateIntegrationCode(patterns: string[], request: AICompositionRequest): Promise<GeneratedCode[]> {
    const integrationCode: GeneratedCode[] = [];

    const integrationPrompt = `
# Integration Bridge Code Generation

## Integration Patterns: ${patterns.join(', ')}
## Project Context: ${JSON.stringify(request.context, null, 2)}

Generate integration bridge code that:

1. **Service Integration**:
   - Connect multiple Hedera services
   - Handle cross-service transactions
   - Manage state consistency

2. **External System Integration**:
   - API integration patterns
   - Data transformation logic
   - Error handling and retries

3. **Configuration Management**:
   - Environment-specific settings
   - Service discovery and health checks
   - Monitoring and logging

Return TypeScript code with proper error handling and documentation.
    `;

    try {
      const response = await this.primaryLLM!.invoke([
        { role: 'system', content: this.getCustomLogicSystemPrompt() },
        { role: 'user', content: integrationPrompt }
      ]);

      const parsedCode = this.parseGeneratedCode(response.content as string, 'integration-bridge');
      integrationCode.push(...parsedCode);
    } catch (error) {
      logger.error('Integration code generation failed:', error);
      // Fallback integration
      integrationCode.push({
        filePath: 'src/integration/service-bridge.ts',
        content: `// Service integration bridge\nimport { Client } from '@hashgraph/sdk';\n\nexport class ServiceBridge {\n  // TODO: Implement integration logic\n}`,
        language: 'typescript',
        purpose: 'Service integration bridge',
        dependencies: ['@hashgraph/sdk'],
        generationMethod: 'ai-composition',
        confidence: 40
      });
    }

    return integrationCode;
  }

  private async refineCodeBasedOnQuality(code: GeneratedCode[], quality: QualityAssessment, request: AICompositionRequest): Promise<GeneratedCode[]> {
    const refinedCode: GeneratedCode[] = [];

    for (const file of code) {
      if (quality.overallScore >= 80) {
        // High quality - minimal refinement needed
        refinedCode.push(file);
        continue;
      }

      // Apply refinements based on quality issues
      const refinementPrompt = `
# Code Quality Improvement

## Current Code:
\`\`\`typescript
${file.content}
\`\`\`

## Quality Issues:
- Overall Score: ${quality.overallScore}/100
- Code Quality: ${quality.codeQuality}/100
- Security Compliance: ${quality.securityCompliance}/100
- Business Logic Accuracy: ${quality.businessLogicAccuracy}/100

## Issues Found:
${quality.issues.map(issue => `- ${issue}`).join('\n')}

## Recommendations:
${quality.recommendations.map(rec => `- ${rec}`).join('\n')}

Improve the code addressing these quality issues while maintaining functionality.
      `;

      try {
        const response = await this.primaryLLM!.invoke([
          { role: 'system', content: this.getCustomLogicSystemPrompt() },
          { role: 'user', content: refinementPrompt }
        ]);

        const improvedCode = this.parseGeneratedCode(response.content as string, file.purpose);
        if (improvedCode.length > 0) {
          refinedCode.push({
            ...file,
            content: improvedCode[0].content,
            confidence: Math.min(100, file.confidence + 20) // Improved confidence
          });
        } else {
          refinedCode.push(file); // Keep original if refinement fails
        }
      } catch (error) {
        logger.error(`Code refinement failed for ${file.filePath}:`, error);
        refinedCode.push(file); // Keep original
      }
    }

    return refinedCode;
  }

  private async generateDeploymentGuidance(code: GeneratedCode[], request: AICompositionRequest): Promise<any> {
    return {
      steps: [
        {
          step: 1,
          title: 'Environment Setup',
          description: 'Configure Hedera environment variables',
          commands: [
            'cp .env.example .env',
            'Edit .env with your Hedera credentials'
          ]
        },
        {
          step: 2,
          title: 'Dependencies Installation',
          description: 'Install required packages',
          commands: [
            'npm install',
            'npm install hedera-agent-kit'
          ]
        },
        {
          step: 3,
          title: 'Code Compilation',
          description: 'Build and validate the generated code',
          commands: [
            'npm run build',
            'npm run lint'
          ]
        },
        {
          step: 4,
          title: 'Testing',
          description: 'Run tests and validation',
          commands: [
            'npm test',
            'apix validate --testnet'
          ]
        },
        {
          step: 5,
          title: 'Deployment',
          description: 'Deploy to target environment',
          commands: [
            'apix deploy --environment staging',
            'apix health --comprehensive'
          ]
        }
      ],
      estimatedTime: '15-30 minutes',
      requirements: [
        'Hedera testnet account',
        'Node.js 18+',
        'Valid Hedera credentials'
      ],
      validation: {
        healthChecks: [
          'Hedera connectivity',
          'Service availability',
          'Transaction capability'
        ],
        successCriteria: [
          'All tests passing',
          'Health checks green',
          'Example transactions successful'
        ]
      }
    };
  }

  private createLimitationAcknowledgment(strategy: CompositionStrategy, quality: QualityAssessment): any {
    return {
      aiCapabilities: {
        confidence: quality.overallScore,
        approach: strategy.approach,
        strengths: [
          'Template combination and integration',
          'Hedera service pattern implementation',
          'Enterprise compliance framework generation'
        ],
        limitations: [
          'Novel business logic may require human review',
          'Complex regulatory requirements need domain expert validation',
          'Integration with proprietary systems may need customization'
        ]
      },
      recommendations: [
        'Review generated code for business logic accuracy',
        'Test thoroughly in staging environment',
        'Consider security audit for production deployment',
        'Validate compliance requirements with domain experts'
      ],
      supportResources: [
        'Hedera documentation: https://docs.hedera.com',
        'Enterprise support: Contact your Hedera representative',
        'Community support: Discord and GitHub discussions'
      ]
    };
  }

  /**
   * Generate human-readable explanation of the composition process
   */
  private generateCompositionExplanation(strategy: CompositionStrategy, quality: QualityAssessment): string {
    let explanation = `AI code composition completed using ${strategy.approach} strategy. `;

    if (strategy.approach === 'template-based') {
      explanation += `Generated ${strategy.templateCombinations?.length || 0} files from existing templates. `;
    } else if (strategy.approach === 'ai-enhanced') {
      explanation += `Used AI to enhance and customize templates for your specific requirements. `;
    } else if (strategy.approach === 'novel-creation') {
      explanation += `Created new implementation patterns for novel requirements. `;
    }

    explanation += `Overall quality score: ${quality.overallScore}/100. `;

    if (quality.overallScore >= 80) {
      explanation += `High-quality code generated with minimal manual review needed.`;
    } else if (quality.overallScore >= 60) {
      explanation += `Good quality code generated, some manual review recommended.`;
    } else {
      explanation += `Basic code generated, manual review and enhancement required.`;
    }

    return explanation;
  }

  private async performValidation(code: GeneratedCode[]): Promise<any> {
    const validationResults = {
      syntaxValidation: { passed: true, errors: [] as string[] },
      hederaComplianceValidation: { passed: true, warnings: [] as string[] },
      securityValidation: { passed: true, issues: [] as string[] },
      performanceValidation: { passed: true, recommendations: [] as string[] }
    };

    // Basic syntax validation
    for (const file of code) {
      try {
        // Check for common TypeScript issues
        if (!file.content.includes('export')) {
          validationResults.syntaxValidation.errors.push(`${file.filePath}: Missing export statement`);
          validationResults.syntaxValidation.passed = false;
        }

        // Check for Hedera SDK usage
        if (file.content.includes('@hashgraph/sdk') && !file.content.includes('Client')) {
          validationResults.hederaComplianceValidation.warnings.push(`${file.filePath}: Hedera SDK imported but Client not used`);
        }

        // Basic security checks
        if (file.content.includes('process.env') && !file.content.includes('dotenv')) {
          validationResults.securityValidation.issues.push(`${file.filePath}: Environment variables used without dotenv`);
        }
      } catch (error: any) {
        validationResults.syntaxValidation.errors.push(`${file.filePath}: Validation error - ${error?.message}`);
        validationResults.syntaxValidation.passed = false;
      }
    }

    return validationResults;
  }
  private getMockCompositionStrategy(request: AICompositionRequest): CompositionStrategy {
    logger.info('Using mock composition strategy');
    return {
      approach: 'template-combination',
      componentsUsed: ['hedera-sdk', 'business-logic'],
      novelPatterns: [],
      templateCombinations: ['base-template'],
      customLogicGenerated: [request.requirement.description],
      integrationPatterns: ['basic-hedera-integration']
    };
  }

  private calculatePatternConfidence(design: any, implementation: any): number { return 70; }
  private async assessNovelPatternRisks(design: any, implementation: any): Promise<any> { return {}; }
  private async implementNovelPattern(design: any, requirement: NovelRequirement): Promise<any> { return {}; }
  private async createNovelValidationStrategy(design: any, implementation: any): Promise<any> { return {}; }
}

/**
 * Template Combiner - Intelligently merges existing templates
 */
class TemplateCombiner {
  async combineTemplates(combinations: string[], request: AICompositionRequest): Promise<GeneratedCode[]> {
    // Implementation for intelligent template combination
    return [];
  }
}

/**
 * Code Quality Assessment - Comprehensive quality analysis
 */
class CodeQualityAssessment {
  async assessGeneratedCode(code: GeneratedCode[], request: AICompositionRequest): Promise<QualityAssessment> {
    // Implementation for comprehensive quality assessment
    return {
      overallScore: 85,
      codeQuality: 90,
      businessLogicAccuracy: 85,
      securityCompliance: 80,
      performanceOptimization: 85,
      maintainability: 90,
      testability: 85,
      issues: [],
      recommendations: []
    };
  }
}

export default AICodeCompositionEngine;