export type PackName = 'core' | 'product' | 'stay' | 'flight' | 'bus' | 'service';

export interface TestResult {
  name:     string;
  pack:     PackName;
  passed:   boolean;
  message?: string;
  durationMs: number;
}

export interface PackReport {
  pack:         PackName;
  tests:        TestResult[];
  passedCount:  number;
  failedCount:  number;
  durationMs:   number;
}

export interface Badge {
  agentId:         string;
  protocolVersion: string;
  tierDetected:    string;
  packsPassed:     PackName[];
  testsPassed:     number;
  testsFailed:     number;
  signedAt:        string;
  signature:       string;
}
