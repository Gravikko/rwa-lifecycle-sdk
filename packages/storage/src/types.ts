export interface BlobReference {
  blobHash: string;
  index?: number;
  timestamp: number;
}

export interface RWAMetadata {
  legalDocumentHash: string;
  issuanceDate: number;
  issuer: string;
  jurisdiction?: string;
  kycRequired: boolean;
  [key: string]: any;
}
