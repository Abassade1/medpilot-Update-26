import { Platform } from "react-native";

/**
 * Store purchases.
 *
 * A purchase is a native transaction: StoreKit on iOS, Play Billing on
 * Android. Neither exists in Expo Go, so this module resolves the native
 * module at runtime and reports honestly when it is absent, rather than
 * inventing a receipt the server would have to trust.
 *
 * The value returned here is only ever *evidence*. The server re-verifies it
 * against the store and decides the entitlement; nothing the client returns is
 * treated as proof of payment.
 */
export class PurchaseUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseUnavailableError";
  }
}
export class PurchaseCancelledError extends Error {
  constructor() {
    super("Purchase cancelled");
    this.name = "PurchaseCancelledError";
  }
}

export interface PurchaseEvidence {
  platform: "apple" | "google";
  /** iOS: the StoreKit 2 signed transaction. Android: the purchase token. */
  receipt: string;
  productId: string;
}

interface IapModule {
  initConnection(): Promise<unknown>;
  endConnection(): Promise<unknown>;
  requestSubscription(opts: Record<string, unknown>): Promise<unknown>;
  getAvailablePurchases(): Promise<unknown[]>;
  finishTransaction(opts: Record<string, unknown>): Promise<unknown>;
}

/**
 * Resolved lazily: the dependency is only present in a native build, so a
 * missing module is an expected state rather than a crash.
 */
function loadIap(): IapModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-iap") as IapModule;
  } catch {
    return null;
  }
}

const unavailable = () =>
  new PurchaseUnavailableError(
    "In-app purchases aren't available in this build. Install the app from TestFlight or Google Play to upgrade.",
  );

const platform = (): "apple" | "google" => (Platform.OS === "android" ? "google" : "apple");

const receiptOf = (purchase: Record<string, unknown>): string | null =>
  (purchase.transactionReceipt as string) ??
  (purchase.purchaseToken as string) ??
  (purchase.jwsRepresentationIos as string) ??
  null;

/** Runs a real store purchase and returns the evidence for server verification. */
export async function purchaseSubscription(productId: string): Promise<PurchaseEvidence> {
  const iap = loadIap();
  if (!iap) throw unavailable();

  await iap.initConnection();
  try {
    const result = (await iap.requestSubscription({ sku: productId })) as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | null;
    const purchase = Array.isArray(result) ? result[0] : result;
    if (!purchase) throw new PurchaseCancelledError();

    const receipt = receiptOf(purchase);
    if (!receipt) throw new PurchaseUnavailableError("The store did not return a receipt.");

    // The transaction is only finished once the server has granted the
    // entitlement, so a crash mid-flow leaves it to be restored, not lost.
    return { platform: platform(), receipt, productId };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "E_USER_CANCELLED") throw new PurchaseCancelledError();
    throw err;
  } finally {
    await iap.endConnection().catch(() => {});
  }
}

/** Re-reads entitlements the account already owns, for "Restore purchases". */
export async function restorePurchases(): Promise<PurchaseEvidence[]> {
  const iap = loadIap();
  if (!iap) throw unavailable();

  await iap.initConnection();
  try {
    const owned = (await iap.getAvailablePurchases()) as Record<string, unknown>[];
    return owned
      .map((p) => {
        const receipt = receiptOf(p);
        return receipt
          ? { platform: platform(), receipt, productId: String(p.productId ?? "") }
          : null;
      })
      .filter((x): x is PurchaseEvidence => x !== null);
  } finally {
    await iap.endConnection().catch(() => {});
  }
}

/** Whether this build can transact at all — used to shape the UI, never entitlement. */
export const purchasesAvailable = (): boolean => loadIap() !== null;

/** Acknowledges the transaction once the server has recorded the entitlement. */
export async function finishPurchase(evidence: PurchaseEvidence): Promise<void> {
  const iap = loadIap();
  if (!iap) return;
  await iap
    .finishTransaction({ purchase: { transactionReceipt: evidence.receipt }, isConsumable: false })
    .catch(() => {});
}
