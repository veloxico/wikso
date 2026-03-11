import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailService } from '../../mail/mail.service';

interface EmailJobData {
  to: string;
  subject: string;
  html: string;
}

@Processor('emails')
export class EmailProcessor extends WorkerHost {
  private logger = new Logger(EmailProcessor.name);

  constructor(private mailService: MailService) {
    super();
  }

  async process(job: Job<EmailJobData>): Promise<void> {
    try {
      await this.mailService.sendDirect(job.data);
    } catch (err) {
      this.logger.warn(`Failed to send email to ${job.data.to}: ${err.message}`);
      throw err; // Let BullMQ retry
    }
  }
}
