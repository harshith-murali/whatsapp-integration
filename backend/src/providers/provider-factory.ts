import { MessageProvider } from "./message-provider.js";
import { MockWhatsAppProvider } from "./mock-provider.js";
import { MetaWhatsAppProvider } from "./meta-whatsapp.provider.js";

export class MessageProviderFactory {
  private static instance: MessageProvider | null = null;

  public static getProvider(): MessageProvider {
    if (this.instance) {
      return this.instance;
    }

    const providerType = (process.env.MESSAGE_PROVIDER || "mock").toLowerCase();

    switch (providerType) {
      case "mock":
        this.instance = new MockWhatsAppProvider();
        break;
      case "meta":
        this.instance = new MetaWhatsAppProvider();
        break;
      default:
        throw new Error("Unsupported MESSAGE_PROVIDER. Use mock or meta.");
    }

    return this.instance;
  }

  // Support clear reset during testing
  public static reset(): void {
    this.instance = null;
  }
}
