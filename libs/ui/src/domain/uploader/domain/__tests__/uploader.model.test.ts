import * as E from '@sweet-monads/either';
import { BaseUploaderOutput } from '@shared/domain';
import { FileMother } from '../validators/__tests__/file.builder';
import { Uploader } from '../uploader.model';
import { UploaderMother } from './uploader.builder';

describe('Uploader', () => {
  describe('static factory methods', () => {
    describe('from', () => {
      it('should create uploader from BaseUploaderOutput', () => {
        const file = FileMother.smallImage().build();
        const output: BaseUploaderOutput = {
          file,
          progress: () => 50,
          complete: () => Promise.resolve(E.right('https://example.com/file.jpg')),
        };

        const uploader = Uploader.from(output);

        expect(uploader).toBeInstanceOf(Uploader);
        expect(uploader.file).toBe(file);
        expect(uploader.progress).toBe(50);
      });
    });

    describe('idle', () => {
      it('should create idle uploader from file', () => {
        const file = FileMother.smallImage().build();

        const uploader = Uploader.idle(file);

        expect(uploader).toBeInstanceOf(Uploader);
        expect(uploader.file).toBe(file);
        expect(uploader.progress).toBe(0);
        expect(uploader.is.idle).toBe(true);
        expect(uploader.is.uploading).toBe(false);
        expect(uploader.is.completed).toBe(false);
      });

      it('should handle different file types', () => {
        const imageFile = FileMother.smallImage().build();
        const pdfFile = FileMother.pdfDocument().build();
        const largeFile = FileMother.largeImage().build();

        const imageUploader = Uploader.idle(imageFile);
        const pdfUploader = Uploader.idle(pdfFile);
        const largeUploader = Uploader.idle(largeFile);

        expect(imageUploader.file).toBe(imageFile);
        expect(pdfUploader.file).toBe(pdfFile);
        expect(largeUploader.file).toBe(largeFile);

        [imageUploader, pdfUploader, largeUploader].forEach(uploader => {
          expect(uploader.progress).toBe(0);
          expect(uploader.is.idle).toBe(true);
        });
      });

      it('should create different instances for same file', () => {
        const file = FileMother.smallImage().build();
        const uploader1 = Uploader.idle(file);
        const uploader2 = Uploader.idle(file);

        expect(uploader1).not.toBe(uploader2);
        expect(uploader1.file).toBe(uploader2.file);
        expect(uploader1.progress).toBe(uploader2.progress);
      });

      it('should have empty completion URL', async () => {
        const file = FileMother.smallImage().build();
        const uploader = Uploader.idle(file);

        const result = await uploader.complete();

        expect(result.isRight()).toBe(true);
        expect(result.value).toBe('');
      });

      it('should handle empty files', () => {
        const emptyFile = FileMother.emptyFile().build();
        const uploader = Uploader.idle(emptyFile);

        expect(uploader.file).toBe(emptyFile);
        expect(uploader.progress).toBe(0);
        expect(uploader.is.idle).toBe(true);
      });
    });
  });

  describe('properties', () => {
    describe('file', () => {
      it('should return the file from the output', () => {
        const file = FileMother.pdfDocument().build();
        const uploader = UploaderMother.withFile(file);

        expect(uploader.file).toBe(file);
      });

      it('should handle different file types', () => {
        const imageFile = FileMother.smallImage().build();
        const pdfFile = FileMother.pdfDocument().build();

        const imageUploader = UploaderMother.withFile(imageFile);
        const pdfUploader = UploaderMother.withFile(pdfFile);

        expect(imageUploader.file).toBe(imageFile);
        expect(pdfUploader.file).toBe(pdfFile);
      });
    });

    describe('progress', () => {
      it('should return progress value from output', () => {
        const uploader = UploaderMother.withProgress(75);

        expect(uploader.progress).toBe(75);
      });

      it('should handle different progress values', () => {
        const progressValues = [0, 25, 50, 75, 100];

        progressValues.forEach((progress) => {
          const uploader = UploaderMother.withProgress(progress);
          expect(uploader.progress).toBe(progress);
        });
      });
    });
  });

  describe('methods', () => {
    describe('complete', () => {
      it('should return the complete promise from output', async () => {
        const expectedUrl = 'https://example.com/success.jpg';
        const uploader = UploaderMother.builder().withCompleteSuccess(expectedUrl).build();

        const result = await uploader.complete();

        expect(result.isRight()).toBe(true);
        expect(result.value).toBe(expectedUrl);
      });

      it('should handle completion errors', async () => {
        const error = new Error('Upload failed');
        const uploader = UploaderMother.withError(error);

        const result = await uploader.complete();

        expect(result.isLeft()).toBe(true);
        expect(result.value).toBe(error);
      });

      it('should return different URLs for different uploaders', async () => {
        const url1 = 'https://example.com/file1.jpg';
        const url2 = 'https://example.com/file2.jpg';

        const uploader1 = UploaderMother.builder().withCompleteSuccess(url1).build();
        const uploader2 = UploaderMother.builder().withCompleteSuccess(url2).build();

        const result1 = await uploader1.complete();
        const result2 = await uploader2.complete();

        expect(result1.value).toBe(url1);
        expect(result2.value).toBe(url2);
      });
    });
  });

  describe('computed properties', () => {
    describe('is', () => {
      describe('completed', () => {
        it('should return true when progress is 100', () => {
          const uploader = UploaderMother.completed();

          expect(uploader.is.completed).toBe(true);
        });

        it('should return false when progress is less than 100', () => {
          const progressValues = [0, 25, 50, 75, 99];

          progressValues.forEach((progress) => {
            const uploader = UploaderMother.withProgress(progress);
            expect(uploader.is.completed).toBe(false);
          });
        });
      });

      describe('uploading', () => {
        it('should return true when progress is between 1 and 99', () => {
          const progressValues = [1, 25, 50, 75, 99];

          progressValues.forEach((progress) => {
            const uploader = UploaderMother.withProgress(progress);
            expect(uploader.is.uploading).toBe(true);
          });
        });

        it('should return false when progress is 0 or 100', () => {
          const idleUploader = UploaderMother.idle();
          const completedUploader = UploaderMother.completed();

          expect(idleUploader.is.uploading).toBe(false);
          expect(completedUploader.is.uploading).toBe(false);
        });
      });

      describe('idle', () => {
        it('should return true when progress is 0', () => {
          const uploader = UploaderMother.idle();

          expect(uploader.is.idle).toBe(true);
        });

        it('should return false when progress is greater than 0', () => {
          const progressValues = [1, 25, 50, 75, 100];

          progressValues.forEach((progress) => {
            const uploader = UploaderMother.withProgress(progress);
            expect(uploader.is.idle).toBe(false);
          });
        });
      });

      describe('state combinations', () => {
        it('should have mutually exclusive states', () => {
          const progressValues = [0, 25, 50, 75, 100];

          progressValues.forEach((progress) => {
            const uploader = UploaderMother.withProgress(progress);
            const states = [uploader.is.idle, uploader.is.uploading, uploader.is.completed];
            const trueStates = states.filter((state) => state);

            expect(trueStates).toHaveLength(1);
          });
        });

        it('should cover all possible states', () => {
          const progressValues = [0, 25, 50, 75, 100];

          progressValues.forEach((progress) => {
            const uploader = UploaderMother.withProgress(progress);
            const hasAnyState = uploader.is.idle || uploader.is.uploading || uploader.is.completed;

            expect(hasAnyState).toBe(true);
          });
        });
      });
    });
  });

  describe('edge cases', () => {
    it('should handle boundary progress values', () => {
      const boundaryValues = [-1, 0, 1, 99, 100, 101];

      boundaryValues.forEach((progress) => {
        const uploader = UploaderMother.withProgress(progress);

        expect(uploader.progress).toBe(progress);
        expect(typeof uploader.is.idle).toBe('boolean');
        expect(typeof uploader.is.uploading).toBe('boolean');
        expect(typeof uploader.is.completed).toBe('boolean');
      });
    });

    it('should handle empty file names', () => {
      const emptyNameFile = FileMother.emptyFile().withName('').build();
      const uploader = UploaderMother.withFile(emptyNameFile);

      expect(uploader.file).toBe(emptyNameFile);
      expect(uploader.file.name).toBe('');
    });

    it('should handle large files', () => {
      const largeFile = FileMother.largeImage().build();
      const uploader = UploaderMother.withFile(largeFile);

      expect(uploader.file).toBe(largeFile);
      expect(uploader.file.size).toBeGreaterThan(1000000); // > 1MB
    });

    it('should handle static idle method with various files', () => {
      const files = [
        FileMother.smallImage().build(),
        FileMother.pdfDocument().build(),
        FileMother.emptyFile().build(),
        FileMother.largeImage().build(),
      ];

      files.forEach(file => {
        const uploader = Uploader.idle(file);
        expect(uploader.file).toBe(file);
        expect(uploader.progress).toBe(0);
        expect(uploader.is.idle).toBe(true);
      });
    });
  });

  describe('static methods integration', () => {
    it('should work with both static factory methods', () => {
      const file = FileMother.smallImage().build();
      
      // Test Uploader.idle
      const idleUploader = Uploader.idle(file);
      expect(idleUploader.file).toBe(file);
      expect(idleUploader.progress).toBe(0);
      
      // Test Uploader.from with equivalent output
      const output: BaseUploaderOutput = {
        file,
        progress: () => 0,
        complete: () => Promise.resolve(E.right('')),
      };
      const fromUploader = Uploader.from(output);
      
      // Both should behave identically for idle state
      expect(idleUploader.progress).toBe(fromUploader.progress);
      expect(idleUploader.is.idle).toBe(fromUploader.is.idle);
    });

    it('should handle Uploader.empty() edge case', () => {
      const emptyUploader = Uploader.empty();
      
      expect(emptyUploader.file).toBeUndefined();
      expect(emptyUploader.progress).toBe(0);
      expect(emptyUploader.is.idle).toBe(true);
      expect(emptyUploader.is.uploading).toBe(false);
      expect(emptyUploader.is.completed).toBe(false);
    });

    it('should handle completion with empty uploader', async () => {
      const emptyUploader = Uploader.empty();
      
      const result = await emptyUploader.complete();
      
      expect(result.isRight()).toBe(true);
      expect(result.value).toBe('');
    });
  });

  describe('Object Mother pattern usage', () => {
    it('should create different uploader instances', () => {
      const uploader1 = UploaderMother.idle();
      const uploader2 = UploaderMother.idle();

      expect(uploader1).not.toBe(uploader2);
      expect(uploader1.progress).toBe(uploader2.progress);
    });

    it('should support method chaining in builder', () => {
      const file = FileMother.smallImage().build();
      const uploader = UploaderMother.builder()
        .withFile(file)
        .withProgress(75)
        .withCompleteSuccess('https://example.com/test.jpg')
        .build();

      expect(uploader.file).toBe(file);
      expect(uploader.progress).toBe(75);
    });

    it('should provide convenient factory methods', () => {
      const idle = UploaderMother.idle();
      const uploading = UploaderMother.uploading();
      const completed = UploaderMother.completed();

      expect(idle.is.idle).toBe(true);
      expect(uploading.is.uploading).toBe(true);
      expect(completed.is.completed).toBe(true);
    });

    it('should compare static idle method with UploaderMother', () => {
      const file = FileMother.smallImage().build();
      const staticIdle = Uploader.idle(file);
      const motherIdle = UploaderMother.idle();

      expect(staticIdle.progress).toBe(motherIdle.progress);
      expect(staticIdle.is.idle).toBe(motherIdle.is.idle);
      expect(staticIdle.is.uploading).toBe(motherIdle.is.uploading);
      expect(staticIdle.is.completed).toBe(motherIdle.is.completed);
    });

    it('should test static methods consistency', () => {
      const file = FileMother.smallImage().build();
      const output: BaseUploaderOutput = {
        file,
        progress: () => 0,
        complete: () => Promise.resolve(E.right('')),
      };

      const fromUploader = Uploader.from(output);
      const idleUploader = Uploader.idle(file);

      expect(fromUploader.file).toBe(idleUploader.file);
      expect(fromUploader.progress).toBe(idleUploader.progress);
      expect(fromUploader.is.idle).toBe(idleUploader.is.idle);
    });
  });
});
