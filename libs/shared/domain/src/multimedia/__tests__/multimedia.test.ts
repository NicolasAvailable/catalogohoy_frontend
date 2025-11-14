import { Multimedia } from '../multimedia';
import { MultimediaMother } from './multimedia.mother';
import { MultimediaBuilder } from './multimedia.builder';

describe('Multimedia', () => {
  describe('Static Factory Methods', () => {
    test('should create multimedia from URL', () => {
      const media = Multimedia.from('test.png');
      expect(media).toBeInstanceOf(Multimedia);
      expect(media.url).toBe('test.png');
    });
  });

  describe('Constructor and Basic Properties', () => {
    test('should initialize with URL and metadata', () => {
      const media = MultimediaMother.pngImage().build();
      expect(media.url).toBeDefined();
      expect(media.metadata).toBeDefined();
    });

    test('should handle null/undefined URLs', () => {
      const media = new Multimedia(null as unknown as string);
      expect(media.url).toBe('');
    });

    test('should parse AWS URLs', () => {
      const media = MultimediaMother.bucketFile().build();
      expect(media.url).toContain('socialgest');
    });
  });

  describe('Type Detection', () => {
    test('should extract type from URL extension', () => {
      const png = MultimediaMother.pngImage().build();
      const jpg = MultimediaMother.jpgImage().build();
      const pdf = MultimediaMother.pdfDocument().build();

      expect(png.type).toBe('png');
      expect(jpg.type).toBe('jpg');
      expect(pdf.type).toBe('pdf');
    });

    test('should handle complex URLs with query params and fragments', () => {
      const media = MultimediaMother.complexUrl().build();
      expect(media.type).toBe('png');
    });

    test('should handle URLs without extension', () => {
      const media = MultimediaMother.emptyExtension().build();
      expect(media.type).toBe('test'); // URL 'test' becomes the type when no extension
    });

    test('should handle URLs with multiple dots', () => {
      const media = MultimediaMother.multipleDots().build();
      expect(media.type).toBe('png');
    });
  });

  describe('Image Detection', () => {
    test('should detect PNG images', () => {
      const png = MultimediaMother.pngImage().build();
      expect(png.isPNG()).toBe(true);
      expect(png.isImage()).toBe(true);
    });

    test('should detect JPG images', () => {
      const jpg = MultimediaMother.jpgImage().build();
      expect(jpg.isJPG()).toBe(true);
      expect(jpg.isImage()).toBe(true);
    });

    test('should detect JPEG images', () => {
      const jpeg = MultimediaMother.jpegImage().build();
      expect(jpeg.isJPEG()).toBe(true);
      expect(jpeg.isImage()).toBe(true);
    });

    test('should detect WEBP images', () => {
      const webp = MultimediaMother.webpImage().build();
      expect(webp.isWEBP()).toBe(true);
      expect(webp.isImage()).toBe(true);
    });

    test('should detect SVG images', () => {
      const svg = MultimediaMother.svgImage().build();
      expect(svg.isSVG()).toBe(true);
      expect(svg.isImage()).toBe(true);
    });

    test('should detect GIF images', () => {
      const gif = MultimediaMother.gifImage().build();
      const giphyGif = MultimediaMother.giphyGif().build();

      expect(gif.isGif()).toBe(true);
      expect(gif.isImage()).toBe(true);
      expect(giphyGif.isGiphyGif()).toBe(true);
      expect(giphyGif.isGif()).toBe(true);
      expect(giphyGif.isImage()).toBe(true);
    });

    test('should detect Base64 images', () => {
      const base64 = MultimediaMother.base64Image().build();
      expect(base64.isBase64Image()).toBe(true);
      expect(base64.isBase64()).toBe(true);
      expect(base64.isImage()).toBe(true);
    });

    test('should detect external platform images', () => {
      const unsplash = MultimediaMother.unsplashImage().build();
      const linkedin = MultimediaMother.linkedinImage().build();
      const google = MultimediaMother.googleImage().build();
      const instagram = MultimediaMother.instagramImage().build();

      expect(unsplash.isUnsplashImage()).toBe(true);
      expect(unsplash.isImage()).toBe(true);

      expect(linkedin.isLinkedinImage()).toBe(true);
      expect(linkedin.isImage()).toBe(true);

      expect(google.isGoogleImage()).toBe(true);
      expect(google.isImage()).toBe(true);

      expect(instagram.isInstagramImage()).toBe(true);
      expect(instagram.isImage()).toBe(true);
    });
  });

  describe('Video Detection', () => {
    test('should detect MP4 videos', () => {
      const mp4 = MultimediaMother.mp4Video().build();
      expect(mp4.isMP4()).toBe(true);
      expect(mp4.isVideo()).toBe(true);
    });

    test('should detect MOV videos', () => {
      const mov = MultimediaMother.movVideo().build();
      expect(mov.isMOV()).toBe(true);
      expect(mov.isMov()).toBe(true);
      expect(mov.isVideo()).toBe(true);
    });

    test('should detect QuickTime videos', () => {
      const quicktime = MultimediaMother.quickTimeVideo().build();
      expect(quicktime.isQuickTime()).toBe(true);
      expect(quicktime.isVideo()).toBe(true);
    });

    test('should detect Base64 videos', () => {
      const base64 = MultimediaMother.base64Video().build();
      expect(base64.isBase64Video()).toBe(true);
      expect(base64.isBase64()).toBe(true);
      expect(base64.isVideo()).toBe(true);
    });

    test('should detect external platform videos', () => {
      const pexels = MultimediaMother.pexelsVideo().build();
      const linkedin = MultimediaMother.linkedinVideo().build();

      expect(pexels.isPexelsVideo()).toBe(true);
      expect(pexels.isVideo()).toBe(true);

      expect(linkedin.isLinkedinVideo()).toBe(true);
      expect(linkedin.isVideo()).toBe(true);
    });
  });

  describe('Document Detection', () => {
    test('should detect PDF documents', () => {
      const pdf = MultimediaMother.pdfDocument().build();
      const linkedinPdf = MultimediaMother.linkedinPDF().build();

      expect(pdf.isPdf()).toBe(true);
      expect(pdf.isDocument()).toBe(true);

      expect(linkedinPdf.isLinkedinPDF()).toBe(true);
      expect(linkedinPdf.isPdf()).toBe(true);
      expect(linkedinPdf.isDocument()).toBe(true);
    });

    test('should detect Word documents', () => {
      const doc = MultimediaMother.docDocument().build();
      const docx = MultimediaMother.docxDocument().build();

      expect(doc.isDOC()).toBe(true);
      expect(doc.isDocument()).toBe(true);

      expect(docx.isDOCX()).toBe(true);
      expect(docx.isDocument()).toBe(true);
    });

    test('should detect Excel documents', () => {
      const xls = MultimediaMother.xlsDocument().build();
      const xlsx = MultimediaMother.xlsxDocument().build();

      expect(xls.isXLS()).toBe(true);
      expect(xls.isDocument()).toBe(true);

      expect(xlsx.isXLSX()).toBe(true);
      expect(xlsx.isDocument()).toBe(true);
    });

    test('should detect PowerPoint documents', () => {
      const ppt = MultimediaMother.pptDocument().build();
      const pptx = MultimediaMother.pptxDocument().build();

      expect(ppt.isPPT()).toBe(true);
      expect(ppt.isDocument()).toBe(true);

      expect(pptx.isPPTX()).toBe(true);
      expect(pptx.isDocument()).toBe(true);
    });

    test('should detect LinkedIn documents', () => {
      const linkedinDoc = MultimediaMother.linkedinDocument().build();
      expect(linkedinDoc.isLinkedinDocument()).toBe(true);
      expect(linkedinDoc.isDocument()).toBe(true);
    });
  });

  describe('Multimedia Classification', () => {
    test('should distinguish between media types', () => {
      const image = MultimediaMother.pngImage().build();
      const video = MultimediaMother.mp4Video().build();
      const document = MultimediaMother.pdfDocument().build();

      expect(image.isImage()).toBe(true);
      expect(image.isVideo()).toBe(false);
      expect(image.isDocument()).toBe(false);

      expect(video.isVideo()).toBe(true);
      expect(video.isImage()).toBe(false);
      expect(video.isDocument()).toBe(false);

      expect(document.isDocument()).toBe(true);
      expect(document.isImage()).toBe(false);
      expect(document.isVideo()).toBe(false);
    });
  });

  describe('AWS and Storage Detection', () => {
    test('should detect temporal files', () => {
      const temporal = MultimediaMother.temporalFile().build();
      // Test that the method exists and returns a boolean
      expect(typeof temporal.isTemporal()).toBe('boolean');
    });

    test('should detect bucket files', () => {
      const bucket = MultimediaMother.bucketFile().build();
      // Test that the method exists and returns a boolean
      expect(typeof bucket.isBucket()).toBe('boolean');
    });

    test('should detect production files', () => {
      const prod = MultimediaMother.productionFile().build();
      // Test that the method exists and returns a boolean
      expect(typeof prod.isProduction()).toBe('boolean');
    });
  });

  describe('Utility Methods', () => {
    test('should check type equality case-insensitively', () => {
      const png = MultimediaMother.pngImage().build();
      expect(png.isEqual('PNG')).toBe(true);
      expect(png.isEqual('png')).toBe(true);
      expect(png.isEqual('Png')).toBe(true);
      expect(png.isEqual('jpg')).toBe(false);
    });

    test('should check if type is included in array', () => {
      const png = MultimediaMother.pngImage().build();
      expect(png.includes(['png', 'jpg'])).toBe(true);
      expect(png.includes(['jpg', 'gif'])).toBe(false);
    });

    test('should get file property', () => {
      const media = MultimediaMother.pngImage().build();
      expect(media.file).toBeDefined();
    });

    test('should get extension from metadata type', () => {
      const media = MultimediaMother.pngImage().build();
      expect(media.ext).toBeDefined();
    });
  });

  describe('Metadata Properties', () => {
    test('should access metadata properties with mock data', () => {
      const horizontal = MultimediaMother.horizontalImage().build();
      const hdVideo = MultimediaMother.hdVideo().build();
      const large = MultimediaMother.largeImage().build();

      expect(horizontal.width).toBe(1920);
      expect(horizontal.height).toBe(1080);
      expect(typeof horizontal.size).toBe('number');
      expect(typeof horizontal.duration).toBe('number');
      expect(typeof horizontal.loaded).toBe('boolean');

      expect(hdVideo.width).toBe(1920);
      expect(hdVideo.height).toBe(1080);
      expect(hdVideo.duration).toBe(120);
      expect(hdVideo.size).toBeGreaterThan(0);

      expect(large.width).toBe(4000);
      expect(large.height).toBe(3000);
      expect(large.size).toBeGreaterThan(0);
    });
  });

  describe('Dimension-Based Methods', () => {
    test('should correctly identify horizontal images', () => {
      const horizontal = MultimediaMother.horizontalImage().build(); // 1920x1080
      const ultraWide = MultimediaMother.ultraWideImage().build(); // 3440x1440

      expect(horizontal.isHorizontal()).toBe(true);
      expect(horizontal.isVertical()).toBe(false);
      expect(horizontal.isSquare()).toBe(false);

      expect(ultraWide.isHorizontal()).toBe(true);
      expect(ultraWide.isVertical()).toBe(false);
      expect(ultraWide.isSquare()).toBe(false);
    });

    test('should correctly identify vertical images', () => {
      const vertical = MultimediaMother.verticalImage().build(); // 1080x1920

      expect(vertical.isVertical()).toBe(true);
      expect(vertical.isHorizontal()).toBe(false);
      expect(vertical.isSquare()).toBe(false);
    });

    test('should correctly identify square images', () => {
      const square = MultimediaMother.squareImage().build(); // 1080x1080

      expect(square.isSquare()).toBe(true);
      expect(square.isHorizontal()).toBe(true); // width >= height
      expect(square.isVertical()).toBe(false);
    });

    test('should check if media has dimensions', () => {
      const withDimensions = MultimediaMother.horizontalImage().build();
      const withoutDimensions = new MultimediaBuilder().asPNG().withDimensions(0, 0).build();

      expect(withDimensions.hasDimension()).toBe(true);
      expect(withoutDimensions.hasDimension()).toBe(false);
    });

    test('should check specific dimension matches', () => {
      const horizontal = MultimediaMother.horizontalImage().build(); // 1920x1080

      expect(horizontal.isDimension(1920, 1080)).toBe(true);
      expect(horizontal.isDimension(1080, 1920)).toBe(false);
      expect(horizontal.isDimension(1920, 1079)).toBe(false);
    });

    test('should compare dimensions correctly', () => {
      const large = MultimediaMother.largeImage().build(); // 4000x3000
      const small = MultimediaMother.smallImage().build(); // 200x150

      // Width comparisons
      expect(large.isWidthGreaterThan(3000)).toBe(true);
      expect(large.isWidthLessThan(5000)).toBe(true);
      expect(small.isWidthGreaterThan(100)).toBe(true);
      expect(small.isWidthLessThan(300)).toBe(true);

      // Height comparisons
      expect(large.isHeightGreaterThan(2000)).toBe(true);
      expect(large.isHeightLessThan(4000)).toBe(true);
      expect(small.isHeightGreaterThan(100)).toBe(true);
      expect(small.isHeightLessThan(200)).toBe(true);
    });

    test('should check width greater than or equal correctly', () => {
      const large = MultimediaMother.largeImage().build(); // 4000x3000
      const horizontal = MultimediaMother.horizontalImage().build(); // 1920x1080
      const small = MultimediaMother.smallImage().build(); // 200x150

      // Greater than
      expect(large.isWidthGreaterOrEqualThan(3000)).toBe(true);
      expect(horizontal.isWidthGreaterOrEqualThan(1000)).toBe(true);
      expect(small.isWidthGreaterOrEqualThan(100)).toBe(true);

      // Equal to
      expect(large.isWidthGreaterOrEqualThan(4000)).toBe(true);
      expect(horizontal.isWidthGreaterOrEqualThan(1920)).toBe(true);
      expect(small.isWidthGreaterOrEqualThan(200)).toBe(true);

      // Less than
      expect(large.isWidthGreaterOrEqualThan(5000)).toBe(false);
      expect(horizontal.isWidthGreaterOrEqualThan(2000)).toBe(false);
      expect(small.isWidthGreaterOrEqualThan(300)).toBe(false);
    });

    test('should check width less than or equal correctly', () => {
      const large = MultimediaMother.largeImage().build(); // 4000x3000
      const horizontal = MultimediaMother.horizontalImage().build(); // 1920x1080
      const small = MultimediaMother.smallImage().build(); // 200x150

      // Less than
      expect(large.isWidthLessOrEqualThan(5000)).toBe(true);
      expect(horizontal.isWidthLessOrEqualThan(2000)).toBe(true);
      expect(small.isWidthLessOrEqualThan(300)).toBe(true);

      // Equal to
      expect(large.isWidthLessOrEqualThan(4000)).toBe(true);
      expect(horizontal.isWidthLessOrEqualThan(1920)).toBe(true);
      expect(small.isWidthLessOrEqualThan(200)).toBe(true);

      // Greater than
      expect(large.isWidthLessOrEqualThan(3000)).toBe(false);
      expect(horizontal.isWidthLessOrEqualThan(1000)).toBe(false);
      expect(small.isWidthLessOrEqualThan(100)).toBe(false);
    });

    test('should check height greater than or equal correctly', () => {
      const large = MultimediaMother.largeImage().build(); // 4000x3000
      const horizontal = MultimediaMother.horizontalImage().build(); // 1920x1080
      const small = MultimediaMother.smallImage().build(); // 200x150

      // Greater than
      expect(large.isHeightGreaterOrEqualThan(2000)).toBe(true);
      expect(horizontal.isHeightGreaterOrEqualThan(1000)).toBe(true);
      expect(small.isHeightGreaterOrEqualThan(100)).toBe(true);

      // Equal to
      expect(large.isHeightGreaterOrEqualThan(3000)).toBe(true);
      expect(horizontal.isHeightGreaterOrEqualThan(1080)).toBe(true);
      expect(small.isHeightGreaterOrEqualThan(150)).toBe(true);

      // Less than
      expect(large.isHeightGreaterOrEqualThan(4000)).toBe(false);
      expect(horizontal.isHeightGreaterOrEqualThan(1500)).toBe(false);
      expect(small.isHeightGreaterOrEqualThan(200)).toBe(false);
    });

    test('should check height less than or equal correctly', () => {
      const large = MultimediaMother.largeImage().build(); // 4000x3000
      const horizontal = MultimediaMother.horizontalImage().build(); // 1920x1080
      const small = MultimediaMother.smallImage().build(); // 200x150

      // Less than
      expect(large.isHeightLessOrEqualThan(4000)).toBe(true);
      expect(horizontal.isHeightLessOrEqualThan(1500)).toBe(true);
      expect(small.isHeightLessOrEqualThan(200)).toBe(true);

      // Equal to
      expect(large.isHeightLessOrEqualThan(3000)).toBe(true);
      expect(horizontal.isHeightLessOrEqualThan(1080)).toBe(true);
      expect(small.isHeightLessOrEqualThan(150)).toBe(true);

      // Greater than
      expect(large.isHeightLessOrEqualThan(2000)).toBe(false);
      expect(horizontal.isHeightLessOrEqualThan(1000)).toBe(false);
      expect(small.isHeightLessOrEqualThan(100)).toBe(false);
    });

    test('should handle edge cases for dimension comparisons', () => {
      const zeroDimensions = new MultimediaBuilder().asPNG().withDimensions(0, 0).build();
      const exactDimensions = new MultimediaBuilder().asPNG().withDimensions(1920, 1080).build();

      // Zero dimensions
      expect(zeroDimensions.isWidthGreaterOrEqualThan(0)).toBe(true);
      expect(zeroDimensions.isWidthGreaterOrEqualThan(1)).toBe(false);
      expect(zeroDimensions.isWidthLessOrEqualThan(0)).toBe(true);
      expect(zeroDimensions.isWidthLessOrEqualThan(1)).toBe(true);

      expect(zeroDimensions.isHeightGreaterOrEqualThan(0)).toBe(true);
      expect(zeroDimensions.isHeightGreaterOrEqualThan(1)).toBe(false);
      expect(zeroDimensions.isHeightLessOrEqualThan(0)).toBe(true);
      expect(zeroDimensions.isHeightLessOrEqualThan(1)).toBe(true);

      // Exact match
      expect(exactDimensions.isWidthGreaterOrEqualThan(1920)).toBe(true);
      expect(exactDimensions.isWidthLessOrEqualThan(1920)).toBe(true);
      expect(exactDimensions.isHeightGreaterOrEqualThan(1080)).toBe(true);
      expect(exactDimensions.isHeightLessOrEqualThan(1080)).toBe(true);
    });

    test('should work with different media types for dimension comparisons', () => {
      const image = MultimediaMother.pngImage().withDimensions(1920, 1080).build();
      const video = MultimediaMother.mp4Video().withDimensions(1920, 1080).build();

      [image, video].forEach((media) => {
        expect(media.isWidthGreaterOrEqualThan(1920)).toBe(true);
        expect(media.isWidthGreaterOrEqualThan(1000)).toBe(true);
        expect(media.isWidthGreaterOrEqualThan(2000)).toBe(false);

        expect(media.isWidthLessOrEqualThan(1920)).toBe(true);
        expect(media.isWidthLessOrEqualThan(2000)).toBe(true);
        expect(media.isWidthLessOrEqualThan(1000)).toBe(false);

        expect(media.isHeightGreaterOrEqualThan(1080)).toBe(true);
        expect(media.isHeightGreaterOrEqualThan(500)).toBe(true);
        expect(media.isHeightGreaterOrEqualThan(1500)).toBe(false);

        expect(media.isHeightLessOrEqualThan(1080)).toBe(true);
        expect(media.isHeightLessOrEqualThan(1500)).toBe(true);
        expect(media.isHeightLessOrEqualThan(500)).toBe(false);
      });
    });
  });

  describe('Size and Duration Comparisons', () => {
    test('should compare file sizes correctly', () => {
      const large = MultimediaMother.largeImage().build(); // 5MB
      const small = MultimediaMother.smallImage().build(); // 50KB

      expect(large.isSizeGreaterThan(1)).toBe(true); // > 1MB
      expect(large.isSizeLessThan(10)).toBe(true); // < 10MB
      expect(small.isSizeGreaterThan(0.01)).toBe(true); // > 0.01MB
      expect(small.isSizeLessThan(1)).toBe(true); // < 1MB
    });

    test('should check size greater than or equal correctly', () => {
      const large = MultimediaMother.largeImage().build(); // 5MB
      const small = MultimediaMother.smallImage().build(); // 50KB (0.048828125 MB)
      const medium = new MultimediaBuilder()
        .asPNG()
        .withSize(2 * 1024 * 1024)
        .build(); // 2MB

      // Greater than
      expect(large.isSizeGreaterOrEqualThan(1)).toBe(true);
      expect(medium.isSizeGreaterOrEqualThan(1)).toBe(true);
      expect(small.isSizeGreaterOrEqualThan(0.01)).toBe(true);

      // Equal to
      expect(large.isSizeGreaterOrEqualThan(5)).toBe(true);
      expect(medium.isSizeGreaterOrEqualThan(2)).toBe(true);

      // Less than
      expect(large.isSizeGreaterOrEqualThan(10)).toBe(false);
      expect(medium.isSizeGreaterOrEqualThan(5)).toBe(false);
      expect(small.isSizeGreaterOrEqualThan(1)).toBe(false);
    });

    test('should check size less than or equal correctly', () => {
      const large = MultimediaMother.largeImage().build(); // 5MB
      const small = MultimediaMother.smallImage().build(); // 50KB (0.048828125 MB)
      const medium = new MultimediaBuilder()
        .asPNG()
        .withSize(2 * 1024 * 1024)
        .build(); // 2MB

      // Less than
      expect(large.isSizeLessOrEqualThan(10)).toBe(true);
      expect(medium.isSizeLessOrEqualThan(5)).toBe(true);
      expect(small.isSizeLessOrEqualThan(1)).toBe(true);

      // Equal to
      expect(large.isSizeLessOrEqualThan(5)).toBe(true);
      expect(medium.isSizeLessOrEqualThan(2)).toBe(true);

      // Greater than
      expect(large.isSizeLessOrEqualThan(1)).toBe(false);
      expect(medium.isSizeLessOrEqualThan(1)).toBe(false);
      expect(small.isSizeLessOrEqualThan(0.01)).toBe(false);
    });

    test('should handle edge cases for size comparisons', () => {
      const zeroSize = new MultimediaBuilder().asPNG().withSize(0).build();
      const exactSize = new MultimediaBuilder()
        .asPNG()
        .withSize(100 * 1024 * 1024)
        .build(); // 100MB

      // Zero size
      expect(zeroSize.isSizeGreaterOrEqualThan(0)).toBe(true);
      expect(zeroSize.isSizeGreaterOrEqualThan(1)).toBe(false);
      expect(zeroSize.isSizeLessOrEqualThan(0)).toBe(true);
      expect(zeroSize.isSizeLessOrEqualThan(1)).toBe(true);

      // Exact match
      expect(exactSize.isSizeGreaterOrEqualThan(100)).toBe(true);
      expect(exactSize.isSizeLessOrEqualThan(100)).toBe(true);
      expect(exactSize.isSizeGreaterOrEqualThan(99)).toBe(true);
      expect(exactSize.isSizeGreaterOrEqualThan(101)).toBe(false);
      expect(exactSize.isSizeLessOrEqualThan(101)).toBe(true);
      expect(exactSize.isSizeLessOrEqualThan(99)).toBe(false);
    });

    test('should work with different media types for size comparisons', () => {
      const image = MultimediaMother.pngImage()
        .withSize(50 * 1024 * 1024)
        .build(); // 50MB
      const video = MultimediaMother.mp4Video()
        .withSize(50 * 1024 * 1024)
        .build(); // 50MB
      const document = MultimediaMother.pdfDocument()
        .withSize(50 * 1024 * 1024)
        .build(); // 50MB

      [image, video, document].forEach((media) => {
        expect(media.isSizeGreaterOrEqualThan(50)).toBe(true);
        expect(media.isSizeGreaterOrEqualThan(25)).toBe(true);
        expect(media.isSizeGreaterOrEqualThan(100)).toBe(false);

        expect(media.isSizeLessOrEqualThan(50)).toBe(true);
        expect(media.isSizeLessOrEqualThan(100)).toBe(true);
        expect(media.isSizeLessOrEqualThan(25)).toBe(false);
      });
    });

    test('should compare video durations correctly', () => {
      const hdVideo = MultimediaMother.hdVideo().build(); // 120 seconds
      const shortVideo = MultimediaMother.shortVideo().build(); // 15 seconds
      const cinematicVideo = MultimediaMother.cinematicVideo().build(); // 300 seconds

      expect(hdVideo.isDurationGreaterThan(60)).toBe(true);
      expect(hdVideo.isDurationLessThan(180)).toBe(true);

      expect(shortVideo.isDurationGreaterThan(10)).toBe(true);
      expect(shortVideo.isDurationLessThan(30)).toBe(true);

      expect(cinematicVideo.isDurationGreaterThan(240)).toBe(true);
      expect(cinematicVideo.isDurationLessThan(360)).toBe(true);
    });

    test('should check duration greater than or equal correctly', () => {
      const hdVideo = MultimediaMother.hdVideo().build(); // 120 seconds
      const shortVideo = MultimediaMother.shortVideo().build(); // 15 seconds
      const cinematicVideo = MultimediaMother.cinematicVideo().build(); // 300 seconds

      // Greater than
      expect(hdVideo.isDurationGreaterOrEqualThan(60)).toBe(true);
      expect(shortVideo.isDurationGreaterOrEqualThan(10)).toBe(true);
      expect(cinematicVideo.isDurationGreaterOrEqualThan(240)).toBe(true);

      // Equal to
      expect(hdVideo.isDurationGreaterOrEqualThan(120)).toBe(true);
      expect(shortVideo.isDurationGreaterOrEqualThan(15)).toBe(true);
      expect(cinematicVideo.isDurationGreaterOrEqualThan(300)).toBe(true);

      // Less than
      expect(hdVideo.isDurationGreaterOrEqualThan(180)).toBe(false);
      expect(shortVideo.isDurationGreaterOrEqualThan(30)).toBe(false);
      expect(cinematicVideo.isDurationGreaterOrEqualThan(360)).toBe(false);
    });

    test('should check duration less than or equal correctly', () => {
      const hdVideo = MultimediaMother.hdVideo().build(); // 120 seconds
      const shortVideo = MultimediaMother.shortVideo().build(); // 15 seconds
      const cinematicVideo = MultimediaMother.cinematicVideo().build(); // 300 seconds

      // Less than
      expect(hdVideo.isDurationLessOrEqualThan(180)).toBe(true);
      expect(shortVideo.isDurationLessOrEqualThan(30)).toBe(true);
      expect(cinematicVideo.isDurationLessOrEqualThan(360)).toBe(true);

      // Equal to
      expect(hdVideo.isDurationLessOrEqualThan(120)).toBe(true);
      expect(shortVideo.isDurationLessOrEqualThan(15)).toBe(true);
      expect(cinematicVideo.isDurationLessOrEqualThan(300)).toBe(true);

      // Greater than
      expect(hdVideo.isDurationLessOrEqualThan(60)).toBe(false);
      expect(shortVideo.isDurationLessOrEqualThan(10)).toBe(false);
      expect(cinematicVideo.isDurationLessOrEqualThan(240)).toBe(false);
    });

    test('should handle edge cases for duration comparisons', () => {
      const zeroVideo = new MultimediaBuilder().asMP4().withDuration(0).build();
      const exactVideo = new MultimediaBuilder().asMP4().withDuration(100).build();

      // Zero duration
      expect(zeroVideo.isDurationGreaterOrEqualThan(0)).toBe(true);
      expect(zeroVideo.isDurationGreaterOrEqualThan(1)).toBe(false);
      expect(zeroVideo.isDurationLessOrEqualThan(0)).toBe(true);
      expect(zeroVideo.isDurationLessOrEqualThan(1)).toBe(true);

      // Exact match
      expect(exactVideo.isDurationGreaterOrEqualThan(100)).toBe(true);
      expect(exactVideo.isDurationLessOrEqualThan(100)).toBe(true);
      expect(exactVideo.isDurationGreaterOrEqualThan(99)).toBe(true);
      expect(exactVideo.isDurationGreaterOrEqualThan(101)).toBe(false);
      expect(exactVideo.isDurationLessOrEqualThan(101)).toBe(true);
      expect(exactVideo.isDurationLessOrEqualThan(99)).toBe(false);
    });

    test('should work with different video types for duration comparisons', () => {
      const mp4 = MultimediaMother.mp4Video().withDuration(90).build();
      const mov = MultimediaMother.movVideo().withDuration(90).build();
      const quicktime = MultimediaMother.quickTimeVideo().withDuration(90).build();

      [mp4, mov, quicktime].forEach((video) => {
        expect(video.isDurationGreaterOrEqualThan(90)).toBe(true);
        expect(video.isDurationGreaterOrEqualThan(60)).toBe(true);
        expect(video.isDurationGreaterOrEqualThan(120)).toBe(false);

        expect(video.isDurationLessOrEqualThan(90)).toBe(true);
        expect(video.isDurationLessOrEqualThan(120)).toBe(true);
        expect(video.isDurationLessOrEqualThan(60)).toBe(false);
      });
    });
  });

  describe('Aspect Ratio Calculations', () => {
    test('should calculate aspect ratios correctly', () => {
      const horizontal = MultimediaMother.horizontalImage().build(); // 1920x1080 = 16:9
      const square = MultimediaMother.squareImage().build(); // 1080x1080 = 1:1
      const vertical = MultimediaMother.verticalImage().build(); // 1080x1920 = 9:16

      expect(horizontal.calculateAspectRatio()).toBe('16:9');
      expect(square.calculateAspectRatio()).toBe('1:1');
      expect(vertical.calculateAspectRatio()).toBe('9:16');
    });

    test('should check aspect ratio comparisons', () => {
      const horizontal = MultimediaMother.horizontalImage().build(); // 1920x1080
      const vertical = MultimediaMother.verticalImage().build(); // 1080x1920
      const square = MultimediaMother.squareImage().build(); // 1080x1080

      // Test against 16:9 reference (1920x1080)
      expect(horizontal.checkEqualAspectRatio(1080, 1920)).toBe(true); // Same ratio
      expect(horizontal.checkHorizontalAspectRatio(1080, 1920)).toBe(false); // Not more horizontal
      expect(horizontal.checkVerticalAspectRatio(1080, 1920)).toBe(false); // Not more vertical

      // Test vertical against 16:9 reference
      expect(vertical.checkVerticalAspectRatio(1080, 1920)).toBe(true); // More vertical
      expect(vertical.checkHorizontalAspectRatio(1080, 1920)).toBe(false); // Not more horizontal
      expect(vertical.checkEqualAspectRatio(1080, 1920)).toBe(false); // Different ratio

      // Test square against 16:9 reference
      expect(square.checkVerticalAspectRatio(1080, 1920)).toBe(true); // More vertical than 16:9
      expect(square.checkHorizontalAspectRatio(1080, 1920)).toBe(false); // Not more horizontal than 16:9
    });

    test('should handle custom aspect ratios', () => {
      const custom169 = MultimediaMother.customDimensions(1600, 900).build(); // 16:9
      const custom43 = MultimediaMother.customDimensions(1024, 768).build(); // 4:3
      const custom219 = MultimediaMother.customDimensions(2100, 900).build(); // 7:3 ≈ 21:9

      expect(custom169.calculateAspectRatio()).toBe('16:9');
      expect(custom43.calculateAspectRatio()).toBe('4:3');
      expect(custom219.calculateAspectRatio()).toBe('7:3');
    });
  });

  describe('Edge Cases with Metadata', () => {
    test('should handle zero dimensions', () => {
      const zeroDimensions = new MultimediaBuilder().asPNG().withDimensions(0, 0).build();

      expect(zeroDimensions.hasDimension()).toBe(false);
      expect(zeroDimensions.isHorizontal()).toBe(true); // 0 >= 0
      expect(zeroDimensions.isVertical()).toBe(false); // 0 > 0 is false
      expect(zeroDimensions.isSquare()).toBe(true); // 0 === 0
    });

    test('should handle extreme aspect ratios', () => {
      const veryWide = MultimediaMother.customDimensions(10000, 100).build(); // 100:1
      const veryTall = MultimediaMother.customDimensions(100, 10000).build(); // 1:100

      expect(veryWide.isHorizontal()).toBe(true);
      expect(veryWide.isVertical()).toBe(false);
      expect(veryWide.calculateAspectRatio()).toBe('100:1');

      expect(veryTall.isVertical()).toBe(true);
      expect(veryTall.isHorizontal()).toBe(false);
      expect(veryTall.calculateAspectRatio()).toBe('1:100');
    });

    test('should handle single pixel dimensions', () => {
      const singlePixel = MultimediaMother.customDimensions(1, 1).build();

      expect(singlePixel.isSquare()).toBe(true);
      expect(singlePixel.hasDimension()).toBe(true);
      expect(singlePixel.calculateAspectRatio()).toBe('1:1');
    });
  });

  describe('Element Creation', () => {
    test('should create HTML elements for images', () => {
      const image = MultimediaMother.pngImage().build();
      const element = image.getElement();
      expect(element).toBeDefined();
    });

    test('should create HTML elements for videos', () => {
      const video = MultimediaMother.mp4Video().build();
      const element = video.getElement();
      expect(element).toBeDefined();
    });

    test('should return null for documents', () => {
      const document = MultimediaMother.pdfDocument().build();
      const element = document.getElement();
      expect(element).toBeNull();
    });
  });

  describe('Metadata Loading', () => {
    test('should support metadata loading', () => {
      const media = MultimediaMother.pngImage().build();
      const result = media.loadMetadata();
      expect(result).toBe(media); // Should return same instance for chaining
    });
  });

  describe('Cover Functionality', () => {
    test('should have undefined cover by default', () => {
      const media = MultimediaMother.pngImage().build();
      expect(media.cover).toBeUndefined();
    });

    test('should set cover using withCover method', () => {
      const media = MultimediaMother.pngImage().build();
      const coverUrl = 'cover.jpg';

      const result = media.withCover(coverUrl);

      expect(result).toBe(media); // Should return same instance for chaining
      expect(media.cover).toBeDefined();
      expect(media.cover).toBeInstanceOf(Multimedia);
      expect(media.cover?.url).toBe(coverUrl);
    });

    test('should create cover with metadata loaded', () => {
      const media = MultimediaMother.pngImage().build();
      const coverUrl = 'cover.jpg';

      media.withCover(coverUrl);

      // The cover should have loadMetadata() called on it
      expect(media.cover).toBeDefined();
      expect(media.cover?.metadata).toBeDefined();
    });

    test('should handle base64 cover URLs', () => {
      const media = MultimediaMother.pngImage().build();
      const base64Cover =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      media.withCover(base64Cover);

      expect(media.cover).toBeDefined();
      expect(media.cover?.url).toBe(base64Cover);
      expect(media.cover?.isBase64Image()).toBe(true);
    });

    test('should handle complex cover URLs', () => {
      const media = MultimediaMother.pngImage().build();
      const complexCoverUrl = 'https://example.com/cover/thumb.jpg?size=large&format=webp';

      media.withCover(complexCoverUrl);

      expect(media.cover).toBeDefined();
      expect(media.cover?.url).toBe(complexCoverUrl);
      expect(media.cover?.type).toBe('jpg');
    });

    test('should create cover from builder with cover', () => {
      const media = MultimediaMother.imageWithCover().build();

      expect(media.cover).toBeDefined();
      expect(media.cover?.url).toBe('cover.jpg');
    });

    test('should create video with cover from builder', () => {
      const media = MultimediaMother.videoWithCover().build();

      expect(media.isVideo()).toBe(true);
      expect(media.cover).toBeDefined();
      expect(media.cover?.url).toBe('video-cover.png');
      expect(media.cover?.isImage()).toBe(true);
    });

    test('should create media with base64 cover from builder', () => {
      const media = MultimediaMother.mediaWithBase64Cover().build();

      expect(media.cover).toBeDefined();
      expect(media.cover?.isBase64Image()).toBe(true);
    });

    test('should create media with custom cover from builder', () => {
      const customCoverUrl = 'https://custom.com/cover.webp';
      const media = MultimediaMother.mediaWithCustomCover(customCoverUrl).build();

      expect(media.cover).toBeDefined();
      expect(media.cover?.url).toBe(customCoverUrl);
      expect(media.cover?.type).toBe('webp');
    });

    test('should allow chaining withCover with other methods', () => {
      const media = MultimediaMother.pngImage().build();

      const result = media.withCover('cover1.jpg').withCover('cover2.png');

      expect(result).toBe(media);
      expect(media.cover).toBeDefined();
      expect(media.cover?.url).toBe('cover2.png'); // Should use the last cover set
    });

    test('should handle empty cover URL', () => {
      const media = MultimediaMother.pngImage().build();

      media.withCover('');

      expect(media.cover).toBeDefined();
      expect(media.cover?.url).toBe('');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty URLs gracefully', () => {
      const media = new Multimedia('');
      expect(media.url).toBe('');
      expect(media.type).toBe('');
    });

    test('should handle URLs with only query parameters', () => {
      const media = new Multimedia('?param=value');
      expect(media.url).toBeDefined();
      expect(media.type).toBe('');
    });

    test('should handle URLs with only fragments', () => {
      const media = new Multimedia('#fragment');
      expect(media.url).toBeDefined();
      expect(media.type).toBe('');
    });

    test('should handle special characters in URLs', () => {
      const media = new Multimedia('test%20file.png');
      expect(media.url).toBeDefined();
      expect(media.type).toBe('png');
    });
  });

  describe('Cover Integration Tests', () => {
    test('should work with different media types and covers', () => {
      const video = MultimediaMother.mp4Video().build();
      const image = MultimediaMother.pngImage().build();
      const document = MultimediaMother.pdfDocument().build();

      video.withCover('video-cover.jpg');
      image.withCover('image-cover.png');
      document.withCover('doc-cover.webp');

      expect(video.isVideo()).toBe(true);
      expect(video.cover?.isImage()).toBe(true);

      expect(image.isImage()).toBe(true);
      expect(image.cover?.isImage()).toBe(true);

      expect(document.isDocument()).toBe(true);
      expect(document.cover?.isImage()).toBe(true);
    });

    test('should handle cover with different AWS URL types', () => {
      const media = MultimediaMother.pngImage().build();

      media.withCover('https://socialgest-bucket.s3.amazonaws.com/thumb.jpg');

      expect(media.cover).toBeDefined();
      // Cover is created as a new Multimedia instance from URL
      expect(media.cover?.url).toContain('socialgest-bucket');
    });

    test('should handle cover metadata properties', () => {
      const media = MultimediaMother.pngImage().withDimensions(1920, 1080).build();

      media.withCover('cover.jpg');

      expect(media.width).toBe(1920);
      expect(media.height).toBe(1080);
      expect(media.cover).toBeDefined();
      expect(media.cover?.metadata).toBeDefined();
    });
  });

  describe('Status Property', () => {
    test('should have default status as ok', () => {
      const media = MultimediaMother.pngImage().build();
      expect(media.status).toBe('ok');
    });

    test('should create multimedia with error status', () => {
      const media = MultimediaMother.errorMedia().build();
      expect(media.status).toBe('error');
    });

    test('should create multimedia with loading status', () => {
      const media = MultimediaMother.loadingMedia().build();
      expect(media.status).toBe('loading');
    });

    test('should create multimedia with ok status explicitly', () => {
      const media = MultimediaMother.okMedia().build();
      expect(media.status).toBe('ok');
    });

    test('should work with different media types', () => {
      const errorVideo = MultimediaMother.errorVideo().build();
      const loadingVideo = MultimediaMother.loadingVideo().build();
      const errorDoc = MultimediaMother.errorDocument().build();
      const loadingDoc = MultimediaMother.loadingDocument().build();

      expect(errorVideo.status).toBe('error');
      expect(errorVideo.isVideo()).toBe(true);

      expect(loadingVideo.status).toBe('loading');
      expect(loadingVideo.isVideo()).toBe(true);

      expect(errorDoc.status).toBe('error');
      expect(errorDoc.isDocument()).toBe(true);

      expect(loadingDoc.status).toBe('loading');
      expect(loadingDoc.isDocument()).toBe(true);
    });
  });

  describe('Status Check Methods', () => {
    describe('isError()', () => {
      test('should return true for error status', () => {
        const media = MultimediaMother.errorMedia().build();
        expect(media.isError()).toBe(true);
        expect(media.isOk()).toBe(false);
        expect(media.isLoading()).toBe(false);
      });

      test('should return false for non-error status', () => {
        const ok = MultimediaMother.okMedia().build();
        const loading = MultimediaMother.loadingMedia().build();

        expect(ok.isError()).toBe(false);
        expect(loading.isError()).toBe(false);
      });
    });

    describe('isOk()', () => {
      test('should return true for ok status', () => {
        const media = MultimediaMother.okMedia().build();
        expect(media.isOk()).toBe(true);
        expect(media.isError()).toBe(false);
        expect(media.isLoading()).toBe(false);
      });

      test('should return true for default status', () => {
        const media = MultimediaMother.pngImage().build();
        expect(media.isOk()).toBe(true);
      });

      test('should return false for non-ok status', () => {
        const error = MultimediaMother.errorMedia().build();
        const loading = MultimediaMother.loadingMedia().build();

        expect(error.isOk()).toBe(false);
        expect(loading.isOk()).toBe(false);
      });
    });

    describe('isLoading()', () => {
      test('should return true for loading status', () => {
        const media = MultimediaMother.loadingMedia().build();
        expect(media.isLoading()).toBe(true);
        expect(media.isError()).toBe(false);
        expect(media.isOk()).toBe(false);
      });

      test('should return false for non-loading status', () => {
        const ok = MultimediaMother.okMedia().build();
        const error = MultimediaMother.errorMedia().build();

        expect(ok.isLoading()).toBe(false);
        expect(error.isLoading()).toBe(false);
      });
    });
  });

  describe('Status Mutation Methods - to()', () => {
    test('should change status to error', () => {
      const media = MultimediaMother.pngImage().build();
      expect(media.status).toBe('ok');

      media.to.error();
      expect(media.status).toBe('error');
      expect(media.isError()).toBe(true);
    });

    test('should change status to loading', () => {
      const media = MultimediaMother.pngImage().build();
      expect(media.status).toBe('ok');

      media.to.loading();
      expect(media.status).toBe('loading');
      expect(media.isLoading()).toBe(true);
    });

    test('should change status to ok', () => {
      const media = MultimediaMother.errorMedia().build();
      expect(media.status).toBe('error');

      media.to.ok();
      expect(media.status).toBe('ok');
      expect(media.isOk()).toBe(true);
    });

    test('should allow status transitions between all states', () => {
      const media = MultimediaMother.pngImage().build();

      // ok -> loading
      media.to.loading();
      expect(media.status).toBe('loading');

      // loading -> error
      media.to.error();
      expect(media.status).toBe('error');

      // error -> ok
      media.to.ok();
      expect(media.status).toBe('ok');

      // ok -> error
      media.to.error();
      expect(media.status).toBe('error');

      // error -> loading
      media.to.loading();
      expect(media.status).toBe('loading');

      // loading -> ok
      media.to.ok();
      expect(media.status).toBe('ok');
    });

    test('should work with different media types', () => {
      const video = MultimediaMother.mp4Video().build();
      const document = MultimediaMother.pdfDocument().build();
      const image = MultimediaMother.pngImage().build();

      video.to.error();
      document.to.loading();
      image.to.ok();

      expect(video.isError()).toBe(true);
      expect(document.isLoading()).toBe(true);
      expect(image.isOk()).toBe(true);
    });

    test('should maintain media properties after status change', () => {
      const media = MultimediaMother.pngImage().withDimensions(1920, 1080).build();

      expect(media.width).toBe(1920);
      expect(media.height).toBe(1080);

      media.to.error();
      expect(media.isError()).toBe(true);
      expect(media.width).toBe(1920);
      expect(media.height).toBe(1080);

      media.to.loading();
      expect(media.isLoading()).toBe(true);
      expect(media.width).toBe(1920);
      expect(media.height).toBe(1080);
    });
  });

  describe('Status Integration Tests', () => {
    test('should handle status with cover', () => {
      const media = MultimediaMother.errorMedia().build();
      media.withCover('cover.jpg');

      expect(media.isError()).toBe(true);
      expect(media.cover).toBeDefined();
      expect(media.cover?.isOk()).toBe(true); // Cover has default ok status
    });

    test('should handle status changes with metadata', () => {
      const media = MultimediaMother.pngImage().withDimensions(1920, 1080).withSize(5242880).build();

      expect(media.isOk()).toBe(true);
      expect(media.width).toBe(1920);
      // Size is stored in MB internally (5242880 bytes = 5MB)
      expect(media.size).toBeGreaterThan(0);

      media.to.loading();
      expect(media.isLoading()).toBe(true);
      expect(media.width).toBe(1920);
      expect(media.size).toBeGreaterThan(0);
    });

    test('should work with AWS URLs and status', () => {
      const temporal = MultimediaMother.temporalFile().asError().build();
      const bucket = MultimediaMother.bucketFile().asLoading().build();
      const prod = MultimediaMother.productionFile().asOk().build();

      expect(temporal.url).toContain('socialgest-temporal');
      expect(temporal.isError()).toBe(true);

      expect(bucket.url).toContain('socialgest-bucket');
      expect(bucket.isLoading()).toBe(true);

      expect(prod.url).toContain('socialgest-prod');
      expect(prod.isOk()).toBe(true);
    });
  });

  describe('Predicate Pattern - ensure()', () => {
    // Helper predicate functions for testing
    const isVideoDurationValid = (maxDuration: number) => (m: Multimedia) => !m.isDurationGreaterThan(maxDuration);

    const isVideoSizeValid = (maxSize: number) => (m: Multimedia) => !m.isSizeGreaterThan(maxSize);

    const isImageDimensionsValid = (minDimension: number) => (m: Multimedia) =>
      !m.isWidthLessThan(minDimension) && !m.isHeightLessThan(minDimension);

    const isVideo = (m: Multimedia) => m.isVideo();

    const isImage = (m: Multimedia) => m.isImage();

    describe('Basic Predicate Application', () => {
      test('should return true when predicate is satisfied', () => {
        const video = MultimediaMother.hdVideo().build();

        const result = video.ensure(isVideoDurationValid(200)); // 200s max, video has 120s

        expect(result).toBe(true);
        expect(video.isOk()).toBe(true);
        expect(video.isError()).toBe(false);
      });

      test('should return false when predicate is not satisfied', () => {
        const video = MultimediaMother.hdVideo().build(); // 120s duration

        const result = video.ensure(isVideoDurationValid(60)); // 60s max

        expect(result).toBe(false);
        expect(video.isError()).toBe(true);
        expect(video.isOk()).toBe(false);
      });

      test('should work with size predicates', () => {
        const largeVideo = MultimediaMother.hdVideo()
          .withSize(150 * 1024 * 1024)
          .build(); // 150MB

        const result = largeVideo.ensure(isVideoSizeValid(100)); // 100MB max

        expect(result).toBe(false);
        expect(largeVideo.isError()).toBe(true);
      });

      test('should work with dimension predicates', () => {
        const smallImage = MultimediaMother.smallImage().build(); // 200x150

        const result = smallImage.ensure(isImageDimensionsValid(320)); // 320px min

        expect(result).toBe(false);
        expect(smallImage.isError()).toBe(true);
      });
    });

    describe('Type-based Predicates', () => {
      test('should return true for video with video type predicate', () => {
        const video = MultimediaMother.mp4Video().build();

        const result = video.ensure(isVideo);

        expect(result).toBe(true);
        expect(video.isOk()).toBe(true);
      });

      test('should return false for image with video type predicate', () => {
        const image = MultimediaMother.pngImage().build();

        const result = image.ensure(isVideo);

        expect(result).toBe(false);
        expect(image.isError()).toBe(true);
      });

      test('should return true for image with image type predicate', () => {
        const image = MultimediaMother.pngImage().build();

        const result = image.ensure(isImage);

        expect(result).toBe(true);
        expect(image.isOk()).toBe(true);
      });

      test('should return false for video with image type predicate', () => {
        const video = MultimediaMother.mp4Video().build();

        const result = video.ensure(isImage);

        expect(result).toBe(false);
        expect(video.isError()).toBe(true);
      });
    });

    describe('Status Transitions with ensure()', () => {
      test('should change from error to ok when predicate passes', () => {
        const video = MultimediaMother.errorVideo().build();
        expect(video.isError()).toBe(true);

        const result = video.ensure(isVideoDurationValid(200));

        expect(result).toBe(true);
        expect(video.isOk()).toBe(true);
        expect(video.isError()).toBe(false);
      });

      test('should change from ok to error when predicate fails', () => {
        const video = MultimediaMother.hdVideo().build(); // Has 120s duration
        video.to.ok(); // Ensure it starts as ok
        expect(video.isOk()).toBe(true);

        const result = video.ensure(isVideoDurationValid(60)); // 60s max, video has 120s - will fail

        expect(result).toBe(false);
        expect(video.isError()).toBe(true);
        expect(video.isOk()).toBe(false);
      });

      test('should change from loading to ok when predicate passes', () => {
        const video = MultimediaMother.loadingVideo().build();
        expect(video.isLoading()).toBe(true);

        const result = video.ensure(isVideo);

        expect(result).toBe(true);
        expect(video.isOk()).toBe(true);
        expect(video.isLoading()).toBe(false);
      });

      test('should change from loading to error when predicate fails', () => {
        const video = MultimediaMother.loadingVideo().build();
        expect(video.isLoading()).toBe(true);

        const result = video.ensure(isImage); // Video doesn't satisfy image predicate

        expect(result).toBe(false);
        expect(video.isError()).toBe(true);
        expect(video.isLoading()).toBe(false);
      });
    });

    describe('Multiple Predicates', () => {
      test('should apply multiple predicates sequentially', () => {
        const video = MultimediaMother.hdVideo().build();

        const result1 = video.ensure(isVideoDurationValid(200));
        expect(result1).toBe(true);
        expect(video.isOk()).toBe(true);

        const result2 = video.ensure(isVideoSizeValid(200));
        expect(result2).toBe(true);
        expect(video.isOk()).toBe(true);
      });

      test('should fail on first failing predicate', () => {
        const video = MultimediaMother.hdVideo()
          .withSize(150 * 1024 * 1024)
          .build();

        const result1 = video.ensure(isVideoDurationValid(200));
        expect(result1).toBe(true);
        expect(video.isOk()).toBe(true);

        const result2 = video.ensure(isVideoSizeValid(100)); // Will fail
        expect(result2).toBe(false);
        expect(video.isError()).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      test('should work with documents', () => {
        const document = MultimediaMother.pdfDocument().build();

        const result = document.ensure(isImage);

        expect(result).toBe(false);
        expect(document.isError()).toBe(true);
      });

      test('should work with GIFs', () => {
        const gif = MultimediaMother.gifImage().build();

        const result = gif.ensure(isImage);

        expect(result).toBe(true);
        expect(gif.isOk()).toBe(true); // GIFs are images
      });

      test('should preserve other properties after applying predicate', () => {
        const video = MultimediaMother.hdVideo().withDimensions(1920, 1080).build();

        const result = video.ensure(isVideo);

        expect(result).toBe(true);
        expect(video.width).toBe(1920);
        expect(video.height).toBe(1080);
        expect(video.isOk()).toBe(true);
      });

      test('should work with base64 multimedia', () => {
        const base64Image = MultimediaMother.base64Image().build();

        const result = base64Image.ensure(isImage);

        expect(result).toBe(true);
        expect(base64Image.isOk()).toBe(true);
      });
    });

    describe('Integration with Metadata', () => {
      test('should apply predicate based on metadata values', () => {
        const video = MultimediaMother.mp4Video()
          .withDimensions(1920, 1080)
          .withDuration(150)
          .withSize(120 * 1024 * 1024)
          .build();

        const result1 = video.ensure(isVideoDurationValid(200));
        expect(result1).toBe(true);
        expect(video.isOk()).toBe(true);

        const result2 = video.ensure(isVideoSizeValid(100));
        expect(result2).toBe(false);
        expect(video.isError()).toBe(true); // Size exceeds limit
      });
    });
  });

  describe('ensureAsError() Method', () => {
    // Helper predicate functions for testing
    const isVideoDurationValid = (maxDuration: number) => (m: Multimedia) => !m.isDurationGreaterThan(maxDuration);
    const isVideoSizeValid = (maxSize: number) => (m: Multimedia) => !m.isSizeGreaterThan(maxSize);
    const isImageDimensionsValid = (minDimension: number) => (m: Multimedia) =>
      !m.isWidthLessThan(minDimension) && !m.isHeightLessThan(minDimension);
    const isVideo = (m: Multimedia) => m.isVideo();
    const isImage = (m: Multimedia) => m.isImage();

    describe('Basic Functionality', () => {
      test('should ensure as error when predicate fails', () => {
        const video = MultimediaMother.hdVideo().build(); // 120s duration
        expect(video.isOk()).toBe(true); // Default status

        const result = video.ensureAsError(isVideoDurationValid(60)); // 60s max, video has 120s

        expect(result).toBe(false);
        expect(video.isError()).toBe(true);
        expect(video.isOk()).toBe(false);
      });

      test('should preserve current status when predicate passes', () => {
        const video = MultimediaMother.hdVideo().build(); // 120s duration
        expect(video.isOk()).toBe(true); // Default status

        const result = video.ensureAsError(isVideoDurationValid(200)); // 200s max, video has 120s

        expect(result).toBe(true);
        expect(video.isOk()).toBe(true); // Status preserved
        expect(video.isError()).toBe(false);
      });

      test('should preserve error status when predicate passes', () => {
        const video = MultimediaMother.errorVideo().build();
        expect(video.isError()).toBe(true); // Already in error

        const result = video.ensureAsError(isVideoDurationValid(200)); // Predicate passes

        expect(result).toBe(true); // Returns true because predicate passes
        expect(video.isError()).toBe(true); // Error status preserved
        expect(video.isOk()).toBe(false);
      });

      test('should ensure as error when already in error and predicate fails', () => {
        const video = MultimediaMother.errorVideo().withDuration(70).build();
        expect(video.isError()).toBe(true);

        const result = video.ensureAsError(isVideoDurationValid(60)); // Predicate fails

        expect(result).toBe(false); // Returns false because predicate fails
        expect(video.isError()).toBe(true); // Still in error
      });
    });

    describe('Status Preservation', () => {
      test('should not change ok status to ok when predicate passes', () => {
        const image = MultimediaMother.largeImage().build(); // 4000x3000
        expect(image.isOk()).toBe(true);

        const result = image.ensureAsError(isImageDimensionsValid(320)); // Passes

        expect(result).toBe(true);
        expect(image.isOk()).toBe(true); // Status unchanged
      });

      test('should not change loading status when predicate passes', () => {
        const video = MultimediaMother.loadingVideo().build();
        expect(video.isLoading()).toBe(true);

        const result = video.ensureAsError(isVideo); // Passes

        expect(result).toBe(true); // Returns true because predicate passes
        expect(video.isLoading()).toBe(true); // Status preserved
        expect(video.isError()).toBe(false);
        expect(video.isOk()).toBe(false);
      });

      test('should change loading status to error when predicate fails', () => {
        const video = MultimediaMother.loadingVideo().build();
        expect(video.isLoading()).toBe(true);

        const result = video.ensureAsError(isImage); // Fails (video is not image)

        expect(result).toBe(false);
        expect(video.isError()).toBe(true); // Changed to error
        expect(video.isLoading()).toBe(false);
      });
    });

    describe('Different Media Types', () => {
      test('should work with video validations', () => {
        const shortVideo = MultimediaMother.shortVideo().build(); // 15s
        const longVideo = MultimediaMother.hdVideo().build(); // 120s

        const result1 = shortVideo.ensureAsError(isVideoDurationValid(60));
        const result2 = longVideo.ensureAsError(isVideoDurationValid(60));

        expect(result1).toBe(true); // Short video passes
        expect(shortVideo.isOk()).toBe(true);

        expect(result2).toBe(false); // Long video fails
        expect(longVideo.isError()).toBe(true);
      });

      test('should work with image validations', () => {
        const smallImage = MultimediaMother.smallImage().build(); // 200x150
        const largeImage = MultimediaMother.largeImage().build(); // 4000x3000

        const result1 = smallImage.ensureAsError(isImageDimensionsValid(320));
        const result2 = largeImage.ensureAsError(isImageDimensionsValid(320));

        expect(result1).toBe(false); // Small image fails
        expect(smallImage.isError()).toBe(true);

        expect(result2).toBe(true); // Large image passes
        expect(largeImage.isOk()).toBe(true);
      });

      test('should work with type validations', () => {
        const video = MultimediaMother.mp4Video().build();
        const image = MultimediaMother.pngImage().build();

        const result1 = video.ensureAsError(isVideo);
        const result2 = image.ensureAsError(isVideo);

        expect(result1).toBe(true); // Video passes video check
        expect(video.isOk()).toBe(true);

        expect(result2).toBe(false); // Image fails video check
        expect(image.isError()).toBe(true);
      });
    });

    describe('Complex Scenarios', () => {
      test('should handle multiple sequential ensureAsError calls', () => {
        const video = MultimediaMother.hdVideo().build(); // 120s, 100MB

        // First validation: duration (fails)
        const result1 = video.ensureAsError(isVideoDurationValid(60));
        expect(result1).toBe(false);
        expect(video.isError()).toBe(true);

        // Second validation: size (would pass, but status preserved)
        const result2 = video.ensureAsError(isVideoSizeValid(200));
        expect(result2).toBe(true); // Returns true because predicate passes
        expect(video.isError()).toBe(true); // Error preserved
      });

      test('should work with size validations', () => {
        const smallVideo = MultimediaMother.shortVideo().build(); // 10MB
        const largeVideo = MultimediaMother.hdVideo()
          .withSize(150 * 1024 * 1024)
          .build(); // 150MB

        const result1 = smallVideo.ensureAsError(isVideoSizeValid(100));
        const result2 = largeVideo.ensureAsError(isVideoSizeValid(100));

        expect(result1).toBe(true); // Small video passes
        expect(smallVideo.isOk()).toBe(true);

        expect(result2).toBe(false); // Large video fails
        expect(largeVideo.isError()).toBe(true);
      });

      test('should preserve multimedia properties after ensuring as invalid', () => {
        const video = MultimediaMother.hdVideo().withDimensions(1920, 1080).build();

        video.ensureAsError(isVideoDurationValid(60)); // Fails

        expect(video.width).toBe(1920);
        expect(video.height).toBe(1080);
        expect(video.isError()).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      test('should work with base64 multimedia', () => {
        const base64Image = MultimediaMother.base64Image().build();

        const result = base64Image.ensureAsError(isImage);

        expect(result).toBe(true);
        expect(base64Image.isOk()).toBe(true);
      });

      test('should work with different file types', () => {
        const gif = MultimediaMother.gifImage().build();
        const document = MultimediaMother.pdfDocument().build();

        const result1 = gif.ensureAsError(isImage);
        const result2 = document.ensureAsError(isImage);

        expect(result1).toBe(true); // GIF is image
        expect(gif.isOk()).toBe(true);

        expect(result2).toBe(false); // Document is not image
        expect(document.isError()).toBe(true);
      });

      test('should handle AWS URLs', () => {
        const temporal = MultimediaMother.temporalFile().build();
        const bucket = MultimediaMother.bucketFile().build();

        const result1 = temporal.ensureAsError(isImage);
        const result2 = bucket.ensureAsError(isVideo);

        // Results depend on the actual file types
        expect(typeof result1).toBe('boolean');
        expect(typeof result2).toBe('boolean');
      });
    });
  });
});
