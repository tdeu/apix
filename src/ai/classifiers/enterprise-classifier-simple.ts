import { logger } from '../../utils/logger';

/**
 * Simple Enterprise Classifier
 * Uses rule-based classification instead of LangChain
 */
export class EnterpriseClassifier {
  
  constructor() {
    // No complex initialization needed
  }

  /**
   * Classify enterprise requirement using simple rules
   */
  async classifyRequirement(
    requirement: string,
    context?: any
  ): Promise<any> {
    try {
      const lowerReq = requirement.toLowerCase();
      
      // Simple industry detection
      let industry = 'technology';
      if (lowerReq.includes('pharmaceutical') || lowerReq.includes('drug') || lowerReq.includes('fda')) {
        industry = 'pharmaceutical';
      } else if (lowerReq.includes('financial') || lowerReq.includes('payment') || lowerReq.includes('bank')) {
        industry = 'financial-services';
      } else if (lowerReq.includes('healthcare') || lowerReq.includes('patient') || lowerReq.includes('hipaa')) {
        industry = 'healthcare';
      } else if (lowerReq.includes('supply chain') || lowerReq.includes('manufacturing')) {
        industry = 'manufacturing';
      }

      // Simple service recommendation
      const services = [];
      if (lowerReq.includes('token') || lowerReq.includes('asset')) {
        services.push('HTS');
      }
      if (lowerReq.includes('audit') || lowerReq.includes('trail') || lowerReq.includes('compliance')) {
        services.push('HCS');
      }
      if (lowerReq.includes('contract') || lowerReq.includes('automation')) {
        services.push('Smart Contracts');
      }

      // Default if no specific services detected
      if (services.length === 0) {
        services.push('HTS', 'HCS');
      }

      return {
        businessIntent: {
          intent: 'requirement-gathering',
          industry: industry,
          complexity: 'moderate'
        },
        recommendedServices: services,
        confidence: 0.8,
        implementationApproach: 'template-based'
      };

    } catch (error) {
      logger.error('Classification failed:', error);
      return {
        businessIntent: {
          intent: 'general-inquiry',
          industry: 'technology',
          complexity: 'moderate'
        },
        recommendedServices: ['HTS'],
        confidence: 0.5,
        implementationApproach: 'template-based'
      };
    }
  }
}

export default EnterpriseClassifier;