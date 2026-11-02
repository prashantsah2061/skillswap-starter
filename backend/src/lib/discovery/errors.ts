export class DiscoveryError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export function unavailable(): DiscoveryError {
  return new DiscoveryError(503, "DISCOVERY_UNAVAILABLE", "Discovery is temporarily unavailable.");
}
