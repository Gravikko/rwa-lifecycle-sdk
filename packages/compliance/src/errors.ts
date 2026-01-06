/**
 * Base error class for all compliance-related errors
 */
export class ComplianceError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'ComplianceError';
    Object.setPrototypeOf(this, ComplianceError.prototype);
  }
}

/**
 * Error thrown when a token standard is not supported
 */
export class TokenNotSupportedError extends ComplianceError {
  constructor(
    public readonly tokenAddress: string,
    public readonly detectedStandard?: string
  ) {
    super(
      `Token at ${tokenAddress} is not supported${
        detectedStandard ? ` (detected: ${detectedStandard})` : ''
      }`,
      'TOKEN_NOT_SUPPORTED'
    );
    this.name = 'TokenNotSupportedError';
    Object.setPrototypeOf(this, TokenNotSupportedError.prototype);
  }
}

/**
 * Error thrown when transfer simulation fails
 */
export class SimulationError extends ComplianceError {
  constructor(
    message: string,
    public readonly revertReason?: string
  ) {
    super(message, 'SIMULATION_FAILED');
    this.name = 'SimulationError';
    Object.setPrototypeOf(this, SimulationError.prototype);
  }
}

/**
 * Error thrown when a compliance plugin fails
 */
export class PluginError extends ComplianceError {
  constructor(
    public readonly pluginName: string,
    message: string,
    public readonly originalError?: Error
  ) {
    super(`Plugin '${pluginName}' failed: ${message}`, 'PLUGIN_ERROR');
    this.name = 'PluginError';
    Object.setPrototypeOf(this, PluginError.prototype);
  }
}

/**
 * Error thrown when ERC3643 compliance check fails
 */
export class ERC3643Error extends ComplianceError {
  constructor(
    message: string,
    public readonly tokenAddress: string
  ) {
    super(message, 'ERC3643_ERROR');
    this.name = 'ERC3643Error';
    Object.setPrototypeOf(this, ERC3643Error.prototype);
  }
}

/**
 * Error thrown when standard detection fails
 */
export class DetectionError extends ComplianceError {
  constructor(
    public readonly tokenAddress: string,
    message: string
  ) {
    super(
      `Failed to detect token standard for ${tokenAddress}: ${message}`,
      'DETECTION_ERROR'
    );
    this.name = 'DetectionError';
    Object.setPrototypeOf(this, DetectionError.prototype);
  }
}
