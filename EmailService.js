class EmailService {
    constructor(providers, options = {}) {
      this.providers = providers; // Array of email providers
      this.activeProviderIndex = 0; // Start with the first provider
      this.retryLimit = options.retryLimit || 3;
      this.backoffFactor = options.backoffFactor || 2; // Exponential backoff multiplier
      this.rateLimit = options.rateLimit || 5; // Max emails per second
      this.sentEmails = new Map(); // Track sent emails for idempotency
      this.status = {}; // Track email status
      this.queue = []; // Queue for emails
      this.isProcessingQueue = false;
    }
  
    async sendEmail(email) {
      const { id } = email;
  
      // Ensure idempotency
      if (this.sentEmails.has(id)) {
        console.log(`Email with ID ${id} has already been sent.`);
        return { id, status: "duplicate" };
      }
  
      this.queue.push(email);
      this.processQueue();
      return { id, status: "queued" };
    }
  
    async processQueue() {
      if (this.isProcessingQueue) return;
      this.isProcessingQueue = true;
  
      while (this.queue.length > 0) {
        const email = this.queue.shift();
  
        // Apply rate limiting
        await this.rateLimitDelay();
  
        // Attempt to send the email
        const status = await this.trySendWithRetry(email);
        this.sentEmails.set(email.id, true); // Mark as sent (idempotency)
        this.status[email.id] = status;
      }
  
      this.isProcessingQueue = false;
    }
  
    async trySendWithRetry(email) {
      let attempts = 0;
      let success = false;
  
      while (attempts < this.retryLimit && !success) {
        try {
          success = await this.providers[this.activeProviderIndex].sendEmail(email);
          if (success) {
            console.log(`Email sent successfully with provider ${this.activeProviderIndex}.`);
            return "success";
          }
        } catch (error) {
          console.error(`Attempt ${attempts + 1} failed: ${error.message}`);
        }
  
        attempts++;
        await this.delay(attempts); // Exponential backoff
  
        // Switch provider on failure
        if (attempts === this.retryLimit) {
          this.switchProvider();
          attempts = 0; // Reset attempts for the new provider
        }
      }
  
      console.log(`Failed to send email after retries.`);
      return "failed";
    }
  
    switchProvider() {
      this.activeProviderIndex = (this.activeProviderIndex + 1) % this.providers.length;
      console.log(`Switched to provider ${this.activeProviderIndex}.`);
    }
  
    delay(attempts) {
      const delayTime = Math.pow(this.backoffFactor, attempts) * 1000;
      return new Promise((resolve) => setTimeout(resolve, delayTime));
    }
  
    rateLimitDelay() {
      return new Promise((resolve) => setTimeout(resolve, 1000 / this.rateLimit));
    }
  
    getEmailStatus(id) {
      return this.status[id] || "unknown";
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
  