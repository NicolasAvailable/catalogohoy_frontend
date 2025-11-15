import { environment } from '@catalogohoy/env';
import { is } from '../either/either.builder';
import { $fetch, convert } from '../utilities';

export class Metadata {
  public readonly url: string;
  public readonly values = {
    loaded: false,
    width: 0,
    height: 0,
    size: 0,
    duration: 0,
    type: '',
  };

  constructor(url: string) {
    this.url = encodeURIComponent(url);
  }

  public async load(): Promise<Metadata> {
    if (this.values.loaded) return this;
    const { data } = await $fetch.get(`video_metadata?url=${this.url}`, {
      baseUrl: environment.apiUrl,
    });
    if (!data) return this;
    const metadata = data.metadata;
    const { x, y, filesize, duration, mime_type } = metadata;
    Object.assign(this.values, {
      loaded: true,
      width: x,
      height: y,
      size: filesize,
      duration,
      type: mime_type,
    });
    is.affirmative(this.isQuicktime()).mapRight(
      () => (this.values.type = 'video/mp4')
    );
    return this;
  }

  private isQuicktime() {
    return this.values.type?.includes('video/quicktime');
  }

  public get width() {
    return this.values.width;
  }

  public get height() {
    return this.values.height;
  }

  public get size() {
    return convert.byte(this.values.size ?? 0).to.mb();
  }

  public get duration() {
    return this.values.duration ?? 0;
  }

  public get type() {
    return this.values.type;
  }

  public get loaded() {
    return this.values.loaded;
  }
}
