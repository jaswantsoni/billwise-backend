const axios = require('axios');
const FormData = require('form-data');

class QueuedPdfService {
  constructor() {
    this.gotenbergUrl = process.env.GOTENBERG_URL || 'http://localhost:3000';
    this.busy = false;
    this.queue = [];
    this.maxRetries = 3;
    this.timeout = 60000; // 60 seconds
    this.maxConcurrency = 2; // Match Gotenberg config
    this.activeJobs = 0;
  }

  /**
   * Add PDF generation job to queue
   * @param {string} html - HTML content
   * @param {object} options - PDF generation options
   * @returns {Promise<Buffer>} PDF buffer
   */
  async generatePdf(html, options = {}) {
    return new Promise((resolve, reject) => {
      const job = {
        html,
        options,
        resolve,
        reject,
        retries: 0,
        timestamp: Date.now()
      };

      this.queue.push(job);
      this.processQueue();
    });
  }

  /**
   * Process the PDF generation queue
   */
  async processQueue() {
    // Don't start new jobs if we're at max concurrency
    if (this.activeJobs >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    this.activeJobs++;

    const jobId = Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();

    try {
      console.log(`[PDF Queue] 🚀 Starting job ${jobId} (${this.activeJobs}/${this.maxConcurrency} active, ${this.queue.length} queued)`);
      
      const pdfBuffer = await this.callGotenberg(job.html, job.options);
      
      const duration = Date.now() - startTime;
      console.log(`[PDF Queue] ✅ Job ${jobId} completed in ${duration}ms - PDF size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);
      
      job.resolve(pdfBuffer);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[PDF Queue] ❌ Job ${jobId} failed after ${duration}ms:`, error.message);
      
      // Retry logic
      if (job.retries < this.maxRetries) {
        job.retries++;
        const retryDelay = 1000 * job.retries; // Exponential backoff
        console.log(`[PDF Queue] 🔄 Retrying job ${jobId} in ${retryDelay}ms (attempt ${job.retries}/${this.maxRetries})`);
        
        // Add back to queue with delay
        setTimeout(() => {
          this.queue.unshift(job); // Add to front for priority
          this.processQueue();
        }, retryDelay);
      } else {
        console.error(`[PDF Queue] 💀 Job ${jobId} failed permanently after ${this.maxRetries} attempts`);
        job.reject(new Error(`PDF generation failed after ${this.maxRetries} attempts: ${error.message}`));
      }
    } finally {
      this.activeJobs--;
      
      // Process next job in queue
      setTimeout(() => this.processQueue(), 100);
    }
  }

  /**
   * Make actual call to Gotenberg service
   * @param {string} html - HTML content
   * @param {object} options - PDF options
   * @returns {Promise<Buffer>} PDF buffer
   */
  async callGotenberg(html, options = {}) {
    const startTime = Date.now();
    console.log(`[PDF Service] Starting PDF generation - HTML size: ${html.length} chars`);
    
    try {
      // Create form data
      const form = new FormData();
      
      // Add HTML file
      form.append('files', Buffer.from(html), 'index.html');
      
      // Add CSS if provided
      if (options.css) {
        form.append('files', Buffer.from(options.css), 'style.css');
        console.log(`[PDF Service] CSS provided - size: ${options.css.length} chars`);
      }
      
      // Add Gotenberg-specific options
      const gotenbergOptions = {
        paperWidth: options.paperWidth || '8.27',
        paperHeight: options.paperHeight || '11.7',
        marginTop: options.marginTop || '0.39',
        marginBottom: options.marginBottom || '0.39',
        marginLeft: options.marginLeft || '0.39',
        marginRight: options.marginRight || '0.39',
        preferCssPageSize: options.preferCssPageSize || 'false',
        printBackground: options.printBackground || 'true',
        landscape: options.landscape || 'false',
        scale: options.scale || '1.0'
      };

      console.log(`[PDF Service] Gotenberg options:`, gotenbergOptions);

      // Add options to form
      Object.entries(gotenbergOptions).forEach(([key, value]) => {
        form.append(key, value);
      });

      console.log(`[PDF Service] Making request to: ${this.gotenbergUrl}/forms/chromium/convert/html`);

      // Make request to Gotenberg
      const response = await axios.post(
        `${this.gotenbergUrl}/forms/chromium/convert/html`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Content-Type': 'multipart/form-data'
          },
          responseType: 'arraybuffer',
          timeout: this.timeout,
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      const duration = Date.now() - startTime;
      const pdfSize = response.data.byteLength;
      console.log(`[PDF Service] ✅ PDF generated successfully in ${duration}ms - Size: ${(pdfSize / 1024).toFixed(1)} KB`);

      return Buffer.from(response.data);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[PDF Service] ❌ Generation failed after ${duration}ms:`, error.message);
      
      if (error.code === 'ECONNREFUSED') {
        console.error(`[PDF Service] 🔌 Connection refused to ${this.gotenbergUrl}`);
        throw new Error('Gotenberg service is not available. Please check if the service is running.');
      } else if (error.code === 'ETIMEDOUT') {
        console.error(`[PDF Service] ⏰ Request timed out after ${this.timeout}ms`);
        throw new Error('PDF generation timed out. The document might be too complex.');
      } else if (error.response) {
        console.error(`[PDF Service] 🚫 Gotenberg error: ${error.response.status} - ${error.response.statusText}`);
        if (error.response.data) {
          console.error(`[PDF Service] Response data:`, error.response.data.toString().substring(0, 500));
        }
        throw new Error(`Gotenberg error: ${error.response.status} - ${error.response.statusText}`);
      } else {
        console.error(`[PDF Service] 💥 Unexpected error:`, error);
        throw new Error(`PDF generation failed: ${error.message}`);
      }
    }
  }

  /**
   * Health check for Gotenberg service
   * @returns {Promise<boolean>} Service health status
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.gotenbergUrl}/health`, {
        timeout: 5000
      });
      
      return response.status === 200;
    } catch (error) {
      console.error('[PDF Service] Health check failed:', error.message);
      return false;
    }
  }

  /**
   * Get queue statistics
   * @returns {object} Queue stats
   */
  getQueueStats() {
    return {
      queueLength: this.queue.length,
      activeJobs: this.activeJobs,
      maxConcurrency: this.maxConcurrency,
      isHealthy: this.gotenbergUrl ? true : false
    };
  }

  /**
   * Clear the queue (emergency use)
   */
  clearQueue() {
    const clearedJobs = this.queue.length;
    this.queue.forEach(job => {
      job.reject(new Error('Queue cleared by administrator'));
    });
    this.queue = [];
    console.log(`[PDF Queue] Cleared ${clearedJobs} jobs from queue`);
    return clearedJobs;
  }

  /**
   * Wake up Gotenberg service (for Railway/cloud deployments)
   */
  async wakeUpService() {
    try {
      console.log('[PDF Service] Attempting to wake up Gotenberg...');
      
      // Try health check first
      const isHealthy = await this.healthCheck();
      if (isHealthy) {
        console.log('[PDF Service] Gotenberg is already awake');
        return true;
      }

      // Wait and try again
      console.log('[PDF Service] Waiting for Gotenberg to wake up...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      
      return await this.healthCheck();
    } catch (error) {
      console.error('[PDF Service] Failed to wake up service:', error.message);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new QueuedPdfService();