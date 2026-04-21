import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';

describe('AiChatController', () => {
  let controller: AiChatController;
  let service: {
    listConversations: jest.Mock;
    createConversation: jest.Mock;
    getConversation: jest.Mock;
    deleteConversation: jest.Mock;
    streamAnswer: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      listConversations: jest.fn(),
      createConversation: jest.fn(),
      getConversation: jest.fn(),
      deleteConversation: jest.fn(),
      streamAnswer: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiChatController],
      providers: [{ provide: AiChatService, useValue: service }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AiChatController>(AiChatController);
  });

  it('is defined', () => {
    expect(controller).toBeDefined();
  });

  it('list() delegates to service with pagination', async () => {
    service.listConversations.mockResolvedValue({ data: [], total: 0, skip: 0, take: 20 });
    const result = await controller.list({ id: 'u1' } as any, { skip: 0, take: 20 });
    expect(service.listConversations).toHaveBeenCalledWith('u1', 0, 20);
    expect(result).toEqual({ data: [], total: 0, skip: 0, take: 20 });
  });

  it('create() uses the title from the DTO', async () => {
    service.createConversation.mockResolvedValue({ id: 'c1', title: 'Hi' });
    await controller.create({ id: 'u1' } as any, { title: 'Hi' });
    expect(service.createConversation).toHaveBeenCalledWith('u1', 'Hi');
  });

  it('get() and remove() pass the id + user through', async () => {
    service.getConversation.mockResolvedValue({ id: 'c1' });
    service.deleteConversation.mockResolvedValue({ success: true });
    await controller.get('c1', { id: 'u1' } as any);
    await controller.remove('c1', { id: 'u1' } as any);
    expect(service.getConversation).toHaveBeenCalledWith('c1', 'u1');
    expect(service.deleteConversation).toHaveBeenCalledWith('c1', 'u1');
  });

  it('send() pipes the provider stream to the response and ends it', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"delta":"hi"}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    service.streamAnswer.mockResolvedValue(stream);

    const writes: Buffer[] = [];
    const res: any = {
      setHeader: jest.fn(),
      flushHeaders: jest.fn(),
      write: (chunk: Buffer) => writes.push(chunk),
      end: jest.fn(),
    };

    await controller.send('c1', { id: 'u1' } as any, { message: 'Hello' }, res);
    expect(service.streamAnswer).toHaveBeenCalledWith('c1', 'u1', 'Hello');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(res.end).toHaveBeenCalled();
    const body = Buffer.concat(writes).toString();
    expect(body).toContain('"delta":"hi"');
    expect(body).toContain('[DONE]');
  });
});
