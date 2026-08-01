export type SendMessageInput = {
  messageId: number;
  broadcastId: number;
  subscriberId: number;
  phoneNumber: string;
  message: string;
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
