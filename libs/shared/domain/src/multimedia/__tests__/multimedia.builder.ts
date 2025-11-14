import { Multimedia } from '../multimedia';

export class MultimediaBuilder {
  private url = 'test.png';
  private coverUrl: string | null = null;
  private statusValue: 'error' | 'ok' | 'loading' = 'ok';
  private mockMetadata: {
    width?: number;
    height?: number;
    size?: number;
    duration?: number;
    type?: string;
    loaded?: boolean;
  } | null = null;

  public withUrl(url: string): MultimediaBuilder {
    this.url = url;
    return this;
  }

  public withExtension(ext: string): MultimediaBuilder {
    this.url = `test.${ext}`;
    return this;
  }

  public withQueryParams(params: string): MultimediaBuilder {
    this.url = `${this.url}?${params}`;
    return this;
  }

  public withFragment(fragment: string): MultimediaBuilder {
    this.url = `${this.url}#${fragment}`;
    return this;
  }

  public asPNG(): MultimediaBuilder {
    return this.withExtension('png');
  }

  public asJPG(): MultimediaBuilder {
    return this.withExtension('jpg');
  }

  public asJPEG(): MultimediaBuilder {
    return this.withExtension('jpeg');
  }

  public asWEBP(): MultimediaBuilder {
    return this.withExtension('webp');
  }

  public asSVG(): MultimediaBuilder {
    return this.withExtension('svg');
  }

  public asGIF(): MultimediaBuilder {
    return this.withExtension('gif');
  }

  public asBase64Image(): MultimediaBuilder {
    this.url =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    return this;
  }

  public asUnsplashImage(): MultimediaBuilder {
    this.url = 'https://images.unsplash.com/photo-1234567890/test.jpg';
    return this;
  }

  public asLinkedinImage(): MultimediaBuilder {
    this.url = 'https://media.licdn.com/dms/image/test.jpg';
    return this;
  }

  public asGoogleImage(): MultimediaBuilder {
    this.url = 'https://lh3.googleusercontent.com/test.jpg';
    return this;
  }

  public asInstagramImage(): MultimediaBuilder {
    this.url = 'https://scontent-iad3-1.cdninstagram.com/test.jpg';
    return this;
  }

  public asGiphyGif(): MultimediaBuilder {
    this.url = 'https://giphy.com/media/test123/giphy.gif';
    return this;
  }

  // Video types
  public asMP4(): MultimediaBuilder {
    return this.withExtension('mp4');
  }

  public asMOV(): MultimediaBuilder {
    return this.withExtension('mov');
  }

  public asQuickTime(): MultimediaBuilder {
    return this.withExtension('quicktime');
  }

  public asBase64Video(): MultimediaBuilder {
    this.url = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDE=';
    return this;
  }

  public asPexelsVideo(): MultimediaBuilder {
    this.url = 'https://player.vimeo.com/video/123456789';
    return this;
  }

  public asLinkedinVideo(): MultimediaBuilder {
    this.url = 'https://dms.licdn.com/playlist/vid/test123';
    return this;
  }

  // Document types
  public asDocumentType(type: string): MultimediaBuilder {
    this.url = `https://example.com/document.${type}`;
    return this;
  }

  public asPDF(): MultimediaBuilder {
    return this.withExtension('pdf');
  }

  public asDOC(): MultimediaBuilder {
    return this.withExtension('doc');
  }

  public asDOCX(): MultimediaBuilder {
    return this.withExtension('docx');
  }

  public asXLS(): MultimediaBuilder {
    return this.withExtension('xls');
  }

  public asXLSX(): MultimediaBuilder {
    return this.withExtension('xlsx');
  }

  public asPPT(): MultimediaBuilder {
    return this.withExtension('ppt');
  }

  public asPPTX(): MultimediaBuilder {
    return this.withExtension('pptx');
  }

  public asLinkedinPDF(): MultimediaBuilder {
    this.url = 'https://media.licdn.com/dms/document-pdf-analyzed/test.pdf';
    return this;
  }

  public asLinkedinDocument(): MultimediaBuilder {
    this.url = 'https://media.licdn.com/dms/document/media/test.doc';
    return this;
  }

  // AWS/Bucket URLs - Using actual patterns that the aws utility recognizes
  public asTemporal(): MultimediaBuilder {
    this.url = 'https://socialgest-temporal.s3.amazonaws.com/test.png';
    return this;
  }

  public asBucket(): MultimediaBuilder {
    this.url = 'https://socialgest-bucket.s3.amazonaws.com/test.png';
    return this;
  }

  public asProduction(): MultimediaBuilder {
    this.url = 'https://socialgest-prod.s3.amazonaws.com/test.png';
    return this;
  }

  // Special cases
  public withComplexUrl(): MultimediaBuilder {
    this.url = 'https://example.com/path/to/file.png?param1=value1&param2=value2#fragment';
    return this;
  }

  public withEmptyExtension(): MultimediaBuilder {
    this.url = 'test';
    return this;
  }

  public withMultipleDots(): MultimediaBuilder {
    this.url = 'test.backup.final.png';
    return this;
  }

  // Metadata mocking methods
  public withDimensions(width: number, height: number): MultimediaBuilder {
    this.mockMetadata = { ...this.mockMetadata, width, height };
    return this;
  }

  public withSize(size: number): MultimediaBuilder {
    this.mockMetadata = { ...this.mockMetadata, size };
    return this;
  }

  public withDuration(duration: number): MultimediaBuilder {
    this.mockMetadata = { ...this.mockMetadata, duration };
    return this;
  }

  public withMetadataType(type: string): MultimediaBuilder {
    this.mockMetadata = { ...this.mockMetadata, type };
    return this;
  }

  public withLoadedMetadata(loaded = true): MultimediaBuilder {
    this.mockMetadata = { ...this.mockMetadata, loaded };
    return this;
  }

  // Cover methods
  public withCover(coverUrl: string): MultimediaBuilder {
    this.coverUrl = coverUrl;
    return this;
  }

  public withCoverImage(): MultimediaBuilder {
    this.coverUrl = 'cover.jpg';
    return this;
  }

  public withVideoCover(): MultimediaBuilder {
    this.coverUrl = 'video-cover.png';
    return this;
  }

  public withBase64Cover(): MultimediaBuilder {
    this.coverUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    return this;
  }

  // Preset dimension configurations
  public asHorizontalImage(): MultimediaBuilder {
    return this.asPNG().withDimensions(1920, 1080);
  }

  public asVerticalImage(): MultimediaBuilder {
    return this.asPNG().withDimensions(1080, 1920);
  }

  public asSquareImage(): MultimediaBuilder {
    return this.asPNG().withDimensions(1080, 1080);
  }

  public asLargeImage(): MultimediaBuilder {
    return this.asPNG().withDimensions(4000, 3000).withSize(5242880); // 5MB
  }

  public asSmallImage(): MultimediaBuilder {
    return this.asPNG().withDimensions(200, 150).withSize(51200); // 50KB
  }

  public asHDVideo(): MultimediaBuilder {
    return this.asMP4().withDimensions(1920, 1080).withDuration(120).withSize(104857600); // 100MB, 2min
  }

  public asShortVideo(): MultimediaBuilder {
    return this.asMP4().withDimensions(640, 480).withDuration(15).withSize(10485760); // 10MB, 15sec
  }

  public asUltraWideImage(): MultimediaBuilder {
    return this.asPNG().withDimensions(3440, 1440); // 21:9 aspect ratio
  }

  public asCinematicVideo(): MultimediaBuilder {
    return this.asMP4().withDimensions(2560, 1080).withDuration(300); // 21:9, 5min
  }

  // Status methods
  public withStatus(status: 'error' | 'ok' | 'loading'): MultimediaBuilder {
    this.statusValue = status;
    return this;
  }

  public asError(): MultimediaBuilder {
    this.statusValue = 'error';
    return this;
  }

  public asOk(): MultimediaBuilder {
    this.statusValue = 'ok';
    return this;
  }

  public asLoading(): MultimediaBuilder {
    this.statusValue = 'loading';
    return this;
  }

  public build(): Multimedia {
    const multimedia = new Multimedia(this.url);

    // Mock metadata if provided
    if (this.mockMetadata) {
      const metadata = multimedia.metadata as { values: Record<string, unknown> };
      if (this.mockMetadata.width !== undefined) metadata.values['width'] = this.mockMetadata.width;
      if (this.mockMetadata.height !== undefined) metadata.values['height'] = this.mockMetadata.height;
      if (this.mockMetadata.size !== undefined) metadata.values['size'] = this.mockMetadata.size;
      if (this.mockMetadata.duration !== undefined) metadata.values['duration'] = this.mockMetadata.duration;
      if (this.mockMetadata.type !== undefined) metadata.values['type'] = this.mockMetadata.type;
      if (this.mockMetadata.loaded !== undefined) metadata.values['loaded'] = this.mockMetadata.loaded;
    }

    (multimedia.status as 'error' | 'ok' | 'loading') = this.statusValue;

    if (this.coverUrl) multimedia.withCover(this.coverUrl);

    return multimedia;
  }
}
