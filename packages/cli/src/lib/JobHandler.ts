import { Client } from "@graphand/client";
import { Job, JobStatus, controllerJobLogs, ModelInstance } from "@graphand/core";
import { Ora } from "ora";
import chalk from "chalk";
import { processLogs } from "./utils.js";

type SpinnerConfig = {
  spinner: Ora;
  message?: string | ((_job: ModelInstance<typeof Job>) => string);
  messageSuccess?: string | ((_job: ModelInstance<typeof Job>) => string);
  messageFail?: string | ((_job: ModelInstance<typeof Job>) => string);
};

type JobHandlerParams = {
  client?: Client;
  onChange?: (_job: ModelInstance<typeof Job>) => void;
  onSuccess?: (_job: ModelInstance<typeof Job>) => void;
  onFail?: (_job: ModelInstance<typeof Job>) => void;
  pollInterval?: number;
  spin?: SpinnerConfig;
};

class JobHandler {
  #jobId: string;
  #params: JobHandlerParams;

  constructor(jobId: string, params: JobHandlerParams) {
    this.#jobId = jobId;
    this.#params = params;
  }

  get client() {
    const _client = this.#params.client || globalThis.client;

    if (!_client) {
      throw new Error("Client not found in job handler. Define a global client or pass a client instance as parameter");
    }

    return _client;
  }

  get jobId() {
    return this.#jobId;
  }

  #getStatusColor(status: JobStatus): "green" | "red" | "cyan" {
    switch (status) {
      case JobStatus.COMPLETED: {
        return "green";
      }
      case JobStatus.FAILED: {
        return "red";
      }
      default: {
        return "cyan";
      }
    }
  }

  async #handleJob(job: ModelInstance<typeof Job>): Promise<void> {
    if (this.#params.spin) {
      let message: string;
      if (this.#params.spin?.message) {
        message =
          typeof this.#params.spin.message === "function" ? this.#params.spin.message(job) : this.#params.spin.message;
      }
      message ??= `Job ${job._type} (${chalk.bold(job._id)}) is: ${chalk[this.#getStatusColor((job._status as JobStatus) || JobStatus.FAILED)](job._status || "unknown")} ...`;

      this.#params.spin.spinner.text = message;
    }

    await this.#params.onChange?.(job);
  }

  async #fetch(): Promise<ModelInstance<typeof Job> | null> {
    const job = await this.client
      .model(Job)
      .get(this.jobId, { disableCache: true })
      .catch(() => null);

    if (job) {
      await this.#handleJob(job);
    }

    return job;
  }

  async wait(): Promise<ModelInstance<typeof Job>> {
    let job: ModelInstance<typeof Job> = (await this.#fetch()) as ModelInstance<typeof Job>;

    if (!job) {
      throw new Error("Job not found");
    }

    await this.#fetch();

    const stream = await this.client
      .execute(controllerJobLogs, {
        params: { id: this.jobId },
        query: { stream: "1" },
      })
      .then(r => r.body?.getReader());

    const abortController = new AbortController();
    const logsPromise = processLogs({
      stream,
      spinner: this.#params.spin?.spinner,
      endAction: "end-job",
      abortController,
    });

    let unsubscribe: undefined | (() => void);

    const endPromise = new Promise<void>(resolve => {
      unsubscribe = job.subscribe(() => {
        this.#handleJob(job);
        if (job._status && [JobStatus.COMPLETED, JobStatus.FAILED].includes(job._status as JobStatus)) {
          resolve();
        }
      });
    });

    let racePromise: Promise<void>;

    const pollInterval = this.#params.pollInterval ?? 1000;
    if (pollInterval) {
      const pollPromise = new Promise<void>(async (resolve, reject) => {
        try {
          while (job._status && ![JobStatus.COMPLETED, JobStatus.FAILED].includes(job._status as JobStatus)) {
            await job.refreshData({ disableCache: true });
            await new Promise(resolve => setTimeout(resolve, pollInterval));
          }
          resolve();
        } catch (e) {
          reject(e);
        }
      });

      racePromise = Promise.race([endPromise, pollPromise]);
    } else {
      racePromise = endPromise;
    }

    await Promise.race([logsPromise, racePromise]);

    abortController.abort();
    unsubscribe?.();

    if (job._status === JobStatus.FAILED) {
      if (this.#params.spin) {
        let message: string;
        if (this.#params.spin?.messageFail !== undefined) {
          message =
            typeof this.#params.spin.messageFail === "function"
              ? this.#params.spin.messageFail(job)
              : this.#params.spin.messageFail;
        }
        message ??= `${chalk[this.#getStatusColor(job._status as JobStatus)](job._status as JobStatus)}: Job ${job._type} (${chalk.bold(job._id)}) has failed with error: ${chalk.bold(String(job._result?.error ?? "Unknown error"))}`;

        if (message) {
          this.#params.spin.spinner.fail(message);
        }
      }

      await this.#params.onFail?.(job);
    }

    if (job._status === JobStatus.COMPLETED) {
      if (this.#params.spin) {
        let message: string;
        if (this.#params.spin?.messageSuccess !== undefined) {
          message =
            typeof this.#params.spin.messageSuccess === "function"
              ? this.#params.spin.messageSuccess(job)
              : this.#params.spin.messageSuccess;
        }
        message ??= `${chalk[this.#getStatusColor(job._status as JobStatus)](job._status as JobStatus)}: Job ${job._type} (${chalk.bold(job._id)}) has finished successfully`;

        if (message) {
          this.#params.spin.spinner.succeed(message);
        }
      }

      await this.#params.onSuccess?.(job);
    }

    return job;
  }
}

export default JobHandler;
