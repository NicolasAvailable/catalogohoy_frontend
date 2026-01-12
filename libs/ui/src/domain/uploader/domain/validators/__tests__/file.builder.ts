/**
 * Object Mother pattern for creating File instances in tests
 * Provides a fluent API for building files with sensible defaults
 */
export class FileBuilder {
  private sizeInBytes: number = 1024 * 1024; // 1MB default
  private fileName: string = 'test.jpg';
  private mimeType: string = 'image/jpeg';

  public static create(): FileBuilder {
    return new FileBuilder();
  }

  public withSize(sizeInBytes: number): FileBuilder {
    this.sizeInBytes = sizeInBytes;
    return this;
  }

  public withSizeInMB(sizeInMB: number): FileBuilder {
    this.sizeInBytes = sizeInMB * 1024 * 1024;
    return this;
  }

  public withName(fileName: string): FileBuilder {
    this.fileName = fileName;
    return this;
  }

  public withMimeType(mimeType: string): FileBuilder {
    this.mimeType = mimeType;
    return this;
  }

  // Convenience methods for common file types
  public asJpeg(): FileBuilder {
    return this.withMimeType('image/jpeg').withName('test.jpg');
  }

  public asPng(): FileBuilder {
    return this.withMimeType('image/png').withName('test.png');
  }

  public asPdf(): FileBuilder {
    return this.withMimeType('application/pdf').withName('test.pdf');
  }

  public asEmpty(): FileBuilder {
    return this.withSize(0);
  }

  public asSmall(): FileBuilder {
    return this.withSizeInMB(0.5); // 500KB
  }

  public asLarge(): FileBuilder {
    return this.withSizeInMB(5); // 5MB
  }

  public build(): File {
    const blob = new Blob(['a'.repeat(this.sizeInBytes)], { type: this.mimeType });
    return new File([blob], this.fileName, { type: this.mimeType });
  }
}

/**
 * Pre-configured file builders for common test scenarios
 */
export class FileMother {
  public static smallImage(): FileBuilder {
    return FileBuilder.create().asJpeg().asSmall();
  }

  public static largeImage(): FileBuilder {
    return FileBuilder.create().asJpeg().asLarge();
  }

  public static emptyFile(): FileBuilder {
    return FileBuilder.create().asEmpty();
  }

  public static exactSize(sizeInMB: number): FileBuilder {
    return FileBuilder.create().withSizeInMB(sizeInMB);
  }

  public static pdfDocument(): FileBuilder {
    return FileBuilder.create().asPdf().withSizeInMB(2);
  }
}
