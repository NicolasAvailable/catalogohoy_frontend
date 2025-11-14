import { MultimediaList } from '../multimedia-list';
import { Multimedia } from '../multimedia';
import { MultimediaListMother } from './multimedia-list.mother';
import { MultimediaMother } from './multimedia.mother';

describe('MultimediaList', () => {
  describe('Static factory methods', () => {
    describe('empty()', () => {
      it('should create an empty multimedia list', () => {
        const list = MultimediaList.empty();

        expect(list).toBeInstanceOf(MultimediaList);
        expect(list.isEmpty).toBe(true);
        expect(list.length).toBe(0);
        expect(list.items).toEqual([]);
      });
    });

    describe('primitives()', () => {
      it('should create multimedia list from URL array', () => {
        const urls = ['image1.png', 'video1.mp4', 'document.pdf'];
        const list = MultimediaList.primitives(urls);

        expect(list).toBeInstanceOf(MultimediaList);
        expect(list.length).toBe(3);
        expect(list.items[0]).toBeInstanceOf(Multimedia);
        expect(list.items[0].url).toBe('image1.png');
        expect(list.items[1].url).toBe('video1.mp4');
        expect(list.items[2].url).toBe('document.pdf');
      });

      it('should create multimedia with metadata', () => {
        const urls = ['test.png'];
        const list = MultimediaList.primitives(urls);

        // The loadMetadata() method should be called on each multimedia
        expect(list.items[0].url).toBe('test.png');
      });

      it('should handle empty URL array', () => {
        const list = MultimediaList.primitives([]);

        expect(list.isEmpty).toBe(true);
        expect(list.length).toBe(0);
      });
    });
  });

  describe('Basic properties', () => {
    describe('constructor', () => {
      it('should create multimedia list with provided items', () => {
        const multimedia = [MultimediaMother.pngImage().build(), MultimediaMother.mp4Video().build()];
        const list = new MultimediaList(multimedia);

        expect(list.items).toEqual(multimedia);
        expect(list.length).toBe(2);
      });
    });

    describe('inherited properties from EntityList', () => {
      it('should have correct length', () => {
        const list = MultimediaListMother.mixedContent().build();
        expect(list.length).toBe(4);
      });

      it('should identify empty state', () => {
        const emptyList = MultimediaListMother.empty().build();
        const nonEmptyList = MultimediaListMother.singleImage().build();

        expect(emptyList.isEmpty).toBe(true);
        expect(nonEmptyList.isEmpty).toBe(false);
      });

      it('should return first item', () => {
        const list = MultimediaListMother.mixedContent().build();
        const firstItem = list.first;

        expect(firstItem).toBeInstanceOf(Multimedia);
        expect(firstItem).toBe(list.items[0]);
      });

      it('should return item IDs', () => {
        const list = MultimediaListMother.imageAndVideo().build();
        const ids = list.ids;

        expect(ids).toHaveLength(2);
        expect(ids[0]).toBe(list.items[0].getId());
        expect(ids[1]).toBe(list.items[1].getId());
      });
    });
  });

  describe('Type filtering properties', () => {
    describe('images', () => {
      it('should return only image multimedia', () => {
        const list = MultimediaListMother.mixedContent().build();
        const images = list.images;

        expect(images).toBeInstanceOf(MultimediaList);
        expect(images.length).toBe(2); // PNG image + GIF image
        expect(images.items.every((item) => item.isImage())).toBe(true);
      });

      it('should return empty list when no images', () => {
        const list = MultimediaListMother.videosOnly().build();
        const images = list.images;

        expect(images.isEmpty).toBe(true);
      });
    });

    describe('videos', () => {
      it('should return only video multimedia', () => {
        const list = MultimediaListMother.mixedContent().build();
        const videos = list.videos;

        expect(videos).toBeInstanceOf(MultimediaList);
        expect(videos.length).toBe(1);
        expect(videos.items.every((item) => item.isVideo())).toBe(true);
      });

      it('should return empty list when no videos', () => {
        const list = MultimediaListMother.imagesOnly().build();
        const videos = list.videos;

        expect(videos.isEmpty).toBe(true);
      });
    });

    describe('gifs', () => {
      it('should return only GIF multimedia', () => {
        const list = MultimediaListMother.mixedContent().build();
        const gifs = list.gifs;

        expect(gifs).toBeInstanceOf(MultimediaList);
        expect(gifs.length).toBe(1);
        expect(gifs.items.every((item) => item.isGif())).toBe(true);
      });

      it('should return empty list when no GIFs', () => {
        const list = MultimediaListMother.videosOnly().build();
        const gifs = list.gifs;

        expect(gifs.isEmpty).toBe(true);
      });
    });

    describe('documents', () => {
      it('should return only document multimedia', () => {
        const list = MultimediaListMother.mixedContent().build();
        const documents = list.documents;

        expect(documents).toBeInstanceOf(MultimediaList);
        expect(documents.length).toBe(1);
        expect(documents.items.every((item) => item.isDocument())).toBe(true);
      });

      it('should return empty list when no documents', () => {
        const list = MultimediaListMother.imagesOnly().build();
        const documents = list.documents;

        expect(documents.isEmpty).toBe(true);
      });
    });
  });

  describe('Type checking - has property', () => {
    describe('has.all', () => {
      it('should detect when all items are images', () => {
        const list = MultimediaListMother.imagesOnly().build();
        expect(list.has.all.image).toBe(true);
        expect(list.has.all.video).toBe(false);
        expect(list.has.all.gif).toBe(false);
        expect(list.has.all.document).toBe(false);
        expect(list.has.all.pdf).toBe(false);
      });

      it('should detect when all items are videos', () => {
        const list = MultimediaListMother.videosOnly().build();
        expect(list.has.all.video).toBe(true);
        expect(list.has.all.image).toBe(false);
      });

      it('should detect when all items are documents', () => {
        const list = MultimediaListMother.documentsOnly().build();
        expect(list.has.all.document).toBe(true);
        expect(list.has.all.image).toBe(false);
      });

      it('should return false for mixed content', () => {
        const list = MultimediaListMother.mixedContent().build();
        expect(list.has.all.image).toBe(false);
        expect(list.has.all.video).toBe(false);
        expect(list.has.all.document).toBe(false);
        expect(list.has.all.gif).toBe(false);
      });
    });

    describe('has.some', () => {
      it('should detect when some items are of specific type', () => {
        const list = MultimediaListMother.mixedContent().build();
        expect(list.has.some.image).toBe(true);
        expect(list.has.some.video).toBe(true);
        expect(list.has.some.gif).toBe(true);
        expect(list.has.some.document).toBe(true);
      });

      it('should return false when no items of specific type', () => {
        const list = MultimediaListMother.imagesOnly().build();
        expect(list.has.some.video).toBe(false);
        expect(list.has.some.document).toBe(false);
      });

      it('should detect specific multimedia item', () => {
        const targetMultimedia = MultimediaMother.pngImage().build();
        const list = MultimediaListMother.builder()
          .withSingleMultimedia(targetMultimedia)
          .addMultimedia(MultimediaMother.mp4Video().build())
          .build();

        expect(list.has.some.multimedia(targetMultimedia)).toBe(true);
      });
    });

    describe('inherited has properties', () => {
      it('should detect if list has items', () => {
        const emptyList = MultimediaListMother.empty().build();
        const nonEmptyList = MultimediaListMother.singleImage().build();

        expect(emptyList.has.items).toBe(false);
        expect(nonEmptyList.has.items).toBe(true);
      });

      it('should detect selection states', () => {
        const allSelected = MultimediaListMother.allSelected().build();
        const partiallySelected = MultimediaListMother.partiallySelected().build();
        const noneSelected = MultimediaListMother.noneSelected().build();

        expect(allSelected.has.selected.all).toBe(true);
        expect(allSelected.has.selected.some).toBe(true);
        expect(allSelected.has.selected.none).toBe(false);

        expect(partiallySelected.has.selected.all).toBe(false);
        expect(partiallySelected.has.selected.some).toBe(true);
        expect(partiallySelected.has.selected.none).toBe(false);

        expect(noneSelected.has.selected.all).toBe(false);
        expect(noneSelected.has.selected.some).toBe(false);
        expect(noneSelected.has.selected.none).toBe(true);
      });
    });
  });

  describe('Size calculations', () => {
    describe('totalSize', () => {
      it('should calculate total size of all multimedia', () => {
        const multimedia1 = MultimediaMother.pngImage().build();
        const multimedia2 = MultimediaMother.mp4Video().build();
        const multimedia3 = MultimediaMother.pdfDocument().build();

        // Mock the size property directly on the metadata values
        (multimedia1.metadata as { values: Record<string, unknown> }).values['size'] = 1048576; // 1MB in bytes
        (multimedia2.metadata as { values: Record<string, unknown> }).values['size'] = 2097152; // 2MB in bytes
        (multimedia3.metadata as { values: Record<string, unknown> }).values['size'] = 524288; // 0.5MB in bytes

        const list = MultimediaListMother.builder().withMultimedia([multimedia1, multimedia2, multimedia3]).build();

        expect(list.totalSize).toBeCloseTo(3.5, 1); // Total in MB with some tolerance
      });

      it('should return 0 for empty list', () => {
        const list = MultimediaListMother.empty().build();
        expect(list.totalSize).toBe(0);
      });

      it('should handle multimedia without size metadata', () => {
        const list = MultimediaListMother.imagesOnly().build();
        // Should not throw error even if size is undefined
        expect(typeof list.totalSize).toBe('number');
      });
    });
  });

  describe('Search functionality', () => {
    describe('search.url', () => {
      it('should find multimedia by URL extension', () => {
        const list = MultimediaListMother.builder().withUrls(['image.png', 'video.mp4', 'document.pdf']).build();

        // search.url actually searches by file extension/type, not full URL
        const found = list.search.url('png');
        expect(found).toBeDefined();
        if (found) {
          expect(found).toBeInstanceOf(Multimedia);
          expect(found.url).toContain('.png');
        }
      });

      it('should return undefined when URL not found', () => {
        const list = MultimediaListMother.imagesOnly().build();
        const found = list.search.url('nonexistent.png');
        expect(found).toBeUndefined();
      });
    });

    describe('search.multimedia', () => {
      it('should find multimedia by multimedia object', () => {
        const targetMultimedia = MultimediaMother.pngImage().withUrl('target.png').build();
        const list = MultimediaListMother.builder()
          .withSingleMultimedia(targetMultimedia)
          .addMultimedia(MultimediaMother.mp4Video().build())
          .build();

        const found = list.search.multimedia(targetMultimedia);
        expect(found).toBeInstanceOf(Multimedia);
      });

      it('should return undefined when multimedia not found', () => {
        const list = MultimediaListMother.imagesOnly().build();
        const notIncluded = MultimediaMother.mp4Video().build();
        const found = list.search.multimedia(notIncluded);
        expect(found).toBeUndefined();
      });
    });
  });

  describe('Index finding', () => {
    describe('findIndex.multimedia', () => {
      it('should find index of multimedia by URL extension', () => {
        const list = MultimediaListMother.builder().withUrls(['first.jpg', 'target.png', 'third.mp4']).build();

        // findIndex.multimedia uses m.isEqual(multimedia.url) which compares file extension
        // Create a multimedia with 'png' as the URL to match the extension
        const searchMultimedia = { url: 'png' } as Multimedia;
        const index = list.findIndex.multimedia(searchMultimedia);
        expect(index).toBe(1); // Should find the .png file at index 1
      });

      it('should return -1 when multimedia not found', () => {
        const list = MultimediaListMother.imagesOnly().build();
        const notIncluded = MultimediaMother.mp4Video().withUrl('notfound.mp4').build();
        const index = list.findIndex.multimedia(notIncluded);
        expect(index).toBe(-1);
      });
    });
  });

  describe('Last element getters', () => {
    describe('last', () => {
      it('should return last video', () => {
        const list = MultimediaListMother.builder().withVideos(3).build();
        const lastVideo = list.last.video;

        expect(lastVideo).toBeInstanceOf(Multimedia);
        expect(lastVideo.isVideo()).toBe(true);
        expect(lastVideo).toBe(list.videos.items[list.videos.items.length - 1]);
      });

      it('should return last image', () => {
        const list = MultimediaListMother.builder().withImages(3).build();
        const lastImage = list.last.image;

        expect(lastImage).toBeInstanceOf(Multimedia);
        expect(lastImage.isImage()).toBe(true);
        expect(lastImage).toBe(list.images.items[list.images.items.length - 1]);
      });

      it('should return last GIF', () => {
        const list = MultimediaListMother.builder().withGifs(2).build();
        const lastGif = list.last.gif;

        expect(lastGif).toBeInstanceOf(Multimedia);
        expect(lastGif.isGif()).toBe(true);
      });

      it('should return last document', () => {
        const list = MultimediaListMother.builder().withDocuments(3).build();
        const lastDocument = list.last.document;

        expect(lastDocument).toBeInstanceOf(Multimedia);
        expect(lastDocument.isDocument()).toBe(true);
      });

      it('should return last element overall', () => {
        const list = MultimediaListMother.mixedContent().build();
        const lastElement = list.last.element;

        expect(lastElement).toBeInstanceOf(Multimedia);
        expect(lastElement).toBe(list.items[list.items.length - 1]);
      });

      it('should handle empty filtered lists', () => {
        const list = MultimediaListMother.imagesOnly().build();
        const lastVideo = list.last.video;

        expect(lastVideo).toBeUndefined();
      });
    });
  });

  describe('Conditional checks - is property', () => {
    describe('is.carousel', () => {
      it('should return true for multiple items', () => {
        const list = MultimediaListMother.carousel().build();
        expect(list.is.carousel).toBe(true);
      });

      it('should return false for single item', () => {
        const list = MultimediaListMother.singleImage().build();
        expect(list.is.carousel).toBe(false);
      });

      it('should return false for empty list', () => {
        const list = MultimediaListMother.empty().build();
        expect(list.is.carousel).toBe(false);
      });
    });

    describe('is.totalSizeGreaterThan', () => {
      it('should return true when total size exceeds threshold', () => {
        const list = MultimediaListMother.builder()
          .withMultimedia([
            MultimediaMother.largeImage().build(), // 5MB
            MultimediaMother.hdVideo().build(), // 100MB
          ])
          .build();
        expect(list.is.totalSizeGreaterThan(1)).toBe(true); // 1MB threshold
      });

      it('should return false when total size is below threshold', () => {
        const list = MultimediaListMother.smallFiles().build();
        expect(list.is.totalSizeGreaterThan(1000000000)).toBe(false);
      });
    });

    describe('is.durationGreaterThan', () => {
      it('should return true when any video exceeds duration', () => {
        const list = MultimediaListMother.longVideos().build();
        expect(list.is.durationGreaterThan(1000)).toBe(true);
      });

      it('should return false when no video exceeds duration', () => {
        const list = MultimediaListMother.shortVideos().build();
        expect(list.is.durationGreaterThan(10000)).toBe(false);
      });

      it('should return false for non-video content', () => {
        const list = MultimediaListMother.imagesOnly().build();
        expect(list.is.durationGreaterThan(10)).toBe(false);
      });
    });

    describe('is.equal', () => {
      it('should return true when all provided multimedia exist in list', () => {
        const multimedia1 = MultimediaMother.pngImage().build();
        const multimedia2 = MultimediaMother.mp4Video().build();
        const list = MultimediaListMother.builder().withMultimedia([multimedia1, multimedia2]).build();

        expect(list.is.equal([multimedia1, multimedia2])).toBe(true);
      });

      it('should return false when some multimedia do not exist', () => {
        const multimedia1 = MultimediaMother.pngImage().build();
        const multimedia2 = MultimediaMother.mp4Video().build();
        const notInList = MultimediaMother.gifImage().build();
        const list = MultimediaListMother.builder().withMultimedia([multimedia1, multimedia2]).build();

        expect(list.is.equal([multimedia1, notInList])).toBe(false);
      });
    });
  });

  describe('Mutation operations', () => {
    describe('insert', () => {
      it('should insert single URL', () => {
        const list = MultimediaListMother.empty().build();
        const originalLength = list.length;

        list.insert('new-image.png');

        expect(list.length).toBe(originalLength + 1);
        expect(list.items[list.items.length - 1].url).toBe('new-image.png');
      });

      it('should insert multiple URLs', () => {
        const list = MultimediaListMother.singleImage().build();
        const originalLength = list.length;
        const newUrls = ['image1.png', 'video1.mp4', 'doc1.pdf'];

        list.insert(newUrls);

        expect(list.length).toBe(originalLength + 3);
        expect(list.items[list.items.length - 3].url).toBe('image1.png');
        expect(list.items[list.items.length - 2].url).toBe('video1.mp4');
        expect(list.items[list.items.length - 1].url).toBe('doc1.pdf');
      });
    });
  });

  describe('Inherited EntityList functionality', () => {
    describe('Selection operations', () => {
      it('should select all items', () => {
        const list = MultimediaListMother.mixedContent().build();

        list.select.all();

        expect(list.has.selected.all).toBe(true);
        expect(list.items.every((item) => item.selected)).toBe(true);
      });

      it('should select one item', () => {
        const list = MultimediaListMother.mixedContent().build();
        const targetItem = list.items[0];

        list.select.one(targetItem);

        expect(targetItem.selected).toBe(true);
      });

      it('should unselect all items', () => {
        const list = MultimediaListMother.allSelected().build();

        list.unselect.all();

        expect(list.has.selected.none).toBe(true);
        expect(list.items.every((item) => !item.selected)).toBe(true);
      });

      it('should toggle selection states', () => {
        const list = MultimediaListMother.partiallySelected().build();
        const initialSelectedCount = list.items.filter((item) => item.selected).length;

        list.toggle.all();

        const finalSelectedCount = list.items.filter((item) => item.selected).length;
        expect(finalSelectedCount).toBe(list.length - initialSelectedCount);
      });
    });

    describe('Filtering and searching', () => {
      it('should find item by ID', () => {
        const list = MultimediaListMother.mixedContent().build();
        const targetItem = list.items[1];
        const targetId = targetItem.getId();

        const found = list.find(targetId);

        expect(found).toBe(targetItem);
      });

      it('should filter items by predicate', () => {
        const list = MultimediaListMother.mixedContent().build();

        const filtered = list.filter((item) => item.isImage());

        expect(filtered).toBeInstanceOf(MultimediaList);
        expect(filtered.items.every((item) => item.isImage())).toBe(true);
      });

      it('should check if some items match predicate', () => {
        const list = MultimediaListMother.mixedContent().build();

        expect(list.some((item) => item.isVideo())).toBe(true);
        expect(list.some((item) => item.url.includes('nonexistent'))).toBe(false);
      });

      it('should check if all items match predicate', () => {
        const imageList = MultimediaListMother.imagesOnly().build();
        const mixedList = MultimediaListMother.mixedContent().build();

        expect(imageList.every((item) => item.isImage())).toBe(true);
        expect(mixedList.every((item) => item.isImage())).toBe(false);
      });
    });

    describe('Immutable operations', () => {
      it('should create new list when inserting immutably', () => {
        const originalList = MultimediaListMother.singleImage().build();
        const newItem = MultimediaMother.mp4Video().build();

        const newList = originalList.immutable.insert(newItem);

        expect(newList).toBeInstanceOf(MultimediaList);
        expect(newList).not.toBe(originalList);
        expect(newList.length).toBe(originalList.length + 1);
        expect(originalList.length).toBe(1); // Original unchanged
      });

      it('should create new list when removing immutably', () => {
        const originalList = MultimediaListMother.mixedContent().build();
        const itemToRemove = originalList.items[0];

        const newList = originalList.immutable.remove(itemToRemove);

        expect(newList).toBeInstanceOf(MultimediaList);
        expect(newList.length).toBe(originalList.length - 1);
        expect(originalList.length).toBe(4); // Original unchanged
      });
    });

    describe('Unique items', () => {
      it('should return unique items only', () => {
        const duplicateUrl = 'duplicate.png';
        const multimedia1 = MultimediaMother.pngImage().withUrl(duplicateUrl).build();
        const multimedia2 = MultimediaMother.pngImage().withUrl(duplicateUrl).build();
        const multimedia3 = MultimediaMother.jpgImage().withUrl('unique.jpg').build();

        // Manually set same ID to create true duplicates
        const originalId = multimedia1.getId();
        jest.spyOn(multimedia2, 'getId').mockReturnValue(originalId);

        const list = MultimediaListMother.builder().withMultimedia([multimedia1, multimedia2, multimedia3]).build();

        const unique = list.uniques;

        expect(unique).toBeInstanceOf(MultimediaList);
        expect(unique.length).toBe(2); // Should have 2 unique items instead of 3
      });
    });

    describe('Selected items', () => {
      it('should return only selected items', () => {
        const list = MultimediaListMother.partiallySelected().build();

        const selected = list.selected;

        expect(selected).toBeInstanceOf(MultimediaList);
        expect(selected.items.every((item) => item.selected)).toBe(true);
        expect(selected.length).toBeLessThan(list.length);
      });
    });

    describe('Primitives conversion', () => {
      it('should convert to primitives array', () => {
        const list = MultimediaListMother.mixedContent().build();

        const primitives = list.toPrimitives();

        expect(Array.isArray(primitives)).toBe(true);
        expect(primitives).toHaveLength(list.length);
        expect(primitives[0]).toEqual(list.items[0].toPrimitives());
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty list operations gracefully', () => {
      const list = MultimediaListMother.empty().build();

      expect(list.images.isEmpty).toBe(true);
      expect(list.videos.isEmpty).toBe(true);
      expect(list.documents.isEmpty).toBe(true);
      expect(list.gifs.isEmpty).toBe(true);
      expect(list.totalSize).toBe(0);
      expect(list.is.carousel).toBe(false);
      expect(list.search.url('any.png')).toBeUndefined();
      expect(list.last.element).toBeUndefined();
    });

    it('should handle single item list', () => {
      const list = MultimediaListMother.singleImage().build();

      expect(list.is.carousel).toBe(false);
      expect(list.length).toBe(1);
      expect(list.first).toBe(list.last.element);
    });

    it('should handle large lists efficiently', () => {
      const list = MultimediaListMother.largeCarousel().build();

      expect(list.length).toBe(10);
      expect(list.is.carousel).toBe(true);
      expect(list.has.items).toBe(true);
      expect(list.first).not.toBe(list.last.element);
    });
  });

  describe('Status-based Filtering', () => {
    describe('ok getter', () => {
      it('should filter multimedia with ok status', () => {
        const okImage = MultimediaMother.pngImage().asOk().build();
        const errorImage = MultimediaMother.pngImage().asError().build();
        const loadingImage = MultimediaMother.pngImage().asLoading().build();
        const list = new MultimediaList([okImage, errorImage, loadingImage]);

        const okList = list.ok;

        expect(okList.length).toBe(1);
        expect(okList.items[0]).toBe(okImage);
        expect(okList.items[0].isOk()).toBe(true);
      });

      it('should return empty list when no ok multimedia', () => {
        const errorImage = MultimediaMother.pngImage().asError().build();
        const loadingVideo = MultimediaMother.mp4Video().asLoading().build();
        const list = new MultimediaList([errorImage, loadingVideo]);

        const okList = list.ok;

        expect(okList.isEmpty).toBe(true);
        expect(okList.length).toBe(0);
      });

      it('should work with multiple ok multimedia', () => {
        const okImage1 = MultimediaMother.pngImage().asOk().build();
        const okImage2 = MultimediaMother.jpgImage().asOk().build();
        const okVideo = MultimediaMother.mp4Video().asOk().build();
        const errorImage = MultimediaMother.pngImage().asError().build();
        const list = new MultimediaList([okImage1, okImage2, okVideo, errorImage]);

        const okList = list.ok;

        expect(okList.length).toBe(3);
        expect(okList.items.every((m) => m.isOk())).toBe(true);
      });

      it('should work with default status (ok)', () => {
        const image = MultimediaMother.pngImage().build(); // Default is ok
        const video = MultimediaMother.mp4Video().build();
        const list = new MultimediaList([image, video]);

        const okList = list.ok;

        expect(okList.length).toBe(2);
        expect(okList.items.every((m) => m.isOk())).toBe(true);
      });
    });

    describe('error getter', () => {
      it('should filter multimedia with error status', () => {
        const okImage = MultimediaMother.pngImage().asOk().build();
        const errorImage = MultimediaMother.pngImage().asError().build();
        const loadingImage = MultimediaMother.pngImage().asLoading().build();
        const list = new MultimediaList([okImage, errorImage, loadingImage]);

        const errorList = list.error;

        expect(errorList.length).toBe(1);
        expect(errorList.items[0]).toBe(errorImage);
        expect(errorList.items[0].isError()).toBe(true);
      });

      it('should return empty list when no error multimedia', () => {
        const okImage = MultimediaMother.pngImage().asOk().build();
        const loadingVideo = MultimediaMother.mp4Video().asLoading().build();
        const list = new MultimediaList([okImage, loadingVideo]);

        const errorList = list.error;

        expect(errorList.isEmpty).toBe(true);
        expect(errorList.length).toBe(0);
      });

      it('should work with multiple error multimedia', () => {
        const errorImage1 = MultimediaMother.pngImage().asError().build();
        const errorImage2 = MultimediaMother.jpgImage().asError().build();
        const errorVideo = MultimediaMother.mp4Video().asError().build();
        const okImage = MultimediaMother.pngImage().asOk().build();
        const list = new MultimediaList([errorImage1, errorImage2, errorVideo, okImage]);

        const errorList = list.error;

        expect(errorList.length).toBe(3);
        expect(errorList.items.every((m) => m.isError())).toBe(true);
      });

      it('should work with mixed types', () => {
        const errorImage = MultimediaMother.pngImage().asError().build();
        const errorVideo = MultimediaMother.mp4Video().asError().build();
        const errorDocument = MultimediaMother.pdfDocument().asError().build();
        const list = new MultimediaList([errorImage, errorVideo, errorDocument]);

        const errorList = list.error;

        expect(errorList.length).toBe(3);
        expect(errorList.items[0].isImage()).toBe(true);
        expect(errorList.items[1].isVideo()).toBe(true);
        expect(errorList.items[2].isDocument()).toBe(true);
      });
    });

    describe('loading getter', () => {
      it('should filter multimedia with loading status', () => {
        const okImage = MultimediaMother.pngImage().asOk().build();
        const errorImage = MultimediaMother.pngImage().asError().build();
        const loadingImage = MultimediaMother.pngImage().asLoading().build();
        const list = new MultimediaList([okImage, errorImage, loadingImage]);

        const loadingList = list.loading;

        expect(loadingList.length).toBe(1);
        expect(loadingList.items[0]).toBe(loadingImage);
        expect(loadingList.items[0].isLoading()).toBe(true);
      });

      it('should return empty list when no loading multimedia', () => {
        const okImage = MultimediaMother.pngImage().asOk().build();
        const errorVideo = MultimediaMother.mp4Video().asError().build();
        const list = new MultimediaList([okImage, errorVideo]);

        const loadingList = list.loading;

        expect(loadingList.isEmpty).toBe(true);
        expect(loadingList.length).toBe(0);
      });

      it('should work with multiple loading multimedia', () => {
        const loadingImage1 = MultimediaMother.pngImage().asLoading().build();
        const loadingImage2 = MultimediaMother.jpgImage().asLoading().build();
        const loadingVideo = MultimediaMother.mp4Video().asLoading().build();
        const okImage = MultimediaMother.pngImage().asOk().build();
        const list = new MultimediaList([loadingImage1, loadingImage2, loadingVideo, okImage]);

        const loadingList = list.loading;

        expect(loadingList.length).toBe(3);
        expect(loadingList.items.every((m) => m.isLoading())).toBe(true);
      });

      it('should work with different media types', () => {
        const loadingImage = MultimediaMother.pngImage().asLoading().build();
        const loadingVideo = MultimediaMother.mp4Video().asLoading().build();
        const loadingGif = MultimediaMother.gifImage().asLoading().build();
        const list = new MultimediaList([loadingImage, loadingVideo, loadingGif]);

        const loadingList = list.loading;

        expect(loadingList.length).toBe(3);
        expect(loadingList.items[0].isImage()).toBe(true);
        expect(loadingList.items[1].isVideo()).toBe(true);
        expect(loadingList.items[2].isGif()).toBe(true);
      });
    });

    describe('Combined status filtering', () => {
      it('should chain status filters with type filters', () => {
        const okImage = MultimediaMother.pngImage().asOk().build();
        const errorImage = MultimediaMother.jpgImage().asError().build();
        const okVideo = MultimediaMother.mp4Video().asOk().build();
        const errorVideo = MultimediaMother.hdVideo().asError().build();
        const list = new MultimediaList([okImage, errorImage, okVideo, errorVideo]);

        const okImages = list.ok.images;
        const errorVideos = list.error.videos;

        expect(okImages.length).toBe(1);
        expect(okImages.items[0]).toBe(okImage);

        expect(errorVideos.length).toBe(1);
        expect(errorVideos.items[0]).toBe(errorVideo);
      });

      it('should work with all three status types', () => {
        const okImage = MultimediaMother.pngImage().asOk().build();
        const errorImage = MultimediaMother.jpgImage().asError().build();
        const loadingImage = MultimediaMother.pngImage().asLoading().build();
        const list = new MultimediaList([okImage, errorImage, loadingImage]);

        expect(list.ok.length).toBe(1);
        expect(list.error.length).toBe(1);
        expect(list.loading.length).toBe(1);
        expect(list.length).toBe(3);
      });

      it('should maintain list immutability', () => {
        const okImage = MultimediaMother.pngImage().asOk().build();
        const errorImage = MultimediaMother.jpgImage().asError().build();
        const list = new MultimediaList([okImage, errorImage]);

        const okList = list.ok;
        const errorList = list.error;

        expect(list.length).toBe(2);
        expect(okList.length).toBe(1);
        expect(errorList.length).toBe(1);
      });

      it('should work with empty lists', () => {
        const emptyList = MultimediaList.empty();

        expect(emptyList.ok.isEmpty).toBe(true);
        expect(emptyList.error.isEmpty).toBe(true);
        expect(emptyList.loading.isEmpty).toBe(true);
      });
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
      it('should apply predicate to all multimedia in list', () => {
        const video1 = MultimediaMother.shortVideo().build();
        const video2 = MultimediaMother.hdVideo().build();
        const list = new MultimediaList([video1, video2]);

        const result = list.ensure(isVideoDurationValid(200)); // All videos should pass

        expect(result).toBe(true);
        list.items.forEach((multimedia: Multimedia) => {
          expect(multimedia.isOk()).toBe(true);
        });
      });

      it('should mark invalid multimedia as error', () => {
        const validVideo = MultimediaMother.shortVideo().build(); // 15s
        const invalidVideo = MultimediaMother.hdVideo().build(); // 120s
        const list = new MultimediaList([validVideo, invalidVideo]);

        const result = list.ensure(isVideoDurationValid(60)); // 60s max

        expect(result).toBe(false);
        expect(validVideo.isOk()).toBe(true);
        expect(invalidVideo.isError()).toBe(true);
      });

      it('should work with mixed content types', () => {
        const list = MultimediaListMother.mixedContent().build();

        const result = list.ensure(isImage);

        expect(result).toBe(false);
        list.images.items.forEach((image) => {
          expect(image.isOk()).toBe(true);
        });

        list.videos.items.forEach((video) => {
          expect(video.isError()).toBe(true);
        });
      });
    });

    describe('Type-specific Predicates', () => {
      it('should validate only videos with video predicate', () => {
        const video1 = MultimediaMother.mp4Video().build();
        const video2 = MultimediaMother.shortVideo().build();
        const list = new MultimediaList([video1, video2]);

        const result = list.ensure(isVideo);

        expect(result).toBe(true);
        list.items.forEach((video: Multimedia) => {
          expect(video.isOk()).toBe(true);
        });
      });

      it('should validate only images with image predicate', () => {
        const image1 = MultimediaMother.pngImage().build();
        const image2 = MultimediaMother.jpgImage().build();
        const list = new MultimediaList([image1, image2]);

        const result = list.ensure(isImage);

        expect(result).toBe(true);
        list.items.forEach((image: Multimedia) => {
          expect(image.isOk()).toBe(true);
        });
      });

      it('should mark non-matching types as error', () => {
        const image = MultimediaMother.pngImage().build();
        const video = MultimediaMother.mp4Video().build();
        const list = new MultimediaList([image, video]);

        const result = list.ensure(isVideo);

        expect(result).toBe(false);
        expect(image.isError()).toBe(true);
        expect(video.isOk()).toBe(true);
      });
    });

    describe('Size and Duration Validations', () => {
      it('should validate video sizes', () => {
        const smallVideo = MultimediaMother.shortVideo().build(); // 10MB
        const largeVideo = MultimediaMother.hdVideo()
          .withSize(150 * 1024 * 1024)
          .build(); // 150MB
        const list = new MultimediaList([smallVideo, largeVideo]);

        const result = list.ensure(isVideoSizeValid(100)); // 100MB max

        expect(result).toBe(false);
        expect(smallVideo.isOk()).toBe(true);
        expect(largeVideo.isError()).toBe(true);
      });

      it('should validate video durations', () => {
        const shortVideo = MultimediaMother.shortVideo().build(); // 15s
        const longVideo = MultimediaMother.hdVideo().build(); // 120s
        const list = new MultimediaList([shortVideo, longVideo]);

        const result = list.ensure(isVideoDurationValid(60)); // 60s max

        expect(result).toBe(false);
        expect(shortVideo.isOk()).toBe(true);
        expect(longVideo.isError()).toBe(true);
      });

      it('should validate image dimensions', () => {
        const smallImage = MultimediaMother.smallImage().build(); // 200x150
        const largeImage = MultimediaMother.largeImage().build(); // 4000x3000
        const list = new MultimediaList([smallImage, largeImage]);

        const result = list.ensure(isImageDimensionsValid(320)); // 320px min

        expect(result).toBe(false);
        expect(smallImage.isError()).toBe(true);
        expect(largeImage.isOk()).toBe(true);
      });
    });

    describe('Status Transitions', () => {
      it('should change status from error to success when predicate passes', () => {
        const video1 = MultimediaMother.errorVideo().build();
        const video2 = MultimediaMother.errorVideo().build();
        const list = new MultimediaList([video1, video2]);

        expect(video1.isError()).toBe(true);
        expect(video2.isError()).toBe(true);

        const result = list.ensure(isVideo);

        expect(result).toBe(true);
        expect(video1.isOk()).toBe(true);
        expect(video2.isOk()).toBe(true);
      });

      it('should change status from loading to appropriate state', () => {
        const loadingVideo = MultimediaMother.loadingVideo().build();
        const loadingImage = MultimediaMother.loadingMedia().asPNG().build();
        const list = new MultimediaList([loadingVideo, loadingImage]);

        expect(loadingVideo.isLoading()).toBe(true);
        expect(loadingImage.isLoading()).toBe(true);

        const result = list.ensure(isVideo);

        expect(result).toBe(false);
        expect(loadingVideo.isOk()).toBe(true);
        expect(loadingImage.isError()).toBe(true);
      });
    });

    describe('Empty and Edge Cases', () => {
      it('should handle empty list gracefully', () => {
        const list = MultimediaListMother.empty().build();

        expect(() => list.ensure(isVideo)).not.toThrow();
        expect(list.isEmpty).toBe(true);
      });

      it('should handle single item list', () => {
        const list = MultimediaListMother.singleImage().build();

        const result = list.ensure(isImage);

        expect(result).toBe(true);
        expect(list.items[0].isOk()).toBe(true);
      });

      it('should preserve multimedia properties after validation', () => {
        const video = MultimediaMother.hdVideo().withDimensions(1920, 1080).build();
        const list = new MultimediaList([video]);

        list.ensure(isVideo);

        expect(video.width).toBe(1920);
        expect(video.height).toBe(1080);
        expect(video.isOk()).toBe(true);
      });

      it('should work with large lists', () => {
        const list = MultimediaListMother.largeCarousel().build();

        list.ensure(isImage);

        expect(list.length).toBe(10);
        list.items.forEach((multimedia) => {
          if (multimedia.isImage()) {
            expect(multimedia.isOk()).toBe(true);
          } else {
            expect(multimedia.isError()).toBe(true);
          }
        });
      });
    });

    describe('Complex Scenarios', () => {
      it('should handle carousel with mixed valid/invalid items', () => {
        const validImage1 = MultimediaMother.largeImage().build();
        const invalidImage = MultimediaMother.smallImage().build();
        const validImage2 = MultimediaMother.horizontalImage().build();
        const list = new MultimediaList([validImage1, invalidImage, validImage2]);

        const result = list.ensure(isImageDimensionsValid(320));

        expect(result).toBe(false);
        expect(validImage1.isOk()).toBe(true);
        expect(invalidImage.isError()).toBe(true);
        expect(validImage2.isOk()).toBe(true);
      });

      it('should work with different multimedia types in same list', () => {
        const image = MultimediaMother.pngImage().build();
        const video = MultimediaMother.mp4Video().build();
        const gif = MultimediaMother.gifImage().build();
        const document = MultimediaMother.pdfDocument().build();
        const list = new MultimediaList([image, video, gif, document]);

        const result = list.ensure(isImage);

        expect(result).toBe(false);
        expect(image.isOk()).toBe(true);
        expect(video.isError()).toBe(true);
        expect(gif.isOk()).toBe(true); // GIFs are images
        expect(document.isError()).toBe(true);
      });

      it('should allow multiple sequential validations', () => {
        const video1 = MultimediaMother.shortVideo().build(); // 15s, 10MB
        const video2 = MultimediaMother.hdVideo().build(); // 120s, 100MB
        const list = new MultimediaList([video1, video2]);

        // First validation: duration
        list.ensure(isVideoDurationValid(60));

        expect(video1.isOk()).toBe(true);
        expect(video2.isError()).toBe(true);

        // Second validation: size (resets status based on new predicate)
        list.ensure(isVideoSizeValid(50));

        expect(video1.isOk()).toBe(true); // Still valid (10MB < 50MB)
        expect(video2.isError()).toBe(true); // Still invalid (100MB > 50MB)
      });
    });

    describe('Integration with List Methods', () => {
      it('should work with filtered lists', () => {
        const list = MultimediaListMother.mixedContent().build();
        const videoList = list.videos;

        const result = videoList.ensure(isVideoDurationValid(200));

        expect(result).toBe(true);
        videoList.items.forEach((video) => {
          expect(video.isOk()).toBe(true);
        });
      });

      it('should work with image-only lists', () => {
        const list = MultimediaListMother.mixedContent().build();
        const imageList = list.images;

        const result = imageList.ensure(isImage);

        expect(result).toBe(true);
        imageList.items.forEach((image) => {
          expect(image.isOk()).toBe(true);
        });
      });

      it('should maintain list integrity after validation', () => {
        const video1 = MultimediaMother.mp4Video().build();
        const video2 = MultimediaMother.hdVideo().build();
        const list = new MultimediaList([video1, video2]);
        const originalLength = list.length;

        list.ensure(isVideo);

        expect(list.length).toBe(originalLength);
        expect(list.items.every((m: Multimedia) => m.isVideo())).toBe(true);
      });
    });
  });

  // Helper predicate functions for testing (shared across multiple describe blocks)
  const isVideoDurationValid = (maxDuration: number) => (m: Multimedia) => !m.isDurationGreaterThan(maxDuration);
  const isVideoSizeValid = (maxSize: number) => (m: Multimedia) => !m.isSizeGreaterThan(maxSize);
  const isImageDimensionsValid = (minDimension: number) => (m: Multimedia) =>
    !m.isWidthLessThan(minDimension) && !m.isHeightLessThan(minDimension);
  const isVideo = (m: Multimedia) => m.isVideo();

  describe('ensureAsError() Method', () => {
    describe('Basic Functionality', () => {
      it('should mark invalid multimedia as error without changing valid ones', () => {
        const shortVideo = MultimediaMother.shortVideo().build(); // 15s
        const longVideo = MultimediaMother.hdVideo().build(); // 120s
        const list = new MultimediaList([shortVideo, longVideo]);

        const result = list.ensureAsError(isVideoDurationValid(60)); // 60s max

        expect(result).toBe(false); // Not all are valid
        expect(shortVideo.isOk()).toBe(true); // Short video preserved
        expect(longVideo.isError()).toBe(true); // Long video marked as error
      });

      it('should return true when all multimedia pass validation', () => {
        const video1 = MultimediaMother.shortVideo().build(); // 15s
        const video2 = MultimediaMother.mp4Video().build(); // Default duration
        const list = new MultimediaList([video1, video2]);

        const result = list.ensureAsError(isVideoDurationValid(200)); // 200s max

        expect(result).toBe(true);
        expect(video1.isOk()).toBe(true);
        expect(video2.isOk()).toBe(true);
      });

      it('should return false when all multimedia fail validation', () => {
        const longVideo1 = MultimediaMother.hdVideo().build(); // 120s
        const longVideo2 = MultimediaMother.hdVideo().build(); // 120s
        const list = new MultimediaList([longVideo1, longVideo2]);

        const result = list.ensureAsError(isVideoDurationValid(60)); // 60s max

        expect(result).toBe(false);
        expect(longVideo1.isError()).toBe(true);
        expect(longVideo2.isError()).toBe(true);
      });

      it('should preserve existing error states', () => {
        const okVideo = MultimediaMother.shortVideo().build();
        const errorVideo = MultimediaMother.errorVideo().build();
        const list = new MultimediaList([okVideo, errorVideo]);

        expect(okVideo.isOk()).toBe(true);
        expect(errorVideo.isError()).toBe(true);

        const result = list.ensureAsError(isVideo); // Both are videos, should pass

        expect(result).toBe(true); // Returns true because both videos pass the predicate
        expect(okVideo.isOk()).toBe(true); // OK video preserved
        expect(errorVideo.isError()).toBe(true); // Error video preserved
      });
    });

    describe('Mixed Content Types', () => {
      it('should work with mixed media types', () => {
        const image = MultimediaMother.pngImage().build();
        const video = MultimediaMother.mp4Video().build();
        const document = MultimediaMother.pdfDocument().build();
        const list = new MultimediaList([image, video, document]);

        const result = list.ensureAsError(isVideo);

        expect(result).toBe(false);
        expect(image.isError()).toBe(true); // Image fails video check
        expect(video.isOk()).toBe(true); // Video passes video check
        expect(document.isError()).toBe(true); // Document fails video check
      });

      it('should work with image validations', () => {
        const smallImage = MultimediaMother.smallImage().build(); // 200x150
        const largeImage = MultimediaMother.largeImage().build(); // 4000x3000
        const list = new MultimediaList([smallImage, largeImage]);

        const result = list.ensureAsError(isImageDimensionsValid(320)); // 320px min

        expect(result).toBe(false);
        expect(smallImage.isError()).toBe(true); // Small image fails
        expect(largeImage.isOk()).toBe(true); // Large image passes
      });

      it('should work with size validations', () => {
        const smallVideo = MultimediaMother.shortVideo().build(); // 10MB
        const largeVideo = MultimediaMother.hdVideo()
          .withSize(150 * 1024 * 1024)
          .build(); // 150MB
        const list = new MultimediaList([smallVideo, largeVideo]);

        const result = list.ensureAsError(isVideoSizeValid(100)); // 100MB max

        expect(result).toBe(false);
        expect(smallVideo.isOk()).toBe(true); // Small video passes
        expect(largeVideo.isError()).toBe(true); // Large video fails
      });
    });

    describe('Status Preservation', () => {
      it('should preserve loading status when predicate passes', () => {
        const loadingVideo = MultimediaMother.loadingVideo().build();
        const okVideo = MultimediaMother.mp4Video().build();
        const list = new MultimediaList([loadingVideo, okVideo]);

        const result = list.ensureAsError(isVideo); // Both are videos

        expect(result).toBe(true); // Returns true because both videos pass the predicate
        expect(loadingVideo.isLoading()).toBe(true); // Loading status preserved
        expect(okVideo.isOk()).toBe(true); // OK status preserved
      });

      it('should change loading status to error when predicate fails', () => {
        const loadingVideo = MultimediaMother.loadingVideo().build();
        const okImage = MultimediaMother.pngImage().build();
        const list = new MultimediaList([loadingVideo, okImage]);

        const result = list.ensureAsError(isVideo); // Video passes, image fails

        expect(result).toBe(false);
        expect(loadingVideo.isLoading()).toBe(true); // Loading preserved (predicate passed)
        expect(okImage.isError()).toBe(true); // Image marked as error (predicate failed)
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty list', () => {
        const emptyList = MultimediaList.empty();

        const result = emptyList.ensureAsError(isVideo);

        expect(result).toBe(true); // Empty list returns true
        expect(emptyList.isEmpty).toBe(true);
      });

      it('should handle single item list', () => {
        const video = MultimediaMother.mp4Video().build();
        const list = new MultimediaList([video]);

        const result = list.ensureAsError(isVideo);

        expect(result).toBe(true);
        expect(video.isOk()).toBe(true);
      });

      it('should work with filtered lists', () => {
        const mixedList = MultimediaListMother.mixedContent().build();
        const videoList = mixedList.videos;

        const result = videoList.ensureAsError(isVideoDurationValid(200));

        expect(result).toBe(true); // All videos should pass
        videoList.items.forEach((video) => {
          expect(video.isOk()).toBe(true);
        });
      });
    });

    describe('Multiple Sequential Calls', () => {
      it('should handle multiple ensureAsError calls correctly', () => {
        const video = MultimediaMother.hdVideo().build(); // 120s, 100MB
        const list = new MultimediaList([video]);

        // First validation: duration (fails)
        const result1 = list.ensureAsError(isVideoDurationValid(60));
        expect(result1).toBe(false);
        expect(video.isError()).toBe(true);

        // Second validation: size (would pass, but error preserved)
        const result2 = list.ensureAsError(isVideoSizeValid(200));
        expect(result2).toBe(true); // Returns true because predicate passes
        expect(video.isError()).toBe(true); // Error preserved
      });
    });
  });

  describe('markAllAsOk() Method', () => {
    describe('Basic Functionality', () => {
      it('should mark all multimedia as ok', () => {
        const errorVideo = MultimediaMother.errorVideo().build();
        const loadingImage = MultimediaMother.loadingMedia().asPNG().build();
        const okDocument = MultimediaMother.pdfDocument().build();
        const list = new MultimediaList([errorVideo, loadingImage, okDocument]);

        expect(errorVideo.isError()).toBe(true);
        expect(loadingImage.isLoading()).toBe(true);
        expect(okDocument.isOk()).toBe(true);

        list.markAllAsOk();

        expect(errorVideo.isOk()).toBe(true);
        expect(loadingImage.isOk()).toBe(true);
        expect(okDocument.isOk()).toBe(true);
      });

      it('should work with mixed media types', () => {
        const errorImage = MultimediaMother.pngImage().asError().build();
        const loadingVideo = MultimediaMother.mp4Video().asLoading().build();
        const errorGif = MultimediaMother.gifImage().asError().build();
        const list = new MultimediaList([errorImage, loadingVideo, errorGif]);

        list.markAllAsOk();

        expect(errorImage.isOk()).toBe(true);
        expect(loadingVideo.isOk()).toBe(true);
        expect(errorGif.isOk()).toBe(true);
      });

      it('should preserve multimedia properties', () => {
        const video = MultimediaMother.hdVideo().withDimensions(1920, 1080).asError().build();
        const list = new MultimediaList([video]);

        expect(video.isError()).toBe(true);

        list.markAllAsOk();

        expect(video.isOk()).toBe(true);
        expect(video.width).toBe(1920);
        expect(video.height).toBe(1080);
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty list', () => {
        const emptyList = MultimediaList.empty();

        expect(() => emptyList.markAllAsOk()).not.toThrow();
        expect(emptyList.isEmpty).toBe(true);
      });

      it('should handle single item list', () => {
        const errorVideo = MultimediaMother.errorVideo().build();
        const list = new MultimediaList([errorVideo]);

        expect(errorVideo.isError()).toBe(true);

        list.markAllAsOk();

        expect(errorVideo.isOk()).toBe(true);
      });

      it('should work with already ok multimedia', () => {
        const okVideo = MultimediaMother.mp4Video().build();
        const okImage = MultimediaMother.pngImage().build();
        const list = new MultimediaList([okVideo, okImage]);

        expect(okVideo.isOk()).toBe(true);
        expect(okImage.isOk()).toBe(true);

        list.markAllAsOk();

        expect(okVideo.isOk()).toBe(true);
        expect(okImage.isOk()).toBe(true);
      });
    });

    describe('Integration with Other Methods', () => {
      it('should work after ensureAsError calls', () => {
        const shortVideo = MultimediaMother.shortVideo().build(); // 15s
        const longVideo = MultimediaMother.hdVideo().build(); // 120s
        const list = new MultimediaList([shortVideo, longVideo]);

        // First mark some as invalid
        list.ensureAsError(isVideoDurationValid(60));
        expect(shortVideo.isOk()).toBe(true);
        expect(longVideo.isError()).toBe(true);

        // Then mark all as ok
        list.markAllAsOk();
        expect(shortVideo.isOk()).toBe(true);
        expect(longVideo.isOk()).toBe(true);
      });

      it('should work with filtered lists', () => {
        const mixedList = MultimediaListMother.mixedContent().build();

        // Mark some as error first
        mixedList.ensure(isVideo); // This will mark non-videos as error

        const errorList = mixedList.error;
        expect(errorList.length).toBeGreaterThan(0);

        // Mark all in error list as ok
        errorList.markAllAsOk();

        errorList.items.forEach((multimedia) => {
          expect(multimedia.isOk()).toBe(true);
        });
      });
    });

    describe('Performance and Large Lists', () => {
      it('should handle large lists efficiently', () => {
        const largeList = MultimediaListMother.largeCarousel().build();

        // Mark some as error
        largeList.items.forEach((multimedia, index) => {
          if (index % 2 === 0) {
            multimedia.to.error();
          }
        });

        const start = Date.now();
        largeList.markAllAsOk();
        const end = Date.now();

        expect(end - start).toBeLessThan(100); // Should be fast
        largeList.items.forEach((multimedia) => {
          expect(multimedia.isOk()).toBe(true);
        });
      });
    });
  });
});
