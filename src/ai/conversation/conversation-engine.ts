import { AIClient, ChatTurn, createAIClient } from '../provider';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, ConversationResponse, ConversationSession, ConversationContext } from '../../types/conversation';

/**
 * ConversationEngine: chat, explain and compare. Every reply comes from the
 * configured AI provider (src/ai/provider.ts). Without a key it throws
 * AIUnavailableError; a failed request throws AIRequestError. There are no
 * canned or mock replies.
 */
export class ConversationEngine {
  private client: AIClient | null;
  private readonly command?: string;
  private sessions: Map<string, ConversationSession> = new Map();

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
   * Start new conversation session
   */
  async startSession(
    sessionId: string,
    context?: Partial<any>
  ): Promise<ConversationResponse> {
    logger.info(`Starting conversation session: ${sessionId}`);

    const session: ConversationSession = {
      id: sessionId,
      messages: [],
      context: {
        industry: context?.industry || null,
        companySize: context?.companySize || 'unknown',
        technicalStack: context?.technicalStack || [],
        currentProject: context?.currentProject || null,
        urgency: context?.urgency || 'medium'
      },
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.sessions.set(sessionId, session);

    return {
      content: this.generateWelcomeMessage(context),
      intent: 'welcome',
      suggestions: this.generateInitialSuggestions(context),
      confidence: 1.0,
      requiresAction: false,
      sessionId: sessionId,
      context: session.context
    };
  }

  /**
   * Process user message
   */
  async processMessage(
    message: string,
    sessionId: string
  ): Promise<ConversationResponse> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Throws AIUnavailableError / AIRequestError; the session is only
    // updated once a real reply exists
    const aiResponse = await this.generateAIResponse(message, session);

    session.messages.push({ role: 'user', content: message }, { role: 'assistant', content: aiResponse.content });
    session.lastActivity = new Date();

    return aiResponse;
  }

  /**
   * Ask the AI provider, with the recent conversation as context
   */
  private async generateAIResponse(
    message: string,
    session: ConversationSession
  ): Promise<ConversationResponse> {
    const history: ChatTurn[] = session.messages
      .filter((msg): msg is ChatMessage & { role: 'user' | 'assistant' } => msg.role === 'user' || msg.role === 'assistant')
      .slice(-8)
      .map(msg => ({ role: msg.role, content: msg.content }));

    const content = await this.getClient().complete({
      system: this.buildSystemPrompt(session.context),
      prompt: [...history, { role: 'user', content: message }],
      maxTokens: 2048,
      temperature: 0.7
    });

    return {
      content,
      intent: this.analyzeIntent(message),
      suggestions: this.generateSuggestions(message, session.context),
      confidence: 0.8,
      requiresAction: this.shouldRequireAction(message),
      sessionId: session.id,
      context: session.context
    };
  }

  /**
   * Build the system prompt
   */
  private buildSystemPrompt(context: any): string {
    return `You are APIX AI, an expert enterprise Hedera blockchain development assistant.

Your expertise includes:
- Hedera services: HTS (tokens), HCS (consensus), Smart Contracts, File Service
- Enterprise compliance: SOC2, GDPR, HIPAA, FDA regulations
- Industry knowledge: ${context.industry || 'Various industries'}
- Technical frameworks: Next.js, React, TypeScript

Current context:
- Industry: ${context.industry || 'Not specified'}
- Company size: ${context.companySize}
- Project: ${context.currentProject || 'Not specified'}

Provide helpful, practical advice for Hedera blockchain integration with enterprise focus.
Be specific about which Hedera services to use and why.
Include compliance considerations when relevant.
Keep responses concise but comprehensive.`;
  }

  /**
   * Analyze user intent
   */
  private analyzeIntent(message: string): string {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('generate') || lowerMessage.includes('create') || lowerMessage.includes('build')) {
      return 'implementation-request';
    } else if (lowerMessage.includes('explain') || lowerMessage.includes('what') || lowerMessage.includes('how')) {
      return 'clarification-seeking';
    } else if (lowerMessage.includes('compare') || lowerMessage.includes('vs') || lowerMessage.includes('versus')) {
      return 'solution-exploration';
    } else if (lowerMessage.includes('compliance') || lowerMessage.includes('regulation')) {
      return 'requirement-gathering';
    } else {
      return 'general-inquiry';
    }
  }

  /**
   * Generate contextual suggestions
   */
  private generateSuggestions(message: string, context: any): string[] {
    const baseSuggestions = [
      'Generate code for this requirement',
      'Explain the implementation approach',
      'Compare different Hedera services',
      'Show compliance requirements'
    ];

    if (context.industry === 'pharmaceutical') {
      return [
        'Generate FDA-compliant tracking system',
        'Implement drug serialization with HTS',
        'Create audit trail with HCS',
        'Add regulatory reporting'
      ];
    } else if (context.industry === 'financial-services') {
      return [
        'Generate SOX-compliant payment system',
        'Implement tokenized assets with HTS',
        'Create audit trail compliance',
        'Add KYC/AML integration'
      ];
    }

    return baseSuggestions;
  }

  /**
   * Check if message requires action
   */
  private shouldRequireAction(message: string): boolean {
    const actionWords = ['generate', 'create', 'build', 'implement', 'deploy', 'setup'];
    return actionWords.some(word => message.toLowerCase().includes(word));
  }

  /**
   * Generate welcome message
   */
  private generateWelcomeMessage(context?: Partial<any>): string {
    const { logger, LogLevel } = require('../../utils/logger');
    const industryContext = context?.industry ? ` (${context.industry})` : '';
    
    // Minimal welcome message by default
    if (!logger.isLevelEnabled(LogLevel.VERBOSE)) {
      return `Hello! I'm APIX AI, your Hedera development assistant${industryContext}.\n\nHow can I help you with blockchain development today?`;
    }
    
    // Detailed welcome only in verbose mode
    return `Hello! I'm APIX AI, your intelligent Hedera development assistant${industryContext}.

I can help you with:
• Choosing Hedera services - HTS, HCS and smart contracts for your use case
• Integrations - which `apix add` command fits, and what it generates
• Hedera concepts - accounts, keys, fees, tokens and topics
• Troubleshooting - reading Hedera errors and what to try next

What blockchain challenge can I help you solve today?`;
  }

  /**
   * Generate initial suggestions
   */
  private generateInitialSuggestions(context?: Partial<any>): string[] {
    const baseSuggestions = [
      'I need to tokenize assets for my business',
      'Help me build an audit trail system',
      'I want to integrate wallet functionality',
      'Explain Hedera services for my use case'
    ];

    if (context?.industry === 'pharmaceutical') {
      return [
        'Implement FDA-compliant supply chain tracking',
        'Create drug serialization system',
        'Build clinical trial data integrity',
        ...baseSuggestions
      ];
    } else if (context?.industry === 'financial-services') {
      return [
        'Build regulatory-compliant payment system',
        'Implement KYC/AML verification',
        'Create cross-border payment solution',
        ...baseSuggestions
      ];
    }

    return baseSuggestions;
  }

  /**
   * Save session to file
   */
  async saveSession(sessionId: string, filePath?: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const fs = await import('fs-extra');
    const sessionFile = filePath || `./apix-session-${sessionId}.json`;
    await fs.writeJSON(sessionFile, session, { spaces: 2 });
    
    logger.info(`Session saved to: ${sessionFile}`);
  }

  /**
   * Load session from file
   */
  async loadSession(filePath: string): Promise<string> {
    const fs = await import('fs-extra');
    const sessionData = await fs.readJSON(filePath);
    
    this.sessions.set(sessionData.id, sessionData);
    logger.info(`Session loaded from: ${filePath}`);
    
    return sessionData.id;
  }
}

// Supporting interfaces
interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default ConversationEngine;