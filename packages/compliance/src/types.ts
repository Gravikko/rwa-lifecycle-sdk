import type { Address } from 'viem';

export interface ComplianceResult {
  approved: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface IComplianceProvider {
  verify(address: Address): Promise<ComplianceResult>;
}
