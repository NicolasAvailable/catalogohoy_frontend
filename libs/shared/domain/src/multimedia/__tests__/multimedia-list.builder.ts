import { MultimediaList } from '../multimedia-list';
import { Multimedia } from '../multimedia';
import { MultimediaMother } from './multimedia.mother';

export class MultimediaListBuilder {
  private multimediaItems: Multimedia[] = [];

  public withMultimedia(multimedia: Multimedia[]): MultimediaListBuilder {
    this.multimediaItems = [...multimedia];
    return this;
  }

  public withSingleMultimedia(multimedia: Multimedia): MultimediaListBuilder {
    this.multimediaItems = [multimedia];
    return this;
  }

  public addMultimedia(multimedia: Multimedia): MultimediaListBuilder {
    this.multimediaItems.push(multimedia);
    return this;
  }

  public withUrls(urls: string[]): MultimediaListBuilder {
    this.multimediaItems = urls.map((url) => Multimedia.from(url));
    return this;
  }

  public withSingleUrl(url: string): MultimediaListBuilder {
    this.multimediaItems = [Multimedia.from(url)];
    return this;
  }

  // Type-specific builders
  public withImages(count = 3): MultimediaListBuilder {
    const images = [
      MultimediaMother.pngImage().build(),
      MultimediaMother.jpgImage().build(),
      MultimediaMother.webpImage().build(),
    ].slice(0, count);
    this.multimediaItems = images;
    return this;
  }

  public withVideos(count = 2): MultimediaListBuilder {
    const videos = [MultimediaMother.mp4Video().build(), MultimediaMother.movVideo().build()].slice(0, count);
    this.multimediaItems = videos;
    return this;
  }

  public withGifs(count = 2): MultimediaListBuilder {
    const gifs = [MultimediaMother.gifImage().build(), MultimediaMother.giphyGif().build()].slice(0, count);
    this.multimediaItems = gifs;
    return this;
  }

  public withDocuments(count = 3): MultimediaListBuilder {
    const documents = [
      MultimediaMother.pdfDocument().build(),
      MultimediaMother.docxDocument().build(),
      MultimediaMother.xlsxDocument().build(),
    ].slice(0, count);
    this.multimediaItems = documents;
    return this;
  }

  // Mixed content builders
  public withMixedContent(): MultimediaListBuilder {
    this.multimediaItems = [
      MultimediaMother.pngImage().build(),
      MultimediaMother.mp4Video().build(),
      MultimediaMother.gifImage().build(),
      MultimediaMother.pdfDocument().build(),
    ];
    return this;
  }

  public withImageAndVideo(): MultimediaListBuilder {
    this.multimediaItems = [MultimediaMother.pngImage().build(), MultimediaMother.mp4Video().build()];
    return this;
  }

  public withCarousel(count = 5): MultimediaListBuilder {
    const items = [];
    for (let i = 0; i < count; i++) {
      items.push(MultimediaMother.pngImage().withUrl(`image-${i}.png`).build());
    }
    this.multimediaItems = items;
    return this;
  }

  // Size-based builders
  public withLargeFiles(): MultimediaListBuilder {
    this.multimediaItems = [
      MultimediaMother.largeImage().build(), // 5MB
      MultimediaMother.hdVideo().build(), // 100MB
    ];
    return this;
  }

  public withSmallFiles(): MultimediaListBuilder {
    this.multimediaItems = [
      MultimediaMother.smallImage().build(), // 50KB
      MultimediaMother.shortVideo().build(), // 10MB
    ];
    return this;
  }

  public withSpecificTotalSize(targetSize: number): MultimediaListBuilder {
    // Create files that sum to approximately the target size
    const fileSize = Math.floor(targetSize / 3);
    this.multimediaItems = [
      MultimediaMother.pngImage().withSize(fileSize).build(),
      MultimediaMother.mp4Video().withSize(fileSize).build(),
      MultimediaMother.pdfDocument().withSize(fileSize).build(),
    ];
    return this;
  }

  // Duration-based builders
  public withLongVideos(): MultimediaListBuilder {
    this.multimediaItems = [
      MultimediaMother.mp4Video().withDuration(1800).build(), // 30 minutes
      MultimediaMother.movVideo().withDuration(3600).build(), // 1 hour
    ];
    return this;
  }

  public withShortVideos(): MultimediaListBuilder {
    this.multimediaItems = [
      MultimediaMother.mp4Video().withDuration(15).build(), // 15 seconds
      MultimediaMother.movVideo().withDuration(30).build(), // 30 seconds
    ];
    return this;
  }

  // Special cases
  public withDuplicateUrls(): MultimediaListBuilder {
    const duplicateUrl = 'duplicate.png';
    this.multimediaItems = [
      MultimediaMother.pngImage().withUrl(duplicateUrl).build(),
      MultimediaMother.pngImage().withUrl(duplicateUrl).build(),
      MultimediaMother.jpgImage().build(),
    ];
    return this;
  }

  public withSelectedItems(): MultimediaListBuilder {
    this.multimediaItems = [MultimediaMother.pngImage().build(), MultimediaMother.mp4Video().build()];
    // Select all items after building
    this.multimediaItems.forEach((item) => item.select());
    return this;
  }

  public withPartiallySelected(): MultimediaListBuilder {
    this.multimediaItems = [
      MultimediaMother.pngImage().build(),
      MultimediaMother.mp4Video().build(),
      MultimediaMother.gifImage().build(),
    ];
    // Select only first item
    this.multimediaItems[0].select();
    return this;
  }

  // Platform-specific builders
  public withLinkedinContent(): MultimediaListBuilder {
    this.multimediaItems = [
      MultimediaMother.linkedinImage().build(),
      MultimediaMother.linkedinVideo().build(),
      MultimediaMother.linkedinPDF().build(),
    ];
    return this;
  }

  public withInstagramContent(): MultimediaListBuilder {
    this.multimediaItems = [
      MultimediaMother.instagramImage().build(),
      MultimediaMother.mp4Video().withDimensions(1080, 1080).build(), // Square video
    ];
    return this;
  }

  public withBase64Content(): MultimediaListBuilder {
    this.multimediaItems = [MultimediaMother.base64Image().build(), MultimediaMother.base64Video().build()];
    return this;
  }

  // Empty and edge cases
  public empty(): MultimediaListBuilder {
    this.multimediaItems = [];
    return this;
  }

  public withSingleItem(): MultimediaListBuilder {
    this.multimediaItems = [MultimediaMother.pngImage().build()];
    return this;
  }

  public build(): MultimediaList {
    return new MultimediaList(this.multimediaItems);
  }
}
