import type { DispatchContext, EmailProvider, FrozenEmail, ProviderResult } from "../types";

/** El adaptador solo comunica con el proveedor; la cola decide cuándo es seguro intentarlo. */
export interface EmailTransport {
  provider: EmailProvider;
  send(message: FrozenEmail, key: string, context?: DispatchContext): Promise<ProviderResult>;
}
