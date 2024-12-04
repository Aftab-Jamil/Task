class EmailService {
  constructor(providers, options = {}) {
    this.providers = providers; // List of email providers
    this.retryLimit = options.retryLimit || 3; // Maximum number of retries
    this.rateLimitDelay = options.rateLimitDelay || 1000; // Delay between emails
    this.sentEmails = new Set(); // To track emails already sent (for idempotency)
    this.queue = []; // Queue for emails waiting to be sent
    this.processing = false; // To check if a queue is being processed
  }

  async sendEmail(email) {
    if (this.sentEmails.has(email.id)) {
      console.log(`Email with ID ${email.id} already sent.`);
      return;
    }

    this.queue.push(email); // Add email to the queue
    this.sentEmails.add(email.id); // Mark email as sent to prevent duplicates

    if (!this.processing) {
      this.processing = true;
      await this.processQueue(); // Start processing the queue
    }
  }

  async processQueue() {
    while (this.queue.length > 0) {
      const email = this.queue.shift(); // Get the next email from the queue
      let success = false;

      for (const provider of this.providers) {
        for (let attempt = 0; attempt < this.retryLimit; attempt++) {
          success = await provider.sendEmail(email); // Try to send email
          if (success) break; // Exit retry loop if successful
          await this.delay(Math.pow(2, attempt) * 100); // Exponential backoff
        }

        if (success) break; // Exit provider loop if successful
      }

      if (!success) {
        console.log(`Failed to send email to ${email.to}`);
      }

      await this.delay(this.rateLimitDelay); // Wait before processing the next email
    }

    this.processing = false; // Mark processing as finished
  }

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms)); // Wait for the specified time
  }
  getEmailStatus(emailId) {
    if (this.sentEmails.has(emailId)) {
      return "Sent";
    }
    const emailInQueue = this.queue.find((email) => email.id === emailId);
    return emailInQueue ? "In Queue" : "Unknown";
  }
}

  
  class MockEmailProvider {
    constructor(successRate = 0.7) {
      this.successRate = successRate;
    }
  
    async sendEmail(email) {
      console.log(`Mock provider attempting to send email to ${email.to}`);
      return Math.random() < this.successRate;
    }
  }
  
  // Example usage
  const provider1 = new MockEmailProvider(0.8);
  const provider2 = new MockEmailProvider(0.5);
  
  const emailService = new EmailService([provider1, provider2], {
    retryLimit: 3,
    backoffFactor: 2,
    rateLimit: 2,
  });
  
  // Send email
  emailService.sendEmail({
    id: "1",
    to: "example@example.com",
    subject: "Test Email",
    body: "This is a test email.",
  });
  
  // Check status
  setTimeout(() => {
    console.log(emailService.getEmailStatus("1"));
  }, 5000);
  
