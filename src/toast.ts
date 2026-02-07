import { ToastState } from "./store";
import type {
  ExternalToast,
  PromiseData,
  PromiseT,
  TitleT,
  ToastId,
  ToastT,
  ToastToDismiss,
  VanRenderable,
} from "./types";

export type ToastPromiseReturn<ToastData> =
  | (string & { unwrap: () => Promise<ToastData> })
  | (number & { unwrap: () => Promise<ToastData> })
  | { unwrap: () => Promise<ToastData> }
  | undefined;

export interface ToastApi {
  (message: TitleT, data?: ExternalToast): ToastId;
  success(message: TitleT, data?: ExternalToast): ToastId;
  info(message: TitleT, data?: ExternalToast): ToastId;
  warning(message: TitleT, data?: ExternalToast): ToastId;
  error(message: TitleT, data?: ExternalToast): ToastId;
  custom(jsx: (id: ToastId) => VanRenderable, data?: ExternalToast): ToastId;
  message(message: TitleT, data?: ExternalToast): ToastId;
  promise<ToastData>(
    promise: PromiseT<ToastData>,
    data?: PromiseData<ToastData>,
  ): ToastPromiseReturn<ToastData>;
  dismiss(id?: ToastId): ToastId | undefined;
  loading(message: TitleT, data?: ExternalToast): ToastId;
  getHistory(): Array<ToastT | ToastToDismiss>;
  getToasts(): Array<ToastT | ToastToDismiss>;
}

const basicToast = (message: TitleT, data?: ExternalToast): ToastId => {
  return ToastState.create({ ...data, message });
};

export const toast = Object.assign(basicToast, {
  success: (message: TitleT, data?: ExternalToast) =>
    ToastState.create({ ...data, message, type: "success" }),
  info: (message: TitleT, data?: ExternalToast) =>
    ToastState.create({ ...data, message, type: "info" }),
  warning: (message: TitleT, data?: ExternalToast) =>
    ToastState.create({ ...data, message, type: "warning" }),
  error: (message: TitleT, data?: ExternalToast) =>
    ToastState.create({ ...data, message, type: "error" }),
  custom: (jsx: (id: ToastId) => VanRenderable, data?: ExternalToast) =>
    ToastState.custom(jsx, data),
  message: (message: TitleT, data?: ExternalToast) => ToastState.create({ ...data, message }),
  promise: <ToastData>(promise: PromiseT<ToastData>, data?: PromiseData<ToastData>) =>
    ToastState.promise(promise, data),
  dismiss: (id?: ToastId) => ToastState.dismiss(id),
  loading: (message: TitleT, data?: ExternalToast) =>
    ToastState.create({ ...data, message, type: "loading" }),
  getHistory: () => ToastState.getHistory(),
  getToasts: () => ToastState.getToasts(),
}) as ToastApi;
