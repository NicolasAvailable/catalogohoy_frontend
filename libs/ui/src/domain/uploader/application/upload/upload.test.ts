import { E } from '@shared/domain';
import { of } from 'rxjs';
import { BaseUploaderOutput } from '@shared/domain';
import { BaseUploaderService, UploaderList } from '../../domain';
import { FileMother } from '../../domain/validators/__tests__/file.builder';
import { UploadUseCase, UploadUseCaseInput } from './upload.usecase';

const createMockUploader = (file: File, url: string = 'https://example.com/uploaded-file.jpg'): BaseUploaderOutput => ({
  file,
  progress: () => 100,
  complete: () => Promise.resolve(E.right(url)),
});

const createFailedUploader = (file: File, error: Error): BaseUploaderOutput => ({
  file,
  progress: () => 0,
  complete: () => Promise.resolve(E.left(error)),
});

describe('UploadUseCase', () => {
  let useCase: UploadUseCase;
  let mockUploaderService: jest.Mocked<BaseUploaderService>;

  beforeEach(() => {
    mockUploaderService = {
      upload: jest.fn(),
    } as jest.Mocked<BaseUploaderService>;

    useCase = new UploadUseCase(mockUploaderService);
  });

  describe('execute', () => {
    describe('single file upload', () => {
      it('should upload a single file successfully', async () => {
        const file = FileMother.smallImage().build();
        const input: UploadUseCaseInput = { files: [file] };
        const expectedUrl = 'https://example.com/uploaded-file.jpg';

        mockUploaderService.upload.mockReturnValue(of(createMockUploader(file, expectedUrl)));

        const result = await useCase.execute(input);

        expect(result.isRight()).toBe(true);
        const uploaderList = result.value as UploaderList;
        expect(uploaderList.items).toHaveLength(1);
        expect(uploaderList.first.progress).toBe(100);
        expect(uploaderList.first.is.completed).toBe(true);
        expect(mockUploaderService.upload).toHaveBeenCalledTimes(1);
        expect(mockUploaderService.upload).toHaveBeenCalledWith(file);
      });
    });

    describe('multiple file upload', () => {
      it('should upload multiple files successfully', async () => {
        const files = [
          FileMother.smallImage().withName('image1.jpg').build(),
          FileMother.smallImage().withName('image2.jpg').build(),
          FileMother.smallImage().withName('image3.jpg').build(),
        ];
        const input: UploadUseCaseInput = { files };
        const urls = [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg',
          'https://example.com/image3.jpg',
        ];

        mockUploaderService.upload
          .mockReturnValueOnce(of(createMockUploader(files[0], urls[0])))
          .mockReturnValueOnce(of(createMockUploader(files[1], urls[1])))
          .mockReturnValueOnce(of(createMockUploader(files[2], urls[2])));

        const result = await useCase.execute(input);

        expect(result.isRight()).toBe(true);
        const uploaderList = result.value as UploaderList;
        expect(uploaderList.items).toHaveLength(3);
        uploaderList.items.forEach((uploader) => {
          expect(uploader.progress).toBe(100);
          expect(typeof uploader.complete).toBe('function');
        });
        expect(mockUploaderService.upload).toHaveBeenCalledTimes(3);
        files.forEach((file, index) => {
          expect(mockUploaderService.upload).toHaveBeenNthCalledWith(index + 1, file);
        });
      });

      it('should filter out failed uploads and return successful URLs', async () => {
        const files = [
          FileMother.smallImage().withName('image1.jpg').build(),
          FileMother.smallImage().withName('image2.jpg').build(),
          FileMother.smallImage().withName('image3.jpg').build(),
        ];
        const input: UploadUseCaseInput = { files };
        const successfulUrls = ['https://example.com/image1.jpg', 'https://example.com/image3.jpg'];

        mockUploaderService.upload
          .mockReturnValueOnce(of(createMockUploader(files[0], successfulUrls[0])))
          .mockReturnValueOnce(of(createFailedUploader(files[1], new Error('Upload failed'))))
          .mockReturnValueOnce(of(createMockUploader(files[2], successfulUrls[1])));

        const result = await useCase.execute(input);

        expect(result.isRight()).toBe(true);
        const uploaderList = result.value as UploaderList;
        expect(uploaderList.items).toHaveLength(3);
        expect(uploaderList.items[0].progress).toBe(100);
        expect(uploaderList.items[1].progress).toBe(0);
        expect(uploaderList.items[2].progress).toBe(100);
        expect(mockUploaderService.upload).toHaveBeenCalledTimes(3);
      });
    });

    describe('integration tests', () => {
      it('should execute successfully and return right result', async () => {
        const file = FileMother.smallImage().build();
        const input: UploadUseCaseInput = { files: [file] };

        mockUploaderService.upload.mockReturnValue(of(createMockUploader(file)));

        const result = await useCase.execute(input);

        expect(result.isRight()).toBe(true);
        const uploaderList = result.value as UploaderList;
        expect(uploaderList.items).toHaveLength(1);
        expect(uploaderList.first.progress).toBe(100);
      });
    });

    describe('edge cases', () => {
      it('should handle empty files array', async () => {
        const input: UploadUseCaseInput = { files: [] };

        const result = await useCase.execute(input);

        expect(result.isRight()).toBe(true);
        const uploaderList = result.value as UploaderList;
        expect(uploaderList.items).toEqual([]);
        expect(mockUploaderService.upload).not.toHaveBeenCalled();
      });

      it('should handle large files', async () => {
        const file = FileMother.largeImage().build();
        const input: UploadUseCaseInput = { files: [file] };
        const expectedUrl = 'https://example.com/large-file.jpg';

        mockUploaderService.upload.mockReturnValue(of(createMockUploader(file, expectedUrl)));

        const result = await useCase.execute(input);

        expect(result.isRight()).toBe(true);
        const uploaderList = result.value as UploaderList;
        expect(uploaderList.items[0].progress).toBe(100);
        expect(typeof uploaderList.items[0].complete).toBe('function');
        expect(mockUploaderService.upload).toHaveBeenCalledWith(file);
      });

      it('should handle PDF files', async () => {
        const file = FileMother.pdfDocument().build();
        const input: UploadUseCaseInput = { files: [file] };
        const expectedUrl = 'https://example.com/document.pdf';

        mockUploaderService.upload.mockReturnValue(of(createMockUploader(file, expectedUrl)));

        const result = await useCase.execute(input);

        expect(result.isRight()).toBe(true);
        const uploaderList = result.value as UploaderList;
        expect(uploaderList.items[0].progress).toBe(100);
        expect(mockUploaderService.upload).toHaveBeenCalledWith(file);
      });
    });

    describe('use case lifecycle', () => {
      it('should not call complete on successful validation', async () => {
        const file = FileMother.smallImage().build();
        const input: UploadUseCaseInput = {
          files: [file],
        };

        mockUploaderService.upload.mockReturnValue(of(createMockUploader(file, 'https://example.com/file.jpg')));
        const completeSpy = jest.spyOn(useCase, 'complete' as keyof UploadUseCase);

        await useCase.execute(input);

        expect(completeSpy).not.toHaveBeenCalled();
      });
    });
  });
});
