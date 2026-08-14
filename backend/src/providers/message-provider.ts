export type SendMessageInput = {
  messageId: number;
  broadcastId: number;
  subscriberId: number;
  phoneNumber: string;
  message: string;
  /**
   * Last time this subscriber messaged us. Drives the WhatsApp customer-service
   * window: while it is open the custom message can be sent verbatim as free-form
   * text, otherwise it must be carried by an approved template.
   */
  lastInboundMessageAt?: Date | null;
  metadata?: Record<string, unknown>;
};

export type SendMessageResult = {
  providerMessageId: string;
  providerName: string;
  submittedAt: Date;
};

export class MessageProviderError extends Error {
  public readonly code: string;
  public readonly retryable: boolean;

  constructor(message: string, code: string, retryable: boolean) {
    super(message);
    this.name = "MessageProviderError";
    this.code = code;
    this.retryable = retryable;
    Object.setPrototypeOf(this, MessageProviderError.prototype);
  }
}

export interface MessageProvider {
  send(input: SendMessageInput): Promise<SendMessageResult>;
}
