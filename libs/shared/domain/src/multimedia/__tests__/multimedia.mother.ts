import { MultimediaBuilder } from './multimedia.builder';

export class MultimediaMother {
  // Image builders
  public static pngImage(): MultimediaBuilder {
    return new MultimediaBuilder().asPNG();
  }

  public static jpgImage(): MultimediaBuilder {
    return new MultimediaBuilder().asJPG();
  }

  public static jpegImage(): MultimediaBuilder {
    return new MultimediaBuilder().asJPEG();
  }

  public static webpImage(): MultimediaBuilder {
    return new MultimediaBuilder().asWEBP();
  }

  public static svgImage(): MultimediaBuilder {
    return new MultimediaBuilder().asSVG();
  }

  public static gifImage(): MultimediaBuilder {
    return new MultimediaBuilder().asGIF();
  }

  public static base64Image(): MultimediaBuilder {
    return new MultimediaBuilder().asBase64Image();
  }

  public static unsplashImage(): MultimediaBuilder {
    return new MultimediaBuilder().asUnsplashImage();
  }

  public static linkedinImage(): MultimediaBuilder {
    return new MultimediaBuilder().asLinkedinImage();
  }

  public static googleImage(): MultimediaBuilder {
    return new MultimediaBuilder().asGoogleImage();
  }

  public static instagramImage(): MultimediaBuilder {
    return new MultimediaBuilder().asInstagramImage();
  }

  public static giphyGif(): MultimediaBuilder {
    return new MultimediaBuilder().asGiphyGif();
  }

  // Video builders
  public static mp4Video(): MultimediaBuilder {
    return new MultimediaBuilder().asMP4();
  }

  public static movVideo(): MultimediaBuilder {
    return new MultimediaBuilder().asMOV();
  }

  public static quickTimeVideo(): MultimediaBuilder {
    return new MultimediaBuilder().asQuickTime();
  }

  public static base64Video(): MultimediaBuilder {
    return new MultimediaBuilder().asBase64Video();
  }

  public static pexelsVideo(): MultimediaBuilder {
    return new MultimediaBuilder().asPexelsVideo();
  }

  public static linkedinVideo(): MultimediaBuilder {
    return new MultimediaBuilder().asLinkedinVideo();
  }

  // Document builders
  public static documentType(type: string): MultimediaBuilder {
    return new MultimediaBuilder().asDocumentType(type);
  }

  public static pdfDocument(): MultimediaBuilder {
    return new MultimediaBuilder().asPDF();
  }

  public static docDocument(): MultimediaBuilder {
    return new MultimediaBuilder().asDOC();
  }

  public static docxDocument(): MultimediaBuilder {
    return new MultimediaBuilder().asDOCX();
  }

  public static xlsDocument(): MultimediaBuilder {
    return new MultimediaBuilder().asXLS();
  }

  public static xlsxDocument(): MultimediaBuilder {
    return new MultimediaBuilder().asXLSX();
  }

  public static pptDocument(): MultimediaBuilder {
    return new MultimediaBuilder().asPPT();
  }

  public static pptxDocument(): MultimediaBuilder {
    return new MultimediaBuilder().asPPTX();
  }

  public static linkedinPDF(): MultimediaBuilder {
    return new MultimediaBuilder().asLinkedinPDF();
  }

  public static linkedinDocument(): MultimediaBuilder {
    return new MultimediaBuilder().asLinkedinDocument();
  }

  // Special cases
  public static temporalFile(): MultimediaBuilder {
    return new MultimediaBuilder().asTemporal();
  }

  public static bucketFile(): MultimediaBuilder {
    return new MultimediaBuilder().asBucket();
  }

  public static productionFile(): MultimediaBuilder {
    return new MultimediaBuilder().asProduction();
  }

  public static complexUrl(): MultimediaBuilder {
    return new MultimediaBuilder().withComplexUrl();
  }

  public static emptyExtension(): MultimediaBuilder {
    return new MultimediaBuilder().withEmptyExtension();
  }

  public static multipleDots(): MultimediaBuilder {
    return new MultimediaBuilder().withMultipleDots();
  }

  // Dimension-based builders
  public static horizontalImage(): MultimediaBuilder {
    return new MultimediaBuilder().asHorizontalImage();
  }

  public static verticalImage(): MultimediaBuilder {
    return new MultimediaBuilder().asVerticalImage();
  }

  public static squareImage(): MultimediaBuilder {
    return new MultimediaBuilder().asSquareImage();
  }

  public static largeImage(): MultimediaBuilder {
    return new MultimediaBuilder().asLargeImage();
  }

  public static smallImage(): MultimediaBuilder {
    return new MultimediaBuilder().asSmallImage();
  }

  public static hdVideo(): MultimediaBuilder {
    return new MultimediaBuilder().asHDVideo();
  }

  public static shortVideo(): MultimediaBuilder {
    return new MultimediaBuilder().asShortVideo();
  }

  public static ultraWideImage(): MultimediaBuilder {
    return new MultimediaBuilder().asUltraWideImage();
  }

  public static cinematicVideo(): MultimediaBuilder {
    return new MultimediaBuilder().asCinematicVideo();
  }

  // Custom dimensions
  public static customDimensions(width: number, height: number): MultimediaBuilder {
    return new MultimediaBuilder().asPNG().withDimensions(width, height);
  }

  public static customVideo(width: number, height: number, duration: number): MultimediaBuilder {
    return new MultimediaBuilder().asMP4().withDimensions(width, height).withDuration(duration);
  }

  public static builder(): MultimediaBuilder {
    return new MultimediaBuilder();
  }

  // Cover scenarios
  public static imageWithCover(): MultimediaBuilder {
    return new MultimediaBuilder().asPNG().withCoverImage();
  }

  public static videoWithCover(): MultimediaBuilder {
    return new MultimediaBuilder().asMP4().withVideoCover();
  }

  public static mediaWithBase64Cover(): MultimediaBuilder {
    return new MultimediaBuilder().asPNG().withBase64Cover();
  }

  public static mediaWithCustomCover(coverUrl: string): MultimediaBuilder {
    return new MultimediaBuilder().asPNG().withCover(coverUrl);
  }

  // Status scenarios
  public static errorMedia(): MultimediaBuilder {
    return new MultimediaBuilder().asPNG().asError();
  }

  public static loadingMedia(): MultimediaBuilder {
    return new MultimediaBuilder().asPNG().asLoading();
  }

  public static okMedia(): MultimediaBuilder {
    return new MultimediaBuilder().asPNG().asOk();
  }

  public static errorVideo(): MultimediaBuilder {
    return new MultimediaBuilder().asMP4().asError();
  }

  public static loadingVideo(): MultimediaBuilder {
    return new MultimediaBuilder().asMP4().asLoading();
  }

  public static errorDocument(): MultimediaBuilder {
    return new MultimediaBuilder().asPDF().asError();
  }

  public static loadingDocument(): MultimediaBuilder {
    return new MultimediaBuilder().asPDF().asLoading();
  }
}
