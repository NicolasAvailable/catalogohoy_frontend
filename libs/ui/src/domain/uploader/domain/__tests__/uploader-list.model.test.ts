import { BaseUploaderOutput } from '@shared/domain';
import { FileMother } from '../validators/__tests__/file.builder';
import { UploaderList } from '../uploader-list.model';
import { Uploader } from '../uploader.model';
import { UploaderMother } from './uploader.builder';
import { UploaderListMother } from './uploader-list.builder';

describe('UploaderList', () => {
  describe('static factory methods', () => {
    describe('empty', () => {
      it('should create an empty uploader list', () => {
        const list = UploaderList.empty();

        expect(list).toBeInstanceOf(UploaderList);
        expect(list.items).toEqual([]);
        expect(list.items).toHaveLength(0);
      });

      it('should create different instances each time', () => {
        const list1 = UploaderList.empty();
        const list2 = UploaderList.empty();

        expect(list1).not.toBe(list2);
        expect(list1.items).toEqual(list2.items);
      });
    });

    describe('from', () => {
      it('should create uploader list from BaseUploaderOutput array', () => {
        const outputs: BaseUploaderOutput[] = [
          {
            file: FileMother.smallImage().build(),
            progress: () => 50,
            complete: () => Promise.resolve({ isRight: () => true, value: 'url1' } as any),
          },
          {
            file: FileMother.pdfDocument().build(),
            progress: () => 100,
            complete: () => Promise.resolve({ isRight: () => true, value: 'url2' } as any),
          },
        ];

        const list = UploaderList.from(outputs);

        expect(list).toBeInstanceOf(UploaderList);
        expect(list.items).toHaveLength(2);
        expect(list.items[0]).toBeInstanceOf(Uploader);
        expect(list.items[1]).toBeInstanceOf(Uploader);
      });

      it('should handle empty array', () => {
        const list = UploaderList.from([]);

        expect(list.items).toEqual([]);
      });
    });

    describe('idle', () => {
      it('should create uploader list with idle uploaders from files', () => {
        const files = [
          FileMother.smallImage().build(),
          FileMother.pdfDocument().build(),
          FileMother.largeImage().build(),
        ];

        const list = UploaderList.idle(files);

        expect(list).toBeInstanceOf(UploaderList);
        expect(list.items).toHaveLength(3);
        list.items.forEach((uploader, index) => {
          expect(uploader).toBeInstanceOf(Uploader);
          expect(uploader.file).toBe(files[index]);
          expect(uploader.progress).toBe(0);
          expect(uploader.is.idle).toBe(true);
        });
      });

      it('should handle empty files array', () => {
        const list = UploaderList.idle([]);

        expect(list.items).toEqual([]);
      });

      it('should create different instances each time', () => {
        const files = [FileMother.smallImage().build()];
        const list1 = UploaderList.idle(files);
        const list2 = UploaderList.idle(files);

        expect(list1).not.toBe(list2);
        expect(list1.items[0]).not.toBe(list2.items[0]);
        expect(list1.items[0].file).toBe(list2.items[0].file);
      });
    });
  });

  describe('basic properties', () => {
    describe('items', () => {
      it('should contain all uploaders', () => {
        const uploaders = [UploaderMother.idle(), UploaderMother.uploading(), UploaderMother.completed()];
        const list = UploaderListMother.builder().withUploaders(uploaders).build();

        expect(list.items).toEqual(uploaders);
        expect(list.items).toHaveLength(3);
      });
    });

    describe('files', () => {
      it('should return array of all files from uploaders', () => {
        const files = [
          FileMother.smallImage().withName('image1.jpg').build(),
          FileMother.pdfDocument().withName('document.pdf').build(),
          FileMother.largeImage().withName('image2.jpg').build(),
        ];
        const list = UploaderList.idle(files);

        const resultFiles = list.files;

        expect(resultFiles).toHaveLength(3);
        expect(resultFiles).toEqual(files);
        expect(resultFiles[0]).toBe(files[0]);
        expect(resultFiles[1]).toBe(files[1]);
        expect(resultFiles[2]).toBe(files[2]);
      });

      it('should return empty array for empty list', () => {
        const list = UploaderListMother.empty();

        expect(list.files).toEqual([]);
      });

      it('should return files in same order as uploaders', () => {
        const file1 = FileMother.smallImage().withName('first.jpg').build();
        const file2 = FileMother.pdfDocument().withName('second.pdf').build();
        const file3 = FileMother.largeImage().withName('third.jpg').build();

        const list = UploaderListMother.builder()
          .withUploader(UploaderMother.withFile(file1))
          .withUploader(UploaderMother.withFile(file2))
          .withUploader(UploaderMother.withFile(file3))
          .build();

        const files = list.files;

        expect(files[0]).toBe(file1);
        expect(files[1]).toBe(file2);
        expect(files[2]).toBe(file3);
      });

      it('should handle single file', () => {
        const file = FileMother.smallImage().build();
        const list = UploaderListMother.builder().withUploader(UploaderMother.withFile(file)).build();

        expect(list.files).toEqual([file]);
        expect(list.files[0]).toBe(file);
      });
    });
  });

  describe('filtering methods', () => {
    describe('completed', () => {
      it('should return only completed uploaders', () => {
        const list = UploaderListMother.builder()
          .withUploader(UploaderMother.idle())
          .withUploader(UploaderMother.uploading(50))
          .withUploader(UploaderMother.completed())
          .withUploader(UploaderMother.completed())
          .build();

        const completed = list.completed;

        expect(completed.items).toHaveLength(2);
        completed.items.forEach((uploader) => {
          expect(uploader.progress).toBe(100);
          expect(uploader.is.completed).toBe(true);
        });
      });

      it('should return empty list when no uploaders are completed', () => {
        const list = UploaderListMother.builder().withIdleUploaders(2).withUploadingUploaders(2).build();

        const completed = list.completed;

        expect(completed.items).toHaveLength(0);
      });
    });

    describe('pending', () => {
      it('should return uploaders with progress less than 100', () => {
        const list = UploaderListMother.builder()
          .withUploader(UploaderMother.idle())
          .withUploader(UploaderMother.uploading(25))
          .withUploader(UploaderMother.uploading(75))
          .withUploader(UploaderMother.completed())
          .build();

        const pending = list.pending;

        expect(pending.items).toHaveLength(3);
        pending.items.forEach((uploader) => {
          expect(uploader.progress).toBeLessThan(100);
        });
      });

      it('should return empty list when all uploaders are completed', () => {
        const list = UploaderListMother.allCompleted();

        const pending = list.pending;

        expect(pending.items).toHaveLength(0);
      });
    });
  });

  describe('progress tracking', () => {
    describe('progress', () => {
      describe('all', () => {
        it('should return array of all progress values', () => {
          const list = UploaderListMother.builder()
            .withUploader(UploaderMother.withProgress(0))
            .withUploader(UploaderMother.withProgress(50))
            .withUploader(UploaderMother.withProgress(100))
            .build();

          expect(list.progress.all).toEqual([0, 50, 100]);
        });

        it('should return empty array for empty list', () => {
          const list = UploaderListMother.empty();

          expect(list.progress.all).toEqual([]);
        });
      });

      describe('one', () => {
        it('should return progress of uploader at specific index', () => {
          const list = UploaderListMother.builder()
            .withUploader(UploaderMother.withProgress(25))
            .withUploader(UploaderMother.withProgress(75))
            .build();

          expect(list.progress.one(0)).toBe(25);
          expect(list.progress.one(1)).toBe(75);
        });

        it('should handle out of bounds index', () => {
          const list = UploaderListMother.builder()
            .withUploader(UploaderMother.withProgress(50))
            .build();

          expect(() => list.progress.one(1)).toThrow();
          expect(() => list.progress.one(-1)).toThrow();
          expect(() => list.progress.one(999)).toThrow();
        });

        it('should handle empty list', () => {
          const list = UploaderListMother.empty();

          expect(() => list.progress.one(0)).toThrow();
        });
      });

      describe('total', () => {
        it('should return average progress rounded', () => {
          const list = UploaderListMother.builder()
            .withUploader(UploaderMother.withProgress(0))
            .withUploader(UploaderMother.withProgress(50))
            .withUploader(UploaderMother.withProgress(100))
            .build();

          expect(list.progress.total).toBe(50); // (0 + 50 + 100) / 3 = 50
        });

        it('should handle single uploader', () => {
          const list = UploaderListMother.builder().withUploader(UploaderMother.withProgress(75)).build();

          expect(list.progress.total).toBe(75);
        });

        it('should return NaN for empty list', () => {
          const list = UploaderListMother.empty();

          expect(list.progress.total).toBeNaN();
        });
      });

      describe('completed', () => {
        it('should return count of completed uploaders', () => {
          const list = UploaderListMother.builder()
            .withUploader(UploaderMother.idle())
            .withUploader(UploaderMother.uploading())
            .withUploader(UploaderMother.completed())
            .withUploader(UploaderMother.completed())
            .build();

          expect(list.progress.completed).toBe(2);
        });

        it('should return 0 for empty list', () => {
          const list = UploaderListMother.empty();

          expect(list.progress.completed).toBe(0);
        });
      });

      describe('pending', () => {
        it('should return count of pending uploaders', () => {
          const list = UploaderListMother.builder()
            .withUploader(UploaderMother.idle())
            .withUploader(UploaderMother.uploading())
            .withUploader(UploaderMother.completed())
            .withUploader(UploaderMother.completed())
            .build();

          expect(list.progress.pending).toBe(2);
        });

        it('should return 0 when all are completed', () => {
          const list = UploaderListMother.allCompleted();

          expect(list.progress.pending).toBe(0);
        });
      });
    });
  });

  describe('state detection', () => {
    describe('is', () => {
      describe('completed', () => {
        it('should return true when total progress is 100', () => {
          const list = UploaderListMother.allCompleted();

          expect(list.is.completed).toBe(true);
        });

        it('should return false when total progress is less than 100', () => {
          const list = UploaderListMother.builder()
            .withUploader(UploaderMother.completed())
            .withUploader(UploaderMother.uploading(50))
            .build();

          expect(list.is.completed).toBe(false);
        });
      });

      describe('uploading', () => {
        it('should return true when total progress is between 1 and 99', () => {
          const list = UploaderListMother.builder()
            .withUploader(UploaderMother.uploading(50))
            .withUploader(UploaderMother.uploading(75))
            .build();

          expect(list.is.uploading).toBe(true);
        });

        it('should return false when total progress is 0 or 100', () => {
          const idleList = UploaderListMother.allIdle();
          const completedList = UploaderListMother.allCompleted();

          expect(idleList.is.uploading).toBe(false);
          expect(completedList.is.uploading).toBe(false);
        });
      });

      describe('idle', () => {
        it('should return true when total progress is 0', () => {
          const list = UploaderListMother.allIdle();

          expect(list.is.idle).toBe(true);
        });

        it('should return false when total progress is greater than 0', () => {
          const list = UploaderListMother.builder()
            .withUploader(UploaderMother.idle())
            .withUploader(UploaderMother.uploading(1))
            .build();

          expect(list.is.idle).toBe(false);
        });
      });

      describe('state combinations', () => {
        it('should have mutually exclusive states', () => {
          const testCases = [
            UploaderListMother.allIdle(),
            UploaderListMother.allUploading(),
            UploaderListMother.allCompleted(),
            UploaderListMother.withMultipleUploaders(),
          ];

          testCases.forEach((list) => {
            const states = [list.is.idle, list.is.uploading, list.is.completed];
            const trueStates = states.filter((state) => state);

            expect(trueStates.length).toBeLessThanOrEqual(1);
          });
        });
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty list operations', () => {
      const list = UploaderListMother.empty();

      // Check that first returns an empty uploader with expected properties
      expect(list.first.file).toBeUndefined();
      expect(list.first.progress).toBe(0);
      expect(list.first.is.idle).toBe(true);
      expect(list.files).toEqual([]);
      expect(list.completed.items).toHaveLength(0);
      expect(list.pending.items).toHaveLength(0);
      expect(list.progress.all).toEqual([]);
      expect(list.progress.completed).toBe(0);
      expect(list.progress.pending).toBe(0);
      expect(list.progress.total).toBeNaN();
      expect(list.is.idle).toBe(false); // NaN === 0 is false, so empty list is not idle
    });

    it('should handle single uploader list', () => {
      const uploader = UploaderMother.uploading(75);
      const list = UploaderListMother.builder().withUploader(uploader).build();

      expect(list.first).toBe(uploader);
      expect(list.progress.total).toBe(75);
      expect(list.is.uploading).toBe(true);
    });

    it('should handle large lists', () => {
      const list = UploaderListMother.builder()
        .withCompletedUploaders(50)
        .withUploadingUploaders(30)
        .withIdleUploaders(20)
        .build();

      expect(list.items).toHaveLength(100);
      expect(list.progress.completed).toBe(50);
      expect(list.progress.pending).toBe(50);
      expect(list.completed.items).toHaveLength(50);
      expect(list.pending.items).toHaveLength(50);
    });

    it('should handle boundary progress values', () => {
      const list = UploaderListMother.builder()
        .withUploader(UploaderMother.withProgress(-1))
        .withUploader(UploaderMother.withProgress(0))
        .withUploader(UploaderMother.withProgress(1))
        .withUploader(UploaderMother.withProgress(99))
        .withUploader(UploaderMother.withProgress(100))
        .withUploader(UploaderMother.withProgress(101))
        .build();

      expect(list.items).toHaveLength(6);
      expect(list.progress.all).toEqual([-1, 0, 1, 99, 100, 101]);
      expect(list.progress.total).toBe(Math.round((-1 + 0 + 1 + 99 + 100 + 101) / 6));
    });

    it('should handle extreme progress values', () => {
      const list = UploaderListMother.builder()
        .withUploader(UploaderMother.withProgress(-999))
        .withUploader(UploaderMother.withProgress(999))
        .withUploader(UploaderMother.withProgress(0))
        .build();

      expect(list.progress.all).toEqual([-999, 999, 0]);
      expect(list.progress.total).toBe(Math.round((-999 + 999 + 0) / 3)); // Should be 0
      expect(list.progress.completed).toBe(0); // No uploader has exactly 100
      expect(list.progress.pending).toBe(2); // -999 and 0 are < 100, but 999 is not
    });

    it('should handle mixed file types and states', () => {
      const imageFile = FileMother.smallImage().withName('image.jpg').build();
      const pdfFile = FileMother.pdfDocument().withName('document.pdf').build();
      const emptyFile = FileMother.emptyFile().withName('empty.txt').build();
      
      const list = UploaderListMother.builder()
        .withUploader(UploaderMother.builder().withFile(imageFile).asUploading(25).build())
        .withUploader(UploaderMother.builder().withFile(pdfFile).asCompleted().build())
        .withUploader(UploaderMother.builder().withFile(emptyFile).asIdle().build())
        .build();

      expect(list.files).toHaveLength(3);
      expect(list.files[0].name).toBe('image.jpg');
      expect(list.files[1].name).toBe('document.pdf');
      expect(list.files[2].name).toBe('empty.txt');
      
      expect(list.progress.completed).toBe(1);
      expect(list.progress.pending).toBe(2);
      expect(list.is.uploading).toBe(true); // Mixed progress
    });

    it('should handle decimal progress values', () => {
      const list = UploaderListMother.builder()
        .withUploader(UploaderMother.withProgress(33.33))
        .withUploader(UploaderMother.withProgress(66.67))
        .build();

      expect(list.progress.all).toEqual([33.33, 66.67]);
      expect(list.progress.total).toBe(Math.round((33.33 + 66.67) / 2)); // Should be 50
      expect(list.is.uploading).toBe(true);
    });
  });

  describe('Object Mother pattern usage', () => {
    it('should create different list instances', () => {
      const list1 = UploaderListMother.empty();
      const list2 = UploaderListMother.empty();

      expect(list1).not.toBe(list2);
      expect(list1.items).toEqual(list2.items);
    });

    it('should support method chaining in builder', () => {
      const list = UploaderListMother.builder()
        .withIdleUploaders(2)
        .withUploadingUploaders(2)
        .withCompletedUploaders(2)
        .build();

      expect(list.items).toHaveLength(6);
      expect(list.progress.completed).toBe(2);
      expect(list.progress.pending).toBe(4);
    });

    it('should provide convenient factory methods', () => {
      const empty = UploaderListMother.empty();
      const single = UploaderListMother.withSingleUploader();
      const multiple = UploaderListMother.withMultipleUploaders();

      expect(empty.items).toHaveLength(0);
      expect(single.items).toHaveLength(1);
      expect(multiple.items).toHaveLength(4); // mixed progress has 4 uploaders
    });

    it('should create lists from outputs', () => {
      const outputs: BaseUploaderOutput[] = [
        {
          file: FileMother.smallImage().build(),
          progress: () => 50,
          complete: () => Promise.resolve({ isRight: () => true, value: 'url' } as any),
        },
      ];

      const list = UploaderListMother.fromOutputs(outputs);

      expect(list.items).toHaveLength(1);
      expect(list.items[0]).toBeInstanceOf(Uploader);
    });
  });

  describe('inheritance from EntityList', () => {
    it('should inherit EntityList functionality', () => {
      const list = UploaderListMother.withMultipleUploaders();

      // Test inherited methods
      expect(typeof list.filter).toBe('function');
      expect(Array.isArray(list.items)).toBe(true);
    });

    it('should maintain type safety with inherited methods', () => {
      const list = UploaderListMother.withMultipleUploaders();

      const filtered = list.filter((uploader: Uploader) => uploader.progress > 50);
      expect(filtered).toBeInstanceOf(UploaderList);
    });

    it('should properly filter uploaders by progress', () => {
      const list = UploaderListMother.builder()
        .withUploader(UploaderMother.withProgress(25))
        .withUploader(UploaderMother.withProgress(75))
        .withUploader(UploaderMother.withProgress(100))
        .build();

      const highProgress = list.filter((uploader: Uploader) => uploader.progress >= 75);
      
      expect(highProgress.items).toHaveLength(2);
      expect(highProgress.items[0].progress).toBe(75);
      expect(highProgress.items[1].progress).toBe(100);
    });

    it('should properly filter uploaders by file type', () => {
      const imageFile = FileMother.smallImage().build();
      const pdfFile = FileMother.pdfDocument().build();
      
      const list = UploaderListMother.builder()
        .withUploader(UploaderMother.withFile(imageFile))
        .withUploader(UploaderMother.withFile(pdfFile))
        .build();

      const imageUploaders = list.filter((uploader: Uploader) => uploader.file.type.startsWith('image/'));
      
      expect(imageUploaders.items).toHaveLength(1);
      expect(imageUploaders.items[0].file.type).toBe('image/jpeg');
    });

    it('should handle empty filter results', () => {
      const list = UploaderListMother.allIdle();

      const completedUploaders = list.filter((uploader: Uploader) => uploader.is.completed);
      
      expect(completedUploaders.items).toHaveLength(0);
      expect(completedUploaders).toBeInstanceOf(UploaderList);
    });

    it('should support method chaining with inherited methods', () => {
      const list = UploaderListMother.builder()
        .withUploader(UploaderMother.withProgress(25))
        .withUploader(UploaderMother.withProgress(75))
        .withUploader(UploaderMother.withProgress(100))
        .build();

      const result = list
        .filter((uploader: Uploader) => uploader.progress > 0)
        .filter((uploader: Uploader) => uploader.progress < 100);
      
      expect(result.items).toHaveLength(2);
      expect(result.items[0].progress).toBe(25);
      expect(result.items[1].progress).toBe(75);
    });
  });
});
