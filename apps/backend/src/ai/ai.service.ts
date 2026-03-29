import { Injectable, Logger } from '@nestjs/common';
import { AiProviderRegistry } from './ai-provider.registry';
import { AiOperation } from './dto/ai-transform.dto';

const EDITOR_CAPABILITIES = `You are writing content for a rich text editor. Return your response as HTML (not Markdown).
Use these HTML tags for formatting:
- <h1>, <h2>, <h3> for headings
- <p> for paragraphs
- <strong> for bold, <em> for italic
- <ul><li> for bullet lists, <ol><li> for numbered lists
- <blockquote> for quotes
- <code> for inline code, <pre><code> for code blocks
- <table><thead><tr><th> and <tbody><tr><td> for tables
- <hr> for horizontal rules
- <a href="url"> for links

Structure the content well with headings and paragraphs. Return ONLY HTML content, no markdown, no preamble, no wrapping.`;

const OPERATION_PROMPTS: Record<string, string> = {
  [AiOperation.EXPAND]:
    `${EDITOR_CAPABILITIES}\n\nExpand the following text with more detail, examples, and explanation. Use headings, lists, and formatting to structure the expanded content.`,
  [AiOperation.SUMMARIZE]:
    `${EDITOR_CAPABILITIES}\n\nSummarize the following text concisely while preserving key points. Use bullet points or numbered lists for clarity.`,
  [AiOperation.FIX_GRAMMAR]:
    'Fix grammar, spelling, and punctuation errors in the following text. Keep the original meaning, tone, and formatting. Return only the corrected text, no preamble.',
  [AiOperation.CHANGE_TONE]:
    `${EDITOR_CAPABILITIES}\n\nRewrite the following text in a more professional and polished tone while preserving the original meaning. Keep appropriate formatting.`,
  [AiOperation.CUSTOM_PROMPT]:
    `${EDITOR_CAPABILITIES}\n\nApply the user's instruction to the following text. Follow the instruction precisely.`,
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly maxTokens: number;

  constructor(private registry: AiProviderRegistry) {
    const parsed = parseInt(process.env.AI_MAX_TOKENS || '', 10);
    this.maxTokens = Number.isFinite(parsed) && parsed > 0 ? parsed : 2048;
  }

  async *streamTransform(
    selection: string,
    operation: AiOperation,
    context?: string,
    customPrompt?: string,
  ): AsyncGenerator<string> {
    const provider = await this.registry.getActiveProvider();
    if (!provider) {
      throw new Error('NO_PROVIDER_CONFIGURED');
    }

    let systemPrompt = OPERATION_PROMPTS[operation] || OPERATION_PROMPTS[AiOperation.CUSTOM_PROMPT];

    // For custom-prompt, prepend user's instruction
    if (operation === AiOperation.CUSTOM_PROMPT && customPrompt) {
      systemPrompt = `${EDITOR_CAPABILITIES}\n\nInstruction: ${customPrompt}\n\nApply this instruction to the following text.`;
    }

    let userMessage = selection;

    if (context) {
      const trimmedContext = context.slice(0, 4000);
      userMessage = `Context:\n${trimmedContext}\n\n---\n\nText to transform:\n${selection}`;
    }

    yield* provider.streamTransform(systemPrompt, userMessage, this.maxTokens);
  }

  async isEnabled(): Promise<boolean> {
    return this.registry.isEnabled();
  }

  async getStatus(): Promise<{ aiEnabled: boolean; provider: string | null }> {
    return this.registry.getStatus();
  }
}
