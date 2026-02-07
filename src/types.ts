export type ToastId = string | number;

export type ToastTypes =
  | "normal"
  | "action"
  | "success"
  | "info"
  | "warning"
  | "error"
  | "loading"
  | "default";

export type Position =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "top-center"
  | "bottom-center";

export type SwipeDirection = "top" | "right" | "bottom" | "left";

export type VanRenderable =
  | string
  | number
  | boolean
  | Node
  | null
  | undefined
  | (() => VanRenderable);

export type StyleObject = Record<string, string | number>;

export type PromiseT<Data = unknown> = Promise<Data> | (() => Promise<Data>);

export interface PromiseIExtendedResult extends ExternalToast {
  message: VanRenderable;
}

export type PromiseTExtendedResult<Data = unknown> =
  | PromiseIExtendedResult
  | ((data: Data) => PromiseIExtendedResult | Promise<PromiseIExtendedResult>);

export type PromiseTResult<Data = unknown> =
  | VanRenderable
  | ((data: Data) => VanRenderable | Promise<VanRenderable>);

export type PromiseExternalToast = Omit<ExternalToast, "description">;

export type PromiseData<ToastData = unknown> = PromiseExternalToast & {
  loading?: VanRenderable;
  success?: PromiseTResult<ToastData> | PromiseTExtendedResult<ToastData>;
  error?: PromiseTResult | PromiseTExtendedResult;
  description?: PromiseTResult;
  finally?: () => void | Promise<void>;
};

export interface ToastClassnames {
  toast?: string;
  title?: string;
  description?: string;
  loader?: string;
  closeButton?: string;
  cancelButton?: string;
  actionButton?: string;
  success?: string;
  error?: string;
  info?: string;
  warning?: string;
  loading?: string;
  default?: string;
  content?: string;
  icon?: string;
}

export interface ToastIcons {
  success?: VanRenderable;
  info?: VanRenderable;
  warning?: VanRenderable;
  error?: VanRenderable;
  loading?: VanRenderable;
  close?: VanRenderable;
}

export interface Action {
  label: VanRenderable;
  onClick: (event: MouseEvent) => void;
  actionButtonStyle?: StyleObject;
}

export interface ToastT {
  id: ToastId;
  toasterId?: string;
  title?: (() => VanRenderable) | VanRenderable;
  type?: ToastTypes;
  icon?: VanRenderable;
  jsx?: VanRenderable;
  richColors?: boolean;
  invert?: boolean;
  closeButton?: boolean;
  dismissible?: boolean;
  description?: (() => VanRenderable) | VanRenderable;
  duration?: number;
  delete?: boolean;
  action?: Action | VanRenderable;
  cancel?: Action | VanRenderable;
  onDismiss?: (toast: ToastT) => void;
  onAutoClose?: (toast: ToastT) => void;
  promise?: PromiseT;
  cancelButtonStyle?: StyleObject;
  actionButtonStyle?: StyleObject;
  style?: StyleObject;
  unstyled?: boolean;
  className?: string;
  classNames?: ToastClassnames;
  descriptionClassName?: string;
  position?: Position;
  testId?: string;
}

export interface ToastOptions {
  className?: string;
  closeButton?: boolean;
  descriptionClassName?: string;
  style?: StyleObject;
  cancelButtonStyle?: StyleObject;
  actionButtonStyle?: StyleObject;
  duration?: number;
  unstyled?: boolean;
  classNames?: ToastClassnames;
  closeButtonAriaLabel?: string;
  toasterId?: string;
}

export type Offset =
  | {
      top?: string | number;
      right?: string | number;
      bottom?: string | number;
      left?: string | number;
    }
  | string
  | number;

export interface ToasterProps {
  id?: string;
  invert?: boolean;
  theme?: "light" | "dark" | "system";
  position?: Position;
  hotkey?: string[];
  richColors?: boolean;
  expand?: boolean;
  duration?: number;
  gap?: number;
  visibleToasts?: number;
  closeButton?: boolean;
  toastOptions?: ToastOptions;
  className?: string;
  style?: StyleObject;
  offset?: Offset;
  mobileOffset?: Offset;
  dir?: "rtl" | "ltr" | "auto";
  swipeDirections?: SwipeDirection[];
  icons?: ToastIcons;
  containerAriaLabel?: string;
}

export interface ToastToDismiss {
  id: ToastId;
  dismiss: true;
}

export type ExternalToast = Omit<ToastT, "id" | "type" | "title" | "jsx" | "delete" | "promise"> & {
  id?: ToastId;
  toasterId?: string;
};

export type TitleT = (() => VanRenderable) | VanRenderable;

export type ToastSubscriber = (toast: ToastT | ToastToDismiss) => void;

export interface HeightT {
  toastId: ToastId;
  height: number;
  position?: Position;
}
