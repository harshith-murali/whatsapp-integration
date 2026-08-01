import { MessageProviderError } from "./message-provider.js";

export type ProviderErrorCategory =
  | "retryable"
  | "permanent"
  | "authentication"
  | "rate_limit"
  | "template"
  | "recipient"
  | "unknown";

export class ClassifiedProviderError extends MessageProviderError {
  public readonly category: ProviderErrorCategory;
  public readonly status?: number;
  public readonly providerCode?: string;
  public readonly providerSubcode?: string;
  public readonly providerType?: string;
  public readonly providerTitle?: string;

  constructor(args: {
    message: string;
    code: string;
    retryable: boolean;
    category: ProviderErrorCategory;
    status?: number;
    providerCode?: string;
    providerSubcode?: string;
    providerType?: string;
    providerTitle?: string;
  }) {
    super(args.message, args.code, args.retryable);
    this.name = "ClassifiedProviderError";
    this.category = args.category;
    this.status = args.status;
    this.providerCode = args.providerCode;
    this.providerSubcode = args.providerSubcode;
    this.providerType = args.providerType;
    this.providerTitle = args.providerTitle;
  }
}
