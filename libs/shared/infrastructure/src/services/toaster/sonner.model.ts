import { ExternalToast } from 'ngx-sonner';
import { IdFactory, convert } from '@shared/domain';

export type ToastProps = { icon: string; color: string; blur: string; duration?: number };

const toast = (message: string) => {
  const id = IdFactory.create();
  return (props: ToastProps): ExternalToast => ({
    id,
    componentProps: { id, message, ...props },
    duration: props.duration ?? convert.seg(10).to.ms(),
  });
};

export const success = (message: string) => toast(message)({ icon: 'circle-check', color: '#187B22', blur: '#DDFAE5' });
export const error = (message: string) => toast(message)({ icon: 'circle-x', color: '#C5414E', blur: '#FFEDEC' });
export const warning = (message: string) => toast(message)({ icon: 'circle-alert', color: '#F88413', blur: '#FFEDEC' });
export const info = (message: string) => toast(message)({ icon: 'info', color: '#0061FE', blur: '#E8F1FE' });
export const wait = (message: string) =>
  toast(message)({ icon: 'clock', color: '#0061FE', blur: '#E8F1FE', duration: Number.POSITIVE_INFINITY });
