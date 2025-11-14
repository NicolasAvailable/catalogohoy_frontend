import { MultimediaListBuilder } from './multimedia-list.builder';

export class MultimediaListMother {
  // Empty and basic scenarios
  public static empty(): MultimediaListBuilder {
    return new MultimediaListBuilder().empty();
  }

  public static singleImage(): MultimediaListBuilder {
    return new MultimediaListBuilder().withImages(1);
  }

  public static singleVideo(): MultimediaListBuilder {
    return new MultimediaListBuilder().withVideos(1);
  }

  public static singleDocument(): MultimediaListBuilder {
    return new MultimediaListBuilder().withDocuments(1);
  }

  public static singleGif(): MultimediaListBuilder {
    return new MultimediaListBuilder().withGifs(1);
  }

  // Type-specific collections
  public static imagesOnly(): MultimediaListBuilder {
    return new MultimediaListBuilder().withImages(3);
  }

  public static videosOnly(): MultimediaListBuilder {
    return new MultimediaListBuilder().withVideos(2);
  }

  public static documentsOnly(): MultimediaListBuilder {
    return new MultimediaListBuilder().withDocuments(3);
  }

  public static gifsOnly(): MultimediaListBuilder {
    return new MultimediaListBuilder().withGifs(2);
  }

  // Mixed content scenarios
  public static mixedContent(): MultimediaListBuilder {
    return new MultimediaListBuilder().withMixedContent();
  }

  public static imageAndVideo(): MultimediaListBuilder {
    return new MultimediaListBuilder().withImageAndVideo();
  }

  public static carousel(): MultimediaListBuilder {
    return new MultimediaListBuilder().withCarousel(5);
  }

  public static largeCarousel(): MultimediaListBuilder {
    return new MultimediaListBuilder().withCarousel(10);
  }

  // Size-based scenarios
  public static largeFiles(): MultimediaListBuilder {
    return new MultimediaListBuilder().withLargeFiles();
  }

  public static smallFiles(): MultimediaListBuilder {
    return new MultimediaListBuilder().withSmallFiles();
  }

  public static oversizedContent(): MultimediaListBuilder {
    return new MultimediaListBuilder().withSpecificTotalSize(1000000000); // 1GB
  }

  public static moderateSize(): MultimediaListBuilder {
    return new MultimediaListBuilder().withSpecificTotalSize(50000000); // 50MB
  }

  // Duration-based scenarios
  public static longVideos(): MultimediaListBuilder {
    return new MultimediaListBuilder().withLongVideos();
  }

  public static shortVideos(): MultimediaListBuilder {
    return new MultimediaListBuilder().withShortVideos();
  }

  // Selection state scenarios
  public static allSelected(): MultimediaListBuilder {
    return new MultimediaListBuilder().withSelectedItems();
  }

  public static partiallySelected(): MultimediaListBuilder {
    return new MultimediaListBuilder().withPartiallySelected();
  }

  public static noneSelected(): MultimediaListBuilder {
    return new MultimediaListBuilder().withMixedContent(); // Default unselected
  }

  // Platform-specific scenarios
  public static linkedinContent(): MultimediaListBuilder {
    return new MultimediaListBuilder().withLinkedinContent();
  }

  public static instagramContent(): MultimediaListBuilder {
    return new MultimediaListBuilder().withInstagramContent();
  }

  public static base64Content(): MultimediaListBuilder {
    return new MultimediaListBuilder().withBase64Content();
  }

  // Edge cases and special scenarios
  public static duplicateUrls(): MultimediaListBuilder {
    return new MultimediaListBuilder().withDuplicateUrls();
  }

  public static singleItemList(): MultimediaListBuilder {
    return new MultimediaListBuilder().withSingleItem();
  }

  // Search and filtering scenarios
  public static searchableContent(): MultimediaListBuilder {
    return new MultimediaListBuilder().withUrls([
      'https://example.com/search-target.png',
      'https://example.com/other-image.jpg',
      'https://example.com/video.mp4',
    ]);
  }

  // Validation scenarios
  public static validationTestContent(): MultimediaListBuilder {
    return new MultimediaListBuilder()
      .withMixedContent()
      .addMultimedia(new MultimediaListBuilder().withSpecificTotalSize(200000000).build().items[0]); // Add large file
  }

  // Complex scenarios
  public static complexMixedList(): MultimediaListBuilder {
    return new MultimediaListBuilder()
      .withImages(2)
      .addMultimedia(new MultimediaListBuilder().withVideos(1).build().items[0])
      .addMultimedia(new MultimediaListBuilder().withGifs(1).build().items[0])
      .addMultimedia(new MultimediaListBuilder().withDocuments(1).build().items[0]);
  }

  public static socialMediaPost(): MultimediaListBuilder {
    return new MultimediaListBuilder()
      .withImages(3)
      .addMultimedia(new MultimediaListBuilder().withShortVideos().build().items[0]);
  }

  public static documentPackage(): MultimediaListBuilder {
    return new MultimediaListBuilder().withDocuments(5);
  }

  public static mediaGallery(): MultimediaListBuilder {
    return new MultimediaListBuilder()
      .withImages(5)
      .addMultimedia(new MultimediaListBuilder().withVideos(2).build().items[0])
      .addMultimedia(new MultimediaListBuilder().withVideos(2).build().items[1]);
  }

  // Factory method for custom builder
  public static builder(): MultimediaListBuilder {
    return new MultimediaListBuilder();
  }
}
