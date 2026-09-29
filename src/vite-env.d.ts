/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" shows the PayPal checkout option. Off by default. */
  readonly VITE_PAYPAL_ENABLED?: string;
}
