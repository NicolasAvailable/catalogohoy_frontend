import { Entity } from '../entity/entity';
import { $url, aws, html } from '../utilities';

export class Multimedia extends Entity {
  public readonly url: string;
  public readonly cover: Multimedia | undefined;
  public readonly status: 'error' | 'ok' | 'loading' = 'ok';

  constructor(url: string) {
    super();
    this.url = url;
  }

  public get type(): string {
    return this.url.split('.').pop()?.split(/[#?]/)[0] || '';
  }

  public get file() {
    return $url.to.file(this.url);
  }

  public isError() {
    return this.status === 'error';
  }

  public isLoading() {
    return this.status === 'loading';
  }

  public isOk() {
    return this.status === 'ok';
  }

  public isBase64() {
    return this.url.includes('base64');
  }

  public isTemporal() {
    return aws.is.temporal(this.url);
  }

  public isBucket() {
    return aws.is.bucket(this.url);
  }

  public isProduction() {
    return aws.is.prod(this.url);
  }

  public isEqual(type: string) {
    return this.type.toLowerCase() === type.toLowerCase();
  }

  public isSVG() {
    return (
      this.isEqual('svg') ||
      this.isEqual('svg+xml') ||
      this.url.includes('svg+xml') ||
      this.url.includes('.svg')
    );
  }

  public isPNG() {
    return this.isEqual('png') || this.url.includes('.png');
  }

  public isJPG() {
    return this.isEqual('jpg') || this.url.includes('.jpg');
  }

  public isJPEG() {
    return this.isEqual('jpeg') || this.url.includes('.jpeg');
  }

  public isWEBP() {
    return this.isEqual('webp') || this.url.includes('.webp');
  }

  public isBase64Image() {
    return new RegExp(/data:image\/[^;]+;base64/i).test(this.url);
  }

  public isUnsplashImage() {
    return this.url.includes('https://images.unsplash.com/');
  }

  public isLinkedinImage() {
    return this.url.includes('https://media.licdn.com/dms/image/');
  }

  public isGoogleImage() {
    return this.url.includes('https://lh3.googleusercontent.com/');
  }

  public isInstagramImage() {
    const isIGCdn =
      this.url.includes('https://scontent-iad3-1.cdninstagram.com/') ||
      this.url.includes('https://scontent-iad3-2.cdninstagram.com/');
    return isIGCdn && !this.isVideo();
  }

  public isImage() {
    return (
      this.isGif() ||
      this.isPNG() ||
      this.isJPEG() ||
      this.isJPG() ||
      this.isWEBP() ||
      this.isBase64Image() ||
      this.isUnsplashImage() ||
      this.isSVG() ||
      this.isLinkedinImage() ||
      this.isGoogleImage() ||
      this.isInstagramImage()
    );
  }

  public isXLS() {
    return this.type === 'xls';
  }

  public isXLSX() {
    return this.type === 'xlsx';
  }

  public isPPT() {
    return this.type === 'ppt';
  }

  public isPPTX() {
    return this.type === 'pptx';
  }

  public isDOC() {
    return this.type === 'doc';
  }

  public isDOCX() {
    return this.type === 'docx';
  }

  public isLinkedinPDF() {
    return this.url.includes('document-pdf-analyzed');
  }

  public isPdf() {
    return this.type === 'pdf' || this.isLinkedinPDF();
  }

  public isMov() {
    return this.type === 'mov';
  }

  public isLinkedinDocument() {
    return this.url.includes('https://media.licdn.com/dms/document/media/');
  }

  public isDocument() {
    return (
      this.isXLS() ||
      this.isXLSX() ||
      this.isPPT() ||
      this.isPPTX() ||
      this.isDOC() ||
      this.isDOCX() ||
      this.isPdf() ||
      this.isLinkedinDocument()
    );
  }

  public isMP4() {
    return this.isEqual('mp4') || this.url.includes('.mp4');
  }

  public isMOV() {
    return this.isEqual('mov') || this.url.includes('.mov');
  }

  public isQuickTime() {
    return this.isEqual('quicktime') || this.url.includes('.quicktime');
  }

  public isBase64Video() {
    return new RegExp(/data:video\/[^;]+;base64/i).test(this.url);
  }

  public isPexelsVideo() {
    return this.url.includes('https://player.vimeo.com/');
  }

  public isLinkedinVideo() {
    return this.url.includes('https://dms.licdn.com/playlist/vid/');
  }

  public isVideo() {
    return (
      this.isMP4() ||
      this.isMOV() ||
      this.isQuickTime() ||
      this.isBase64Video() ||
      this.isPexelsVideo() ||
      this.isLinkedinVideo()
    );
  }

  public isGiphyGif() {
    return this.url.includes('giphy.com/media/');
  }

  public isGif() {
    return this.isEqual('gif') || this.isGiphyGif();
  }

  public isOgg() {
    return this.isEqual('ogg') || this.url.includes('.ogg');
  }

  public isWav() {
    return this.isEqual('wav') || this.url.includes('.wav');
  }

  public isMP3() {
    return this.isEqual('mp3') || this.url.includes('.mp3');
  }

  public isAudio() {
    return this.isOgg() || this.isWav() || this.isMP3();
  }

  public isMultimedia() {
    return this.isImage() || this.isVideo() || this.isDocument();
  }

  public download(): void {
    $url.download(this.url);
  }

  public get to() {
    return {
      error: () => {
        (this.status as 'error') = 'error';
      },
      ok: () => {
        (this.status as 'ok') = 'ok';
      },
      loading: () => {
        (this.status as 'loading') = 'loading';
      },
    };
  }

  public ensure(predicate: (m: Multimedia) => boolean): boolean {
    if (predicate(this)) {
      this.to.ok();
    } else {
      this.to.error();
    }
    return this.isOk();
  }

  public ensureAsError(predicate: (m: Multimedia) => boolean): boolean {
    if (!predicate(this)) {
      this.to.error();
    }
    return predicate(this);
  }

  public getElement() {
    if (this.isImage()) return html.create.imageElement.fromUrl(this.url);
    if (this.isVideo()) return html.create.videoElement.fromUrl(this.url);
    return null;
  }

  public static from(url: string) {
    return new Multimedia(url);
  }
}
