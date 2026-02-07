import type {
  ExternalToast,
  PromiseData,
  PromiseIExtendedResult,
  PromiseT,
  TitleT,
  ToastId,
  ToastSubscriber,
  ToastT,
  ToastToDismiss,
  VanRenderable,
} from "./types";

let toastsCounter = 1;

function isHttpResponse(data: unknown): data is { ok: boolean; status: number } {
  return Boolean(
    data &&
      typeof data === "object" &&
      "ok" in data &&
      typeof (data as { ok: unknown }).ok === "boolean" &&
      "status" in data &&
      typeof (data as { status: unknown }).status === "number",
  );
}

async function resolveValue(value: unknown, arg: unknown): Promise<unknown> {
  if (typeof value === "function") {
    return (value as (arg: unknown) => unknown | Promise<unknown>)(arg);
  }
  return value;
}

function isExtendedResult(value: unknown): value is PromiseIExtendedResult {
  return Boolean(value && typeof value === "object" && "message" in value);
}

export class Observer {
  private subscribers: ToastSubscriber[] = [];
  private toasts: ToastT[] = [];
  private dismissedToasts = new Set<ToastId>();

  subscribe(subscriber: ToastSubscriber): () => void {
    this.subscribers.push(subscriber);
    return () => {
      const index = this.subscribers.indexOf(subscriber);
      if (index !== -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  publish(data: ToastT | ToastToDismiss): void {
    for (const subscriber of this.subscribers) {
      subscriber(data);
    }
  }

  addToast(data: ToastT): void {
    this.publish(data);
    this.toasts = [...this.toasts, data];
  }

  create(
    data: ExternalToast & {
      message?: TitleT;
      type?: ToastT["type"];
      promise?: PromiseT;
      jsx?: VanRenderable;
    },
  ): ToastId {
    const { message, ...rest } = data;
    const id =
      typeof data.id === "number" || (typeof data.id === "string" && data.id.length > 0)
        ? data.id
        : toastsCounter++;

    const alreadyExists = this.toasts.find((toast) => toast.id === id);
    const dismissible = data.dismissible === undefined ? true : data.dismissible;

    if (this.dismissedToasts.has(id)) {
      this.dismissedToasts.delete(id);
    }

    if (alreadyExists) {
      this.toasts = this.toasts.map((toast) => {
        if (toast.id !== id) {
          return toast;
        }

        const nextToast: ToastT = {
          ...toast,
          ...rest,
          id,
          dismissible,
          title: message,
        };

        this.publish(nextToast);
        return nextToast;
      });
    } else {
      this.addToast({
        title: message,
        ...rest,
        dismissible,
        id,
      });
    }

    return id;
  }

  dismiss(id?: ToastId): ToastId | undefined {
    if (id !== undefined) {
      this.dismissedToasts.add(id);
      requestAnimationFrame(() => {
        this.publish({ id, dismiss: true });
      });
      return id;
    }

    for (const toast of this.toasts) {
      this.dismissedToasts.add(toast.id);
      this.publish({ id: toast.id, dismiss: true });
    }

    return undefined;
  }

  promise<ToastData>(promise: PromiseT<ToastData>, data?: PromiseData<ToastData>) {
    if (!data) {
      return;
    }

    let id: ToastId | undefined;

    if (data.loading !== undefined) {
      id = this.create({
        ...data,
        promise,
        type: "loading",
        message: data.loading,
        description: typeof data.description !== "function" ? data.description : undefined,
      });
    }

    const p = Promise.resolve(promise instanceof Function ? promise() : promise);
    let shouldDismiss = id !== undefined;
    let result: ["resolve" | "reject", ToastData | unknown] = ["resolve", undefined as ToastData];

    const originalPromise = p
      .then(async (response) => {
        result = ["resolve", response];

        if (isHttpResponse(response) && !response.ok) {
          shouldDismiss = false;
          const responseError = `HTTP error! status: ${response.status}`;
          const promiseData = await resolveValue(data.error, responseError);
          const description = (await resolveValue(data.description, responseError)) as
            | VanRenderable
            | undefined;
          const toastSettings = isExtendedResult(promiseData)
            ? promiseData
            : { message: promiseData as VanRenderable };

          this.create({ id, type: "error", description, ...toastSettings });
          return;
        }

        if (response instanceof Error) {
          shouldDismiss = false;
          const promiseData = await resolveValue(data.error, response);
          const description = (await resolveValue(data.description, response)) as
            | VanRenderable
            | undefined;
          const toastSettings = isExtendedResult(promiseData)
            ? promiseData
            : { message: promiseData as VanRenderable };

          this.create({ id, type: "error", description, ...toastSettings });
          return;
        }

        if (data.success !== undefined) {
          shouldDismiss = false;
          const promiseData = await resolveValue(data.success, response);
          const description = (await resolveValue(data.description, response)) as
            | VanRenderable
            | undefined;
          const toastSettings = isExtendedResult(promiseData)
            ? promiseData
            : { message: promiseData as VanRenderable };

          this.create({ id, type: "success", description, ...toastSettings });
        }
      })
      .catch(async (error) => {
        result = ["reject", error];

        if (data.error !== undefined) {
          shouldDismiss = false;
          const promiseData = await resolveValue(data.error, error);
          const description = (await resolveValue(data.description, error)) as
            | VanRenderable
            | undefined;
          const toastSettings = isExtendedResult(promiseData)
            ? promiseData
            : { message: promiseData as VanRenderable };

          this.create({ id, type: "error", description, ...toastSettings });
        }
      })
      .finally(async () => {
        if (shouldDismiss) {
          this.dismiss(id);
          id = undefined;
        }

        await data.finally?.();
      });

    const unwrap = () =>
      new Promise<ToastData>((resolve, reject) => {
        originalPromise
          .then(() => {
            if (result[0] === "reject") {
              reject(result[1]);
              return;
            }
            resolve(result[1] as ToastData);
          })
          .catch(reject);
      });

    if (typeof id !== "string" && typeof id !== "number") {
      return { unwrap };
    }

    return Object.assign(id, { unwrap });
  }

  custom(jsx: (id: ToastId) => VanRenderable, data?: ExternalToast): ToastId {
    const id = data?.id ?? toastsCounter++;

    this.create({
      jsx: jsx(id),
      id,
      ...data,
    });

    return id;
  }

  getActiveToasts(): Array<ToastT | ToastToDismiss> {
    return this.toasts.filter((toast) => !this.dismissedToasts.has(toast.id));
  }

  getHistory(): Array<ToastT | ToastToDismiss> {
    return this.toasts;
  }

  getToasts(): Array<ToastT | ToastToDismiss> {
    return this.getActiveToasts();
  }

  resetForTests(): void {
    this.subscribers = [];
    this.toasts = [];
    this.dismissedToasts = new Set();
    toastsCounter = 1;
  }
}

export const ToastState = new Observer();
